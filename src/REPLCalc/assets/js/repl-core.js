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
    userFns: Object.create(null),
  };

  const KEYWORDS = new Set(["if", "else", "for", "in", "step", "repeat"]);

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
    "||": { prec: 0, assoc:"L", fn:(a,b) => (isTruthy(a) || isTruthy(b)) ? 1 : 0 },
    "&&": { prec: 1, assoc:"L", fn:(a,b) => (isTruthy(a) && isTruthy(b)) ? 1 : 0 },
    "==": { prec: 2, assoc:"L", fn:(a,b) => compareValues(a,b, "==") },
    "!=": { prec: 2, assoc:"L", fn:(a,b) => compareValues(a,b, "!=") },
    "<": { prec: 2, assoc:"L", fn:(a,b) => compareValues(a,b, "<") },
    "<=": { prec: 2, assoc:"L", fn:(a,b) => compareValues(a,b, "<=") },
    ">": { prec: 2, assoc:"L", fn:(a,b) => compareValues(a,b, ">") },
    ">=": { prec: 2, assoc:"L", fn:(a,b) => compareValues(a,b, ">=") },
    "+": { prec: 3, assoc:"L", fn:add },
    "-": { prec: 3, assoc:"L", fn:sub },
    "*": { prec: 4, assoc:"L", fn:mul },
    "/": { prec: 4, assoc:"L", fn:div },
    "^": { prec: 5, assoc:"R", fn:pow },
  };

  function isTruthy(value){
    if (isQty(value)) return value.value !== 0;
    return Boolean(value);
  }

  function normalizeCompare(a, b){
    if (isQty(a) && isQty(b)){
      if (a.kind !== b.kind) throw new Error(`Unit mismatch: ${a.kind} vs ${b.kind}`);
      return [a.value, b.value];
    }
    if (isQty(a) && !isQty(b)){
      if (a.kind !== "scalar") throw new Error("Cannot compare unit quantity to scalar.");
      return [a.value, b];
    }
    if (!isQty(a) && isQty(b)){
      if (b.kind !== "scalar") throw new Error("Cannot compare scalar to unit quantity.");
      return [a, b.value];
    }
    return [a, b];
  }

  function compareValues(a, b, op){
    const [left, right] = normalizeCompare(a, b);
    if (op === "==") return left === right ? 1 : 0;
    if (op === "!=") return left !== right ? 1 : 0;
    if (op === "<") return left < right ? 1 : 0;
    if (op === "<=") return left <= right ? 1 : 0;
    if (op === ">") return left > right ? 1 : 0;
    if (op === ">=") return left >= right ? 1 : 0;
    return 0;
  }

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
      const twoChar = s.slice(i, i+2);
      if (["==","!=",">=","<=","&&","||"].includes(twoChar)){
        out.push({type:"op", value:twoChar});
        i += 2;
        continue;
      }
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

  function insertImplicitMultiplication(tokens){
    const out = [];
    const canMultiplyLeft = (t) => t.type==="num" || t.type==="id" || t.type===")";
    const canMultiplyRight = (t) => t.type==="num" || t.type==="id" || t.type==="(";

    for (let i=0; i<tokens.length; i++){
      const t = tokens[i];
      out.push(t);
      const next = tokens[i+1];
      if (!next) continue;
      if (!canMultiplyLeft(t) || !canMultiplyRight(next)) continue;
      if (t.type==="id" && next.type==="(") continue; // function call
      out.push({type:"op", value:"*"});
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

      if (ctx.unitOverrides && Object.prototype.hasOwnProperty.call(ctx.unitOverrides, name)){
        return ctx.unitOverrides[name];
      }

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

      if (Object.prototype.hasOwnProperty.call(ctx.aliases, name)){
        return ctx.vars[ctx.aliases[name]];
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

  function buildAliasMap(tokens, vars, fnNames){
    const referenced = new Set();
    const unknown = [];
    for (let i = 0; i < tokens.length; i++){
      const t = tokens[i];
      if (t.type !== "id") continue;
      const name = t.value;
      const next = tokens[i + 1];
      if (next && next.type === "(") continue; // function call
      if (isUnitToken(name) || name === "pi" || name === "e") continue;
      if (fnNames && fnNames.has(name)) continue;
      if (Object.prototype.hasOwnProperty.call(vars, name)){
        referenced.add(name);
      }else{
        unknown.push(name);
      }
    }

    const available = Object.keys(vars).filter((name) => !referenced.has(name));
    const remaining = new Set(available);
    const aliases = Object.create(null);

    for (const name of unknown){
      const alias = pickAlias(name, Array.from(remaining));
      if (alias){
        aliases[name] = alias;
        remaining.delete(alias);
      }
    }

    return aliases;
  }

  function pickAlias(unknown, candidates){
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const scored = candidates.map((candidate) => ({
      candidate,
      score: similarityScore(unknown, candidate),
    }));
    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score <= 0) return null;
    if (scored.length > 1 && scored[0].score === scored[1].score) return null;
    return scored[0].candidate;
  }

  function similarityScore(a, b){
    const left = a.toLowerCase();
    const right = b.toLowerCase();
    let prefix = 0;
    while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]){
      prefix += 1;
    }
    let longest = 0;
    for (let i = 0; i < left.length; i++){
      for (let j = 0; j < right.length; j++){
        let k = 0;
        while (left[i + k] && right[j + k] && left[i + k] === right[j + k]){
          k += 1;
        }
        if (k > longest) longest = k;
      }
    }
    let score = prefix * 2 + longest;
    if (left.includes(right) || right.includes(left)) score += 2;
    return score;
  }

  // -----------------------------
  // Built-in construction functions
  // -----------------------------
  function defFn(name, arity, impl){
    return { arity, impl };
  }

  const baseFns = Object.create(null);

  // Math-ish helpers (scalar-friendly)
  baseFns.abs = defFn("abs", 1, (x) => isQty(x)? makeQty(Math.abs(x.value), x.kind) : Math.abs(x));
  baseFns.min = defFn("min", 2, (a,b) => isQty(a)||isQty(b) ? (add(a,0).value <= add(b,0).value ? a : b) : Math.min(a,b));
  baseFns.max = defFn("max", 2, (a,b) => isQty(a)||isQty(b) ? (add(a,0).value >= add(b,0).value ? a : b) : Math.max(a,b));
  baseFns.round = defFn("round", 1, (x) => isQty(x)? makeQty(Math.round(x.value), x.kind) : Math.round(x));
  baseFns.ceil = defFn("ceil", 1, (x) => isQty(x)? makeQty(Math.ceil(x.value), x.kind) : Math.ceil(x));
  baseFns.floor = defFn("floor", 1, (x) => isQty(x)? makeQty(Math.floor(x.value), x.kind) : Math.floor(x));
  baseFns.sqrt = defFn("sqrt", 1, (x) => isQty(x)? makeQty(Math.sqrt(x.value), x.kind) : Math.sqrt(x));
  baseFns.pow = defFn("pow", 2, (a,b) => pow(a,b));
  baseFns.exp = defFn("exp", 1, (x) => isQty(x)? makeQty(Math.exp(x.value), x.kind) : Math.exp(x));
  baseFns.log = defFn("log", 1, (x) => isQty(x)? makeQty(Math.log(x.value), x.kind) : Math.log(x));
  baseFns.log10 = defFn("log10", 1, (x) => isQty(x)? makeQty(Math.log10(x.value), x.kind) : Math.log10(x));
  baseFns.sin = defFn("sin", 1, (x) => Math.sin(isQty(x) ? x.value : x));
  baseFns.cos = defFn("cos", 1, (x) => Math.cos(isQty(x) ? x.value : x));
  baseFns.tan = defFn("tan", 1, (x) => Math.tan(isQty(x) ? x.value : x));
  baseFns.asin = defFn("asin", 1, (x) => Math.asin(isQty(x) ? x.value : x));
  baseFns.acos = defFn("acos", 1, (x) => Math.acos(isQty(x) ? x.value : x));
  baseFns.atan = defFn("atan", 1, (x) => Math.atan(isQty(x) ? x.value : x));
  baseFns.atan2 = defFn("atan2", 2, (y,x) => Math.atan2(isQty(y) ? y.value : y, isQty(x) ? x.value : x));
  baseFns.clamp = defFn("clamp", 3, (x, min, max) => {
    const xv = isQty(x) ? x.value : x;
    const minv = isQty(min) ? min.value : min;
    const maxv = isQty(max) ? max.value : max;
    const v = Math.min(Math.max(xv, minv), maxv);
    return isQty(x) ? makeQty(v, x.kind) : v;
  });
  baseFns.if = defFn("if", 3, (cond, a, b) => (isTruthy(cond) ? a : b));

  // Estimation helpers
  baseFns.waste = defFn("waste", 2, (qty, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    const factor = 1 + (p/100);
    return mul(qty, factor);
  });
  baseFns.markup = defFn("markup", 2, (cost, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    return mul(cost, 1 + (p/100));
  });
  baseFns.burden = defFn("burden", 2, (labor, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    return mul(labor, 1 + (p/100));
  });
  baseFns.unit = defFn("unit", 2, (cost, qty) => div(cost, qty));
  baseFns.round_up = defFn("round_up", 2, (x, step) => {
    const xv = isQty(x) ? x.value : x;
    const sv = isQty(step) ? step.value : step;
    const r = Math.ceil(xv / sv) * sv;
    return isQty(x) ? makeQty(r, x.kind) : r;
  });

  // Geometry / takeoff
  baseFns.area_rect = defFn("area_rect", 2, (a,b) => {
    // expects lengths -> area
    const aa = isQty(a) ? a : makeQty(a, "len");
    const bb = isQty(b) ? b : makeQty(b, "len");
    if (aa.kind !== "len" || bb.kind !== "len") throw new Error("area_rect expects (len, len)");
    return makeQty(aa.value * bb.value, "area");
  });

  baseFns.area_circle = defFn("area_circle", 1, (diam) => {
    const d = isQty(diam) ? diam : makeQty(diam, "len");
    if (d.kind !== "len") throw new Error("area_circle expects diameter (len)");
    const r = d.value / 2;
    return makeQty(Math.PI * r * r, "area");
  });

  baseFns.vol_rect = defFn("vol_rect", 2, (area, thickness_in) => {
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

  baseFns.concrete_cy = defFn("concrete_cy", 2, (area, thickness_in) => {
    const vol = baseFns.vol_rect.impl(area, thickness_in); // cf base
    // convert cf -> cy (divide by 27), but keep as scalar-ish in cy for user display convenience
    const cy = vol.value / 27;
    return cy; // scalar number of cubic yards
  });

  // Lumber board-feet
  baseFns.bf = defFn("bf", 4, (t_in, w_in, len_ft, qty) => {
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
  baseFns.pipe_wt = defFn("pipe_wt", 3, (nps_in, schedule, len_ft) => {
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
  baseFns.to_in = defFn("to_in", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_in expects length");
    return q.value * 12;
  });
  baseFns.to_ft = defFn("to_ft", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_ft expects length");
    return q.value;
  });
  baseFns.to_sf = defFn("to_sf", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sf expects area");
    return q.value;
  });
  baseFns.to_sy = defFn("to_sy", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sy expects area");
    return q.value / 9;
  });
  baseFns.to_cf = defFn("to_cf", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cf expects volume");
    return q.value;
  });
  baseFns.to_cy = defFn("to_cy", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cy expects volume");
    return q.value / 27;
  });
  baseFns.to_lb = defFn("to_lb", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_lb expects weight");
    return q.value;
  });
  baseFns.to_ton = defFn("to_ton", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_ton expects weight");
    return q.value / 2000;
  });

  // -----------------------------
  // Command handling
  // -----------------------------
  function showHelp(){
    writeLine("Estimator REPL help", "ok");
    writeLine("Math: +  -  *  /  ^  ( )  comparisons (== != < <= > >=) and logic (&& ||)", "muted");
    writeLine("Variables: x = 12.5   |   use: x*3", "muted");
    writeLine("Methods: def name(a,b) = expression (redefine to edit)", "muted");
    writeLine("Flow: if condition: expr [else: expr]", "muted");
    writeLine("Loop: for i in 1..5 step 1: expr   |   repeat 3: expr", "muted");
    writeLine("Units: in, ft, yd, sf, sy, cf, cy, lb, ton (use like: 12 ft + 6 in)", "muted");
    writeLine("Solve: expr = expr  (one unknown variable, ex: 56 cy = concrete_cy(sf, 6 in))", "muted");
    writeLine("Editor: autocomplete, syntax highlight, and live preview while typing", "muted");
    writeLine("Tip: Enter runs when complete; Enter adds new line if incomplete.", "muted");
    writeLine("Commands:", "muted");
    writeLine("  :help                show help", "muted");
    writeLine("  :docs                detailed docs + examples", "muted");
    writeLine("  :clear               clear terminal output", "muted");
    writeLine("  :vars                list variables", "muted");
    writeLine("  :methods             list user methods", "muted");
    writeLine("  :reset               reset vars + history", "muted");
    writeLine("  :export              copy session JSON to clipboard", "muted");
    writeLine("  :import              load session JSON from clipboard", "muted");
    writeLine("  :theme default|amber|matrix", "muted");
    writeLine("Functions:", "muted");
    writeLine("  waste(qty,pct)  markup(cost,pct)  burden(labor,pct)  unit(cost,qty)  round_up(x,step)", "muted");
    writeLine("  area_rect(a,b) area_circle(diam) vol_rect(area,thk_in) concrete_cy(area,thk_in)", "muted");
    writeLine("  bf(t_in,w_in,len_ft,qty)  pipe_wt(nps_in,schedule,len_ft)", "muted");
    writeLine("  to_in(x) to_ft(x) to_sf(x) to_sy(x) to_cf(x) to_cy(x) to_lb(x) to_ton(x)", "muted");
    writeLine("  abs min max round ceil floor sqrt pow exp log log10 sin cos tan atan2 clamp if", "muted");
    writeLine("Examples:", "muted");
    writeLine("  slab = concrete_cy(1200 sf, 4 in)", "muted");
    writeLine("  total = markup(burden(12500, 16.7), 35)", "muted");
    writeLine("  waste(500 sf, 10)", "muted");
    writeLine("  def crew_cost(rate, hours) = rate * hours", "muted");
    writeLine("  for i in 1..4: total = total + i", "muted");
    writeLine("  if labor > 40: overtime = labor - 40 else: overtime = 0", "muted");
  }

  function showDocs(){
    writeLine("Estimator REPL docs", "ok");
    writeLine("Overview:", "muted");
    writeLine("  This REPL mixes calculator math with takeoff helpers, units, and quick scripting.", "muted");
    writeLine("  Use it for one-off computations or build up a session with variables + methods.", "muted");
    writeLine("Syntax quickstart:", "muted");
    writeLine("  Expressions: 2+2*5  |  (1200 sf * 4 in) / 27  |  pow(3,2)", "muted");
    writeLine("  Assignment: x = 144  |  total = markup(burden(12500, 16.7), 35)", "muted");
    writeLine("  Methods: def name(a,b) = expression  (call with name(1,2))", "muted");
    writeLine("  Flow: if labor > 40: overtime = labor - 40 else: overtime = 0", "muted");
    writeLine("  Loop: for i in 1..4: total = total + i  |  repeat 3: waste(100 sf, 5)", "muted");
    writeLine("  Solve: 56 cy = concrete_cy(sf, 6 in)", "muted");
    writeLine("Units:", "muted");
    writeLine("  Supported: in, ft, yd, sf, sy, cf, cy, lb, ton.", "muted");
    writeLine("  Use as tokens: 12 ft + 6 in  |  1200 sf * 4 in  |  3 cy + 9 cf", "muted");
    writeLine("  Converters: to_in/to_ft, to_sf/to_sy, to_cf/to_cy, to_lb/to_ton.", "muted");
    writeLine("Construction helpers:", "muted");
    writeLine("  waste(qty,pct)  markup(cost,pct)  burden(labor,pct)  unit(cost,qty)  round_up(x,step)", "muted");
    writeLine("  area_rect(a,b) area_circle(diam) vol_rect(area,thk_in) concrete_cy(area,thk_in)", "muted");
    writeLine("  bf(t_in,w_in,len_ft,qty)  pipe_wt(nps_in,schedule,len_ft)", "muted");
    writeLine("Math + logic:", "muted");
    writeLine("  abs min max round ceil floor sqrt pow exp log log10 sin cos tan atan2 clamp", "muted");
    writeLine("  Comparisons return 1/0: == != < <= > >=  |  Logic: && ||", "muted");
    writeLine("Session commands:", "muted");
    writeLine("  :vars list variables   :methods list user methods   :reset wipe session", "muted");
    writeLine("  :export copy JSON      :import load JSON from clipboard", "muted");
    writeLine("  :theme default|amber|matrix", "muted");
    writeLine("Tips:", "muted");
    writeLine("  - Shift+Enter inserts a new line. Enter runs when the statement is complete.", "muted");
    writeLine("  - Use Up/Down to cycle history; Ctrl/Cmd+L clears the terminal.", "muted");
    writeLine("  - Autocomplete works for commands (:), functions, units, variables, constants.", "muted");
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

  function listMethods(){
    const keys = Object.keys(state.userFns).sort();
    if (!keys.length){
      writeLine("No user methods defined.", "muted");
      return;
    }
    writeLine("User methods:", "ok");
    for (const k of keys){
      const defn = state.userFns[k];
      const params = defn.params ? defn.params.join(", ") : "";
      writeLine(`  ${k}(${params}) = ${defn.expr}`, "muted");
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
      theme: state.theme,
      methods: Object.values(state.userFns).map((defn) => ({
        name: defn.name,
        params: defn.params,
        expr: defn.expr,
      })),
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
  }

  function resetAll(){
    state.vars = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    state.userFns = Object.create(null);
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
    let start = 0;
    const joined = normalized.join("\n");
    for (let i = 0; i < joined.length; i++){
      const c = joined[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      const isBreak = (c === "\n" || c === ";") && depth === 0;
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
    for (let i = 0; i < source.length; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (depth === 0 && c === char) return i;
    }
    return -1;
  }

  function findTopLevelEquals(source){
    let depth = 0;
    for (let i = 0; i < source.length; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (depth !== 0) continue;
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
    const lower = keyword.toLowerCase();
    for (let i = 0; i < source.length; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (depth !== 0) continue;
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
    for (let i = 0; i < source.length - 1; i++){
      const c = source[i];
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (depth === 0 && source[i] === "." && source[i + 1] === ".") return i;
    }
    return -1;
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

    const defMatch = src.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/);
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
    { label: ":docs", detail: "docs" },
    { label: ":clear", detail: "clear output" },
    { label: ":vars", detail: "list variables" },
    { label: ":methods", detail: "list user methods" },
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
      const defMatch = trimmed.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/);
      if (defMatch){
        const formattedExpr = formatExpression(defMatch[3]);
        const params = defMatch[2].split(",").map((p) => p.trim()).filter(Boolean).join(", ");
        return `${leading}def ${defMatch[1]}(${params}) = ${formattedExpr}`;
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
    let depth = 0;
    for (const c of trimmed){
      if (c === "(") depth += 1;
      if (c === ")") depth -= 1;
      if (depth < 0) return true;
    }
    if (depth > 0) return false;
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
        const fr = formatResult(val);
        setLiveResult(`${parsed.name} = ${fr.main}`, "ok");
        return;
      }
      if (parsed.type === "expr"){
        const previewVars = Object.assign(Object.create(null), state.vars);
        const val = runExpressionWithContext(parsed.expr, previewVars);
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

    for (const name of Object.keys(getFns())){
      if (name.toLowerCase().startsWith(lowered)){
        const detail = Object.prototype.hasOwnProperty.call(state.userFns, name) ? "user" : "fn";
        addItem(name, "function", detail, `${name}(`);
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
          if (cmd === "theme"){ setTheme((arg||"").trim()); writeLine(`Theme set to ${state.theme}.`, "ok"); continue; }

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
          writeLine(`${verb} method ${parsed.name}(${parsed.params.join(", ")}).`, "ok");
          continue;
        }

        if (parsed.type === "assign"){
          const val = runExpression(parsed.expr);
          state.vars[parsed.name] = val;
          const fr = formatResult(val);
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
          const fr = formatResult(val);
          writeLine(fr.main, "out");
          if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
          continue;
        }
      }
    }catch(err){
      setStatus("Error", "err");
      writeLine(`[${nowStamp()}] ${err.message || String(err)}`, "err");
    }finally{
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
    return Object.assign(Object.create(null), baseFns, state.userFns);
  }

  function defineUserFn(name, params, expr){
    if (Object.prototype.hasOwnProperty.call(baseFns, name)){
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
    writeLine("Try: def crew_cost(rate, hours) = rate * hours", "muted");
    writeLine("Try: for i in 1..4: total = total + i", "muted");

    // A couple default constants you might like in estimating:
    state.vars.hr = 1; // placeholder if you want
    state.vars.pi = Math.PI;

    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
    inputEl.focus();
  }

  boot();
}
