export const EFFECT = {
  PURE: 0,
  IO_GFX: 1 << 0,
  STATE: 1 << 1,
  RNG: 1 << 2,
  TIME: 1 << 3,
};

EFFECT.ALL = EFFECT.IO_GFX | EFFECT.STATE | EFFECT.RNG | EFFECT.TIME;

export function effectNames(mask){
  const names = [];
  if (mask & EFFECT.IO_GFX) names.push("IO_GFX");
  if (mask & EFFECT.STATE) names.push("STATE");
  if (mask & EFFECT.RNG) names.push("RNG");
  if (mask & EFFECT.TIME) names.push("TIME");
  return names.length ? names : ["PURE"];
}
