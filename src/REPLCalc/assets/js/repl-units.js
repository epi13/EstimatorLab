export const UNIT = Object.create(null);

function defineUnit(name, kind, toBase, aliases = []){
  UNIT[name] = { kind, toBase };
  for (const alias of aliases){
    UNIT[alias] = { kind, toBase };
  }
}

const FT_PER_IN = 1 / 12;
const FT_PER_YD = 3;
const FT_PER_MI = 5280;

const FT_PER_M = 3.280839895013123;
const FT_PER_CM = FT_PER_M / 100;
const FT_PER_MM = FT_PER_M / 1000;
const FT_PER_KM = FT_PER_M * 1000;

const FT_PER_PX = (FT_PER_IN) / 96;
const FT_PER_PT = (FT_PER_IN) / 72;

const LB_PER_KG = 2.2046226218487757;
const LB_PER_G = LB_PER_KG / 1000;

const LBF_PER_N = 0.22480894387096263;
const J_PER_FTLBF = 1.3558179483314004;

defineUnit("in", "len", FT_PER_IN, ["inch", "inches"]);
defineUnit("mil", "len", FT_PER_IN / 1000, ["thou"]);
defineUnit("ft", "len", 1, ["lf", "foot", "feet"]);
defineUnit("yd", "len", FT_PER_YD, ["yard", "yards"]);
defineUnit("mi", "len", FT_PER_MI, ["mile", "miles"]);

defineUnit("mm", "len", FT_PER_MM);
defineUnit("cm", "len", FT_PER_CM);
defineUnit("m", "len", FT_PER_M, ["meter", "meters"]);
defineUnit("km", "len", FT_PER_KM);

defineUnit("um", "len", FT_PER_MM / 1000, ["micron", "microns"]);

defineUnit("sf", "area", 1, ["sqft"]);
defineUnit("sy", "area", 9, ["sqyd"]);
defineUnit("msf", "area", 1000, ["MSF"]);
defineUnit("acre", "area", 43560);
defineUnit("m2", "area", FT_PER_M * FT_PER_M * 1, ["sqm"]);
defineUnit("ft2", "area", 1, ["sq_ft", "sq-ft"]);
defineUnit("in2", "area", FT_PER_IN * FT_PER_IN, ["sqin", "sq_in", "sq-in"]);
defineUnit("ha", "area", 10000 * (FT_PER_M * FT_PER_M));

defineUnit("cf", "vol", 1, ["cuft"]);
defineUnit("cy", "vol", 27, ["cuyd"]);
defineUnit("L", "vol", 0.03531466672148859, ["l", "liter", "liters"]);
defineUnit("m3", "vol", 35.31466672148859);
defineUnit("ft3", "vol", 1, ["cu_ft", "cu-ft"]);
defineUnit("gal", "vol", 0.13368055555555555, ["gallon", "gallons"]);
defineUnit("qt", "vol", 0.13368055555555555 / 4, ["quart", "quarts"]);
defineUnit("pt", "vol", 0.13368055555555555 / 8, ["pint", "pints"]);
defineUnit("floz", "vol", 0.13368055555555555 / 128, ["fl_oz", "flOz"]);

defineUnit("lb", "wt", 1, ["lbs", "pound", "pounds"]);
defineUnit("oz", "wt", 1 / 16, ["ounce", "ounces"]);
defineUnit("ton", "wt", 2000, ["tons", "short_ton"]);
defineUnit("tonne", "wt", 1000 * LB_PER_KG, ["t", "metric_ton"]);
defineUnit("kg", "wt", LB_PER_KG);
defineUnit("g", "wt", LB_PER_G);
defineUnit("mg", "wt", LB_PER_G / 1000);

defineUnit("plf", "wt*len^-1", 1, ["ppf"]);

defineUnit("s", "time", 1, ["sec", "secs", "second", "seconds"]);
defineUnit("ms", "time", 0.001, ["msec", "msecs", "millisecond", "milliseconds"]);
defineUnit("us", "time", 0.000001, ["usec", "usecs", "microsecond", "microseconds"]);
defineUnit("ns", "time", 0.000000001, ["nsec", "nsecs", "nanosecond", "nanoseconds"]);
defineUnit("min", "time", 60, ["mins", "minute", "minutes"]);
defineUnit("hr", "time", 3600, ["hrs", "hour", "hours", "h"]);
defineUnit("day", "time", 86400, ["days"]);
defineUnit("wk", "time", 604800, ["week", "weeks"]);
defineUnit("yr", "time", 31557600, ["year", "years"]);

defineUnit("mph", "len*time^-1", FT_PER_MI / 3600);
defineUnit("kph", "len*time^-1", FT_PER_KM / 3600);
defineUnit("mps", "len*time^-1", FT_PER_M / 1);
defineUnit("fps", "len*time^-1", 1);

