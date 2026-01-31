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

export function convert(qty, toUnit){
  if (!qty || typeof qty !== "object") throw new Error("convert() expects a quantity");
  if (!isUnitToken(toUnit)) throw new Error(`Unknown unit: ${toUnit}`);
  const unit = UNIT[toUnit];
  const kindMap = { len: "len", area: "area", vol: "vol", wt: "wt" };
  const qtyKind = kindMap[qty.kind] || qty.kind;
  if (qtyKind !== unit.kind) throw new Error(`Unit mismatch: cannot convert ${qty.kind} -> ${unit.kind}`);
  const base = qty.value;
  return base / unit.toBase;
}

export function add(a, b){
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

export function sub(a, b){
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

export function mul(a, b){
  if (isQty(a) && isQty(b)){
    const kindKey = `${a.kind}*${b.kind}`;
    if (kindKey === "len*len") return makeQty(a.value * b.value, "area");
    if (kindKey === "area*len" || kindKey === "len*area") return makeQty(a.value * b.value, "vol");
    if (a.kind === b.kind) return makeQty(a.value * b.value, a.kind);
    if (a.kind === "scalar") return makeQty(a.value * b.value, b.kind);
    if (b.kind === "scalar") return makeQty(a.value * b.value, a.kind);
    return makeQty(a.value * b.value, "scalar");
  }
  if (isQty(a) && !isQty(b)) return makeQty(a.value * b, a.kind);
  if (!isQty(a) && isQty(b)) return makeQty(a * b.value, b.kind);
  return a * b;
}

export function div(a, b){
  if (isQty(a) && isQty(b)){
    if (a.kind === b.kind) return makeQty(a.value / b.value, "scalar");
    if (b.kind === "scalar") return makeQty(a.value / b.value, a.kind);
    return makeQty(a.value / b.value, "scalar");
  }
  if (isQty(a) && !isQty(b)) return makeQty(a.value / b, a.kind);
  if (!isQty(a) && isQty(b)) return makeQty(a / b.value, "scalar");
  return a / b;
}

export function pow(a, b){
  if (isQty(a) && isQty(b)){
    if (b.kind !== "scalar") throw new Error("Exponent must be scalar.");
    return makeQty(Math.pow(a.value, b.value), a.kind);
  }
  if (isQty(a) && !isQty(b)) return makeQty(Math.pow(a.value, b), a.kind);
  if (!isQty(a) && isQty(b)){
    if (b.kind !== "scalar") throw new Error("Exponent must be scalar.");
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
