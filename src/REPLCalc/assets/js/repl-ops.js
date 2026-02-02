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

function isNumber(value){
  return typeof value === "number";
}

function isScalarValue(value){
  if (isNumber(value)) return true;
  if (isQty(value)) return isScalarKind(value.kind);
  return false;
}

function scalarNumber(value){
  if (isNumber(value)) return value;
  if (isQty(value)){
    if (!isScalarKind(value.kind)) throw new Error("Expected scalar quantity");
    return value.value;
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
  if (isQty(value)) return value.value;
  return value;
}

function minValue(a, b){
  if (isQty(a) && isQty(b)){
    if (!sameDimension(a, b)) throw new Error(`Unit mismatch: ${a.kind} vs ${b.kind}`);
    return a.value <= b.value ? a : b;
  }
  if (isQty(a) && !isQty(b)){
    if (!isScalarKind(a.kind)) throw new Error("Cannot compare unit quantity to scalar.");
    return a.value <= b ? a : b;
  }
  if (!isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Cannot compare scalar to unit quantity.");
    return a <= b.value ? a : b;
  }
  return a <= b ? a : b;
}

function maxValue(a, b){
  if (isQty(a) && isQty(b)){
    if (!sameDimension(a, b)) throw new Error(`Unit mismatch: ${a.kind} vs ${b.kind}`);
    return a.value >= b.value ? a : b;
  }
  if (isQty(a) && !isQty(b)){
    if (!isScalarKind(a.kind)) throw new Error("Cannot compare unit quantity to scalar.");
    return a.value >= b ? a : b;
  }
  if (!isQty(a) && isQty(b)){
    if (!isScalarKind(b.kind)) throw new Error("Cannot compare scalar to unit quantity.");
    return a >= b.value ? a : b;
  }
  return a >= b ? a : b;
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
  if (typeof a === "string" || typeof b === "string"){
    throw new Error(`Cannot apply ${op} to strings.`);
  }
}

export function add(a, b){
  if (isRange(a) || isRange(b)) return rangeAdd(a, b);
  if (isVec(a) || isVec(b)) return vecAdd(a, b);
  assertNoStringOperands(a, b, "+");
  if (isQty(a) || isQty(b)) return unitAdd(a, b);
  if (isNumber(a) && isNumber(b)) return a + b;
  return a + b;
}

export function sub(a, b){
  if (isRange(a) || isRange(b)) return rangeSub(a, b);
  if (isVec(a) || isVec(b)) return vecSub(a, b);
  assertNoStringOperands(a, b, "-");
  if (isQty(a) || isQty(b)) return unitSub(a, b);
  if (isNumber(a) && isNumber(b)) return a - b;
  return a - b;
}

export function mul(a, b){
  if (isRange(a) || isRange(b)) return rangeMul(a, b);
  if (isVec(a) && isScalarValue(b)) return vecScale(a, b);
  if (isScalarValue(a) && isVec(b)) return vecScale(b, a);
  if (isMat(a) && isVec(b)) return matVecMul(a, b);
  if (isMat(a) && isMat(b)) return matMatMul(a, b);
  assertNoStringOperands(a, b, "*");
  if (isQty(a) || isQty(b)) return unitMul(a, b);
  if (isNumber(a) && isNumber(b)) return a * b;
  return a * b;
}

export function div(a, b){
  if (isRange(a) || isRange(b)) return rangeDiv(a, b);
  assertNoStringOperands(a, b, "/");
  if (isQty(a) || isQty(b)) return unitDiv(a, b);
  if (isNumber(a) && isNumber(b)) return a / b;
  return a / b;
}

export function pow(a, b){
  assertNoStringOperands(a, b, "^");
  if (isQty(a) || isQty(b)) return unitPow(a, b);
  if (isNumber(a) && isNumber(b)) return Math.pow(a, b);
  return Math.pow(a, b);
}

export const __internal = {
  makeRange,
  makeVec,
  makeMat,
  isRange,
  isVec,
  isMat,
};
