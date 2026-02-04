let _state = 0x12345678;

export function seedRng(value){
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("seed expects a numeric scalar");
  _state = (Math.floor(n) >>> 0) || 1;
  return _state;
}

export function random(){
  _state |= 0;
  _state = (_state + 0x6D2B79F5) | 0;
  let t = Math.imul(_state ^ (_state >>> 15), 1 | _state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
