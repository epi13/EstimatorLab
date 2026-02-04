export const KIND = {
  scalar: "scalar",
  bool: "bool",
  string: "string",
  dim: "dim",
  null: "null",
};

export const DIM_BASIS = ["L", "T", "M", "$", "N", "A", "F", "Y"];
export const DIM_INDEX = {
  L: 0,
  T: 1,
  M: 2,
  $: 3,
  N: 4,
  A: 5,
  F: 6,
  Y: 7,
};

const KIND_BASE_TO_DIM = {
  len: "L",
  time: "T",
  wt: "M",
  cur: "$",
  count: "N",
  angle: "A",
  force: "F",
  layer: "Y",
  area: "L^2",
  vol: "L^3",
};

const DIM_TO_KIND_BASE = {
  L: "len",
  T: "time",
  M: "wt",
  $: "cur",
  N: "count",
  A: "angle",
  F: "force",
  Y: "layer",
};

export function scalar(value){
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Invalid scalar");
  return { __kind: KIND.scalar, value: n };
}

export function bool(value){
  return { __kind: KIND.bool, value: Boolean(value) };
}

export function string(value){
  return { __kind: KIND.string, value: String(value) };
}

export function nullValue(){
  return { __kind: KIND.null, value: null };
}

export function dim(valueBase, dimVec, unit = null){
  const n = Number(valueBase);
  if (!Number.isFinite(n)) throw new Error("Invalid quantity");
  const normalized = normalizeDimVec(dimVec);
  return { __kind: KIND.dim, value: n, dim: normalized, unit: unit ? String(unit) : null, kind: kindFromDimVec(normalized) };
}

export function isValue(v){
  return v && typeof v === "object" && typeof v.__kind === "string" && Object.values(KIND).includes(v.__kind);
}

export function isScalar(v){
  return v && typeof v === "object" && v.__kind === KIND.scalar;
}

export function isBool(v){
  return v && typeof v === "object" && v.__kind === KIND.bool;
}

export function isString(v){
  return v && typeof v === "object" && v.__kind === KIND.string;
}

export function isNull(v){
  return v && typeof v === "object" && v.__kind === KIND.null;
}

export function isDim(v){
  return v && typeof v === "object" && v.__kind === KIND.dim && Array.isArray(v.dim) && typeof v.value === "number";
}

export function box(value){
  if (isValue(value)) return value;
  if (typeof value === "number") return scalar(value);
  if (typeof value === "boolean") return bool(value);
  if (typeof value === "string") return string(value);
  if (value === null) return nullValue();
  if (value === undefined) return nullValue();
  return value;
}

export function unbox(value){
  if (isScalar(value)) return value.value;
  if (isBool(value)) return value.value ? 1 : 0;
  if (isString(value)) return value.value;
  if (isNull(value)) return null;
  return value;
}

export function valueKind(v){
  if (isValue(v)) return v.__kind;
  if (v && typeof v === "object"){
    if (v.__graph) return "graph";
    if (v.__scenario) return "scenario";
    if (v.__dist) return "dist";
    if (v.__rate) return "rate";
    if (v.__vec) return "vec";
    if (v.__mat) return "mat";
    if (v.__range) return "range";
    if (v.__assy) return "assy";
    if (v.__gfx) return "gfx";
    if (v.__map) return "map";
    if (v.__project) return "project";
    if (v.__material) return "material";
    if (v.__pt) return "pt";
    if (v.__poly) return "poly";
  }
  return typeof v;
}

export function normalizeDimVec(input){
  if (!input) return new Array(DIM_BASIS.length).fill(0);
  if (Array.isArray(input)){
    if (input.length !== DIM_BASIS.length) throw new Error("Invalid dimension vector");
    return input.map((x) => {
      const n = Number(x);
      if (!Number.isInteger(n)) throw new Error("Invalid dimension exponent");
      return n;
    });
  }
  throw new Error("Invalid dimension vector");
}

export function dimVecZero(){
  return new Array(DIM_BASIS.length).fill(0);
}

