import { EFFECT } from "./repl-effects.js";

export const EXECUTOR_DEFAULTS = Object.freeze({
  allowedEffects: EFFECT.ALL,
  allowCommands: false,
  captureLastValue: false,
  wrapErrors: true,
  contextPath: Object.freeze([]),
  maxLoopIterations: 100000,
});

export function createExecutor({ state, evaluator, runtime, splitStatements, isTruthy, normalizeCompare, isQty, makeQty, runCommand }){
  const normalizeOptions = (options = null) => {
    const src = options && typeof options === "object" ? options : null;
    const contextPath = Array.isArray(src?.contextPath)
      ? src.contextPath.slice()
      : Array.isArray(EXECUTOR_DEFAULTS.contextPath)
        ? EXECUTOR_DEFAULTS.contextPath.slice()
        : [];

    return {
      allowedEffects: typeof src?.allowedEffects === "number" ? src.allowedEffects : EXECUTOR_DEFAULTS.allowedEffects,
      allowCommands: typeof src?.allowCommands === "boolean" ? src.allowCommands : EXECUTOR_DEFAULTS.allowCommands,
      captureLastValue: typeof src?.captureLastValue === "boolean" ? src.captureLastValue : EXECUTOR_DEFAULTS.captureLastValue,
      wrapErrors: typeof src?.wrapErrors === "boolean" ? src.wrapErrors : EXECUTOR_DEFAULTS.wrapErrors,
      contextPath,
      maxLoopIterations: Number.isFinite(src?.maxLoopIterations) ? Math.max(0, Math.floor(src.maxLoopIterations)) : EXECUTOR_DEFAULTS.maxLoopIterations,
    };
  };

  const previewStmt = (stmt) => {
    const trimmed = String(stmt || "").trim();
    if (!trimmed) return "";
    const maxLen = 220;
    return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
  };

  const withContext = (options, label, runChild) => {
    const opts = normalizeOptions(options);
    const next = Object.assign({}, opts, { contextPath: opts.contextPath.concat([label]) });
    return runChild(next);
  };

  const runStatements = (source, options = null) => {
    const opts = normalizeOptions(options);
    const statementList = splitStatements(source);
    let lastResult = null;

    for (let stmtIdx = 0; stmtIdx < statementList.length; stmtIdx++){
      const stmt = statementList[stmtIdx];
      if (!stmt) continue;
      const cleaned = stmt.replace(/;\s*$/, "");

      try{
        const parsed = evaluator.evaluate(cleaned);
        if (!parsed) continue;

        if (parsed.type === "cmd"){
          if (!opts.allowCommands){
            throw new Error("Commands are not supported in this context.");
          }
          if (typeof runCommand !== "function"){
            throw new Error("Commands are unavailable in this context.");
          }
          lastResult = runCommand(parsed.cmd, parsed.arg);
          continue;
        }

        if (parsed.type === "def"){
          runtime.defineUserFn(parsed.name, parsed.params, parsed.expr);
          continue;
        }

        if (parsed.type === "assy"){
          const assembly = evaluator.createAssembly(parsed.name, parsed.fields);
          state.vars[parsed.name] = assembly;
          if (opts.captureLastValue) lastResult = assembly;
          continue;
        }

        if (parsed.type === "assign"){
          lastResult = evaluator.runExpressionWithContext(parsed.expr, state.vars, opts);
          state.vars[parsed.name] = lastResult;
          continue;
        }

        if (parsed.type === "equation"){
          const solved = evaluator.solveEquation(parsed.left, parsed.right);
          if (!solved.unknown.unitToken){
            state.vars[solved.unknown.name] = solved.value;
          }
          if (opts.captureLastValue) lastResult = solved.value;
          continue;
        }

        if (parsed.type === "if"){
          const cond = evaluator.runExpressionWithContext(parsed.condition, state.vars, opts);
          if (isTruthy(cond)){
            lastResult = withContext(opts, `if#${stmtIdx + 1}`, (childOpts) => runStatements(parsed.thenBody, childOpts));
          }else if (parsed.elseBody){
            lastResult = withContext(opts, `if#${stmtIdx + 1}`, (childOpts) => runStatements(parsed.elseBody, childOpts));
          }
          continue;
        }

        if (parsed.type === "for"){
          const startVal = evaluator.runExpressionWithContext(parsed.startExpr, state.vars, opts);
          const endVal = evaluator.runExpressionWithContext(parsed.endExpr, state.vars, opts);
          const stepVal = parsed.stepExpr ? evaluator.runExpressionWithContext(parsed.stepExpr, state.vars, opts) : 1;
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
          for (let i = start; forward ? i <= end : i >= end; i += step){
            iter += 1;
            if (iter > opts.maxLoopIterations){
              throw new Error(`for loop exceeded ${opts.maxLoopIterations} iterations`);
            }
            state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
            lastResult = withContext(opts, `for#${stmtIdx + 1}`, (childOpts) => runStatements(parsed.body, childOpts));
          }
          if (hadVar) state.vars[parsed.varName] = prevVal;
          else delete state.vars[parsed.varName];
          continue;
        }

        if (parsed.type === "repeat"){
          const countVal = evaluator.runExpressionWithContext(parsed.countExpr, state.vars, opts);
          const count = normalizeCompare(countVal, 0)[0];
          if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
          const n = Math.floor(count);
          if (n > opts.maxLoopIterations){
            throw new Error(`repeat exceeded ${opts.maxLoopIterations} iterations`);
          }
          for (let i = 0; i < n; i++){
            lastResult = withContext(opts, `repeat#${stmtIdx + 1}`, (childOpts) => runStatements(parsed.body, childOpts));
          }
          continue;
        }

        if (parsed.type === "expr"){
          lastResult = evaluator.runExpressionWithContext(parsed.expr, state.vars, opts);
        }
      }catch(err){
        if (!opts.wrapErrors) throw err;
        const msg = err?.message || String(err);
        if (typeof msg === "string" && msg.startsWith("Loop error at ")){
          throw err;
        }
        const where = opts.contextPath.length ? `${opts.contextPath.join(" > ")} > ` : "";
        const preview = previewStmt(stmt);
        const rendered = preview ? JSON.stringify(preview) : "(empty statement)";
        throw new Error(`Loop error at ${where}stmt#${stmtIdx + 1} ${rendered}: ${msg}`);
      }
    }

    return opts.captureLastValue ? lastResult : null;
  };

  const runLoopStatements = (source, options = null) => {
    const opts = normalizeOptions(Object.assign({}, options, {
      allowCommands: false,
      captureLastValue: false,
      wrapErrors: true,
    }));
    runStatements(source, opts);
  };

  const runBlockBody = (source, options = null) => {
    const opts = normalizeOptions(Object.assign({}, options, {
      allowCommands: false,
      captureLastValue: true,
      wrapErrors: false,
    }));
    return runStatements(source, opts);
  };

  return {
    normalizeOptions,
    withContext,
    runStatements,
    runLoopStatements,
    runBlockBody,
  };
}
