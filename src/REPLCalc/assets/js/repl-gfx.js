import { isQty } from "./repl-units.js";
import { EFFECT } from "./repl-effects.js";
import { getFinishTexture, sampleFinishTexture, __internal as FIN_TEX_INTERNAL } from "./repl-textures-finishes.js";

const GFX_LIMIT = 512;
const GFX_DEFAULT_SCALE = 6;
const GFX_LOOP_DEFAULT_FPS = 12;
const GFX_LOOP_MIN_FPS = 1;
const GFX_LOOP_MAX_FPS = 60;
const GFX_LOOP_MAX_CATCHUP_STEPS = 5;
const GFX_LOOP_MAX_CATCHUP_MS = 250;
const GFX_INTERNAL_SCALE_MIN = 0.5;
const GFX_INTERNAL_SCALE_MAX = 1;
const GFX_INTERNAL_SCALE_STEP = 0.1;
const GFX_INTERNAL_SCALE_COOLDOWN_MS = 900;
const GFX_INTERNAL_SCALE_HYSTERESIS_FRAMES = 4;
const GFX_INTERNAL_SCALE_ADAPTIVE_STEP = 0.05;
const GFX_FRAME_TIME_SMOOTHING = 0.2;
const GFX_TEMPORAL_HISTORY_MAX_PIXELS = 512 * 512;
const GFX_TEMPORAL_BLEND_DEFAULT = 0.18;
const GFX_TEMPORAL_BLEND_MIN = 0.05;
const GFX_TEMPORAL_BLEND_MAX = 0.4;
const GFX_TEMPORAL_REJECT_LUMA = 0.24;
const GFX_TEMPORAL_REJECT_CHROMA = 110;
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

const TURBO_QUANT_PROFILES = Object.freeze({
  ultra: Object.freeze({
    rayStepsMul: 1.2,
    colStepMul: 1,
    lightSamples: 7,
    occlusionChecks: 12,
    expensiveMathStride: 1,
    floorStep: 1,
    ceilStep: 1,
    coarseShading: 0,
    allowSecondary: 1,
  }),
  balanced: Object.freeze({
    rayStepsMul: 1,
    colStepMul: 1,
    lightSamples: 5,
    occlusionChecks: 8,
    expensiveMathStride: 2,
    floorStep: 2,
    ceilStep: 2,
    coarseShading: 0,
    allowSecondary: 1,
  }),
  performance: Object.freeze({
    rayStepsMul: 0.75,
    colStepMul: 1.5,
    lightSamples: 3,
    occlusionChecks: 4,
    expensiveMathStride: 3,
    floorStep: 3,
    ceilStep: 3,
    coarseShading: 1,
    allowSecondary: 0,
  }),
  eco: Object.freeze({
    rayStepsMul: 0.5,
    colStepMul: 2,
    lightSamples: 2,
    occlusionChecks: 2,
    expensiveMathStride: 5,
    floorStep: 4,
    ceilStep: 4,
    coarseShading: 1,
    allowSecondary: 0,
  }),
});

const TURBO_QUANT_FPS_BANDS = Object.freeze({
  downshift: Object.freeze({ performance: 0.92, eco: 0.74 }),
  upshift: Object.freeze({ balanced: 0.98, ultra: 1.08 }),
});

const BUDGET_POLICY_TQ = Object.freeze({
  interactive: "performance",
  balanced: "balanced",
  cinematic: "ultra",
  "headless-batch": "eco",
});

