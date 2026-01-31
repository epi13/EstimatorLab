import { UNIT, add, div, isQty, isScalarKind, isUnitToken, makeQty, mul, pow, sameDimension, sub } from "./repl-units.js";

const OPS = {
  "||": { prec: 0, assoc: "L", fn: (a, b) => (isTruthy(a) || isTruthy(b)) ? 1 : 0 },
  "&&": { prec: 1, assoc: "L", fn: (a, b) => (isTruthy(a) && isTruthy(b)) ? 1 : 0 },
  "==": { prec: 2, assoc: "L", fn: (a, b) => compareValues(a, b, "==") },
  "!=": { prec: 2, assoc: "L", fn: (a, b) => compareValues(a, b, "!=") },
  "<": { prec: 2, assoc: "L", fn: (a, b) => compareValues(a, b, "<") },
  "<=": { prec: 2, assoc: "L", fn: (a, b) => compareValues(a, b, "<=") },
  ">": { prec: 2, assoc: "L", fn: (a, b) => compareValues(a, b, ">") },
  ">=": { prec: 2, assoc: "L", fn: (a, b) => compareValues(a, b, ">=") },
  "+": { prec: 3, assoc: "L", fn: add },
  "-": { prec: 3, assoc: "L", fn: sub },
  "*": { prec: 4, assoc: "L", fn: mul },
  "/": { prec: 4, assoc: "L", fn: div },
  "^": { prec: 5, assoc: "R", fn: pow },
};

export function isTruthy(value){
  if (isQty(value)) return value.value !== 0;
  return Boolean(value);
}