defineUnit("sfph", "len^2*time^-1", 1 / 3600, ["sfhr"]);
defineUnit("syph", "len^2*time^-1", 9 / 3600, ["syhr"]);
defineUnit("cyph", "len^3*time^-1", 27 / 3600, ["cyhr"]);

defineUnit("Hz", "time^-1", 1, ["hz"]);
defineUnit("rpm", "time^-1", 1 / 60);

defineUnit("lbf", "force", 1);
defineUnit("kip", "force", 1000, ["kips"]);
defineUnit("N", "force", LBF_PER_N);
defineUnit("kN", "force", 1000 * LBF_PER_N);

defineUnit("psf", "force*len^-2", 1);
defineUnit("psi", "force*len^-2", 144);
defineUnit("psia", "force*len^-2", 144);
defineUnit("psig", "force*len^-2", 144);
defineUnit("ksf", "force*len^-2", 1000);
defineUnit("ksi", "force*len^-2", 144000);
defineUnit("kip_per_in2", "force*len^-2", 144000, ["kip_per_inch2", "kip_per_in_2", "kip_in2"]);
defineUnit("Pa", "force*len^-2", (LBF_PER_N) / (FT_PER_M * FT_PER_M));
defineUnit("kPa", "force*len^-2", 1000 * ((LBF_PER_N) / (FT_PER_M * FT_PER_M)));
defineUnit("MPa", "force*len^-2", 1000000 * ((LBF_PER_N) / (FT_PER_M * FT_PER_M)));
defineUnit("bar", "force*len^-2", 100000 * ((LBF_PER_N) / (FT_PER_M * FT_PER_M)));

defineUnit("atm", "force*len^-2", 101325 * ((LBF_PER_N) / (FT_PER_M * FT_PER_M)));

defineUnit("ftlbf", "force*len", 1, ["ft_lb", "ft-lb"]);
defineUnit("J", "force*len", 1 / J_PER_FTLBF);
defineUnit("kJ", "force*len", 1000 / J_PER_FTLBF);
defineUnit("MJ", "force*len", 1000000 / J_PER_FTLBF);
defineUnit("Wh", "force*len", (3600) / J_PER_FTLBF);
defineUnit("kWh", "force*len", (3600000) / J_PER_FTLBF);
defineUnit("BTU", "force*len", (1055.05585262) / J_PER_FTLBF);

defineUnit("W", "force*len*time^-1", (1 / J_PER_FTLBF));
defineUnit("kW", "force*len*time^-1", 1000 * (1 / J_PER_FTLBF));
defineUnit("hp", "force*len*time^-1", 550);

defineUnit("rad", "scalar", 1);
defineUnit("deg", "scalar", Math.PI / 180, ["degree", "degrees"]);

defineUnit("px", "len", FT_PER_PX, ["pixel", "pixels"]);
defineUnit("pt", "len", FT_PER_PT, ["point", "points"]);

defineUnit("dpi", "count*len^-1", 12, ["ppi"]);

defineUnit("cfs", "vol*time^-1", 1);
defineUnit("cfm", "vol*time^-1", 1 / 60);
defineUnit("gpm", "vol*time^-1", 0.13368055555555555 / 60);
defineUnit("lpm", "vol*time^-1", 0.03531466672148859 / 60);

defineUnit("pcf", "wt*len^-3", 1);

defineUnit("g0", "len*time^-2", 32.17404855643044, ["gee"]);

defineUnit("ea", "count", 1, ["each"]);
defineUnit("usd", "cur", 1, ["USD"]);
defineUnit("$", "cur", 1, ["dollar", "dollars"]);

defineUnit("pct", "scalar", 0.01, ["percent"]);
defineUnit("%", "scalar", 0.01);

defineUnit("layer", "layer", 1);

export function isUnitToken(token){
  return Object.prototype.hasOwnProperty.call(UNIT, token);
}

export function makeQty(value, kind = "scalar"){
  const qty = { value, kind };
  const dim = dimFromKind(kind);
  if (dim && dim.cur === 1){
    qty.__cost = true;
    qty.breakdown = { type: "leaf", value };
  }
  return qty;
}

export function isQty(value){
  return value && typeof value === "object" && typeof value.value === "number" && typeof value.kind === "string";
}

export function isCostQty(value){
  if (!isQty(value)) return false;
  const dim = dimFromKind(value.kind);
  return Boolean(dim && dim.cur === 1);
}

function costLeaf(value){
  return { type: "leaf", value };
}

function normalizeCostBreakdown(value){
  if (!value || typeof value !== "object") return null;
  if (!isCostQty(value)) return null;
  if (value.breakdown) return value.breakdown;
  return costLeaf(value.value);
}

function applyCostMeta(result, breakdown){
  if (!result || typeof result !== "object") return result;
  if (!breakdown) return result;
  result.__cost = true;
  result.breakdown = breakdown;
  return result;
}

