export function attachUnitAlgebraBuiltins(baseFns, {
  defFn,
  isQty,
  makeQty,
  qtyToString,
  normalizeCompare,
  UNITS_INTERNAL,
}){
  function requireQty(value, label){
    if (!isQty(value)) throw new Error(`${label} expects a quantity`);
    return value;
  }

  function requireKind(value, label){
    if (typeof value !== "string") throw new Error(`${label} expects a kind string`);
    const k = value.trim();
    if (!k) throw new Error(`${label} expects non-empty kind string`);
    return k;
  }

  function dimsOfKind(kind){
    return UNITS_INTERNAL.dimFromKind(kind);
  }

  function dimsKeyOfKind(kind){
    return UNITS_INTERNAL.dimKey(dimsOfKind(kind));
  }

  function isPlainObject(value){
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return false;
    if (value.__assy || value.__graph || value.__scenario || value.__dist || value.__vec || value.__mat || value.__range) return false;
    if (value.__material || value.__pt || value.__poly) return false;
    if (isQty(value)) return false;
    return true;
  }

  function dimAssyFromDim(dim){
    const fields = Object.create(null);
    if (Array.isArray(dim)){
      const labels = ["len", "time", "wt", "cur", "count", "angle", "force", "layer"];
      for (let i = 0; i < dim.length && i < labels.length; i++){
        const v = dim[i];
        if (!v) continue;
        fields[labels[i]] = { value: v, note: "", raw: "" };
      }
    }else{
      const entries = Object.entries(dim).filter(([, v]) => v !== 0);
      entries.sort(([a], [b]) => a.localeCompare(b));
      for (const [k, v] of entries){
        fields[k] = { value: v, note: "", raw: "" };
      }
    }
    return { __assy: true, name: "dim", fields, __dim: true };
  }

  baseFns.kind = defFn("kind", 1, {
    args: [{ label: "x", kinds: ["any"] }],
    returns: { kinds: ["string"] },
  }, (x) => {
    if (isQty(x)) return x.kind;
    if (x && typeof x === "object"){
      if (x.__assy) return "assy";
      if (x.__graph) return "graph";
      if (x.__scenario) return "scenario";
      if (x.__dist) return "dist";
      if (x.__rate) return "rate";
      if (x.__vec) return "vec";
      if (x.__mat) return "mat";
      if (x.__range) return "range";
      if (x.__gfx) return "gfx";
      if (x.__map) return "map";
      if (x.__project) return "project";
      if (x.__material) return "material";
      if (x.__pt) return "pt";
      if (x.__poly) return "poly";
      if (isPlainObject(x)) return "obj";
    }
    return typeof x;
  });

  baseFns.dim = defFn("dim", 1, {
    args: [{ label: "x", kinds: ["dim"] }],
    returns: { kinds: ["assy"] },
  }, (x) => {
    const q = requireQty(x, "dim");
    return dimAssyFromDim(dimsOfKind(q.kind));
  });

  baseFns.dimkey = defFn("dimkey", 1, {
    args: [{ label: "x", kinds: ["dim", "string"] }],
    returns: { kinds: ["string"] },
  }, (x) => {
    if (isQty(x)) return dimsKeyOfKind(x.kind);
    const kind = requireKind(x, "dimkey");
    return dimsKeyOfKind(kind);
  });

  baseFns.is_dim = defFn("is_dim", 2, {
    args: [
      { label: "x", kinds: ["dim"] },
      { label: "kind", kinds: ["dim", "string"] },
    ],
    returns: { kinds: ["scalar"] },
  }, (x, kindOrDim) => {
    const q = requireQty(x, "is_dim");
    if (isQty(kindOrDim)) return dimsKeyOfKind(q.kind) === dimsKeyOfKind(kindOrDim.kind) ? 1 : 0;
    const targetKind = requireKind(kindOrDim, "is_dim");
    return dimsKeyOfKind(q.kind) === dimsKeyOfKind(targetKind) ? 1 : 0;
  });

  baseFns.assert_dim = defFn("assert_dim", 2, {
    args: [
      { label: "x", kinds: ["dim"] },
      { label: "kind", kinds: ["dim", "string"] },
    ],
    returns: { kinds: ["dim"] },
  }, (x, kindOrDim) => {
    const q = requireQty(x, "assert_dim");
    const targetKind = isQty(kindOrDim) ? kindOrDim.kind : requireKind(kindOrDim, "assert_dim");
    if (dimsKeyOfKind(q.kind) !== dimsKeyOfKind(targetKind)){
      throw new Error(`Unit mismatch: expected ${targetKind}, got ${q.kind}`);
    }
    return x;
  });

  baseFns.uqty = defFn("uqty", 2, {
    args: [
      { label: "value", kinds: ["scalar", "dim", "string"] },
      { label: "kind", kinds: ["string", "dim"] },
    ],
    returns: { kinds: ["dim"] },
  }, (value, kindOrUnit) => {
    const v = Number(isQty(value) ? value.value : value);
    if (!Number.isFinite(v)) throw new Error("uqty expects a numeric value");

    if (typeof kindOrUnit === "string"){
      const k = kindOrUnit.trim();
      if (!k) throw new Error("uqty expects a kind string");
      return makeQty(v, k);
    }
    if (isQty(kindOrUnit)){
      return makeQty(v * kindOrUnit.value, kindOrUnit.kind);
    }
    throw new Error("uqty expects (value, kindString) or (value, unitToken)");
  });

  baseFns.simplify = defFn("simplify", 1, {
    args: [{ label: "x", kinds: ["dim"] }],
    returns: { kinds: ["dim"] },
  }, (x) => {
    const q = requireQty(x, "simplify");
    const simple = UNITS_INTERNAL.kindFromDim(dimsOfKind(q.kind));
    if (simple === q.kind) return q;
    return makeQty(q.value, simple);
  });

  baseFns.compat = defFn("compat", 2, {
    args: [{ label: "a", kinds: ["dim"] }, { label: "b", kinds: ["dim"] }],
    returns: { kinds: ["scalar"] },
  }, (a, b) => {
    const qa = requireQty(a, "compat");
    const qb = requireQty(b, "compat");
    return dimsKeyOfKind(qa.kind) === dimsKeyOfKind(qb.kind) ? 1 : 0;
  });

  baseFns.uerr = defFn("uerr", 2, {
    args: [{ label: "a", kinds: ["dim"] }, { label: "b", kinds: ["dim"] }],
    returns: { kinds: ["string"] },
  }, (a, b) => {
    const qa = requireQty(a, "uerr");
    const qb = requireQty(b, "uerr");
    return dimsKeyOfKind(qa.kind) === dimsKeyOfKind(qb.kind) ? "" : `Unit mismatch: ${qa.kind} vs ${qb.kind}`;
  });

  baseFns.uadd = defFn("uadd", 2, {
    args: [{ label: "a", kinds: ["dim"] }, { label: "b", kinds: ["dim"] }],
    returns: { kinds: ["dim"] },
  }, (a, b) => {
    const qa = requireQty(a, "uadd");
    const qb = requireQty(b, "uadd");
    if (dimsKeyOfKind(qa.kind) !== dimsKeyOfKind(qb.kind)){
      throw new Error(`Unit mismatch: ${qa.kind} + ${qb.kind}`);
    }
    return makeQty(qa.value + qb.value, UNITS_INTERNAL.kindFromDim(dimsOfKind(qa.kind)));
  });

  baseFns.usub = defFn("usub", 2, {
    args: [{ label: "a", kinds: ["dim"] }, { label: "b", kinds: ["dim"] }],
    returns: { kinds: ["dim"] },
  }, (a, b) => {
    const qa = requireQty(a, "usub");
    const qb = requireQty(b, "usub");
    if (dimsKeyOfKind(qa.kind) !== dimsKeyOfKind(qb.kind)){
      throw new Error(`Unit mismatch: ${qa.kind} - ${qb.kind}`);
    }
    return makeQty(qa.value - qb.value, UNITS_INTERNAL.kindFromDim(dimsOfKind(qa.kind)));
  });

  baseFns.umix = defFn("umix", 3, {
    args: [
      { label: "a", kinds: ["dim"] },
      { label: "b", kinds: ["dim"] },
      { label: "w", kinds: ["scalar"] },
    ],
    returns: { kinds: ["dim"] },
  }, (a, b, w) => {
    const qa = requireQty(a, "umix");
    const qb = requireQty(b, "umix");
    const ww = Number(isQty(w) ? w.value : w);
    if (!Number.isFinite(ww)) throw new Error("umix expects numeric weight");
    if (dimsKeyOfKind(qa.kind) !== dimsKeyOfKind(qb.kind)) throw new Error(`Unit mismatch: ${qa.kind} vs ${qb.kind}`);
    const k = UNITS_INTERNAL.kindFromDim(dimsOfKind(qa.kind));
    return makeQty(qa.value * (1 - ww) + qb.value * ww, k);
  });

  baseFns.udiv = defFn("udiv", 2, {
    args: [{ label: "a", kinds: ["dim"] }, { label: "b", kinds: ["dim"] }],
    returns: { kinds: ["dim"] },
  }, (a, b) => {
    const qa = requireQty(a, "udiv");
    const qb = requireQty(b, "udiv");
    const dim = UNITS_INTERNAL.combineDims(dimsOfKind(qa.kind), dimsOfKind(qb.kind), -1);
    return makeQty(qa.value / qb.value, UNITS_INTERNAL.kindFromDim(dim));
  });

  baseFns.umul = defFn("umul", 2, {
    args: [{ label: "a", kinds: ["dim"] }, { label: "b", kinds: ["dim"] }],
    returns: { kinds: ["dim"] },
  }, (a, b) => {
    const qa = requireQty(a, "umul");
    const qb = requireQty(b, "umul");
    const dim = UNITS_INTERNAL.combineDims(dimsOfKind(qa.kind), dimsOfKind(qb.kind), 1);
    return makeQty(qa.value * qb.value, UNITS_INTERNAL.kindFromDim(dim));
  });

  baseFns.ustr = defFn("ustr", 1, {
    args: [{ label: "x", kinds: ["dim"] }],
    returns: { kinds: ["string"] },
  }, (x) => {
    const q = requireQty(x, "ustr");
    return qtyToString(q);
  });

  baseFns.ucmp = defFn("ucmp", 2, {
    args: [{ label: "a", kinds: ["dim"] }, { label: "b", kinds: ["dim"] }],
    returns: { kinds: ["scalar"] },
  }, (a, b) => {
    const qa = requireQty(a, "ucmp");
    const qb = requireQty(b, "ucmp");
    const [av, bv] = normalizeCompare(qa, qb);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}