export function normalizeCompare(a, b){
  if (isQty(a) && isQty(b)){
    if (!sameDimension(a, b)) throw new Error(`Unit mismatch: ${a.kind} vs ${b.kind}`);
    return [a.value, b.value];
  }
  if (isQty(a) && !isQty(b)){
    if (!isScalarKind(a.kind)) throw new Error("Cannot compare unit quantity to scalar.");
    return [a.value, b];
  }
  if (!isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Cannot compare scalar to unit quantity.");
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

export function tokenize(src){
  const s = src.trim();
  const out = [];
  let i = 0;

  const isSpace = (c) => /\s/.test(c);
  const isDigit = (c) => /[0-9]/.test(c);
  const isIdentStart = (c) => /[A-Za-z_]/.test(c);
  const isIdent = (c) => /[A-Za-z0-9_]/.test(c);

  while (i < s.length){
    const c = s[i];
    if (isSpace(c)){
      i += 1;
      continue;
    }

    if (c === "\"" || c === "'"){
      const quote = c;
      let j = i + 1;
      let value = "";
      while (j < s.length){
        const ch = s[j];
        if (ch === "\\"){
          const next = s[j + 1];
          if (next === "n") value += "\n";
          else if (next === "t") value += "\t";
          else if (next === "r") value += "\r";
          else if (next === quote) value += quote;
          else if (next === "\\") value += "\\";
          else if (next) value += next;
          j += 2;
          continue;
        }
        if (ch === quote) break;
        value += ch;
        j += 1;
      }
      if (s[j] !== quote) throw new Error("Unterminated string literal");
      out.push({ type: "str", value });
      i = j + 1;
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(s[i + 1]))){
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      if (s[j] === "e" || s[j] === "E"){
        let k = j + 1;
        if (s[k] === "+" || s[k] === "-") k += 1;
        while (k < s.length && /[0-9]/.test(s[k])) k += 1;
        j = k;
      }
      out.push({ type: "num", value: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }

    if (isIdentStart(c)){
      let j = i + 1;
      while (j < s.length && isIdent(s[j])) j += 1;
      const name = s.slice(i, j);
      out.push({ type: "id", value: name });
      i = j;
      continue;
    }

    const twoChar = s.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(twoChar)){
      out.push({ type: "op", value: twoChar });
      i += 2;
      continue;
    }
    if (c === "(" || c === ")" || c === ","){
      out.push({ type: c });
      i += 1;
      continue;
    }
    if (OPS[c]){
      out.push({ type: "op", value: c });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

export function insertImplicitMultiplication(tokens){
  const out = [];
  const canMultiplyLeft = (t) => t.type === "num" || t.type === "id" || t.type === ")";
  const canMultiplyRight = (t) => t.type === "num" || t.type === "id" || t.type === "(";

  for (let i = 0; i < tokens.length; i++){
    const t = tokens[i];
    out.push(t);
    const next = tokens[i + 1];
    if (!next) continue;
    if (!canMultiplyLeft(t) || !canMultiplyRight(next)) continue;
    if (t.type === "id" && next.type === "(") continue;
    out.push({ type: "op", value: "*" });
  }

  return out;
}

export function toRPN(tokens){
  const output = [];
  const stack = [];

  const isUnaryMinus = (t, prev) => t.type === "op" && t.value === "-" && (!prev || prev.type === "(" || prev.type === "," || (prev.type === "op"));

  let prev = null;
  for (let idx = 0; idx < tokens.length; idx++){
    const t = tokens[idx];

    if (t.type === "num"){
      output.push(t);
    }else if (t.type === "str"){
      output.push(t);
    }else if (t.type === "id"){
      const next = tokens[idx + 1];
      if (next && next.type === "("){
        stack.push({ type: "fn", value: t.value });
      }else{
        output.push(t);
      }
    }else if (t.type === ","){
      while (stack.length && stack[stack.length - 1].type !== "("){
        output.push(stack.pop());
      }
      if (!stack.length) throw new Error("Misplaced comma");
    }else if (t.type === "op"){
      if (isUnaryMinus(t, prev)){
        output.push({ type: "num", value: 0 });
      }
      const o1 = t.value;
      while (stack.length){
        const top = stack[stack.length - 1];
        if (top.type === "op"){
          const o2 = top.value;
          const p1 = OPS[o1].prec;
          const p2 = OPS[o2].prec;
          if ((OPS[o1].assoc === "L" && p1 <= p2) || (OPS[o1].assoc === "R" && p1 < p2)){
            output.push(stack.pop());
            continue;
          }
        }
        break;
      }
      stack.push(t);
    }else if (t.type === "("){
      stack.push(t);
    }else if (t.type === ")"){
      while (stack.length && stack[stack.length - 1].type !== "("){
        output.push(stack.pop());
      }
      if (!stack.length) throw new Error("Mismatched parentheses");
      stack.pop();

      if (stack.length && stack[stack.length - 1].type === "fn"){
        output.push(stack.pop());
      }
    }else{
      throw new Error("Unknown token");
    }

    prev = t;
  }

  while (stack.length){
    const t = stack.pop();
    if (t.type === "(" || t.type === ")") throw new Error("Mismatched parentheses");
    output.push(t);
  }
  return output;
}

export function evalRPN(rpn, ctx){
  const st = [];
  const onResolve = typeof ctx.onResolve === "function" ? ctx.onResolve : null;
  const onCall = typeof ctx.onCall === "function" ? ctx.onCall : null;

  function recordResolve(name, resolvedName = null){
    if (!onResolve) return;
    onResolve(name, resolvedName);
  }

  function getVar(name){
    if (name === "pi") return Math.PI;
    if (name === "e") return Math.E;

    if (ctx.unitOverrides && Object.prototype.hasOwnProperty.call(ctx.unitOverrides, name)){
      recordResolve(name);
      return ctx.unitOverrides[name];
    }

    if (isUnitToken(name)){
      const unit = UNIT[name];
      recordResolve(name);
      return makeQty(unit.toBase, unit.kind);
    }

    if (Object.prototype.hasOwnProperty.call(ctx.aliases, name)){
      const resolved = ctx.aliases[name];
      recordResolve(name, resolved);
      return ctx.vars[resolved];
    }
    if (Object.prototype.hasOwnProperty.call(ctx.vars, name)){
      recordResolve(name);
      return ctx.vars[name];
    }
    throw new Error(`Unknown identifier: ${name}`);
  }

  for (const t of rpn){
    if (t.type === "num"){
      st.push(t.value);
    }else if (t.type === "str"){
      st.push(t.value);
    }else if (t.type === "id"){
      st.push(getVar(t.value));
    }else if (t.type === "op"){
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) throw new Error("Missing operand");
      st.push(OPS[t.value].fn(a, b));
    }else if (t.type === "fn"){
      const fnName = t.value;
      if (onCall) onCall(fnName);
      const fn = ctx.fns[fnName];
      if (!fn) throw new Error(`Unknown function: ${fnName}()`);

      const arity = fn.arity;
      const args = [];
      for (let i = 0; i < arity; i++){
        const v = st.pop();
        if (v === undefined) throw new Error(`Not enough args for ${fnName}()`);
        args.unshift(v);
      }
      st.push(fn.impl(...args));
    }else{
      throw new Error("Bad RPN token");
    }
  }
  if (st.length !== 1) throw new Error("Expression did not reduce to a single value");
  return st[0];
}

export function buildAliasMap(tokens, vars, fnNames){
  const referenced = new Set();
  const unknown = [];
  for (let i = 0; i < tokens.length; i++){
    const t = tokens[i];
    if (t.type !== "id") continue;
    const name = t.value;
    const next = tokens[i + 1];
    if (next && next.type === "(") continue;
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
