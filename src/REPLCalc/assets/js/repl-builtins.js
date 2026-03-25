import { add, div, mul, pow, sub } from "./repl-ops.js";
import { convert, isQty, makeQty, qtyToString } from "./repl-units.js";
import { isTruthy, normalizeCompare } from "./repl-expression.js";
import { __internal as OPS_INTERNAL } from "./repl-ops.js";
import { __internal as UNITS_INTERNAL } from "./repl-units.js";
import { EFFECT } from "./repl-effects.js";
import { seedRng } from "./repl-rng.js";
import {
  box,
  dimVecEqual,
  dimVecFromKindString,
  dimVecIsZero,
  kindFromDimVec,
  isBool,
  isDim,
  scalar,
  unbox,
  valueKind,
} from "./repl-values.js";
import { attachMapBuiltins } from "./repl-builtins-map.js";
import { attachConstructionBuiltins } from "./repl-builtins-construction.js";
import { attachRateBuiltins } from "./repl-builtins-rate.js";
import { attachProjectBuiltins } from "./repl-builtins-project.js";
import { attachUnitAlgebraBuiltins } from "./repl-builtins-unitalgebra.js";
import { attachCostAlgebraBuiltins } from "./repl-builtins-costalgebra.js";
import { attachScenarioBuiltins } from "./repl-builtins-scenario.js";
import { attachGraphBuiltins } from "./repl-builtins-graph.js";
import { attachMaterialBuiltins } from "./repl-builtins-material.js";
import { attachGeometryBuiltins } from "./repl-builtins-geometry.js";
import { attachLinAlgBuiltins } from "./repl-builtins-linalg.js";
import { attachUncertaintyBuiltins } from "./repl-builtins-uncertainty.js";
import { attachCsiBuiltins } from "./repl-builtins-csi.js";
import { attachFinishBuiltins } from "./repl-builtins-finishes.js";

function normalizeKindList(spec){
  if (!spec) return null;
  if (typeof spec === "string") return [spec];
  if (Array.isArray(spec)) return spec.slice();
  if (Array.isArray(spec.kinds)) return spec.kinds.slice();
  if (typeof spec.kinds === "string") return [spec.kinds];
  return null;
}

function describeValueForError(v){
  if (isDim(v)){
    const unit = v.unit ? ` (${v.unit})` : "";
    return `Dim[${v.kind}]${unit}`;
  }
  const k = valueKind(v);
  if (k) return k;
  return typeof v;
}

function coerceArg(fnName, idx, value, spec){
  const v = box(value);
  const kinds = normalizeKindList(spec);
  if (!kinds || !kinds.length) return v;

  const allow = (k) => kinds.includes(k) || kinds.includes("any");
  const k0 = valueKind(v);

  if (allow(k0)){
    return enforceDimConstraints(fnName, idx, v, spec);
  }

  if (isBool(v) && allow("scalar")){
    return scalar(v.value ? 1 : 0);
  }

  if (isDim(v) && allow("scalar") && dimVecIsZero(v.dim)){
    return scalar(v.value);
  }

  const label = spec?.label ? String(spec.label) : `arg${idx + 1}`;
  throw new Error(`ERR[E_TYPE] ${fnName}(): ${label} expected ${kinds.join("|")}, got ${describeValueForError(v)}`);
}

function enforceDimConstraints(fnName, idx, v, spec){
  if (!spec) return v;
  if (!isDim(v)){
    return v;
  }

  if (spec.unit){
    const allowedUnits = Array.isArray(spec.unit) ? spec.unit.map(String) : [String(spec.unit)];
    if (!v.unit || !allowedUnits.includes(v.unit)){
      const label = idx < 0 ? "return" : (spec?.label ? String(spec.label) : `arg${idx + 1}`);
      throw new Error(`${fnName}(): ${label} expected unit ${allowedUnits.join("|")}`);
    }
  }

  if (spec.dim !== undefined && spec.dim !== null){
    const want = Array.isArray(spec.dim) ? spec.dim : dimVecFromKindString(spec.dim);
    if (!dimVecEqual(v.dim, want)){
      const label = idx < 0 ? "return" : (spec?.label ? String(spec.label) : `arg${idx + 1}`);
      throw new Error(`ERR[E_DIM] ${fnName}(): ${label} expected dim ${String(spec.dim)}, got ${describeValueForError(v)}`);
    }
  }

  return v;
}

function coerceArgs(fnName, sig, args){
  if (!sig || !Array.isArray(sig.args)) return args;
  const out = args.slice();
  for (let i = 0; i < out.length; i++){
    const spec = sig.args[i];
    if (!spec) continue;
    out[i] = coerceArg(fnName, i, out[i], spec);
  }
  return out;
}

function validateReturn(fnName, sig, ret){
  const r = box(ret);
  if (!sig || !sig.returns) return r;
  const kinds = normalizeKindList(sig.returns);
  if (kinds && kinds.length){
    const k = valueKind(r);
    const ok = kinds.includes("any") || kinds.includes(k);
    if (!ok){
      throw new Error(`ERR[E_TYPE] ${fnName}(): return expected ${kinds.join("|")}, got ${describeValueForError(r)}`);
    }
  }
  return enforceDimConstraints(fnName, -1, r, sig.returns);
}

export function defFn(name, arity, sigOrImpl, maybeImpl){
  const sig = typeof sigOrImpl === "function" ? null : (sigOrImpl || null);
  const impl = typeof sigOrImpl === "function" ? sigOrImpl : maybeImpl;
  if (typeof impl !== "function") throw new Error("defFn() expects an implementation function");
  const effects = sig && typeof sig.effects === "number" ? sig.effects : EFFECT.PURE;
  return {
    arity,
    sig,
    effects,
    impl: (...args) => {
      const boxedArgs = args.map((a) => box(a));
      const coerced = coerceArgs(name, sig, boxedArgs);
      const result = impl(...coerced.map((a) => unbox(a)));
      return validateReturn(name, sig, result);
    },
  };
}

export function defFnCtx(name, arity, sigOrImpl, maybeImpl){
  const sig = typeof sigOrImpl === "function" ? null : (sigOrImpl || null);
  const impl = typeof sigOrImpl === "function" ? sigOrImpl : maybeImpl;
  if (typeof impl !== "function") throw new Error("defFnCtx() expects an implementation function");
  const effects = sig && typeof sig.effects === "number" ? sig.effects : EFFECT.PURE;
  return {
    arity,
    ctx: true,
    sig,
    effects,
    impl: (ctx, ...args) => {
      const boxedArgs = args.map((a) => box(a));
      const coerced = coerceArgs(name, sig, boxedArgs);
      const result = impl(ctx, ...coerced.map((a) => unbox(a)));
      return validateReturn(name, sig, result);
    },
  };
}

