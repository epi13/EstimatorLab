import {
  add as unitAdd,
  sub as unitSub,
  mul as unitMul,
  div as unitDiv,
  pow as unitPow,
  isQty,
  isScalarKind,
  sameDimension,
} from "./repl-units.js";
import {
  box,
  isBool,
  isNull,
  isScalar,
  isString,
  scalar,
  toScalarNumber,
} from "./repl-values.js";

function isNumber(value){
  return typeof value === "number";
}

function isScalarValue(value){
  const v = box(value);
  if (isScalar(v) || isBool(v) || isNull(v)) return true;
  if (isNumber(v)) return true;
  if (isQty(v)) return isScalarKind(v.kind);
  return false;
}

function scalarNumber(value){
  const v = box(value);
  if (isNumber(v)) return v;
  if (isScalar(v) || isBool(v) || isNull(v)) return toScalarNumber(v, "scalar", { allowBool: true, allowDimlessDim: true });
  if (isQty(v)){
    if (!isScalarKind(v.kind)) throw new Error("Expected scalar quantity");
    return v.value;
  }
  throw new Error("Expected scalar");
}

function isRange(value){
  return value && typeof value === "object" && value.__range;
}

function isVec(value){
  return value && typeof value === "object" && value.__vec;
}

function isMat(value){
  return value && typeof value === "object" && value.__mat;
}

function rangeLo(range){
  return range.fields?.lo?.value;
}

function rangeHi(range){
  return range.fields?.hi?.value;
}

function makeRange(lo, hi){
  if (isQty(lo) && isQty(hi)){
    if (!sameDimension(lo, hi)) throw new Error(`Unit mismatch: ${lo.kind} vs ${hi.kind}`);
  }
  const info = (v) => ({ value: v, note: "", raw: "" });
  return {
    __assy: true,
    __range: true,
    name: "range",
    fields: {
      lo: info(lo),
      hi: info(hi),
    },
  };
}

function toRange(value){
  if (isRange(value)) return value;
  return makeRange(value, value);
}

function valueKey(value){
  const v = box(value);
  if (isQty(v)) return v.value;
  if (isScalar(v) || isBool(v) || isNull(v)) return scalarNumber(v);
  return v;
}

function minValue(a, b){
  const av = box(a);
  const bv = box(b);
  if (isQty(av) && isQty(bv)){
    if (!sameDimension(av, bv)) throw new Error(`Unit mismatch: ${av.kind} vs ${bv.kind}`);
    return av.value <= bv.value ? av : bv;
  }
  if (isQty(av) && !isQty(bv)){
    if (!isScalarKind(av.kind)) throw new Error("Cannot compare unit quantity to scalar.");
    const n = scalarNumber(bv);
    return av.value <= n ? av : bv;
  }
  if (!isQty(av) && isQty(bv)){
    if (!isScalarKind(bv.kind)) throw new Error("Cannot compare scalar to unit quantity.");
    const n = scalarNumber(av);
    return n <= bv.value ? av : bv;
  }
  const an = scalarNumber(av);
  const bn = scalarNumber(bv);
  return an <= bn ? av : bv;
}

function maxValue(a, b){
  const av = box(a);
  const bv = box(b);
  if (isQty(av) && isQty(bv)){
    if (!sameDimension(av, bv)) throw new Error(`Unit mismatch: ${av.kind} vs ${bv.kind}`);
    return av.value >= bv.value ? av : bv;
  }
  if (isQty(av) && !isQty(bv)){
    if (!isScalarKind(av.kind)) throw new Error("Cannot compare unit quantity to scalar.");
    const n = scalarNumber(bv);
    return av.value >= n ? av : bv;
  }
  if (!isQty(av) && isQty(bv)){
    if (!isScalarKind(bv.kind)) throw new Error("Cannot compare scalar to unit quantity.");
    const n = scalarNumber(av);
    return n >= bv.value ? av : bv;
  }
  const an = scalarNumber(av);
  const bn = scalarNumber(bv);
  return an >= bn ? av : bv;
}

function rangeAdd(a, b){
  const ra = toRange(a);
  const rb = toRange(b);
  return makeRange(add(rangeLo(ra), rangeLo(rb)), add(rangeHi(ra), rangeHi(rb)));
}

