export function createEvaluator({
  state,
  getFns,
  normalizeCompare,
  evalExpressionIR,
  makeQty,
  isQty,
  qtyToString,
  formatResult,
  usageTracker,
  cmdRunner,
  lowering,
}){
  function normalizeEvalOptions(options){
    if (!options || typeof options !== "object") return null;
    const out = Object.create(null);
    if (typeof options.allowedEffects === "number") out.allowedEffects = options.allowedEffects;
    if (typeof options.traceExpressions === "boolean") out.traceExpressions = options.traceExpressions;
    if (typeof options.expressionTraceSink === "function") out.expressionTraceSink = options.expressionTraceSink;
    return out;
  }

  function getUsageHooks(){
    if (!usageTracker) return {};
    return usageTracker.getHooks();
  }

  function diffValues(left, right){
    const [lv, rv] = normalizeCompare(left, right);
    return lv - rv;
  }

  function solveEquation(leftExpr, rightExpr){
    const unknownList = lowering.analyzeEquationUnknowns(leftExpr, rightExpr, state.vars);
    if (unknownList.length !== 1){
      throw new Error("Equation must contain exactly one unknown identifier.");
    }
    const unknown = unknownList[0];
    const evaluateDiff = (x) => {
      const vars = Object.assign(Object.create(null), state.vars);
      let overrides = null;
      if (unknown.unitToken){
        overrides = {
          [unknown.name]: makeQty(x * unknown.toBase, unknown.kind),
        };
      }else{
        vars[unknown.name] = x;
      }
      const left = runExpressionWithOverrides(leftExpr, vars, overrides, null, Object.create(null));
      const right = runExpressionWithOverrides(rightExpr, vars, overrides, null, Object.create(null));
      return diffValues(left, right);
    };

    const tol = 1e-9;
    let a = 0;
    let fa = evaluateDiff(a);
    if (Math.abs(fa) <= tol) return { unknown, value: a };
    let b = 1;
    let fb = evaluateDiff(b);
    if (Math.abs(fb) <= tol) return { unknown, value: b };

    let step = 1;
    let bracketed = fa * fb < 0;
    for (let i = 0; i < 30 && !bracketed; i++){
      step *= 2;
      a -= step;
      b += step;
      fa = evaluateDiff(a);
      fb = evaluateDiff(b);
      if (Math.abs(fa) <= tol) return { unknown, value: a };
      if (Math.abs(fb) <= tol) return { unknown, value: b };
      bracketed = fa * fb < 0;
    }

    let x0 = a;
    let x1 = b;
    let f0 = fa;
    let f1 = fb;
    for (let i = 0; i < 60; i++){
      if (Math.abs(f1 - f0) < 1e-12) break;
      const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
      if (!Number.isFinite(x2)) break;
      const f2 = evaluateDiff(x2);
      if (Math.abs(f2) <= tol) return { unknown, value: x2 };
      x0 = x1;
      f0 = f1;
      x1 = x2;
      f1 = f2;
      if (bracketed && f0 * f1 < 0){
        a = x0;
        b = x1;
        fa = f0;
        fb = f1;
      }
    }

    if (bracketed){
      let left = a;
      let right = b;
      let fl = fa;
      for (let i = 0; i < 80; i++){
        const mid = (left + right) / 2;
        const fm = evaluateDiff(mid);
        if (Math.abs(fm) <= tol) return { unknown, value: mid };
        if (fl * fm < 0){
          right = mid;
        }else{
          left = mid;
          fl = fm;
        }
      }
      return { unknown, value: (left + right) / 2 };
    }

    throw new Error("Could not solve equation (no convergence).");
  }

  function runExpressionWithContext(expr, vars, options = null){
    if (expr && typeof expr === "object" && expr.kind){
      return runExpressionIRWithContext(expr, vars, options);
    }
    if (expr && typeof expr === "object" && expr.ir){
      return runExpressionIRWithContext(expr.ir, vars, options);
    }
    return runExpressionStringWithContext(expr, vars, options);
  }

  function parseExpressionIR(expr, vars = state.vars){
    return lowering.parseExpressionIR(expr, vars);
  }

  function runExpressionStringWithContext(expr, vars, options = null){
    const analyzed = lowering.analyzeExpression(expr, vars);
    const opts = normalizeEvalOptions(options);
    const result = evalExpressionIR(analyzed.ir, {
      vars,
      fns: getFns(),
      aliases: analyzed.aliases,
      allowedEffects: opts?.allowedEffects,
      evalExpr: (innerIr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithContext(innerIr, merged, opts);
      },
      evalString: (innerExpr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithContext(innerExpr, merged, opts);
      },
      cmdRunner,
      ...getUsageHooks(),
    });
    if (opts?.traceExpressions && typeof opts.expressionTraceSink === "function"){
      opts.expressionTraceSink({
        expr: analyzed.source,
        tokenCount: analyzed.tokens.length,
        irKind: analyzed.ir.kind,
        result,
      });
    }
    return result;
  }

  function runExpressionIRWithContext(ir, vars, options = null){
    const analyzed = lowering.analyzeExpressionIR(ir, vars);
    const opts = normalizeEvalOptions(options);
    const result = evalExpressionIR(ir, {
      vars,
      fns: getFns(),
      aliases: analyzed.aliases,
      allowedEffects: opts?.allowedEffects,
      evalExpr: (innerIr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithContext(innerIr, merged, opts);
      },
      evalString: (innerExpr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithContext(innerExpr, merged, opts);
      },
      cmdRunner,
      ...getUsageHooks(),
    });
    if (opts?.traceExpressions && typeof opts.expressionTraceSink === "function"){
      opts.expressionTraceSink({
        expr: "<ir>",
        tokenCount: analyzed.tokens.length,
        irKind: ir.kind,
        result,
      });
    }
    return result;
  }

  function runExpression(expr){
    return runExpressionWithContext(expr, state.vars);
  }

  function runExpressionWithOverrides(expr, vars, unitOverrides, aliasMap = null, options = null){
    if (expr && typeof expr === "object" && expr.kind){
      return runExpressionIRWithOverrides(expr, vars, unitOverrides, aliasMap, options);
    }
    if (expr && typeof expr === "object" && expr.ir){
      return runExpressionIRWithOverrides(expr.ir, vars, unitOverrides, aliasMap, options);
    }
    return runExpressionStringWithOverrides(expr, vars, unitOverrides, aliasMap, options);
  }

  function runExpressionStringWithOverrides(expr, vars, unitOverrides, aliasMap = null, options = null){
    const analyzed = lowering.analyzeExpression(expr, vars);
    const opts = normalizeEvalOptions(options);
    return evalExpressionIR(analyzed.ir, {
      vars,
      fns: getFns(),
      aliases: aliasMap || analyzed.aliases,
      unitOverrides,
      allowedEffects: opts?.allowedEffects,
      evalExpr: (innerIr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithOverrides(innerIr, merged, unitOverrides, null, opts);
      },
      evalString: (innerExpr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithOverrides(innerExpr, merged, unitOverrides, null, opts);
      },
      cmdRunner,
      ...getUsageHooks(),
    });
  }

  function runExpressionIRWithOverrides(ir, vars, unitOverrides, aliasMap = null, options = null){
    const analyzed = lowering.analyzeExpressionIR(ir, vars);
    const opts = normalizeEvalOptions(options);
    return evalExpressionIR(ir, {
      vars,
      fns: getFns(),
      aliases: aliasMap || analyzed.aliases,
      unitOverrides,
      allowedEffects: opts?.allowedEffects,
      evalExpr: (innerIr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithOverrides(innerIr, merged, unitOverrides, null, opts);
      },
      evalString: (innerExpr, overrides = null) => {
        const merged = overrides ? Object.assign(Object.create(null), vars, overrides) : vars;
        return runExpressionWithOverrides(innerExpr, merged, unitOverrides, null, opts);
      },
      cmdRunner,
      ...getUsageHooks(),
    });
  }

  function isAssembly(value){
    return value && typeof value === "object" && value.__assy;
  }

  function evaluateAssemblyFields(fields, vars = state.vars, options = null){
    const out = Object.create(null);
    const input = fields || {};
    for (const [key, entry] of Object.entries(input)){
      if (entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "value") && !Object.prototype.hasOwnProperty.call(entry, "expr")){
        out[key] = entry;
        continue;
      }
      const note = entry?.note || "";
      if (entry?.exprIr || entry?.expr){
        const expr = entry.exprIr || entry.expr;
        out[key] = {
          value: runExpressionWithContext(expr, vars, options),
          note,
          raw: entry.raw,
        };
      }else{
        out[key] = {
          value: entry?.raw,
          note,
          raw: entry?.raw,
        };
      }
    }
    return out;
  }

  function createAssembly(name, fields, vars = state.vars, options = null){
    return {
      __assy: true,
      name,
      fields: evaluateAssemblyFields(fields, vars, options),
    };
  }

  function formatNestedValue(value, depth = 0){
    if (isQty(value)) return qtyToString(value);
    if (Array.isArray(value)){
      if (!value.length) return "[]";
      if (depth >= 2) return `[${value.length} items]`;
      return `[${value.map((item) => formatNestedValue(item, depth + 1)).join(", ")}]`;
    }
    if (value && typeof value === "object"){
      if (isAssembly(value)) return formatAssemblySummary(value);
      const entries = Object.entries(value);
      if (!entries.length) return "{}";
      if (depth >= 2) return "{…}";
      const rendered = entries.map(([key, entryValue]) => `${key}: ${formatNestedValue(entryValue, depth + 1)}`);
      return `{ ${rendered.join("; ")} }`;
    }
    return String(value);
  }

  function formatAssemblySummary(assy){
    const fields = assy.fields || {};
    const entries = Object.entries(fields).map(([key, info]) => {
      const value = info?.value;
      const note = info?.note;
      let rendered = formatNestedValue(value);
      if (note) rendered += ` ${note}`;
      return `${key} = ${rendered}`;
    });
    const inner = entries.join("; ");
    return `assy ${assy.name}${inner ? ` { ${inner} }` : " {}"}`;
  }

  function formatValueDisplay(value){
    if (isAssembly(value)) return { main: formatAssemblySummary(value), extra: "" };
    return formatResult(value);
  }

  return {
    runExpression,
    runExpressionWithContext,
    parseExpressionIR,
    runExpressionWithOverrides,
    solveEquation,
    evaluateAssemblyFields,
    createAssembly,
    formatAssemblySummary,
    formatValueDisplay,
    isAssembly,
  };
}
