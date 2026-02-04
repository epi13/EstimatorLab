export function attachMaterialBuiltins(baseFns, {
  defFn,
  defFnCtx,
  mul,
  div,
  isObjToken,
  parseObjectLiteral,
}){
  function isMaterial(value){
    return value && typeof value === "object" && value.__material;
  }

  baseFns.material = defFnCtx("material", 2, {
    args: [{ label: "name", kinds: ["string"] }, { label: "props", kinds: ["any"] }],
    returns: { kinds: ["material"] },
  }, (ctx, name, propsRaw) => {
    if (typeof name !== "string") throw new Error("material expects name as string");
    const matName = name.trim();
    if (!matName) throw new Error("material expects non-empty name");
    const entries = (() => {
      if (isObjToken(propsRaw)) return parseObjectLiteral(propsRaw.raw);
      if (typeof propsRaw === "string" && propsRaw.trim().startsWith("{")) return parseObjectLiteral(propsRaw);
      throw new Error("material expects props as object literal");
    })();
    const props = Object.create(null);
    for (const entry of entries){
      props[entry.key] = ctx.evalString(entry.expr, props);
    }
    return { __material: true, name: matName, props };
  });

  baseFns.density = defFn("density", 1, {
    args: [{ label: "mat", kinds: ["material"] }],
  }, (mat) => {
    if (!isMaterial(mat)) throw new Error("density expects a material");
    const d = mat.props?.density;
    if (d === undefined) throw new Error("material missing density");
    return d;
  });

  baseFns.weight = defFn("weight", 2, {
    args: [{ label: "qty", kinds: ["scalar", "dim"] }, { label: "mat", kinds: ["material"] }],
  }, (qty, mat) => {
    if (!isMaterial(mat)) throw new Error("weight expects (qty, material)");
    const d = baseFns.density.impl(mat);
    return mul(qty, d);
  });

  baseFns.vol_from_wt = defFn("vol_from_wt", 2, {
    args: [{ label: "wt", kinds: ["scalar", "dim"] }, { label: "mat", kinds: ["material"] }],
  }, (wt, mat) => {
    if (!isMaterial(mat)) throw new Error("vol_from_wt expects (wt, material)");
    const d = baseFns.density.impl(mat);
    return div(wt, d);
  });

  baseFns.cost = defFn("cost", 2, {
    args: [{ label: "qty", kinds: ["scalar", "dim"] }, { label: "mat", kinds: ["material"] }],
  }, (qty, mat) => {
    if (!isMaterial(mat)) throw new Error("cost expects (qty, material)");
    const unitCost = mat.props?.unit_cost;
    if (unitCost === undefined) throw new Error("material missing unit_cost");
    return mul(qty, unitCost);
  });
}
