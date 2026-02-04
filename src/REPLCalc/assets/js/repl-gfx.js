import { splitStatements, findTopLevelEquals } from "./repl-parser.js";
import { isQty } from "./repl-units.js";
import { EFFECT } from "./repl-effects.js";

const GFX_LIMIT = 512;
const GFX_DEFAULT_SCALE = 6;
const GFX_LOOP_DEFAULT_FPS = 12;
const GFX_LOOP_MIN_FPS = 1;
const GFX_LOOP_MAX_FPS = 60;
const GFX_BACKENDS = [
  "auto",
  "2d",
  "webgl2",
  "webgpu",
];
export const GFX_COLOR_TOKENS = [
  "transparent",
  "accent",
  "accent-2",
  "ok",
  "warn",
  "err",
  "string",
  "text",
  "muted",
];

export function createGfxTools({ state, terminalEl, writeLine }){
  let gfxPaletteCache = null;
  let gfxColorContext = null;
  let runExpressionWithContext = null;
  let runLoopStatement = null;
  let gfxBackend = "auto";
  let pointerLockListenerAttached = false;
  let webgpuAdapter = null;
  let webgpuDevice = null;
  let webgpuInitPromise = null;
  let webgl2Supported = null;

  const keyState = {
    down: Object.create(null),
  };

  const mouseState = {
    dx: 0,
    dy: 0,
    buttons: Object.create(null),
    locked: false,
  };

  const loopState = {
    expr: null,
    fps: GFX_LOOP_DEFAULT_FPS,
    playing: false,
    frame: 0,
    rafId: null,
    lastTick: 0,
  };

  function getGfxColorContext(){
    if (!gfxColorContext){
      const canvas = document.createElement("canvas");
      gfxColorContext = canvas.getContext("2d");
    }
    return gfxColorContext;
  }

  function align256(n){
    return (n + 255) & ~255;
  }

  function initWebgpu(buffer, canvas){
    if (!webgpuDevice){
      ensureWebgpu();
      throw new Error("WebGPU device not ready");
    }
    if (buffer.gpuDevice === webgpuDevice && buffer.gpuCanvas === canvas && buffer.gpuContext){
      return;
    }

    buffer.gpuDevice = webgpuDevice;
    buffer.gpuCanvas = canvas;
    buffer.gpuContext = canvas.getContext("webgpu");
    if (!buffer.gpuContext) throw new Error("WebGPU canvas context unavailable");
    buffer.gpuFormat = navigator.gpu.getPreferredCanvasFormat();
    buffer.gpuContext.configure({
      device: webgpuDevice,
      format: buffer.gpuFormat,
      alphaMode: "premultiplied",
    });

    const device = webgpuDevice;
    buffer.gpuSampler = device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const shader = device.createShaderModule({
      code: `
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) idx: u32) -> VSOut {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  var uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0)
  );
  var out: VSOut;
  out.pos = vec4f(positions[idx], 0.0, 1.0);
  out.uv = uvs[idx];
  return out;
}

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return textureSample(tex, samp, in.uv);
}
      `,
    });

    buffer.gpuPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format: buffer.gpuFormat }],
      },
      primitive: { topology: "triangle-list" },
    });

    buffer.gpuTexW = 0;
    buffer.gpuTexH = 0;
    buffer.gpuTexture = null;
    buffer.gpuTextureView = null;
    buffer.gpuBindGroup = null;
    buffer.gpuUpload = null;
    buffer.gpuUploadPitch = 0;
  }

  function ensureWebgpuTexture(buffer, w, h){
    const device = buffer.gpuDevice;
    if (!device) throw new Error("WebGPU device missing");

    if (buffer.gpuTexture && buffer.gpuTexW === w && buffer.gpuTexH === h) return;
    buffer.gpuTexW = w;
    buffer.gpuTexH = h;
    buffer.gpuTexture = device.createTexture({
      size: { width: w, height: h, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    buffer.gpuTextureView = buffer.gpuTexture.createView();

    buffer.gpuBindGroup = device.createBindGroup({
      layout: buffer.gpuPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: buffer.gpuSampler },
        { binding: 1, resource: buffer.gpuTextureView },
      ],
    });

    const pitch = align256(w * 4);
    buffer.gpuUploadPitch = pitch;
    buffer.gpuUpload = new Uint8Array(pitch * h);
  }

  function uploadWebgpuTexture(buffer, rgba){
    const w = buffer.gpuTexW | 0;
    const h = buffer.gpuTexH | 0;
    const pitch = buffer.gpuUploadPitch | 0;
    const upload = buffer.gpuUpload;
    if (!upload) throw new Error("WebGPU upload buffer missing");

    for (let y = 0; y < h; y++){
      const srcStart = y * w * 4;
      const srcEnd = srcStart + w * 4;
      upload.set(rgba.subarray(srcStart, srcEnd), y * pitch);
    }

    buffer.gpuDevice.queue.writeTexture(
      { texture: buffer.gpuTexture },
      upload,
      { bytesPerRow: pitch, rowsPerImage: h },
      { width: w, height: h, depthOrArrayLayers: 1 },
    );
  }

  function renderWebgpu(buffer, canvas){
    initWebgpu(buffer, canvas);
    const device = buffer.gpuDevice;
    const context = buffer.gpuContext;
    if (!device || !context || !buffer.gpuPipeline) throw new Error("WebGPU not initialized");

    const w = buffer.width | 0;
    const h = buffer.height | 0;
    ensureWebgpuTexture(buffer, w, h);
    const rgba = buildRgba(buffer);
    uploadWebgpuTexture(buffer, rgba);

    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    pass.setPipeline(buffer.gpuPipeline);
    pass.setBindGroup(0, buffer.gpuBindGroup);
    pass.draw(6, 1, 0, 0);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  function parseCssColor(value){
    const ctx = getGfxColorContext();
    if (!ctx) return [0, 0, 0, 255];
    ctx.fillStyle = "#000";
    ctx.fillStyle = value;
    const computed = ctx.fillStyle;
    if (computed === "transparent") return [0, 0, 0, 0];
    if (computed.startsWith("#")){
      let hex = computed.slice(1);
      if (hex.length === 3 || hex.length === 4){
        hex = hex.split("").map((c) => c + c).join("");
      }
      if (hex.length === 6) hex += "ff";
      if (hex.length === 8){
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = parseInt(hex.slice(6, 8), 16);
        return [r, g, b, a];
      }
    }
    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
    if (!match) return [0, 0, 0, 255];
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    return [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Math.round(alpha * 255),
    ];
  }

  function getGfxPalette(){
    if (gfxPaletteCache && gfxPaletteCache.theme === state.theme){
      return gfxPaletteCache.colors;
    }
    const styles = getComputedStyle(document.documentElement);
    const colors = Object.create(null);
    for (const token of GFX_COLOR_TOKENS){
      if (token === "transparent"){
        colors[token] = [0, 0, 0, 0];
        continue;
      }
      const value = styles.getPropertyValue(`--${token}`).trim() || "#000";
      colors[token] = parseCssColor(value);
    }
    gfxPaletteCache = { theme: state.theme, colors };
    return colors;
  }

  function normalizeGfxBackend(value){
    if (typeof value !== "string") return "auto";
    const name = value.trim().toLowerCase();
    if (!name) return "auto";
    if (!GFX_BACKENDS.includes(name)) throw new Error(`Unknown gfx backend: ${name}`);
    return name;
  }

  function pickDefaultBackend(){
    if (webgpuDevice) return "webgpu";
    if (typeof navigator !== "undefined" && navigator.gpu && !webgpuInitPromise){
      ensureWebgpu();
    }
    if (isWebgl2Supported()) return "webgl2";
    return "2d";
  }

  function isWebgl2Supported(){
    if (webgl2Supported !== null) return webgl2Supported;
    try{
      const canvas = document.createElement("canvas");
      webgl2Supported = Boolean(canvas.getContext("webgl2"));
    }catch{
      webgl2Supported = false;
    }
    return webgl2Supported;
  }

  function ensureWebgpu(){
    if (webgpuDevice) return;
    if (typeof navigator === "undefined" || !navigator.gpu) return;
    if (webgpuInitPromise) return;

    webgpuInitPromise = (async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("WebGPU adapter unavailable");
      const device = await adapter.requestDevice();
      webgpuAdapter = adapter;
      webgpuDevice = device;
    })()
      .then(() => {
        markGfxDirty();
        flushGfxOutput();
      })
      .catch(() => {
        webgpuAdapter = null;
        webgpuDevice = null;
      });
  }

  function getActiveBackend(){
    const configured = normalizeGfxBackend(state.gfxBackend || gfxBackend);
    if (configured === "auto") return pickDefaultBackend();
    if (configured === "webgpu"){
      if (webgpuDevice) return "webgpu";
      if (typeof navigator !== "undefined" && navigator.gpu) ensureWebgpu();
      return isWebgl2Supported() ? "webgl2" : "2d";
    }
    if (configured === "webgl2"){
      return isWebgl2Supported() ? "webgl2" : "2d";
    }
    return configured;
  }

  function setActiveBackend(name){
    const normalized = normalizeGfxBackend(name);
    gfxBackend = normalized;
    state.gfxBackend = normalized;
    markGfxDirty();
    flushGfxOutput();
    return getActiveBackend();
  }

  function attachCanvasEvents(canvas){
    canvas.className = "gfx-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "GFX canvas");
    canvas.addEventListener("pointerdown", (event) => {
      canvas.focus();
      mouseState.buttons[event.button] = 1;
      if (loopState.expr && canvas.requestPointerLock){
        canvas.requestPointerLock();
      }
    });
    canvas.addEventListener("pointerup", (event) => {
      mouseState.buttons[event.button] = 0;
    });
    canvas.addEventListener("pointermove", (event) => {
      if (document.pointerLockElement === canvas){
        mouseState.dx += Number.isFinite(event.movementX) ? event.movementX : 0;
        mouseState.dy += Number.isFinite(event.movementY) ? event.movementY : 0;
      }
    });
    canvas.addEventListener("keydown", (event) => {
      const key = normalizeGfxKey(event.key);
      if (key) keyState.down[key] = 1;
      if (handleGfxKeydown(event)){
        event.preventDefault();
      }
    });
    canvas.addEventListener("keyup", (event) => {
      const key = normalizeGfxKey(event.key);
      if (key) keyState.down[key] = 0;
    });
    canvas.addEventListener("blur", () => {
      keyState.down = Object.create(null);
      mouseState.buttons = Object.create(null);
    });
  }

  function ensurePointerLockListener(){
    if (pointerLockListenerAttached) return;
    pointerLockListenerAttached = true;
    document.addEventListener("pointerlockchange", () => {
      const canvas = state.gfx?.canvasEl || null;
      mouseState.locked = Boolean(canvas && document.pointerLockElement === canvas);
      if (!mouseState.locked){
        mouseState.dx = 0;
        mouseState.dy = 0;
      }
    });
  }

  function compileShader(gl, type, src){
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
      const log = gl.getShaderInfoLog(shader) || "";
      gl.deleteShader(shader);
      throw new Error(`WebGL shader compile failed: ${log}`);
    }
    return shader;
  }

  function createProgram(gl, vsSrc, fsSrc){
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create WebGL program");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
      const log = gl.getProgramInfoLog(program) || "";
      gl.deleteProgram(program);
      throw new Error(`WebGL program link failed: ${log}`);
    }
    return program;
  }

  function initWebgl2(buffer, canvas){
    if (buffer.gl && buffer.glCanvas === canvas) return;
    buffer.gl = null;
    buffer.glCanvas = null;
    buffer.glProgram = null;
    buffer.glVao = null;
    buffer.glVbo = null;
    buffer.glTex = null;
    buffer.glSizeW = 0;
    buffer.glSizeH = 0;
    buffer.glRgba = null;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 not available");

    const vsSrc = `#version 300 es\n` +
      `in vec2 a_pos;\n` +
      `in vec2 a_uv;\n` +
      `out vec2 v_uv;\n` +
      `void main(){\n` +
      `  v_uv = a_uv;\n` +
      `  gl_Position = vec4(a_pos, 0.0, 1.0);\n` +
      `}`;
    const fsSrc = `#version 300 es\n` +
      `precision highp float;\n` +
      `uniform sampler2D u_tex;\n` +
      `in vec2 v_uv;\n` +
      `out vec4 outColor;\n` +
      `void main(){\n` +
      `  outColor = texture(u_tex, v_uv);\n` +
      `}`;

    const program = createProgram(gl, vsSrc, fsSrc);
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const tex = gl.createTexture();
    if (!vao || !vbo || !tex) throw new Error("Failed to allocate WebGL resources");

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const data = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
      -1,  1, 0, 0,
       1, -1, 1, 1,
       1,  1, 1, 0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_pos");
    const aUv = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    buffer.gl = gl;
    buffer.glCanvas = canvas;
    buffer.glProgram = program;
    buffer.glVao = vao;
    buffer.glVbo = vbo;
    buffer.glTex = tex;
  }

  function buildRgba(buffer){
    const w = buffer.width | 0;
    const h = buffer.height | 0;
    const needed = w * h * 4;
    if (!buffer.rgba || buffer.rgba.length !== needed){
      buffer.rgba = new Uint8Array(needed);
    }
    const out = buffer.rgba;
    const palette = getGfxPalette();
    for (let i = 0; i < buffer.pixels.length; i++){
      const color = buffer.pixels[i] || "transparent";
      const rgba = palette[color] || palette.transparent;
      const o = i * 4;
      out[o] = rgba[0];
      out[o + 1] = rgba[1];
      out[o + 2] = rgba[2];
      out[o + 3] = rgba[3];
    }
    return out;
  }

  function renderWebgl2(buffer, canvas, dpr){
    initWebgl2(buffer, canvas);
    const gl = buffer.gl;
    if (!gl || !buffer.glProgram || !buffer.glVao || !buffer.glTex) return;

    const w = buffer.width | 0;
    const h = buffer.height | 0;
    if (buffer.glSizeW !== w || buffer.glSizeH !== h){
      buffer.glSizeW = w;
      buffer.glSizeH = h;
      gl.bindTexture(gl.TEXTURE_2D, buffer.glTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    const rgba = buildRgba(buffer);
    gl.bindTexture(gl.TEXTURE_2D, buffer.glTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(buffer.glProgram);
    const uTex = gl.getUniformLocation(buffer.glProgram, "u_tex");
    gl.uniform1i(uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, buffer.glTex);
    gl.bindVertexArray(buffer.glVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
  }

  function writeGfx(buffer){
    if (!buffer) return;
    let wrapper = buffer.outputEl;
    let label = buffer.labelEl;
    let hint = buffer.hintEl;
    let panel = buffer.panelEl;
    let canvas = buffer.canvasEl;

    if (!wrapper){
      wrapper = document.createElement("div");
      wrapper.className = "line gfx-line";
      label = document.createElement("div");
      label.className = "gfx-label";
      hint = document.createElement("div");
      hint.className = "gfx-hint";
      panel = document.createElement("div");
      panel.className = "gfx-panel";
      canvas = document.createElement("canvas");
      attachCanvasEvents(canvas);
      ensurePointerLockListener();
      panel.appendChild(canvas);
      wrapper.append(label, hint, panel);
      terminalEl.appendChild(wrapper);
      terminalEl.scrollTop = terminalEl.scrollHeight;
      buffer.outputEl = wrapper;
      buffer.labelEl = label;
      buffer.hintEl = hint;
      buffer.panelEl = panel;
      buffer.canvasEl = canvas;
    }

    const desiredBackend = getActiveBackend();
    if (buffer.backend !== desiredBackend){
      buffer.backend = desiredBackend;
      if (buffer.canvasEl && buffer.panelEl){
        buffer.canvasEl.remove();
        buffer.canvasEl = document.createElement("canvas");
        attachCanvasEvents(buffer.canvasEl);
        buffer.panelEl.appendChild(buffer.canvasEl);
      }
      canvas = buffer.canvasEl;
    }

    const loopLabel = loopState.expr
      ? ` • loop ${loopState.playing ? "playing" : "paused"} @ ${loopState.fps} fps • frame ${loopState.frame}`
      : "";
    label.textContent = `gfx ${buffer.width}x${buffer.height} • scale ${buffer.scale}${loopLabel}`;
    hint.textContent = loopState.expr
      ? "P play/pause • ←/→ step • ↑/↓ speed • R reset"
      : "";
    if (buffer.bg && buffer.bg !== "transparent"){
      panel.style.setProperty("--gfx-bg", `var(--${buffer.bg})`);
    }else{
      panel.style.removeProperty("--gfx-bg");
    }
    const displayWidth = buffer.width * buffer.scale;
    const displayHeight = buffer.height * buffer.scale;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const dpr = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
    const targetWidth = Math.max(1, Math.round(displayWidth * dpr));
    const targetHeight = Math.max(1, Math.round(displayHeight * dpr));
    if (canvas.width !== targetWidth) canvas.width = targetWidth;
    if (canvas.height !== targetHeight) canvas.height = targetHeight;

    if (buffer.backend === "webgpu"){
      try{
        renderWebgpu(buffer, canvas);
        return;
      }catch{
        buffer.backend = "webgl2";
      }
    }

    if (buffer.backend === "webgl2"){
      try{
        renderWebgl2(buffer, canvas, dpr);
      }catch{
        buffer.backend = "2d";
      }
      return;
    }

    if (!buffer.offscreenCanvas){
      buffer.offscreenCanvas = document.createElement("canvas");
      buffer.offscreenCtx = buffer.offscreenCanvas.getContext("2d");
    }
    const offscreen = buffer.offscreenCanvas;
    const offCtx = buffer.offscreenCtx;
    if (offCtx){
      if (offscreen.width !== buffer.width) offscreen.width = buffer.width;
      if (offscreen.height !== buffer.height) offscreen.height = buffer.height;
      if (!buffer.imageData || buffer.imageData.width !== buffer.width || buffer.imageData.height !== buffer.height){
        buffer.imageData = offCtx.createImageData(buffer.width, buffer.height);
      }
      const data = buffer.imageData.data;
      const rgba = buildRgba(buffer);
      data.set(rgba);
      offCtx.putImageData(buffer.imageData, 0, 0);
    }

    const ctx = canvas.getContext("2d");
    if (ctx && buffer.offscreenCanvas){
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      if (typeof ctx.imageSmoothingQuality === "string"){
        ctx.imageSmoothingQuality = "high";
      }
      ctx.setTransform(dpr * buffer.scale, 0, 0, dpr * buffer.scale, 0, 0);
      ctx.drawImage(buffer.offscreenCanvas, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  function normalizeGfxDimension(value, label){
    const num = Math.round(isQty(value) ? value.value : value);
    if (!Number.isFinite(num) || num <= 0) throw new Error(`${label} must be > 0`);
    if (num > GFX_LIMIT) throw new Error(`${label} must be <= ${GFX_LIMIT}`);
    return num;
  }

  function normalizeGfxScale(value){
    const num = Math.round(isQty(value) ? value.value : value);
    if (!Number.isFinite(num) || num < 1) throw new Error("scale must be >= 1");
    return Math.min(num, 18);
  }

  function normalizeLoopFps(value){
    const num = Math.round(isQty(value) ? value.value : value);
    if (!Number.isFinite(num)) throw new Error("fps must be numeric");
    return Math.min(GFX_LOOP_MAX_FPS, Math.max(GFX_LOOP_MIN_FPS, num));
  }

  function normalizeGfxColor(value){
    if (typeof value === "string"){
      const name = value.trim().toLowerCase();
      if (!name) return "accent";
      if (!GFX_COLOR_TOKENS.includes(name)) throw new Error(`Unknown color token: ${name}`);
      return name;
    }
    const num = Math.round(isQty(value) ? value.value : value);
    if (!Number.isFinite(num)) return "accent";
    const idx = Math.max(0, Math.min(GFX_COLOR_TOKENS.length - 1, num));
    return GFX_COLOR_TOKENS[idx];
  }

  function createGfxBuffer(width, height, scale){
    return {
      __gfx: true,
      width,
      height,
      scale,
      pixels: Array.from({ length: width * height }, () => null),
      bg: null,
      backend: null,
      rgba: null,
      imageData: null,
      offscreenCanvas: null,
      offscreenCtx: null,
      gl: null,
      glCanvas: null,
      glProgram: null,
      glVao: null,
      glVbo: null,
      glTex: null,
      glSizeW: 0,
      glSizeH: 0,
      glRgba: null,
      gpuDevice: null,
      gpuCanvas: null,
      gpuContext: null,
      gpuFormat: null,
      gpuPipeline: null,
      gpuSampler: null,
      gpuBindGroup: null,
      gpuTexture: null,
      gpuTextureView: null,
      gpuTexW: 0,
      gpuTexH: 0,
      gpuUpload: null,
      gpuUploadPitch: 0,
      outputEl: null,
      labelEl: null,
      hintEl: null,
      panelEl: null,
      canvasEl: null,
    };
  }

  function requireGfxBuffer(){
    if (!state.gfx) throw new Error("No gfx buffer. Use gfx(width, height, scale) first.");
    return state.gfx;
  }

  function setPixel(buffer, x, y, color){
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= buffer.width || iy >= buffer.height) return;
    buffer.pixels[iy * buffer.width + ix] = color;
  }

  function drawLine(buffer, x0, y0, x1, y1, color){
    if (![x0, y0, x1, y1].every(Number.isFinite)){
      return;
    }
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xEnd = Math.round(x1);
    const yEnd = Math.round(y1);
    const dx = Math.abs(xEnd - x);
    const dy = Math.abs(yEnd - y);
    const sx = x < xEnd ? 1 : -1;
    const sy = y < yEnd ? 1 : -1;
    let err = dx - dy;
    while (true){
      setPixel(buffer, x, y, color);
      if (x === xEnd && y === yEnd) break;
      const e2 = 2 * err;
      if (e2 > -dy){
        err -= dy;
        x += sx;
      }
      if (e2 < dx){
        err += dx;
        y += sy;
      }
    }
  }

  function drawRect(buffer, x, y, w, h, color){
    const width = Math.round(w);
    const height = Math.round(h);
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    if (width <= 0 || height <= 0) return;
    drawLine(buffer, x0, y0, x0 + width - 1, y0, color);
    drawLine(buffer, x0, y0 + height - 1, x0 + width - 1, y0 + height - 1, color);
    drawLine(buffer, x0, y0, x0, y0 + height - 1, color);
    drawLine(buffer, x0 + width - 1, y0, x0 + width - 1, y0 + height - 1, color);
  }

  function fillRect(buffer, x, y, w, h, color){
    const width = Math.round(w);
    const height = Math.round(h);
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    if (width <= 0 || height <= 0) return;
    for (let yy = 0; yy < height; yy++){
      for (let xx = 0; xx < width; xx++){
        setPixel(buffer, x0 + xx, y0 + yy, color);
      }
    }
  }

  function markGfxDirty(){
    state.gfxDirty = true;
  }

  function setRunExpressionWithContext(fn){
    runExpressionWithContext = fn;
  }

  function setRunLoopStatementRunner(fn){
    runLoopStatement = fn;
  }

  function runLoopScript(){
    if (!runLoopStatement && !runExpressionWithContext){
      throw new Error("Loop runner not ready.");
    }
    const statements = splitStatements(loopState.expr);
    // Use a persistent scope for gfx loops so scripts can maintain state across frames.
    const vars = state.vars;
    
    for (const stmt of statements){
      if (!stmt) continue;
      if (stmt.trim().startsWith("#")) continue;
      try{
        if (runLoopStatement){
          runLoopStatement(stmt);
        }else{
          // Check if this is an assignment statement
          const equalsIdx = findTopLevelEquals(stmt);
          if (equalsIdx >= 0){
            // Handle assignment: update frameVars
            const name = stmt.slice(0, equalsIdx).trim();
            const expr = stmt.slice(equalsIdx + 1).trim();
            const val = runExpressionWithContext(expr, vars);
            vars[name] = val;
          }else{
            // Handle regular expression
            runExpressionWithContext(stmt, vars);
          }
        }
      }catch(err){
        // Enhance error with statement context for debugging
        throw new Error(`GFX loop error in statement "${stmt.trim()}": ${err.message || String(err)}`);
      }
    }
  }

  function runLoopFrame(){
    if (!loopState.expr) return;
    const fps = normalizeLoopFps(loopState.fps);
    loopState.fps = fps;
    const frame = Number.isFinite(loopState.frame) ? loopState.frame : 0;
    loopState.frame = frame;
    state.vars.frame = frame;
    state.vars.time = frame / fps;
    state.vars.dt = 1 / fps;
    state.vars.key_w = keyState.down.w ? 1 : 0;
    state.vars.key_a = keyState.down.a ? 1 : 0;
    state.vars.key_s = keyState.down.s ? 1 : 0;
    state.vars.key_d = keyState.down.d ? 1 : 0;
    state.vars.key_q = keyState.down.q ? 1 : 0;
    state.vars.key_e = keyState.down.e ? 1 : 0;
    state.vars.key_space = keyState.down.space ? 1 : 0;
    state.vars.key_shift = keyState.down.shift ? 1 : 0;
    state.vars.key_up = keyState.down.arrowup ? 1 : 0;
    state.vars.key_down = keyState.down.arrowdown ? 1 : 0;
    state.vars.key_left = keyState.down.arrowleft ? 1 : 0;
    state.vars.key_right = keyState.down.arrowright ? 1 : 0;
    state.vars.mouse_dx = mouseState.dx;
    state.vars.mouse_dy = mouseState.dy;
    state.vars.mouse_btn0 = mouseState.buttons[0] ? 1 : 0;
    state.vars.mouse_btn1 = mouseState.buttons[1] ? 1 : 0;
    state.vars.mouse_btn2 = mouseState.buttons[2] ? 1 : 0;
    state.vars.mouse_locked = mouseState.locked ? 1 : 0;
    mouseState.dx = 0;
    mouseState.dy = 0;
    try{
      runLoopScript();
      flushGfxOutput();
    }catch(err){
      pauseLoop();
      if (typeof writeLine === "function"){
        writeLine(`GFX loop error: ${err.message || String(err)}`, "err");
      }
    }
  }

  function normalizeGfxKey(key){
    if (!key) return null;
    if (key === " ") return "space";
    if (key === "Shift") return "shift";
    if (key.startsWith("Arrow")) return key.toLowerCase();
    const lower = key.toLowerCase();
    if (lower.length === 1) return lower;
    return null;
  }

  function tickLoop(timestamp){
    if (!loopState.playing) return;
    if (!loopState.lastTick) loopState.lastTick = timestamp;
    const interval = 1000 / loopState.fps;
    if (timestamp - loopState.lastTick >= interval){
      const steps = Math.max(1, Math.floor((timestamp - loopState.lastTick) / interval));
      loopState.lastTick += steps * interval;
      for (let i = 0; i < steps; i++){
        loopState.frame += 1;
        runLoopFrame();
        if (!loopState.playing) return;
      }
    }
    loopState.rafId = window.requestAnimationFrame(tickLoop);
  }

  function configureLoop(expr, fps){
    if (typeof expr !== "string") throw new Error("gfxloop expects a string script");
    const script = expr.trim();
    if (!script) throw new Error("gfxloop requires a non-empty script");
    requireGfxBuffer();
    loopState.expr = script;
    loopState.frame = 0;
    loopState.playing = false;
    loopState.lastTick = 0;
    if (fps !== undefined){
      loopState.fps = normalizeLoopFps(fps);
    }
    runLoopFrame();
  }

  function playLoop(){
    if (!loopState.expr) throw new Error("No gfx loop configured.");
    if (loopState.playing) return;
    loopState.playing = true;
    loopState.lastTick = 0;
    loopState.rafId = window.requestAnimationFrame(tickLoop);
    markGfxDirty();
    flushGfxOutput();
  }

  function pauseLoop(){
    loopState.playing = false;
    loopState.lastTick = 0;
    if (loopState.rafId){
      window.cancelAnimationFrame(loopState.rafId);
      loopState.rafId = null;
    }
    markGfxDirty();
    flushGfxOutput();
  }

  function toggleLoop(){
    if (loopState.playing){
      pauseLoop();
    }else{
      playLoop();
    }
  }

  function advanceLoop(delta){
    if (!loopState.expr) throw new Error("No gfx loop configured.");
    loopState.frame = Math.max(0, loopState.frame + delta);
    runLoopFrame();
  }

  function resetLoop(){
    if (!loopState.expr) throw new Error("No gfx loop configured.");
    loopState.frame = 0;
    runLoopFrame();
  }

  function setLoopFps(value){
    loopState.fps = normalizeLoopFps(value);
    return loopState.fps;
  }

  function getLoopStatus(){
    return {
      active: Boolean(loopState.expr),
      playing: loopState.playing,
      fps: loopState.fps,
      frame: loopState.frame,
    };
  }

  function handleGfxKeydown(event){
    if (!loopState.expr) return false;
    const key = event.key;
    if (key === " "){
      if (!mouseState.locked){
        toggleLoop();
        return true;
      }
      return false;
    }
    if (key === "ArrowRight"){
      advanceLoop(event.shiftKey ? 10 : 1);
      return true;
    }
    if (key === "ArrowLeft"){
      advanceLoop(event.shiftKey ? -10 : -1);
      return true;
    }
    if (key === "ArrowUp"){
      setLoopFps(loopState.fps + 1);
      runLoopFrame();
      return true;
    }
    if (key === "ArrowDown"){
      setLoopFps(loopState.fps - 1);
      runLoopFrame();
      return true;
    }
    if (key.toLowerCase() === "r"){
      resetLoop();
      return true;
    }
    if (key.toLowerCase() === "p"){
      toggleLoop();
      return true;
    }
    return false;
  }

  function flushGfxOutput(){
    if (state.gfxDirty && state.gfx){
      writeGfx(state.gfx);
      state.gfxDirty = false;
    }
  }

  function buildGfxMetaFns(defFn){
    return {
      gfx: defFn("gfx", 2, {
        args: [
          { label: "width", kinds: ["scalar"] },
          { label: "height", kinds: ["scalar"] },
        ],
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, (width, height) => {
        const w = normalizeGfxDimension(width, "width");
        const h = normalizeGfxDimension(height, "height");
        state.gfx = createGfxBuffer(w, h, GFX_DEFAULT_SCALE);
        markGfxDirty();
        return `gfx ${w}x${h}`;
      }),
      gfxs: defFn("gfxs", 1, {
        args: [{ label: "scale", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (scale) => {
        const buffer = requireGfxBuffer();
        buffer.scale = normalizeGfxScale(scale);
        markGfxDirty();
        return buffer.scale;
      }),
      cls: defFn("cls", 0, {
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, () => {
        const buffer = requireGfxBuffer();
        buffer.pixels.fill(null);
        buffer.bg = null;
        markGfxDirty();
        return 1;
      }),
      bg: defFn("bg", 1, {
        args: [{ label: "color", kinds: ["string", "scalar"] }],
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, (color) => {
        const buffer = requireGfxBuffer();
        buffer.bg = normalizeGfxColor(color);
        markGfxDirty();
        return buffer.bg || "transparent";
      }),
      pix: defFn("pix", 3, {
        args: [
          { label: "x", kinds: ["scalar"] },
          { label: "y", kinds: ["scalar"] },
          { label: "color", kinds: ["string", "scalar"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (x, y, color) => {
        const buffer = requireGfxBuffer();
        setPixel(buffer, x, y, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      line: defFn("line", 5, {
        args: [
          { label: "x0", kinds: ["scalar"] },
          { label: "y0", kinds: ["scalar"] },
          { label: "x1", kinds: ["scalar"] },
          { label: "y1", kinds: ["scalar"] },
          { label: "color", kinds: ["string", "scalar"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, function(x0, y0, x1, y1, color){
        const buffer = requireGfxBuffer();
        // Validate arguments for better error messages
        if (arguments.length !== 5) {
          throw new Error(`line() requires exactly 5 arguments: x0, y0, x1, y1, color (got ${arguments.length}). Received: [${Array.from(arguments).map(a => JSON.stringify(a)).join(', ')}]`);
        }
        if (![x0, y0, x1, y1].every(Number.isFinite)) {
          throw new Error(`line() requires numeric coordinates: got x0=${x0}, y0=${y0}, x1=${x1}, y1=${y1}`);
        }
        drawLine(buffer, x0, y0, x1, y1, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      rect: defFn("rect", 5, {
        args: [
          { label: "x", kinds: ["scalar"] },
          { label: "y", kinds: ["scalar"] },
          { label: "w", kinds: ["scalar"] },
          { label: "h", kinds: ["scalar"] },
          { label: "color", kinds: ["string", "scalar"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, function(x, y, w, h, color){
        const buffer = requireGfxBuffer();
        if (arguments.length !== 5) {
          throw new Error(`rect() requires exactly 5 arguments: x, y, w, h, color (got ${arguments.length})`);
        }
        if (![x, y, w, h].every(Number.isFinite)) {
          throw new Error(`rect() requires numeric parameters: got x=${x}, y=${y}, w=${w}, h=${h}`);
        }
        drawRect(buffer, x, y, w, h, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      fill: defFn("fill", 5, {
        args: [
          { label: "x", kinds: ["scalar"] },
          { label: "y", kinds: ["scalar"] },
          { label: "w", kinds: ["scalar"] },
          { label: "h", kinds: ["scalar"] },
          { label: "color", kinds: ["string", "scalar"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, function(x, y, w, h, color){
        const buffer = requireGfxBuffer();
        if (arguments.length !== 5) {
          throw new Error(`fill() requires exactly 5 arguments: x, y, w, h, color (got ${arguments.length})`);
        }
        if (![x, y, w, h].every(Number.isFinite)) {
          throw new Error(`fill() requires numeric parameters: got x=${x}, y=${y}, w=${w}, h=${h}`);
        }
        fillRect(buffer, x, y, w, h, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      raycast: defFn("raycast", 10, {
        args: [
          { label: "map", kinds: ["map"] },
          { label: "px", kinds: ["scalar"] },
          { label: "py", kinds: ["scalar"] },
          { label: "yaw", kinds: ["scalar"] },
          { label: "fov", kinds: ["scalar"] },
          { label: "viewH", kinds: ["scalar"] },
          { label: "maxD", kinds: ["scalar"] },
          { label: "step", kinds: ["scalar"] },
          { label: "steps", kinds: ["scalar"] },
          { label: "colStep", kinds: ["scalar"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (mapObj, px, py, yaw, fov, viewH, maxD, step, steps, colStep) => {
        const buffer = requireGfxBuffer();
        if (!mapObj || typeof mapObj !== "object" || !mapObj.__map || !mapObj.data){
          throw new Error("raycast expects a map() as the first argument");
        }

        const toNum = (v) => (isQty(v) ? v.value : v);
        const nPx = toNum(px);
        const nPy = toNum(py);
        const nYaw = toNum(yaw);
        const nFov = toNum(fov);
        const nViewH = toNum(viewH);
        const nMaxD = toNum(maxD);
        const nStep = toNum(step);
        const nStepsIn = toNum(steps);
        const nColStep = toNum(colStep);
        if (![nPx, nPy, nYaw, nFov, nViewH, nMaxD, nStep, nStepsIn, nColStep].every(Number.isFinite)){
          throw new Error("raycast expects numeric arguments");
        }
        const mapW = mapObj.w | 0;
        const mapH = mapObj.h | 0;
        const data = mapObj.data;
        const w = buffer.width | 0;
        const h = buffer.height | 0;
        const vh = Math.max(1, Math.min(h, Math.floor(nViewH)));
        const md = Math.max(0.1, nMaxD);
        const st = Math.max(0.001, nStep);
        const nSteps = Math.max(1, Math.floor(nStepsIn));
        const cs = Math.max(1, Math.floor(nColStep));

        function sampleTile(x, y){
          const ix = x | 0;
          const iy = y | 0;
          if (ix < 0 || iy < 0 || ix >= mapW || iy >= mapH) return 1;
          return data[iy * mapW + ix] | 0;
        }

        function drawColumn(x, y0, y1, color){
          const xi = x | 0;
          if (xi < 0 || xi >= w) return;
          const yy0 = Math.max(0, y0 | 0);
          const yy1 = Math.min(vh - 1, y1 | 0);
          for (let y = yy0; y <= yy1; y++){
            buffer.pixels[y * w + xi] = color;
          }
        }

        const isSpriteTile = (t) => t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10 || t === 11;

        function lightAt(worldX, worldY){
          const cx = Math.floor(worldX);
          const cy = Math.floor(worldY);
          let light = 0;
          const r = 4;
          for (let oy = -r; oy <= r; oy++){
            const ty = cy + oy;
            if (ty < 0 || ty >= mapH) continue;
            for (let ox = -r; ox <= r; ox++){
              const tx = cx + ox;
              if (tx < 0 || tx >= mapW) continue;
              const tt = data[ty * mapW + tx] | 0;
              if (tt !== 8 && tt !== 9) continue;
              const lx = tx + 0.5;
              const ly = ty + 0.5;
              const dx = worldX - lx;
              const dy = worldY - ly;
              const d2 = dx * dx + dy * dy;
              const intensity = tt === 8 ? 1.15 : 0.85;
              light += intensity / (1 + d2 * 0.9);
            }
          }
          return light;
        }

        function shadeByBrightness(bright, base){
          if (base === "warn"){
            if (bright < 0.32) return "muted";
            if (bright < 0.68) return "warn";
            return "text";
          }
          if (bright < 0.28) return "muted";
          if (bright < 0.55) return "accent-2";
          if (bright < 0.82) return base;
          return "text";
        }

        for (let x = 0; x < w; x += cs){
          const cam = x / w - 0.5;
          const ray = nYaw + cam * nFov;
          const rc = Math.cos(ray);
          const rs = Math.sin(ray);
          let bestD = md;
          let bestT = 0;
          let spriteD = md + 1;
          let spriteT = 0;
          for (let i = 1; i <= nSteps; i++){
            const d = i * st;
            const rx = nPx + rc * d;
            const ry = nPy + rs * d;
            const tt = sampleTile(Math.floor(rx), Math.floor(ry));
            if (spriteT === 0 && isSpriteTile(tt)){
              spriteT = tt;
              spriteD = d;
            }
            if (tt === 1 || tt === 2){
              bestT = tt;
              bestD = d;
              break;
            }
          }
          const corr = bestD * Math.cos(ray - nYaw);
          const dd = Math.max(0.2, corr);
          const slice = Math.floor(vh / dd);
          const y0 = Math.floor((vh - slice) / 2);
          const y1 = y0 + slice;

          const hx = nPx + rc * bestD;
          const hy = nPy + rs * bestD;
          const fog = Math.max(0, Math.min(1, (bestD - 1.6) / Math.max(0.001, (md - 1.6))));
          const ambient = 0.16;
          const localLight = lightAt(hx, hy);
          const bright = Math.max(0, Math.min(1, ambient + localLight - fog * 0.62));
          const texJitter = (((Math.floor(hx * 3) + Math.floor(hy * 2)) & 1) ? 0.08 : 0);
          const brightTex = Math.max(0, Math.min(1, bright - texJitter));
          const base = bestT === 2 ? "warn" : "accent";
          const shade = shadeByBrightness(brightTex, base);
          for (let dx = 0; dx < cs; dx++){
            drawColumn(x + dx, y0, y1, shade);
          }

          const spriteCorr = spriteD * Math.cos(ray - nYaw);
          if (spriteT !== 0 && spriteCorr > 0.1 && spriteCorr < dd){
            const sd = Math.max(0.25, spriteCorr);
            const sh = Math.floor(vh / sd);
            const sy0 = Math.floor((vh - sh) / 2);
            const sy1 = sy0 + sh;
            const sx = nPx + rc * spriteD;
            const sy = nPy + rs * spriteD;
            const sFog = Math.max(0, Math.min(1, (spriteD - 1.2) / Math.max(0.001, (md - 1.2))));
            const sBright = Math.max(0, Math.min(1, 0.22 + lightAt(sx, sy) - sFog * 0.55));
            const spriteColor = (() => {
              if (spriteT === 5) return shadeByBrightness(sBright, "err");
              if (spriteT === 6) return shadeByBrightness(sBright, "ok");
              if (spriteT === 7) return shadeByBrightness(sBright, "accent-2");
              if (spriteT === 3) return shadeByBrightness(sBright, "warn");
              if (spriteT === 4) return shadeByBrightness(sBright, "ok");
              if (spriteT === 8 || spriteT === 9) return shadeByBrightness(sBright, "warn");
              if (spriteT === 10 || spriteT === 11) return shadeByBrightness(sBright, "accent");
              return shadeByBrightness(sBright, "accent");
            })();
            for (let dx = 0; dx < cs; dx++){
              drawColumn(x + dx, sy0, sy1, spriteColor);
            }
          }
        }
        markGfxDirty();
        return 1;
      }),
      plot: defFn("plot", 4, {
        args: [
          { label: "x0", kinds: ["scalar"] },
          { label: "y0", kinds: ["scalar"] },
          { label: "points", kinds: ["string"] },
          { label: "color", kinds: ["string", "scalar"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (x0, y0, points, color) => {
        const buffer = requireGfxBuffer();
        if (typeof points !== "string") throw new Error("plot expects a string of dx,dy pairs");
        const entries = points.split("|").map((pair) => pair.trim()).filter(Boolean);
        const colorValue = normalizeGfxColor(color);
        let x = Math.round(isQty(x0) ? x0.value : x0);
        let y = Math.round(isQty(y0) ? y0.value : y0);
        setPixel(buffer, x, y, colorValue);
        for (const entry of entries){
          const [dxRaw, dyRaw] = entry.split(",").map((v) => v.trim());
          if (!dxRaw || !dyRaw) continue;
          const dx = Number(dxRaw);
          const dy = Number(dyRaw);
          if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
          x += dx;
          y += dy;
          setPixel(buffer, x, y, colorValue);
        }
        markGfxDirty();
        return 1;
      }),
      gfxloop: defFn("gfxloop", 1, {
        args: [{ label: "expr", kinds: ["string"] }],
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, (expr) => {
        configureLoop(expr);
        return "gfx loop ready";
      }),
      gfxplay: defFn("gfxplay", 0, {
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, () => {
        playLoop();
        return 1;
      }),
      gfxpause: defFn("gfxpause", 0, {
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, () => {
        pauseLoop();
        return 1;
      }),
      gfxstep: defFn("gfxstep", 1, {
        args: [{ label: "count", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (count) => {
        const steps = Math.round(isQty(count) ? count.value : count);
        if (!Number.isFinite(steps)) throw new Error("gfxstep expects a numeric step");
        advanceLoop(steps);
        return loopState.frame;
      }),
      gfxrewind: defFn("gfxrewind", 1, {
        args: [{ label: "count", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (count) => {
        const steps = Math.round(isQty(count) ? count.value : count);
        if (!Number.isFinite(steps)) throw new Error("gfxrewind expects a numeric step");
        advanceLoop(-steps);
        return loopState.frame;
      }),
      gfxfps: defFn("gfxfps", 1, {
        args: [{ label: "fps", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (fps) => setLoopFps(fps)),
      gfxbackend: defFn("gfxbackend", 1, {
        args: [{ label: "name", kinds: ["string"] }],
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, (name) => setActiveBackend(name)),
    };
  }

  return {
    buildGfxMetaFns,
    flushGfxOutput,
    configureLoop,
    playLoop,
    pauseLoop,
    toggleLoop,
    advanceLoop,
    resetLoop,
    setLoopFps,
    getLoopStatus,
    setRunExpressionWithContext,
    setRunLoopStatementRunner,
    handleGfxKeydown,
    getBuffer: () => state.gfx,
    getCanvas: () => state.gfx?.canvasEl || null,
    markDirty: markGfxDirty,
    initBuffer: (width, height, scale = GFX_DEFAULT_SCALE) => {
      const w = normalizeGfxDimension(width, "width");
      const h = normalizeGfxDimension(height, "height");
      state.gfx = createGfxBuffer(w, h, normalizeGfxScale(scale));
      markGfxDirty();
      flushGfxOutput();
    },
  };
}
