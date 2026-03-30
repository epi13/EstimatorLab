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
    const effectsAllowed = options.effectsAllowed ?? options.allowedEffects;
    if (typeof effectsAllowed === "number") out.allowedEffects = effectsAllowed;
    if (typeof options.traceExpressions === "boolean") out.traceExpressions = options.traceExpressions;
    if (options.mode === "trace") out.traceExpressions = true;
    if (typeof options.expressionTraceSink === "function") out.expressionTraceSink = options.expressionTraceSink;
    if (Array.isArray(options.contextPath)) out.contextPath = options.contextPath.slice();
    if (Array.isArray(options.provenance)) out.provenance = options.provenance;
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

  function solveEquationNumeric(leftExpr, rightExpr, unknown){
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

  function solveEquationCandidates(leftExpr, rightExpr){
    const unknownList = lowering.analyzeEquationUnknowns(leftExpr, rightExpr, state.vars);
    if (unknownList.length !== 1){
      throw new Error("Equation must contain exactly one unknown identifier.");
    }
    const unknown = unknownList[0];
    const evaluateDiffAt = (x) => {
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
    const out = [];
    const pushCandidate = (candidate) => {
      if (!candidate || !Number.isFinite(candidate.value)) return;
      out.push(candidate);
    };

    const leftTrimmed = String(leftExpr ?? "").trim();
    const rightTrimmed = String(rightExpr ?? "").trim();
    if (!unknown.unitToken){
      if (leftTrimmed === unknown.name){
        const value = runExpressionWithContext(rightExpr, state.vars);
        if (typeof value === "number" && Number.isFinite(value)){
          pushCandidate({
            unknown,
            value,
            strategy: "isolate-symbol",
            transitionType: "equation-isolate",
            scoreDelta: 0.2,
            confidence: 0.96,
          });
        }
      }else if (rightTrimmed === unknown.name){
        const value = runExpressionWithContext(leftExpr, state.vars);
        if (typeof value === "number" && Number.isFinite(value)){
          pushCandidate({
            unknown,
            value,
            strategy: "isolate-symbol",
            transitionType: "equation-isolate",
            scoreDelta: 0.2,
            confidence: 0.96,
          });
        }
      }
    }

    try{
      const f0 = evaluateDiffAt(0);
      const f1 = evaluateDiffAt(1);
      if (Number.isFinite(f0) && Number.isFinite(f1)){
        const slope = f1 - f0;
        if (Math.abs(slope) > 1e-9){
          const value = -f0 / slope;
          const residual = evaluateDiffAt(value);
          if (Number.isFinite(value) && Number.isFinite(residual) && Math.abs(residual) <= 1e-6){
            pushCandidate({
              unknown,
              value,
              strategy: "rewrite-substitution",
              transitionType: "equation-rewrite",
              scoreDelta: 0.05,
              confidence: 0.84,
            });
          }
        }
      }
    }catch {
      // Fall through to numeric strategy.
    }

    try{
      const numeric = solveEquationNumeric(leftExpr, rightExpr, unknown);
      pushCandidate({
        ...numeric,
        strategy: "numeric-solve",
        transitionType: "equation-numeric",
        scoreDelta: 0.1,
        confidence: 0.9,
      });
    }catch (error){
      if (!out.length) throw error;
    }

    out.sort((a, b) => (b.scoreDelta + b.confidence) - (a.scoreDelta + a.confidence));
    return out;
  }

  function solveEquation(leftExpr, rightExpr){
    const candidates = solveEquationCandidates(leftExpr, rightExpr);
    if (!candidates.length){
      throw new Error("Could not solve equation.");
    }
    return candidates[0];
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

  function runExpressionCandidatesWithContext(expr, vars, options = null){
    if (expr && typeof expr === "object" && expr.kind){
      return [{
        value: runExpressionIRWithContext(expr, vars, options),
        transitionType: "expression-default",
        scoreDelta: 0,
        confidence: 1,
      }];
    }
    if (expr && typeof expr === "object" && expr.ir){
      return [{
        value: runExpressionIRWithContext(expr.ir, vars, options),
        transitionType: "expression-default",
        scoreDelta: 0,
        confidence: 1,
      }];
    }
    const analyses = typeof lowering.analyzeExpressionTransitions === "function"
      ? lowering.analyzeExpressionTransitions(expr, vars)
      : [lowering.analyzeExpression(expr, vars)];
    const opts = normalizeEvalOptions(options);
    return analyses.map((analyzed) => ({
      value: evalExpressionIR(analyzed.ir, {
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
      }),
      transitionType: analyzed.transitionType || "expression-default",
      scoreDelta: Number.isFinite(analyzed.scoreDelta) ? analyzed.scoreDelta : 0,
      confidence: Number.isFinite(analyzed.confidence) ? analyzed.confidence : 1,
      meta: analyzed.meta || {},
    }));
  }

  function parseExpressionIR(expr, vars = state.vars){
    return lowering.parseExpressionIR(expr, vars);
  }

  function runExpressionStringWithContext(expr, vars, options = null){
    const analyses = typeof lowering.analyzeExpressionTransitions === "function"
      ? lowering.analyzeExpressionTransitions(expr, vars)
      : [lowering.analyzeExpression(expr, vars)];
    const analyzed = analyses[0];
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
    runExpressionCandidatesWithContext,
    parseExpressionIR,
    runExpressionWithOverrides,
    solveEquation,
    solveEquationCandidates,
    evaluateAssemblyFields,
    createAssembly,
    formatAssemblySummary,
    formatValueDisplay,
    isAssembly,
  };
}
