export const UNIT = {
  in: { kind: "len", toBase: 1 / 12 },
  ft: { kind: "len", toBase: 1 },
  yd: { kind: "len", toBase: 3 },

  sf: { kind: "area", toBase: 1 },
  sy: { kind: "area", toBase: 9 },

  cf: { kind: "vol", toBase: 1 },
  cy: { kind: "vol", toBase: 27 },

  lb: { kind: "wt", toBase: 1 },
  ton: { kind: "wt", toBase: 2000 },
};

export function isUnitToken(token){
  return Object.prototype.hasOwnProperty.call(UNIT, token);
}

export function makeQty(value, kind = "scalar"){
  return { value, kind };
}

export function isQty(value){
  return value && typeof value === "object" && typeof value.value === "number" && typeof value.kind === "string";
}

const DIMENSIONS = {
  scalar: {},
  len: { len: 1 },
  area: { len: 2 },
  vol: { len: 3 },
  wt: { wt: 1 },
};

function cloneDim(dim){
  return Object.assign({}, dim);
}

function dimFromKind(kind){
  if (!kind || kind === "scalar") return {};
  if (Object.prototype.hasOwnProperty.call(DIMENSIONS, kind)) return cloneDim(DIMENSIONS[kind]);
  if (typeof kind !== "string") return {};
  const dim = {};
  for (const part of kind.split("*")){
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [base, expRaw] = trimmed.split("^");
    if (!base) continue;
    const exp = expRaw ? Number(expRaw) : 1;
    if (!Number.isFinite(exp)) continue;
    dim[base] = (dim[base] || 0) + exp;
    if (dim[base] === 0) delete dim[base];
  }
  return dim;
}

function dimKey(dim){
  const entries = Object.entries(dim).filter(([, val]) => val !== 0);
  if (!entries.length) return "scalar";
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, exp]) => (exp === 1 ? key : `${key}^${exp}`)).join("*");
}

function kindFromDim(dim){
  const len = dim.len || 0;
  const wt = dim.wt || 0;
  if (len === 0 && wt === 0) return "scalar";
  if (len === 1 && wt === 0) return "len";
  if (len === 2 && wt === 0) return "area";
  if (len === 3 && wt === 0) return "vol";
  if (len === 0 && wt === 1) return "wt";
  return dimKey(dim);
}

function combineDims(a, b, sign = 1){
  const dim = cloneDim(a);
  for (const [key, val] of Object.entries(b)){
    dim[key] = (dim[key] || 0) + val * sign;
    if (dim[key] === 0) delete dim[key];
  }
  return dim;
}

function scaleDim(dim, power){
  const out = {};
  for (const [key, val] of Object.entries(dim)){
    const next = val * power;
    if (next !== 0) out[key] = next;
  }
  return out;
}

export function sameDimension(a, b){
  return dimKey(dimFromKind(a.kind)) === dimKey(dimFromKind(b.kind));
}

export function qtyToString(qty){
  if (!qty || typeof qty !== "object" || !("value" in qty)) return String(qty);
  const value = qty.value;
  const kind = qty.kind || "scalar";
  const fmt = (num) => {
    if (!Number.isFinite(num)) return String(num);
    const abs = Math.abs(num);
    if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) return num.toExponential(6);
    return (Math.round(num * 1e6) / 1e6).toString();
  };
  if (kind === "scalar") return fmt(value);
  if (kind === "len") return `${fmt(value)} ft`;
  if (kind === "area") return `${fmt(value)} sf`;
  if (kind === "vol") return `${fmt(value)} cf`;
  if (kind === "wt") return `${fmt(value)} lb`;
  return `${fmt(value)} ${kind}`;
}

export function isScalarKind(kind){
  return dimKey(dimFromKind(kind)) === "scalar";
}

export function convert(qty, toUnit){
  if (!qty || typeof qty !== "object") throw new Error("convert() expects a quantity");
  if (!isUnitToken(toUnit)) throw new Error(`Unknown unit: ${toUnit}`);
  const unit = UNIT[toUnit];
  const qtyDim = dimFromKind(qty.kind);
  const unitDim = dimFromKind(unit.kind);
  if (dimKey(qtyDim) !== dimKey(unitDim)) throw new Error(`Unit mismatch: cannot convert ${qty.kind} -> ${unit.kind}`);
  const base = qty.value;
  return base / unit.toBase;
}

