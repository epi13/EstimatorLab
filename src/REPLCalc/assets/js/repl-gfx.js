import { isQty } from "./repl-units.js";

const GFX_LIMIT = 160;
const GFX_DEFAULT_SCALE = 6;
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

export function createGfxTools({ state, terminalEl }){
  let gfxPaletteCache = null;
  let gfxColorContext = null;

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
    const wrapper = document.createElement("div");
    wrapper.className = "line gfx-line";
    const label = document.createElement("div");
    label.className = "gfx-label";
    label.textContent = `gfx ${buffer.width}x${buffer.height} • scale ${buffer.scale}`;
    const panel = document.createElement("div");
    panel.className = "gfx-panel";
    if (buffer.bg && buffer.bg !== "transparent"){
      panel.style.setProperty("--gfx-bg", `var(--${buffer.bg})`);
    }
    const canvas = document.createElement("canvas");
    canvas.className = "gfx-canvas";
    canvas.width = buffer.width;
    canvas.height = buffer.height;
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
    panel.appendChild(canvas);
    wrapper.append(label, panel);
    terminalEl.appendChild(wrapper);
    terminalEl.scrollTop = terminalEl.scrollHeight;
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
    };
  }

  return {
    buildGfxMetaFns,
    flushGfxOutput,
  };
}
