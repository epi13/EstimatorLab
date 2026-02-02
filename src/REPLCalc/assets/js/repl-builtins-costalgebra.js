export function attachCostAlgebraBuiltins(baseFns, {
  defFn,
  isQty,
  makeQty,
  UNITS_INTERNAL,
}){
  function requireQty(value, label){
    if (!isQty(value)) throw new Error(`${label} expects a quantity`);
    return value;
  }

  function isCostKind(kind){
    const dim = UNITS_INTERNAL.dimFromKind(kind);
    return Boolean(dim && dim.cur === 1);
  }

  function requireCostQty(value, label){
    const q = requireQty(value, label);
    if (!isCostKind(q.kind)) throw new Error(`${label} expects a currency quantity`);
    return q;
  }

  function requireString(value, label){
    if (typeof value !== "string") throw new Error(`${label} expects a string`);
    const s = value.trim();
    if (!s) throw new Error(`${label} expects non-empty string`);
    return s;
  }

  function cloneBreakdown(node){
    if (!node || typeof node !== "object") return null;
    if (node.type === "leaf") return { type: "leaf", value: node.value, label: node.label || "" };
    if (node.type === "scale") return { type: "scale", factor: node.factor, inner: cloneBreakdown(node.inner) };
    if (node.type === "op") return { type: "op", op: node.op, a: cloneBreakdown(node.a), b: cloneBreakdown(node.b) };
    return null;
  }

  function sumBreakdown(node){
    if (!node || typeof node !== "object") return 0;
    if (node.type === "leaf") return Number(node.value) || 0;
    if (node.type === "scale") return (Number(node.factor) || 0) * sumBreakdown(node.inner);
    if (node.type === "op"){
      if (node.op === "+") return sumBreakdown(node.a) + sumBreakdown(node.b);
      if (node.op === "-") return sumBreakdown(node.a) - sumBreakdown(node.b);
      return 0;
    }
    return 0;
  }

  function flatten(node, out, mult){
    if (!node || typeof node !== "object") return;
    if (node.type === "leaf"){
      const label = node.label || "";
      out[label] = (out[label] || 0) + (Number(node.value) || 0) * mult;
      return;
    }
    if (node.type === "scale"){
      flatten(node.inner, out, mult * (Number(node.factor) || 0));
      return;
    }
    if (node.type === "op"){
      if (node.op === "+"){
        flatten(node.a, out, mult);
        flatten(node.b, out, mult);
      }else if (node.op === "-"){
        flatten(node.a, out, mult);
        flatten(node.b, out, -mult);
      }
    }
  }

  baseFns.is_cost = defFn("is_cost", 1, (x) => {
    if (!isQty(x)) return 0;
    return isCostKind(x.kind) ? 1 : 0;
  });

  baseFns.cost_leaf = defFn("cost_leaf", 2, (label, amount) => {
    const name = requireString(label, "cost_leaf");
    const n = Number(isQty(amount) ? amount.value : amount);
    if (!Number.isFinite(n)) throw new Error("cost_leaf expects numeric amount");
    const q = makeQty(n, "cur");
    q.__cost = true;
    q.breakdown = { type: "leaf", value: n, label: name };
    return q;
  });

  baseFns.cost_label = defFn("cost_label", 2, (cost, label) => {
    const c = requireCostQty(cost, "cost_label");
    const name = requireString(label, "cost_label");
    const node = c.breakdown || { type: "leaf", value: c.value, label: "" };
    const next = cloneBreakdown(node) || { type: "leaf", value: c.value, label: "" };
    if (next.type === "leaf") next.label = name;
    const out = makeQty(c.value, c.kind);
    out.__cost = true;
    out.breakdown = next;
    return out;
  });

  baseFns.cost_total = defFn("cost_total", 1, (cost) => {
    const c = requireCostQty(cost, "cost_total");
    return c.value;
  });

  baseFns.cost_breakdown = defFn("cost_breakdown", 1, (cost) => {
    const c = requireCostQty(cost, "cost_breakdown");
    const node = c.breakdown || { type: "leaf", value: c.value, label: "" };
    const out = Object.create(null);
    flatten(node, out, 1);
    const fields = Object.create(null);
    const entries = Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
    for (const [k, v] of entries){
      const key = k || "unlabeled";
      fields[key] = { value: makeQty(v, "cur"), note: "", raw: "" };
    }
    fields.total = { value: makeQty(sumBreakdown(node), "cur"), note: "", raw: "" };
    return { __assy: true, name: "cost", fields, __cost_breakdown: true };
  });
}