function rangeSub(a, b){
  const ra = toRange(a);
  const rb = toRange(b);
  return makeRange(sub(rangeLo(ra), rangeHi(rb)), sub(rangeHi(ra), rangeLo(rb)));
}

function rangeMul(a, b){
  const ra = toRange(a);
  const rb = toRange(b);
  const alo = rangeLo(ra);
  const ahi = rangeHi(ra);
  const blo = rangeLo(rb);
  const bhi = rangeHi(rb);

  const c1 = mul(alo, blo);
  const c2 = mul(alo, bhi);
  const c3 = mul(ahi, blo);
  const c4 = mul(ahi, bhi);

  let lo = c1;
  let hi = c1;
  for (const c of [c2, c3, c4]){
    lo = minValue(lo, c);
    hi = maxValue(hi, c);
  }
  return makeRange(lo, hi);
}

function rangeDiv(a, b){
  const rb = toRange(b);
  const blo = rangeLo(rb);
  const bhi = rangeHi(rb);
  const bloNum = valueKey(blo);
  const bhiNum = valueKey(bhi);
  const crossesZero = (bloNum <= 0 && bhiNum >= 0);
  if (crossesZero){
    throw new Error("Range division undefined when denominator range crosses 0.");
  }
  return rangeMul(a, makeRange(div(1, bhi), div(1, blo)));
}

function vecElements(vec){
  return Array.isArray(vec.data) ? vec.data : [];
}

function makeVec(name, elements, labels){
  const fields = Object.create(null);
  for (let i = 0; i < elements.length; i++){
    const key = labels?.[i] || `v${i + 1}`;
    fields[key] = { value: elements[i], note: "", raw: "" };
  }
  return {
    __assy: true,
    __vec: true,
    name,
    data: elements.slice(),
    fields,
  };
}

function makeMat(name, rows, cols, elements){
  const fields = Object.create(null);
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      const idx = r * cols + c;
      fields[`m${r + 1}${c + 1}`] = { value: elements[idx], note: "", raw: "" };
    }
  }
  return {
    __assy: true,
    __mat: true,
    name,
    rows,
    cols,
    data: elements.slice(),
    fields,
  };
}

function vecAdd(a, b){
  if (!isVec(a) || !isVec(b)) throw new Error("Vector addition requires two vectors.");
  if (a.data.length !== b.data.length) throw new Error("Vector size mismatch.");
  const out = a.data.map((v, i) => add(v, b.data[i]));
  return makeVec(a.name || "vec", out);
}

function vecSub(a, b){
  if (!isVec(a) || !isVec(b)) throw new Error("Vector subtraction requires two vectors.");
  if (a.data.length !== b.data.length) throw new Error("Vector size mismatch.");
  const out = a.data.map((v, i) => sub(v, b.data[i]));
  return makeVec(a.name || "vec", out);
}

function vecScale(vec, scalar){
  const s = scalarNumber(scalar);
  const out = vec.data.map((v) => mul(v, s));
  return makeVec(vec.name || "vec", out);
}

function matVecMul(mat, vec){
  if (mat.cols !== vec.data.length) throw new Error("Matrix/vector size mismatch.");
  const out = [];
  for (let r = 0; r < mat.rows; r++){
    let acc = 0;
    for (let c = 0; c < mat.cols; c++){
      const m = mat.data[r * mat.cols + c];
      if (!isScalarValue(m)) throw new Error("Matrix elements must be scalar.");
      acc = add(acc, mul(scalarNumber(m), vec.data[c]));
    }
    out.push(acc);
  }
  return makeVec("vec", out);
}

function matMatMul(a, b){
  if (a.cols !== b.rows) throw new Error("Matrix size mismatch.");
  const out = new Array(a.rows * b.cols).fill(0);
  for (let r = 0; r < a.rows; r++){
    for (let c = 0; c < b.cols; c++){
      let acc = 0;
      for (let k = 0; k < a.cols; k++){
        const av = a.data[r * a.cols + k];
        const bv = b.data[k * b.cols + c];
        if (!isScalarValue(av) || !isScalarValue(bv)) throw new Error("Matrix elements must be scalar.");
        acc = add(acc, mul(scalarNumber(av), scalarNumber(bv)));
      }
      out[r * b.cols + c] = acc;
    }
  }
  return makeMat("mat", a.rows, b.cols, out);
}

