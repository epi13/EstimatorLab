export function attachScenarioBuiltins(baseFns, {
  defFn,
  defFnCtx,
  isQty,
  makeQty,
  add,
  sub,
  div,
  isObjToken,
  parseObjectLiteral,
  buildAssy,
  fieldInfo,
}){
  function isScenario(value){
    return value && typeof value === "object" && value.__scenario;
  }

  function requireScenario(value, label){
    if (!isScenario(value)) throw new Error(`${label} expects a scenario`);
    return value;
  }

  function requireString(value, label){
    if (typeof value !== "string") throw new Error(`${label} expects a string`);
    const s = value.trim();
    if (!s) throw new Error(`${label} expects non-empty string`);
    return s;
  }

  function parseEntries(overrides){
    const entries = (() => {
      if (isObjToken(overrides)) return parseObjectLiteral(overrides.raw);
      if (typeof overrides === "string") return parseObjectLiteral(overrides);
      throw new Error("scenario overrides must be an object literal or string");
    })();
    return entries;
  }

  function resolveScenario(ctx, scenario){
    if (!ctx || typeof ctx.evalString !== "function") throw new Error("scenario requires evalString support");
    const sc = requireScenario(scenario, "scenario");
    const resolved = Object.create(null);
    for (const entry of sc.entries || []){
      resolved[entry.key] = ctx.evalString(entry.expr, resolved);
    }
    return resolved;
  }

  baseFns.scenario = defFn("scenario", 2, (name, overrides) => {
    const scName = typeof name === "string" ? name.trim() : String(name || "scenario");
    if (!scName) throw new Error("scenario expects non-empty name");
    const entries = parseEntries(overrides);
    return { __scenario: true, name: scName, entries };
  });

  baseFns.sc_eval = defFnCtx("sc_eval", 2, (ctx, scenario, expr) => {
    const sc = requireScenario(scenario, "sc_eval");
    if (typeof expr !== "string") throw new Error("sc_eval expects expression string");
    const resolved = resolveScenario(ctx, sc);
    return ctx.evalString(expr, resolved);
  });

  baseFns.sc_resolve = defFnCtx("sc_resolve", 1, (ctx, scenario) => {
    const sc = requireScenario(scenario, "sc_resolve");
    const resolved = resolveScenario(ctx, sc);
    const fields = Object.create(null);
    const keys = Object.keys(resolved).sort();
    for (const k of keys){
      fields[k] = fieldInfo(resolved[k]);
    }
    fields.name = fieldInfo(sc.name || "scenario");
    return buildAssy("scenario", fields);
  });

  baseFns.sc_get = defFnCtx("sc_get", 2, (ctx, scenario, key) => {
    const sc = requireScenario(scenario, "sc_get");
    const k = requireString(key, "sc_get");
    const resolved = resolveScenario(ctx, sc);
    if (!Object.prototype.hasOwnProperty.call(resolved, k)) throw new Error(`scenario missing key: ${k}`);
    return resolved[k];
  });

  baseFns.sc_merge = defFn("sc_merge", -1, (...scenarios) => {
    if (scenarios.length < 1) throw new Error("sc_merge expects at least one scenario");
    const merged = [];
    const seen = new Set();
    for (const sc0 of scenarios){
      const sc = requireScenario(sc0, "sc_merge");
      for (const entry of sc.entries || []){
        merged.push({ key: entry.key, expr: entry.expr });
        seen.add(entry.key);
      }
    }
    return { __scenario: true, name: "merge", entries: merged };
  });

  baseFns.sc_compare = defFnCtx("sc_compare", 4, (ctx, a, b, expr, label) => {
    const sa = requireScenario(a, "sc_compare");
    const sb = requireScenario(b, "sc_compare");
    if (typeof expr !== "string") throw new Error("sc_compare expects expression string");
    const nm = typeof label === "string" ? label.trim() : "compare";

    const ra = resolveScenario(ctx, sa);
    const rb = resolveScenario(ctx, sb);

    const va = ctx.evalString(expr, ra);
    const vb = ctx.evalString(expr, rb);

    const delta = sub(vb, va);
    let pct = null;
    try{
      pct = div(delta, va);
    }catch{
      pct = null;
    }

    return buildAssy(nm || "compare", {
      a: fieldInfo(va),
      b: fieldInfo(vb),
      delta: fieldInfo(delta),
      pct: fieldInfo(pct === null ? 0 : pct),
      name_a: fieldInfo(sa.name || "a"),
      name_b: fieldInfo(sb.name || "b"),
    });
  });
}
