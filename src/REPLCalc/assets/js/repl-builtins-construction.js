export function attachConstructionBuiltins(baseFns, {
  defFn,
  convert,
  isQty,
  isTruthy,
  makeQty,
  qtyToString,
  add,
  div,
  mul,
}){
  baseFns.waste = defFn("waste", 2, {
    args: [
      { label: "qty", kinds: ["scalar", "dim"] },
      { label: "pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
  }, (qty, pct) => {
    const factor = isQty(pct) ? (1 + pct.value) : (1 + (pct / 100));
    return mul(qty, factor);
  });
  baseFns.markup = defFn("markup", 2, {
    args: [
      { label: "cost", kinds: ["scalar", "dim"] },
      { label: "pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
  }, (cost, pct) => {
    const factor = isQty(pct) ? (1 + pct.value) : (1 + (pct / 100));
    return mul(cost, factor);
  });
  baseFns.burden = defFn("burden", 2, {
    args: [
      { label: "labor", kinds: ["scalar", "dim"] },
      { label: "pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
  }, (labor, pct) => {
    const factor = isQty(pct) ? (1 + pct.value) : (1 + (pct / 100));
    return mul(labor, factor);
  });
  baseFns.unit = defFn("unit", 2, {
    args: [
      { label: "cost", kinds: ["scalar", "dim"] },
      { label: "qty", kinds: ["scalar", "dim"] },
    ],
  }, (cost, qty) => div(cost, qty));

  baseFns.qty = defFn("qty", 2, {
    args: [
      { label: "assy", kinds: ["assy"] },
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["string"] },
  }, (assy, length) => {
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
        const layerCount = (() => {
          if (isQty(sheathing)) return sheathing.value;
          if (sheathing && typeof sheathing === "object" && typeof sheathing.__kind === "string"){
            if (sheathing.__kind === "scalar") return sheathing.value;
            if (sheathing.__kind === "bool") return sheathing.value ? 1 : 0;
            if (sheathing.__kind === "string"){
              const parsed = Number.parseFloat(sheathing.value);
              if (Number.isFinite(parsed)) return parsed;
            }
          }
          if (typeof sheathing === "string"){
            const parsed = Number.parseFloat(sheathing);
            if (Number.isFinite(parsed)) return parsed;
          }
          return Number(sheathing);
        })();
        if (!Number.isFinite(layerCount)) throw new Error("sheathing layers must be numeric.");
        const sheathingArea = makeQty(area.value * layerCount, "area");
        const label = layerCount === 1 ? "sheathing" : `sheathing x${layerCount}`;
        parts.push(`${label}: ${qtyToString(sheathingArea)}`);
      }
    }

    return parts.join(" | ");
  });

  baseFns.round_up = defFn("round_up", 2, {
    args: [
      { label: "x", kinds: ["scalar", "dim"] },
      { label: "step", kinds: ["scalar", "dim"] },
    ],
  }, (x, step) => {
    const xv = isQty(x) ? x.value : x;
    const sv = isQty(step) ? step.value : step;
    const r = Math.ceil(xv / sv) * sv;
    return isQty(x) ? makeQty(r, x.kind) : r;
  });

  baseFns.area_rect = defFn("area_rect", 2, {
    args: [
      { label: "a", kinds: ["scalar", "dim"], dim: "len" },
      { label: "b", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "area" },
  }, (a, b) => {
    const aa = isQty(a) ? a : makeQty(a, "len");
    const bb = isQty(b) ? b : makeQty(b, "len");
    if (aa.kind !== "len" || bb.kind !== "len") throw new Error("area_rect expects (len, len)");
    return makeQty(aa.value * bb.value, "area");
  });

  baseFns.area_circle = defFn("area_circle", 1, {
    args: [{ label: "diam", kinds: ["scalar", "dim"], dim: "len" }],
    returns: { kinds: ["dim"], dim: "area" },
  }, (diam) => {
    const d = isQty(diam) ? diam : makeQty(diam, "len");
    if (d.kind !== "len") throw new Error("area_circle expects diameter (len)");
    const r = d.value / 2;
    return makeQty(Math.PI * r * r, "area");
  });

  baseFns.vol_rect = defFn("vol_rect", 2, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "thickness_in", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (area, thickness_in) => {
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

  baseFns.concrete_cy = defFn("concrete_cy", 2, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "thickness_in", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (area, thickness_in) => {
    const vol = baseFns.vol_rect.impl(area, thickness_in);
    return makeQty(vol.value, "vol");
  });

  baseFns.bf = defFn("bf", 4, {
    args: [
      { label: "t_in", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "w_in", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "len_ft", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "qty", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (t_in, w_in, len_ft, qty) => {
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

  baseFns.pipe_wt = defFn("pipe_wt", 3, {
    args: [
      { label: "nps_in", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "schedule", kinds: ["scalar", "dim", "string"] },
      { label: "len_ft", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "wt" },
  }, (nps_in, schedule, len_ft) => {
    const nps = String(isQty(nps_in) ? nps_in.value : nps_in);
    const sch = String(isQty(schedule) ? schedule.value : schedule);
    const L = isQty(len_ft) ? len_ft.value : len_ft;
    const row = PIPE_WT[nps];
    if (!row || !row[sch]) throw new Error("pipe_wt: unsupported NPS/schedule (try 2,40)");
    const lb_per_ft = row[sch];
    return makeQty(lb_per_ft * L, "wt");
  });

  baseFns.to_in = defFn("to_in", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "len" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_in expects length");
    return q.value * 12;
  });

  baseFns.to = defFn("to", 2, {
    args: [
      { label: "x", kinds: ["scalar", "dim"] },
      { label: "unit", kinds: ["string", "dim"] },
    ],
    returns: { kinds: ["scalar"] },
  }, (x, unit) => {
    const q = isQty(x) ? x : makeQty(x, "scalar");
    return convert(q, unit);
  });

  baseFns.to_ft = defFn("to_ft", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "len" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "len");
    if (q.kind !== "len") throw new Error("to_ft expects length");
    return q.value;
  });

  baseFns.to_sf = defFn("to_sf", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sf expects area");
    return q.value;
  });

  baseFns.to_sy = defFn("to_sy", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "area" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "area");
    if (q.kind !== "area") throw new Error("to_sy expects area");
    return q.value / 9;
  });

  baseFns.to_cf = defFn("to_cf", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "vol" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cf expects volume");
    return q.value;
  });

  baseFns.to_cy = defFn("to_cy", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "vol" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "vol");
    if (q.kind !== "vol") throw new Error("to_cy expects volume");
    return q.value / 27;
  });

  baseFns.to_lb = defFn("to_lb", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "wt" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_lb expects weight");
    return q.value;
  });

  baseFns.to_ton = defFn("to_ton", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "wt" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "wt");
    if (q.kind !== "wt") throw new Error("to_ton expects weight");
    return q.value / 2000;
  });

  baseFns.to_sec = defFn("to_sec", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "time" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "time");
    if (q.kind !== "time") throw new Error("to_sec expects time");
    return q.value;
  });

  baseFns.to_min = defFn("to_min", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "time" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "time");
    if (q.kind !== "time") throw new Error("to_min expects time");
    return q.value / 60;
  });

  baseFns.to_hr = defFn("to_hr", 1, {
    args: [{ label: "x", kinds: ["scalar", "dim"], dim: "time" }],
    returns: { kinds: ["scalar"] },
  }, (x) => {
    const q = isQty(x) ? x : makeQty(x, "time");
    if (q.kind !== "time") throw new Error("to_hr expects time");
    return q.value / 3600;
  });

  baseFns.not = defFn("not", 1, {
    args: [{ label: "x", kinds: ["any"] }],
    returns: { kinds: ["scalar"] },
  }, (x) => (isTruthy(x) ? 0 : 1));
  baseFns.and = defFn("and", 2, {
    args: [{ label: "a", kinds: ["any"] }, { label: "b", kinds: ["any"] }],
    returns: { kinds: ["scalar"] },
  }, (a, b) => (isTruthy(a) && isTruthy(b)) ? 1 : 0);
  baseFns.or = defFn("or", 2, {
    args: [{ label: "a", kinds: ["any"] }, { label: "b", kinds: ["any"] }],
    returns: { kinds: ["scalar"] },
  }, (a, b) => (isTruthy(a) || isTruthy(b)) ? 1 : 0);

  baseFns.sum = defFn("sum", -1, {
    args: [],
  }, (...values) => {
    let acc = null;
    for (const v of values){
      acc = acc === null ? v : add(acc, v);
    }
    return acc === null ? 0 : acc;
  });
}