export function dimVecEqual(a, b){
  const aa = normalizeDimVec(a);
  const bb = normalizeDimVec(b);
  for (let i = 0; i < DIM_BASIS.length; i++){
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

export function dimVecAdd(a, b, sign = 1){
  const aa = normalizeDimVec(a);
  const bb = normalizeDimVec(b);
  const out = new Array(DIM_BASIS.length);
  for (let i = 0; i < DIM_BASIS.length; i++){
    out[i] = aa[i] + bb[i] * sign;
  }
  return out;
}

export function dimVecScale(a, power){
  const aa = normalizeDimVec(a);
  if (!Number.isInteger(power)){
    if (power === 0.5 || power === -0.5){
      const out = new Array(DIM_BASIS.length);
      for (let i = 0; i < DIM_BASIS.length; i++){
        const exp = aa[i];
        if (exp % 2 !== 0) throw new Error("Dimension exponent must be integer");
        out[i] = exp / 2 * (power < 0 ? -1 : 1);
      }
      return out;
    }
    throw new Error("Dimension exponent must be integer");
  }
  const out = new Array(DIM_BASIS.length);
  for (let i = 0; i < DIM_BASIS.length; i++){
    out[i] = aa[i] * power;
  }
  return out;
}

export function dimVecIsZero(a){
  const aa = normalizeDimVec(a);
  for (let i = 0; i < DIM_BASIS.length; i++){
    if (aa[i] !== 0) return false;
  }
  return true;
}

export function dimVecKey(vec){
  const v = normalizeDimVec(vec);
  const parts = [];
  for (let i = 0; i < DIM_BASIS.length; i++){
    const exp = v[i];
    if (!exp) continue;
    const base = DIM_BASIS[i];
    parts.push(exp === 1 ? base : `${base}^${exp}`);
  }
  return parts.length ? parts.join("*") : "scalar";
}

export function kindFromDimVec(vec){
  const v = normalizeDimVec(vec);
  const L = v[DIM_INDEX.L] || 0;
  const T = v[DIM_INDEX.T] || 0;
  const M = v[DIM_INDEX.M] || 0;
  const C = v[DIM_INDEX.$] || 0;
  const N = v[DIM_INDEX.N] || 0;
  const A = v[DIM_INDEX.A] || 0;
  const F = v[DIM_INDEX.F] || 0;
  const Y = v[DIM_INDEX.Y] || 0;

  if (L === 0 && T === 0 && M === 0 && C === 0 && N === 0 && A === 0 && F === 0 && Y === 0) return "scalar";
  if (L === 1 && T === 0 && M === 0 && C === 0 && N === 0 && A === 0 && F === 0 && Y === 0) return "len";
  if (L === 2 && T === 0 && M === 0 && C === 0 && N === 0 && A === 0 && F === 0 && Y === 0) return "area";
  if (L === 3 && T === 0 && M === 0 && C === 0 && N === 0 && A === 0 && F === 0 && Y === 0) return "vol";
  if (L === 0 && T === 1 && M === 0 && C === 0 && N === 0 && A === 0 && F === 0 && Y === 0) return "time";
  if (L === 0 && T === 0 && M === 1 && C === 0 && N === 0 && A === 0 && F === 0 && Y === 0) return "wt";
  if (L === 0 && T === 0 && M === 0 && C === 1 && N === 0 && A === 0 && F === 0 && Y === 0) return "cur";
  if (L === 0 && T === 0 && M === 0 && C === 0 && N === 1 && A === 0 && F === 0 && Y === 0) return "count";
  if (L === 0 && T === 0 && M === 0 && C === 0 && N === 0 && A === 1 && F === 0 && Y === 0) return "angle";
  if (L === 0 && T === 0 && M === 0 && C === 0 && N === 0 && A === 0 && F === 1 && Y === 0) return "force";
  if (L === 0 && T === 0 && M === 0 && C === 0 && N === 0 && A === 0 && F === 0 && Y === 1) return "layer";

  const order = ["cur", "force", "len", "time", "wt", "count", "angle", "layer"];
  const orderIndex = (base) => {
    const idx = order.indexOf(base);
    return idx >= 0 ? idx : 999;
  };

  const parts = [];
  for (let i = 0; i < DIM_BASIS.length; i++){
    const exp = v[i];
    if (!exp) continue;
    const dimBase = DIM_BASIS[i];
    const kindBase = DIM_TO_KIND_BASE[dimBase] || dimBase;
    parts.push({ base: kindBase, exp });
  }
  parts.sort((a, b) => {
    const da = orderIndex(a.base);
    const db = orderIndex(b.base);
    if (da !== db) return da - db;
    return a.base.localeCompare(b.base);
  });

  return parts.map(({ base, exp }) => {
    if (exp === 1) return base;
    return `${base}^${exp}`;
  }).join("*");
}

export function dimVecFromKindString(kind){
  const k = String(kind || "").trim();
  if (!k || k === "scalar") return dimVecZero();

  const out = dimVecZero();
  const parts = k.split("*");
  for (const part of parts){
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [baseRaw, expRaw] = trimmed.split("^");
    const baseKey = baseRaw.trim();
    if (!baseKey) continue;

    const exp = expRaw ? Number(expRaw) : 1;
    if (!Number.isInteger(exp)) throw new Error("Invalid dimension exponent");

    const mapped = KIND_BASE_TO_DIM[baseKey] || baseKey;
    if (mapped === "L^2"){
      out[DIM_INDEX.L] += exp * 2;
      continue;
    }
    if (mapped === "L^3"){
      out[DIM_INDEX.L] += exp * 3;
      continue;
    }
    const idx = DIM_INDEX[mapped];
    if (idx === undefined) throw new Error(`Unknown dimension basis: ${baseKey}`);
    out[idx] += exp;
  }
  return out;
}

export function toScalarNumber(value, label, { allowBool = true, allowDimlessDim = true } = {}){
  if (isScalar(value)) return value.value;
  if (allowBool && isBool(value)) return value.value ? 1 : 0;
  if (allowDimlessDim && isDim(value) && dimVecIsZero(value.dim)) return value.value;
  throw new Error(`${label} expects a scalar`);
}

export function toBool(value){
  if (isBool(value)) return value.value;
  if (isScalar(value)) return value.value !== 0;
  if (isDim(value)) return value.value !== 0;
  if (isString(value)) return value.value.length !== 0;
  if (isNull(value)) return false;
  return Boolean(value);
}
