import { add, div, mul, pow, sub } from "./repl-ops.js";
import { UNIT, isQty, isScalarKind, isUnitToken, makeQty, sameDimension } from "./repl-units.js";
import { EFFECT, effectNames } from "./repl-effects.js";
import {
  box,
  isBool,
  isDim,
  isNull,
  isScalar,
  isString,
  scalar,
  string,
  toBool,
  toScalarNumber,
} from "./repl-values.js";

const OPS = {
  "||": { prec: 0, assoc: "L", fn: (a, b) => scalar((isTruthy(a) || isTruthy(b)) ? 1 : 0) },
  "&&": { prec: 1, assoc: "L", fn: (a, b) => scalar((isTruthy(a) && isTruthy(b)) ? 1 : 0) },
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
  return toBool(box(value));
}

export function normalizeCompare(a, b){
  const av = box(a);
  const bv = box(b);

  if (isQty(av) && isQty(bv)){
    if (!sameDimension(av, bv)) throw new Error(`Unit mismatch: ${av.kind} vs ${bv.kind}`);
    return [av.value, bv.value];
  }
  if (isQty(av) && !isQty(bv)){
    if (!isScalarKind(av.kind)) throw new Error("Cannot compare unit quantity to scalar.");
    const n = toScalarNumber(bv, "compare", { allowBool: true, allowDimlessDim: true });
    return [av.value, n];
  }
  if (!isQty(av) && isQty(bv)){
    if (!isScalarKind(bv.kind)) throw new Error("Cannot compare scalar to unit quantity.");
    const n = toScalarNumber(av, "compare", { allowBool: true, allowDimlessDim: true });
    return [n, bv.value];
  }

  if (isString(av) || isString(bv)){
    return [isString(av) ? av.value : String(isNull(av) ? "" : av.value), isString(bv) ? bv.value : String(isNull(bv) ? "" : bv.value)];
  }

  const left = (isScalar(av) || isBool(av) || isDim(av)) ? toScalarNumber(av, "compare", { allowBool: true, allowDimlessDim: true }) : av;
  const right = (isScalar(bv) || isBool(bv) || isDim(bv)) ? toScalarNumber(bv, "compare", { allowBool: true, allowDimlessDim: true }) : bv;
  return [left, right];
}

function compareValues(a, b, op){
  const [left, right] = normalizeCompare(a, b);
  if (op === "==") return scalar(left === right ? 1 : 0);
  if (op === "!=") return scalar(left !== right ? 1 : 0);
  if (op === "<") return scalar(left < right ? 1 : 0);
  if (op === "<=") return scalar(left <= right ? 1 : 0);
  if (op === ">") return scalar(left > right ? 1 : 0);
  if (op === ">=") return scalar(left >= right ? 1 : 0);
  return scalar(0);
}