export function add(a, b){
  if (isQty(a) && isQty(b)){
    if (!sameDimension(a, b)) throw new Error(`Unit mismatch: ${a.kind} + ${b.kind}`);
    const kind = kindFromDim(dimFromKind(a.kind));
    return makeQty(a.value + b.value, kind);
  }
  if (isQty(a) && !isQty(b)){
    if (!isScalarKind(a.kind)) throw new Error("Cannot add scalar to a unit quantity without a unit.");
    return makeQty(a.value + b, "scalar");
  }
  if (!isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Cannot add scalar to a unit quantity without a unit.");
    return makeQty(a + b.value, "scalar");
  }
  return a + b;
}

export function sub(a, b){
  if (isQty(a) && isQty(b)){
    if (!sameDimension(a, b)) throw new Error(`Unit mismatch: ${a.kind} - ${b.kind}`);
    const kind = kindFromDim(dimFromKind(a.kind));
    return makeQty(a.value - b.value, kind);
  }
  if (isQty(a) && !isQty(b)){
    if (!isScalarKind(a.kind)) throw new Error("Cannot subtract scalar from a unit quantity without a unit.");
    return makeQty(a.value - b, "scalar");
  }
  if (!isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Cannot subtract unit quantity from scalar.");
    return makeQty(a - b.value, "scalar");
  }
  return a - b;
}

export function mul(a, b){
  if (isQty(a) && isQty(b)){
    const dim = combineDims(dimFromKind(a.kind), dimFromKind(b.kind), 1);
    return makeQty(a.value * b.value, kindFromDim(dim));
  }
  if (isQty(a) && !isQty(b)){
    const dim = dimFromKind(a.kind);
    return makeQty(a.value * b, kindFromDim(dim));
  }
  if (!isQty(a) && isQty(b)){
    const dim = dimFromKind(b.kind);
    return makeQty(a * b.value, kindFromDim(dim));
  }
  return a * b;
}

export function div(a, b){
  if (isQty(a) && isQty(b)){
    const dim = combineDims(dimFromKind(a.kind), dimFromKind(b.kind), -1);
    return makeQty(a.value / b.value, kindFromDim(dim));
  }
  if (isQty(a) && !isQty(b)){
    const dim = dimFromKind(a.kind);
    return makeQty(a.value / b, kindFromDim(dim));
  }
  if (!isQty(a) && isQty(b)){
    const dim = combineDims({}, dimFromKind(b.kind), -1);
    return makeQty(a / b.value, kindFromDim(dim));
  }
  return a / b;
}

export function pow(a, b){
  if (isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Exponent must be scalar.");
    const exp = b.value;
    if (!Number.isInteger(exp) && !isScalarKind(a.kind)){
      throw new Error("Exponent must be integer for dimensioned quantities.");
    }
    const dim = scaleDim(dimFromKind(a.kind), exp);
    return makeQty(Math.pow(a.value, exp), kindFromDim(dim));
  }
  if (isQty(a) && !isQty(b)){
    if (!Number.isInteger(b) && !isScalarKind(a.kind)){
      throw new Error("Exponent must be integer for dimensioned quantities.");
    }
    const dim = scaleDim(dimFromKind(a.kind), b);
    return makeQty(Math.pow(a.value, b), kindFromDim(dim));
  }
  if (!isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Exponent must be scalar.");
    return Math.pow(a, b.value);
  }
  return Math.pow(a, b);
}

export function formatResult(value){
  if (!isQty(value)) return { main: qtyToString(value), extra: "" };

  if (value.kind === "len"){
    const feet = value.value;
    const inches = feet * 12;
    return { main: qtyToString(value), extra: `${(Math.round(inches * 1e4) / 1e4)} in` };
  }
  if (value.kind === "area"){
    const sf = value.value;
    const sy = sf / 9;
    return { main: qtyToString(value), extra: `${(Math.round(sy * 1e6) / 1e6)} sy` };
  }
  if (value.kind === "vol"){
    const cf = value.value;
    const cy = cf / 27;
    return { main: qtyToString(value), extra: `${(Math.round(cy * 1e6) / 1e6)} cy` };
  }
  if (value.kind === "wt"){
    const lb = value.value;
    const ton = lb / 2000;
    return { main: qtyToString(value), extra: `${(Math.round(ton * 1e6) / 1e6)} ton` };
  }
  return { main: qtyToString(value), extra: "" };
}
