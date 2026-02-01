import { splitStatements } from "./repl-parser.js";
import { isQty } from "./repl-units.js";

const GFX_LIMIT = 160;
const GFX_DEFAULT_SCALE = 6;
const GFX_LOOP_DEFAULT_FPS = 12;
const GFX_LOOP_MIN_FPS = 1;
const GFX_LOOP_MAX_FPS = 60;
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
      canvas.className = "gfx-canvas";
      canvas.tabIndex = 0;
      canvas.setAttribute("role", "application");
      canvas.setAttribute("aria-label", "GFX canvas");
      canvas.addEventListener("pointerdown", () => canvas.focus());
      canvas.addEventListener("keydown", (event) => {
        if (handleGfxKeydown(event)){
          event.preventDefault();
        }
      });
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

    const loopLabel = loopState.expr
      ? ` • loop ${loopState.playing ? "playing" : "paused"} @ ${loopState.fps} fps • frame ${loopState.frame}`
      : "";
    label.textContent = `gfx ${buffer.width}x${buffer.height} • scale ${buffer.scale}${loopLabel}`;
    hint.textContent = loopState.expr
      ? "Space play/pause • ←/→ step • ↑/↓ speed • R reset"
      : "";
    if (buffer.bg && buffer.bg !== "transparent"){
      panel.style.setProperty("--gfx-bg", `var(--${buffer.bg})`);
    }else{
      panel.style.removeProperty("--gfx-bg");
    }
    if (canvas.width !== buffer.width) canvas.width = buffer.width;
    if (canvas.height !== buffer.height) canvas.height = buffer.height;
    canvas.style.width = `${buffer.width * buffer.scale}px`;
    canvas.style.height = `${buffer.height * buffer.scale}px`;
    const ctx = canvas.getContext("2d");
    if (ctx){
      ctx.imageSmoothingEnabled = false;
      const imageData = ctx.createImageData(buffer.width, buffer.height);
      const data = imageData.data;
      const palette = getGfxPalette();
      for (let i = 0; i < buffer.pixels.length; i++){
        const color = buffer.pixels[i] || "transparent";
        const rgba = palette[color] || palette.transparent;
        const offset = i * 4;
        data[offset] = rgba[0];
        data[offset + 1] = rgba[1];
        data[offset + 2] = rgba[2];
        data[offset + 3] = rgba[3];
      }
      ctx.putImageData(imageData, 0, 0);
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
      width,
      height,
      scale,
      pixels: Array.from({ length: width * height }, () => null),
      bg: null,
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
    for (const stmt of statements){
      if (!stmt) continue;
      if (stmt.trim().startsWith("#")) continue;
      if (runLoopStatement){
        runLoopStatement(stmt);
      }else{
        runExpressionWithContext(stmt, state.vars);
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
      toggleLoop();
      return true;
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
      gfx: defFn("gfx", 2, (width, height) => {
        const w = normalizeGfxDimension(width, "width");
        const h = normalizeGfxDimension(height, "height");
        state.gfx = createGfxBuffer(w, h, GFX_DEFAULT_SCALE);
        markGfxDirty();
        return `gfx ${w}x${h}`;
      }),
      gfxs: defFn("gfxs", 1, (scale) => {
        const buffer = requireGfxBuffer();
        buffer.scale = normalizeGfxScale(scale);
        markGfxDirty();
        return buffer.scale;
      }),
      cls: defFn("cls", 0, () => {
        const buffer = requireGfxBuffer();
        buffer.pixels.fill(null);
        buffer.bg = null;
        markGfxDirty();
        return 1;
      }),
      bg: defFn("bg", 1, (color) => {
        const buffer = requireGfxBuffer();
        buffer.bg = normalizeGfxColor(color);
        markGfxDirty();
        return buffer.bg || "transparent";
      }),
      pix: defFn("pix", 3, (x, y, color) => {
        const buffer = requireGfxBuffer();
        setPixel(buffer, x, y, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      line: defFn("line", 5, (x0, y0, x1, y1, color) => {
        const buffer = requireGfxBuffer();
        drawLine(buffer, x0, y0, x1, y1, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      rect: defFn("rect", 5, (x, y, w, h, color) => {
        const buffer = requireGfxBuffer();
        drawRect(buffer, x, y, w, h, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      fill: defFn("fill", 5, (x, y, w, h, color) => {
        const buffer = requireGfxBuffer();
        fillRect(buffer, x, y, w, h, normalizeGfxColor(color));
        markGfxDirty();
        return 1;
      }),
      plot: defFn("plot", 4, (x0, y0, points, color) => {
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
      gfxloop: defFn("gfxloop", 1, (expr) => {
        configureLoop(expr);
        return "gfx loop ready";
      }),
      gfxplay: defFn("gfxplay", 0, () => {
        playLoop();
        return 1;
      }),
      gfxpause: defFn("gfxpause", 0, () => {
        pauseLoop();
        return 1;
      }),
      gfxstep: defFn("gfxstep", 1, (count) => {
        const steps = Math.round(isQty(count) ? count.value : count);
        if (!Number.isFinite(steps)) throw new Error("gfxstep expects a numeric step");
        advanceLoop(steps);
        return loopState.frame;
      }),
      gfxrewind: defFn("gfxrewind", 1, (count) => {
        const steps = Math.round(isQty(count) ? count.value : count);
        if (!Number.isFinite(steps)) throw new Error("gfxrewind expects a numeric step");
        advanceLoop(-steps);
        return loopState.frame;
      }),
      gfxfps: defFn("gfxfps", 1, (fps) => setLoopFps(fps)),
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