export function tokenize(src){
  const s = src.trim();
  const out = [];
  let i = 0;

  const isSpace = (c) => /\s/.test(c);
  const isDigit = (c) => /[0-9]/.test(c);
  const isIdentStart = (c) => /[A-Za-z_$%]/.test(c);
  const isIdent = (c) => /[A-Za-z0-9_$%.]/.test(c);

  while (i < s.length){
    const c = s[i];
    if (isSpace(c)){
      i += 1;
      continue;
    }

    if (c === "{"){
      let j = i + 1;
      let depth = 1;
      let quote = null;
      while (j < s.length){
        const ch = s[j];
        if (quote){
          if (ch === "\\"){
            j += 2;
            continue;
          }
          if (ch === quote) quote = null;
          j += 1;
          continue;
        }
        if (ch === "\"" || ch === "'"){
          quote = ch;
          j += 1;
          continue;
        }
        if (ch === "{") depth += 1;
        else if (ch === "}"){
          depth -= 1;
          if (depth === 0) break;
        }
        j += 1;
      }
      if (s[j] !== "}") throw new Error("Unterminated object literal");
      out.push({ type: "obj", value: s.slice(i, j + 1) });
      i = j + 1;
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

    if (c === "#"){
      while (i < s.length && s[i] !== "\n") i += 1;
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(s[i + 1]))){
      const start = i;
      let j = i;

      while (j < s.length && isDigit(s[j])) j += 1;

      if (s[j] === "."){
        if (s[j + 1] !== "."){
          j += 1;
          while (j < s.length && isDigit(s[j])) j += 1;
        }
      }

      if (s[j] === "e" || s[j] === "E"){
        let k = j + 1;
        if (s[k] === "+" || s[k] === "-") k += 1;
        const expStart = k;
        while (k < s.length && isDigit(s[k])) k += 1;
        if (k !== expStart) j = k;
      }

      const raw = s.slice(start, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Invalid number literal: ${raw}`);
      out.push({ type: "num", value, start, end: j });
      i = j;
      continue;
    }

    if (isIdentStart(c)){
      let j = i + 1;
      while (j < s.length && isIdent(s[j])) j += 1;
      const name = s.slice(i, j);
      if (name === "if"){
        let k = j;
        while (k < s.length && isSpace(s[k])) k += 1;
        if (s[k] === "("){
          let depth = 1;
          let braceDepth = 0;
          let quote = null;
          let m = k + 1;
          while (m < s.length){
            const ch = s[m];
            if (quote){
              if (ch === "\\"){
                m += 2;
                continue;
              }
              if (ch === quote) quote = null;
              m += 1;
              continue;
            }
            if (ch === "\"" || ch === "'"){
              quote = ch;
              m += 1;
              continue;
            }
            if (ch === "{") braceDepth += 1;
            else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1);
            else if (ch === "(") depth += 1;
            else if (ch === ")"){
              depth -= 1;
              if (depth === 0) break;
            }
            m += 1;
          }
          if (s[m] !== ")") throw new Error("Unterminated if() call");
          const inner = s.slice(k + 1, m);

          const args = [];
          let start = 0;
          let argDepth = 0;
          let argBraceDepth = 0;
          let argQuote = null;
          for (let p = 0; p < inner.length; p++){
            const ch = inner[p];
            if (argQuote){
              if (ch === "\\"){
                p += 1;
                continue;
              }
              if (ch === argQuote) argQuote = null;
              continue;
            }
            if (ch === "\"" || ch === "'"){
              argQuote = ch;
              continue;
            }
            if (ch === "{") argBraceDepth += 1;
            else if (ch === "}") argBraceDepth = Math.max(0, argBraceDepth - 1);
            else if (ch === "(") argDepth += 1;
            else if (ch === ")") argDepth = Math.max(0, argDepth - 1);
            if (ch === "," && argDepth === 0 && argBraceDepth === 0){
              args.push(inner.slice(start, p).trim());
              start = p + 1;
            }
          }
          args.push(inner.slice(start).trim());

          if (args.length !== 3) throw new Error("if() expects 3 arguments");
          out.push({ type: "lazy_if", cond: args[0], then: args[1], else: args[2] });
          i = m + 1;
          continue;
        }
      }

      if (!isUnitToken(name)){
        let p = i - 1;
        while (p >= 0 && isSpace(s[p])) p -= 1;
        const precededByDigit = p >= 0 && isDigit(s[p]);
        if (precededByDigit){
          const digitIdx = name.search(/[0-9]/);
          if (digitIdx > 0){
            const hasAlphaAfterDigit = /[A-Za-z_$%]/.test(name.slice(digitIdx + 1));
            if (hasAlphaAfterDigit){
              const head = name.slice(0, digitIdx);
              if (isUnitToken(head)){
                out.push({ type: "id", value: head });
                i = i + digitIdx;
                continue;
              }
            }
          }
        }
      }

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

    const excerptRadius = 32;
    const start = Math.max(0, i - excerptRadius);
    const end = Math.min(s.length, i + excerptRadius);
    const head = start > 0 ? "…" : "";
    const tail = end < s.length ? "…" : "";
    const excerpt = head + s.slice(start, end) + tail;
    throw new Error(`Unexpected character "${c}" at position ${i + 1} in ${JSON.stringify(excerpt)}`);
  }
  return out;
}

export function insertImplicitMultiplication(tokens){
  const out = [];
  const canMultiplyLeft = (t) => t.type === "num" || t.type === "id" || t.type === ")" || t.type === "lazy_if";
  const canMultiplyRight = (t) => t.type === "num" || t.type === "id" || t.type === "(" || t.type === "lazy_if";

  const approxEqual = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;
  const isCompoundFeetInchesBoundary = (left, rightNum, rightUnit) => {
    if (!left || !rightNum || !rightUnit) return false;
    if (left.type !== "id" || rightNum.type !== "num" || rightUnit.type !== "id") return false;
    if (!isUnitToken(left.value) || !isUnitToken(rightUnit.value)) return false;
    const u1 = UNIT[left.value];
    const u2 = UNIT[rightUnit.value];
    if (!u1 || !u2) return false;
    if (u1.kind !== "len" || u2.kind !== "len") return false;
    return approxEqual(u1.toBase, 1) && approxEqual(u2.toBase, 1 / 12);
  };

  for (let i = 0; i < tokens.length; i++){
    const t = tokens[i];
    out.push(t);
    const next = tokens[i + 1];
    if (!next) continue;
    if (!canMultiplyLeft(t) || !canMultiplyRight(next)) continue;
    if (t.type === "id" && next.type === "(") continue;
    const next2 = tokens[i + 2];
    if (isCompoundFeetInchesBoundary(t, next, next2)){
      out.push({ type: "op", value: "+" });
    }else{
      out.push({ type: "op", value: "*" });
    }
  }

  return out;
}

export function toRPN(tokens){
  const output = [];
  const stack = [];

  const isUnaryMinus = (t, prev) => t.type === "op" && t.value === "-" && (!prev || prev.type === "(" || prev.type === "," || (prev.type === "op"));

  function markCallArgIfNeeded(){
    for (let i = stack.length - 1; i >= 0; i--){
      const entry = stack[i];
      if (!entry || entry.type !== "(") continue;
      if (!entry.call) return;
      if (!entry.expectingValue) return;
      entry.argc += 1;
      entry.expectingValue = false;
      return;
    }
  }

  let prev = null;
  for (let idx = 0; idx < tokens.length; idx++){
    const t = tokens[idx];

    if (t.type === "num"){
      markCallArgIfNeeded();
      output.push(t);
    }else if (t.type === "str"){
      markCallArgIfNeeded();
      output.push(t);
    }else if (t.type === "obj"){
      markCallArgIfNeeded();
      output.push(t);
    }else if (t.type === "lazy_if"){
      markCallArgIfNeeded();
      output.push(t);
    }else if (t.type === "id"){
      const next = tokens[idx + 1];
      if (next && next.type === "("){
        markCallArgIfNeeded();
        stack.push({ type: "fn", value: t.value });
      }else{
        markCallArgIfNeeded();
        output.push(t);
      }
    }else if (t.type === ","){
      while (stack.length && stack[stack.length - 1].type !== "("){
        output.push(stack.pop());
      }
      if (!stack.length) throw new Error("Misplaced comma");
      for (let i = stack.length - 1; i >= 0; i--){
        const entry = stack[i];
        if (!entry || entry.type !== "(") continue;
        if (!entry.call) break;
        entry.expectingValue = true;
        break;
      }
    }else if (t.type === "op"){
      if (isUnaryMinus(t, prev)){
        markCallArgIfNeeded();
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
      const isCall = stack.length && stack[stack.length - 1].type === "fn";
      stack.push({ type: "(", call: Boolean(isCall), argc: 0, expectingValue: Boolean(isCall) });
    }else if (t.type === ")"){
      while (stack.length && stack[stack.length - 1].type !== "("){
        output.push(stack.pop());
      }
      if (!stack.length) throw new Error("Mismatched parentheses");
      const paren = stack.pop();

      if (stack.length && stack[stack.length - 1].type === "fn"){
        const fnTok = stack.pop();
        if (paren && paren.call){
          fnTok.argc = paren.argc;
        }
        output.push(fnTok);
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

function tryBuildObjAssy(raw, evalString){
  const text = raw.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  const inner = text.slice(1, -1).trim();
  if (!inner) return null;

  const entries = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < inner.length; i++){
    const ch = inner[i];
    if (quote){
      if (ch === "\\"){i += 1; continue;}
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "\"" || ch === "'"){quote = ch; continue;}
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "," || ch === ";")){
      const piece = inner.slice(start, i).trim();
      if (piece) entries.push(piece);
      start = i + 1;
    }
  }
  const tail = inner.slice(start).trim();
  if (tail) entries.push(tail);
  if (!entries.length) return null;

  const fields = Object.create(null);
  for (const entry of entries){
    let sep = -1;
    let d = 0, q = null;
    for (let i = 0; i < entry.length; i++){
      const ch = entry[i];
      if (q){
        if (ch === "\\"){i += 1; continue;}
        if (ch === q) q = null;
        continue;
      }
      if (ch === "\"" || ch === "'"){q = ch; continue;}
      if (ch === "(" || ch === "{") d += 1;
      else if (ch === ")" || ch === "}") d = Math.max(0, d - 1);
      if (d === 0 && ch === ":" && sep < 0){sep = i; break;}
    }
    if (sep >= 0){
      const keyRaw = entry.slice(0, sep).trim();
      const valExpr = entry.slice(sep + 1).trim();
      if (!keyRaw || !valExpr) return null;
      const key = (keyRaw.startsWith("\"") && keyRaw.endsWith("\"")) || (keyRaw.startsWith("'") && keyRaw.endsWith("'"))
        ? keyRaw.slice(1, -1) : keyRaw;
      try{ fields[key] = { value: evalString(valExpr), raw: valExpr }; }
      catch{ return null; }
    }else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry)){
      try{ fields[entry] = { value: evalString(entry), raw: entry }; }
      catch{ return null; }
    }else{
      return null;
    }
  }
  return { __assy: true, __obj: true, name: "_anon", fields, raw };
}

export function evalRPN(rpn, ctx){
  const st = [];
  const onResolve = typeof ctx.onResolve === "function" ? ctx.onResolve : null;
  const onCall = typeof ctx.onCall === "function" ? ctx.onCall : null;
  const allowedEffects = typeof ctx.allowedEffects === "number" ? ctx.allowedEffects : EFFECT.PURE;
  const evalExpr = typeof ctx.evalExpr === "function" ? ctx.evalExpr : null;
  const evalString = typeof ctx.evalString === "function" ? ctx.evalString : null;
  const resolveExpr = evalExpr || evalString;

  function recordResolve(name, resolvedName = null){
    if (!onResolve) return;
    onResolve(name, resolvedName);
  }

  function getVar(name){
    if (name === "pi") return scalar(Math.PI);
    if (name === "e") return scalar(Math.E);

    if (ctx.unitOverrides && Object.prototype.hasOwnProperty.call(ctx.unitOverrides, name)){
      recordResolve(name);
      return ctx.unitOverrides[name];
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

    if (isUnitToken(name)){
      const unit = UNIT[name];
      recordResolve(name);
      return makeQty(unit.toBase, unit.kind, name);
    }

    const dotIdx = name.indexOf(".");
    if (dotIdx > 0){
      const baseName = name.slice(0, dotIdx);
      const fieldName = name.slice(dotIdx + 1);
      let base = null;
      if (Object.prototype.hasOwnProperty.call(ctx.vars, baseName)){
        base = ctx.vars[baseName];
      }else if (Object.prototype.hasOwnProperty.call(ctx.aliases, baseName)){
        base = ctx.vars[ctx.aliases[baseName]];
      }
      if (base && typeof base === "object" && base.__assy && base.fields){
        if (Object.prototype.hasOwnProperty.call(base.fields, fieldName)){
          recordResolve(name);
          return base.fields[fieldName].value;
        }
      }
    }
    throw new Error(`Unknown identifier: ${name}`);
  }

  for (const t of rpn){
    if (t.type === "num"){
      st.push(scalar(t.value));
    }else if (t.type === "str"){
      st.push(string(t.value));
    }else if (t.type === "obj"){
      if (resolveExpr){
        const assy = tryBuildObjAssy(t.value, resolveExpr);
        if (assy){ st.push(assy); continue; }
      }
      st.push({ __obj: true, raw: t.value });
    }else if (t.type === "lazy_if"){
      if (!resolveExpr) throw new Error("Lazy if() requires evalExpr support");
      const condVal = resolveExpr(t.cond);
      const branch = isTruthy(condVal) ? t.then : t.else;
      st.push(resolveExpr(branch));
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

      const need = typeof fn.effects === "number" ? fn.effects : EFFECT.PURE;
      if ((need & ~allowedEffects) !== 0){
        const needNames = effectNames(need).join("|");
        const allowNames = effectNames(allowedEffects).join("|");
        throw new Error(`ERR[E_EFFECT] ${fnName}(): effect ${needNames} not allowed in this context (allowed: ${allowNames})`);
      }

      const declaredArity = fn.arity;
      const arity = declaredArity < 0 ? (t.argc ?? 0) : declaredArity;
      const args = [];
      for (let i = 0; i < arity; i++){
        const v = st.pop();
        if (v === undefined) throw new Error(`Not enough args for ${fnName}()`);
        args.unshift(v);
      }
      if (fn.ctx){
        st.push(fn.impl(ctx, ...args));
      }else{
        st.push(fn.impl(...args));
      }
    }else{
      throw new Error("Bad RPN token");
    }
  }
  if (st.length !== 1) throw new Error("Expression did not reduce to a single value");
  return st[0];
}

export function evalExpressionIR(ir, ctx){
  if (!ir || typeof ir !== "object") throw new Error("evalExpressionIR requires an IR node.");
  const onResolve = typeof ctx.onResolve === "function" ? ctx.onResolve : null;
  const onCall = typeof ctx.onCall === "function" ? ctx.onCall : null;
  const allowedEffects = typeof ctx.allowedEffects === "number" ? ctx.allowedEffects : EFFECT.PURE;
  const evalExpr = typeof ctx.evalExpr === "function" ? ctx.evalExpr : null;
  const evalString = typeof ctx.evalString === "function" ? ctx.evalString : null;
  const resolveExpr = evalExpr || evalString;

  function recordResolve(name, resolvedName = null){
    if (!onResolve) return;
    onResolve(name, resolvedName);
  }

  function getVar(name){
    if (name === "pi") return scalar(Math.PI);
    if (name === "e") return scalar(Math.E);

    if (ctx.unitOverrides && Object.prototype.hasOwnProperty.call(ctx.unitOverrides, name)){
      recordResolve(name);
      return ctx.unitOverrides[name];
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
    if (isUnitToken(name)){
      const unit = UNIT[name];
      recordResolve(name);
      return makeQty(unit.toBase, unit.kind, name);
    }
    const dotIdx = name.indexOf(".");
    if (dotIdx > 0){
      const baseName = name.slice(0, dotIdx);
      const fieldName = name.slice(dotIdx + 1);
      let base = null;
      if (Object.prototype.hasOwnProperty.call(ctx.vars, baseName)){
        base = ctx.vars[baseName];
      }else if (Object.prototype.hasOwnProperty.call(ctx.aliases, baseName)){
        base = ctx.vars[ctx.aliases[baseName]];
      }
      if (base && typeof base === "object" && base.__assy && base.fields && Object.prototype.hasOwnProperty.call(base.fields, fieldName)){
        recordResolve(name);
        return base.fields[fieldName].value;
      }
    }
    throw new Error(`Unknown identifier: ${name}`);
  }

  function run(node){
    if (!node || typeof node !== "object") throw new Error("Invalid IR node.");
    if (node.kind === "literal"){
      if (node.valueType === "number") return scalar(node.value);
      if (node.valueType === "string") return string(node.value);
      return box(node.value);
    }
    if (node.kind === "identifier"){
      return getVar(node.name);
    }
    if (node.kind === "binary"){
      const left = run(node.left);
      const right = run(node.right);
      if (!OPS[node.op]) throw new Error(`Unsupported operator in IR: ${node.op}`);
      return OPS[node.op].fn(left, right);
    }
    if (node.kind === "call"){
      const fnName = node.name;
      if (onCall) onCall(fnName);
      const fn = ctx.fns[fnName];
      if (!fn) throw new Error(`Unknown function: ${fnName}()`);
      const need = typeof fn.effects === "number" ? fn.effects : EFFECT.PURE;
      if ((need & ~allowedEffects) !== 0){
        const needNames = effectNames(need).join("|");
        const allowNames = effectNames(allowedEffects).join("|");
        throw new Error(`ERR[E_EFFECT] ${fnName}(): effect ${needNames} not allowed in this context (allowed: ${allowNames})`);
      }
      const args = (Array.isArray(node.args) ? node.args : []).map((arg) => run(arg));
      if (fn.arity >= 0 && args.length !== fn.arity){
        throw new Error(`${fnName}() expected ${fn.arity} args, got ${args.length}`);
      }
      return fn.ctx ? fn.impl(ctx, ...args) : fn.impl(...args);
    }
    if (node.kind === "object"){
      if (resolveExpr){
        const assy = tryBuildObjAssy(node.raw, resolveExpr);
        if (assy) return assy;
      }
      return { __obj: true, raw: node.raw };
    }
    if (node.kind === "conditional"){
      const condVal = run(node.cond);
      return isTruthy(condVal) ? run(node.then) : run(node.else);
    }
    throw new Error(`Unknown IR kind: ${node.kind}`);
  }

  return run(ir);
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
    if (Object.prototype.hasOwnProperty.call(vars, name)){
      referenced.add(name);
      continue;
    }
    if (isUnitToken(name) || name === "pi" || name === "e") continue;
    if (fnNames && fnNames.has(name)) continue;
    if (name.includes(".")) continue;
    unknown.push(name);
  }

  if (!unknown.length) return Object.create(null);

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
