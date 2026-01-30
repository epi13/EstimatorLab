(() => {
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
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const btnReset = document.getElementById('btnReset');

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
  };

  // -----------------------------
  // Lightweight Units System
  // -----------------------------
  // Base units:
  // length: ft
  // area: sf
  // volume: cf
  // weight: lb
  const UNIT = {
    in:  { kind:"len", toBase: 1/12 },
    ft:  { kind:"len", toBase: 1 },
    yd:  { kind:"len", toBase: 3 },

    sf:  { kind:"area", toBase: 1 },
    sy:  { kind:"area", toBase: 9 },      // 1 sy = 9 sf

    cf:  { kind:"vol", toBase: 1 },
    cy:  { kind:"vol", toBase: 27 },      // 1 cy = 27 cf

    lb:  { kind:"wt", toBase: 1 },
    ton: { kind:"wt", toBase: 2000 },
  };

  function isUnitToken(t){ return Object.prototype.hasOwnProperty.call(UNIT, t); }

  function makeQty(value, kind="scalar"){
    return { value, kind };
  }

  function qtyToString(q){
    if (!q || typeof q !== "object" || !("value" in q)) return String(q);
    const v = q.value;
    const kind = q.kind || "scalar";
    // Pretty format
    const fmt = (n) => {
      if (!Number.isFinite(n)) return String(n);
      const abs = Math.abs(n);
      if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) return n.toExponential(6);
      return (Math.round(n * 1e6) / 1e6).toString();
    };
    if (kind === "scalar") return fmt(v);
    if (kind === "len") return `${fmt(v)} ft`;
    if (kind === "area") return `${fmt(v)} sf`;
    if (kind === "vol") return `${fmt(v)} cf`;
    if (kind === "wt") return `${fmt(v)} lb`;
    return `${fmt(v)} ${kind}`;
  }

  function convert(q, toUnit){
    if (!q || typeof q !== "object") throw new Error("convert() expects a quantity");
    if (!isUnitToken(toUnit)) throw new Error(`Unknown unit: ${toUnit}`);
    const u = UNIT[toUnit];
    // only allow conversion within kind families (len/area/vol/wt)
    const kindMap = {len:"len", area:"area", vol:"vol", wt:"wt"};
    const qKind = kindMap[q.kind] || q.kind;
    if (qKind !== u.kind) throw new Error(`Unit mismatch: cannot convert ${q.kind} -> ${u.kind}`);
    const base = q.value; // already in base for that kind
    const out = base / u.toBase;
    // store result in same base kind but we print helper separately; caller can wrap
    return out;
  }

  // arithmetic on quantities
  function add(a,b){
    if (isQty(a) && isQty(b)){
      if (a.kind !== b.kind) throw new Error(`Unit mismatch: ${a.kind} + ${b.kind}`);
      return makeQty(a.value + b.value, a.kind);
    }
    if (isQty(a) && !isQty(b)){
      if (a.kind !== "scalar") throw new Error("Cannot add scalar to a unit quantity without a unit.");
      return makeQty(a.value + b, "scalar");
    }
    if (!isQty(a) && isQty(b)){
      if (b.kind !== "scalar") throw new Error("Cannot add scalar to a unit quantity without a unit.");
      return makeQty(a + b.value, "scalar");
    }
    return a + b;
  }
  function sub(a,b){
    if (isQty(a) && isQty(b)){
      if (a.kind !== b.kind) throw new Error(`Unit mismatch: ${a.kind} - ${b.kind}`);
      return makeQty(a.value - b.value, a.kind);
    }
    if (isQty(a) && !isQty(b)){
      if (a.kind !== "scalar") throw new Error("Cannot subtract scalar from a unit quantity without a unit.");
      return makeQty(a.value - b, "scalar");
    }
    if (!isQty(a) && isQty(b)){
      if (b.kind !== "scalar") throw new Error("Cannot subtract unit quantity from scalar.");
      return makeQty(a - b.value, "scalar");
    }
    return a - b;
  }
  function mul(a,b){
    // basic: scalar*qty or qty*scalar; qty*qty tries to produce derived kinds:
    // len*len => area; area*len => vol; len*area => vol
    if (isQty(a) && isQty(b)){
      const k = `${a.kind}*${b.kind}`;
      if (k === "len*len") return makeQty(a.value * b.value, "area");
      if (k === "area*len" || k === "len*area") return makeQty(a.value * b.value, "vol");
      if (a.kind === b.kind) return makeQty(a.value * b.value, a.kind); // not perfect, but usable
      // allow scalar kind
      if (a.kind === "scalar") return makeQty(a.value * b.value, b.kind);
      if (b.kind === "scalar") return makeQty(a.value * b.value, a.kind);
      // otherwise just compute scalar-ish
      return makeQty(a.value * b.value, "scalar");
    }
    if (isQty(a) && !isQty(b)) return makeQty(a.value * b, a.kind);
    if (!isQty(a) && isQty(b)) return makeQty(a * b.value, b.kind);
    return a * b;
  }
  function div(a,b){
    if (isQty(a) && isQty(b)){
      if (a.kind === b.kind) return makeQty(a.value / b.value, "scalar");
      if (b.kind === "scalar") return makeQty(a.value / b.value, a.kind);
      // unit division falls back to scalar
      return makeQty(a.value / b.value, "scalar");
    }
    if (isQty(a) && !isQty(b)) return makeQty(a.value / b, a.kind);
    if (!isQty(a) && isQty(b)) return makeQty(a / b.value, "scalar");
    return a / b;
  }
  function pow(a,b){
    if (isQty(a) && isQty(b)) {
      if (b.kind !== "scalar") throw new Error("Exponent must be scalar.");
      return makeQty(Math.pow(a.value, b.value), a.kind);
    }
    if (isQty(a) && !isQty(b)) return makeQty(Math.pow(a.value, b), a.kind);
    if (!isQty(a) && isQty(b)) {
      if (b.kind !== "scalar") throw new Error("Exponent must be scalar.");
      return Math.pow(a, b.value);
    }
    return Math.pow(a,b);
  }
  function isQty(x){ return x && typeof x === "object" && typeof x.value === "number" && typeof x.kind === "string"; }

  // -----------------------------
  // Expression Engine (shunting-yard)
  // -----------------------------
  const OPS = {
    "+": { prec: 2, assoc:"L", fn:add },
    "-": { prec: 2, assoc:"L", fn:sub },
    "*": { prec: 3, assoc:"L", fn:mul },
    "/": { prec: 3, assoc:"L", fn:div },
    "^": { prec: 4, assoc:"R", fn:pow },
  };

  function tokenize(src){
    // supports numbers, identifiers, commas, parens, operators, and unit tokens.
    // also supports unary minus by turning it into (0 - x) in parse stage.
    const s = src.trim();
    const out = [];
    let i = 0;

    const isSpace = c => /\s/.test(c);
    const isDigit = c => /[0-9]/.test(c);
    const isIdentStart = c => /[A-Za-z_]/.test(c);
    const isIdent = c => /[A-Za-z0-9_]/.test(c);

    while (i < s.length){
      const c = s[i];
      if (isSpace(c)){ i++; continue; }

      // number
      if (isDigit(c) || (c==="." && isDigit(s[i+1]))){
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        // exponent
        if (s[j]==="e" || s[j]==="E"){
          let k = j+1;
          if (s[k]==="+" || s[k]==="-") k++;
          while (k < s.length && /[0-9]/.test(s[k])) k++;
          j = k;
        }
        out.push({type:"num", value: parseFloat(s.slice(i,j))});
        i = j;
        continue;
      }

      // identifiers / units
      if (isIdentStart(c)){
        let j = i+1;
        while (j < s.length && isIdent(s[j])) j++;
        const name = s.slice(i,j);
        out.push({type:"id", value:name});
        i = j;
        continue;
      }

      // operators & punctuation
      if (c==="(" || c===")" || c==="," ){
        out.push({type:c});
        i++;
        continue;
      }
      if (OPS[c]){
        out.push({type:"op", value:c});
        i++;
        continue;
      }

      throw new Error(`Unexpected character "${c}"`);
    }
    return out;
  }

  function toRPN(tokens){
    const output = [];
    const stack = [];

    // detect unary minus: if '-' follows start, '(', ',', or operator -> unary.
    const isUnaryMinus = (t, prev) => t.type==="op" && t.value==="-" && (!prev || prev.type==="(" || prev.type==="," || (prev.type==="op"));

    let prev = null;
    for (let idx=0; idx<tokens.length; idx++){
      const t = tokens[idx];

      if (t.type==="num"){
        output.push(t);
      } else if (t.type==="id"){
        // function if next token is '('
        const next = tokens[idx+1];
        if (next && next.type==="("){
          stack.push({type:"fn", value:t.value});
        } else {
          output.push(t);
        }
      } else if (t.type==="," ){
        while (stack.length && stack[stack.length-1].type!=="("){
          output.push(stack.pop());
        }
        if (!stack.length) throw new Error("Misplaced comma");
      } else if (t.type==="op"){
        if (isUnaryMinus(t, prev)){
          // Convert unary minus into 0 <expr> -
          output.push({type:"num", value:0});
          // treat as binary minus
        }
        const o1 = t.value;
        while (stack.length){
          const top = stack[stack.length-1];
          if (top.type==="op"){
            const o2 = top.value;
            const p1 = OPS[o1].prec, p2 = OPS[o2].prec;
            if ((OPS[o1].assoc==="L" && p1<=p2) || (OPS[o1].assoc==="R" && p1<p2)){
              output.push(stack.pop());
              continue;
            }
          }
          break;
        }
        stack.push(t);
      } else if (t.type==="("){
        stack.push(t);
      } else if (t.type===")"){
        while (stack.length && stack[stack.length-1].type!=="("){
          output.push(stack.pop());
        }
        if (!stack.length) throw new Error("Mismatched parentheses");
        stack.pop(); // pop "("

        // if function on top, pop it too
        if (stack.length && stack[stack.length-1].type==="fn"){
          output.push(stack.pop());
        }
      } else {
        throw new Error("Unknown token");
      }

      prev = t;
    }

    while (stack.length){
      const t = stack.pop();
      if (t.type==="(" || t.type===")") throw new Error("Mismatched parentheses");
      output.push(t);
    }
    return output;
  }

  function evalRPN(rpn, ctx){
    const st = [];

    function getVar(name){
      if (name === "pi") return Math.PI;
      if (name === "e") return Math.E;

      // unit tokens become unit quantities of 1 unit (so "12 ft" can be parsed as 12 * ft)
      if (isUnitToken(name)){
        const u = UNIT[name];
        // represent 1 <unit> in base units of its kind
        // e.g. 1 in => 1/12 ft; 1 cy => 27 cf
        if (u.kind === "len") return makeQty(u.toBase, "len");
        if (u.kind === "area") return makeQty(u.toBase, "area");
        if (u.kind === "vol") return makeQty(u.toBase, "vol");
        if (u.kind === "wt") return makeQty(u.toBase, "wt");
      }

      if (Object.prototype.hasOwnProperty.call(ctx.vars, name)) return ctx.vars[name];
      throw new Error(`Unknown identifier: ${name}`);
    }

    for (const t of rpn){
      if (t.type==="num"){
        st.push(t.value);
      } else if (t.type==="id"){
        st.push(getVar(t.value));
      } else if (t.type==="op"){
        const b = st.pop();
        const a = st.pop();
        if (a === undefined || b === undefined) throw new Error("Missing operand");
        st.push(OPS[t.value].fn(a,b));
      } else if (t.type==="fn"){
        const fnName = t.value;
        const fn = ctx.fns[fnName];
        if (!fn) throw new Error(`Unknown function: ${fnName}()`);

        // Pull arguments from stack until marker? We don't have markers in RPN.
        // Workaround: we encode function calls by requiring parentheses and commas,
        // but RPN loses arity. So we infer arity from function definition .arity.
        const arity = fn.arity;
        const args = [];
        for (let i=0;i<arity;i++){
          const v = st.pop();
          if (v === undefined) throw new Error(`Not enough args for ${fnName}()`);
          args.unshift(v);
        }
        st.push(fn.impl(...args));
      } else {
        throw new Error("Bad RPN token");
      }
    }
    if (st.length !== 1) throw new Error("Expression did not reduce to a single value");
    return st[0];
  }

  // -----------------------------
  // Built-in construction functions
  // -----------------------------
  function defFn(name, arity, impl){
    return { arity, impl };
  }

  const fns = Object.create(null);

  // Math-ish helpers (scalar-friendly)
  fns.abs = defFn("abs", 1, (x) => isQty(x)? makeQty(Math.abs(x.value), x.kind) : Math.abs(x));
  fns.min = defFn("min", 2, (a,b) => isQty(a)||isQty(b) ? (add(a,0).value <= add(b,0).value ? a : b) : Math.min(a,b));
  fns.max = defFn("max", 2, (a,b) => isQty(a)||isQty(b) ? (add(a,0).value >= add(b,0).value ? a : b) : Math.max(a,b));
  fns.round = defFn("round", 1, (x) => isQty(x)? makeQty(Math.round(x.value), x.kind) : Math.round(x));
  fns.ceil = defFn("ceil", 1, (x) => isQty(x)? makeQty(Math.ceil(x.value), x.kind) : Math.ceil(x));
  fns.floor = defFn("floor", 1, (x) => isQty(x)? makeQty(Math.floor(x.value), x.kind) : Math.floor(x));

  // Estimation helpers
  fns.waste = defFn("waste", 2, (qty, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    const factor = 1 + (p/100);
    return mul(qty, factor);
  });
  fns.markup = defFn("markup", 2, (cost, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    return mul(cost, 1 + (p/100));
  });
  fns.burden = defFn("burden", 2, (labor, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    return mul(labor, 1 + (p/100));
  });
  fns.unit = defFn("unit", 2, (cost, qty) => div(cost, qty));
  fns.round_up = defFn("round_up", 2, (x, step) => {
    const xv = isQty(x) ? x.value : x;
    const sv = isQty(step) ? step.value : step;
    const r = Math.ceil(xv / sv) * sv;
    return isQty(x) ? makeQty(r, x.kind) : r;
  });

  // Geometry / takeoff
  fns.area_rect = defFn("area_rect", 2, (a,b) => {
    // expects lengths -> area
    const aa = isQty(a) ? a : makeQty(a, "len");
    const bb = isQty(b) ? b : makeQty(b, "len");
    if (aa.kind !== "len" || bb.kind !== "len") throw new Error("area_rect expects (len, len)");
    return makeQty(aa.value * bb.value, "area");
  });

  fns.area_circle = defFn("area_circle", 1, (diam) => {
    const d = isQty(diam) ? diam : makeQty(diam, "len");
    if (d.kind !== "len") throw new Error("area_circle expects diameter (len)");
    const r = d.value / 2;
    return makeQty(Math.PI * r * r, "area");
  });

  fns.vol_rect = defFn("vol_rect", 2, (area, thickness_in) => {
    // area * thickness => vol
    const a = isQty(area) ? area : makeQty(area, "area");
    if (a.kind !== "area") throw new Error("vol_rect expects area as first arg");
    // thickness can be length, or raw inches (scalar interpreted as inches)
    let t;
    if (isQty(thickness_in)) {
      if (thickness_in.kind !== "len") throw new Error("thickness must be length");
      t = thickness_in.value; // in ft base
    } else {
      // assume inches
      t = (thickness_in / 12);
    }
    return makeQty(a.value * t, "vol");
  });

  fns.concrete_cy = defFn("concrete_cy", 2, (area, thickness_in) => {
    const vol = fns.vol_rect.impl(area, thickness_in); // cf base
    // convert cf -> cy (divide by 27), but keep as scalar-ish in cy for user display convenience
    const cy = vol.value / 27;
    return cy; // scalar number of cubic yards
  });

  // Lumber board-feet
  fns.bf = defFn("bf", 4, (t_in, w_in, len_ft, qty) => {
    const t = isQty(t_in) ? t_in.value : t_in;
    const w = isQty(w_in) ? w_in.value : w_in;
    const L = isQty(len_ft) ? len_ft.value : len_ft;
    const q = isQty(qty) ? qty.value : qty;
    // Board feet = (T(in) * W(in) * L(ft) * qty) / 12
    return (t * w * L * q) / 12;
  });

  // Rough pipe weight table (lb/ft) for common NPS + schedule 40/80 (steel, very rough)
  const PIPE_WT = {
    "0.5": { "40": 0.85, "80": 1.09 },
    "0.75":{ "40": 1.13, "80": 1.47 },
    "1":   { "40": 1.68, "80": 2.17 },
    "1.25":{ "40": 2.27, "80": 3.00 },
    "1.5": { "40": 2.72, "80": 3.63 },
    "2":   { "40": 3.65, "80": 5.02 },
    "2.5": { "40": 5.79, "80": 7.66 },
    "3":   { "40": 7.58, "80": 10.25 },
    "4":   { "40": 10.79,"80": 14.98 },
  };
  fns.pipe_wt = defFn("pipe_wt", 3, (nps_in, schedule, len_ft) => {
    const nps = String(isQty(nps_in) ? nps_in.value : nps_in);
    const sch = String(isQty(schedule) ? schedule.value : schedule);
    const L = isQty(len_ft) ? len_ft.value : len_ft;
    const row = PIPE_WT[nps];
    if (!row || !row[sch]) throw new Error(`pipe_wt: unsupported NPS/schedule (try 2,40)`);
    const lb_per_ft = row[sch];
    return makeQty(lb_per_ft * L, "wt"); // base lb
  });

  // Unit conversion helper: conv(qty, "unit") isn't possible in parser without strings;
  // so provide dedicated functions for common outputs:
  fns.to_in = defFn("to_in", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_in expects length");
    return q.value * 12;
  });
  fns.to_ft = defFn("to_ft", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_ft expects length");
    return q.value;
  });
  fns.to_sf = defFn("to_sf", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sf expects area");
    return q.value;
  });
  fns.to_sy = defFn("to_sy", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sy expects area");
    return q.value / 9;
  });
  fns.to_cf = defFn("to_cf", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cf expects volume");
    return q.value;
  });
  fns.to_cy = defFn("to_cy", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cy expects volume");
    return q.value / 27;
  });
  fns.to_lb = defFn("to_lb", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_lb expects weight");
    return q.value;
  });
  fns.to_ton = defFn("to_ton", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_ton expects weight");
    return q.value / 2000;
  });

  // -----------------------------
  // Command handling
  // -----------------------------
  function showHelp(){
    writeLine("Estimator REPL help", "ok");
    writeLine("Math: +  -  *  /  ^  ( )  and functions", "muted");
    writeLine("Variables: x = 12.5   |   use: x*3", "muted");
    writeLine("Units: in, ft, yd, sf, sy, cf, cy, lb, ton (use like: 12 ft + 6 in)", "muted");
    writeLine("Editor: autocomplete, syntax highlight, and live preview while typing", "muted");
    writeLine("Tip: Enter runs when complete; Enter adds new line if incomplete.", "muted");
    writeLine("Commands:", "muted");
    writeLine("  :help                show help", "muted");
    writeLine("  :clear               clear terminal output", "muted");
    writeLine("  :vars                list variables", "muted");
    writeLine("  :reset               reset vars + history", "muted");
    writeLine("  :export              copy session JSON to clipboard", "muted");
    writeLine("  :import              load session JSON from clipboard", "muted");
    writeLine("  :theme default|amber|matrix", "muted");
    writeLine("Functions:", "muted");
    writeLine("  waste(qty,pct)  markup(cost,pct)  burden(labor,pct)  unit(cost,qty)  round_up(x,step)", "muted");
    writeLine("  area_rect(a,b) area_circle(diam) vol_rect(area,thk_in) concrete_cy(area,thk_in)", "muted");
    writeLine("  bf(t_in,w_in,len_ft,qty)  pipe_wt(nps_in,schedule,len_ft)", "muted");
    writeLine("  to_in(x) to_ft(x) to_sf(x) to_sy(x) to_cf(x) to_cy(x) to_lb(x) to_ton(x)", "muted");
    writeLine("Examples:", "muted");
    writeLine("  slab = concrete_cy(1200 sf, 4 in)", "muted");
    writeLine("  total = markup(burden(12500, 16.7), 35)", "muted");
    writeLine("  waste(500 sf, 10)", "muted");
  }

  function listVars(){
    const keys = Object.keys(state.vars).sort();
    if (!keys.length){
      writeLine("No variables set.", "muted");
      return;
    }
    writeLine("Variables:", "ok");
    for (const k of keys){
      writeLine(`  ${k} = ${qtyToString(state.vars[k])}`, "muted");
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

  function exportSession(){
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      vars: state.vars,
      history: state.history.slice(-250),
      theme: state.theme
    };
    return JSON.stringify(payload, null, 2);
  }

  function importSession(jsonText){
    const obj = JSON.parse(jsonText);
    if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
    if (obj.version !== 1) throw new Error("Unsupported session version");
    // restore
    state.vars = obj.vars && typeof obj.vars === "object" ? obj.vars : Object.create(null);
    state.history = Array.isArray(obj.history) ? obj.history : [];
    if (obj.theme) setTheme(obj.theme);
  }

  function resetAll(){
    state.vars = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    setStatus("Reset", "ok");
    writeLine("Session reset.", "warn");
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

    // assignment: name = expression
    const m = src.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (m){
      return { type:"assign", name:m[1], expr:m[2] };
    }

    return { type:"expr", expr:src };
  }

  function runExpression(expr){
    const tokens = tokenize(expr);
    const rpn = toRPN(tokens);
    const val = evalRPN(rpn, { vars: state.vars, fns });
    return val;
  }

  function formatResult(v){
    // Show both raw and helpful secondary conversions for unit kinds
    if (!isQty(v)) return { main: qtyToString(v), extra: "" };

    if (v.kind === "len"){
      const ft = v.value;
      const inches = ft * 12;
      return { main: qtyToString(v), extra: `${(Math.round(inches*1e4)/1e4)} in` };
    }
    if (v.kind === "area"){
      const sf = v.value;
      const sy = sf / 9;
      return { main: qtyToString(v), extra: `${(Math.round(sy*1e6)/1e6)} sy` };
    }
    if (v.kind === "vol"){
      const cf = v.value;
      const cy = cf / 27;
      return { main: qtyToString(v), extra: `${(Math.round(cy*1e6)/1e6)} cy` };
    }
    if (v.kind === "wt"){
      const lb = v.value;
      const ton = lb / 2000;
      return { main: qtyToString(v), extra: `${(Math.round(ton*1e6)/1e6)} ton` };
    }
    return { main: qtyToString(v), extra: "" };
  }

  // -----------------------------
  // Formatting + editor helpers
  // -----------------------------
  const COMMANDS = [
    { label: ":help", detail: "help" },
    { label: ":clear", detail: "clear output" },
    { label: ":vars", detail: "list variables" },
    { label: ":reset", detail: "reset session" },
    { label: ":export", detail: "copy session" },
    { label: ":import", detail: "load session" },
    { label: ":theme", detail: "switch theme" },
  ];

  function formatTokens(tokens){
    const parts = tokens.map((t) => {
      if (t.type === "num") return String(t.value);
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
    let depth = 0;
    for (const c of trimmed){
      if (c === "(") depth += 1;
      if (c === ")") depth -= 1;
      if (depth < 0) return true;
    }
    if (depth > 0) return false;
    return !/[+\-*/^,=]$/.test(trimmed);
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
    const fnSet = new Set(Object.keys(fns));
    const unitSet = new Set(Object.keys(UNIT));
    const varSet = new Set(Object.keys(state.vars));
    const cmdSet = new Set(COMMANDS.map((c) => c.label));

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
        else if (varSet.has(word)) cls = "token-var";
        out += `<span class="${cls}">${escapeHtml(word)}</span>`;
        i = j;
        continue;
      }
      if ("+-*/^=,".includes(c)){
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
      if (parsed.type === "assign"){
        const val = runExpression(parsed.expr);
        const fr = formatResult(val);
        setLiveResult(`${parsed.name} = ${fr.main}`, "ok");
        return;
      }
      if (parsed.type === "expr"){
        const val = runExpression(parsed.expr);
        const fr = formatResult(val);
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
    const addItem = (label, kind, detail, insertText = label) => {
      items.push({ label, kind, detail, insertText });
    };

    if (prefix.startsWith(":")){
      for (const cmd of COMMANDS){
        if (cmd.label.toLowerCase().startsWith(lowered)){
          addItem(cmd.label, "command", cmd.detail, cmd.label);
        }
      }
      return items;
    }

    for (const name of Object.keys(fns)){
      if (name.toLowerCase().startsWith(lowered)){
        addItem(name, "function", "fn", `${name}(`);
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
    autocompleteState.items.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = `item${idx === autocompleteState.index ? " active" : ""}`;
      row.setAttribute("role", "option");
      row.innerHTML = `<div>${item.label}</div><span>${item.detail}</span>`;
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyAutocomplete(idx);
      });
      autocompleteEl.appendChild(row);
    });
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
    const parsed = evaluate(line);
    if (!parsed) return;

    try{
      if (parsed.type === "cmd"){
        const {cmd,arg} = parsed;
        if (cmd === "help"){ showHelp(); return; }
        if (cmd === "clear"){ clearTerminal(); return; }
        if (cmd === "vars"){ listVars(); return; }
        if (cmd === "reset"){ resetAll(); return; }
        if (cmd === "theme"){ setTheme((arg||"").trim()); writeLine(`Theme set to ${state.theme}.`, "ok"); return; }

        if (cmd === "export"){
          const text = exportSession();
          await copyText(text);
          return;
        }
        if (cmd === "import"){
          const text = await readClipboard();
          importSession(text);
          writeLine("Imported session from clipboard.", "ok");
          return;
        }
        throw new Error(`Unknown command: :${cmd}`);
      }

      if (parsed.type === "assign"){
        const val = runExpression(parsed.expr);
        state.vars[parsed.name] = val;
        const fr = formatResult(val);
        writeLine(`${parsed.name} = ${fr.main}`, "ok");
        if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
        return;
      }

      if (parsed.type === "expr"){
        const val = runExpression(parsed.expr);
        const fr = formatResult(val);
        writeLine(fr.main, "out");
        if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
        return;
      }
    }catch(err){
      setStatus("Error", "err");
      writeLine(`[${nowStamp()}] ${err.message || String(err)}`, "err");
    }finally{
      setStatus("Ready", "ok");
    }
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
    const desired = "  ".repeat(depth);
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

  // -----------------------------
  // Boot message + defaults
  // -----------------------------
  function boot(){
    setTheme("default");
    writeLine("Estimator REPL initialized.", "ok");
    writeLine("Type :help for commands and examples.", "muted");
    writeLine("Try: concrete_cy(1200 sf, 4 in)", "muted");
    writeLine("Try: total = markup(burden(12500, 16.7), 35)", "muted");

    // A couple default constants you might like in estimating:
    state.vars.hr = 1; // placeholder if you want
    state.vars.pi = Math.PI;

    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
    inputEl.focus();
  }

  boot();
})();
