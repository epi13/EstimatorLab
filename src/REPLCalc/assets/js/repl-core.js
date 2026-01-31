import { createBaseFns, defFn } from "./repl-builtins.js";
import { buildAliasMap, evalRPN, insertImplicitMultiplication, isTruthy, normalizeCompare, tokenize, toRPN } from "./repl-expression.js";
import { UNIT, formatResult, isQty, isUnitToken, makeQty, qtyToString } from "./repl-units.js";

export function initRepl(){
  // -----------------------------
  // Terminal UI
  // -----------------------------
  const terminalEl = document.getElementById('terminal');
  const inputEl = document.getElementById('replInput');
  const highlightEl = document.getElementById('replHighlight');
  const autocompleteEl = document.getElementById('autocomplete');
  const liveResultEl = document.getElementById('liveResult');
  const statusPill = document.getElementById('statusPill');
  const hintRight = document.getElementById('hintRight');

  const btnHelp = document.getElementById('btnHelp');
  const btnClear = document.getElementById('btnClear');
  const btnVars = document.getElementById('btnVars');
  const btnMethods = document.getElementById('btnMethods');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const btnReset = document.getElementById('btnReset');

  const fnNameInput = document.getElementById('fnName');
  const fnParamsInput = document.getElementById('fnParams');
  const fnExprInput = document.getElementById('fnExpr');
  const btnFnSave = document.getElementById('btnFnSave');
  const btnFnClear = document.getElementById('btnFnClear');
  const userFnList = document.getElementById('userFnList');
  const userFnEmpty = document.getElementById('userFnEmpty');

  function nowStamp(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function writeLine(text, cls="out"){
    const p = document.createElement('p');
    p.className = `line ${cls}`;
    p.textContent = text;
    terminalEl.appendChild(p);
    terminalEl.scrollTop = terminalEl.scrollHeight;
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

  let gfxPaletteCache = null;
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

  function writeLineRich(parts, cls="out"){
    const p = document.createElement("p");
    p.className = `line ${cls}`;
    for (const part of parts){
      if (typeof part === "string"){
        p.appendChild(document.createTextNode(part));
        continue;
      }
      const span = document.createElement("span");
      span.className = part.className;
      span.textContent = part.text;
      p.appendChild(span);
    }
    terminalEl.appendChild(p);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function token(text, className){
    return { text, className };
  }

  function writeInputEcho(text){
    const p = document.createElement('p');
    p.className = 'line';
    p.innerHTML = `<span class="prompt">est&gt;</span> <span class="input"></span>`;
    p.querySelector('.input').textContent = text;
    terminalEl.appendChild(p);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function setStatus(text, kind="ok"){
    statusPill.textContent = text;
    statusPill.style.color = (kind==="err") ? "var(--err)"
      : (kind==="warn") ? "var(--warn)"
      : "var(--muted)";
  }

  // -----------------------------
  // State
  // -----------------------------
  const state = {
    vars: Object.create(null),
    history: [],
    histIdx: -1,
    theme: "default",
    userFns: Object.create(null),
    gfx: null,
    gfxDirty: false,
  };

  const KEYWORDS = new Set(["if", "else", "for", "in", "step", "repeat", "def", "fn", "function", "assy"]);
  const baseFns = createBaseFns();
  const metaFns = Object.create(null);
  const GFX_LIMIT = 160;
  const GFX_DEFAULT_SCALE = 6;
  const GFX_COLOR_TOKENS = [
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

  function normalizeMetaName(value, label){
    if (typeof value !== "string") throw new Error(`${label} expects a string name`);
    const name = value.trim();
    if (!name) throw new Error(`${label} expects a non-empty name`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid name: ${name}`);
    return name;
  }

  function normalizeMetaParams(value){
    if (typeof value !== "string") throw new Error("define expects params as a string");
    return parseParams(value);
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

  metaFns.eval = defFn("eval", 1, (expr) => {
    if (typeof expr !== "string") throw new Error("eval expects a string expression");
    return runExpressionWithContext(expr, state.vars);
  });
  metaFns.get = defFn("get", 1, (name) => {
    const key = normalizeMetaName(name, "get");
    if (!Object.prototype.hasOwnProperty.call(state.vars, key)) throw new Error(`Unknown variable: ${key}`);
    return state.vars[key];
  });
  metaFns.set = defFn("set", 2, (name, value) => {
    const key = normalizeMetaName(name, "set");
    state.vars[key] = value;
    return value;
  });
  metaFns.unset = defFn("unset", 1, (name) => {
    const key = normalizeMetaName(name, "unset");
    const existed = Object.prototype.hasOwnProperty.call(state.vars, key);
    if (existed) delete state.vars[key];
    return existed ? 1 : 0;
  });
  metaFns.vars = defFn("vars", 0, () => Object.keys(state.vars).sort().join(", "));
  metaFns.methods = defFn("methods", 0, () => Object.keys(state.userFns).sort().join(", "));
  metaFns.define = defFn("define", 3, (name, params, expr) => {
    const fnName = normalizeMetaName(name, "define");
    const paramList = normalizeMetaParams(params);
    if (typeof expr !== "string") throw new Error("define expects an expression string");
    defineUserFn(fnName, paramList, expr);
    return fnName;
  });
  metaFns.undefine = defFn("undefine", 1, (name) => {
    const fnName = normalizeMetaName(name, "undefine");
    if (!Object.prototype.hasOwnProperty.call(state.userFns, fnName)) return 0;
    delete state.userFns[fnName];
    renderUserFunctions();
    return 1;
  });
  metaFns.gfx = defFn("gfx", 2, (width, height) => {
    const w = normalizeGfxDimension(width, "width");
    const h = normalizeGfxDimension(height, "height");
    state.gfx = createGfxBuffer(w, h, GFX_DEFAULT_SCALE);
    markGfxDirty();
    return `gfx ${w}x${h}`;
  });
  metaFns.gfxs = defFn("gfxs", 1, (scale) => {
    const buffer = requireGfxBuffer();
    buffer.scale = normalizeGfxScale(scale);
    markGfxDirty();
    return buffer.scale;
  });
  metaFns.cls = defFn("cls", 0, () => {
    const buffer = requireGfxBuffer();
    buffer.pixels.fill(null);
    buffer.bg = null;
    markGfxDirty();
    return 1;
  });
  metaFns.bg = defFn("bg", 1, (color) => {
    const buffer = requireGfxBuffer();
    buffer.bg = normalizeGfxColor(color);
    markGfxDirty();
    return buffer.bg || "transparent";
  });
  metaFns.pix = defFn("pix", 3, (x, y, color) => {
    const buffer = requireGfxBuffer();
    setPixel(buffer, x, y, normalizeGfxColor(color));
    markGfxDirty();
    return 1;
  });
  metaFns.line = defFn("line", 5, (x0, y0, x1, y1, color) => {
    const buffer = requireGfxBuffer();
    drawLine(buffer, x0, y0, x1, y1, normalizeGfxColor(color));
    markGfxDirty();
    return 1;
  });
  metaFns.rect = defFn("rect", 5, (x, y, w, h, color) => {
    const buffer = requireGfxBuffer();
    drawRect(buffer, x, y, w, h, normalizeGfxColor(color));
    markGfxDirty();
    return 1;
  });
  metaFns.fill = defFn("fill", 5, (x, y, w, h, color) => {
    const buffer = requireGfxBuffer();
    fillRect(buffer, x, y, w, h, normalizeGfxColor(color));
    markGfxDirty();
    return 1;
  });
  metaFns.plot = defFn("plot", 4, (x0, y0, points, color) => {
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
  });

  // -----------------------------
  // Command handling
  // -----------------------------
  function showHelp(){
    writeLine("Estimator REPL help", "ok");
    writeLineRich([
      token("Math:", "out-label"),
      " ",
      token("+  -  *  /  ^  ( )", "out-op"),
      " comparisons ",
      token("(== != < <= > >=)", "out-op"),
      " and logic ",
      token("(&& ||)", "out-op")
    ], "muted");
    writeLineRich([
      token("Variables:", "out-label"),
      " ",
      token("x", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("12.5", "out-number"),
      "   |   use: ",
      token("x", "out-var"),
      token("*", "out-op"),
      token("3", "out-number")
    ], "muted");
    writeLineRich([
      token("Functions:", "out-label"),
      " ",
      token("def", "out-keyword"),
      token("|", "out-op"),
      token("fn", "out-keyword"),
      token("|", "out-op"),
      token("function", "out-keyword"),
      " ",
      token("name", "out-fn"),
      token("(", "out-op"),
      token("a,b", "out-var"),
      token(")", "out-op"),
      " = expression (redefine to edit)"
    ], "muted");
    writeLineRich([
      token("Flow:", "out-label"),
      " ",
      token("if", "out-keyword"),
      " condition: expr [",
      token("else", "out-keyword"),
      ": expr]"
    ], "muted");
    writeLineRich([
      token("Loop:", "out-label"),
      " ",
      token("for", "out-keyword"),
      " i ",
      token("in", "out-keyword"),
      " ",
      token("1..5", "out-number"),
      " ",
      token("step", "out-keyword"),
      " ",
      token("1", "out-number"),
      ": expr   |   ",
      token("repeat", "out-keyword"),
      " ",
      token("3", "out-number"),
      ": expr"
    ], "muted");
    writeLineRich([
      token("Strings:", "out-label"),
      " ",
      token("\"text\"", "out-string"),
      " or ",
      token("'text'", "out-string"),
      " (used for meta commands like ",
      token("eval", "out-fn"),
      "/",
      token("set", "out-fn"),
      ")"
    ], "muted");
    writeLineRich([
      token("Units:", "out-label"),
      " ",
      token("in, ft, lf, yd, sf, sy, cf, cy, lb, ton, layer", "out-unit"),
      " (use like: ",
      token("12", "out-number"),
      " ",
      token("ft", "out-unit"),
      " + ",
      token("6", "out-number"),
      " ",
      token("in", "out-unit"),
      ")"
    ], "muted");
    writeLineRich([
      token("Assemblies:", "out-label"),
      " ",
      token("assy", "out-keyword"),
      " ",
      token("wall", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("{", "out-op"),
      " ",
      token("studs", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("16 in o.c.", "out-number"),
      "; ",
      token("height", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("10 ft", "out-number"),
      "; ",
      token("sheathing", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("1 layer", "out-number"),
      " ",
      token("}", "out-op"),
      "  |  ",
      token("qty", "out-fn"),
      token("(wall, 120 lf)", "out-op")
    ], "muted");
    writeLineRich([
      token("Solve:", "out-label"),
      " expr ",
      token("=", "out-op"),
      " expr (one unknown variable, ex: ",
      token("56", "out-number"),
      " ",
      token("cy", "out-unit"),
      " ",
      token("=", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(", "out-op"),
      token("sf", "out-unit"),
      ", ",
      token("6", "out-number"),
      " ",
      token("in", "out-unit"),
      token(")", "out-op"),
      ")"
    ], "muted");
    writeLineRich([
      token("Editor:", "out-label"),
      " autocomplete, syntax highlight, and live preview while typing"
    ], "muted");
    writeLineRich([
      token("Tip:", "out-label"),
      " Enter runs when complete; Enter adds new line if incomplete."
    ], "muted");
    writeLineRich([
      token("Meta:", "out-label"),
      " ",
      token("eval", "out-fn"),
      token("(", "out-op"),
      token("\"expr\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("set", "out-fn"),
      token("(", "out-op"),
      token("\"x\"", "out-string"),
      token(", ", "out-op"),
      token("5", "out-number"),
      token(")", "out-op"),
      " ",
      token("get", "out-fn"),
      token("(", "out-op"),
      token("\"x\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("unset", "out-fn"),
      token("(", "out-op"),
      token("\"x\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("vars()", "out-fn"),
      " ",
      token("methods()", "out-fn")
    ], "muted");
    writeLineRich([
      token("Meta:", "out-label"),
      " ",
      token("define", "out-fn"),
      token("(", "out-op"),
      token("\"fn\"", "out-string"),
      ", ",
      token("\"a,b\"", "out-string"),
      ", ",
      token("\"a+b\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("undefine", "out-fn"),
      token("(", "out-op"),
      token("\"fn\"", "out-string"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      token("Graphics:", "out-label"),
      " ",
      token("gfx", "out-fn"),
      token("(w,h)", "out-op"),
      " ",
      token("pix", "out-fn"),
      token("(x,y,color)", "out-op"),
      " ",
      token("line", "out-fn"),
      token("(x0,y0,x1,y1,color)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("rect", "out-fn"),
      token("(x,y,w,h,color)", "out-op"),
      " ",
      token("fill", "out-fn"),
      token("(x,y,w,h,color)", "out-op"),
      " ",
      token("plot", "out-fn"),
      token("(x,y,\"dx,dy|...\",color)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("bg", "out-fn"),
      token("(color)", "out-op"),
      " ",
      token("gfxs", "out-fn"),
      token("(scale)", "out-op"),
      " ",
      token("cls()", "out-fn"),
      "  colors: ",
      token(GFX_COLOR_TOKENS.join(", "), "out-unit")
    ], "muted");
    writeLineRich([token("Commands:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token(":help", "out-command"),
      "                show help"
    ], "muted");
    writeLineRich([
      "  ",
      token(":docs", "out-command"),
      "                detailed docs + examples"
    ], "muted");
    writeLineRich([
      "  ",
      token(":clear", "out-command"),
      "               clear terminal output"
    ], "muted");
    writeLineRich([
      "  ",
      token(":vars", "out-command"),
      "                list variables"
    ], "muted");
    writeLineRich([
      "  ",
      token(":methods", "out-command"),
      "             list user methods"
    ], "muted");
    writeLineRich([
      "  ",
      token(":reset", "out-command"),
      "               reset vars + history"
    ], "muted");
    writeLineRich([
      "  ",
      token(":save", "out-command"),
      " name          save session profile"
    ], "muted");
    writeLineRich([
      "  ",
      token(":load", "out-command"),
      " name          load saved profile"
    ], "muted");
    writeLineRich([
      "  ",
      token(":profiles", "out-command"),
      "            list saved profiles"
    ], "muted");
    writeLineRich([
      "  ",
      token(":export", "out-command"),
      "              copy session JSON to clipboard"
    ], "muted");
    writeLineRich([
      "  ",
      token(":import", "out-command"),
      "              load session JSON from clipboard"
    ], "muted");
    writeLineRich([
      "  ",
      token(":theme", "out-command"),
      " ",
      token("default", "out-keyword"),
      token("|", "out-op"),
      token("amber", "out-keyword"),
      token("|", "out-op"),
      token("matrix", "out-keyword")
    ], "muted");
    writeLineRich([
      "  ",
      token(":test", "out-command"),
      "                run the built-in test suite"
    ], "muted");
    writeLineRich([token("Functions:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("waste", "out-fn"),
      token("(qty,pct)", "out-op"),
      "  ",
      token("markup", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("burden", "out-fn"),
      token("(labor,pct)", "out-op"),
      "  ",
      token("unit", "out-fn"),
      token("(cost,qty)", "out-op"),
      "  ",
      token("qty", "out-fn"),
      token("(assy,len)", "out-op"),
      "  ",
      token("round_up", "out-fn"),
      token("(x,step)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("area_rect", "out-fn"),
      token("(a,b)", "out-op"),
      " ",
      token("area_circle", "out-fn"),
      token("(diam)", "out-op"),
      " ",
      token("vol_rect", "out-fn"),
      token("(area,thk_in)", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(area,thk_in)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("bf", "out-fn"),
      token("(t_in,w_in,len_ft,qty)", "out-op"),
      "  ",
      token("pipe_wt", "out-fn"),
      token("(nps_in,schedule,len_ft)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("to_in", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_ft", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_sf", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_sy", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_cf", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_cy", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_lb", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_ton", "out-fn"),
      token("(x)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("abs min max round ceil floor sqrt pow exp log log10 sin cos tan atan2 clamp if", "out-keyword")
    ], "muted");
    writeLineRich([token("Examples:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("slab", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(", "out-op"),
      token("1200", "out-number"),
      " ",
      token("sf", "out-unit"),
      ", ",
      token("4", "out-number"),
      " ",
      token("in", "out-unit"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("total", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("markup", "out-fn"),
      token("(", "out-op"),
      token("burden", "out-fn"),
      token("(", "out-op"),
      token("12500", "out-number"),
      ", ",
      token("16.7", "out-number"),
      token(")", "out-op"),
      ", ",
      token("35", "out-number"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("waste", "out-fn"),
      token("(", "out-op"),
      token("500", "out-number"),
      " ",
      token("sf", "out-unit"),
      ", ",
      token("10", "out-number"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("fn", "out-keyword"),
      " ",
      token("crew_cost", "out-fn"),
      token("(", "out-op"),
      token("rate, hours", "out-var"),
      token(")", "out-op"),
      " ",
      token("=", "out-op"),
      " ",
      token("rate", "out-var"),
      " ",
      token("*", "out-op"),
      " ",
      token("hours", "out-var")
    ], "muted");
    writeLineRich([
      "  ",
      token("for", "out-keyword"),
      " i ",
      token("in", "out-keyword"),
      " ",
      token("1..4", "out-number"),
      ": ",
      token("total", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("total", "out-var"),
      " ",
      token("+", "out-op"),
      " i"
    ], "muted");
    writeLineRich([
      "  ",
      token("if", "out-keyword"),
      " ",
      token("labor", "out-var"),
      " ",
      token(">", "out-op"),
      " ",
      token("40", "out-number"),
      ": ",
      token("overtime", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("labor", "out-var"),
      " ",
      token("-", "out-op"),
      " ",
      token("40", "out-number"),
      " ",
      token("else", "out-keyword"),
      ": ",
      token("overtime", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("0", "out-number")
    ], "muted");
  }

  function showDocs(){
    writeLine("Estimator REPL docs", "ok");
    writeLineRich([token("Overview:", "out-label")], "muted");
    writeLineRich(["  This REPL mixes calculator math with takeoff helpers, units, and quick scripting."], "muted");
    writeLineRich(["  Use it for one-off computations or build up a session with variables + methods."], "muted");
    writeLineRich([token("Syntax quickstart:", "out-label")], "muted");
    writeLineRich([
      "  Expressions: ",
      token("2+2*5", "out-op"),
      "  |  ",
      token("(1200 sf * 4 in) / 27", "out-op"),
      "  |  ",
      token("pow", "out-fn"),
      token("(3,2)", "out-op")
    ], "muted");
    writeLineRich([
      "  Assignment: ",
      token("x", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("144", "out-number"),
      "  |  ",
      token("total", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("markup", "out-fn"),
      token("(burden(12500, 16.7), 35)", "out-op")
    ], "muted");
    writeLineRich([
      "  Functions: ",
      token("fn", "out-keyword"),
      " ",
      token("name", "out-fn"),
      token("(a,b)", "out-op"),
      " = expression  (call with ",
      token("name(1,2)", "out-op"),
      ")"
    ], "muted");
    writeLineRich([
      "  Flow: ",
      token("if", "out-keyword"),
      " ",
      token("labor", "out-var"),
      " ",
      token(">", "out-op"),
      " ",
      token("40", "out-number"),
      ": ",
      token("overtime", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("labor", "out-var"),
      " ",
      token("-", "out-op"),
      " ",
      token("40", "out-number"),
      " ",
      token("else", "out-keyword"),
      ": ",
      token("overtime", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("0", "out-number")
    ], "muted");
    writeLineRich([
      "  Loop: ",
      token("for", "out-keyword"),
      " i ",
      token("in", "out-keyword"),
      " ",
      token("1..4", "out-number"),
      ": ",
      token("total", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("total", "out-var"),
      " ",
      token("+", "out-op"),
      " i  |  ",
      token("repeat", "out-keyword"),
      " ",
      token("3", "out-number"),
      ": ",
      token("waste", "out-fn"),
      token("(100 sf, 5)", "out-op")
    ], "muted");
    writeLineRich([
      "  Solve: ",
      token("56", "out-number"),
      " ",
      token("cy", "out-unit"),
      " ",
      token("=", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(sf, 6 in)", "out-op")
    ], "muted");
    writeLineRich([
      "  Strings: ",
      token("\"crew\"", "out-string"),
      " or ",
      token("'crew'", "out-string"),
      " (required for meta-programming helpers)"
    ], "muted");
    writeLineRich([token("Units:", "out-label")], "muted");
    writeLineRich([
      "  Supported: ",
      token("in, ft, lf, yd, sf, sy, cf, cy, lb, ton, layer", "out-unit"),
      "."
    ], "muted");
    writeLineRich([
      "  Use as tokens: ",
      token("12", "out-number"),
      " ",
      token("ft", "out-unit"),
      " + ",
      token("6", "out-number"),
      " ",
      token("in", "out-unit"),
      "  |  ",
      token("1200", "out-number"),
      " ",
      token("sf", "out-unit"),
      " * ",
      token("4", "out-number"),
      " ",
      token("in", "out-unit"),
      "  |  ",
      token("3", "out-number"),
      " ",
      token("cy", "out-unit"),
      " + ",
      token("9", "out-number"),
      " ",
      token("cf", "out-unit")
    ], "muted");
    writeLineRich([token("Assemblies:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("assy", "out-keyword"),
      " ",
      token("wall", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("{", "out-op"),
      " ",
      token("studs", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("16 in o.c.", "out-number"),
      "; ",
      token("height", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("10 ft", "out-number"),
      "; ",
      token("sheathing", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("1 layer", "out-number"),
      " ",
      token("}", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("qty", "out-fn"),
      token("(wall, 120 lf)", "out-op"),
      " → studs + area breakdown"
    ], "muted");
    writeLineRich([
      "  Converters: ",
      token("to_in", "out-fn"),
      token("/", "out-op"),
      token("to_ft", "out-fn"),
      ", ",
      token("to_sf", "out-fn"),
      token("/", "out-op"),
      token("to_sy", "out-fn"),
      ", ",
      token("to_cf", "out-fn"),
      token("/", "out-op"),
      token("to_cy", "out-fn"),
      ", ",
      token("to_lb", "out-fn"),
      token("/", "out-op"),
      token("to_ton", "out-fn"),
      "."
    ], "muted");
    writeLineRich([token("Construction helpers:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("waste", "out-fn"),
      token("(qty,pct)", "out-op"),
      "  ",
      token("markup", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("burden", "out-fn"),
      token("(labor,pct)", "out-op"),
      "  ",
      token("unit", "out-fn"),
      token("(cost,qty)", "out-op"),
      "  ",
      token("round_up", "out-fn"),
      token("(x,step)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("area_rect", "out-fn"),
      token("(a,b)", "out-op"),
      " ",
      token("area_circle", "out-fn"),
      token("(diam)", "out-op"),
      " ",
      token("vol_rect", "out-fn"),
      token("(area,thk_in)", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(area,thk_in)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("bf", "out-fn"),
      token("(t_in,w_in,len_ft,qty)", "out-op"),
      "  ",
      token("pipe_wt", "out-fn"),
      token("(nps_in,schedule,len_ft)", "out-op")
    ], "muted");
    writeLineRich([token("Math + logic:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("abs min max round ceil floor sqrt pow exp log log10 sin cos tan atan2 clamp", "out-keyword")
    ], "muted");
    writeLineRich([
      "  Comparisons return ",
      token("1", "out-number"),
      "/",
      token("0", "out-number"),
      ": ",
      token("== != < <= > >=", "out-op"),
      "  |  Logic: ",
      token("&& ||", "out-op")
    ], "muted");
    writeLineRich([token("Meta-programming:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("eval", "out-fn"),
      token("(\"expr\")", "out-op"),
      " ",
      token("set", "out-fn"),
      token("(\"name\", value)", "out-op"),
      " ",
      token("get", "out-fn"),
      token("(\"name\")", "out-op"),
      " ",
      token("unset", "out-fn"),
      token("(\"name\")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("define", "out-fn"),
      token("(\"fn\", \"a,b\", \"a+b\")", "out-op"),
      " ",
      token("undefine", "out-fn"),
      token("(\"fn\")", "out-op"),
      " ",
      token("vars()", "out-fn"),
      " ",
      token("methods()", "out-fn")
    ], "muted");
    writeLineRich([token("Graphics:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("gfx", "out-fn"),
      token("(w,h)", "out-op"),
      " ",
      token("gfxs", "out-fn"),
      token("(scale)", "out-op"),
      " ",
      token("bg", "out-fn"),
      token("(color)", "out-op"),
      " ",
      token("cls()", "out-fn")
    ], "muted");
    writeLineRich([
      "  ",
      token("pix", "out-fn"),
      token("(x,y,color)", "out-op"),
      " ",
      token("line", "out-fn"),
      token("(x0,y0,x1,y1,color)", "out-op"),
      " ",
      token("rect", "out-fn"),
      token("(x,y,w,h,color)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("fill", "out-fn"),
      token("(x,y,w,h,color)", "out-op"),
      " ",
      token("plot", "out-fn"),
      token("(x,y,\"dx,dy|...\",color)", "out-op"),
      "  colors: ",
      token(GFX_COLOR_TOKENS.join(", "), "out-unit")
    ], "muted");
    writeLineRich([token("Session commands:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token(":vars", "out-command"),
      " list variables   ",
      token(":methods", "out-command"),
      " list user methods   ",
      token(":reset", "out-command"),
      " wipe session"
    ], "muted");
    writeLineRich([
      "  ",
      token(":save", "out-command"),
      " name save profile   ",
      token(":load", "out-command"),
      " name load profile"
    ], "muted");
    writeLineRich([
      "  ",
      token(":profiles", "out-command"),
      " list profiles"
    ], "muted");
    writeLineRich([
      "  ",
      token(":export", "out-command"),
      " copy JSON      ",
      token(":import", "out-command"),
      " load JSON from clipboard"
    ], "muted");
    writeLineRich([
      "  ",
      token(":theme", "out-command"),
      " ",
      token("default", "out-keyword"),
      token("|", "out-op"),
      token("amber", "out-keyword"),
      token("|", "out-op"),
      token("matrix", "out-keyword")
    ], "muted");
    writeLineRich([
      "  ",
      token(":test", "out-command"),
      " run REPL tests"
    ], "muted");
    writeLineRich([token("Tips:", "out-label")], "muted");
    writeLineRich([
      "  - Shift+Enter inserts a new line. Enter runs when the statement is complete."
    ], "muted");
    writeLineRich([
      "  - Use Up/Down to cycle history; Ctrl/Cmd+L clears the terminal."
    ], "muted");
    writeLineRich([
      "  - Autocomplete works for commands (:), functions, units, variables, constants."
    ], "muted");
  }

  function listVars(){
    const keys = Object.keys(state.vars).sort();
    if (!keys.length){
      writeLine("No variables set.", "muted");
      return;
    }
    writeLine("Variables:", "ok");
    for (const k of keys){
      const formatted = formatValueDisplay(state.vars[k]);
      writeLineRich([
        "  ",
        token(k, "out-var"),
        " ",
        token("=", "out-op"),
        " ",
        token(formatted.main, "out-number")
      ], "muted");
      if (formatted.extra) writeLine(`↳ ${formatted.extra}`, "muted");
    }
  }

  function listMethods(){
    const keys = Object.keys(state.userFns).sort();
    if (!keys.length){
      writeLine("No user functions defined.", "muted");
      return;
    }
    writeLine("User functions:", "ok");
    for (const k of keys){
      const defn = state.userFns[k];
      const params = defn.params ? defn.params.join(", ") : "";
      writeLineRich([
        "  ",
        token(k, "out-fn"),
        token("(", "out-op"),
        token(params, "out-var"),
        token(")", "out-op"),
        " ",
        token("=", "out-op"),
        " ",
        token(defn.expr, "out-string")
      ], "muted");
    }
  }

  function clearFnForm(){
    fnNameInput.value = "";
    fnParamsInput.value = "";
    fnExprInput.value = "";
  }

  function insertIntoEditor(text){
    const value = inputEl.value;
    const start = inputEl.selectionStart ?? value.length;
    const end = inputEl.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
    inputEl.value = nextValue;
    const cursorPos = start + text.length;
    inputEl.focus();
    inputEl.setSelectionRange(cursorPos, cursorPos);
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
  }

  function renderUserFunctions(){
    const keys = Object.keys(state.userFns).sort();
    userFnList.innerHTML = "";
    userFnEmpty.style.display = keys.length ? "none" : "block";
    for (const name of keys){
      const defn = state.userFns[name];
      const row = document.createElement("div");
      row.className = "fnRow";
      const params = defn.params ? defn.params.join(", ") : "";
      row.innerHTML = `
        <div class="fnTitle">${name}(${params})</div>
        <div class="fnExpr">= ${defn.expr}</div>
        <div class="fnActions"></div>
      `;
      const actions = row.querySelector(".fnActions");
      const insertBtn = document.createElement("button");
      insertBtn.className = "btn mini";
      insertBtn.textContent = "Insert";
      insertBtn.addEventListener("click", () => insertIntoEditor(`${name}(`));
      const editBtn = document.createElement("button");
      editBtn.className = "btn mini";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        fnNameInput.value = name;
        fnParamsInput.value = params;
        fnExprInput.value = defn.expr;
        fnNameInput.focus();
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn mini danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        delete state.userFns[name];
        renderUserFunctions();
        writeLine(`Removed function ${name}.`, "warn");
      });
      actions.append(insertBtn, editBtn, deleteBtn);
      userFnList.appendChild(row);
    }
  }

  function clearTerminal(){
    terminalEl.innerHTML = "";
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      setStatus("Copied", "ok");
      writeLine("Copied to clipboard.", "ok");
    }catch{
      setStatus("Clipboard blocked", "warn");
      writeLine("Clipboard access blocked by browser. (Try HTTPS or allow clipboard.)", "warn");
      writeLine(text, "muted");
    }
  }

  async function readClipboard(){
    try{
      return await navigator.clipboard.readText();
    }catch{
      throw new Error("Clipboard read blocked by browser.");
    }
  }

  function setTheme(t){
    const ok = ["default","amber","matrix"].includes(t);
    if (!ok) throw new Error("Theme must be: default | amber | matrix");
    state.theme = t;
    document.body.setAttribute("data-theme", t);
    hintRight.textContent = `Theme: ${t}`;
  }

  const PROFILE_STORAGE_KEY = "replcalc_profiles_v1";

  function loadProfileStore(){
    try{
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return Object.create(null);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return Object.create(null);
      return parsed;
    }catch{
      return Object.create(null);
    }
  }

  function saveProfileStore(store){
    try{
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
    }catch{
      throw new Error("Local storage blocked by browser.");
    }
  }

  function normalizeProfileName(name){
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Profile name required. Use :save name.");
    if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)){
      throw new Error("Profile name can only use letters, numbers, spaces, _ or -.");
    }
    return trimmed;
  }

  function exportSession(){
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      vars: state.vars,
      history: state.history.slice(-250),
      theme: state.theme,
      methods: Object.values(state.userFns).map((defn) => ({
        name: defn.name,
        params: defn.params,
        expr: defn.expr,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  function saveProfile(name){
    const profileName = normalizeProfileName(name);
    const store = loadProfileStore();
    const payload = JSON.parse(exportSession());
    payload.profile_name = profileName;
    payload.saved_at = new Date().toISOString();
    store[profileName] = payload;
    saveProfileStore(store);
    writeLine(`Saved profile "${profileName}".`, "ok");
  }

  function loadProfile(name){
    const profileName = normalizeProfileName(name);
    const store = loadProfileStore();
    const payload = store[profileName];
    if (!payload) throw new Error(`No saved profile named "${profileName}".`);
    importSession(JSON.stringify(payload));
    writeLine(`Loaded profile "${profileName}".`, "ok");
  }

  function listProfiles(){
    const store = loadProfileStore();
    const names = Object.keys(store).sort();
    if (!names.length){
      writeLine("No saved profiles yet.", "muted");
      return;
    }
    writeLine("Saved profiles:", "ok");
    for (const name of names){
      const stamp = store[name]?.saved_at ? ` (saved ${store[name].saved_at})` : "";
      writeLine(`  ${name}${stamp}`, "muted");
    }
  }

  function importSession(jsonText){
    const obj = JSON.parse(jsonText);
    if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
    if (obj.version !== 1) throw new Error("Unsupported session version");
    // restore
    state.vars = obj.vars && typeof obj.vars === "object" ? obj.vars : Object.create(null);
    state.history = Array.isArray(obj.history) ? obj.history : [];
    if (obj.theme) setTheme(obj.theme);
    state.userFns = Object.create(null);
    if (Array.isArray(obj.methods)){
      for (const defn of obj.methods){
        if (defn && typeof defn.name === "string" && typeof defn.expr === "string"){
          const params = Array.isArray(defn.params) ? defn.params : [];
          try{
            defineUserFn(defn.name, params, defn.expr);
          }catch{
            // ignore invalid imported methods
          }
        }
      }
    }
    renderUserFunctions();
  }

  function resetAll(){
    state.vars = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    state.userFns = Object.create(null);
    state.gfx = null;
    state.gfxDirty = false;
    renderUserFunctions();
    setStatus("Reset", "ok");
    writeLine("Session reset.", "warn");
  }

  function splitStatements(source){
    const out = [];
    const normalized = [];
    const lines = source.split("\n");
    let blockIndent = null;
    for (let idx = 0; idx < lines.length; idx++){
      const line = lines[idx];
      const indent = (line.match(/^\s*/) || [""])[0].length;
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (blockIndent !== null){
        if (indent > blockIndent){
          const last = normalized.pop();
          normalized.push(`${last}; ${trimmed}`);
          continue;
        }
        blockIndent = null;
      }
      normalized.push(line.trimEnd());
      if (trimmed.endsWith(":")) blockIndent = indent;
    }

    let depth = 0;
    let braceDepth = 0;
    let start = 0;
    const joined = normalized.join("\n");
    for (let i = 0; i < joined.length; i++){
      const c = joined[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      const isBreak = (c === "\n" || c === ";") && depth === 0 && braceDepth === 0;
      if (isBreak){
        const piece = joined.slice(start, i).trim();
        if (piece) out.push(piece);
        start = i + 1;
      }
    }
    const tail = joined.slice(start).trim();
    if (tail) out.push(tail);
    return out;
  }

  function findTopLevelChar(source, char){
    let depth = 0;
    let braceDepth = 0;
    for (let i = 0; i < source.length; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      if (depth === 0 && braceDepth === 0 && c === char) return i;
    }
    return -1;
  }

  function findTopLevelEquals(source){
    let depth = 0;
    let braceDepth = 0;
    for (let i = 0; i < source.length; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      if (depth !== 0 || braceDepth !== 0) continue;
      if (c !== "=") continue;
      const prev = source[i - 1];
      const next = source[i + 1];
      if (prev === "!" || prev === "<" || prev === ">") continue;
      if (next === "=") continue;
      return i;
    }
    return -1;
  }

  function findTopLevelKeyword(source, keyword){
    let depth = 0;
    let braceDepth = 0;
    const lower = keyword.toLowerCase();
    for (let i = 0; i < source.length; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      if (depth !== 0 || braceDepth !== 0) continue;
      if (source.slice(i, i + lower.length).toLowerCase() === lower){
        const before = source[i - 1];
        const after = source[i + lower.length];
        const beforeOk = !before || /\s/.test(before);
        const afterOk = !after || /\s|:/.test(after);
        if (beforeOk && afterOk) return i;
      }
    }
    return -1;
  }

  function findTopLevelRange(source){
    let depth = 0;
    let braceDepth = 0;
    for (let i = 0; i < source.length - 1; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      if (depth === 0 && braceDepth === 0 && source[i] === "." && source[i + 1] === ".") return i;
    }
    return -1;
  }

  function splitAssemblyEntries(source){
    const out = [];
    let start = 0;
    let depth = 0;
    let quote = null;
    for (let i = 0; i < source.length; i++){
      const c = source[i];
      if (c === "\\" && quote){
        i += 1;
        continue;
      }
      if (quote){
        if (c === quote) quote = null;
        continue;
      }
      if (c === "\"" || c === "'"){
        quote = c;
        continue;
      }
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if ((c === "\n" || c === ";") && depth === 0){
        const piece = source.slice(start, i).trim();
        if (piece) out.push(piece);
        start = i + 1;
      }
    }
    const tail = source.slice(start).trim();
    if (tail) out.push(tail);
    return out;
  }

  function parseAssemblyValue(valueStr){
    const raw = valueStr.trim();
    if (!raw) throw new Error("Assembly entry missing value.");

    const tryExpr = (expr) => {
      try{
        return { ok: true, value: runExpressionWithContext(expr, state.vars) };
      }catch{
        return { ok: false };
      }
    };

    const direct = tryExpr(raw);
    if (direct.ok) return { value: direct.value, note: "", raw };

    const parts = raw.split(/\s+/);
    for (let idx = parts.length - 1; idx >= 1; idx--){
      const candidate = parts.slice(0, idx).join(" ");
      const attempt = tryExpr(candidate);
      if (attempt.ok){
        const note = parts.slice(idx).join(" ");
        return { value: attempt.value, note, raw };
      }
    }

    return { value: raw, note: "", raw };
  }

  function parseAssemblyStatement(src){
    const assyMatch = src.match(/^assy\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([\s\S]*)\}$/i);
    if (!assyMatch) return null;
    const name = assyMatch[1];
    const body = assyMatch[2].trim();
    const entries = body ? splitAssemblyEntries(body) : [];
    const fields = Object.create(null);
    for (const entry of entries){
      const eqIdx = findTopLevelEquals(entry);
      if (eqIdx < 0) throw new Error("Assembly entries must be key = value.");
      const key = entry.slice(0, eqIdx).trim();
      if (!key) throw new Error("Assembly entry missing key.");
      const valueStr = entry.slice(eqIdx + 1).trim();
      const parsed = parseAssemblyValue(valueStr);
      fields[key] = parsed;
    }
    return { type: "assy", name, fields };
  }

  // -----------------------------
  // Main evaluator
  // -----------------------------
  function evaluate(line){
    const src = line.trim();
    if (!src) return null;

    // commands
    if (src.startsWith(":")){
      const parts = src.slice(1).trim().split(/\s+/);
      const cmd = (parts[0] || "").toLowerCase();
      const arg = parts.slice(1).join(" ");
      return { type:"cmd", cmd, arg };
    }

    if (src.startsWith("if ")){
      return parseIfStatement(src);
    }

    if (src.startsWith("for ")){
      return parseForStatement(src);
    }

    if (src.startsWith("repeat ")){
      return parseRepeatStatement(src);
    }

    if (/^assy\b/i.test(src)){
      const parsed = parseAssemblyStatement(src);
      if (!parsed) throw new Error("Assembly must use: assy name = { key = value }");
      return parsed;
    }

    const defMatch = src.match(/^(?:def|fn|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/);
    if (defMatch){
      const name = defMatch[1];
      const params = parseParams(defMatch[2]);
      return { type:"def", name, params, expr:defMatch[3] };
    }

    // assignment: name = expression
    const m = src.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (m){
      return { type:"assign", name:m[1], expr:m[2] };
    }

    const eqIdx = findTopLevelEquals(src);
    if (eqIdx >= 0){
      const left = src.slice(0, eqIdx).trim();
      const right = src.slice(eqIdx + 1).trim();
      if (!left || !right) throw new Error("Equation must have left and right expressions.");
      return { type:"equation", left, right };
    }

    return { type:"expr", expr:src };
  }

  function parseIfStatement(src){
    const remainder = src.replace(/^if\s+/i, "");
    const colonIdx = findTopLevelChar(remainder, ":");
    if (colonIdx < 0) throw new Error("if statement missing ':'");
    const condition = remainder.slice(0, colonIdx).trim();
    const rest = remainder.slice(colonIdx + 1).trim();
    const elseIdx = findTopLevelKeyword(rest, "else");
    if (elseIdx < 0){
      return { type:"if", condition, thenBody: rest, elseBody: null };
    }
    const thenBody = rest.slice(0, elseIdx).trim();
    let elseBody = rest.slice(elseIdx + 4).trim();
    if (elseBody.startsWith(":")) elseBody = elseBody.slice(1).trim();
    if (!elseBody) throw new Error("else statement missing body");
    return { type:"if", condition, thenBody, elseBody };
  }

  function parseForStatement(src){
    const remainder = src.replace(/^for\s+/i, "");
    const match = remainder.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([\s\S]+)$/);
    if (!match) throw new Error("for statement must be: for var in start..end : expr");
    const varName = match[1];
    const rest = match[2];
    const colonIdx = findTopLevelChar(rest, ":");
    if (colonIdx < 0) throw new Error("for statement missing ':'");
    const rangePart = rest.slice(0, colonIdx).trim();
    const body = rest.slice(colonIdx + 1).trim();
    const stepIdx = findTopLevelKeyword(rangePart, "step");
    const rangeExpr = stepIdx >= 0 ? rangePart.slice(0, stepIdx).trim() : rangePart;
    const stepExpr = stepIdx >= 0 ? rangePart.slice(stepIdx + 4).trim() : null;
    const rangeIdx = findTopLevelRange(rangeExpr);
    if (rangeIdx < 0) throw new Error("for statement range must use start..end");
    const startExpr = rangeExpr.slice(0, rangeIdx).trim();
    const endExpr = rangeExpr.slice(rangeIdx + 2).trim();
    return {
      type:"for",
      varName,
      startExpr,
      endExpr,
      stepExpr,
      body,
    };
  }

  function parseRepeatStatement(src){
    const remainder = src.replace(/^repeat\s+/i, "");
    const colonIdx = findTopLevelChar(remainder, ":");
    if (colonIdx < 0) throw new Error("repeat statement missing ':'");
    const countExpr = remainder.slice(0, colonIdx).trim();
    const body = remainder.slice(colonIdx + 1).trim();
    if (!countExpr || !body) throw new Error("repeat statement requires count and body");
    return { type:"repeat", countExpr, body };
  }

  function isBareUnitToken(tokens, idx){
    const token = tokens[idx];
    if (!token || token.type !== "id" || !isUnitToken(token.value)) return false;
    const prev = tokens[idx - 1];
    if (!prev) return true;
    if (prev.type === "num" || prev.type === "id" || prev.type === ")") return false;
    return true;
  }

  function findEquationUnknowns(expr, vars, fns){
    const tokens = tokenize(expr);
    const unknowns = [];
    for (let i = 0; i < tokens.length; i++){
      const t = tokens[i];
      if (t.type !== "id") continue;
      const name = t.value;
      const next = tokens[i + 1];
      if (next && next.type === "(") continue;
      if (name === "pi" || name === "e") continue;
      if (Object.prototype.hasOwnProperty.call(vars, name)) continue;
      if (fns && fns.has(name)) continue;
      if (isUnitToken(name)){
        if (isBareUnitToken(tokens, i)){
          const unit = UNIT[name];
          unknowns.push({ name, kind: unit.kind, toBase: unit.toBase, unitToken: true });
        }
        continue;
      }
      unknowns.push({ name, kind: "scalar", unitToken: false });
    }
    return unknowns;
  }

  function diffValues(left, right){
    if (isQty(left) && isQty(right)){
      if (left.kind !== right.kind) throw new Error(`Unit mismatch: ${left.kind} vs ${right.kind}`);
      return left.value - right.value;
    }
    if (isQty(left) && !isQty(right)){
      if (left.kind !== "scalar") throw new Error("Unit mismatch between quantity and scalar.");
      return left.value - right;
    }
    if (!isQty(left) && isQty(right)){
      if (right.kind !== "scalar") throw new Error("Unit mismatch between scalar and quantity.");
      return left - right.value;
    }
    return left - right;
  }

  function solveEquation(leftExpr, rightExpr){
    const fns = new Set(Object.keys(getFns()));
    const unknowns = [
      ...findEquationUnknowns(leftExpr, state.vars, fns),
      ...findEquationUnknowns(rightExpr, state.vars, fns),
    ];
    const unique = new Map();
    for (const item of unknowns){
      if (!unique.has(item.name)) unique.set(item.name, item);
    }
    const unknownList = Array.from(unique.values());
    if (unknownList.length !== 1){
      throw new Error("Equation must contain exactly one unknown identifier.");
    }
    const unknown = unknownList[0];
    const evaluateDiff = (x) => {
      const vars = Object.assign(Object.create(null), state.vars);
      let overrides = null;
      if (unknown.unitToken){
        overrides = {
          [unknown.name]: makeQty(x * unknown.toBase, unknown.kind),
        };
      }else{
        vars[unknown.name] = x;
      }
      const left = runExpressionWithOverrides(leftExpr, vars, overrides, Object.create(null));
      const right = runExpressionWithOverrides(rightExpr, vars, overrides, Object.create(null));
      return diffValues(left, right);
    };

    const tol = 1e-9;
    let a = 0;
    let fa = evaluateDiff(a);
    if (Math.abs(fa) <= tol) return { unknown, value: a };
    let b = 1;
    let fb = evaluateDiff(b);
    if (Math.abs(fb) <= tol) return { unknown, value: b };

    let step = 1;
    let bracketed = fa * fb < 0;
    for (let i = 0; i < 30 && !bracketed; i++){
      step *= 2;
      a -= step;
      b += step;
      fa = evaluateDiff(a);
      fb = evaluateDiff(b);
      if (Math.abs(fa) <= tol) return { unknown, value: a };
      if (Math.abs(fb) <= tol) return { unknown, value: b };
      bracketed = fa * fb < 0;
    }

    let x0 = a;
    let x1 = b;
    let f0 = fa;
    let f1 = fb;
    for (let i = 0; i < 60; i++){
      if (Math.abs(f1 - f0) < 1e-12) break;
      const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
      if (!Number.isFinite(x2)) break;
      const f2 = evaluateDiff(x2);
      if (Math.abs(f2) <= tol) return { unknown, value: x2 };
      x0 = x1;
      f0 = f1;
      x1 = x2;
      f1 = f2;
      if (bracketed && f0 * f1 < 0){
        a = x0;
        b = x1;
        fa = f0;
        fb = f1;
      }
    }

    if (bracketed){
      let left = a;
      let right = b;
      let fl = fa;
      let fr = fb;
      for (let i = 0; i < 80; i++){
        const mid = (left + right) / 2;
        const fm = evaluateDiff(mid);
        if (Math.abs(fm) <= tol) return { unknown, value: mid };
        if (fl * fm < 0){
          right = mid;
          fr = fm;
        }else{
          left = mid;
          fl = fm;
        }
      }
      return { unknown, value: (left + right) / 2 };
    }

    throw new Error("Could not solve equation (no convergence).");
  }

  function runExpressionWithContext(expr, vars){
    const tokens = insertImplicitMultiplication(tokenize(expr));
    const fns = getFns();
    const aliasMap = buildAliasMap(tokens, vars, new Set(Object.keys(fns)));
    const rpn = toRPN(tokens);
    return evalRPN(rpn, {
      vars,
      fns,
      aliases: aliasMap,
    });
  }

  function runExpression(expr){
    return runExpressionWithContext(expr, state.vars);
  }

  function runExpressionWithOverrides(expr, vars, unitOverrides, aliasMap = null){
    const tokens = insertImplicitMultiplication(tokenize(expr));
    const fns = getFns();
    const resolvedAliases = aliasMap || buildAliasMap(tokens, vars, new Set(Object.keys(fns)));
    const rpn = toRPN(tokens);
    return evalRPN(rpn, {
      vars,
      fns,
      aliases: resolvedAliases,
      unitOverrides,
    });
  }

  function isAssembly(value){
    return value && typeof value === "object" && value.__assy;
  }

  function createAssembly(name, fields){
    return {
      __assy: true,
      name,
      fields,
    };
  }

  function formatAssemblySummary(assy){
    const fields = assy.fields || {};
    const entries = Object.entries(fields).map(([key, info]) => {
      const value = info?.value;
      const note = info?.note;
      let rendered = isQty(value) ? qtyToString(value) : String(value);
      if (note) rendered += ` ${note}`;
      return `${key} = ${rendered}`;
    });
    const inner = entries.join("; ");
    return `assy ${assy.name}${inner ? ` { ${inner} }` : " {}"}`;
  }

  function formatValueDisplay(value){
    if (isAssembly(value)) return { main: formatAssemblySummary(value), extra: "" };
    return formatResult(value);
  }

  // -----------------------------
  // Formatting + editor helpers
  // -----------------------------
  const COMMANDS = [
    { label: ":help", detail: "help" },
    { label: ":docs", detail: "docs" },
    { label: ":clear", detail: "clear output" },
    { label: ":vars", detail: "list variables" },
    { label: ":methods", detail: "list user methods" },
    { label: ":reset", detail: "reset session" },
    { label: ":save", detail: "save profile" },
    { label: ":load", detail: "load profile" },
    { label: ":profiles", detail: "list profiles" },
    { label: ":export", detail: "copy session" },
    { label: ":import", detail: "load session" },
    { label: ":theme", detail: "switch theme" },
    { label: ":test", detail: "run tests" },
  ];

  const expectQty = (value, kind, tol = 1e-6) => ({ type: "qty", value, kind, tol });
  const expectNear = (value, tol = 1e-6) => ({ type: "scalar", value, tol });

  function createTestSuite(){
    return [
      { name: "basic arithmetic", expr: "2+2", expect: 4 },
      { name: "operator precedence", expr: "2+2*5", expect: 12 },
      { name: "parentheses", expr: "(2+2)*5", expect: 20 },
      { name: "exponentiation", expr: "2^3", expect: 8 },
      { name: "comparisons", expr: "3 > 2", expect: 1 },
      { name: "logic", expr: "1 && 0", expect: 0 },
      { name: "subtraction", expr: "10-3", expect: 7 },
      { name: "division", expr: "20/4", expect: 5 },
      { name: "combined ops", expr: "18/3+2*4", expect: 14 },
      { name: "absolute value", expr: "abs(-12)", expect: 12 },
      { name: "min max", expr: "max(5, min(3, 9))", expect: 5 },
      { name: "rounding", expr: "round(2.6)", expect: 3 },
      { name: "ceil", expr: "ceil(2.1)", expect: 3 },
      { name: "floor", expr: "floor(2.9)", expect: 2 },
      { name: "sqrt", expr: "sqrt(81)", expect: 9 },
      { name: "pow function", expr: "pow(3, 4)", expect: 81 },
      { name: "log/exp", expr: "log(exp(2))", expect: expectNear(2) },
      { name: "sine", expr: "sin(pi / 2)", expect: expectNear(1) },
      { name: "atan2", expr: "atan2(1, 1)", expect: expectNear(Math.PI / 4) },
      { name: "clamp", expr: "clamp(12, 0, 10)", expect: 10 },
      { name: "if function", expr: "if(3>2, 7, 4)", expect: 7 },
      { name: "pi constant", expr: "pi * 2", expect: expectNear(Math.PI * 2) },
      { name: "assignment + reference", steps: ["x = 10", "x * 3"], expect: 30 },
      { name: "variable reassignment", steps: ["x = 5", "x = x + 2", "x"], expect: 7 },
      { name: "unit addition", expr: "12 in + 1 ft", expect: expectQty(2, "len") },
      { name: "linear foot unit", expr: "10 lf", expect: expectQty(10, "len") },
      { name: "unit subtraction", expr: "5 ft - 6 in", expect: expectQty(4.5, "len") },
      { name: "unit scaling", expr: "3 * 4 ft", expect: expectQty(12, "len") },
      { name: "area from multiplication", expr: "12 ft * 10 ft", expect: expectQty(120, "area") },
      { name: "rectangle area helper", expr: "area_rect(12 ft, 8 ft)", expect: expectQty(96, "area") },
      { name: "volume helper", expr: "vol_rect(1200 sf, 4 in)", expect: expectQty(400, "vol") },
      { name: "concrete volume", expr: "concrete_cy(1200 sf, 4 in)", expect: expectQty(400, "vol") },
      { name: "waste factor", expr: "waste(500 sf, 10)", expect: expectQty(550, "area") },
      { name: "markup", expr: "markup(200, 15)", expect: 230 },
      { name: "burden", expr: "burden(80, 25)", expect: 100 },
      { name: "round up", expr: "round_up(11, 5)", expect: 15 },
      { name: "round up qty", expr: "round_up(5.1 ft, 2 ft)", expect: expectQty(6, "len") },
      { name: "unit cost", expr: "unit(1200, 30)", expect: 40 },
      { name: "circle area", expr: "area_circle(10 ft)", expect: expectNear(Math.PI * 25) },
      { name: "pipe weight", expr: "pipe_wt(2, 40, 10 ft)", expect: expectQty(36.5, "wt") },
      { name: "pipe weight alt", expr: "pipe_wt(1, 80, 5 ft)", expect: expectQty(10.85, "wt") },
      { name: "board feet", expr: "bf(2, 6, 8, 12)", expect: 96 },
      { name: "convert length to inches", expr: "to_in(2 ft)", expect: 24 },
      { name: "convert length to feet", expr: "to_ft(18 in)", expect: 1.5 },
      { name: "convert area to sf", expr: "to_sf(2 sy)", expect: 18 },
      { name: "convert area to sy", expr: "to_sy(90 sf)", expect: 10 },
      { name: "convert volume to cf", expr: "to_cf(2 cy)", expect: 54 },
      { name: "convert volume", expr: "to_cy(27 cf)", expect: 1 },
      { name: "convert weight to lb", expr: "to_lb(2 ton)", expect: 4000 },
      { name: "convert weight to ton", expr: "to_ton(1000 lb)", expect: 0.5 },
      { name: "clamp qty", expr: "clamp(12 ft, 0 ft, 10 ft)", expect: expectQty(10, "len") },
      { name: "user function", steps: ["fn crew_cost(rate, hours) = rate * hours", "crew_cost(85, 12)"], expect: 1020 },
      { name: "user function with units", steps: ["fn wall_area(len, ht) = len * ht", "wall_area(12 ft, 8 ft)"], expect: expectQty(96, "area") },
      { name: "define meta function", steps: ["define(\"adder\", \"a,b\", \"a+b\")", "adder(4, 6)"], expect: 10 },
      { name: "methods listing", steps: ["define(\"double\", \"x\", \"x*2\")", "methods()"], expect: "double" },
      { name: "vars listing", steps: ["a = 1", "b = 2", "vars()"], expect: "a, b" },
      { name: "meta helpers", steps: ["set(\"crew\", 5)", "get(\"crew\")"], expect: 5 },
      { name: "unset meta", steps: ["set(\"crew\", 5)", "unset(\"crew\")"], expect: 1 },
      { name: "eval expression", steps: ["eval(\"2+3*4\")"], expect: 14 },
      { name: "undefine function", steps: ["define(\"temp\", \"x\", \"x+1\")", "undefine(\"temp\")"], expect: 1 },
      { name: "if statement", steps: ["total = 0", "if 3 > 2: total = 5 else: total = 2", "total"], expect: 5 },
      { name: "nested if statement", steps: ["total = 0", "if 2 > 3: total = 1 else: if 4 > 2: total = 7 else: total = 3", "total"], expect: 7 },
      { name: "for loop", steps: ["total = 0", "for i in 1..4: total = total + i", "total"], expect: 10 },
      { name: "for loop step", steps: ["total = 0", "for i in 1..5 step 2: total = total + i", "total"], expect: 9 },
      { name: "for loop descending", steps: ["total = 0", "for i in 5..1 step -2: total = total + i", "total"], expect: 9 },
      { name: "for loop unit range", steps: ["total = 0 ft", "for i in 1 ft..3 ft: total = total + i", "total"], expect: expectQty(6, "len") },
      { name: "repeat loop", steps: ["total = 0", "repeat 3: total = total + 2", "total"], expect: 6 },
      { name: "repeat loop with units", steps: ["total = 0 ft", "repeat 3: total = total + 2 ft", "total"], expect: expectQty(6, "len") },
      { name: "equation solver", expr: "56 cy = concrete_cy(sf, 6 in)", expect: 3024 },
      { name: "equation solver larger", expr: "100 cy = concrete_cy(sf, 8 in)", expect: 4050 },
      {
        name: "nested markup loop total",
        steps: [
          "fn item_cost(rate, hours, waste_pct) = markup(rate * hours, waste_pct)",
          "total = 0",
          "for crew in 1..3: total = total + item_cost(45 + crew * 5, 8 + crew, 10)",
          "if total > 0: total = round(total) else: total = 0",
          "total",
        ],
        expect: 1826,
      },
      {
        name: "looped unit accumulation",
        steps: ["total = 0 ft", "for i in 1..5: total = total + (i * (2 ft))", "total"],
        expect: expectQty(30, "len"),
      },
      {
        name: "area waste rounding chain",
        steps: [
          "base = area_rect(45 ft, 30 ft)",
          "with_waste = waste(base, 12.5)",
          "with_waste_sy = to_sy(with_waste)",
          "round_up(with_waste_sy, 5)",
        ],
        expect: 170,
      },
      {
        name: "bay area loop accumulation",
        steps: [
          "fn bay_area(span, bays) = area_rect(span, 20 ft) * bays",
          "total = 0 sf",
          "for i in 1..4: total = total + bay_area(15 ft + i ft, i)",
          "total",
        ],
        expect: expectQty(3600, "area"),
      },
      {
        name: "conditional scoring loop",
        steps: [
          "score = 0",
          "for i in 1..6: if i > 3 && i < 6: score = score + i else: score = score + (i * 2)",
          "score",
        ],
        expect: 33,
      },
      {
        name: "repeat bump function",
        steps: ["fn bump(x) = x * 1.1 + 3", "val = 0", "repeat 4: val = bump(val)", "val"],
        expect: expectNear(13.923),
      },
      {
        name: "trench volume to cy",
        steps: [
          "fn trench_vol(len, width, depth) = vol_rect(area_rect(len, width), depth)",
          "volume = trench_vol(120 ft, 3 ft, 2 ft)",
          "to_cy(volume)",
        ],
        expect: expectNear(26.6666666667),
      },
      {
        name: "eval with variables",
        steps: ["x = 12", "y = 3", "eval(\"x^2 + y^3 + 2*x*y\")"],
        expect: 243,
      },
      {
        name: "unit comparisons with if",
        steps: [
          "total = 0 ft",
          "if 2 ft > 1 ft: total = total + 3 ft else: total = total + 5 ft",
          "if total >= 3 ft: total = total + 2 ft else: total = total + 1 ft",
          "total",
        ],
        expect: expectQty(5, "len"),
      },
      {
        name: "log sqrt trig compound",
        expr: "log(exp(3)) + sqrt(144) - (sin(pi/6)^2 + cos(pi/6)^2)",
        expect: expectNear(14),
      },
      {
        name: "unit cost with markup and burden",
        expr: "unit(markup(200, 15) + burden(80, 25), 4)",
        expect: 82.5,
      },
      {
        name: "meta set/get with arithmetic",
        steps: ["set(\"crew\", 4)", "set(\"rate\", 95)", "get(\"crew\") * get(\"rate\") * 8"],
        expect: 3040,
      },
      {
        name: "slab volume to cy",
        steps: [
          "fn slab_volume(area, thk_in) = vol_rect(area, thk_in)",
          "volume = slab_volume(2400 sf, 5 in)",
          "to_cy(volume)",
        ],
        expect: expectNear(37.037037037),
      },
      {
        name: "for loop with computed step",
        steps: ["total = 0", "for i in 2..10 step 2 + 1: total = total + i", "total"],
        expect: 15,
      },
      {
        name: "descending loop with condition",
        steps: [
          "total = 0",
          "for i in 9..1 step -2: if i > 4: total = total + i else: total = total + (i * 2)",
          "total",
        ],
        expect: 29,
      },
      {
        name: "repeat loop unit round_up",
        steps: ["total = 0 ft", "repeat 4: total = total + 2.5 ft", "round_up(total, 2 ft)"],
        expect: expectQty(10, "len"),
      },
      {
        name: "if function with logical",
        expr: "if(5 > 3 && 2 < 1, 10, 20) + if(3 == 3, 7, 0)",
        expect: 27,
      },
      {
        name: "unit conversion length expression",
        expr: "to_in(6 ft + 18 in)",
        expect: 90,
      },
      {
        name: "equation solver slab area",
        expr: "80 cy = concrete_cy(sf, 5 in)",
        expect: 5184,
      },
      {
        name: "pipe weight to tons",
        steps: ["wt = pipe_wt(2, 40, 120 ft)", "to_ton(wt)"],
        expect: expectNear(0.219),
      },
    ];
  }

  function formatTestValue(value){
    if (isQty(value)) return qtyToString(value);
    if (isAssembly(value)) return formatAssemblySummary(value);
    return String(value);
  }

  function evaluateTestStatements(source){
    const statements = splitStatements(source);
    let lastValue = null;
    for (const stmt of statements){
      const parsed = evaluate(stmt);
      if (!parsed) continue;
      if (parsed.type === "cmd") throw new Error(`Test cannot use command :${parsed.cmd}`);
      if (parsed.type === "def"){
        defineUserFn(parsed.name, parsed.params, parsed.expr);
        continue;
      }
      if (parsed.type === "assy"){
        const assembly = createAssembly(parsed.name, parsed.fields);
        state.vars[parsed.name] = assembly;
        lastValue = assembly;
        continue;
      }
      if (parsed.type === "assign"){
        const val = runExpression(parsed.expr);
        state.vars[parsed.name] = val;
        lastValue = val;
        continue;
      }
      if (parsed.type === "equation"){
        const solved = solveEquation(parsed.left, parsed.right);
        if (solved.unknown.unitToken){
          lastValue = makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind);
        }else{
          lastValue = solved.value;
          state.vars[solved.unknown.name] = solved.value;
        }
        continue;
      }
      if (parsed.type === "if"){
        const cond = runExpression(parsed.condition);
        if (isTruthy(cond)){
          lastValue = evaluateTestStatements(parsed.thenBody);
        }else if (parsed.elseBody){
          lastValue = evaluateTestStatements(parsed.elseBody);
        }
        continue;
      }
      if (parsed.type === "for"){
        const startVal = runExpression(parsed.startExpr);
        const endVal = runExpression(parsed.endExpr);
        const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr) : 1;
        let start;
        let end;
        let step;
        let loopKind = null;
        if (isQty(startVal) || isQty(endVal)){
          if (!isQty(startVal) || !isQty(endVal)){
            throw new Error("for loop range must use matching unit quantities");
          }
          if (startVal.kind !== endVal.kind){
            throw new Error("for loop range units must match");
          }
          loopKind = startVal.kind;
          start = startVal.value;
          end = endVal.value;
          if (isQty(stepVal)){
            if (stepVal.kind !== loopKind) throw new Error("for loop step unit mismatch");
            step = stepVal.value;
          }else{
            step = stepVal;
          }
        }else{
          [start, end] = normalizeCompare(startVal, endVal);
          step = normalizeCompare(stepVal, 0)[0];
        }
        if (step === 0) throw new Error("for loop step cannot be 0");
        const hadVar = Object.prototype.hasOwnProperty.call(state.vars, parsed.varName);
        const prevVal = state.vars[parsed.varName];
        const forward = step > 0;
        for (let i = start; forward ? i <= end : i >= end; i += step){
          state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          lastValue = evaluateTestStatements(parsed.body);
        }
        if (hadVar) state.vars[parsed.varName] = prevVal;
        else delete state.vars[parsed.varName];
        continue;
      }
      if (parsed.type === "repeat"){
        const countVal = runExpression(parsed.countExpr);
        const count = normalizeCompare(countVal, 0)[0];
        if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
        for (let i = 0; i < Math.floor(count); i++){
          lastValue = evaluateTestStatements(parsed.body);
        }
        continue;
      }
      if (parsed.type === "expr"){
        lastValue = runExpression(parsed.expr);
      }
    }
    return lastValue;
  }

  function matchExpected(actual, expected){
    const tol = 1e-9;
    if (expected && typeof expected === "object" && expected.type === "qty"){
      if (!isQty(actual)) return { pass: false, message: `expected quantity ${expected.kind}` };
      if (actual.kind !== expected.kind) return { pass: false, message: `expected ${expected.kind}, got ${actual.kind}` };
      const delta = Math.abs(actual.value - expected.value);
      if (delta > expected.tol) return { pass: false, message: `expected ${expected.value} ${expected.kind}, got ${actual.value} ${actual.kind}` };
      return { pass: true };
    }
    if (expected && typeof expected === "object" && expected.type === "scalar"){
      const actualValue = isQty(actual) ? actual.value : actual;
      const delta = Math.abs(actualValue - expected.value);
      if (delta > expected.tol) return { pass: false, message: `expected ${expected.value}, got ${actualValue}` };
      return { pass: true };
    }
    if (typeof expected === "number"){
      const actualValue = isQty(actual) ? actual.value : actual;
      if (Math.abs(actualValue - expected) > tol){
        return { pass: false, message: `expected ${expected}, got ${actualValue}` };
      }
      return { pass: true };
    }
    if (Object.is(actual, expected)) return { pass: true };
    return { pass: false, message: `expected ${String(expected)}, got ${formatTestValue(actual)}` };
  }

  function formatExpectedValue(expected){
    if (expected && typeof expected === "object" && expected.type === "qty"){
      return qtyToString(makeQty(expected.value, expected.kind));
    }
    if (expected && typeof expected === "object" && expected.type === "scalar"){
      return String(expected.value);
    }
    if (typeof expected === "number") return String(expected);
    if (expected === undefined) return "undefined";
    return String(expected);
  }

  function runTestSuite(){
    setStatus("Testing...", "warn");
    writeLine("Running REPLCalc tests...", "ok");
    const savedState = {
      vars: state.vars,
      userFns: state.userFns,
      history: state.history,
      histIdx: state.histIdx,
    };
    state.vars = Object.create(null);
    state.userFns = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    renderUserFunctions();

    const tests = createTestSuite();
    let passCount = 0;
    const failures = [];

    writeLine(`Test plan: ${tests.length} checks.`, "muted");

    for (const test of tests){
      try{
        state.vars = Object.create(null);
        state.userFns = Object.create(null);
        state.history = [];
        state.histIdx = -1;
        const source = test.steps ? test.steps.join("\n") : test.expr;
        const formattedSource = formatInput(source);
        const formattedExpected = formatExpectedValue(test.expect);
        const result = evaluateTestStatements(source);
        const match = matchExpected(result, test.expect);
        writeLine(`• ${test.name}`, "muted");
        writeLine(`  input: ${formattedSource}`, "muted");
        writeLine(`  outcome: ${formatTestValue(result)}`, "muted");
        writeLine(`  expected: ${formattedExpected}`, "muted");
        if (match.pass){
          passCount += 1;
          writeLine(`✓ ${test.name}`, "ok");
        }else{
          failures.push({ name: test.name, reason: match.message || "failed" });
          writeLine(`✗ ${test.name}: ${match.message || "failed"}`, "err");
        }
      }catch(err){
        const source = test.steps ? test.steps.join("\n") : test.expr;
        const formattedSource = formatInput(source);
        const formattedExpected = formatExpectedValue(test.expect);
        failures.push({ name: test.name, reason: err.message || String(err) });
        writeLine(`• ${test.name}`, "muted");
        writeLine(`  input: ${formattedSource}`, "muted");
        writeLine(`  outcome: error (${err.message || String(err)})`, "muted");
        writeLine(`  expected: ${formattedExpected}`, "muted");
        writeLine(`✗ ${test.name}: ${err.message || String(err)}`, "err");
      }
    }

    state.vars = savedState.vars;
    state.userFns = savedState.userFns;
    state.history = savedState.history;
    state.histIdx = savedState.histIdx;
    renderUserFunctions();

    if (!failures.length){
      writeLine(`Tests complete: ${passCount}/${tests.length} passed.`, "ok");
    }else{
      writeLine(`Tests complete: ${passCount}/${tests.length} passed.`, "warn");
      failures.forEach((fail) => {
        writeLine(`✗ ${fail.name}: ${fail.reason}`, "err");
      });
    }
    setStatus("Ready", "ok");
  }

  function formatTokens(tokens){
    const parts = tokens.map((t) => {
      if (t.type === "num") return String(t.value);
      if (t.type === "str") return JSON.stringify(t.value);
      if (t.type === "id") return t.value;
      if (t.type === "op") return ` ${t.value} `;
      if (t.type === ",") return ", ";
      if (t.type === "(" || t.type === ")") return t.type;
      return "";
    });
    return parts.join("")
      .replace(/\s+/g, " ")
      .replace(/\s+\)/g, ")")
      .replace(/\(\s+/g, "(")
      .replace(/\s+,/g, ",")
      .replace(/,\s*/g, ", ")
      .replace(/\s+$/g, "")
      .trim();
  }

  function formatExpression(expr){
    const trimmed = expr.trim();
    if (!trimmed) return expr.trimEnd();
    try{
      const tokens = tokenize(trimmed);
      return formatTokens(tokens);
    }catch{
      return expr.trimEnd();
    }
  }

  function formatInput(source){
    return source.split("\n").map((line) => {
      const leading = (line.match(/^\s*/) || [""])[0];
      const trimmed = line.trim();
      if (!trimmed) return line.trimEnd();
      const defMatch = trimmed.match(/^(?:def|fn|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/);
      if (defMatch){
        const formattedExpr = formatExpression(defMatch[3]);
        const params = defMatch[2].split(",").map((p) => p.trim()).filter(Boolean).join(", ");
        return `${leading}fn ${defMatch[1]}(${params}) = ${formattedExpr}`;
      }
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
      if (m){
        const formattedExpr = formatExpression(m[2]);
        return `${leading}${m[1]} = ${formattedExpr}`;
      }
      return `${leading}${formatExpression(trimmed)}`;
    }).join("\n");
  }

  function isStatementComplete(source){
    const trimmed = source.trim();
    if (!trimmed) return false;
    let quote = null;
    for (let i = 0; i < trimmed.length; i++){
      const c = trimmed[i];
      if (c === "\\" && quote){
        i += 1;
        continue;
      }
      if (!quote && (c === "\"" || c === "'")){
        quote = c;
        continue;
      }
      if (quote && c === quote){
        quote = null;
      }
    }
    if (quote) return false;
    let depth = 0;
    let braceDepth = 0;
    for (const c of trimmed){
      if (c === "(") depth += 1;
      if (c === ")") depth -= 1;
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth -= 1;
      if (depth < 0 || braceDepth < 0) return true;
    }
    if (depth > 0 || braceDepth > 0) return false;
    return !/[+\-*/^,=<>!&|:]$/.test(trimmed);
  }

  function escapeHtml(text){
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightSource(source){
    const value = source || "";
    if (!value) return "&nbsp;";
    let out = "";
    let i = 0;
    const isDigit = c => /[0-9]/.test(c);
    const isIdentStart = c => /[A-Za-z_]/.test(c);
    const isIdent = c => /[A-Za-z0-9_]/.test(c);
    const fnSet = new Set(Object.keys(getFns()));
    const unitSet = new Set(Object.keys(UNIT));
    const varSet = new Set(Object.keys(state.vars));
    const cmdSet = new Set(COMMANDS.map((c) => c.label));
    const keywordSet = KEYWORDS;

    while (i < value.length){
      const c = value[i];
      if (c === "\n"){
        out += "\n";
        i += 1;
        continue;
      }
      if (/\s/.test(c)){
        out += c;
        i += 1;
        continue;
      }
      const twoChar = value.slice(i, i + 2);
      if (["==","!=",">=","<=","&&","||"].includes(twoChar)){
        out += `<span class="token-op">${escapeHtml(twoChar)}</span>`;
        i += 2;
        continue;
      }
      if (c === "\"" || c === "'"){
        const quote = c;
        let j = i + 1;
        while (j < value.length){
          const ch = value[j];
          if (ch === "\\"){
            j += 2;
            continue;
          }
          if (ch === quote){
            j += 1;
            break;
          }
          j += 1;
        }
        out += `<span class="token-string">${escapeHtml(value.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (isDigit(c) || (c === "." && isDigit(value[i + 1]))){
        let j = i + 1;
        while (j < value.length && /[0-9.eE+-]/.test(value[j])) j += 1;
        out += `<span class="token-number">${escapeHtml(value.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (isIdentStart(c) || c === ":"){
        let j = i + 1;
        while (j < value.length && (isIdent(value[j]) || value[j] === ":")) j += 1;
        const word = value.slice(i, j);
        let cls = "token-var";
        if (cmdSet.has(word)) cls = "token-cmd";
        else if (fnSet.has(word)) cls = "token-fn";
        else if (unitSet.has(word)) cls = "token-unit";
        else if (keywordSet.has(word)) cls = "token-keyword";
        else if (varSet.has(word)) cls = "token-var";
        out += `<span class="${cls}">${escapeHtml(word)}</span>`;
        i = j;
        continue;
      }
      if ("+-*/^=,<>&|!".includes(c)){
        out += `<span class="token-op">${escapeHtml(c)}</span>`;
        i += 1;
        continue;
      }
      out += escapeHtml(c);
      i += 1;
    }
    return out || "&nbsp;";
  }

  function syncEditorHeight(){
    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 220)}px`;
  }

  function updateHighlight(){
    highlightEl.innerHTML = highlightSource(inputEl.value);
  }

  function setLiveResult(text, kind="muted"){
    const label = kind === "err" ? "Error" : kind === "warn" ? "Incomplete" : "Live result";
    const display = text ? `<strong>${text}</strong>` : `<span class="muted">—</span>`;
    liveResultEl.className = `liveResult ${kind}`;
    liveResultEl.innerHTML = `${label}: ${display}`;
  }

  let liveTimer = null;
  function scheduleLiveResult(){
    if (liveTimer) window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => {
      updateLiveResult();
    }, 220);
  }

  function updateLiveResult(){
    const src = inputEl.value;
    if (!src.trim()){
      setLiveResult("", "muted");
      return;
    }
    if (!isStatementComplete(src)){
      setLiveResult("statement incomplete", "warn");
      return;
    }
    const formatted = formatInput(src);
    try{
      const parsed = evaluate(formatted);
      if (!parsed) return;
      if (parsed.type === "cmd"){
        setLiveResult(parsed.cmd ? `:${parsed.cmd}` : "command", "muted");
        return;
      }
      if (parsed.type === "def"){
        setLiveResult(`define ${parsed.name}(${parsed.params.join(", ")})`, "ok");
        return;
      }
      if (parsed.type === "assy"){
        setLiveResult(`assy ${parsed.name}`, "ok");
        return;
      }
      if (parsed.type === "equation"){
        try{
          const solved = solveEquation(parsed.left, parsed.right);
          setLiveResult(`solve for ${solved.unknown.name}`, "ok");
        }catch(err){
          setLiveResult(err.message || String(err), "err");
        }
        return;
      }
      if (parsed.type === "if"){
        setLiveResult("if statement", "ok");
        return;
      }
      if (parsed.type === "for"){
        setLiveResult(`for ${parsed.varName} in ...`, "ok");
        return;
      }
      if (parsed.type === "repeat"){
        setLiveResult("repeat statement", "ok");
        return;
      }
      if (parsed.type === "assign"){
        const previewVars = Object.assign(Object.create(null), state.vars);
        const val = runExpressionWithContext(parsed.expr, previewVars);
        const fr = formatValueDisplay(val);
        setLiveResult(`${parsed.name} = ${fr.main}`, "ok");
        return;
      }
      if (parsed.type === "expr"){
        const previewVars = Object.assign(Object.create(null), state.vars);
        const val = runExpressionWithContext(parsed.expr, previewVars);
        const fr = formatValueDisplay(val);
        setLiveResult(fr.main, "ok");
      }
    }catch(err){
      setLiveResult(err.message || String(err), "err");
    }
  }

  const autocompleteState = {
    items: [],
    index: -1,
    start: 0,
    end: 0,
    open: false,
    userNavigated: false,
  };

  const FN_DOCS = {
    abs: { usage: "abs(x)", doc: "Absolute value." },
    min: { usage: "min(a, b)", doc: "Smaller of two values." },
    max: { usage: "max(a, b)", doc: "Larger of two values." },
    round: { usage: "round(x)", doc: "Round to nearest integer." },
    ceil: { usage: "ceil(x)", doc: "Round up to integer." },
    floor: { usage: "floor(x)", doc: "Round down to integer." },
    sqrt: { usage: "sqrt(x)", doc: "Square root." },
    pow: { usage: "pow(a, b)", doc: "a raised to the power b." },
    exp: { usage: "exp(x)", doc: "e to the power x." },
    log: { usage: "log(x)", doc: "Natural logarithm." },
    log10: { usage: "log10(x)", doc: "Base-10 logarithm." },
    sin: { usage: "sin(x)", doc: "Sine of radians." },
    cos: { usage: "cos(x)", doc: "Cosine of radians." },
    tan: { usage: "tan(x)", doc: "Tangent of radians." },
    asin: { usage: "asin(x)", doc: "Arcsine (radians)." },
    acos: { usage: "acos(x)", doc: "Arccosine (radians)." },
    atan: { usage: "atan(x)", doc: "Arctangent (radians)." },
    atan2: { usage: "atan2(y, x)", doc: "Arctangent from y/x." },
    clamp: { usage: "clamp(x, min, max)", doc: "Clamp between min and max." },
    if: { usage: "if(cond, a, b)", doc: "Return a if cond is true, else b." },
    waste: { usage: "waste(qty, pct)", doc: "Apply waste percentage to quantity." },
    markup: { usage: "markup(cost, pct)", doc: "Apply markup percentage." },
    burden: { usage: "burden(labor, pct)", doc: "Apply labor burden percentage." },
    unit: { usage: "unit(cost, qty)", doc: "Unit cost from total and quantity." },
    qty: { usage: "qty(assy, length)", doc: "Compute quantities from an assembly and length." },
    round_up: { usage: "round_up(x, step)", doc: "Round up to a step." },
    area_rect: { usage: "area_rect(a, b)", doc: "Area from length and width." },
    area_circle: { usage: "area_circle(diam)", doc: "Area from diameter." },
    vol_rect: { usage: "vol_rect(area, thk_in)", doc: "Volume from area and thickness." },
    concrete_cy: { usage: "concrete_cy(area, thk_in)", doc: "Concrete volume (quantity; use to_cy for scalar cubic yards)." },
    bf: { usage: "bf(t_in, w_in, len_ft, qty)", doc: "Board feet from size and quantity." },
    pipe_wt: { usage: "pipe_wt(nps, schedule, len_ft)", doc: "Pipe weight from NPS/schedule." },
    to_in: { usage: "to_in(x)", doc: "Convert length to inches." },
    to_ft: { usage: "to_ft(x)", doc: "Convert length to feet." },
    to_sf: { usage: "to_sf(x)", doc: "Convert area to square feet." },
    to_sy: { usage: "to_sy(x)", doc: "Convert area to square yards." },
    to_cf: { usage: "to_cf(x)", doc: "Convert volume to cubic feet." },
    to_cy: { usage: "to_cy(x)", doc: "Convert volume to cubic yards." },
    to_lb: { usage: "to_lb(x)", doc: "Convert weight to pounds." },
    to_ton: { usage: "to_ton(x)", doc: "Convert weight to tons." },
    eval: { usage: "eval(\"expr\")", doc: "Evaluate a string expression." },
    get: { usage: "get(\"name\")", doc: "Read a variable by name." },
    set: { usage: "set(\"name\", value)", doc: "Set a variable by name." },
    unset: { usage: "unset(\"name\")", doc: "Remove a variable by name." },
    vars: { usage: "vars()", doc: "List variable names." },
    methods: { usage: "methods()", doc: "List user function names." },
    define: { usage: "define(\"fn\", \"a,b\", \"expr\")", doc: "Define a user function." },
    undefine: { usage: "undefine(\"fn\")", doc: "Remove a user function." },
    gfx: { usage: "gfx(width, height)", doc: "Create a pixel buffer (max 160x160)." },
    gfxs: { usage: "gfxs(scale)", doc: "Set pixel scale for the buffer." },
    bg: { usage: "bg(color)", doc: "Set background color token." },
    cls: { usage: "cls()", doc: "Clear the pixel buffer." },
    pix: { usage: "pix(x, y, color)", doc: "Set a single pixel." },
    line: { usage: "line(x0, y0, x1, y1, color)", doc: "Draw a line." },
    rect: { usage: "rect(x, y, w, h, color)", doc: "Draw a rectangle outline." },
    fill: { usage: "fill(x, y, w, h, color)", doc: "Draw a filled rectangle." },
    plot: { usage: "plot(x, y, \"dx,dy|...\", color)", doc: "Plot relative vector steps from a start." },
  };

  function getFnAutocompleteMeta(name){
    if (Object.prototype.hasOwnProperty.call(state.userFns, name)){
      const defn = state.userFns[name];
      const params = defn.params ? defn.params.join(", ") : "";
      return { usage: `${name}(${params})`, doc: `= ${defn.expr}` };
    }
    if (Object.prototype.hasOwnProperty.call(FN_DOCS, name)){
      return FN_DOCS[name];
    }
    const fn = getFns()[name];
    if (fn && typeof fn.arity === "number"){
      const params = Array.from({ length: fn.arity }, (_, idx) => `arg${idx + 1}`);
      return { usage: `${name}(${params.join(", ")})`, doc: "Built-in function." };
    }
    return { usage: `${name}()`, doc: "" };
  }

  function getTokenAtCursor(value, cursor){
    let start = cursor;
    while (start > 0 && /[A-Za-z0-9_:]/.test(value[start - 1])) start -= 1;
    let end = cursor;
    while (end < value.length && /[A-Za-z0-9_:]/.test(value[end])) end += 1;
    return { text: value.slice(start, end), start, end };
  }

  function buildAutocompleteItems(prefix){
    if (!prefix) return [];
    const lowered = prefix.toLowerCase();
    const items = [];
    const addItem = (label, kind, detail, insertText = label, usage = "", doc = "") => {
      items.push({ label, kind, detail, insertText, usage, doc });
    };

    if (prefix.startsWith(":")){
      for (const cmd of COMMANDS){
        if (cmd.label.toLowerCase().startsWith(lowered)){
          addItem(cmd.label, "command", cmd.detail, cmd.label);
        }
      }
      return items;
    }

    for (const name of Object.keys(getFns())){
      if (name.toLowerCase().startsWith(lowered)){
        const detail = Object.prototype.hasOwnProperty.call(state.userFns, name) ? "user" : "fn";
        const meta = getFnAutocompleteMeta(name);
        addItem(name, "function", detail, `${name}(`, meta.usage, meta.doc);
      }
    }
    for (const unit of Object.keys(UNIT)){
      if (unit.startsWith(lowered)){
        addItem(unit, "unit", "unit", unit);
      }
    }
    for (const name of Object.keys(state.vars)){
      if (name.toLowerCase().startsWith(lowered)){
        addItem(name, "variable", "var", name);
      }
    }
    for (const constant of ["pi", "e"]){
      if (constant.startsWith(lowered)){
        addItem(constant, "constant", "const", constant);
      }
    }
    return items;
  }

  function renderAutocomplete(){
    autocompleteEl.innerHTML = "";
    if (!autocompleteState.open || !autocompleteState.items.length){
      autocompleteEl.classList.remove("active");
      return;
    }
    autocompleteEl.classList.add("active");
    const listEl = document.createElement("div");
    listEl.className = "autocomplete-list";
    autocompleteState.items.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = `item${idx === autocompleteState.index ? " active" : ""}`;
      row.setAttribute("role", "option");
      row.innerHTML = `<div>${item.label}</div><span>${item.detail}</span>`;
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyAutocomplete(idx);
      });
      listEl.appendChild(row);
    });
    const detailEl = document.createElement("div");
    detailEl.className = "autocomplete-detail";
    const activeItem = autocompleteState.items[autocompleteState.index];
    if (activeItem){
      const usage = document.createElement("div");
      usage.className = "usage";
      usage.textContent = activeItem.usage || activeItem.label;
      const doc = document.createElement("div");
      doc.className = "doc";
      doc.textContent = activeItem.doc || activeItem.detail;
      detailEl.append(usage, doc);
    }
    autocompleteEl.append(listEl, detailEl);
  }

  function openAutocomplete(token){
    autocompleteState.items = buildAutocompleteItems(token.text);
    autocompleteState.index = autocompleteState.items.length ? 0 : -1;
    autocompleteState.start = token.start;
    autocompleteState.end = token.end;
    autocompleteState.open = autocompleteState.items.length > 0;
    autocompleteState.userNavigated = false;
    renderAutocomplete();
  }

  function closeAutocomplete(){
    autocompleteState.open = false;
    autocompleteState.items = [];
    autocompleteState.index = -1;
    autocompleteState.userNavigated = false;
    renderAutocomplete();
  }

  function applyAutocomplete(index){
    const item = autocompleteState.items[index];
    if (!item) return;
    const value = inputEl.value;
    const before = value.slice(0, autocompleteState.start);
    const after = value.slice(autocompleteState.end);
    const insert = item.insertText;
    const needsSpace = item.kind === "command" ? " " : "";
    const nextValue = `${before}${insert}${needsSpace}${after}`;
    const cursorPos = before.length + insert.length + needsSpace.length;
    inputEl.value = nextValue;
    inputEl.focus();
    inputEl.setSelectionRange(cursorPos, cursorPos);
    closeAutocomplete();
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
  }

  async function handleLine(line){
    const statements = splitStatements(line);
    if (!statements.length) return;

    try{
      for (const stmt of statements){
        const parsed = evaluate(stmt);
        if (!parsed) continue;

        if (parsed.type === "cmd"){
          const {cmd,arg} = parsed;
          if (cmd === "help"){ showHelp(); continue; }
          if (cmd === "docs"){ showDocs(); continue; }
          if (cmd === "clear"){ clearTerminal(); continue; }
          if (cmd === "vars"){ listVars(); continue; }
          if (cmd === "methods"){ listMethods(); continue; }
          if (cmd === "reset"){ resetAll(); continue; }
          if (cmd === "save"){ saveProfile(arg); continue; }
          if (cmd === "load"){ loadProfile(arg); continue; }
          if (cmd === "profiles"){ listProfiles(); continue; }
          if (cmd === "theme"){ setTheme((arg||"").trim()); writeLine(`Theme set to ${state.theme}.`, "ok"); continue; }
          if (cmd === "test"){ runTestSuite(); continue; }

          if (cmd === "export"){
            const text = exportSession();
            await copyText(text);
            continue;
          }
          if (cmd === "import"){
            const text = await readClipboard();
            importSession(text);
            writeLine("Imported session from clipboard.", "ok");
            continue;
          }
          throw new Error(`Unknown command: :${cmd}`);
        }

        if (parsed.type === "def"){
          const existed = Object.prototype.hasOwnProperty.call(state.userFns, parsed.name);
          defineUserFn(parsed.name, parsed.params, parsed.expr);
          const verb = existed ? "Updated" : "Added";
          writeLine(`${verb} function ${parsed.name}(${parsed.params.join(", ")}).`, "ok");
          continue;
        }

        if (parsed.type === "assy"){
          const assembly = createAssembly(parsed.name, parsed.fields);
          state.vars[parsed.name] = assembly;
          const fr = formatValueDisplay(assembly);
          writeLine(`${parsed.name} = ${fr.main}`, "ok");
          continue;
        }

        if (parsed.type === "assign"){
          const val = runExpression(parsed.expr);
          state.vars[parsed.name] = val;
          const fr = formatValueDisplay(val);
          writeLine(`${parsed.name} = ${fr.main}`, "ok");
          if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
          continue;
        }

        if (parsed.type === "equation"){
          const solved = solveEquation(parsed.left, parsed.right);
          let solvedValue;
          if (solved.unknown.unitToken){
            solvedValue = makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind);
          }else{
            solvedValue = solved.value;
            state.vars[solved.unknown.name] = solvedValue;
          }
          const fr = formatResult(solvedValue);
          writeLine(`${solved.unknown.name} = ${fr.main}`, "ok");
          if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
          continue;
        }

        if (parsed.type === "if"){
          const cond = runExpression(parsed.condition);
          if (isTruthy(cond)){
            await handleLine(parsed.thenBody);
          }else if (parsed.elseBody){
            await handleLine(parsed.elseBody);
          }
          continue;
        }

        if (parsed.type === "for"){
          const startVal = runExpression(parsed.startExpr);
          const endVal = runExpression(parsed.endExpr);
          const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr) : 1;
          let start;
          let end;
          let step;
          let loopKind = null;
          if (isQty(startVal) || isQty(endVal)){
            if (!isQty(startVal) || !isQty(endVal)){
              throw new Error("for loop range must use matching unit quantities");
            }
            if (startVal.kind !== endVal.kind){
              throw new Error("for loop range units must match");
            }
            loopKind = startVal.kind;
            start = startVal.value;
            end = endVal.value;
            if (isQty(stepVal)){
              if (stepVal.kind !== loopKind) throw new Error("for loop step unit mismatch");
              step = stepVal.value;
            }else{
              step = stepVal;
            }
          }else{
            [start, end] = normalizeCompare(startVal, endVal);
            step = normalizeCompare(stepVal, 0)[0];
          }
          if (step === 0) throw new Error("for loop step cannot be 0");
          const hadVar = Object.prototype.hasOwnProperty.call(state.vars, parsed.varName);
          const prevVal = state.vars[parsed.varName];
          const forward = step > 0;
          for (let i = start; forward ? i <= end : i >= end; i += step){
            state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
            await handleLine(parsed.body);
          }
          if (hadVar) state.vars[parsed.varName] = prevVal;
          else delete state.vars[parsed.varName];
          continue;
        }

        if (parsed.type === "repeat"){
          const countVal = runExpression(parsed.countExpr);
          const count = normalizeCompare(countVal, 0)[0];
          if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
          for (let i = 0; i < Math.floor(count); i++){
            await handleLine(parsed.body);
          }
          continue;
        }

        if (parsed.type === "expr"){
          const val = runExpression(parsed.expr);
          const fr = formatValueDisplay(val);
          writeLine(fr.main, "out");
          if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
          continue;
        }
      }
    }catch(err){
      setStatus("Error", "err");
      writeLine(`[${nowStamp()}] ${err.message || String(err)}`, "err");
    }finally{
      flushGfxOutput();
      setStatus("Ready", "ok");
    }
  }

  function parseParams(paramText){
    if (!paramText.trim()) return [];
    const params = paramText.split(",").map((p) => p.trim()).filter(Boolean);
    const seen = new Set();
    for (const p of params){
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p)) throw new Error(`Invalid parameter name: ${p}`);
      if (seen.has(p)) throw new Error(`Duplicate parameter name: ${p}`);
      seen.add(p);
    }
    return params;
  }

  function getFns(){
    return Object.assign(Object.create(null), baseFns, metaFns, state.userFns);
  }

  function defineUserFn(name, params, expr){
    if (Object.prototype.hasOwnProperty.call(baseFns, name) || Object.prototype.hasOwnProperty.call(metaFns, name)){
      throw new Error(`Cannot redefine built-in function: ${name}`);
    }
    const defn = defFn(name, params.length, (...args) => {
      const scoped = Object.create(null);
      Object.assign(scoped, state.vars);
      params.forEach((param, idx) => {
        scoped[param] = args[idx];
      });
      return runExpressionWithContext(expr, scoped);
    });
    defn.params = params.slice();
    defn.expr = expr.trim();
    defn.name = name;
    state.userFns[name] = defn;
    renderUserFunctions();
  }

  // -----------------------------
  // Input behavior: history, run, etc.
  // -----------------------------
  function pushHistory(line){
    const trimmed = line.trim();
    if (!trimmed) return;
    if (state.history.length && state.history[state.history.length-1] === trimmed) return;
    state.history.push(trimmed);
    if (state.history.length > 500) state.history.shift();
    state.histIdx = state.history.length;
  }

  function countOpenParens(text){
    let depth = 0;
    for (const c of text){
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(depth - 1, 0);
    }
    return depth;
  }

  function getIndentation(value, cursor){
    const before = value.slice(0, cursor);
    const lineStart = before.lastIndexOf("\n") + 1;
    const line = before.slice(lineStart);
    const leading = (line.match(/^\s*/) || [""])[0];
    const depth = countOpenParens(before);
    let desired = "  ".repeat(depth);
    const trimmed = line.trim();
    if (!depth && trimmed.endsWith(":")){
      desired += "  ";
    }
    return desired.length > leading.length ? desired : leading;
  }

  async function submitInput(){
    const raw = inputEl.value;
    const formatted = formatInput(raw);
    if (!formatted.trim()) return;
    inputEl.value = "";
    closeAutocomplete();
    writeInputEcho(formatted);
    pushHistory(formatted);
    updateHighlight();
    syncEditorHeight();
    await handleLine(formatted);
    scheduleLiveResult();
  }

  inputEl.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey){
      if (autocompleteState.open && autocompleteState.userNavigated){
        applyAutocomplete(autocompleteState.index);
        e.preventDefault();
        return;
      }
      const value = inputEl.value;
      if (!isStatementComplete(value)){
        const cursor = inputEl.selectionStart;
        const indent = getIndentation(value, cursor);
        const insert = `\n${indent}`;
        const before = value.slice(0, cursor);
        const after = value.slice(inputEl.selectionEnd);
        inputEl.value = `${before}${insert}${after}`;
        const newPos = before.length + insert.length;
        inputEl.setSelectionRange(newPos, newPos);
        updateHighlight();
        syncEditorHeight();
        scheduleLiveResult();
        e.preventDefault();
        return;
      }
      await submitInput();
      e.preventDefault();
      return;
    }

    if (autocompleteState.open){
      if (e.key === "ArrowDown"){
        autocompleteState.index = (autocompleteState.index + 1) % autocompleteState.items.length;
        autocompleteState.userNavigated = true;
        renderAutocomplete();
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp"){
        autocompleteState.index = (autocompleteState.index - 1 + autocompleteState.items.length) % autocompleteState.items.length;
        autocompleteState.userNavigated = true;
        renderAutocomplete();
        e.preventDefault();
        return;
      }
      if (e.key === "Tab"){
        applyAutocomplete(autocompleteState.index);
        e.preventDefault();
        return;
      }
      if (e.key === "Escape"){
        closeAutocomplete();
        e.preventDefault();
        return;
      }
    }

    if (e.key === "ArrowUp" && !autocompleteState.open){
      if (!state.history.length) return;
      state.histIdx = Math.max(0, state.histIdx - 1);
      inputEl.value = state.history[state.histIdx] || "";
      updateHighlight();
      syncEditorHeight();
      scheduleLiveResult();
      setTimeout(() => inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length), 0);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown" && !autocompleteState.open){
      if (!state.history.length) return;
      state.histIdx = Math.min(state.history.length, state.histIdx + 1);
      inputEl.value = state.history[state.histIdx] || "";
      updateHighlight();
      syncEditorHeight();
      scheduleLiveResult();
      setTimeout(() => inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length), 0);
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l"){
      clearTerminal();
      e.preventDefault();
    }
  });

  inputEl.addEventListener("input", () => {
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
    const cursor = inputEl.selectionStart;
    const token = getTokenAtCursor(inputEl.value, cursor);
    if (token.text){
      openAutocomplete(token);
    }else{
      closeAutocomplete();
    }
  });

  inputEl.addEventListener("scroll", () => {
    highlightEl.scrollTop = inputEl.scrollTop;
    highlightEl.scrollLeft = inputEl.scrollLeft;
  });

  inputEl.addEventListener("blur", () => {
    closeAutocomplete();
  });

  // Buttons
  btnHelp.addEventListener("click", showHelp);
  btnClear.addEventListener("click", clearTerminal);
  btnVars.addEventListener("click", listVars);
  btnMethods.addEventListener("click", listMethods);
  btnReset.addEventListener("click", resetAll);

  btnExport.addEventListener("click", async () => {
    const text = exportSession();
    await copyText(text);
  });
  btnImport.addEventListener("click", async () => {
    try{
      const text = await readClipboard();
      importSession(text);
      writeLine("Imported session from clipboard.", "ok");
    }catch(err){
      writeLine(err.message || String(err), "err");
    }
  });

  btnFnSave.addEventListener("click", () => {
    try{
      const name = fnNameInput.value.trim();
      const expr = fnExprInput.value.trim();
      if (!name) throw new Error("Function name is required.");
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid function name.");
      if (!expr) throw new Error("Function expression is required.");
      const params = parseParams(fnParamsInput.value);
      const existed = Object.prototype.hasOwnProperty.call(state.userFns, name);
      defineUserFn(name, params, expr);
      const verb = existed ? "Updated" : "Added";
      writeLine(`${verb} function ${name}(${params.join(", ")}).`, "ok");
      clearFnForm();
    }catch(err){
      writeLine(err.message || String(err), "err");
    }
  });

  btnFnClear.addEventListener("click", () => {
    clearFnForm();
    fnNameInput.focus();
  });

  // -----------------------------
  // Boot message + defaults
  // -----------------------------
  function boot(){
    setTheme("default");
    writeLine("Estimator REPL initialized.", "ok");
    writeLine("Type :help for commands and examples.", "muted");
    writeLine("Try: concrete_cy(1200 sf, 4 in)", "muted");
    writeLine("Try: total = markup(burden(12500, 16.7), 35)", "muted");
    writeLine("Try: fn crew_cost(rate, hours) = rate * hours", "muted");
    writeLine("Try: for i in 1..4: total = total + i", "muted");
    writeLine("Try: gfx(32, 16); line(0,0,31,15,\"accent\")", "muted");

    // A couple default constants you might like in estimating:
    state.vars.hr = 1; // placeholder if you want
    state.vars.pi = Math.PI;

    renderUserFunctions();
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
    inputEl.focus();
  }

  boot();
}
