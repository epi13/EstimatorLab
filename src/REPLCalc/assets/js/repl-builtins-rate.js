export function attachRateBuiltins(baseFns, {
  defFn,
  defFnCtx,
  isQty,
  makeQty,
  add,
  sub,
  div,
  mul,
  isObjToken,
  parseObjectLiteral,
  buildAssy,
  fieldInfo,
}){
  function isRate(value){
    return value && typeof value === "object" && value.__rate;
  }

  function requireRate(value, label){
    if (!isRate(value)) throw new Error(`${label} expects a rate`);
    return value;
  }

  function requireScalar(value, label){
    if (isQty(value)){
      if (value.kind !== "scalar") throw new Error(`${label} expects a dimensionless scalar value`);
      return value.value;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${label} expects a numeric scalar`);
    return n;
  }

  function asTimeScalar(t, label){
    if (isQty(t)){
      if (t.kind !== "time") throw new Error(`${label} expects time quantity`);
      return t.value;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error(`${label} expects numeric time`);
    return n;
  }

  baseFns.rate = defFnCtx("rate", -1, {
    args: [
      { label: "name", kinds: ["string"] },
      { label: "base", kinds: ["any"] },
      { label: "factors", kinds: ["any"] },
    ],
    returns: { kinds: ["rate"] },
  }, (ctx, ...args) => {
    if (args.length < 2) throw new Error("rate expects (name, base[, {factors}])");
    const name = args[0];
    const base = args[1];
    const factorsRaw = args[2] ?? null;
    if (typeof name !== "string") throw new Error("rate name must be a string");
    const rateName = name.trim();
    if (!rateName) throw new Error("rate expects non-empty name");

    const factors = Object.create(null);
    if (factorsRaw){
      const entries = (() => {
        if (isObjToken(factorsRaw)) return parseObjectLiteral(factorsRaw.raw);
        if (typeof factorsRaw === "string" && factorsRaw.trim().startsWith("{")) return parseObjectLiteral(factorsRaw);
        return null;
      })();
      if (entries){
        for (const entry of entries){
          factors[entry.key] = ctx.evalString(entry.expr, factors);
        }
      }
    }

    let eff = base;
    for (const k of Object.keys(factors)){
      eff = mul(eff, factors[k]);
    }

    return {
      __rate: true,
      name: rateName,
      base,
      factors,
      eff,
    };
  });

  baseFns.is_rate = defFn("is_rate", 1, {
    args: [{ label: "value", kinds: ["any"] }],
    returns: { kinds: ["scalar"] },
  }, (value) => isRate(value) ? 1 : 0);
  baseFns.rate_name = defFn("rate_name", 1, {
    args: [{ label: "r", kinds: ["rate"] }],
    returns: { kinds: ["string"] },
  }, (r) => requireRate(r, "rate_name").name);
  baseFns.rate_base = defFn("rate_base", 1, {
    args: [{ label: "r", kinds: ["rate"] }],
  }, (r) => requireRate(r, "rate_base").base);

  baseFns.rate_factors = defFn("rate_factors", 1, {
    args: [{ label: "r", kinds: ["rate"] }],
    returns: { kinds: ["assy"] },
  }, (r) => {
    const rate = requireRate(r, "rate_factors");
    const fields = Object.create(null);
    const keys = Object.keys(rate.factors || {}).sort();
    for (const k of keys){
      fields[k] = fieldInfo(rate.factors[k]);
    }
    return buildAssy("factors", fields);
  });

  baseFns.rate_factor = defFn("rate_factor", 2, {
    args: [{ label: "r", kinds: ["rate"] }, { label: "key", kinds: ["string"] }],
  }, (r, key) => {
    const rate = requireRate(r, "rate_factor");
    if (typeof key !== "string") throw new Error("rate_factor expects key as string");
    const k = key.trim();
    if (!k) throw new Error("rate_factor expects non-empty key");
    return Object.prototype.hasOwnProperty.call(rate.factors || {}, k) ? rate.factors[k] : 1;
  });

  baseFns.rate_with = defFnCtx("rate_with", 2, {
    args: [{ label: "r", kinds: ["rate"] }, { label: "overrides", kinds: ["any"] }],
    returns: { kinds: ["rate"] },
  }, (ctx, r, overridesRaw) => {
    const rate = requireRate(r, "rate_with");
    const factors = Object.assign(Object.create(null), rate.factors || Object.create(null));
    if (overridesRaw){
      const entries = (() => {
        if (isObjToken(overridesRaw)) return parseObjectLiteral(overridesRaw.raw);
        if (typeof overridesRaw === "string" && overridesRaw.trim().startsWith("{")) return parseObjectLiteral(overridesRaw);
        return null;
      })();
      if (entries){
        for (const entry of entries){
          factors[entry.key] = ctx.evalString(entry.expr, factors);
        }
      }
    }

    let eff = rate.base;
    for (const k of Object.keys(factors)) eff = mul(eff, factors[k]);

    return {
      __rate: true,
      name: rate.name,
      base: rate.base,
      factors,
      eff,
    };
  });

  baseFns.rate_eff = defFn("rate_eff", 1, {
    args: [{ label: "r", kinds: ["rate"] }],
  }, (r) => {
    if (!isRate(r)) throw new Error("rate_eff expects a rate");
    return r.eff;
  });

  baseFns.prod = defFn("prod", 2, {
    args: [{ label: "rate", kinds: ["rate"] }, { label: "duration", kinds: ["scalar", "dim"] }],
  }, (rate, duration) => {
    if (!isRate(rate)) throw new Error("prod expects (rate, duration)");
    return mul(rate.eff, duration);
  });

  baseFns.time_for = defFn("time_for", 2, {
    args: [{ label: "qty", kinds: ["scalar", "dim"] }, { label: "rate", kinds: ["rate"] }],
  }, (qty, rate) => {
    const r = requireRate(rate, "time_for");
    return div(qty, r.eff);
  });

  baseFns.rate_inv = defFn("rate_inv", 1, {
    args: [{ label: "value", kinds: ["any"] }],
  }, (value) => {
    if (isRate(value)){
      const r = value;
      return {
        __rate: true,
        name: `inv(${r.name})`,
        base: div(1, r.base),
        factors: Object.assign(Object.create(null), r.factors || Object.create(null)),
        eff: div(1, r.eff),
      };
    }
    return div(1, value);
  });

  baseFns.crew = defFn("crew", 2, {
    args: [
      { label: "count", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "value", kinds: ["any"] },
    ],
  }, (count, value) => {
    const n = requireScalar(count, "crew");
    if (isRate(value)){
      const r = value;
      return {
        __rate: true,
        name: r.name,
        base: r.base,
        factors: Object.assign(Object.create(null), r.factors || Object.create(null), { crew: n }),
        eff: mul(r.eff, n),
      };
    }
    return mul(value, n);
  });

  baseFns.learn = defFn("learn", 3, {
    args: [
      { label: "value", kinds: ["any"] },
      { label: "n", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "exponent", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
  }, (value, n, exponent) => {
    const nv = requireScalar(n, "learn");
    const ev = requireScalar(exponent, "learn");
    const factor = Math.pow(nv, ev);
    if (isRate(value)){
      const r = value;
      return {
        __rate: true,
        name: r.name,
        base: r.base,
        factors: Object.assign(Object.create(null), r.factors || Object.create(null), { learn_n: nv, learn_exp: ev }),
        eff: mul(r.eff, factor),
      };
    }
    return mul(value, factor);
  });

  baseFns.tsim = defFnCtx("tsim", 3, {
    args: [
      { label: "duration", kinds: ["scalar", "dim"], dim: "time" },
      { label: "dt", kinds: ["scalar", "dim"], dim: "time" },
      { label: "expr", kinds: ["string"] },
    ],
    returns: { kinds: ["assy"] },
  }, (ctx, duration, dt, expr) => {
    if (!ctx || typeof ctx.evalString !== "function") throw new Error("tsim requires evalString support");
    if (typeof expr !== "string") throw new Error("tsim expects expression string");

    const durS = asTimeScalar(duration, "tsim duration");
    const dtS = asTimeScalar(dt, "tsim dt");
    if (dtS <= 0) throw new Error("tsim dt must be > 0");

    const steps = Math.max(1, Math.floor(durS / dtS + 1e-9));
    let t = 0;
    let acc = null;
    let last = 0;
    for (let i = 0; i < steps; i++){
      const v = ctx.evalString(expr, {
        t: makeQty(t, "time"),
        dt: makeQty(dtS, "time"),
        i,
      });
      last = v;
      acc = acc === null ? v : add(acc, v);
      t += dtS;
    }

    return buildAssy("tsim", {
      sum: fieldInfo(acc === null ? 0 : acc),
      steps: fieldInfo(steps),
      last: fieldInfo(last),
    });
  });
}