const DIMENSIONS = {
  scalar: {},
  len: { len: 1 },
  area: { len: 2 },
  vol: { len: 3 },
  wt: { wt: 1 },
  time: { time: 1 },
  force: { force: 1 },
  count: { count: 1 },
  cur: { cur: 1 },
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
  const time = dim.time || 0;
  const force = dim.force || 0;
  const count = dim.count || 0;
  const cur = dim.cur || 0;
  if (len === 0 && wt === 0 && time === 0 && force === 0 && count === 0 && cur === 0) return "scalar";
  if (len === 1 && wt === 0 && time === 0 && force === 0 && count === 0 && cur === 0) return "len";
  if (len === 2 && wt === 0 && time === 0 && force === 0 && count === 0 && cur === 0) return "area";
  if (len === 3 && wt === 0 && time === 0 && force === 0 && count === 0 && cur === 0) return "vol";
  if (len === 0 && wt === 1 && time === 0 && force === 0 && count === 0 && cur === 0) return "wt";
  if (len === 0 && wt === 0 && time === 1 && force === 0 && count === 0 && cur === 0) return "time";
  if (len === 0 && wt === 0 && time === 0 && force === 1 && count === 0 && cur === 0) return "force";
  if (len === 0 && wt === 0 && time === 0 && force === 0 && count === 1 && cur === 0) return "count";
  if (len === 0 && wt === 0 && time === 0 && force === 0 && count === 0 && cur === 1) return "cur";
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
  const formatDimUnit = (dim) => {
    const unitForKeyExp = (key, expAbs) => {
      if (key === "len"){
        if (expAbs === 1) return "ft";
        if (expAbs === 2) return "sf";
        if (expAbs === 3) return "cf";
        return `ft^${expAbs}`;
      }
      if (key === "wt"){
        if (expAbs === 1) return "lb";
        return `lb^${expAbs}`;
      }
      if (key === "time"){
        if (expAbs === 1) return "s";
        return `s^${expAbs}`;
      }
      if (key === "force"){
        if (expAbs === 1) return "lbf";
        return `lbf^${expAbs}`;
      }
      if (key === "count"){
        if (expAbs === 1) return "ea";
        return `ea^${expAbs}`;
      }
      return expAbs === 1 ? key : `${key}^${expAbs}`;
    };

    const num = [];
    const den = [];
    const entries = Object.entries(dim).filter(([k, v]) => k !== "cur" && v !== 0);
    entries.sort(([a], [b]) => a.localeCompare(b));
    for (const [k, v] of entries){
      const abs = Math.abs(v);
      const label = unitForKeyExp(k, abs);
      if (v > 0) num.push(label);
      else den.push(label);
    }
    if (!num.length && !den.length) return "";
    if (!den.length) return num.join("*");
    if (!num.length) return `/ ${den.join("*")}`;
    return `${num.join("*")} / ${den.join("*")}`;
  };

  const dim = dimFromKind(kind);
  if (dim.cur){
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    const restDim = Object.assign({}, dim);
    delete restDim.cur;
    const rest = formatDimUnit(restDim);
    return `${sign}$${fmt(absValue)}${rest ? ` ${rest}` : ""}`;
  }
  if (kind === "scalar") return fmt(value);
  if (kind === "len") return `${fmt(value)} ft`;
  if (kind === "area") return `${fmt(value)} sf`;
  if (kind === "vol") return `${fmt(value)} cf`;
  if (kind === "wt") return `${fmt(value)} lb`;
  if (kind === "time") return `${fmt(value)} s`;
  if (kind === "force") return `${fmt(value)} lbf`;
  if (kind === "count") return `${fmt(value)} ea`;
  if (kind === "cur") return `${value < 0 ? "-" : ""}$${fmt(Math.abs(value))}`;
  return `${fmt(value)} ${kind}`;
}

export function isScalarKind(kind){
  return dimKey(dimFromKind(kind)) === "scalar";
}

export function convert(qty, toUnit){
  if (!qty || typeof qty !== "object") throw new Error("convert() expects a quantity");
  let unit;
  if (typeof toUnit === "string"){
    if (!isUnitToken(toUnit)) throw new Error(`Unknown unit: ${toUnit}`);
    unit = UNIT[toUnit];
  }else if (isQty(toUnit)){
    unit = toUnit;
  }else{
    throw new Error("convert() expects a unit token (string) or a unit quantity");
  }
  const qtyDim = dimFromKind(qty.kind);
  const unitDim = dimFromKind(unit.kind);
  if (dimKey(qtyDim) !== dimKey(unitDim)) throw new Error(`Unit mismatch: cannot convert ${qty.kind} -> ${unit.kind}`);
  const base = qty.value;
  const denom = (typeof unit.toBase === "number") ? unit.toBase : unit.value;
  return base / denom;
}

