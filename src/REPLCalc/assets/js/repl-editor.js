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
  { label: ":latent", detail: "latent mux walker" },
  { label: ":test", detail: "run tests" },
];

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
  tax: { usage: "tax(cost, pct)", doc: "Apply tax percentage." },
  contingency: { usage: "contingency(cost, pct)", doc: "Apply contingency percentage." },
  overhead: { usage: "overhead(cost, pct)", doc: "Apply overhead percentage." },
  profit: { usage: "profit(cost, pct)", doc: "Apply profit percentage." },
  ohp: { usage: "ohp(cost, overhead_pct, profit_pct)", doc: "Apply overhead and profit sequentially." },
  discount: { usage: "discount(cost, pct)", doc: "Apply discount percentage." },
  retainage: { usage: "retainage(cost, pct)", doc: "Apply retainage percentage." },
  escalate: { usage: "escalate(cost, pct, periods)", doc: "Escalate by percent per period." },
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
  methods: { usage: "methods()", doc: "List user solution names." },
  define: { usage: "define(\"name\", \"a,b\", \"expr\")", doc: "Define a user solution." },
  undefine: { usage: "undefine(\"name\")", doc: "Remove a user solution." },
  gfx: { usage: "gfx(width, height)", doc: "Create a pixel buffer (max 160x160)." },
  gfxs: { usage: "gfxs(scale)", doc: "Set pixel scale for the buffer." },
  bg: { usage: "bg(color)", doc: "Set background color token." },
  cls: { usage: "cls()", doc: "Clear the pixel buffer." },
  pix: { usage: "pix(x, y, color)", doc: "Set a single pixel." },
  line: { usage: "line(x0, y0, x1, y1, color)", doc: "Draw a line." },
  rect: { usage: "rect(x, y, w, h, color)", doc: "Draw a rectangle outline." },
  fill: { usage: "fill(x, y, w, h, color)", doc: "Draw a filled rectangle." },
  plot: { usage: "plot(x, y, \"dx,dy|...\", color)", doc: "Plot relative vector steps from a start." },
  budgetpolicy: { usage: "budgetpolicy(\"balanced\")", doc: "Set global budget policy: interactive, performance, balanced, cinematic, headless-batch." },
  budgetstats: { usage: "budgetstats()", doc: "Show per-stage budget telemetry and memory snapshot." },
  budgethud: { usage: "budgethud(1)", doc: "Toggle on-canvas budget debug HUD." },
};

export function createEditor({
  state,
  inputEl,
  highlightEl,
  autocompleteEl,
  liveResultEl,
  getFns,
  evaluate,
  runExpressionWithContext,
  solveEquation,
  formatValueDisplay,
  tokenize,
  UNIT,
  KEYWORDS,
}){
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
      const defMatch = trimmed.match(/^(?:def|fn|so|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/);
      if (defMatch){
        const formattedExpr = formatExpression(defMatch[3]);
        const params = defMatch[2].split(",").map((p) => p.trim()).filter(Boolean).join(", ");
        return `${leading}so ${defMatch[1]}(${params}) = ${formattedExpr}`;
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

    for (const line of trimmed.split("\n")){
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith("#")) continue;
      if (/=$/.test(t)) return false;
    }

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

  return {
    formatInput,
    isStatementComplete,
    syncEditorHeight,
    updateHighlight,
    scheduleLiveResult,
    updateLiveResult,
    setLiveResult,
    getTokenAtCursor,
    openAutocomplete,
    closeAutocomplete,
    applyAutocomplete,
    renderAutocomplete,
    autocompleteState,
  };
}
