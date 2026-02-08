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
  const isMissing = (v) => v === undefined || v === null;
  const scalarValue = (v) => {
    if (typeof v === "number") return v;
    if (v && typeof v === "object" && v.__kind === "scalar") return v.value;
    return v;
  };
  const ceilSafe = (x) => Math.ceil(x - 1e-9);

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

  function lenFromInchesOrQty(value, label){
    if (isMissing(value)) throw new Error(`${label} is required`);
    if (isQty(value)){
      if (value.kind !== "len") throw new Error(`${label} must be length`);
      return value.value;
    }
    const v = value;
    if (!Number.isFinite(v)) throw new Error(`${label} must be a number`);
    return v / 12;
  }

  baseFns.slab_cy = defFn("slab_cy", -1, {
    args: [
      { label: "len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "wid", kinds: ["scalar", "dim"], dim: "len" },
      { label: "thickness_in", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (len, wid, thickness_in, wastePct) => {
    const L = isQty(len) ? len : makeQty(len, "len");
    const W = isQty(wid) ? wid : makeQty(wid, "len");
    if (L.kind !== "len" || W.kind !== "len") throw new Error("slab_cy expects (len, len, thickness_in, waste_pct)");
    if (!(L.value >= 0) || !(W.value >= 0)) throw new Error("slab_cy len/wid must be >= 0");
    const t = lenFromInchesOrQty(thickness_in, "slab_cy thickness_in");
    if (!(t > 0)) throw new Error("slab_cy thickness_in must be > 0");
    const factor = defaultPctFactor(wastePct, 5);
    return makeQty((L.value * W.value * t) * factor, "vol");
  });

  baseFns.wall_cy = defFn("wall_cy", -1, {
    args: [
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
      { label: "height", kinds: ["scalar", "dim"], dim: "len" },
      { label: "thickness_in", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (length, height, thickness_in, wastePct) => {
    const L = isQty(length) ? length : makeQty(length, "len");
    const H = isQty(height) ? height : makeQty(height, "len");
    if (L.kind !== "len" || H.kind !== "len") throw new Error("wall_cy expects (len, len, thickness_in, waste_pct)");
    if (!(L.value >= 0) || !(H.value >= 0)) throw new Error("wall_cy length/height must be >= 0");
    const t = lenFromInchesOrQty(thickness_in, "wall_cy thickness_in");
    if (!(t > 0)) throw new Error("wall_cy thickness_in must be > 0");
    const factor = defaultPctFactor(wastePct, 5);
    return makeQty((L.value * H.value * t) * factor, "vol");
  });

  baseFns.footing_cy = defFn("footing_cy", -1, {
    args: [
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
      { label: "width_in", kinds: ["scalar", "dim"], dim: "len" },
      { label: "depth_in", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (length, width_in, depth_in, wastePct) => {
    const L = isQty(length) ? length : makeQty(length, "len");
    if (L.kind !== "len") throw new Error("footing_cy expects length as first arg");
    if (!(L.value >= 0)) throw new Error("footing_cy length must be >= 0");
    const w = lenFromInchesOrQty(width_in, "footing_cy width_in");
    const d = lenFromInchesOrQty(depth_in, "footing_cy depth_in");
    if (!(w > 0) || !(d > 0)) throw new Error("footing_cy width/depth must be > 0");
    const factor = defaultPctFactor(wastePct, 5);
    return makeQty((L.value * w * d) * factor, "vol");
  });

  baseFns.concrete_bags = defFn("concrete_bags", -1, {
    args: [
      { label: "vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "bag_yield_cf", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (vol, bagYieldCf, wastePct) => {
    const V = isQty(vol) ? vol : makeQty(vol, "vol");
    if (V.kind !== "vol") throw new Error("concrete_bags expects volume");
    const y = isMissing(bagYieldCf)
      ? 0.6
      : (isQty(bagYieldCf)
        ? (bagYieldCf.kind === "vol" ? bagYieldCf.value : (() => { throw new Error("concrete_bags bag_yield_cf must be volume"); })())
        : (Number(bagYieldCf) / 1));
    if (!Number.isFinite(y) || y <= 0) throw new Error("concrete_bags bag_yield_cf must be > 0");
    const factor = defaultPctFactor(wastePct, 0);
    return makeQty(Math.ceil((V.value * factor) / y), "count");
  });

  baseFns.rebar_grid_bars = defFn("rebar_grid_bars", -1, {
    args: [
      { label: "len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "wid", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
      { label: "bar_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "lap_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "mats", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (len, wid, oc, barLen, lapLen, wastePct, mats) => {
    if (isMissing(oc)) throw new Error("rebar_grid_bars oc is required");
    const L = defaultLen(len, 0);
    const W = defaultLen(wid, 0);
    const S = defaultLen(oc, 0);
    if (L.kind !== "len" || W.kind !== "len" || S.kind !== "len") throw new Error("rebar_grid_bars expects (len, len, oc, ...)");
    if (!(S.value > 0)) throw new Error("rebar_grid_bars oc must be > 0");
    const bar = defaultLen(barLen, 20);
    const lap = defaultLen(lapLen, 1);
    if (bar.kind !== "len" || lap.kind !== "len") throw new Error("rebar_grid_bars bar_len and lap_len must be length");
    if (!(bar.value > 0)) throw new Error("rebar_grid_bars bar_len must be > 0");
    if (!(lap.value >= 0)) throw new Error("rebar_grid_bars lap_len must be >= 0");

    const runA = baseFns.oc_count.impl(W, S).value;
    const runB = baseFns.oc_count.impl(L, S).value;
    const perRunA = baseFns.bar_count.impl(L, bar, lap, 0).value;
    const perRunB = baseFns.bar_count.impl(W, bar, lap, 0).value;
    const matCount = isMissing(mats) ? 1 : (isQty(mats) ? mats.value : mats);
    if (!Number.isFinite(matCount) || matCount <= 0) throw new Error("rebar_grid_bars mats must be > 0");

    const base = (runA * perRunA + runB * perRunB) * matCount;
    const factor = defaultPctFactor(wastePct, 5);
    return makeQty(Math.ceil(base * factor), "count");
  });

  baseFns.scale_linear = defFn("scale_linear", 3, {
    args: [
      { label: "value", kinds: ["scalar", "dim"] },
      { label: "old_scale", kinds: ["scalar", "dim"] },
      { label: "new_scale", kinds: ["scalar", "dim"] },
    ],
  }, (value, oldScale, newScale) => {
    const ov = isQty(oldScale) ? oldScale.value : oldScale;
    if (!Number.isFinite(ov) || ov === 0) throw new Error("scale_linear old_scale must be non-zero");
    const ratio = div(newScale, oldScale);
    return mul(value, ratio);
  });

  baseFns.scale_pow = defFn("scale_pow", 4, {
    args: [
      { label: "value", kinds: ["scalar", "dim"] },
      { label: "old_scale", kinds: ["scalar", "dim"] },
      { label: "new_scale", kinds: ["scalar", "dim"] },
      { label: "k", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
  }, (value, oldScale, newScale, k) => {
    const ov = isQty(oldScale) ? oldScale.value : oldScale;
    if (!Number.isFinite(ov) || ov === 0) throw new Error("scale_pow old_scale must be non-zero");
    const ratio = div(newScale, oldScale);
    const rv = isQty(ratio) ? ratio.value : scalarValue(ratio);
    if (!Number.isFinite(rv) || rv <= 0) throw new Error("scale_pow new/old must be > 0");
    const kv = isQty(k) ? k.value : k;
    if (!Number.isFinite(kv)) throw new Error("scale_pow k must be a number");
    return mul(value, Math.pow(rv, kv));
  });

  baseFns.perim_rect = defFn("perim_rect", 2, {
    args: [
      { label: "len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "wid", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "len" },
  }, (len, wid) => {
    const L = isQty(len) ? len : makeQty(len, "len");
    const W = isQty(wid) ? wid : makeQty(wid, "len");
    if (L.kind !== "len" || W.kind !== "len") throw new Error("perim_rect expects (len, len)");
    return makeQty(2 * (L.value + W.value), "len");
  });

  baseFns.wall_area = defFn("wall_area", 2, {
    args: [
      { label: "perim", kinds: ["scalar", "dim"], dim: "len" },
      { label: "height", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "area" },
  }, (perim, height) => {
    const P = isQty(perim) ? perim : makeQty(perim, "len");
    const H = isQty(height) ? height : makeQty(height, "len");
    if (P.kind !== "len" || H.kind !== "len") throw new Error("wall_area expects (len, len)");
    return makeQty(P.value * H.value, "area");
  });

  baseFns.oc_linear_ft = defFn("oc_linear_ft", 2, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "len" },
  }, (area, oc) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    const S = isQty(oc) ? oc : makeQty(oc, "len");
    if (A.kind !== "area" || S.kind !== "len") throw new Error("oc_linear_ft expects (area, len)");
    if (!(S.value > 0)) throw new Error("oc_linear_ft oc must be > 0");
    return makeQty(A.value / S.value, "len");
  });

  baseFns.oc_run_count = defFn("oc_run_count", 2, {
    args: [
      { label: "height", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["scalar"] },
  }, (height, oc) => {
    const H = isQty(height) ? height : makeQty(height, "len");
    const S = isQty(oc) ? oc : makeQty(oc, "len");
    if (H.kind !== "len" || S.kind !== "len") throw new Error("oc_run_count expects (len, len)");
    if (!(S.value > 0)) throw new Error("oc_run_count oc must be > 0");
    return Math.max(1, Math.ceil(H.value / S.value));
  });

  baseFns.oc_count = defFn("oc_count", 2, {
    args: [
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (length, oc) => {
    const L = isQty(length) ? length : makeQty(length, "len");
    const S = isQty(oc) ? oc : makeQty(oc, "len");
    if (L.kind !== "len" || S.kind !== "len") throw new Error("oc_count expects (len, len)");
    if (!(S.value > 0)) throw new Error("oc_count oc must be > 0");
    if (!(L.value >= 0)) throw new Error("oc_count length must be >= 0");
    const count = Math.floor(L.value / S.value) + 1;
    return makeQty(count, "count");
  });

  baseFns.stud_count = defFn("stud_count", 2, {
    args: [
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (length, oc) => baseFns.oc_count.impl(length, oc));

  baseFns.oc_linear_ft_parallel = defFn("oc_linear_ft_parallel", 3, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "height", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "len" },
  }, (area, height, oc) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    const H = isQty(height) ? height : makeQty(height, "len");
    const S = isQty(oc) ? oc : makeQty(oc, "len");
    if (A.kind !== "area" || H.kind !== "len" || S.kind !== "len") throw new Error("oc_linear_ft_parallel expects (area, len, len)");
    if (!(H.value > 0)) throw new Error("oc_linear_ft_parallel height must be > 0");
    const runs = baseFns.oc_run_count.impl(H, S);
    const wallLen = A.value / H.value;
    return makeQty(wallLen * runs, "len");
  });

  baseFns.coils_needed = defFn("coils_needed", 2, {
    args: [
      { label: "total_lf", kinds: ["scalar", "dim"], dim: "len" },
      { label: "coil_len", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["scalar"] },
  }, (totalLf, coilLen) => {
    const T = isQty(totalLf) ? totalLf : makeQty(totalLf, "len");
    const C = isQty(coilLen) ? coilLen : makeQty(coilLen, "len");
    if (T.kind !== "len" || C.kind !== "len") throw new Error("coils_needed expects (len, len)");
    if (!(C.value > 0)) throw new Error("coils_needed coil_len must be > 0");
    return Math.ceil(T.value / C.value);
  });

  baseFns.stick_count = defFn("stick_count", 3, {
    args: [
      { label: "lf", kinds: ["scalar", "dim"], dim: "len" },
      { label: "stick_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (lf, stickLen, wastePct) => {
    const L = isQty(lf) ? lf : makeQty(lf, "len");
    const S = isQty(stickLen) ? stickLen : makeQty(stickLen, "len");
    if (L.kind !== "len" || S.kind !== "len") throw new Error("stick_count expects (len, len, waste_pct)");
    if (!(S.value > 0)) throw new Error("stick_count stick_len must be > 0");
    const factor = isQty(wastePct) ? (1 + wastePct.value) : (1 + (wastePct / 100));
    const pct = isQty(wastePct) ? wastePct.value : wastePct;
    if (!Number.isFinite(pct) || pct < 0) throw new Error("stick_count waste_pct must be >= 0");
    const total = L.value * factor;
    return ceilSafe(total / S.value);
  });

  baseFns.sheet_count = defFn("sheet_count", 3, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "sheet_area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (area, sheetArea, wastePct) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    const S = isQty(sheetArea) ? sheetArea : makeQty(sheetArea, "area");
    if (A.kind !== "area" || S.kind !== "area") throw new Error("sheet_count expects (area, area, waste_pct)");
    if (!(S.value > 0)) throw new Error("sheet_count sheet_area must be > 0");
    const factor = isQty(wastePct) ? (1 + wastePct.value) : (1 + (wastePct / 100));
    const pct = isQty(wastePct) ? wastePct.value : wastePct;
    if (!Number.isFinite(pct) || pct < 0) throw new Error("sheet_count waste_pct must be >= 0");
    const total = A.value * factor;
    return ceilSafe(total / S.value);
  });

  baseFns.roof_squares = defFn("roof_squares", 1, {
    args: [{ label: "area", kinds: ["scalar", "dim"], dim: "area" }],
    returns: { kinds: ["scalar"] },
  }, (area) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    if (A.kind !== "area") throw new Error("roof_squares expects area");
    return A.value / 100;
  });

  baseFns.shingle_bundles = defFn("shingle_bundles", -1, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "bundles_per_square", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (area, bundlesPerSquare, wastePct) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    if (A.kind !== "area") throw new Error("shingle_bundles expects area");
    const bps = isMissing(bundlesPerSquare) ? 3 : (isQty(bundlesPerSquare) ? bundlesPerSquare.value : bundlesPerSquare);
    if (!Number.isFinite(bps) || bps <= 0) throw new Error("shingle_bundles bundles_per_square must be > 0");
    const squares = A.value / 100;
    const factor = defaultPctFactor(wastePct, 10);
    return makeQty(Math.ceil(squares * bps * factor), "count");
  });

  baseFns.underlayment_rolls = defFn("underlayment_rolls", -1, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "roll_coverage_sf", kinds: ["scalar", "dim"], dim: "area" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (area, rollCoverage, wastePct) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    if (A.kind !== "area") throw new Error("underlayment_rolls expects area");
    const cov = isMissing(rollCoverage) ? makeQty(400, "area") : (isQty(rollCoverage) ? rollCoverage : makeQty(rollCoverage, "area"));
    if (cov.kind !== "area") throw new Error("underlayment_rolls roll_coverage_sf must be area");
    if (!(cov.value > 0)) throw new Error("underlayment_rolls roll_coverage_sf must be > 0");
    const factor = defaultPctFactor(wastePct, 10);
    return makeQty(Math.ceil((A.value * factor) / cov.value), "count");
  });

  baseFns.ridgecap_bundles = defFn("ridgecap_bundles", -1, {
    args: [
      { label: "ridge_lf", kinds: ["scalar", "dim"], dim: "len" },
      { label: "coverage_lf_per_bundle", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (ridgeLf, coverageLfPerBundle, wastePct) => {
    const R = isQty(ridgeLf) ? ridgeLf : makeQty(ridgeLf, "len");
    if (R.kind !== "len") throw new Error("ridgecap_bundles expects ridge_lf length");
    if (!(R.value >= 0)) throw new Error("ridgecap_bundles ridge_lf must be >= 0");
    const cov = isMissing(coverageLfPerBundle) ? makeQty(33, "len") : (isQty(coverageLfPerBundle) ? coverageLfPerBundle : makeQty(coverageLfPerBundle, "len"));
    if (cov.kind !== "len") throw new Error("ridgecap_bundles coverage_lf_per_bundle must be length");
    if (!(cov.value > 0)) throw new Error("ridgecap_bundles coverage_lf_per_bundle must be > 0");
    const factor = defaultPctFactor(wastePct, 10);
    return makeQty(Math.ceil((R.value * factor) / cov.value), "count");
  });

  baseFns.paint_gal = defFn("paint_gal", 4, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "coverage_sf_per_gal", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "coats", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (area, coverageSfPerGal, coats, wastePct) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    if (A.kind !== "area") throw new Error("paint_gal expects area");
    const cov = isQty(coverageSfPerGal) ? coverageSfPerGal.value : coverageSfPerGal;
    if (!Number.isFinite(cov) || cov <= 0) throw new Error("paint_gal coverage_sf_per_gal must be > 0");
    const c = isQty(coats) ? coats.value : coats;
    if (!Number.isFinite(c) || c <= 0) throw new Error("paint_gal coats must be > 0");
    const factor = isQty(wastePct) ? (1 + wastePct.value) : (1 + (wastePct / 100));
    const pct = isQty(wastePct) ? wastePct.value : wastePct;
    if (!Number.isFinite(pct) || pct < 0) throw new Error("paint_gal waste_pct must be >= 0");
    const totalArea = A.value * c;
    const gallons = (totalArea / cov) * factor;
    return gallons;
  });

  baseFns.wt_from_cy = defFn("wt_from_cy", 2, {
    args: [
      { label: "vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "lb_per_cy", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "wt" },
  }, (vol, lbPerCy) => {
    const V = isQty(vol) ? vol : makeQty(vol, "vol");
    if (V.kind !== "vol") throw new Error("wt_from_cy expects volume");
    const p = isQty(lbPerCy) ? lbPerCy.value : lbPerCy;
    if (!Number.isFinite(p) || p < 0) throw new Error("wt_from_cy lb_per_cy must be >= 0");
    const cy = V.value / 27;
    return makeQty(cy * p, "wt");
  });

  baseFns.bar_count = defFn("bar_count", 4, {
    args: [
      { label: "run_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "bar_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "lap_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (runLen, barLen, lapLen, wastePct) => {
    const R = isQty(runLen) ? runLen : makeQty(runLen, "len");
    const B = isQty(barLen) ? barLen : makeQty(barLen, "len");
    const L = isQty(lapLen) ? lapLen : makeQty(lapLen, "len");
    if (R.kind !== "len" || B.kind !== "len" || L.kind !== "len") throw new Error("bar_count expects (len, len, len, waste_pct)");
    if (!(B.value > 0)) throw new Error("bar_count bar_len must be > 0");
    if (!(L.value >= 0)) throw new Error("bar_count lap_len must be >= 0");
    if (!(B.value > L.value)) throw new Error("bar_count requires bar_len > lap_len");
    const factor = isQty(wastePct) ? (1 + wastePct.value) : (1 + (wastePct / 100));
    const pct = isQty(wastePct) ? wastePct.value : wastePct;
    if (!Number.isFinite(pct) || pct < 0) throw new Error("bar_count waste_pct must be >= 0");

    const need = R.value * factor;
    const eff = B.value - L.value;
    const count = Math.ceil(need / eff);
    return makeQty(count, "count");
  });

  baseFns.fastener_count = defFn("fastener_count", 3, {
    args: [
      { label: "items", kinds: ["scalar", "dim"], dim: "count" },
      { label: "per_item", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (items, perItem, wastePct) => {
    const n = isQty(items) ? items.value : items;
    if (!Number.isFinite(n) || n < 0) throw new Error("fastener_count items must be >= 0");
    const p = isQty(perItem) ? perItem.value : perItem;
    if (!Number.isFinite(p) || p < 0) throw new Error("fastener_count per_item must be >= 0");
    const factor = isQty(wastePct) ? (1 + wastePct.value) : (1 + (wastePct / 100));
    const pct = isQty(wastePct) ? wastePct.value : wastePct;
    if (!Number.isFinite(pct) || pct < 0) throw new Error("fastener_count waste_pct must be >= 0");
    const total = n * p * factor;
    return makeQty(ceilSafe(total), "count");
  });

  function defaultPctFactor(pct, defaultPct){
    if (isMissing(pct)){
      const raw = defaultPct;
      if (!Number.isFinite(raw) || raw < 0) throw new Error("waste_pct must be >= 0");
      return 1 + (raw / 100);
    }
    if (isQty(pct)){
      const raw = pct.value;
      if (!Number.isFinite(raw) || raw < 0) throw new Error("waste_pct must be >= 0");
      return 1 + raw;
    }
    const raw = pct;
    if (!Number.isFinite(raw) || raw < 0) throw new Error("waste_pct must be >= 0");
    return 1 + (raw / 100);
  }

  function defaultLen(value, feetDefault){
    if (isMissing(value)) return makeQty(feetDefault, "len");
    return isQty(value) ? value : makeQty(value, "len");
  }

  function defaultArea(value, sfDefault){
    if (isMissing(value)) return makeQty(sfDefault, "area");
    return isQty(value) ? value : makeQty(value, "area");
  }

  baseFns.studs_wall = defFn("studs_wall", -1, {
    args: [
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (length, oc, wastePct) => {
    const L = defaultLen(length, 0);
    const S = defaultLen(oc, 16 / 12);
    if (L.kind !== "len" || S.kind !== "len") throw new Error("studs_wall expects (len, oc, waste_pct)");
    if (!(S.value > 0)) throw new Error("studs_wall oc must be > 0");
    if (!(L.value >= 0)) throw new Error("studs_wall length must be >= 0");
    const base = baseFns.oc_count.impl(L, S).value;
    const count = Math.ceil(base * defaultPctFactor(wastePct, 10));
    return makeQty(count, "count");
  });

  baseFns.studs_perim = defFn("studs_perim", -1, {
    args: [
      { label: "perim", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "corner_fudge", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (perim, oc, wastePct, cornerFudge) => {
    const P = defaultLen(perim, 0);
    const S = defaultLen(oc, 16 / 12);
    if (P.kind !== "len" || S.kind !== "len") throw new Error("studs_perim expects (len, oc, waste_pct, corner_fudge)");
    if (!(S.value > 0)) throw new Error("studs_perim oc must be > 0");
    if (!(P.value >= 0)) throw new Error("studs_perim perim must be >= 0");
    const fudge = isMissing(cornerFudge) ? 4 : (isQty(cornerFudge) ? cornerFudge.value : cornerFudge);
    if (!Number.isFinite(fudge)) throw new Error("studs_perim corner_fudge must be numeric");
    const base = Math.ceil(P.value / S.value) + fudge;
    const count = Math.ceil(base * defaultPctFactor(wastePct, 10));
    return makeQty(count, "count");
  });

  baseFns.plates_lf = defFn("plates_lf", -1, {
    args: [
      { label: "perim", kinds: ["scalar", "dim"], dim: "len" },
      { label: "top_plates", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "bottom_plates", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "len" },
  }, (perim, topPlates, bottomPlates) => {
    const P = defaultLen(perim, 0);
    if (P.kind !== "len") throw new Error("plates_lf expects perim length");
    const top = isMissing(topPlates) ? 2 : (isQty(topPlates) ? topPlates.value : topPlates);
    const bot = isMissing(bottomPlates) ? 1 : (isQty(bottomPlates) ? bottomPlates.value : bottomPlates);
    if (!Number.isFinite(top) || top < 0) throw new Error("plates_lf top_plates must be >= 0");
    if (!Number.isFinite(bot) || bot < 0) throw new Error("plates_lf bottom_plates must be >= 0");
    const mult = top + bot;
    return makeQty(P.value * mult, "len");
  });

  baseFns.plates_sticks = defFn("plates_sticks", -1, {
    args: [
      { label: "perim", kinds: ["scalar", "dim"], dim: "len" },
      { label: "top_plates", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "bottom_plates", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "stick_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (perim, topPlates, bottomPlates, stickLen, wastePct) => {
    const plateArgs = [perim];
    if (!isMissing(topPlates)) plateArgs.push(topPlates);
    if (!isMissing(bottomPlates)) plateArgs.push(bottomPlates);
    const lf = baseFns.plates_lf.impl(...plateArgs);
    const stick = defaultLen(stickLen, 8);
    const pct = isMissing(wastePct) ? 12 : wastePct;
    const count = scalarValue(baseFns.stick_count.impl(lf, stick, pct));
    return makeQty(count, "count");
  });

  baseFns.sheets_wall = defFn("sheets_wall", -1, {
    args: [
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
      { label: "height", kinds: ["scalar", "dim"], dim: "len" },
      { label: "sheet_area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "layers", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (length, height, sheetArea, wastePct, layers) => {
    const L = defaultLen(length, 0);
    const H = defaultLen(height, 0);
    if (L.kind !== "len" || H.kind !== "len") throw new Error("sheets_wall expects (len, len, ...) ");
    const S = defaultArea(sheetArea, 32, "sf");
    if (S.kind !== "area") throw new Error("sheets_wall sheet_area must be area");
    if (!(S.value > 0)) throw new Error("sheets_wall sheet_area must be > 0");
    const layerCount = isMissing(layers) ? 1 : (isQty(layers) ? layers.value : layers);
    if (!Number.isFinite(layerCount) || layerCount <= 0) throw new Error("sheets_wall layers must be > 0");
    const totalArea = (L.value * H.value) * layerCount;
    const factor = defaultPctFactor(wastePct, 10);
    const count = Math.ceil((totalArea * factor) / S.value);
    return makeQty(count, "count");
  });

  baseFns.joist_count = defFn("joist_count", -1, {
    args: [
      { label: "run_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (runLen, oc) => {
    const R = defaultLen(runLen, 0);
    const S = defaultLen(oc, 16 / 12);
    if (R.kind !== "len" || S.kind !== "len") throw new Error("joist_count expects (len, oc)");
    if (!(S.value > 0)) throw new Error("joist_count oc must be > 0");
    if (!(R.value >= 0)) throw new Error("joist_count run_len must be >= 0");
    const count = Math.ceil(R.value / S.value) + 1;
    return makeQty(count, "count");
  });

  baseFns.joist_lf = defFn("joist_lf", -1, {
    args: [
      { label: "run_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "span", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
    ],
    returns: { kinds: ["dim"], dim: "len" },
  }, (runLen, span, oc) => {
    const R = defaultLen(runLen, 0);
    const Sp = defaultLen(span, 0);
    const count = isMissing(oc) ? baseFns.joist_count.impl(R) : baseFns.joist_count.impl(R, oc);
    return makeQty(count.value * Sp.value, "len");
  });

  baseFns.joist_sticks = defFn("joist_sticks", -1, {
    args: [
      { label: "run_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "span", kinds: ["scalar", "dim"], dim: "len" },
      { label: "oc", kinds: ["scalar", "dim"], dim: "len" },
      { label: "stick_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (runLen, span, oc, stickLen, wastePct) => {
    const joistArgs = [runLen, span];
    if (!isMissing(oc)) joistArgs.push(oc);
    const lf = baseFns.joist_lf.impl(...joistArgs);
    const stick = defaultLen(stickLen, 8);
    const pct = isMissing(wastePct) ? 12 : wastePct;
    const count = scalarValue(baseFns.stick_count.impl(lf, stick, pct));
    return makeQty(count, "count");
  });

  baseFns.rim_sticks = defFn("rim_sticks", -1, {
    args: [
      { label: "perim", kinds: ["scalar", "dim"], dim: "len" },
      { label: "stick_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (perim, stickLen, wastePct) => {
    const P = defaultLen(perim, 0);
    const stick = defaultLen(stickLen, 8);
    const pct = isMissing(wastePct) ? 12 : wastePct;
    const count = scalarValue(baseFns.stick_count.impl(P, stick, pct));
    return makeQty(count, "count");
  });

  baseFns.subfloor_sheets = defFn("subfloor_sheets", -1, {
    args: [
      { label: "len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "wid", kinds: ["scalar", "dim"], dim: "len" },
      { label: "sheet_area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "layers", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (len, wid, sheetArea, wastePct, layers) => {
    const L = defaultLen(len, 0);
    const W = defaultLen(wid, 0);
    if (L.kind !== "len" || W.kind !== "len") throw new Error("subfloor_sheets expects (len, len, ...) ");
    const S = defaultArea(sheetArea, 32, "sf");
    if (S.kind !== "area") throw new Error("subfloor_sheets sheet_area must be area");
    if (!(S.value > 0)) throw new Error("subfloor_sheets sheet_area must be > 0");
    const layerCount = isMissing(layers) ? 1 : (isQty(layers) ? layers.value : layers);
    if (!Number.isFinite(layerCount) || layerCount <= 0) throw new Error("subfloor_sheets layers must be > 0");
    const totalArea = (L.value * W.value) * layerCount;
    const factor = defaultPctFactor(wastePct, 10);
    const count = Math.ceil((totalArea * factor) / S.value);
    return makeQty(count, "count");
  });

  baseFns.drywall_sheets = defFn("drywall_sheets", -1, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "sheet_area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "layers", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (area, sheetArea, wastePct, layers) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    if (A.kind !== "area") throw new Error("drywall_sheets expects area");
    const S = isMissing(sheetArea) ? makeQty(48, "area") : (isQty(sheetArea) ? sheetArea : makeQty(sheetArea, "area"));
    if (S.kind !== "area") throw new Error("drywall_sheets sheet_area must be area");
    if (!(S.value > 0)) throw new Error("drywall_sheets sheet_area must be > 0");
    const layerCount = isMissing(layers) ? 1 : (isQty(layers) ? layers.value : layers);
    if (!Number.isFinite(layerCount) || layerCount <= 0) throw new Error("drywall_sheets layers must be > 0");
    const factor = defaultPctFactor(wastePct, 10);
    const totalArea = A.value * layerCount * factor;
    return makeQty(Math.ceil(totalArea / S.value), "count");
  });

  baseFns.drywall_screws = defFn("drywall_screws", -1, {
    args: [
      { label: "sheets", kinds: ["scalar", "dim"], dim: "count" },
      { label: "studs_oc", kinds: ["scalar", "dim"], dim: "len" },
      { label: "sheet_w", kinds: ["scalar", "dim"], dim: "len" },
      { label: "sheet_h", kinds: ["scalar", "dim"], dim: "len" },
      { label: "edge_spacing", kinds: ["scalar", "dim"], dim: "len" },
      { label: "field_spacing", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (sheets, studsOc, sheetW, sheetH, edgeSpacing, fieldSpacing, wastePct) => {
    const n = isMissing(sheets) ? 0 : (isQty(sheets) ? sheets.value : sheets);
    if (!Number.isFinite(n) || n < 0) throw new Error("drywall_screws sheets must be >= 0");
    const oc = defaultLen(studsOc, 16 / 12);
    const w = defaultLen(sheetW, 4);
    const h = defaultLen(sheetH, 12);
    const edge = defaultLen(edgeSpacing, 8 / 12);
    const field = defaultLen(fieldSpacing, 12 / 12);
    if (oc.kind !== "len" || w.kind !== "len" || h.kind !== "len" || edge.kind !== "len" || field.kind !== "len"){
      throw new Error("drywall_screws expects length args for studs_oc/sheet_w/sheet_h/edge_spacing/field_spacing");
    }
    if (!(oc.value > 0)) throw new Error("drywall_screws studs_oc must be > 0");
    if (!(w.value > 0) || !(h.value > 0)) throw new Error("drywall_screws sheet_w and sheet_h must be > 0");
    if (!(edge.value > 0) || !(field.value > 0)) throw new Error("drywall_screws spacing must be > 0");

    const studs = Math.max(2, Math.floor(w.value / oc.value) + 1);
    const edgePerStud = Math.floor(h.value / edge.value) + 1;
    const fieldPerStud = Math.floor(h.value / field.value) + 1;
    const screwsPerSheet = (2 * edgePerStud) + Math.max(0, studs - 2) * fieldPerStud;

    const factor = defaultPctFactor(wastePct, 10);
    return makeQty(Math.ceil(n * screwsPerSheet * factor), "count");
  });

  baseFns.tape_rolls = defFn("tape_rolls", -1, {
    args: [
      { label: "seam_lf", kinds: ["scalar", "dim"], dim: "len" },
      { label: "roll_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (seamLf, rollLen, wastePct) => {
    const seam = defaultLen(seamLf, 0);
    const roll = defaultLen(rollLen, 500);
    if (seam.kind !== "len" || roll.kind !== "len") throw new Error("tape_rolls expects (len, len, waste_pct)");
    if (!(seam.value >= 0)) throw new Error("tape_rolls seam_lf must be >= 0");
    if (!(roll.value > 0)) throw new Error("tape_rolls roll_len must be > 0");
    const factor = defaultPctFactor(wastePct, 10);
    return makeQty(Math.ceil((seam.value * factor) / roll.value), "count");
  });

  baseFns.corner_bead_sticks = defFn("corner_bead_sticks", -1, {
    args: [
      { label: "corner_lf", kinds: ["scalar", "dim"], dim: "len" },
      { label: "stick_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (cornerLf, stickLen, wastePct) => {
    const corner = defaultLen(cornerLf, 0);
    const stick = defaultLen(stickLen, 10);
    if (corner.kind !== "len" || stick.kind !== "len") throw new Error("corner_bead_sticks expects (len, len, waste_pct)");
    if (!(corner.value >= 0)) throw new Error("corner_bead_sticks corner_lf must be >= 0");
    if (!(stick.value > 0)) throw new Error("corner_bead_sticks stick_len must be > 0");
    const factor = defaultPctFactor(wastePct, 10);
    return makeQty(Math.ceil((corner.value * factor) / stick.value), "count");
  });

  baseFns.mud_gal = defFn("mud_gal", 4, {
    args: [
      { label: "area", kinds: ["scalar", "dim"], dim: "area" },
      { label: "coverage_sf_per_gal", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "coats", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (area, coverageSfPerGal, coats, wastePct) => {
    const A = isQty(area) ? area : makeQty(area, "area");
    if (A.kind !== "area") throw new Error("mud_gal expects area");
    const cov = isQty(coverageSfPerGal) ? coverageSfPerGal.value : coverageSfPerGal;
    if (!Number.isFinite(cov) || cov <= 0) throw new Error("mud_gal coverage_sf_per_gal must be > 0");
    const c = isQty(coats) ? coats.value : coats;
    if (!Number.isFinite(c) || c <= 0) throw new Error("mud_gal coats must be > 0");
    const factor = isQty(wastePct) ? (1 + wastePct.value) : (1 + (wastePct / 100));
    const pct = isQty(wastePct) ? wastePct.value : wastePct;
    if (!Number.isFinite(pct) || pct < 0) throw new Error("mud_gal waste_pct must be >= 0");
    return (A.value * c / cov) * factor;
  });

  function pctToRatio(pct, defaultPct){
    if (isMissing(pct)){
      const raw = defaultPct;
      if (!Number.isFinite(raw) || raw < 0) throw new Error("pct must be >= 0");
      return raw / 100;
    }
    if (isQty(pct)){
      const raw = pct.value;
      if (!Number.isFinite(raw) || raw < 0) throw new Error("pct must be >= 0");
      return raw;
    }
    const raw = pct;
    if (!Number.isFinite(raw) || raw < 0) throw new Error("pct must be >= 0");
    return raw / 100;
  }

  baseFns.bank_to_loose = defFn("bank_to_loose", -1, {
    args: [
      { label: "bank_vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "swell_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (bankVol, swellPct) => {
    const V = isQty(bankVol) ? bankVol : makeQty(bankVol, "vol");
    if (V.kind !== "vol") throw new Error("bank_to_loose expects volume");
    const factor = defaultPctFactor(swellPct, 0);
    return makeQty(V.value * factor, "vol");
  });

  baseFns.loose_to_bank = defFn("loose_to_bank", -1, {
    args: [
      { label: "loose_vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "swell_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (looseVol, swellPct) => {
    const V = isQty(looseVol) ? looseVol : makeQty(looseVol, "vol");
    if (V.kind !== "vol") throw new Error("loose_to_bank expects volume");
    const factor = defaultPctFactor(swellPct, 0);
    if (!(factor > 0)) throw new Error("loose_to_bank swell_pct factor must be > 0");
    return makeQty(V.value / factor, "vol");
  });

  baseFns.bank_to_compacted = defFn("bank_to_compacted", -1, {
    args: [
      { label: "bank_vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "shrink_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (bankVol, shrinkPct) => {
    const V = isQty(bankVol) ? bankVol : makeQty(bankVol, "vol");
    if (V.kind !== "vol") throw new Error("bank_to_compacted expects volume");
    const r = pctToRatio(shrinkPct, 0);
    if (!(r < 1)) throw new Error("bank_to_compacted shrink_pct must be < 100%");
    const factor = 1 - r;
    return makeQty(V.value * factor, "vol");
  });

  baseFns.compacted_to_bank = defFn("compacted_to_bank", -1, {
    args: [
      { label: "compacted_vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "shrink_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (compactedVol, shrinkPct) => {
    const V = isQty(compactedVol) ? compactedVol : makeQty(compactedVol, "vol");
    if (V.kind !== "vol") throw new Error("compacted_to_bank expects volume");
    const r = pctToRatio(shrinkPct, 0);
    if (!(r < 1)) throw new Error("compacted_to_bank shrink_pct must be < 100%");
    const factor = 1 - r;
    if (!(factor > 0)) throw new Error("compacted_to_bank shrink_pct factor must be > 0");
    return makeQty(V.value / factor, "vol");
  });

  baseFns.truck_loads = defFn("truck_loads", -1, {
    args: [
      { label: "vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "truck_vol", kinds: ["scalar", "dim"], dim: "vol" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (vol, truckVol, wastePct) => {
    const V = isQty(vol) ? vol : makeQty(vol, "vol");
    if (V.kind !== "vol") throw new Error("truck_loads expects volume");
    const T = isMissing(truckVol) ? makeQty(10 * 27, "vol") : (isQty(truckVol) ? truckVol : makeQty(truckVol, "vol"));
    if (T.kind !== "vol") throw new Error("truck_loads truck_vol must be volume");
    if (!(T.value > 0)) throw new Error("truck_loads truck_vol must be > 0");
    const factor = defaultPctFactor(wastePct, 0);
    return makeQty(Math.ceil((V.value * factor) / T.value), "count");
  });

  baseFns.trench_cy = defFn("trench_cy", 4, {
    args: [
      { label: "length", kinds: ["scalar", "dim"], dim: "len" },
      { label: "depth", kinds: ["scalar", "dim"], dim: "len" },
      { label: "bottom_width", kinds: ["scalar", "dim"], dim: "len" },
      { label: "slope", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "vol" },
  }, (length, depth, bottomWidth, slope) => {
    const L = isQty(length) ? length : makeQty(length, "len");
    const D = isQty(depth) ? depth : makeQty(depth, "len");
    const B = isQty(bottomWidth) ? bottomWidth : makeQty(bottomWidth, "len");
    if (L.kind !== "len" || D.kind !== "len" || B.kind !== "len"){
      throw new Error("trench_cy expects (len, len, len, slope)");
    }
    const m = isQty(slope) ? slope.value : slope;
    if (!Number.isFinite(m) || m < 0) throw new Error("trench_cy slope must be >= 0");

    const avgWidthFt = B.value + (m * D.value);
    const areaFt2 = avgWidthFt * D.value;
    const volFt3 = areaFt2 * L.value;
    return makeQty(volFt3, "vol");
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

  baseFns.pipe_wt_total = defFn("pipe_wt_total", -1, {
    args: [
      { label: "nps_in", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "schedule", kinds: ["scalar", "dim", "string"] },
      { label: "len_ft", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "wt" },
  }, (nps_in, schedule, len_ft, wastePct) => {
    const wt = baseFns.pipe_wt.impl(nps_in, schedule, len_ft);
    const factor = defaultPctFactor(wastePct, 0);
    return makeQty(wt.value * factor, "wt");
  });

  baseFns.hanger_count = defFn("hanger_count", -1, {
    args: [
      { label: "run_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "spacing", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (runLen, spacing, wastePct) => {
    const L = isQty(runLen) ? runLen : makeQty(runLen, "len");
    const S = defaultLen(spacing, 8);
    if (L.kind !== "len" || S.kind !== "len") throw new Error("hanger_count expects (len, len, waste_pct)");
    if (!(L.value >= 0)) throw new Error("hanger_count run_len must be >= 0");
    if (!(S.value > 0)) throw new Error("hanger_count spacing must be > 0");
    const base = baseFns.oc_count.impl(L, S).value;
    const factor = defaultPctFactor(wastePct, 0);
    return makeQty(Math.ceil(base * factor), "count");
  });

  baseFns.fitting_count = defFn("fitting_count", -1, {
    args: [
      { label: "run_len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "per_100ft", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "count" },
  }, (runLen, per100ft, wastePct) => {
    if (isMissing(per100ft)) throw new Error("fitting_count per_100ft is required");
    const L = isQty(runLen) ? runLen : makeQty(runLen, "len");
    if (L.kind !== "len") throw new Error("fitting_count expects run_len length");
    if (!(L.value >= 0)) throw new Error("fitting_count run_len must be >= 0");
    const p = isQty(per100ft) ? per100ft.value : per100ft;
    if (!Number.isFinite(p) || p < 0) throw new Error("fitting_count per_100ft must be >= 0");
    const factor = defaultPctFactor(wastePct, 0);
    const base = (L.value / 100) * p;
    return makeQty(Math.ceil(base * factor), "count");
  });

  baseFns.pipe_jacket_area = defFn("pipe_jacket_area", -1, {
    args: [
      { label: "len", kinds: ["scalar", "dim"], dim: "len" },
      { label: "od_in", kinds: ["scalar", "dim"], dim: "len" },
      { label: "waste_pct", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["dim"], dim: "area" },
  }, (len, od_in, wastePct) => {
    const L = isQty(len) ? len : makeQty(len, "len");
    if (L.kind !== "len") throw new Error("pipe_jacket_area expects len length");
    if (!(L.value >= 0)) throw new Error("pipe_jacket_area len must be >= 0");
    const d = lenFromInchesOrQty(od_in, "pipe_jacket_area od_in");
    if (!(d > 0)) throw new Error("pipe_jacket_area od_in must be > 0");
    const area = Math.PI * d * L.value;
    const factor = defaultPctFactor(wastePct, 0);
    return makeQty(area * factor, "area");
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
