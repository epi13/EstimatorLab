export function createExecutor(deps){
  const {
    state,
    evaluator,
    runtime,
    splitStatements,
    isTruthy,
    normalizeCompare,
    isQty,
    makeQty,
    maxLoopIterations,
  } = deps;

  const previewStmt = (stmt) => {
    const trimmed = String(stmt || "").trim();
    if (!trimmed) return "";
    const maxLen = 220;
    return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
  };

  const executeExpr = ({ parsed, expressionOptions }) => evaluator.runExpressionWithContext(parsed.expr, state.vars, expressionOptions);

  const executeAssignment = ({ parsed, expressionOptions }) => {
    const value = evaluator.runExpressionWithContext(parsed.expr, state.vars, expressionOptions);
    state.vars[parsed.name] = value;
    return value;
  };

  const executeEquation = ({ parsed }) => {
    const solved = evaluator.solveEquation(parsed.left, parsed.right);
    if (!solved.unknown.unitToken){
      state.vars[solved.unknown.name] = solved.value;
    }
    return solved.value;
  };

  const executeDefinition = ({ parsed }) => {
    runtime.defineUserFn(parsed.name, parsed.params, parsed.expr);
    return null;
  };

  const executeAssembly = ({ parsed }) => {
    const assembly = evaluator.createAssembly(parsed.name, parsed.fields);
    state.vars[parsed.name] = assembly;
    return null;
  };

  const executeCommand = ({ options, parsed }) => {
    if (!options.allowCommands){
      throw new Error(options.commandErrorMessage || "Commands are not supported here.");
    }
    return evaluator.runExpressionWithContext(`cmd(${JSON.stringify(parsed.cmd)}, ${JSON.stringify(parsed.arg || "")})`, state.vars, options.expressionOptions);
  };

  const executeIf = ({ parsed, options, context, stmtIdx }) => {
    const cond = evaluator.runExpressionWithContext(parsed.condition, state.vars, options.expressionOptions);
    const childCtx = context.concat([`if#${stmtIdx + 1}`]);
    if (isTruthy(cond)){
      return executeSource(parsed.thenBody, { ...options, context: childCtx });
    }
    if (parsed.elseBody){
      return executeSource(parsed.elseBody, { ...options, context: childCtx });
    }
    return null;
  };

  const executeFor = ({ parsed, options, context, stmtIdx }) => {
    const startVal = evaluator.runExpressionWithContext(parsed.startExpr, state.vars, options.expressionOptions);
    const endVal = evaluator.runExpressionWithContext(parsed.endExpr, state.vars, options.expressionOptions);
    const stepVal = parsed.stepExpr
      ? evaluator.runExpressionWithContext(parsed.stepExpr, state.vars, options.expressionOptions)
      : 1;

    let start;
    let end;
    let step;
    let loopKind = null;

    if (isQty(startVal) || isQty(endVal)){
      if (!isQty(startVal) || !isQty(endVal)){
        throw new Error("for loop range must use matching unit quantities");
      }
      if (startVal.kind !== endVal.kind){
        throw new Error("for loop range units must match");
      }
      loopKind = startVal.kind;
      start = startVal.value;
      end = endVal.value;
      if (isQty(stepVal)){
        if (stepVal.kind !== loopKind) throw new Error("for loop step unit mismatch");
        step = stepVal.value;
      }else{
        step = stepVal;
      }
    }else{
      [start, end] = normalizeCompare(startVal, endVal);
      step = normalizeCompare(stepVal, 0)[0];
    }

    if (step === 0) throw new Error("for loop step cannot be 0");

    const hadVar = Object.prototype.hasOwnProperty.call(state.vars, parsed.varName);
    const prevVal = state.vars[parsed.varName];
    const forward = step > 0;
    let iter = 0;
    let lastResult = null;
    const childCtx = context.concat([`for#${stmtIdx + 1}`]);

    for (let i = start; forward ? i <= end : i >= end; i += step){
      iter += 1;
      if (iter > maxLoopIterations){
        throw new Error(`for loop exceeded ${maxLoopIterations} iterations`);
      }
      state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
      lastResult = executeSource(parsed.body, { ...options, context: childCtx });
    }

    if (hadVar) state.vars[parsed.varName] = prevVal;
    else delete state.vars[parsed.varName];

    return lastResult;
  };

  const executeRepeat = ({ parsed, options, context, stmtIdx }) => {
    const countVal = evaluator.runExpressionWithContext(parsed.countExpr, state.vars, options.expressionOptions);
    const count = normalizeCompare(countVal, 0)[0];
    if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");

    const n = Math.floor(count);
    if (n > maxLoopIterations){
      throw new Error(`repeat exceeded ${maxLoopIterations} iterations`);
    }

    let lastResult = null;
    const childCtx = context.concat([`repeat#${stmtIdx + 1}`]);
    for (let i = 0; i < n; i++){
      lastResult = executeSource(parsed.body, { ...options, context: childCtx });
    }
    return lastResult;
  };

  const executeStatement = (parsed, statementInfo) => {
    if (!parsed) return null;

    const handlers = {
      expr: executeExpr,
      assign: executeAssignment,
      equation: executeEquation,
      def: executeDefinition,
      assy: executeAssembly,
      cmd: executeCommand,
      if: executeIf,
      for: executeFor,
      repeat: executeRepeat,
    };

    const handler = handlers[parsed.type];
    if (!handler) return null;
    return handler({ parsed, ...statementInfo });
  };

  const executeSource = (source, options = {}) => {
    const statementList = splitStatements(source);
    const opts = {
      captureLastValue: false,
      allowCommands: true,
      wrapErrors: false,
      cleanStatement: false,
      expressionOptions: {},
      context: [],
      commandErrorMessage: null,
      ...options,
    };

    let lastResult = null;

    for (let stmtIdx = 0; stmtIdx < statementList.length; stmtIdx++){
      const stmt = statementList[stmtIdx];
      if (!stmt) continue;
      const preparedStmt = opts.cleanStatement ? stmt.replace(/;\s*$/, "") : stmt;

      try{
        const parsed = evaluator.evaluate(preparedStmt);
        const value = executeStatement(parsed, {
          options: opts,
          stmtIdx,
          context: opts.context,
          expressionOptions: opts.expressionOptions,
        });
        if (opts.captureLastValue) lastResult = value;
      }catch(err){
        if (!opts.wrapErrors) throw err;
        const msg = err?.message || String(err);
        if (typeof msg === "string" && msg.startsWith("Loop error at ")) throw err;
        const where = opts.context.length ? `${opts.context.join(" > ")} > ` : "";
        const preview = previewStmt(stmt);
        const rendered = preview ? JSON.stringify(preview) : "(empty statement)";
        throw new Error(`Loop error at ${where}stmt#${stmtIdx + 1} ${rendered}: ${msg}`);
      }
    }

    return opts.captureLastValue ? lastResult : null;
  };

  const executeBlock = (source, options = {}) => executeSource(source, {
    captureLastValue: true,
    cleanStatement: true,
    ...options,
  });

  return {
    executeStatement,
    executeBlock,
    executeSource,
  };
}
