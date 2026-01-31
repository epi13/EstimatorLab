import { add, div, isQty, makeQty, mul, pow, qtyToString } from "./repl-units.js";
import { isTruthy } from "./repl-expression.js";

export function defFn(name, arity, impl){
  return { arity, impl };
}

export function createBaseFns(){
  const baseFns = Object.create(null);

  baseFns.abs = defFn("abs", 1, (x) => isQty(x) ? makeQty(Math.abs(x.value), x.kind) : Math.abs(x));
  baseFns.min = defFn("min", 2, (a, b) => isQty(a) || isQty(b) ? (add(a, 0).value <= add(b, 0).value ? a : b) : Math.min(a, b));
  baseFns.max = defFn("max", 2, (a, b) => isQty(a) || isQty(b) ? (add(a, 0).value >= add(b, 0).value ? a : b) : Math.max(a, b));
  baseFns.round = defFn("round", 1, (x) => isQty(x) ? makeQty(Math.round(x.value), x.kind) : Math.round(x));
  baseFns.ceil = defFn("ceil", 1, (x) => isQty(x) ? makeQty(Math.ceil(x.value), x.kind) : Math.ceil(x));
  baseFns.floor = defFn("floor", 1, (x) => isQty(x) ? makeQty(Math.floor(x.value), x.kind) : Math.floor(x));
  baseFns.sqrt = defFn("sqrt", 1, (x) => isQty(x) ? makeQty(Math.sqrt(x.value), x.kind) : Math.sqrt(x));
  baseFns.pow = defFn("pow", 2, (a, b) => pow(a, b));
  baseFns.exp = defFn("exp", 1, (x) => isQty(x) ? makeQty(Math.exp(x.value), x.kind) : Math.exp(x));
  baseFns.log = defFn("log", 1, (x) => isQty(x) ? makeQty(Math.log(x.value), x.kind) : Math.log(x));
  baseFns.log10 = defFn("log10", 1, (x) => isQty(x) ? makeQty(Math.log10(x.value), x.kind) : Math.log10(x));
  baseFns.sin = defFn("sin", 1, (x) => Math.sin(isQty(x) ? x.value : x));
  baseFns.cos = defFn("cos", 1, (x) => Math.cos(isQty(x) ? x.value : x));
  baseFns.tan = defFn("tan", 1, (x) => Math.tan(isQty(x) ? x.value : x));
  baseFns.asin = defFn("asin", 1, (x) => Math.asin(isQty(x) ? x.value : x));
  baseFns.acos = defFn("acos", 1, (x) => Math.acos(isQty(x) ? x.value : x));
  baseFns.atan = defFn("atan", 1, (x) => Math.atan(isQty(x) ? x.value : x));
  baseFns.atan2 = defFn("atan2", 2, (y, x) => Math.atan2(isQty(y) ? y.value : y, isQty(x) ? x.value : x));
  baseFns.clamp = defFn("clamp", 3, (x, min, max) => {
    const xv = isQty(x) ? x.value : x;
    const minv = isQty(min) ? min.value : min;
    const maxv = isQty(max) ? max.value : max;
    const v = Math.min(Math.max(xv, minv), maxv);
    return isQty(x) ? makeQty(v, x.kind) : v;
  });
  baseFns.if = defFn("if", 3, (cond, a, b) => (isTruthy(cond) ? a : b));

  baseFns.waste = defFn("waste", 2, (qty, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    const factor = 1 + (p / 100);
    return mul(qty, factor);
  });
  baseFns.markup = defFn("markup", 2, (cost, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    return mul(cost, 1 + (p / 100));
  });
  baseFns.burden = defFn("burden", 2, (labor, pct) => {
    const p = isQty(pct) ? pct.value : pct;
    return mul(labor, 1 + (p / 100));
  });
  baseFns.unit = defFn("unit", 2, (cost, qty) => div(cost, qty));
  baseFns.qty = defFn("qty", 2, (assy, length) => {
    if (!assy || typeof assy !== "object" || !assy.__assy) throw new Error("qty expects an assembly as the first argument.");
    const lenQty = isQty(length) ? length : makeQty(length, "len");
    if (lenQty.kind !== "len") throw new Error("qty expects a length quantity as the second argument.");
    const fields = assy.fields || {};
    const parts = [`len: ${qtyToString(lenQty)}`];

    const spacing = fields.studs?.value;
    const height = fields.height?.value;
    const sheathing = fields.sheathing?.value;

    if (spacing !== undefined){
      if (!isQty(spacing) || spacing.kind !== "len") throw new Error("studs spacing must be a length quantity.");
      if (spacing.value <= 0) throw new Error("studs spacing must be > 0.");
      const studs = Math.floor(lenQty.value / spacing.value) + 1;
      parts.push(`studs: ${studs} ea`);
      if (height !== undefined){
        if (!isQty(height) || height.kind !== "len") throw new Error("height must be a length quantity.");
        const studLength = makeQty(studs * height.value, "len");
        parts.push(`stud length: ${qtyToString(studLength)}`);
      }
    }

    if (height !== undefined){
      if (!isQty(height) || height.kind !== "len") throw new Error("height must be a length quantity.");
      const area = makeQty(lenQty.value * height.value, "area");
      parts.push(`area: ${qtyToString(area)}`);
      if (sheathing !== undefined){
        const layerCount = Number(isQty(sheathing) ? sheathing.value : sheathing);
        if (!Number.isFinite(layerCount)) throw new Error("sheathing layers must be numeric.");
        const sheathingArea = makeQty(area.value * layerCount, "area");
        const label = layerCount === 1 ? "sheathing" : `sheathing x${layerCount}`;
        parts.push(`${label}: ${qtyToString(sheathingArea)}`);
      }
    }

    return parts.join(" | ");
  });
  baseFns.round_up = defFn("round_up", 2, (x, step) => {
    const xv = isQty(x) ? x.value : x;
    const sv = isQty(step) ? step.value : step;
    const r = Math.ceil(xv / sv) * sv;
    return isQty(x) ? makeQty(r, x.kind) : r;
  });

  baseFns.area_rect = defFn("area_rect", 2, (a, b) => {
    const aa = isQty(a) ? a : makeQty(a, "len");
    const bb = isQty(b) ? b : makeQty(b, "len");
    if (aa.kind !== "len" || bb.kind !== "len") throw new Error("area_rect expects (len, len)");
    return makeQty(aa.value * bb.value, "area");
  });

  baseFns.area_circle = defFn("area_circle", 1, (diam) => {
    const d = isQty(diam) ? diam : makeQty(diam, "len");
    if (d.kind !== "len") throw new Error("area_circle expects diameter (len)");
    const r = d.value / 2;
    return makeQty(Math.PI * r * r, "area");
  });

  baseFns.vol_rect = defFn("vol_rect", 2, (area, thickness_in) => {
    const a = isQty(area) ? area : makeQty(area, "area");
    if (a.kind !== "area") throw new Error("vol_rect expects area as first arg");
    let t;
    if (isQty(thickness_in)){
      if (thickness_in.kind !== "len") throw new Error("thickness must be length");
      t = thickness_in.value;
    }else{
      t = (thickness_in / 12);
    }
    return makeQty(a.value * t, "vol");
  });

  baseFns.concrete_cy = defFn("concrete_cy", 2, (area, thickness_in) => {
    const vol = baseFns.vol_rect.impl(area, thickness_in);
    return makeQty(vol.value, "vol");
  });

  baseFns.bf = defFn("bf", 4, (t_in, w_in, len_ft, qty) => {
    const t = isQty(t_in) ? t_in.value : t_in;
    const w = isQty(w_in) ? w_in.value : w_in;
    const L = isQty(len_ft) ? len_ft.value : len_ft;
    const q = isQty(qty) ? qty.value : qty;
    return (t * w * L * q) / 12;
  });

  const PIPE_WT = {
    "0.5": { "40": 0.85, "80": 1.09 },
    "0.75": { "40": 1.13, "80": 1.47 },
    "1": { "40": 1.68, "80": 2.17 },
    "1.25": { "40": 2.27, "80": 3.00 },
    "1.5": { "40": 2.72, "80": 3.63 },
    "2": { "40": 3.65, "80": 5.02 },
    "2.5": { "40": 5.79, "80": 7.66 },
    "3": { "40": 7.58, "80": 10.25 },
    "4": { "40": 10.79, "80": 14.98 },
  };
  baseFns.pipe_wt = defFn("pipe_wt", 3, (nps_in, schedule, len_ft) => {
    const nps = String(isQty(nps_in) ? nps_in.value : nps_in);
    const sch = String(isQty(schedule) ? schedule.value : schedule);
    const L = isQty(len_ft) ? len_ft.value : len_ft;
    const row = PIPE_WT[nps];
    if (!row || !row[sch]) throw new Error("pipe_wt: unsupported NPS/schedule (try 2,40)");
    const lb_per_ft = row[sch];
    return makeQty(lb_per_ft * L, "wt");
  });

  baseFns.to_in = defFn("to_in", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_in expects length");
    return q.value * 12;
  });
  baseFns.to_ft = defFn("to_ft", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_ft expects length");
    return q.value;
  });
  baseFns.to_sf = defFn("to_sf", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sf expects area");
    return q.value;
  });
  baseFns.to_sy = defFn("to_sy", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sy expects area");
    return q.value / 9;
  });
  baseFns.to_cf = defFn("to_cf", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cf expects volume");
    return q.value;
  });
  baseFns.to_cy = defFn("to_cy", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cy expects volume");
    return q.value / 27;
  });
  baseFns.to_lb = defFn("to_lb", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_lb expects weight");
    return q.value;
  });
  baseFns.to_ton = defFn("to_ton", 1, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_ton expects weight");
    return q.value / 2000;
  });

  return baseFns;
}