export function createBaseFns(){
  const baseFns = Object.create(null);

  function requireScalarArg(value, label){
    if (isQty(value) && value.kind !== "scalar"){
      throw new Error(`${label} expects a dimensionless scalar value`);
    }
    return isQty(value) ? value.value : value;
  }

  function requireAssemblyArg(value, label){
    if (!value || typeof value !== "object" || !value.__assy) throw new Error(`${label} expects an assembly`);
    return value;
  }

  function isPlainObject(value){
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return false;
    if (value.__assy || value.__graph || value.__scenario || value.__dist || value.__vec || value.__mat || value.__range) return false;
    if (value.__material || value.__pt || value.__poly) return false;
    return true;
  }

  function normalizeMoney(value){
    if (isQty(value)){
      if (value.kind !== "cur") throw new Error("Expected currency quantity");
      return value;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) throw new Error("Expected numeric currency");
    return makeQty(num, "cur");
  }

  baseFns.seed = defFn("seed", 1, {
    args: [{ label: "n", kinds: ["scalar", "dim"], dim: "scalar" }],
    returns: { kinds: ["scalar"] },
    effects: EFFECT.RNG,
  }, (n) => {
    const v = requireScalarArg(n, "seed");
    seedRng(v);
    return v;
  });

  baseFns.abs = defFn("abs", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"] }],
  }, (x) => isQty(x) ? makeQty(Math.abs(x.value), x.kind) : Math.abs(x));
  baseFns.min = defFn("min", 2, {
    args: [{ label: "a", kinds: ["any"] }, { label: "b", kinds: ["any"] }],
    returns: { kinds: ["any"] },
  }, (a, b) => {
    const [av, bv] = normalizeCompare(a, b);
    return av <= bv ? a : b;
  });
  baseFns.max = defFn("max", 2, {
    args: [{ label: "a", kinds: ["any"] }, { label: "b", kinds: ["any"] }],
    returns: { kinds: ["any"] },
  }, (a, b) => {
    const [av, bv] = normalizeCompare(a, b);
    return av >= bv ? a : b;
  });
  baseFns.round = defFn("round", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"] }],
  }, (x) => isQty(x) ? makeQty(Math.round(x.value), x.kind) : Math.round(x));
  baseFns.ceil = defFn("ceil", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"] }],
  }, (x) => isQty(x) ? makeQty(Math.ceil(x.value), x.kind) : Math.ceil(x));
  baseFns.floor = defFn("floor", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"] }],
  }, (x) => isQty(x) ? makeQty(Math.floor(x.value), x.kind) : Math.floor(x));

  baseFns.floor_div = defFn("floor_div", 2, {
    args: [
      { label: "x", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "m", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (x, m) => {
    const xv = requireScalarArg(x, "floor_div x");
    const mv = requireScalarArg(m, "floor_div m");
    if (mv === 0) throw new Error("floor_div(): divisor cannot be 0");
    return Math.floor(xv / mv);
  });

  baseFns.mod_floor = defFn("mod_floor", 2, {
    args: [
      { label: "x", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "m", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (x, m) => {
    const xv = requireScalarArg(x, "mod_floor x");
    const mv = requireScalarArg(m, "mod_floor m");
    if (mv === 0) throw new Error("mod_floor(): modulus cannot be 0");
    const q = Math.floor(xv / mv);
    return xv - mv * q;
  });

  baseFns.mod_pos = defFn("mod_pos", 2, {
    args: [
      { label: "x", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "m", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (x, m) => {
    const xv = requireScalarArg(x, "mod_pos x");
    let mv = requireScalarArg(m, "mod_pos m");
    if (mv === 0) throw new Error("mod_pos(): modulus cannot be 0");
    if (mv < 0) mv = -mv;
    let r = xv % mv;
    if (r < 0) r += mv;
    return r;
  });

  function toU32(value, label){
    if (isQty(value)){
      if (value.kind !== "scalar") throw new Error(`${label} expects a dimensionless scalar value`);
      const n = Number(value.value);
      if (!Number.isFinite(n)) throw new Error(`${label} expects a finite scalar`);
      return (n >>> 0);
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${label} expects a finite scalar`);
    return (n >>> 0);
  }

  function toShift(value, label){
    const n = toU32(value, label);
    return (n & 31);
  }

  baseFns.band = defFn("band", 2, {
    args: [
      { label: "a", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "b", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (a, b) => (toU32(a, "band a") & toU32(b, "band b")) >>> 0);

  baseFns.bor = defFn("bor", 2, {
    args: [
      { label: "a", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "b", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (a, b) => (toU32(a, "bor a") | toU32(b, "bor b")) >>> 0);

  baseFns.bxor = defFn("bxor", 2, {
    args: [
      { label: "a", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "b", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (a, b) => (toU32(a, "bxor a") ^ toU32(b, "bxor b")) >>> 0);

  baseFns.bnot = defFn("bnot", 1, {
    args: [{ label: "a", kinds: ["scalar", "dim"], dim: "scalar" }],
    returns: { kinds: ["scalar"] },
  }, (a) => (~toU32(a, "bnot a")) >>> 0);

  baseFns.shl = defFn("shl", 2, {
    args: [
      { label: "a", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "n", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (a, n) => (toU32(a, "shl a") << toShift(n, "shl n")) >>> 0);

  baseFns.shr = defFn("shr", 2, {
    args: [
      { label: "a", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "n", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (a, n) => (toU32(a, "shr a") >>> toShift(n, "shr n")) >>> 0);

  baseFns.flag_has = defFn("flag_has", 2, {
    args: [
      { label: "flags", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "mask", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (flags, mask) => {
    const f = toU32(flags, "flag_has flags");
    const m = toU32(mask, "flag_has mask");
    return ((f & m) !== 0) ? 1 : 0;
  });

  baseFns.flag_set = defFn("flag_set", 3, {
    args: [
      { label: "flags", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "mask", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "on", kinds: ["any"] },
    ],
    returns: { kinds: ["scalar"] },
  }, (flags, mask, on) => {
    const f = toU32(flags, "flag_set flags");
    const m = toU32(mask, "flag_set mask");
    if (isTruthy(on)) return (f | m) >>> 0;
    return (f & (~m)) >>> 0;
  });
  baseFns.sqrt = defFn("sqrt", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"] }],
  }, (x) => pow(x, 0.5));
  baseFns.pow = defFn("pow", 2, {
    args: [{ label: "a", kinds: ["scalar", "dim"] }, { label: "b", kinds: ["scalar"] }],
  }, (a, b) => pow(a, b));
  baseFns.exp = defFn("exp", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.exp(requireScalarArg(x, "exp")));
  baseFns.log = defFn("log", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.log(requireScalarArg(x, "log")));
  baseFns.log10 = defFn("log10", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.log10(requireScalarArg(x, "log10")));

  baseFns.sin = defFn("sin", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.sin(requireScalarArg(x, "sin")));
  baseFns.cos = defFn("cos", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.cos(requireScalarArg(x, "cos")));
  baseFns.tan = defFn("tan", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.tan(requireScalarArg(x, "tan")));
  baseFns.asin = defFn("asin", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.asin(requireScalarArg(x, "asin")));
  baseFns.acos = defFn("acos", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.acos(requireScalarArg(x, "acos")));
  baseFns.atan = defFn("atan", 1, {
    args: [{ label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => Math.atan(requireScalarArg(x, "atan")));
  baseFns.atan2 = defFn("atan2", 2, {
    args: [{ label: "y", kinds: ["scalar"] }, { label: "x", kinds: ["scalar"] }],
    returns: { kinds: ["scalar"] },
  }, (y, x) => Math.atan2(requireScalarArg(y, "atan2"), requireScalarArg(x, "atan2")));

  baseFns.usd = defFn("usd", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "cur" }],
    returns: { kinds: ["dim"], dim: "cur" },
  }, (x) => normalizeMoney(x));


  function buildAssy(name, fields){
    return {
      __assy: true,
      name,
      fields,
    };
  }

  function fieldInfo(value){
    return { value, note: "", raw: "" };
  }

  function percentile(sorted, p){
    if (!sorted.length) return 0;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const t = idx - lo;
    return sorted[lo] * (1 - t) + sorted[hi] * t;
  }

  function summarizeSamples(samples){
    if (!samples.length){
      return buildAssy("mc", {
        mean: fieldInfo(0),
        p10: fieldInfo(0),
        p50: fieldInfo(0),
        p90: fieldInfo(0),
      });
    }

    const first = samples[0];
    const kind = isQty(first) ? first.kind : null;
    const values = [];
    let sum = 0;
    for (const s of samples){
      if (isQty(s)){
        if (!kind || s.kind !== kind) throw new Error("mc sample unit mismatch");
        values.push(s.value);
        sum += s.value;
      }else{
        if (kind) throw new Error("mc mixed scalar/unit samples");
        const n = Number(s);
        if (!Number.isFinite(n)) throw new Error("mc samples must be numeric");
        values.push(n);
        sum += n;
      }
    }
    values.sort((a, b) => a - b);
    const meanNum = sum / values.length;
    const p10Num = percentile(values, 0.10);
    const p50Num = percentile(values, 0.50);
    const p90Num = percentile(values, 0.90);

    const wrap = (n) => kind ? makeQty(n, kind) : n;
    return buildAssy("mc", {
      mean: fieldInfo(wrap(meanNum)),
      p10: fieldInfo(wrap(p10Num)),
      p50: fieldInfo(wrap(p50Num)),
      p90: fieldInfo(wrap(p90Num)),
      n: fieldInfo(values.length),
    });
  }


  function isObjToken(value){
    return value && typeof value === "object" && value.__obj && typeof value.raw === "string";
  }

  function parseObjectLiteral(raw){
    const text = raw.trim();
    if (!text.startsWith("{") || !text.endsWith("}")) throw new Error("Invalid object literal");
    const inner = text.slice(1, -1);
    const entries = [];
    let start = 0;
    let depth = 0;
    let quote = null;
    for (let i = 0; i < inner.length; i++){
      const ch = inner[i];
      if (quote){
        if (ch === "\\"){
          i += 1;
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "\"" || ch === "'"){
        quote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (ch === "{") depth += 1;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      if (depth === 0 && (ch === "," || ch === ";")){
        const piece = inner.slice(start, i).trim();
        if (piece) entries.push(piece);
        start = i + 1;
      }
    }
    const tail = inner.slice(start).trim();
    if (tail) entries.push(tail);

    const parsed = [];
    for (const entry of entries){
      let d = 0;
      let q = null;
      let colon = -1;
      for (let i = 0; i < entry.length; i++){
        const ch = entry[i];
        if (q){
          if (ch === "\\"){
            i += 1;
            continue;
          }
          if (ch === q) q = null;
          continue;
        }
        if (ch === "\"" || ch === "'"){
          q = ch;
          continue;
        }
        if (ch === "(") d += 1;
        else if (ch === ")") d = Math.max(0, d - 1);
        else if (ch === "{") d += 1;
        else if (ch === "}") d = Math.max(0, d - 1);
        if (d === 0 && ch === ":"){
          colon = i;
          break;
        }
      }
      if (colon < 0) throw new Error("Object literal entries must be key: value");
      const keyRaw = entry.slice(0, colon).trim();
      const valueRaw = entry.slice(colon + 1).trim();
      if (!keyRaw) throw new Error("Object literal entry missing key");
      if (!valueRaw) throw new Error("Object literal entry missing value");
      const key = (() => {
        if ((keyRaw.startsWith("\"") && keyRaw.endsWith("\"")) || (keyRaw.startsWith("'") && keyRaw.endsWith("'"))){
          return keyRaw.slice(1, -1);
        }
        return keyRaw;
      })();
      parsed.push({ key, expr: valueRaw });
    }
    return parsed;
  }


  function valueToString(value){
    if (isQty(value)) return qtyToString(value);
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object"){
      if (value.__assy) return String(value.name || "assy");
      if (value.__graph) return String(value.name || "graph");
      if (value.__scenario) return String(value.name || "scenario");
      if (value.__material) return String(value.name || "material");
      if (value.__pt) return "pt";
      if (value.__poly) return "poly";
      try{
        return JSON.stringify(value);
      }catch{
        return String(value);
      }
    }
    return String(value);
  }

  baseFns.str = defFn("str", 1, {
    args: [{ label: "value", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (value) => valueToString(value));

  baseFns.cat = defFn("cat", -1, {
    args: [{ label: "value", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (...values) => values.map(valueToString).join(""));

  baseFns.len = defFn("len", 1, {
    args: [{ label: "s", kinds: ["string"] }],
    returns: { kinds: ["scalar"] },
  }, (s) => {
    if (typeof s !== "string") throw new Error("len expects a string");
    return s.length;
  });

  baseFns.char_code = defFn("char_code", 2, {
    args: [
      { label: "s", kinds: ["string"] },
      { label: "i", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (s, i) => {
    if (typeof s !== "string") throw new Error("char_code expects a string");
    const idx = toIndex(i, "char_code i");
    if (idx < 0 || idx >= s.length) return -1;
    const code = s.charCodeAt(idx);
    return Number.isFinite(code) ? code : -1;
  });

  function charClass(code){
    const c = Number(code);
    if (!Number.isFinite(c) || c < 0) return 0;
    const u = (c >>> 0);
    if (u >= 48 && u <= 57) return 1; // digit
    if ((u >= 65 && u <= 90) || (u >= 97 && u <= 122)) return 2; // alpha
    if (u === 9 || u === 10 || u === 13 || u === 32) return 3; // space
    if (u === 45) return 4; // '-'
    if (u === 47) return 5; // '/'
    if (u === 46) return 6; // '.'
    if (u === 95) return 7; // '_'
    if (u === 58) return 8; // ':'
    if (u === 44) return 9; // ','
    if (u === 35) return 10; // '#'
    return 0;
  }

  baseFns.charclass = defFn("charclass", 1, {
    args: [{ label: "code", kinds: ["scalar", "dim"], dim: "scalar" }],
    returns: { kinds: ["scalar"] },
  }, (code) => charClass(code));

  baseFns.class = baseFns.charclass;

  baseFns.scan = defFn("scan", 2, {
    args: [
      { label: "s", kinds: ["string"] },
      { label: "i", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["assy"] },
  }, (s, i) => {
    if (typeof s !== "string") throw new Error("scan expects a string");
    const idx = toIndex(i, "scan i");
    const code = (idx < 0 || idx >= s.length) ? -1 : s.charCodeAt(idx);
    const ch = (idx < 0 || idx >= s.length) ? "" : s[idx];
    const cls = charClass(code);
    return buildAssy("scan", {
      i: fieldInfo((idx < 0) ? 0 : Math.min(idx + 1, s.length)),
      code: fieldInfo(Number.isFinite(code) ? code : -1),
      ch: fieldInfo(ch),
      cls: fieldInfo(cls),
    });
  });

  baseFns.scan_while = defFnCtx("scan_while", -1, {
    args: [],
    returns: { kinds: ["assy"] },
  }, (ctx, ...args) => {
    if (!ctx || typeof ctx.evalString !== "function") throw new Error("scan_while requires evalString support");
    if (args.length !== 3 && args.length !== 5) throw new Error("scan_while expects (s, i, pred) or (s, i, pred, acc0, accExpr)");
    const [s, i, pred] = args;
    const acc0 = args.length === 5 ? args[3] : undefined;
    const accExpr = args.length === 5 ? args[4] : undefined;
    if (typeof s !== "string") throw new Error("scan_while expects a string");
    if (typeof pred !== "string") throw new Error("scan_while expects predicate as string expression");
    if (args.length === 5 && typeof accExpr !== "string") throw new Error("scan_while expects accExpr as string expression");
    const start = toIndex(i, "scan_while i");
    let j = Math.max(0, start);
    let acc = acc0;
    while (j < s.length){
      const code = s.charCodeAt(j);
      const ch = s[j];
      const cls = charClass(code);
      const locals = args.length === 5 ? { s, i: j, code, ch, cls, acc } : { s, i: j, code, ch, cls };
      const ok = ctx.evalString(pred, locals);
      if (!isTruthy(ok)) break;
      if (args.length === 5){
        acc = ctx.evalString(accExpr, locals);
      }
      j += 1;
    }
    const fields = {
      i: fieldInfo(j),
      text: fieldInfo(s.slice(Math.max(0, start), j)),
    };
    if (args.length === 5) fields.acc = fieldInfo(acc);
    return buildAssy("scan", fields);
  });

  baseFns.take_while = defFnCtx("take_while", 3, {
    args: [
      { label: "s", kinds: ["string"] },
      { label: "i", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "pred", kinds: ["string"] },
    ],
    returns: { kinds: ["string"] },
  }, (ctx, s, i, pred) => {
    const r = baseFns.scan_while.impl(ctx, s, i, pred);
    const t = r && typeof r === "object" && r.__assy ? r.fields?.text?.value : "";
    return (t === undefined || t === null) ? "" : String(t);
  });


  baseFns.to_json = defFn("to_json", 1, {
    args: [{ label: "value", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (value) => {
    const encode = (v) => {
      if (isQty(v)){
        return { __type: "qty", value: v.value, kind: v.kind, unit: v.unit || null };
      }
      if (v && typeof v === "object"){
        if (v.__assy){
          const fields = Object.create(null);
          for (const [k, info] of Object.entries(v.fields || {})){
            fields[k] = { value: encode(info?.value), note: info?.note || "", raw: info?.raw || "" };
          }
          return { __type: "assy", name: v.name || "assy", fields, flags: {
            __range: Boolean(v.__range),
            __vec: Boolean(v.__vec),
            __mat: Boolean(v.__mat),
          } };
        }
        if (v.__graph){
          const nodes = Object.create(null);
          for (const [id, node] of Object.entries(v.nodes || {})){
            nodes[id] = {
              id,
              cost: encode(node?.cost),
              total: encode(node?.total),
            };
          }
          const edges = Array.isArray(v.edges) ? v.edges.map((e) => ({ from: String(e.from), to: String(e.to) })) : [];
          return { __type: "graph", name: v.name || "graph", nodes, edges };
        }
        if (v.__scenario){
          return { __type: "scenario", name: v.name || "scenario", entries: Array.isArray(v.entries) ? v.entries.slice() : [] };
        }
        if (v.__dist){
          if (v.kind === "normal") return { __type: "dist", kind: "normal", mu: encode(v.mu), sigma: encode(v.sigma) };
          if (v.kind === "tri") return { __type: "dist", kind: "tri", a: encode(v.a), b: encode(v.b), c: encode(v.c) };
          return { __type: "dist", kind: v.kind };
        }
        if (v.__material){
          const props = Object.create(null);
          for (const [k, val] of Object.entries(v.props || {})) props[k] = encode(val);
          return { __type: "material", name: v.name || "material", props };
        }
        if (v.__pt){
          return { __type: "pt", x: encode(v.x), y: encode(v.y) };
        }
        if (v.__poly){
          return { __type: "poly", points: Array.isArray(v.points) ? v.points.map(encode) : [] };
        }
        if (isPlainObject(v)){
          const out = Object.create(null);
          for (const [k, val] of Object.entries(v)) out[k] = encode(val);
          return out;
        }
      }
      return v;
    };
    return JSON.stringify(encode(value), null, 2);
  });

  baseFns.from_json = defFn("from_json", 1, {
    args: [{ label: "text", kinds: ["string"] }],
    returns: { kinds: ["any"] },
  }, (text) => {
    if (typeof text !== "string") throw new Error("from_json expects a string");
    const raw = JSON.parse(text);
    const decode = (v) => {
      if (!v || typeof v !== "object") return v;
      if (Array.isArray(v)) return v.map(decode);
      if (v.__type === "qty") return makeQty(Number(v.value), String(v.kind || "scalar"), v.unit || null);
      if (v.__type === "assy"){
        const fields = Object.create(null);
        for (const [k, info] of Object.entries(v.fields || {})){
          fields[k] = {
            value: decode(info?.value),
            note: info?.note || "",
            raw: info?.raw || "",
          };
        }
        const assy = { __assy: true, name: v.name || "assy", fields };
        if (v.flags?.__range) assy.__range = true;
        if (v.flags?.__vec) assy.__vec = true;
        if (v.flags?.__mat) assy.__mat = true;
        return assy;
      }
      if (v.__type === "graph"){
        const nodes = Object.create(null);
        for (const [id, node] of Object.entries(v.nodes || {})){
          nodes[id] = { id, cost: decode(node?.cost), total: decode(node?.total) };
        }
        const edges = Array.isArray(v.edges) ? v.edges.map((e) => ({ from: String(e.from), to: String(e.to) })) : [];
        return { __graph: true, name: v.name || "graph", nodes, edges };
      }
      if (v.__type === "scenario"){
        return { __scenario: true, name: v.name || "scenario", entries: Array.isArray(v.entries) ? v.entries.slice() : [] };
      }
      if (v.__type === "dist"){
        if (v.kind === "normal") return distNormal(decode(v.mu), decode(v.sigma));
        if (v.kind === "tri") return distTri(decode(v.a), decode(v.b), decode(v.c));
        return { __dist: true, kind: String(v.kind || "dist") };
      }
      if (v.__type === "material"){
        const out = { __material: true, name: String(v.name || "material"), props: Object.create(null) };
        for (const [k, val] of Object.entries(v.props || {})) out.props[k] = decode(val);
        return out;
      }
      if (v.__type === "pt"){
        return { __pt: true, x: decode(v.x), y: decode(v.y) };
      }
      if (v.__type === "poly"){
        const pts = Array.isArray(v.points) ? v.points.map(decode) : [];
        return { __poly: true, points: pts };
      }
      const out = Object.create(null);
      for (const [k, val] of Object.entries(v)) out[k] = decode(val);
      return out;
    };
    return decode(raw);
  });

  function csvEscape(value){
    const s = String(value);
    if (/[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  baseFns.to_csv = defFn("to_csv", 1, {
    args: [{ label: "value", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (value) => {
    if (value && typeof value === "object" && value.__graph){
      const lines = [];
      lines.push("nodes:id,cost,total");
      for (const [id, node] of Object.entries(value.nodes || {})){
        const cost = node?.cost;
        const total = node?.total;
        lines.push([csvEscape(id), csvEscape(qtyToString(cost)), csvEscape(qtyToString(total))].join(","));
      }
      lines.push("");
      lines.push("edges:from,to");
      for (const e of value.edges || []){
        lines.push([csvEscape(e.from), csvEscape(e.to)].join(","));
      }
      return lines.join("\n");
    }
    if (value && typeof value === "object" && value.__assy){
      const lines = [];
      lines.push("key,value");
      for (const [k, info] of Object.entries(value.fields || {})){
        lines.push([csvEscape(k), csvEscape(qtyToString(info?.value))].join(","));
      }
      return lines.join("\n");
    }
    if (isQty(value)){
      return `value,kind\n${csvEscape(value.value)},${csvEscape(value.kind)}`;
    }
    return `value\n${csvEscape(value)}`;
  });

  baseFns.from_csv = defFn("from_csv", 1, {
    args: [{ label: "text", kinds: ["string"] }],
    returns: { kinds: ["assy"] },
  }, (text) => {
    if (typeof text !== "string") throw new Error("from_csv expects a string");
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length);
    if (!rows.length) throw new Error("from_csv empty");
    if (rows[0].startsWith("key,value")){
      const fields = Object.create(null);
      for (let i = 1; i < rows.length; i++){
        const line = rows[i];
        const idx = line.indexOf(",");
        if (idx < 0) continue;
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        const num = Number(val);
        fields[key] = { value: Number.isFinite(num) ? num : val, note: "", raw: "" };
      }
      return { __assy: true, name: "csv", fields };
    }
    throw new Error("from_csv currently supports only key,value tables");
  });

  baseFns.line = defFnCtx("line", -1, {
    args: [
      { label: "name", kinds: ["string"] },
      { label: "qty", kinds: ["any"] },
      { label: "unit_cost", kinds: ["any"] },
      { label: "meta", kinds: ["any"] },
    ],
    returns: { kinds: ["assy"] },
  }, (ctx, ...args) => {
    if (args.length < 3) throw new Error("line expects (name, qty, unit_cost[, meta])");
    const name = args[0];
    if (typeof name !== "string") throw new Error("line name must be a string");
    const qty = args[1];
    const unitCost = args[2];
    const metaRaw = args[3] ?? null;

    const meta = Object.create(null);
    if (metaRaw){
      const entries = (() => {
        if (isObjToken(metaRaw)) return parseObjectLiteral(metaRaw.raw);
        if (typeof metaRaw === "string" && metaRaw.trim().startsWith("{")) return parseObjectLiteral(metaRaw);
        return null;
      })();
      if (entries){
        for (const entry of entries){
          meta[entry.key] = ctx.evalString(entry.expr, meta);
        }
      }
    }

    const tradeRaw = meta.trade;
    const csiRaw = meta.csi;
    const trade = typeof tradeRaw === "string"
      ? tradeRaw
      : (tradeRaw && typeof tradeRaw === "object" && tradeRaw.__kind === "string" ? tradeRaw.value : "");
    const csi = typeof csiRaw === "string"
      ? csiRaw
      : (csiRaw && typeof csiRaw === "object" && csiRaw.__kind === "string" ? csiRaw.value : "");
    const wastePct = meta.waste;
    const markupPct = meta.markup;
    const laborRate = meta.labor_rate;
    const laborHours = meta.hours;

    const adjQty = wastePct !== undefined ? baseFns.waste.impl(qty, wastePct) : qty;
    const ext = (() => {
      if (isQty(adjQty) && isQty(unitCost)){
        const qDim = isDim(adjQty) ? adjQty.dim : dimVecFromKindString(adjQty.kind);
        const unitDim = isDim(unitCost) ? unitCost.dim : dimVecFromKindString(unitCost.kind);
        const isPureCurrency = (unitDim?.[3] || 0) === 1 && unitDim.every((e, i) => i === 3 ? e === 1 : e === 0);
        const isNonScalarQty = !dimVecIsZero(qDim);
        if (isPureCurrency && isNonScalarQty){
          const perUnitDim = qDim.map((e, i) => (i === 3 ? 1 : -e));
          const perUnitKind = kindFromDimVec(perUnitDim);
          const perUnit = makeQty(unitCost.value, perUnitKind, unitCost.unit || null);
          return mul(adjQty, perUnit);
        }
      }
      return mul(adjQty, unitCost);
    })();
    const labor = (laborRate !== undefined && laborHours !== undefined)
      ? mul(laborRate, laborHours)
      : (isQty(ext) ? makeQty(0, ext.kind) : 0);
    const subtotal = add(ext, labor);
    const total = markupPct !== undefined ? baseFns.markup.impl(subtotal, markupPct) : subtotal;

    return {
      __assy: true,
      name: "line",
      fields: {
        name: fieldInfo(name.trim()),
        trade: fieldInfo(trade),
        csi: fieldInfo(csi),
        qty: fieldInfo(adjQty),
        unit_cost: fieldInfo(unitCost),
        ext: fieldInfo(ext),
        labor: fieldInfo(labor),
        total: fieldInfo(total),
      },
      __line: true,
    };
  });

  baseFns.rollup = defFn("rollup", -1, {
    args: [{ label: "lines", kinds: ["assy"] }],
    returns: { kinds: ["assy"] },
  }, (...lines) => {
    if (!lines.length) throw new Error("rollup expects at least one line");
    let grand = null;
    const byTrade = Object.create(null);
    let n = 0;
    for (const item of lines){
      if (!item || typeof item !== "object" || !item.__assy) throw new Error("rollup expects line assemblies");
      const trade = item.fields?.trade?.value || "";
      const total = item.fields?.total?.value;
      if (total === undefined) continue;
      grand = grand === null ? total : add(grand, total);
      const key = trade ? `trade_${trade}` : "trade_unassigned";
      byTrade[key] = byTrade[key] === undefined ? total : add(byTrade[key], total);
      n += 1;
    }
    const fields = Object.create(null);
    fields.total = fieldInfo(grand === null ? 0 : grand);
    fields.n = fieldInfo(n);
    for (const [k, v] of Object.entries(byTrade)){
      fields[k] = fieldInfo(v);
    }
    return { __assy: true, name: "rollup", fields, __rollup: true };
  });

  baseFns.cmd = defFnCtx("cmd", -1, {
    args: [
      { label: "cmd", kinds: ["string"] },
      { label: "arg", kinds: ["string"] },
    ],
    returns: { kinds: ["any"] },
  }, (ctx, ...args) => {
    if (!ctx || typeof ctx.cmdRunner !== "function"){
      throw new Error("cmd() is not available in this context");
    }
    const cmdName = args[0];
    const cmdArg = args.length >= 2 ? args[1] : "";
    if (typeof cmdName !== "string") throw new Error("cmd expects command name as string");
    if (cmdArg !== undefined && cmdArg !== null && typeof cmdArg !== "string"){
      throw new Error("cmd expects arg as string");
    }
    return ctx.cmdRunner(cmdName.trim(), (cmdArg || "").trim());
  });

  baseFns.lin_coeff = defFnCtx("lin_coeff", 2, {
    args: [
      { label: "expr", kinds: ["string"] },
      { label: "var", kinds: ["string"] },
    ],
    returns: { kinds: ["assy"] },
  }, (ctx, expr, varName) => {
    if (!ctx || typeof ctx.evalString !== "function") throw new Error("lin_coeff requires evalString support");
    if (typeof expr !== "string") throw new Error("lin_coeff expects expression string");
    if (typeof varName !== "string") throw new Error("lin_coeff expects variable name string");
    const v = varName.trim();
    if (!v) throw new Error("lin_coeff expects non-empty variable name");
    const f0 = ctx.evalString(expr, { [v]: 0 });
    const f1 = ctx.evalString(expr, { [v]: 1 });
    const a = sub(f1, f0);
    const b = f0;
    return buildAssy("lin", {
      a: fieldInfo(a),
      b: fieldInfo(b),
      var: fieldInfo(v),
    });
  });

  baseFns.solve_linear = defFnCtx("solve_linear", 3, {
    args: [
      { label: "left", kinds: ["string"] },
      { label: "right", kinds: ["string"] },
      { label: "var", kinds: ["string"] },
    ],
    returns: { kinds: ["scalar", "dim"] },
  }, (ctx, leftExpr, rightExpr, varName) => {
    if (!ctx || typeof ctx.evalString !== "function") throw new Error("solve_linear requires evalString support");
    if (typeof leftExpr !== "string" || typeof rightExpr !== "string") throw new Error("solve_linear expects expression strings");
    if (typeof varName !== "string") throw new Error("solve_linear expects variable name string");
    const v = varName.trim();
    if (!v) throw new Error("solve_linear expects non-empty variable name");

    const diffExpr = `(${leftExpr}) - (${rightExpr})`;
    const f0 = ctx.evalString(diffExpr, { [v]: 0 });
    const f1 = ctx.evalString(diffExpr, { [v]: 1 });
    const a = sub(f1, f0);
    const b = f0;
    const av = normalizeCompare(a, 0)[0];
    if (Math.abs(av) < 1e-12) throw new Error("solve_linear: coefficient is 0 (not solvable as linear)");
    return div(sub(0, b), a);
  });

  baseFns.split_ratio = defFn("split_ratio", 2, {
    args: [
      { label: "total", kinds: ["scalar", "dim"] },
      { label: "ratio", kinds: ["scalar"] },
    ],
    returns: { kinds: ["assy"] },
  }, (total, ratio) => {
    const [ratioValue] = normalizeCompare(ratio, 0);
    if (!Number.isFinite(ratioValue) || ratioValue <= 0){
      throw new Error("split_ratio expects ratio > 0");
    }
    const parts = 1 + ratioValue;
    const totalValue = isQty(total) ? total.value : Number(total);
    if (!Number.isFinite(totalValue)){
      throw new Error("split_ratio expects numeric total");
    }
    const baseValue = totalValue / parts;
    const scaledValue = baseValue * ratioValue;
    const base = isQty(total) ? makeQty(baseValue, total.kind) : baseValue;
    const scaled = isQty(total) ? makeQty(scaledValue, total.kind) : scaledValue;
    return buildAssy("split_ratio", {
      total: fieldInfo(total),
      ratio: fieldInfo(ratioValue),
      parts: fieldInfo(parts),
      base: fieldInfo(base),
      scaled: fieldInfo(scaled),
    });
  });

  function normalizeStep(value, label){
    if (isQty(value)) return value;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${label} must be numeric`);
    return n;
  }

  function gridSearch(ctx, mode, name, lo, hi, step, expr){
    if (!ctx || typeof ctx.evalString !== "function") throw new Error(`${mode} requires evalString support`);
    if (typeof name !== "string") throw new Error(`${mode} expects var name as string`);
    if (typeof expr !== "string") throw new Error(`${mode} expects expression string`);
    const v = name.trim();
    if (!v) throw new Error(`${mode} expects non-empty variable name`);

    const loV = lo;
    const hiV = hi;
    const stepV = normalizeStep(step, mode);

    const asNum = (x) => isQty(x) ? x.value : Number(x);
    const loNum = asNum(loV);
    const hiNum = asNum(hiV);
    const stepNum = asNum(stepV);
    if (!Number.isFinite(loNum) || !Number.isFinite(hiNum) || !Number.isFinite(stepNum)) throw new Error(`${mode} bounds must be numeric`);
    if (stepNum === 0) throw new Error(`${mode} step cannot be 0`);
    const forward = stepNum > 0;
    if (forward && loNum > hiNum) throw new Error(`${mode} lo must be <= hi for positive step`);
    if (!forward && loNum < hiNum) throw new Error(`${mode} lo must be >= hi for negative step`);

    let bestX = null;
    let bestY = null;
    const maxIter = 200000;
    let it = 0;
    for (let t = loNum; forward ? t <= hiNum + 1e-12 : t >= hiNum - 1e-12; t += stepNum){
      it += 1;
      if (it > maxIter) throw new Error(`${mode} exceeded max iterations`);
      const x = isQty(loV) ? makeQty(t, loV.kind) : t;
      const y = ctx.evalString(expr, { [v]: x });
      const yNum = normalizeCompare(y, 0)[0];
      if (!Number.isFinite(yNum)) continue;
      if (bestY === null){
        bestX = x;
        bestY = y;
        continue;
      }
      const [cur, best] = normalizeCompare(y, bestY);
      const better = mode === "argmin" ? (cur < best) : (cur > best);
      if (better){
        bestX = x;
        bestY = y;
      }
    }
    return buildAssy(mode, {
      x: fieldInfo(bestX),
      y: fieldInfo(bestY),
      var: fieldInfo(v),
      lo: fieldInfo(loV),
      hi: fieldInfo(hiV),
      step: fieldInfo(stepV),
    });
  }

  baseFns.argmin = defFnCtx("argmin", 5, {
    args: [
      { label: "name", kinds: ["string"] },
      { label: "lo", kinds: ["scalar", "dim"] },
      { label: "hi", kinds: ["scalar", "dim"] },
      { label: "step", kinds: ["scalar", "dim"] },
      { label: "expr", kinds: ["string"] },
    ],
    returns: { kinds: ["assy"] },
  }, (ctx, name, lo, hi, step, expr) => {
    return gridSearch(ctx, "argmin", name, lo, hi, step, expr);
  });
  baseFns.argmax = defFnCtx("argmax", 5, {
    args: [
      { label: "name", kinds: ["string"] },
      { label: "lo", kinds: ["scalar", "dim"] },
      { label: "hi", kinds: ["scalar", "dim"] },
      { label: "step", kinds: ["scalar", "dim"] },
      { label: "expr", kinds: ["string"] },
    ],
    returns: { kinds: ["assy"] },
  }, (ctx, name, lo, hi, step, expr) => {
    return gridSearch(ctx, "argmax", name, lo, hi, step, expr);
  });

  baseFns.clamp = defFn("clamp", 3, {
    args: [
      { label: "x", kinds: ["any"] },
      { label: "min", kinds: ["any"] },
      { label: "max", kinds: ["any"] },
    ],
    returns: { kinds: ["any"] },
  }, (x, min, max) => {
    const [xv, minv] = normalizeCompare(x, min);
    const [, maxv] = normalizeCompare(x, max);
    const v = Math.min(Math.max(xv, minv), maxv);
    return isQty(x) ? makeQty(v, x.kind) : v;
  });
  baseFns.if = defFn("if", 3, {
    args: [
      { label: "cond", kinds: ["any"] },
      { label: "then", kinds: ["any"] },
      { label: "else", kinds: ["any"] },
    ],
    returns: { kinds: ["any"] },
  }, (cond, a, b) => (isTruthy(cond) ? a : b));

  baseFns.muxp = defFn("muxp", 3, {
    args: [
      { label: "cond", kinds: ["any"] },
      { label: "a", kinds: ["any"] },
      { label: "b", kinds: ["any"] },
    ],
    returns: { kinds: ["any"] },
  }, (cond, a, b) => {
    return isTruthy(cond) ? a : b;
  });

  function requireVecArg(value, label){
    if (!value || typeof value !== "object" || !value.__vec) throw new Error(`${label} expects a vector`);
    return value;
  }

  function toIndex(value, label){
    if (isQty(value)){
      if (value.kind !== "scalar") throw new Error(`${label} expects a dimensionless scalar value`);
      const n = Number(value.value);
      if (!Number.isFinite(n)) throw new Error(`${label} expects a finite scalar`);
      return Math.floor(n);
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${label} expects a finite scalar`);
    return Math.floor(n);
  }

  baseFns.mux = defFn("mux", 2, {
    args: [
      { label: "sel", kinds: ["any"] },
      { label: "choices", kinds: ["vec"] },
    ],
    returns: { kinds: ["any"] },
  }, (sel, choices) => {
    const v = requireVecArg(choices, "mux");
    const data = Array.isArray(v.data) ? v.data : [];
    if (!data.length) throw new Error("mux(): choices must be non-empty");
    if (data.length === 1) return data[0];
    const idx = toIndex(sel, "mux sel");
    const defaultVal = data[data.length - 1];
    if (idx < 0) return defaultVal;
    if (idx >= data.length - 1) return defaultVal;
    return data[idx];
  });

  baseFns.mux8 = defFn("mux8", 10, {
    args: [
      { label: "sel", kinds: ["any"] },
      { label: "a0", kinds: ["any"] },
      { label: "a1", kinds: ["any"] },
      { label: "a2", kinds: ["any"] },
      { label: "a3", kinds: ["any"] },
      { label: "a4", kinds: ["any"] },
      { label: "a5", kinds: ["any"] },
      { label: "a6", kinds: ["any"] },
      { label: "a7", kinds: ["any"] },
      { label: "default", kinds: ["any"] },
    ],
    returns: { kinds: ["any"] },
  }, (sel, a0, a1, a2, a3, a4, a5, a6, a7, d) => {
    const idx = toIndex(sel, "mux8 sel");
    if (idx === 0) return a0;
    if (idx === 1) return a1;
    if (idx === 2) return a2;
    if (idx === 3) return a3;
    if (idx === 4) return a4;
    if (idx === 5) return a5;
    if (idx === 6) return a6;
    if (idx === 7) return a7;
    return d;
  });

  baseFns.mux16 = defFn("mux16", 18, {
    args: [
      { label: "sel", kinds: ["any"] },
      { label: "a0", kinds: ["any"] },
      { label: "a1", kinds: ["any"] },
      { label: "a2", kinds: ["any"] },
      { label: "a3", kinds: ["any"] },
      { label: "a4", kinds: ["any"] },
      { label: "a5", kinds: ["any"] },
      { label: "a6", kinds: ["any"] },
      { label: "a7", kinds: ["any"] },
      { label: "a8", kinds: ["any"] },
      { label: "a9", kinds: ["any"] },
      { label: "a10", kinds: ["any"] },
      { label: "a11", kinds: ["any"] },
      { label: "a12", kinds: ["any"] },
      { label: "a13", kinds: ["any"] },
      { label: "a14", kinds: ["any"] },
      { label: "a15", kinds: ["any"] },
      { label: "default", kinds: ["any"] },
    ],
    returns: { kinds: ["any"] },
  }, (sel, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, d) => {
    const idx = toIndex(sel, "mux16 sel");
    if (idx === 0) return a0;
    if (idx === 1) return a1;
    if (idx === 2) return a2;
    if (idx === 3) return a3;
    if (idx === 4) return a4;
    if (idx === 5) return a5;
    if (idx === 6) return a6;
    if (idx === 7) return a7;
    if (idx === 8) return a8;
    if (idx === 9) return a9;
    if (idx === 10) return a10;
    if (idx === 11) return a11;
    if (idx === 12) return a12;
    if (idx === 13) return a13;
    if (idx === 14) return a14;
    if (idx === 15) return a15;
    return d;
  });

  function requireRadix(value, label){
    const raw = requireScalarArg(value, label);
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n === 0) throw new Error(`${label} must be a non-zero integer`);
    return Math.abs(n);
  }

  function modPosNumber(x, m){
    const mm = Math.abs(m);
    let r = x % mm;
    if (r < 0) r += mm;
    return r;
  }

  baseFns.lane_mod = defFn("lane_mod", 2, {
    args: [
      { label: "hop", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "lanes", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (hop, lanes) => {
    const hv = Math.floor(requireScalarArg(hop, "lane_mod hop"));
    const lv = requireRadix(lanes, "lane_mod lanes");
    return modPosNumber(hv, lv);
  });

  baseFns.packN = defFn("packN", 2, {
    args: [
      { label: "digits", kinds: ["vec"] },
      { label: "radices", kinds: ["vec"] },
    ],
    returns: { kinds: ["scalar"] },
  }, (digits, radices) => {
    const dv = requireVecArg(digits, "packN digits");
    const rv = requireVecArg(radices, "packN radices");
    const ds = Array.isArray(dv.data) ? dv.data : [];
    const rs = Array.isArray(rv.data) ? rv.data : [];
    if (!ds.length) throw new Error("packN(): digits vector must be non-empty");
    if (ds.length !== rs.length) throw new Error("packN(): digits and radices must have the same length");
    let acc = 0;
    let mulAcc = 1;
    for (let i = 0; i < ds.length; i++){
      const radix = requireRadix(rs[i], `packN radix${i}`);
      const rawDigit = Math.floor(Number(requireScalarArg(ds[i], `packN digit${i}`)));
      if (!Number.isFinite(rawDigit)) throw new Error(`packN digit${i} must be numeric`);
      const digit = modPosNumber(rawDigit, radix);
      acc += digit * mulAcc;
      mulAcc *= radix;
    }
    return acc;
  });

  baseFns.unpackN = defFn("unpackN", 2, {
    args: [
      { label: "code", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "radices", kinds: ["vec"] },
    ],
    returns: { kinds: ["vec"] },
  }, (code, radices) => {
    const rv = requireVecArg(radices, "unpackN radices");
    const rs = Array.isArray(rv.data) ? rv.data : [];
    if (!rs.length) throw new Error("unpackN(): radices vector must be non-empty");
    let x = Math.floor(Number(requireScalarArg(code, "unpackN code")));
    if (!Number.isFinite(x)) throw new Error("unpackN(): code must be numeric");
    const out = new Array(rs.length);
    for (let i = 0; i < rs.length; i++){
      const radix = requireRadix(rs[i], `unpackN radix${i}`);
      out[i] = modPosNumber(x, radix);
      x = Math.floor(x / radix);
    }
    return OPS_INTERNAL.makeVec("vec", out);
  });

  function scoreNumber(value, label){
    const raw = requireScalarArg(value, label);
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error(`${label} must be numeric`);
    return n;
  }

  baseFns.argmax4 = defFn("argmax4", 4, {
    args: [
      { label: "s0", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "s1", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "s2", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "s3", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (s0, s1, s2, s3) => {
    const scores = [
      scoreNumber(s0, "argmax4 s0"),
      scoreNumber(s1, "argmax4 s1"),
      scoreNumber(s2, "argmax4 s2"),
      scoreNumber(s3, "argmax4 s3"),
    ];
    let bestIdx = 0;
    let best = scores[0];
    for (let i = 1; i < 4; i++){
      if (scores[i] > best){
        best = scores[i];
        bestIdx = i;
      }
    }
    return bestIdx;
  });

  baseFns.argmin4 = defFn("argmin4", 4, {
    args: [
      { label: "s0", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "s1", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "s2", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "s3", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (s0, s1, s2, s3) => {
    const scores = [
      scoreNumber(s0, "argmin4 s0"),
      scoreNumber(s1, "argmin4 s1"),
      scoreNumber(s2, "argmin4 s2"),
      scoreNumber(s3, "argmin4 s3"),
    ];
    let bestIdx = 0;
    let best = scores[0];
    for (let i = 1; i < 4; i++){
      if (scores[i] < best){
        best = scores[i];
        bestIdx = i;
      }
    }
    return bestIdx;
  });

  baseFns.select_best4 = defFn("select_best4", -1, {
    args: [],
    returns: { kinds: ["assy"] },
  }, (...args) => {
    let states;
    let scores;

    if (args.length === 8){
      states = [args[0], args[2], args[4], args[6]];
      scores = [
        scoreNumber(args[1], "select_best4 score0"),
        scoreNumber(args[3], "select_best4 score1"),
        scoreNumber(args[5], "select_best4 score2"),
        scoreNumber(args[7], "select_best4 score3"),
      ];
    }else if (args.length === 4){
      states = new Array(4);
      scores = new Array(4);
      for (let i = 0; i < 4; i++){
        const cand = requireAssemblyArg(args[i], "select_best4");
        const sField = cand.fields?.state;
        const scoreField = cand.fields?.score;
        if (!scoreField) throw new Error("select_best4 candidate missing field: score");
        states[i] = sField ? sField.value : cand;
        scores[i] = scoreNumber(scoreField.value, `select_best4 score${i}`);
      }
    }else{
      throw new Error("select_best4 expects either 8 args (state0,score0,...,state3,score3) or 4 candidates (assy with fields state,score)");
    }

    let bestLane = 0;
    let bestScore = scores[0];
    for (let i = 1; i < 4; i++){
      if (scores[i] > bestScore){
        bestScore = scores[i];
        bestLane = i;
      }
    }

    return buildAssy("best4", {
      lane: fieldInfo(bestLane),
      state: fieldInfo(states[bestLane]),
      score: fieldInfo(bestScore),
    });
  });

  baseFns.rec = defFn("rec", 7, {
    args: [
      { label: "a", kinds: ["any"] },
      { label: "b", kinds: ["any"] },
      { label: "c", kinds: ["any"] },
      { label: "d", kinds: ["any"] },
      { label: "cursor", kinds: ["any"] },
      { label: "flags", kinds: ["any"] },
      { label: "score", kinds: ["any"] },
    ],
    returns: { kinds: ["assy"] },
  }, (a, b, c, d, cursor, flags, score) => {
    return buildAssy("rec", {
      a: fieldInfo(a),
      b: fieldInfo(b),
      c: fieldInfo(c),
      d: fieldInfo(d),
      cursor: fieldInfo(cursor),
      flags: fieldInfo(flags),
      score: fieldInfo(score),
    });
  });

  baseFns.record = defFn("record", -1, {
    args: [],
    returns: { kinds: ["assy"] },
  }, (...args) => {
    if (args.length % 2 !== 0) throw new Error("record(): expects alternating (name, value) pairs");
    const fields = Object.create(null);
    for (let i = 0; i < args.length; i += 2){
      const name = args[i];
      const value = args[i + 1];
      if (typeof name !== "string") throw new Error("record(): field name must be a string");
      const key = name.trim();
      if (!key) throw new Error("record(): field name must be non-empty");
      fields[key] = fieldInfo(value);
    }
    return buildAssy("record", fields);
  });

  baseFns.case = defFn("case", -1, {
    args: [],
    returns: { kinds: ["any"] },
  }, (sel, ...rest) => {
    if (rest.length < 1) throw new Error("case(): expects at least (sel, default)");
    if (rest.length === 1) return rest[0];
    if ((rest.length - 1) % 2 !== 0){
      throw new Error("case(): expects (sel, k0, v0, k1, v1, ..., default)");
    }
    const defaultVal = rest[rest.length - 1];
    for (let i = 0; i < rest.length - 1; i += 2){
      const key = rest[i];
      const val = rest[i + 1];
      const [a, b] = normalizeCompare(sel, key);
      if (a === b) return val;
    }
    return defaultVal;
  });

  baseFns.field = defFn("field", 2, {
    args: [
      { label: "assy", kinds: ["assy", "vec", "mat", "range"] },
      { label: "name", kinds: ["string"] },
    ],
    returns: { kinds: ["any"] },
  }, (assy, name) => {
    const a = requireAssemblyArg(assy, "field");
    if (typeof name !== "string") throw new Error("field expects the field name as a string");
    const key = name.trim();
    if (!key) throw new Error("field expects a non-empty field name");
    const entry = (a.fields || {})[key];
    if (!entry) throw new Error(`Unknown assembly field: ${key}`);
    return entry.value;
  });

  attachConstructionBuiltins(baseFns, {
    defFn,
    defFnCtx,
    convert,
    isQty,
    isTruthy,
    makeQty,
    qtyToString,
    add,
    div,
    mul,
  });

  attachMapBuiltins(baseFns, { defFn, isQty });

  attachCsiBuiltins(baseFns, {
    defFn,
    add,
  });

  attachFinishBuiltins(baseFns, {
    defFn,
    defFnCtx,
  });

  attachLinAlgBuiltins(baseFns, {
    defFn,
    defFnCtx,
    isQty,
    makeQty,
    add,
    sub,
    mul,
    div,
    pow,
    OPS_INTERNAL,
  });

  attachUncertaintyBuiltins(baseFns, {
    defFn,
    defFnCtx,
    isQty,
    makeQty,
    add,
    sub,
    mul,
    div,
    normalizeCompare,
    OPS_INTERNAL,
    buildAssy,
    fieldInfo,
  });

  attachGraphBuiltins(baseFns, {
    defFn,
    defFnCtx,
    add,
  });

  attachMaterialBuiltins(baseFns, {
    defFn,
    defFnCtx,
    mul,
    div,
    isObjToken,
    parseObjectLiteral,
  });

  attachGeometryBuiltins(baseFns, {
    defFn,
    add,
    sub,
    mul,
    div,
    isQty,
  });

  attachRateBuiltins(baseFns, {
    defFn,
    defFnCtx,
    isQty,
    makeQty,
    add,
    sub,
    div,
    mul,
    isObjToken,
    parseObjectLiteral,
    buildAssy,
    fieldInfo,
  });

  attachScenarioBuiltins(baseFns, {
    defFn,
    defFnCtx,
    isQty,
    makeQty,
    add,
    sub,
    div,
    isObjToken,
    parseObjectLiteral,
    buildAssy,
    fieldInfo,
  });

  attachProjectBuiltins(baseFns, {
    defFn,
    defFnCtx,
    isQty,
    makeQty,
    add,
    isObjToken,
    parseObjectLiteral,
    buildAssy,
    fieldInfo,
  });

  attachUnitAlgebraBuiltins(baseFns, {
    defFn,
    isQty,
    makeQty,
    qtyToString,
    normalizeCompare,
    UNITS_INTERNAL,
  });

  attachCostAlgebraBuiltins(baseFns, {
    defFn,
    isQty,
    makeQty,
    UNITS_INTERNAL,
  });

  return baseFns;
}