function assertNoStringOperands(a, b, op){
  const av = box(a);
  const bv = box(b);
  if (typeof av === "string" || typeof bv === "string" || isString(av) || isString(bv)){
    throw new Error(`Cannot apply ${op} to strings.`);
  }
}

export function add(a, b){
  const av = box(a);
  const bv = box(b);
  if (isRange(av) || isRange(bv)) return rangeAdd(av, bv);
  if (isVec(av) || isVec(bv)) return vecAdd(av, bv);
  assertNoStringOperands(av, bv, "+");
  if (isQty(av) || isQty(bv)){
    const ua = isQty(av) ? av : scalarNumber(av);
    const ub = isQty(bv) ? bv : scalarNumber(bv);
    return unitAdd(ua, ub);
  }
  if (isScalarValue(av) && isScalarValue(bv)) return scalar(scalarNumber(av) + scalarNumber(bv));
  return scalarNumber(av) + scalarNumber(bv);
}

export function sub(a, b){
  const av = box(a);
  const bv = box(b);
  if (isRange(av) || isRange(bv)) return rangeSub(av, bv);
  if (isVec(av) || isVec(bv)) return vecSub(av, bv);
  assertNoStringOperands(av, bv, "-");
  if (isQty(av) || isQty(bv)){
    const ua = isQty(av) ? av : scalarNumber(av);
    const ub = isQty(bv) ? bv : scalarNumber(bv);
    return unitSub(ua, ub);
  }
  if (isScalarValue(av) && isScalarValue(bv)) return scalar(scalarNumber(av) - scalarNumber(bv));
  return scalarNumber(av) - scalarNumber(bv);
}

export function mul(a, b){
  const av = box(a);
  const bv = box(b);
  if (isRange(av) || isRange(bv)) return rangeMul(av, bv);
  if (isVec(av) && isScalarValue(bv)) return vecScale(av, bv);
  if (isScalarValue(av) && isVec(bv)) return vecScale(bv, av);
  if (isMat(av) && isVec(bv)) return matVecMul(av, bv);
  if (isMat(av) && isMat(bv)) return matMatMul(av, bv);
  assertNoStringOperands(av, bv, "*");
  if (isQty(av) || isQty(bv)){
    const ua = isQty(av) ? av : scalarNumber(av);
    const ub = isQty(bv) ? bv : scalarNumber(bv);
    return unitMul(ua, ub);
  }
  if (isScalarValue(av) && isScalarValue(bv)) return scalar(scalarNumber(av) * scalarNumber(bv));
  return scalarNumber(av) * scalarNumber(bv);
}

export function div(a, b){
  const av = box(a);
  const bv = box(b);
  if (isRange(av) || isRange(bv)) return rangeDiv(av, bv);
  assertNoStringOperands(av, bv, "/");
  if (isQty(av) || isQty(bv)){
    const ua = isQty(av) ? av : scalarNumber(av);
    const ub = isQty(bv) ? bv : scalarNumber(bv);
    return unitDiv(ua, ub);
  }
  if (isScalarValue(av) && isScalarValue(bv)) return scalar(scalarNumber(av) / scalarNumber(bv));
  return scalarNumber(av) / scalarNumber(bv);
}

export function pow(a, b){
  const av = box(a);
  const bv = box(b);
  assertNoStringOperands(av, bv, "^");
  if (isQty(av) || isQty(bv)){
    const ua = isQty(av) ? av : scalarNumber(av);
    const ub = isQty(bv) ? bv : scalarNumber(bv);
    return unitPow(ua, ub);
  }
  if (isScalarValue(av) && isScalarValue(bv)) return scalar(Math.pow(scalarNumber(av), scalarNumber(bv)));
  return scalar(Math.pow(scalarNumber(av), scalarNumber(bv)));
}

export const __internal = {
  makeRange,
  makeVec,
  makeMat,
  isRange,
  isVec,
  isMat,
};