export function add(a, b){
  if (isQty(a) && isQty(b)){
    if (!sameDimension(a, b)) throw new Error(`Unit mismatch: ${a.kind} + ${b.kind}`);
    const kind = kindFromDim(dimFromKind(a.kind));
    const result = makeQty(a.value + b.value, kind);
    if (isCostQty(result)){
      const left = normalizeCostBreakdown(a);
      const right = normalizeCostBreakdown(b);
      if (left && right) return applyCostMeta(result, { type: "op", op: "+", a: left, b: right });
    }
    return result;
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
    const result = makeQty(a.value - b.value, kind);
    if (isCostQty(result)){
      const left = normalizeCostBreakdown(a);
      const right = normalizeCostBreakdown(b);
      if (left && right) return applyCostMeta(result, { type: "op", op: "-", a: left, b: right });
    }
    return result;
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
    const resultKind = kindFromDim(dim);
    const result = makeQty(a.value * b.value, resultKind);
    if (isCostQty(result)){
      const left = normalizeCostBreakdown(a);
      const right = normalizeCostBreakdown(b);
      if (left && !right) return applyCostMeta(result, { type: "scale", factor: b.value, inner: left });
      if (!left && right) return applyCostMeta(result, { type: "scale", factor: a.value, inner: right });
    }
    return result;
  }
  if (isQty(a) && !isQty(b)){
    const dim = dimFromKind(a.kind);
    const result = makeQty(a.value * b, kindFromDim(dim));
    if (isCostQty(result)){
      const left = normalizeCostBreakdown(a);
      if (left) return applyCostMeta(result, { type: "scale", factor: b, inner: left });
    }
    return result;
  }
  if (!isQty(a) && isQty(b)){
    const dim = dimFromKind(b.kind);
    const result = makeQty(a * b.value, kindFromDim(dim));
    if (isCostQty(result)){
      const right = normalizeCostBreakdown(b);
      if (right) return applyCostMeta(result, { type: "scale", factor: a, inner: right });
    }
    return result;
  }
  return a * b;
}

export function div(a, b){
  if (isQty(a) && isQty(b)){
    const dim = combineDims(dimFromKind(a.kind), dimFromKind(b.kind), -1);
    const resultKind = kindFromDim(dim);
    const result = makeQty(a.value / b.value, resultKind);
    if (isCostQty(result)){
      const left = normalizeCostBreakdown(a);
      const right = normalizeCostBreakdown(b);
      if (left && !right) return applyCostMeta(result, { type: "scale", factor: 1 / b.value, inner: left });
      if (!left && right) return applyCostMeta(result, { type: "scale", factor: a.value, inner: right });
    }
    return result;
  }
  if (isQty(a) && !isQty(b)){
    const dim = dimFromKind(a.kind);
    const result = makeQty(a.value / b, kindFromDim(dim));
    if (isCostQty(result)){
      const left = normalizeCostBreakdown(a);
      if (left) return applyCostMeta(result, { type: "scale", factor: 1 / b, inner: left });
    }
    return result;
  }
  if (!isQty(a) && isQty(b)){
    const dim = combineDims({}, dimFromKind(b.kind), -1);
    const result = makeQty(a / b.value, kindFromDim(dim));
    if (isCostQty(result)){
      const right = normalizeCostBreakdown(b);
      if (right) return applyCostMeta(result, { type: "scale", factor: a, inner: right });
    }
    return result;
  }
  return a / b;
}

export function pow(a, b){
  if (isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Exponent must be scalar.");
    const exp = b.value;
    if (!Number.isInteger(exp) && !isScalarKind(a.kind)){
      if (exp !== 0.5) throw new Error("Exponent must be integer for dimensioned quantities.");
      const dim = dimFromKind(a.kind);
      for (const val of Object.values(dim)){
        if (!Number.isInteger(val)) throw new Error("Invalid dimension exponent.");
        if (val % 2 !== 0) throw new Error("sqrt() requires even dimension exponents.");
      }
    }
    const dim = scaleDim(dimFromKind(a.kind), exp);
    return makeQty(Math.pow(a.value, exp), kindFromDim(dim));
  }
  if (isQty(a) && !isQty(b)){
    if (!Number.isInteger(b) && !isScalarKind(a.kind)){
      if (b !== 0.5) throw new Error("Exponent must be integer for dimensioned quantities.");
      const dim = dimFromKind(a.kind);
      for (const val of Object.values(dim)){
        if (!Number.isInteger(val)) throw new Error("Invalid dimension exponent.");
        if (val % 2 !== 0) throw new Error("sqrt() requires even dimension exponents.");
      }
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

export const __internal = {
  dimFromKind,
  dimKey,
  kindFromDim,
  combineDims,
  scaleDim,
};