export function createGfxTools({ state, terminalEl, writeLine }){
  let gfxPaletteCache = null;
  let gfxPalettePackedCache = null;
  let gfxColorContext = null;
  let runExpressionWithContext = null;
  let runLoopStatement = null;
  let parseProgramSource = null;
  let gfxBackend = "auto";
  let pointerLockListenerAttached = false;
  let visibilityListenerAttached = false;
  let webgpuAdapter = null;
  let webgpuDevice = null;
  let webgpuInitPromise = null;
  let webgl2Supported = null;

  const procTexCache = {
    wall: Object.create(null),
    floor: Object.create(null),
    ceil: Object.create(null),
  };

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
    programAst: null,
    fps: GFX_LOOP_DEFAULT_FPS,
    playing: false,
    wasPlayingBeforeHide: false,
    frame: 0,
    rafId: null,
    lastTick: 0,
    fpsLastTs: 0,
    fpsFrames: 0,
    fpsMeasured: 0,
    frameTimeMs: 0,
    stageMs: {
      traversalExpandMs: 0,
      raycastMs: 0,
      temporalBlendMs: 0,
      upscaleMs: 0,
    },
  };

  const turboQuantState = {
    mode: "auto",
    profile: "balanced",
    effectiveProfile: "balanced",
    pressure: 0,
    streak: 0,
    holdFrames: 0,
    cooloff: 0,
  };

  const turboQuantCaches = {
    falloffByProfile: new Map(),
    brightnessBandsByProfile: new Map(),
  };

  const temporalFrameState = {
    prevFrame: null,
    prevPlayerX: null,
    prevPlayerY: null,
    prevYaw: null,
    prevLightSig: null,
    playerDx: 0,
    playerDy: 0,
    yawDelta: 0,
    lightDelta: 0,
    sceneReset: false,
  };

  function nowMs(){
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }

  function getBudgetManager(){
    if (!state.budgetManager || typeof state.budgetManager !== "object"){
      state.budgetManager = {};
    }
    const mgr = state.budgetManager;
    mgr.telemetry = mgr.telemetry && typeof mgr.telemetry === "object" ? mgr.telemetry : {};
    mgr.traversalBudget = mgr.traversalBudget && typeof mgr.traversalBudget === "object" ? mgr.traversalBudget : {};
    mgr.gfxBudget = mgr.gfxBudget && typeof mgr.gfxBudget === "object" ? mgr.gfxBudget : {};
    if (!mgr.policyPreset) mgr.policyPreset = "balanced";
    if (!mgr.qualityTier) mgr.qualityTier = "balanced";
    if (!Number.isFinite(mgr.cpuMsPerFrame)) mgr.cpuMsPerFrame = 12;
    return mgr;
  }

  function recordTelemetry(update = {}){
    const mgr = getBudgetManager();
    Object.assign(mgr.telemetry, update);
  }

  function captureMemorySnapshot(){
    if (typeof performance === "undefined" || !performance?.memory?.usedJSHeapSize || !performance?.memory?.jsHeapSizeLimit){
      return { used: 0, limit: 0, pressure: 0 };
    }
    const used = Number(performance.memory.usedJSHeapSize) || 0;
    const limit = Number(performance.memory.jsHeapSizeLimit) || 0;
    return {
      used,
      limit,
      pressure: limit > 0 ? Math.max(0, Math.min(1, used / limit)) : 0,
    };
  }

  function applyBudgetPolicyPreset(name){
    const mgr = getBudgetManager();
    const presets = mgr.policyPresets || {};
    if (!Object.prototype.hasOwnProperty.call(presets, name)){
      throw new Error(`Unknown budget policy "${name}"`);
    }
    const preset = presets[name];
    mgr.policyPreset = name;
    mgr.cpuMsPerFrame = Number.isFinite(preset.cpuMsPerFrame) ? preset.cpuMsPerFrame : mgr.cpuMsPerFrame;
    mgr.traversalBudget = {
      ...mgr.traversalBudget,
      ...(preset.traversal || {}),
    };
    mgr.gfxBudget = {
      ...mgr.gfxBudget,
      ...(preset.gfx || {}),
    };
    mgr.qualityTier = preset.gfx?.qualityTier || mgr.qualityTier || "balanced";
    state.traversalConfig = {
      ...(state.traversalConfig || {}),
      ...(preset.traversal || {}),
    };
    state.vars.doom_tq_profile = BUDGET_POLICY_TQ[name] || mgr.qualityTier || "balanced";
    setTurboQuantProfile(state.vars.doom_tq_profile);
    if (state.gfx?.internalScale){
      state.gfx.internalScale.min = Number.isFinite(mgr.gfxBudget.internalScaleMin) ? mgr.gfxBudget.internalScaleMin : state.gfx.internalScale.min;
      state.gfx.internalScale.max = Number.isFinite(mgr.gfxBudget.internalScaleMax) ? mgr.gfxBudget.internalScaleMax : state.gfx.internalScale.max;
    }
    return name;
  }

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
    const rgba = getUpscaleSourceRgba(buffer);
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
    gfxPalettePackedCache = null;
    return colors;
  }

  function packRgbaU32(r, g, b, a){
    return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  }

  function getGfxPalettePacked(){
    if (gfxPalettePackedCache && gfxPalettePackedCache.theme === state.theme){
      return gfxPalettePackedCache.colors;
    }
    const palette = getGfxPalette();
    const colors = Object.create(null);
    for (const key of Object.keys(palette)){
      const rgba = palette[key];
      colors[key] = packRgbaU32(rgba[0], rgba[1], rgba[2], rgba[3]);
    }
    gfxPalettePackedCache = { theme: state.theme, colors };
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

  function ensureVisibilityListener(){
    if (visibilityListenerAttached) return;
    visibilityListenerAttached = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden){
        if (loopState.playing){
          loopState.wasPlayingBeforeHide = true;
          pauseLoop();
        }
      }else if (loopState.wasPlayingBeforeHide){
        loopState.wasPlayingBeforeHide = false;
        playLoop();
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
    if (buffer.pixels instanceof Uint32Array){
      if (buffer.rgba && buffer.rgba.buffer === buffer.pixels.buffer && buffer.rgba.length === needed){
        return buffer.rgba;
      }
      const out = new Uint8Array(buffer.pixels.buffer, buffer.pixels.byteOffset, needed);
      buffer.rgba = out;
      return out;
    }
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

  function clampInternalScale(value){
    if (!Number.isFinite(value)) return 1;
    return Math.max(GFX_INTERNAL_SCALE_MIN, Math.min(GFX_INTERNAL_SCALE_MAX, value));
  }

  function quantizeInternalScale(value){
    const clamped = clampInternalScale(value);
    return Math.round(clamped / GFX_INTERNAL_SCALE_STEP) * GFX_INTERNAL_SCALE_STEP;
  }

  function applySharpenPass(src, w, h, amount){
    if (!(src instanceof Uint8Array) || amount <= 0 || w <= 2 || h <= 2){
      return src;
    }
    const out = new Uint8Array(src.length);
    out.set(src);
    const strength = Math.max(0, Math.min(1, amount));
    for (let y = 1; y < h - 1; y++){
      for (let x = 1; x < w - 1; x++){
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++){
          const center = src[idx + c];
          const left = src[idx - 4 + c];
          const right = src[idx + 4 + c];
          const up = src[idx - (w * 4) + c];
          const down = src[idx + (w * 4) + c];
          const edge = (center * 5) - left - right - up - down;
          const mixed = center + ((edge - center) * strength * 0.35);
          out[idx + c] = Math.max(0, Math.min(255, mixed | 0));
        }
      }
    }
    return out;
  }

  function resetTemporalHistory(buffer, reason = "unknown"){
    if (!buffer || !buffer.temporal) return;
    buffer.temporal.historyRgba = null;
    buffer.temporal.historyLuma = null;
    buffer.temporal.width = 0;
    buffer.temporal.height = 0;
    buffer.temporal.frames = 0;
    buffer.temporal.lastResetReason = reason;
    buffer.temporal.stats.accepted = 0;
    buffer.temporal.stats.rejected = 0;
    buffer.temporal.stats.rejectionRatio = 1;
    buffer.temporal.stats.confidence = 0;
  }

  function computeLuma(r, g, b){
    return ((r * 0.2126) + (g * 0.7152) + (b * 0.0722)) / 255;
  }

  function getTemporalConfig(vars){
    const rawMode = String(vars?.doom_dlss_lite || "off").trim().toLowerCase();
    const mode = rawMode === "quality" || rawMode === "on" || rawMode === "1"
      ? "quality"
      : rawMode === "performance"
        ? "performance"
        : rawMode === "auto"
          ? "auto"
          : "off";
    const debug = Number(vars?.doom_dlss_debug || 0) === 1;
    const nBlend = Number(vars?.doom_dlss_blend);
    let blend = Number.isFinite(nBlend) ? nBlend : GFX_TEMPORAL_BLEND_DEFAULT;
    if (mode === "performance"){
      blend = Math.max(blend, 0.25);
    }
    blend = Math.max(GFX_TEMPORAL_BLEND_MIN, Math.min(GFX_TEMPORAL_BLEND_MAX, blend));
    return { mode, debug, blend };
  }

  function isDoomRuntime(vars){
    return Number(vars?.doom_init || 0) === 1
      || Number.isFinite(Number(vars?.doom_px))
      || Number.isFinite(Number(vars?.doom_py))
      || Number.isFinite(Number(vars?.doom_yaw));
  }

  function getDoomUpscalingConfig(vars, buffer){
    const profile = turboQuantState.mode === "auto" ? turboQuantState.effectiveProfile : turboQuantState.profile;
    const pressure = Number.isFinite(Number(vars?.doom_tq_pressure)) ? (Number(vars.doom_tq_pressure) | 0) : 0;
    const internalScale = Number.isFinite(buffer?.internalScale?.value) ? Number(buffer.internalScale.value) : 1;
    const prefersPerformance = pressure > 0 || profile === "eco" || profile === "performance" || internalScale < 0.86;
    return {
      mode: prefersPerformance ? "performance" : "quality",
      blend: prefersPerformance ? 0.16 : 0.22,
      sharpen: prefersPerformance ? 0.35 : 0.18,
      filter: prefersPerformance ? "nearest" : "linear",
    };
  }

  function getLightingSignature(vars){
    const keys = [
      "doom_light_fix",
      "doom_light_2x4",
      "doom_light_track",
      "doom_light_2x2",
      "doom_light_dl",
      "doom_light_lin",
      "doom_light_hb",
      "doom_light_wp",
      "doom_light_exit",
      "doom_hash",
    ];
    let sig = 0;
    for (let i = 0; i < keys.length; i++){
      const n = Number(vars?.[keys[i]]);
      if (Number.isFinite(n)){
        sig += n * (i + 1);
      }
    }
    return sig;
  }

  function applyTemporalBlend(buffer, src, w, h){
    const tStart = nowMs();
    const vars = state.vars || Object.create(null);
    const cfg = getTemporalConfig(vars);
    const temporal = buffer.temporal;
    const resolvedMode = cfg.mode === "auto"
      ? getDoomUpscalingConfig(vars, buffer).mode
      : cfg.mode;
    temporal.enabled = resolvedMode !== "off";
    temporal.mode = resolvedMode;
    temporal.debug = cfg.debug;
    temporal.blend = cfg.blend;
    if (temporal.lastMode && temporal.lastMode !== resolvedMode){
      resetTemporalHistory(buffer, "mode-switch");
    }
    temporal.lastMode = resolvedMode;

    const pixelCount = w * h;
    if (!temporal.enabled){
      resetTemporalHistory(buffer, "mode-off");
      loopState.stageMs.temporalBlendMs += (nowMs() - tStart);
      return src;
    }
    if (pixelCount > GFX_TEMPORAL_HISTORY_MAX_PIXELS){
      resetTemporalHistory(buffer, "history-cap");
      loopState.stageMs.temporalBlendMs += (nowMs() - tStart);
      return src;
    }
    if (
      temporal.width !== w
      || temporal.height !== h
      || !temporal.historyRgba
      || !temporal.historyLuma
    ){
      resetTemporalHistory(buffer, "resolution-jump");
      temporal.width = w;
      temporal.height = h;
      temporal.historyRgba = new Uint8Array(src.length);
      temporal.historyLuma = new Float32Array(pixelCount);
    }
    if (temporalFrameState.sceneReset){
      resetTemporalHistory(buffer, "scene-reset");
      temporal.width = w;
      temporal.height = h;
      temporal.historyRgba = new Uint8Array(src.length);
      temporal.historyLuma = new Float32Array(pixelCount);
    }

    const out = temporal.output && temporal.output.length === src.length
      ? temporal.output
      : new Uint8Array(src.length);
    temporal.output = out;
    const hist = temporal.historyRgba;
    const histLuma = temporal.historyLuma;
    if (!(hist && histLuma)){
      return src;
    }

    const pDx = temporalFrameState.playerDx || 0;
    const pDy = temporalFrameState.playerDy || 0;
    const yD = temporalFrameState.yawDelta || 0;
    const lightDelta = temporalFrameState.lightDelta || 0;
    const globalMotion = Math.abs(yD) * 1.8 + Math.hypot(pDx, pDy) * 0.8 + (Math.hypot(state.vars?.mouse_dx || 0, state.vars?.mouse_dy || 0) * 0.01);
    const sceneShock = lightDelta > 0.2 || globalMotion > 0.85;
    const reprojX = Math.round((-yD * w * 0.35) - (pDx * 0.75));
    const reprojY = Math.round((pDy * h * 0.6));
    const blendBase = sceneShock ? cfg.blend * 0.35 : cfg.blend;

    let accepted = 0;
    let rejected = 0;
    let confidenceSum = 0;
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        const idxPx = y * w + x;
        const idx = idxPx * 4;
        const r = src[idx];
        const g = src[idx + 1];
        const b = src[idx + 2];
        const a = src[idx + 3];
        const lum = computeLuma(r, g, b);

        const hx = Math.max(0, Math.min(w - 1, x + reprojX));
        const hy = Math.max(0, Math.min(h - 1, y + reprojY));
        const hIdxPx = hy * w + hx;
        const hIdx = hIdxPx * 4;
        const hr = hist[hIdx];
        const hg = hist[hIdx + 1];
        const hb = hist[hIdx + 2];
        const ha = hist[hIdx + 3];
        const hl = histLuma[hIdxPx] || 0;
        const chromaDelta = Math.abs(r - hr) + Math.abs(g - hg) + Math.abs(b - hb);
        const lumaDelta = Math.abs(lum - hl);

        let confidence = 1 - (globalMotion * 0.45) - (lightDelta * 0.85);
        if (ha < 8 || a < 8){
          confidence = 0;
        }
        if (lumaDelta > GFX_TEMPORAL_REJECT_LUMA || chromaDelta > GFX_TEMPORAL_REJECT_CHROMA){
          confidence *= 0.1;
        }
        if (sceneShock && (lumaDelta > 0.12 || chromaDelta > 45)){
          confidence = 0;
        }
        confidence = Math.max(0, Math.min(1, confidence));

        if (confidence > 0.35){
          const amt = blendBase * confidence;
          out[idx] = ((r * (1 - amt)) + (hr * amt)) | 0;
          out[idx + 1] = ((g * (1 - amt)) + (hg * amt)) | 0;
          out[idx + 2] = ((b * (1 - amt)) + (hb * amt)) | 0;
          out[idx + 3] = a;
          accepted += 1;
        }else{
          out[idx] = r;
          out[idx + 1] = g;
          out[idx + 2] = b;
          out[idx + 3] = a;
          rejected += 1;
        }
        confidenceSum += confidence;
      }
    }

    hist.set(out);
    for (let i = 0; i < pixelCount; i++){
      const o = i * 4;
      histLuma[i] = computeLuma(out[o], out[o + 1], out[o + 2]);
    }
    temporal.frames += 1;
    temporal.stats.accepted = accepted;
    temporal.stats.rejected = rejected;
    temporal.stats.rejectionRatio = pixelCount > 0 ? (rejected / pixelCount) : 0;
    temporal.stats.confidence = pixelCount > 0 ? (confidenceSum / pixelCount) : 0;
    loopState.stageMs.temporalBlendMs += (nowMs() - tStart);
    return out;
  }

  function drawTemporalDebugOverlay(rgba, w, h, buffer){
    if (!(rgba instanceof Uint8Array) || !buffer?.temporal?.debug) return rgba;
    const out = (rgba === buffer.temporal.output)
      ? rgba
      : new Uint8Array(rgba);
    const stats = buffer.temporal.stats || {};
    const ratio = Math.max(0, Math.min(1, Number(stats.rejectionRatio) || 0));
    const barW = Math.max(16, Math.min(w - 2, Math.floor(w * 0.35)));
    const barH = Math.max(4, Math.min(10, Math.floor(h * 0.06)));
    const x0 = 1;
    const y0 = 1;
    const acceptW = Math.floor(barW * (1 - ratio));
    for (let y = 0; y < barH; y++){
      for (let x = 0; x < barW; x++){
        const idx = ((y0 + y) * w + (x0 + x)) * 4;
        const isAccepted = x < acceptW;
        out[idx] = isAccepted ? 48 : 220;
        out[idx + 1] = isAccepted ? 200 : 56;
        out[idx + 2] = isAccepted ? 92 : 56;
        out[idx + 3] = 255;
      }
    }
    return out;
  }

  function getUpscaleSourceRgba(buffer){
    const start = nowMs();
    const src = buildRgba(buffer);
    const w = buffer.width | 0;
    const h = buffer.height | 0;
    let out = applyTemporalBlend(buffer, src, w, h);
    out = drawTemporalDebugOverlay(out, w, h, buffer);
    const sharpen = buffer.upscale?.sharpen || 0;
    const finalOut = sharpen > 0 ? applySharpenPass(out, w, h, sharpen) : out;
    loopState.stageMs.upscaleMs += (nowMs() - start);
    return finalOut;
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

    const rgba = getUpscaleSourceRgba(buffer);
    const upscaleFilter = buffer.upscale?.filter === "linear" ? gl.LINEAR : gl.NEAREST;
    gl.bindTexture(gl.TEXTURE_2D, buffer.glTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, upscaleFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, upscaleFilter);
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

    const backendLabel = buffer.backend ? ` • ${buffer.backend}` : "";
    const loopLabel = loopState.expr
      ? ` • loop ${loopState.playing ? "playing" : "paused"} @ ${loopState.fps} fps (${Math.round(loopState.fpsMeasured || 0)} actual) • frame ${loopState.frame}`
      : "";
    const pw = (buffer.present?.width | 0) || (buffer.width | 0);
    const ph = (buffer.present?.height | 0) || (buffer.height | 0);
    const ps = (buffer.present?.scale | 0) || (buffer.scale | 0);
    const showPresent = pw !== buffer.width || ph !== buffer.height || ps !== buffer.scale;
    const internalScale = Number.isFinite(buffer.internalScale?.value) ? buffer.internalScale.value : 1;
    const presentLabel = showPresent ? ` → ${pw}x${ph} • scale ${ps}` : "";
    label.textContent = `gfx ${buffer.width}x${buffer.height} • internal ${internalScale.toFixed(2)}x${presentLabel}${backendLabel}${loopLabel}`;
    hint.textContent = loopState.expr
      ? "P play/pause • ←/→ step • ↑/↓ speed • R reset"
      : "";
    if (buffer.bg && buffer.bg !== "transparent"){
      panel.style.setProperty("--gfx-bg", `var(--${buffer.bg})`);
    }else{
      panel.style.removeProperty("--gfx-bg");
    }
    const displayWidth = pw * ps;
    const displayHeight = ph * ps;
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
      const rgba = getUpscaleSourceRgba(buffer);
      data.set(rgba);
      offCtx.putImageData(buffer.imageData, 0, 0);
    }

    const ctx = canvas.getContext("2d");
    if (ctx && buffer.offscreenCanvas){
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = buffer.upscale?.filter === "linear";
      if (typeof ctx.imageSmoothingQuality === "string"){
        ctx.imageSmoothingQuality = "high";
      }
      const destW = canvas.width / dpr;
      const destH = canvas.height / dpr;
      const sx = buffer.width > 0 ? (destW / buffer.width) : 1;
      const sy = buffer.height > 0 ? (destH / buffer.height) : 1;
      ctx.setTransform(dpr * sx, 0, 0, dpr * sy, 0, 0);
      ctx.drawImage(buffer.offscreenCanvas, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const mgr = getBudgetManager();
      if (mgr.debugHud){
        const tel = mgr.telemetry || {};
        const lines = [
          `policy ${mgr.policyPreset || "balanced"} • q ${mgr.qualityTier || "balanced"}`,
          `trv ${Number(tel.traversalExpandMs || 0).toFixed(2)}ms • ray ${Number(tel.raycastMs || 0).toFixed(2)}ms`,
          `tmp ${Number(tel.temporalBlendMs || 0).toFixed(2)}ms • up ${Number(tel.upscaleMs || 0).toFixed(2)}ms`,
          `frame ${Number(tel.totalFrameMs || 0).toFixed(2)}ms • head ${Number(tel.frameHeadroomMs || 0).toFixed(2)}ms`,
          `mem ${(Number(tel.memoryUsedBytes || 0) / (1024 * 1024)).toFixed(1)} / ${(Number(tel.memoryLimitBytes || 0) / (1024 * 1024)).toFixed(1)} MB`,
        ];
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(6, 6, 280, 72);
        ctx.fillStyle = "#d8f6ff";
        ctx.font = "11px monospace";
        for (let i = 0; i < lines.length; i++){
          ctx.fillText(lines[i], 10, 18 + (i * 13));
        }
        ctx.restore();
      }
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
      present: {
        width,
        height,
        scale,
        locked: false,
      },
      internalScale: {
        mode: "auto",
        value: 1,
        min: GFX_INTERNAL_SCALE_MIN,
        max: GFX_INTERNAL_SCALE_MAX,
        step: GFX_INTERNAL_SCALE_STEP,
        cooldownMs: GFX_INTERNAL_SCALE_COOLDOWN_MS,
        hysteresisFrames: GFX_INTERNAL_SCALE_HYSTERESIS_FRAMES,
        downshiftRatio: 1.08,
        upshiftRatio: 0.72,
        downStreak: 0,
        upStreak: 0,
        lastAdjustTs: 0,
      },
      upscale: {
        filter: "nearest",
        sharpen: 0,
      },
      temporal: {
        enabled: false,
        mode: "off",
        lastMode: "off",
        blend: GFX_TEMPORAL_BLEND_DEFAULT,
        debug: false,
        frames: 0,
        width: 0,
        height: 0,
        historyRgba: null,
        historyLuma: null,
        output: null,
        lastResetReason: "init",
        stats: {
          accepted: 0,
          rejected: 0,
          rejectionRatio: 1,
          confidence: 0,
        },
      },
      pixels: new Uint32Array(width * height),
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

  function resizeGfxBuffer(buffer, width, height, scale){
    if (!buffer || !buffer.__gfx){
      return createGfxBuffer(width, height, scale);
    }
    const w = width | 0;
    const h = height | 0;
    buffer.width = w;
    buffer.height = h;
    buffer.scale = scale;
    if (!buffer.present?.locked){
      buffer.present = {
        width: w,
        height: h,
        scale,
        locked: false,
      };
    }else{
      buffer.present.scale = scale;
    }
    const targetScale = clampInternalScale(buffer.internalScale?.value ?? 1);
    const targetW = Math.max(1, Math.round((buffer.present?.width || w) * targetScale));
    const targetH = Math.max(1, Math.round((buffer.present?.height || h) * targetScale));
    buffer.width = targetW;
    buffer.height = targetH;
    buffer.pixels = new Uint32Array(targetW * targetH);
    buffer.rgba = null;
    buffer.imageData = null;
    buffer.offscreenCanvas = null;
    buffer.offscreenCtx = null;
    buffer.glSizeW = 0;
    buffer.glSizeH = 0;
    buffer.gpuTexW = 0;
    buffer.gpuTexH = 0;
    resetTemporalHistory(buffer, "resize");
    return buffer;
  }

  function setInternalRenderScale(buffer, scaleValue){
    if (!buffer || !buffer.__gfx) return;
    const present = buffer.present || { width: buffer.width, height: buffer.height };
    const scale = quantizeInternalScale(scaleValue);
    const w = Math.max(1, Math.round((present.width || 1) * scale));
    const h = Math.max(1, Math.round((present.height || 1) * scale));
    if (buffer.width === w && buffer.height === h) return;
    buffer.internalScale.value = scale;
    buffer.width = w;
    buffer.height = h;
    buffer.pixels = new Uint32Array(w * h);
    buffer.rgba = null;
    buffer.imageData = null;
    buffer.offscreenCanvas = null;
    buffer.offscreenCtx = null;
    buffer.glSizeW = 0;
    buffer.glSizeH = 0;
    buffer.gpuTexW = 0;
    buffer.gpuTexH = 0;
    resetTemporalHistory(buffer, "internal-scale");
    markGfxDirty();
  }

  function updateInternalScaleController(buffer, timestamp){
    if (!buffer || !buffer.__gfx || buffer.internalScale?.mode !== "auto") return;
    const frameMs = loopState.frameTimeMs;
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    const targetMs = 1000 / Math.max(1, loopState.fps || GFX_LOOP_DEFAULT_FPS);
    const ctl = buffer.internalScale;
    if ((timestamp - (ctl.lastAdjustTs || 0)) < ctl.cooldownMs) return;
    if (frameMs > targetMs * ctl.downshiftRatio){
      ctl.downStreak += 1;
      ctl.upStreak = 0;
      if (ctl.downStreak >= ctl.hysteresisFrames){
        const next = Math.max(ctl.min, ctl.value - ctl.step);
        setInternalRenderScale(buffer, next);
        ctl.lastAdjustTs = timestamp;
        ctl.downStreak = 0;
      }
      return;
    }
    if (frameMs < targetMs * ctl.upshiftRatio){
      ctl.upStreak += 1;
      ctl.downStreak = 0;
      if (ctl.upStreak >= ctl.hysteresisFrames){
        const next = Math.min(ctl.max, ctl.value + ctl.step);
        setInternalRenderScale(buffer, next);
        ctl.lastAdjustTs = timestamp;
        ctl.upStreak = 0;
      }
      return;
    }
    ctl.downStreak = 0;
    ctl.upStreak = 0;
  }

  function requireGfxBuffer(){
    if (!state.gfx) throw new Error("No gfx buffer. Use gfx(width, height, scale) first.");
    return state.gfx;
  }

  function normalizePixelColor(color){
    if (color === null || color === undefined) return 0;
    if (typeof color === "number") return color >>> 0;
    if (typeof color === "string"){
      const packed = getGfxPalettePacked();
      return (packed[color] ?? packed.transparent ?? 0) >>> 0;
    }
    return 0;
  }

  function setPixel(buffer, x, y, color){
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= buffer.width || iy >= buffer.height) return;
    buffer.pixels[iy * buffer.width + ix] = normalizePixelColor(color);
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

  const FONT_5X7 = Object.freeze({
    " ": [0, 0, 0, 0, 0, 0, 0],
    "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
    "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
    "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
    "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
    "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
    "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
    "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
    "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
    "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
    "A": [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    "B": [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
    "C": [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
    "D": [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
    "E": [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
    "F": [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
    "G": [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
    "H": [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    "I": [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    "J": [0b00001, 0b00001, 0b00001, 0b00001, 0b10001, 0b10001, 0b01110],
    "K": [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
    "L": [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
    "M": [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
    "N": [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
    "O": [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    "P": [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
    "Q": [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
    "R": [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
    "S": [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
    "T": [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
    "U": [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    "V": [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
    "W": [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
    "X": [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
    "Y": [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
    "Z": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
    ".": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
    ",": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01000],
    ":": [0b00000, 0b01100, 0b01100, 0b00000, 0b01100, 0b01100, 0b00000],
    "-": [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
    "+": [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
    "=": [0b00000, 0b00000, 0b11111, 0b00000, 0b11111, 0b00000, 0b00000],
    "/": [0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b00000, 0b00000],
    "*": [0b00000, 0b01010, 0b00100, 0b11111, 0b00100, 0b01010, 0b00000],
    "^": [0b00100, 0b01010, 0b10001, 0b00000, 0b00000, 0b00000, 0b00000],
    "$": [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
    "#": [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
    "(": [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
    ")": [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  });

  function drawText(buffer, x, y, text, color, scale){
    if (!text) return;
    const sc = Math.max(1, Math.min(6, Math.round(scale || 1)));
    let cx = Math.round(x);
    let cy = Math.round(y);
    const lineH = 8 * sc;
    for (let i = 0; i < text.length; i++){
      const ch0 = text[i];
      if (ch0 === "\n"){
        cx = Math.round(x);
        cy += lineH;
        continue;
      }
      const ch = ch0 >= "a" && ch0 <= "z" ? ch0.toUpperCase() : ch0;
      const glyph = FONT_5X7[ch] || FONT_5X7[" "];
      for (let row = 0; row < 7; row++){
        const bits = glyph[row] | 0;
        for (let col = 0; col < 5; col++){
          if ((bits >> (4 - col)) & 1){
            if (sc === 1){
              setPixel(buffer, cx + col, cy + row, color);
            }else{
              fillRect(buffer, cx + col * sc, cy + row * sc, sc, sc, color);
            }
          }
        }
      }
      cx += 6 * sc;
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

  function setProgramSourceParser(fn){
    parseProgramSource = fn;
  }

  function normalizeTurboQuantProfileName(value){
    const key = String(value || "").trim().toLowerCase();
    if (key === "auto") return "auto";
    if (Object.prototype.hasOwnProperty.call(TURBO_QUANT_PROFILES, key)) return key;
    throw new Error(`Unknown TurboQuant profile "${value}". Expected ultra, balanced, performance, eco, or auto.`);
  }

  function getTurboQuantProfileConfig(name){
    return TURBO_QUANT_PROFILES[name] || TURBO_QUANT_PROFILES.balanced;
  }

  function buildFalloffLut(name){
    const profile = getTurboQuantProfileConfig(name);
    const cacheKey = `${name}:${profile.expensiveMathStride}:${profile.occlusionChecks}:${profile.lightSamples}`;
    if (turboQuantCaches.falloffByProfile.has(cacheKey)) return turboQuantCaches.falloffByProfile.get(cacheKey);
    const lut = new Float32Array(512);
    const stride = Math.max(1, profile.expensiveMathStride | 0);
    for (let i = 0; i < lut.length; i++){
      const d2 = i / 24;
      let p = 1.04 + (profile.lightSamples > 4 ? 0 : 0.06);
      if (stride >= 3) p += 0.04;
      lut[i] = 1 / Math.pow(1 + d2, p);
    }
    turboQuantCaches.falloffByProfile.set(cacheKey, lut);
    return lut;
  }

  function buildLightingBands(name){
    const cacheKey = `${name}:bands`;
    if (turboQuantCaches.brightnessBandsByProfile.has(cacheKey)) return turboQuantCaches.brightnessBandsByProfile.get(cacheKey);
    const coarse = getTurboQuantProfileConfig(name).coarseShading ? 6 : 12;
    const bands = new Float32Array(coarse);
    for (let i = 0; i < coarse; i++){
      bands[i] = i / Math.max(1, coarse - 1);
    }
    turboQuantCaches.brightnessBandsByProfile.set(cacheKey, bands);
    return bands;
  }

  function setTurboQuantProfile(name){
    const normalized = normalizeTurboQuantProfileName(name);
    turboQuantState.mode = normalized === "auto" ? "auto" : "manual";
    turboQuantState.profile = normalized === "auto" ? turboQuantState.profile : normalized;
    turboQuantState.effectiveProfile = normalized === "auto" ? turboQuantState.effectiveProfile : normalized;
    turboQuantState.streak = 0;
    turboQuantState.holdFrames = 0;
    turboQuantState.cooloff = 0;
    state.vars.doom_tq_mode = turboQuantState.mode;
    state.vars.doom_tq_profile = turboQuantState.profile;
    state.vars.doom_tq_effective = turboQuantState.effectiveProfile;
    return turboQuantState.mode === "auto" ? "auto" : turboQuantState.profile;
  }

  function updateTurboQuantAutoProfile(){
    if (turboQuantState.mode !== "auto") return;
    const targetFps = Math.max(1, loopState.fps || GFX_LOOP_DEFAULT_FPS);
    const measured = Number.isFinite(loopState.fpsMeasured) && loopState.fpsMeasured > 0 ? loopState.fpsMeasured : targetFps;
    const ratio = measured / targetFps;
    const current = turboQuantState.effectiveProfile;
    let next = current;

    if (turboQuantState.cooloff > 0){
      turboQuantState.cooloff -= 1;
      return;
    }
    if (ratio < TURBO_QUANT_FPS_BANDS.downshift.eco){
      next = "eco";
    }else if (ratio < TURBO_QUANT_FPS_BANDS.downshift.performance){
      next = current === "ultra" ? "balanced" : "performance";
    }else if (ratio > TURBO_QUANT_FPS_BANDS.upshift.ultra){
      next = "ultra";
    }else if (ratio > TURBO_QUANT_FPS_BANDS.upshift.balanced){
      next = "balanced";
    }

    if (next !== current){
      turboQuantState.streak += 1;
      if (turboQuantState.streak >= 3 && turboQuantState.holdFrames >= 10){
        turboQuantState.effectiveProfile = next;
        turboQuantState.streak = 0;
        turboQuantState.holdFrames = 0;
        turboQuantState.cooloff = 20;
      }
    }else{
      turboQuantState.streak = 0;
      turboQuantState.holdFrames += 1;
    }
  }

  function runLoopScript(){
    if (!runLoopStatement && !runExpressionWithContext){
      throw new Error("Loop runner not ready.");
    }
    if (runLoopStatement){
      runLoopStatement(loopState.programAst || loopState.expr);
      return;
    }
    runExpressionWithContext(loopState.expr, state.vars);
  }

  function updateTemporalFrameState(){
    const vars = state.vars || Object.create(null);
    const frame = Number(vars.frame);
    const px = Number(vars.doom_px);
    const py = Number(vars.doom_py);
    const yaw = Number(vars.doom_yaw);
    const lightSig = getLightingSignature(vars);
    const frameReset = Number.isFinite(frame)
      && Number.isFinite(temporalFrameState.prevFrame)
      && frame <= temporalFrameState.prevFrame;
    const explicitReset = Number(vars.doom_scene_reset || vars.doom_regen || 0) === 1;
    temporalFrameState.sceneReset = Boolean(frameReset || explicitReset);
    temporalFrameState.playerDx = (Number.isFinite(px) && Number.isFinite(temporalFrameState.prevPlayerX))
      ? (px - temporalFrameState.prevPlayerX)
      : 0;
    temporalFrameState.playerDy = (Number.isFinite(py) && Number.isFinite(temporalFrameState.prevPlayerY))
      ? (py - temporalFrameState.prevPlayerY)
      : 0;
    temporalFrameState.yawDelta = (Number.isFinite(yaw) && Number.isFinite(temporalFrameState.prevYaw))
      ? (yaw - temporalFrameState.prevYaw)
      : 0;
    temporalFrameState.lightDelta = Number.isFinite(temporalFrameState.prevLightSig)
      ? Math.min(1, Math.abs(lightSig - temporalFrameState.prevLightSig) / 250)
      : 0;
    temporalFrameState.prevFrame = Number.isFinite(frame) ? frame : temporalFrameState.prevFrame;
    temporalFrameState.prevPlayerX = Number.isFinite(px) ? px : temporalFrameState.prevPlayerX;
    temporalFrameState.prevPlayerY = Number.isFinite(py) ? py : temporalFrameState.prevPlayerY;
    temporalFrameState.prevYaw = Number.isFinite(yaw) ? yaw : temporalFrameState.prevYaw;
    temporalFrameState.prevLightSig = lightSig;
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
    state.vars.fps_actual = (loopState.fpsMeasured && Number.isFinite(loopState.fpsMeasured)) ? loopState.fpsMeasured : fps;
    const tqTarget = Math.max(1, fps);
    const tqActual = Number.isFinite(loopState.fpsMeasured) && loopState.fpsMeasured > 0 ? loopState.fpsMeasured : tqTarget;
    const tqRatio = tqActual / tqTarget;
    turboQuantState.pressure = tqRatio < 0.8 ? 2 : (tqRatio < 0.95 ? 1 : 0);
    state.vars.doom_tq_mode = turboQuantState.mode;
    state.vars.doom_tq_profile = turboQuantState.profile;
    state.vars.doom_tq_effective = turboQuantState.effectiveProfile;
    state.vars.doom_tq_pressure = turboQuantState.pressure;
    if (!state.vars.doom_dlss_lite){
      state.vars.doom_dlss_lite = isDoomRuntime(state.vars) ? "auto" : "off";
    }
    if (!Number.isFinite(Number(state.vars.doom_dlss_debug))){
      state.vars.doom_dlss_debug = 0;
    }
    state.vars.key_w = keyState.down.w ? 1 : 0;
    state.vars.key_a = keyState.down.a ? 1 : 0;
    state.vars.key_s = keyState.down.s ? 1 : 0;
    state.vars.key_d = keyState.down.d ? 1 : 0;
    state.vars.key_q = keyState.down.q ? 1 : 0;
    state.vars.key_e = keyState.down.e ? 1 : 0;
    state.vars.key_f = keyState.down.f ? 1 : 0;
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
    if (isDoomRuntime(state.vars)){
      const doomUpscale = getDoomUpscalingConfig(state.vars, state.gfx);
      if (!Number.isFinite(Number(state.vars.doom_dlss_blend))){
        state.vars.doom_dlss_blend = doomUpscale.blend;
      }
      if (state.gfx?.upscale){
        state.gfx.upscale.filter = doomUpscale.filter;
        state.gfx.upscale.sharpen = doomUpscale.sharpen;
      }
    }
    loopState.stageMs.traversalExpandMs = 0;
    loopState.stageMs.raycastMs = 0;
    loopState.stageMs.temporalBlendMs = 0;
    loopState.stageMs.upscaleMs = 0;
    const frameStart = nowMs();
    try{
      const traversalStart = nowMs();
      runLoopScript();
      loopState.stageMs.traversalExpandMs += (nowMs() - traversalStart);
      updateTemporalFrameState();
      flushGfxOutput();
    }catch(err){
      pauseLoop();
      if (typeof writeLine === "function"){
        const msg = err?.message || String(err);
        const rendered = msg.startsWith("GFX loop error:") ? msg : `GFX loop error: ${msg}`;
        writeLine(rendered, "err");
      }
    }
    const frameEnd = nowMs();
    const elapsedMs = Math.max(0.01, frameEnd - frameStart);
    if (!loopState.frameTimeMs || !Number.isFinite(loopState.frameTimeMs)){
      loopState.frameTimeMs = elapsedMs;
    }else{
      loopState.frameTimeMs = (loopState.frameTimeMs * (1 - GFX_FRAME_TIME_SMOOTHING)) + (elapsedMs * GFX_FRAME_TIME_SMOOTHING);
    }
    const mgr = getBudgetManager();
    const targetMs = Number.isFinite(mgr.cpuMsPerFrame) ? mgr.cpuMsPerFrame : (1000 / Math.max(1, loopState.fps || GFX_LOOP_DEFAULT_FPS));
    const headroom = targetMs - elapsedMs;
    const traversalPressure = Math.max(0, Math.min(1, loopState.stageMs.traversalExpandMs / Math.max(0.001, targetMs * 0.5)));
    const memory = captureMemorySnapshot();
    if (state.gfx?.internalScale){
      const ctl = state.gfx.internalScale;
      ctl.min = Number.isFinite(mgr.gfxBudget?.internalScaleMin) ? mgr.gfxBudget.internalScaleMin : ctl.min;
      ctl.max = Number.isFinite(mgr.gfxBudget?.internalScaleMax) ? mgr.gfxBudget.internalScaleMax : ctl.max;
      if (traversalPressure > 0.8 || headroom < -(targetMs * 0.12)){
        const next = Math.max(ctl.min, (ctl.value || 1) - GFX_INTERNAL_SCALE_ADAPTIVE_STEP);
        setInternalRenderScale(state.gfx, next);
        if (mgr.qualityTier === "ultra") mgr.qualityTier = "balanced";
        else if (mgr.qualityTier === "balanced") mgr.qualityTier = "performance";
        else mgr.qualityTier = "eco";
      }else if (traversalPressure < 0.25 && headroom > targetMs * 0.2){
        const next = Math.min(ctl.max, (ctl.value || 1) + GFX_INTERNAL_SCALE_ADAPTIVE_STEP);
        setInternalRenderScale(state.gfx, next);
        if (mgr.qualityTier === "eco") mgr.qualityTier = "performance";
        else if (mgr.qualityTier === "performance") mgr.qualityTier = "balanced";
        else mgr.qualityTier = "ultra";
      }
      state.vars.doom_tq_profile = String(mgr.qualityTier || "balanced");
      setTurboQuantProfile(state.vars.doom_tq_profile);
    }
    state.traversalConfig = {
      ...(state.traversalConfig || {}),
      ...(mgr.traversalBudget || {}),
    };
    recordTelemetry({
      frame: loopState.frame,
      traversalExpandMs: loopState.stageMs.traversalExpandMs,
      raycastMs: loopState.stageMs.raycastMs,
      temporalBlendMs: loopState.stageMs.temporalBlendMs,
      upscaleMs: loopState.stageMs.upscaleMs,
      totalFrameMs: elapsedMs,
      frameHeadroomMs: headroom,
      traversalPressure,
      memoryUsedBytes: memory.used,
      memoryLimitBytes: memory.limit,
      memoryPressure: memory.pressure,
    });
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

    if (!loopState.fpsLastTs) loopState.fpsLastTs = timestamp;
    const fpsWindow = timestamp - loopState.fpsLastTs;
    if (fpsWindow >= 500){
      loopState.fpsMeasured = (loopState.fpsFrames * 1000) / fpsWindow;
      loopState.fpsFrames = 0;
      loopState.fpsLastTs = timestamp;
      updateTurboQuantAutoProfile();
    }

    if (!loopState.lastTick) loopState.lastTick = timestamp;
    const interval = 1000 / loopState.fps;
    if (timestamp - loopState.lastTick >= interval){
      const elapsed = timestamp - loopState.lastTick;
      const rawSteps = Math.max(1, Math.floor(elapsed / interval));
      const capped = elapsed > GFX_LOOP_MAX_CATCHUP_MS;
      const steps = capped ? 1 : Math.min(rawSteps, GFX_LOOP_MAX_CATCHUP_STEPS);
      loopState.lastTick = capped ? timestamp : (loopState.lastTick + steps * interval);
      for (let i = 0; i < steps; i++){
        loopState.frame += 1;
        loopState.fpsFrames += 1;
        runLoopFrame();
        updateInternalScaleController(state.gfx, timestamp);
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
    loopState.programAst = (typeof parseProgramSource === "function")
      ? parseProgramSource(script)
      : null;
    loopState.frame = 0;
    loopState.playing = false;
    loopState.lastTick = 0;
    loopState.wasPlayingBeforeHide = false;
    loopState.fpsLastTs = 0;
    loopState.fpsFrames = 0;
    loopState.fpsMeasured = 0;
    loopState.frameTimeMs = 0;
    temporalFrameState.prevFrame = null;
    temporalFrameState.prevPlayerX = null;
    temporalFrameState.prevPlayerY = null;
    temporalFrameState.prevYaw = null;
    temporalFrameState.prevLightSig = null;
    temporalFrameState.sceneReset = true;
    resetTemporalHistory(state.gfx, "mode-switch");
    ensureVisibilityListener();
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
    loopState.fpsLastTs = 0;
    loopState.fpsFrames = 0;
    loopState.frameTimeMs = 0;
    loopState.rafId = window.requestAnimationFrame(tickLoop);
    markGfxDirty();
    flushGfxOutput();
  }

  function pauseLoop(){
    loopState.playing = false;
    loopState.lastTick = 0;
    loopState.fpsLastTs = 0;
    loopState.fpsFrames = 0;
    loopState.frameTimeMs = 0;
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
    temporalFrameState.sceneReset = true;
    resetTemporalHistory(state.gfx, "scene-reset");
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
      fpsMeasured: loopState.fpsMeasured || 0,
      frameTimeMs: loopState.frameTimeMs || 0,
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

  function buildGfxMetaFns(defFn, defFnCtx){
    return {
      gfx: defFn("gfx", -1, {
        args: [
          { label: "w", kinds: ["scalar", "dim"], dim: "scalar" },
          { label: "h", kinds: ["scalar", "dim"], dim: "scalar" },
          { label: "scale", kinds: ["scalar", "dim"], dim: "scalar" },
        ],
        returns: { kinds: ["gfx"] },
        effects: EFFECT.IO_GFX,
      }, (w, h, scale = null) => {
        const width = normalizeGfxDimension(w, "width");
        const height = normalizeGfxDimension(h, "height");
        const sc = (scale === null || scale === undefined) ? GFX_DEFAULT_SCALE : normalizeGfxScale(isQty(scale) ? scale.value : scale);
        state.gfx = resizeGfxBuffer(state.gfx, width, height, sc);
        setInternalRenderScale(state.gfx, 1);
        markGfxDirty();
        return state.gfx;
      }),
      gfxs: defFn("gfxs", 1, {
        args: [{ label: "scale", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (scale) => {
        const buffer = requireGfxBuffer();
        const normalized = normalizeGfxScale(scale);
        buffer.scale = normalized;
        if (!buffer.present){
          buffer.present = { width: buffer.width, height: buffer.height, scale: normalized, locked: false };
        }else{
          buffer.present.scale = normalized;
        }
        markGfxDirty();
        return normalized;
      }),
      gfxiscale: defFn("gfxiscale", 1, {
        args: [{ label: "scale", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (scale) => {
        const buffer = requireGfxBuffer();
        const value = isQty(scale) ? scale.value : scale;
        if (!Number.isFinite(value)) throw new Error("gfxiscale expects numeric scale");
        buffer.internalScale.mode = "manual";
        const clamped = Math.max(buffer.internalScale.min, Math.min(buffer.internalScale.max, value));
        setInternalRenderScale(buffer, clamped);
        return buffer.internalScale.value;
      }),
      gfxiauto: defFn("gfxiauto", 1, {
        args: [{ label: "enabled", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (enabled) => {
        const buffer = requireGfxBuffer();
        const value = isQty(enabled) ? enabled.value : enabled;
        buffer.internalScale.mode = Number(value) > 0 ? "auto" : "manual";
        return buffer.internalScale.mode === "auto" ? 1 : 0;
      }),
      gfxupscale: defFn("gfxupscale", -1, {
        args: [
          { label: "filter", kinds: ["string"] },
          { label: "sharpen", kinds: ["scalar"] },
        ],
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, (filter = "nearest", sharpen = 0) => {
        const buffer = requireGfxBuffer();
        const normalizedFilter = String(filter || "nearest").trim().toLowerCase();
        if (normalizedFilter !== "nearest" && normalizedFilter !== "linear" && normalizedFilter !== "bilinear"){
          throw new Error("gfxupscale filter must be nearest or linear");
        }
        const sharpenValue = isQty(sharpen) ? sharpen.value : sharpen;
        const clampedSharpen = Number.isFinite(sharpenValue) ? Math.max(0, Math.min(1, sharpenValue)) : 0;
        buffer.upscale.filter = normalizedFilter === "bilinear" ? "linear" : normalizedFilter;
        buffer.upscale.sharpen = clampedSharpen;
        markGfxDirty();
        return `${buffer.upscale.filter};sharpen=${buffer.upscale.sharpen.toFixed(2)}`;
      }),
      cls: defFn("cls", 0, {
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, () => {
        const buffer = requireGfxBuffer();
        if (buffer.pixels && typeof buffer.pixels.fill === "function") buffer.pixels.fill(0);
        buffer.bg = null;
        markGfxDirty();
        return 1;
      }),

      raycast_tex: defFnCtx("raycast_tex", 11, {
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
          { label: "opts", kinds: ["any"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (ctx, mapObj, px, py, yaw, fov, viewH, maxD, step, steps, colStep, opts) => {
        const stageStart = nowMs();
        const buffer = requireGfxBuffer();
        if (!mapObj || typeof mapObj !== "object" || !mapObj.__map || !mapObj.data){
          throw new Error("raycast_tex expects a map() as the first argument");
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
          throw new Error("raycast_tex expects numeric arguments");
        }

        const mapW = mapObj.w | 0;
        const mapH = mapObj.h | 0;
        const data = mapObj.data;
        const w = buffer.width | 0;
        const h = buffer.height | 0;
        const vh = Math.max(1, Math.min(h, Math.floor(nViewH)));
        const md = Math.max(0.1, nMaxD);
        const st = Math.max(0.001, nStep);

        const vars = ctx?.vars || Object.create(null);
        const wallFinish = typeof vars.doom_wall_finish === "string" ? vars.doom_wall_finish : "DRYWALL_PRIMED";
        const floorFinish = typeof vars.doom_floor_finish === "string" ? vars.doom_floor_finish : "CONCRETE_TROWEL";
        const ceilFinish = typeof vars.doom_ceiling_finish === "string" ? vars.doom_ceiling_finish : "ACT_2x2";

        const wallProcTex = Number.isFinite(vars.doom_wall_proc_tex) ? (vars.doom_wall_proc_tex | 0) : -1;
        const floorProcTex = Number.isFinite(vars.doom_floor_proc_tex) ? (vars.doom_floor_proc_tex | 0) : -1;
        const ceilProcTex = Number.isFinite(vars.doom_ceiling_proc_tex) ? (vars.doom_ceiling_proc_tex | 0) : -1;

        const procRes = (() => {
          const v = vars.doom_proc_tex_res;
          const n = isQty(v) ? v.value : v;
          return Number.isFinite(n) ? Math.max(16, Math.min(256, Math.floor(n))) : 64;
        })();
        const procAnimDiv = (() => {
          const v = vars.doom_proc_tex_anim_div;
          const n = isQty(v) ? v.value : v;
          return Number.isFinite(n) && n > 0 ? Math.max(1, Math.floor(n)) : 6;
        })();
        const procTBucket = (() => {
          const f = Number.isFinite(vars.frame) ? vars.frame : 0;
          return Math.floor(f / procAnimDiv);
        })();

        const wainscotFinish = typeof vars.doom_wainscot_finish === "string" ? vars.doom_wainscot_finish : "";
        const wainscotH = (() => {
          const v = vars.doom_wainscot_h;
          const n = isQty(v) ? v.value : v;
          return Number.isFinite(n) ? Math.max(0, n) : 0;
        })();

        function ensureProcTextureData(surface, texId){
          if (!ctx || typeof ctx.evalString !== "function") return null;
          if (texId < 0) return null;
          const bucketKey = `${texId}@${procTBucket}@${procRes}`;
          const cached = procTexCache[surface]?.[bucketKey];
          if (cached) return cached;

          const data = new Uint32Array(procRes * procRes);
          const call = `get_texel(${texId}, x, y, ${procTBucket})`;
          for (let y = 0; y < procRes; y++){
            for (let x = 0; x < procRes; x++){
              const packed = ctx.evalString(call, { x, y });
              data[y * procRes + x] = (packed >>> 0);
            }
          }
          procTexCache[surface][bucketKey] = { w: procRes, h: procRes, data };
          return procTexCache[surface][bucketKey];
        }

        function sampleProcNearest(tex, u, v){
          const w = tex.w | 0;
          const h = tex.h | 0;
          const xi = ((u | 0) % w + w) % w;
          const yi = ((v | 0) % h + h) % h;
          return tex.data[yi * w + xi] >>> 0;
        }

        const optObj = (opts && typeof opts === "object" && opts.__obj && typeof opts.raw === "string") ? opts.raw : null;
        const tqOverride = normalizeTurboQuantProfileName(vars.doom_tq_profile || "auto");
        if (tqOverride === "auto"){
          turboQuantState.mode = "auto";
        }else{
          turboQuantState.mode = "manual";
          turboQuantState.profile = tqOverride;
          turboQuantState.effectiveProfile = tqOverride;
        }
        const tqProfileName = turboQuantState.mode === "auto" ? turboQuantState.effectiveProfile : turboQuantState.profile;
        const tqProfile = getTurboQuantProfileConfig(tqProfileName);
        const falloffLut = buildFalloffLut(tqProfileName);
        const lightingBands = buildLightingBands(tqProfileName);
        const pressure = Number.isFinite(vars.doom_tq_pressure) ? (vars.doom_tq_pressure | 0) : 0;
        const useCoarsePath = tqProfile.coarseShading || pressure > 0;

        let floorStep = tqProfile.floorStep;
        let ceilStep = tqProfile.ceilStep;
        if (useCoarsePath){
          floorStep = Math.max(floorStep, 3);
          ceilStep = Math.max(ceilStep, 3);
        }
        let texRes = 1;
        if (optObj && typeof ctx?.evalString === "function"){
          try{
            const parsed = parseObjectLiteral(optObj);
            const values = Object.create(null);
            for (const ent of parsed){
              const k = String(ent.key || "").trim();
              if (!k) continue;
              values[k] = ctx.evalString(ent.expr);
            }
            const nfs = toNum(values.floor_step);
            const ncs0 = toNum(values.ceil_step);
            const ntr = toNum(values.tex_res);
            if (Number.isFinite(nfs) && nfs >= 1) floorStep = Math.min(8, Math.floor(nfs));
            if (Number.isFinite(ncs0) && ncs0 >= 1) ceilStep = Math.min(8, Math.floor(ncs0));
            if (Number.isFinite(ntr) && ntr >= 1) texRes = Math.min(8, Math.floor(ntr));
          }catch{}
        }

        const nSteps = Math.max(1, Math.floor(nStepsIn * tqProfile.rayStepsMul));
        const cs = Math.max(1, Math.floor(nColStep * tqProfile.colStepMul));

        function sampleTile(x, y){
          const ix = x | 0;
          const iy = y | 0;
          if (ix < 0 || iy < 0 || ix >= mapW || iy >= mapH) return 1;
          return data[iy * mapW + ix] | 0;
        }

        function lightAt(worldX, worldY){
          const cx = Math.floor(worldX);
          const cy = Math.floor(worldY);
          let light = 0;

          const paramsForTile = (tt) => {
            if (tt === 8) return { i: 1.10, f: 0.85, p: 1.00 };
            if (tt === 12) return { i: 0.95, f: 0.90, p: 1.00 };
            if (tt === 13) return { i: 1.20, f: 1.25, p: 1.08 };
            if (tt === 16) return { i: 1.00, f: 0.95, p: 1.00 };
            if (tt === 17) return { i: 1.45, f: 1.05, p: 1.05 };
            if (tt === 18) return { i: 0.90, f: 1.15, p: 1.12 };
            if (tt === 19) return { i: 0.35, f: 1.60, p: 1.20 };
            if (tt === 9) return { i: 0.85, f: 1.10, p: 1.05 };
            return null;
          };

          const isOccluded = (lx, ly, wx, wy) => {
            if (!tqProfile.allowSecondary || tqProfile.occlusionChecks <= 0) return false;
            const dx = wx - lx;
            const dy = wy - ly;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!(dist > 0.75)) return false;
            const steps = Math.min(tqProfile.occlusionChecks, Math.max(2, Math.ceil(dist / 0.25)));
            const inv = 1 / steps;
            for (let i = 1; i < steps; i++){
              const sx = lx + dx * (i * inv);
              const sy = ly + dy * (i * inv);
              const tt = sampleTile(Math.floor(sx), Math.floor(sy));
              if (tt === 1 || tt === 2) return true;
            }
            return false;
          };

          const r = tqProfile.lightSamples;
          for (let oy = -r; oy <= r; oy++){
            const ty = cy + oy;
            if (ty < 0 || ty >= mapH) continue;
            for (let ox = -r; ox <= r; ox++){
              const tx = cx + ox;
              if (tx < 0 || tx >= mapW) continue;
              const tt = data[ty * mapW + tx] | 0;
              const lp = paramsForTile(tt);
              if (!lp) continue;
              const lx = tx + 0.5;
              const ly = ty + 0.5;
              const dx = worldX - lx;
              const dy = worldY - ly;
              const d2 = dx * dx + dy * dy;
              if (isOccluded(lx, ly, worldX, worldY)) continue;
              const lutIndex = Math.max(0, Math.min(falloffLut.length - 1, (d2 * (22 * lp.f)) | 0));
              light += lp.i * falloffLut[lutIndex];
            }
          }
          return light;
        }

        function applyBrightnessToRgba(packed, bright){
          const r = (packed >>> 24) & 255;
          const g = (packed >>> 16) & 255;
          const b = (packed >>> 8) & 255;
          const a = packed & 255;
          const br = bright < 0 ? 0 : bright > 1 ? 1 : bright;
          const rr = (r * br) | 0;
          const gg = (g * br) | 0;
          const bb = (b * br) | 0;
          return FIN_TEX_INTERNAL.packRgba(rr, gg, bb, a);
        }

        function rgbaBEToU32(packed){
          const r = (packed >>> 24) & 255;
          const g = (packed >>> 16) & 255;
          const b = (packed >>> 8) & 255;
          const a = packed & 255;
          return packRgbaU32(r, g, b, a);
        }

        const floorTex = getFinishTexture(floorFinish) || getFinishTexture("CONCRETE_TROWEL");
        const ceilTex = getFinishTexture(ceilFinish) || getFinishTexture("ACT_2x2");
        const wallTexDefault = getFinishTexture(wallFinish) || getFinishTexture("DRYWALL_PRIMED");
        const wainscotTex = wainscotFinish ? (getFinishTexture(wainscotFinish) || wallTexDefault) : null;

        const wallProc = wallProcTex >= 0 ? ensureProcTextureData("wall", wallProcTex) : null;
        const floorProc = floorProcTex >= 0 ? ensureProcTextureData("floor", floorProcTex) : null;
        const ceilProc = ceilProcTex >= 0 ? ensureProcTextureData("ceil", ceilProcTex) : null;

        function sampleWallTex(worldX, worldY, wallY01){
          const useWainscot = (wainscotTex && wainscotH > 0 && wallY01 >= 0 && wallY01 <= 1 && (wallY01 * 8) <= wainscotH);
          const fracX = worldX - Math.floor(worldX);
          const fracY = worldY - Math.floor(worldY);
          const u01 = Math.abs(fracX) > Math.abs(fracY) ? fracY : fracX;

          if (wallProc && !useWainscot){
            const u = (u01 * wallProc.w * 2) / texRes;
            const v = ((1 - wallY01) * wallProc.h * 2) / texRes;
            return sampleProcNearest(wallProc, u, v);
          }

          const tex = useWainscot ? wainscotTex : wallTexDefault;
          if (!tex) return FIN_TEX_INTERNAL.packRgba(200, 0, 200, 255);
          const u = (u01 * tex.w * tex.worldRepeat) / texRes;
          const v = ((1 - wallY01) * tex.h * tex.worldRepeat) / texRes;
          return sampleFinishTexture(tex.id, u, v);
        }

        function drawColumn(x, y0, y1, colorToken){
          const xi = x | 0;
          if (xi < 0 || xi >= w) return;
          const yy0 = Math.max(0, y0 | 0);
          const yy1 = Math.min(vh - 1, y1 | 0);
          const packed = normalizePixelColor(colorToken);
          for (let y = yy0; y <= yy1; y++){
            buffer.pixels[y * w + xi] = packed;
          }
        }

        for (let x = 0; x < w; x += cs){
          const cam = x / w - 0.5;
          const ray = nYaw + cam * nFov;
          const rc = Math.cos(ray);
          const rs = Math.sin(ray);

          let bestD = md;
          let bestT = 0;
          for (let i = 1; i <= nSteps; i++){
            const d = i * st;
            const rx = nPx + rc * d;
            const ry = nPy + rs * d;
            const tt = sampleTile(Math.floor(rx), Math.floor(ry));
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
          const ambient = 0.34;
          const localLight = lightAt(hx, hy);
          const brightRaw = Math.max(0, Math.min(1, ambient + localLight - fog * 0.45));
          const bandIdx = Math.max(0, Math.min(lightingBands.length - 1, Math.round(brightRaw * (lightingBands.length - 1))));
          const bright = lightingBands[bandIdx];

          for (let dx = 0; dx < cs; dx++){
            const xi = x + dx;
            if (xi < 0 || xi >= w) continue;
            const xiCam = xi / w - 0.5;
            const xiRay = nYaw + xiCam * nFov;
            const xrc = Math.cos(xiRay);
            const xrs = Math.sin(xiRay);

            let lastFloorPacked = 0;
            let lastCeilPacked = 0;

            for (let y = 0; y < vh; y++){
              if (y >= y0 && y <= y1){
                const wallY01 = (y - y0) / Math.max(1, (y1 - y0));
                let packed = sampleWallTex(hx, hy, wallY01);
                packed = applyBrightnessToRgba(packed, bestT === 2 ? Math.max(0.1, bright * 0.9) : bright);
                buffer.pixels[y * w + xi] = rgbaBEToU32(packed);
                continue;
              }

              if (y > y1){
                if (!floorTex || floorStep <= 0){
                  continue;
                }
                if (lastFloorPacked === 0 || (y % floorStep) === 0){
                  const p = (y - (vh / 2)) / (vh / 2);
                  const rowDist = 1 / Math.max(0.0001, p);
                  const worldX = nPx + xrc * rowDist;
                  const worldY = nPy + xrs * rowDist;
                  let packed;
                  if (floorProc){
                    const u = ((worldX * 2) * floorProc.w) / texRes;
                    const v = ((worldY * 2) * floorProc.h) / texRes;
                    packed = sampleProcNearest(floorProc, u, v);
                  }else{
                    const u = ((worldX * floorTex.worldRepeat) * floorTex.w) / texRes;
                    const v = ((worldY * floorTex.worldRepeat) * floorTex.h) / texRes;
                    packed = sampleFinishTexture(floorTex.id, u, v);
                  }
                  const fFog = Math.max(0, Math.min(1, (rowDist - 1.6) / Math.max(0.001, (md - 1.6))));
                  const fBrightRaw = useCoarsePath ? Math.max(0, Math.min(1, ambient - fFog * 0.55)) : Math.max(0, Math.min(1, ambient + lightAt(worldX, worldY) - fFog * 0.55));
                  const fBand = Math.max(0, Math.min(lightingBands.length - 1, Math.round(fBrightRaw * (lightingBands.length - 1))));
                  const fBright = lightingBands[fBand];
                  packed = applyBrightnessToRgba(packed, fBright * 0.9);
                  lastFloorPacked = rgbaBEToU32(packed);
                }
                buffer.pixels[y * w + xi] = lastFloorPacked;
                continue;
              }

              if (y < y0){
                if (!ceilTex || ceilStep <= 0){
                  continue;
                }
                if (lastCeilPacked === 0 || (y % ceilStep) === 0){
                  const p = ((vh / 2) - y) / (vh / 2);
                  const rowDist = 1 / Math.max(0.0001, p);
                  const worldX = nPx + xrc * rowDist;
                  const worldY = nPy + xrs * rowDist;
                  let packed;
                  if (ceilProc){
                    const u = ((worldX * 2) * ceilProc.w) / texRes;
                    const v = ((worldY * 2) * ceilProc.h) / texRes;
                    packed = sampleProcNearest(ceilProc, u, v);
                  }else{
                    const u = ((worldX * ceilTex.worldRepeat) * ceilTex.w) / texRes;
                    const v = ((worldY * ceilTex.worldRepeat) * ceilTex.h) / texRes;
                    packed = sampleFinishTexture(ceilTex.id, u, v);
                  }
                  const cFog = Math.max(0, Math.min(1, (rowDist - 1.6) / Math.max(0.001, (md - 1.6))));
                  const cBrightRaw = useCoarsePath ? Math.max(0, Math.min(1, ambient - cFog * 0.55)) : Math.max(0, Math.min(1, ambient + lightAt(worldX, worldY) - cFog * 0.55));
                  const cBand = Math.max(0, Math.min(lightingBands.length - 1, Math.round(cBrightRaw * (lightingBands.length - 1))));
                  const cBright = lightingBands[cBand];
                  packed = applyBrightnessToRgba(packed, cBright * 0.95);
                  lastCeilPacked = rgbaBEToU32(packed);
                }
                buffer.pixels[y * w + xi] = lastCeilPacked;
                continue;
              }
            }
          }
        }

        markGfxDirty();
        loopState.stageMs.raycastMs += (nowMs() - stageStart);
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
      txt: defFn("txt", -1, {
        args: [
          { label: "x", kinds: ["scalar"] },
          { label: "y", kinds: ["scalar"] },
          { label: "text", kinds: ["string"] },
          { label: "color", kinds: ["string", "scalar"] },
          { label: "scale", kinds: ["scalar"] },
        ],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (x, y, text, color, scale) => {
        const buffer = requireGfxBuffer();
        const sc = (scale === undefined || scale === null) ? 1 : scale;
        drawText(buffer, x, y, String(text || ""), normalizeGfxColor(color), sc);
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
        const stageStart = nowMs();
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
        const tqOverride = normalizeTurboQuantProfileName(state.vars?.doom_tq_profile || "auto");
        if (tqOverride === "auto"){
          turboQuantState.mode = "auto";
        }else{
          turboQuantState.mode = "manual";
          turboQuantState.profile = tqOverride;
          turboQuantState.effectiveProfile = tqOverride;
        }
        const tqProfileName = turboQuantState.mode === "auto" ? turboQuantState.effectiveProfile : turboQuantState.profile;
        const tqProfile = getTurboQuantProfileConfig(tqProfileName);
        const falloffLut = buildFalloffLut(tqProfileName);
        const lightingBands = buildLightingBands(tqProfileName);
        const pressure = Number.isFinite(state.vars?.doom_tq_pressure) ? (state.vars.doom_tq_pressure | 0) : 0;
        const useCoarsePath = tqProfile.coarseShading || pressure > 0;
        const nSteps = Math.max(1, Math.floor(nStepsIn * tqProfile.rayStepsMul));
        const cs = Math.max(1, Math.floor(nColStep * tqProfile.colStepMul));

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
          const packed = normalizePixelColor(color);
          for (let y = yy0; y <= yy1; y++){
            buffer.pixels[y * w + xi] = packed;
          }
        }

        const isSpriteTile = (t) => t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10 || t === 11 || t === 12 || t === 13 || t === 16 || t === 17 || t === 18 || t === 19;

        function lightAt(worldX, worldY){
          const cx = Math.floor(worldX);
          const cy = Math.floor(worldY);
          let light = 0;

          const paramsForTile = (tt) => {
            if (tt === 8) return { i: 1.10, f: 0.85, p: 1.00 };
            if (tt === 12) return { i: 0.95, f: 0.90, p: 1.00 };
            if (tt === 13) return { i: 1.20, f: 1.25, p: 1.08 };
            if (tt === 16) return { i: 1.00, f: 0.95, p: 1.00 };
            if (tt === 17) return { i: 1.45, f: 1.05, p: 1.05 };
            if (tt === 18) return { i: 0.90, f: 1.15, p: 1.12 };
            if (tt === 19) return { i: 0.35, f: 1.60, p: 1.20 };
            if (tt === 9) return { i: 0.85, f: 1.10, p: 1.05 };
            return null;
          };

          const isOccluded = (lx, ly, wx, wy) => {
            if (!tqProfile.allowSecondary || tqProfile.occlusionChecks <= 0) return false;
            const dx = wx - lx;
            const dy = wy - ly;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!(dist > 0.75)) return false;
            const steps = Math.min(tqProfile.occlusionChecks, Math.max(2, Math.ceil(dist / 0.25)));
            const inv = 1 / steps;
            for (let i = 1; i < steps; i++){
              const sx = lx + dx * (i * inv);
              const sy = ly + dy * (i * inv);
              const tt = sampleTile(Math.floor(sx), Math.floor(sy));
              if (tt === 1 || tt === 2) return true;
            }
            return false;
          };

          const r = tqProfile.lightSamples;
          for (let oy = -r; oy <= r; oy++){
            const ty = cy + oy;
            if (ty < 0 || ty >= mapH) continue;
            for (let ox = -r; ox <= r; ox++){
              const tx = cx + ox;
              if (tx < 0 || tx >= mapW) continue;
              const tt = data[ty * mapW + tx] | 0;
              const lp = paramsForTile(tt);
              if (!lp) continue;
              const lx = tx + 0.5;
              const ly = ty + 0.5;
              const dx = worldX - lx;
              const dy = worldY - ly;
              const d2 = dx * dx + dy * dy;
              if (isOccluded(lx, ly, worldX, worldY)) continue;
              const lutIndex = Math.max(0, Math.min(falloffLut.length - 1, (d2 * (22 * lp.f)) | 0));
              light += lp.i * falloffLut[lutIndex];
            }
          }
          return light;
        }

        function shadeByBrightness(bright, base){
          if (base === "warn"){
            if (bright < 0.22) return "warn";
            if (bright < 0.68) return "warn";
            return "text";
          }
          if (bright < 0.20) return "accent-2";
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
          const ambient = 0.34;
          const localLight = useCoarsePath ? 0 : lightAt(hx, hy);
          const brightRaw = Math.max(0, Math.min(1, ambient + localLight - fog * 0.45));
          const texJitter = (((Math.floor(hx * 3) + Math.floor(hy * 2)) & 1) ? 0.08 : 0);
          const brightBase = Math.max(0, Math.min(1, brightRaw - texJitter));
          const brightBand = Math.max(0, Math.min(lightingBands.length - 1, Math.round(brightBase * (lightingBands.length - 1))));
          const brightTex = lightingBands[brightBand];
          const base = bestT === 2 ? "warn" : "accent";
          const shade = shadeByBrightness(brightTex, base);
          for (let dx = 0; dx < cs; dx++){
            drawColumn(x + dx, y0, y1, shade);
          }

          const spriteCorr = spriteD * Math.cos(ray - nYaw);
          if (tqProfile.allowSecondary && spriteT !== 0 && spriteCorr > 0.1 && spriteCorr < dd){
            const sd = Math.max(0.25, spriteCorr);
            const sh = Math.floor(vh / sd);
            const sy0 = Math.floor((vh - sh) / 2);
            const sy1 = sy0 + sh;
            const sx = nPx + rc * spriteD;
            const sy = nPy + rs * spriteD;
            const sFog = Math.max(0, Math.min(1, (spriteD - 1.2) / Math.max(0.001, (md - 1.2))));
            const sBrightRaw = Math.max(0, Math.min(1, 0.34 + lightAt(sx, sy) - sFog * 0.45));
            const sBand = Math.max(0, Math.min(lightingBands.length - 1, Math.round(sBrightRaw * (lightingBands.length - 1))));
            const sBright = lightingBands[sBand];
            const spriteColor = (() => {
              if (spriteT === 5) return shadeByBrightness(sBright, "err");
              if (spriteT === 6) return shadeByBrightness(sBright, "ok");
              if (spriteT === 7) return shadeByBrightness(sBright, "accent-2");
              if (spriteT === 3) return shadeByBrightness(sBright, "warn");
              if (spriteT === 4) return shadeByBrightness(sBright, "ok");
              if (spriteT === 8 || spriteT === 9 || spriteT === 12 || spriteT === 13 || spriteT === 16 || spriteT === 17 || spriteT === 18 || spriteT === 19) return shadeByBrightness(sBright, "warn");
              if (spriteT === 10 || spriteT === 11) return shadeByBrightness(sBright, "accent");
              return shadeByBrightness(sBright, "accent");
            })();
            for (let dx = 0; dx < cs; dx++){
              drawColumn(x + dx, sy0, sy1, spriteColor);
            }
          }
        }
        markGfxDirty();
        loopState.stageMs.raycastMs += (nowMs() - stageStart);
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
      tqprofile: defFn("tqprofile", 1, {
        args: [{ label: "name", kinds: ["string"] }],
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, (name) => setTurboQuantProfile(name)),
      tqstate: defFn("tqstate", 0, {
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, () => `mode=${turboQuantState.mode}; profile=${turboQuantState.profile}; effective=${turboQuantState.effectiveProfile}; pressure=${turboQuantState.pressure}`),
      budgetpolicy: defFn("budgetpolicy", 1, {
        args: [{ label: "name", kinds: ["string"] }],
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, (name) => {
        const normalized = String(name || "").trim().toLowerCase();
        return applyBudgetPolicyPreset(normalized);
      }),
      budgethud: defFn("budgethud", 1, {
        args: [{ label: "enabled", kinds: ["scalar"] }],
        returns: { kinds: ["scalar"] },
        effects: EFFECT.IO_GFX,
      }, (enabled) => {
        const mgr = getBudgetManager();
        const value = isQty(enabled) ? enabled.value : enabled;
        mgr.debugHud = Number(value) > 0;
        markGfxDirty();
        return mgr.debugHud ? 1 : 0;
      }),
      budgetstats: defFn("budgetstats", 0, {
        returns: { kinds: ["string"] },
        effects: EFFECT.IO_GFX,
      }, () => {
        const mgr = getBudgetManager();
        const tel = mgr.telemetry || {};
        return [
          `policy=${mgr.policyPreset || "balanced"}`,
          `quality=${mgr.qualityTier || "balanced"}`,
          `cpuMsPerFrame=${Number(mgr.cpuMsPerFrame || 0).toFixed(2)}`,
          `traversalExpandMs=${Number(tel.traversalExpandMs || 0).toFixed(3)}`,
          `raycastMs=${Number(tel.raycastMs || 0).toFixed(3)}`,
          `upscaleMs=${Number(tel.upscaleMs || 0).toFixed(3)}`,
          `temporalBlendMs=${Number(tel.temporalBlendMs || 0).toFixed(3)}`,
          `frameMs=${Number(tel.totalFrameMs || 0).toFixed(3)}`,
          `headroomMs=${Number(tel.frameHeadroomMs || 0).toFixed(3)}`,
          `memory=${Math.round(Number(tel.memoryUsedBytes || 0))}/${Math.round(Number(tel.memoryLimitBytes || 0))}`,
        ].join("; ");
      }),
    };
  }

  try{
    applyBudgetPolicyPreset(getBudgetManager().policyPreset || "balanced");
  }catch{
    // Keep startup resilient if presets are partially configured.
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
    setTurboQuantProfile,
    getTurboQuantState: () => ({ ...turboQuantState }),
    setActiveBackend,
    setRunExpressionWithContext,
    setRunLoopStatementRunner,
    setProgramSourceParser,
    handleGfxKeydown,
    getBuffer: () => state.gfx,
    getCanvas: () => state.gfx?.canvasEl || null,
    markDirty: markGfxDirty,
    initBuffer: (width, height, scale = GFX_DEFAULT_SCALE) => {
      const w = normalizeGfxDimension(width, "width");
      const h = normalizeGfxDimension(height, "height");
      state.gfx = resizeGfxBuffer(state.gfx, w, h, normalizeGfxScale(scale));
      setInternalRenderScale(state.gfx, 1);
      markGfxDirty();
      flushGfxOutput();
      return state.gfx;
    },
  };
}
