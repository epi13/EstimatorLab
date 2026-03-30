import { splitStatements } from "./repl-parser.js";

export function withScopedVar(env, name, fn){
  const hadVar = Object.prototype.hasOwnProperty.call(env, name);
  const prevVal = env[name];
  try{
    return fn();
  }finally{
    if (hadVar) env[name] = prevVal;
    else delete env[name];
  }
}

function normalizeOptions(options = {}){
  return {
    allowedEffects: options.allowedEffects,
    allowCommands: Boolean(options.allowCommands),
    wrapErrors: Boolean(options.wrapErrors),
    traceExpressions: Boolean(options.traceExpressions),
    contextPath: Array.isArray(options.contextPath) ? options.contextPath : [],
    captureResults: options.captureResults !== false,
    commandErrorMessage: options.commandErrorMessage,
  };
}

function makeStatementResult(type, value = null, extra = {}){
  return {
    type,
    value,
    meta: {},
    changedSymbols: [],
    results: [],
    ...extra,
  };
}

function mergeChangedSymbols(entries){
  const changed = [];
  const seen = new Set();
  for (const entry of entries || []){
    const symbols = Array.isArray(entry?.changedSymbols) ? entry.changedSymbols : [];
    for (const name of symbols){
      if (!seen.has(name)){
        seen.add(name);
        changed.push(name);
      }
    }
  }
  return changed;
}

function previewStmt(stmt){
  const trimmed = String(stmt || "").trim();
  if (!trimmed) return "";
  const maxLen = 220;
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

function wrapExecutionError(err, stmt, stmtIdx, contextPath = []){
  const msg = err?.message || String(err);
  if (typeof msg === "string" && msg.startsWith("Loop error at ")){
    return err;
  }
  const where = contextPath.length ? `${contextPath.join(" > ")} > ` : "";
  const preview = previewStmt(stmt);
  const rendered = preview ? JSON.stringify(preview) : "(empty statement)";
  return new Error(`Loop error at ${where}stmt#${stmtIdx + 1} ${rendered}: ${msg}`);
}

export function createReplExecutor({
  evaluate,
  runExpressionWithContext,
  solveEquation,
  createAssembly,
  defineUserFn,
  cmdRunner,
  isTruthy,
  normalizeCompare,
  isQty,
  makeQty,
  maxLoopIterations = 100000,
}){
  function extendContext(options, ...labels){
    const ctx = Array.isArray(options?.contextPath) ? options.contextPath : [];
    const nextLabels = labels.filter((label) => typeof label === "string" && label.trim());
    return {
      ...options,
      contextPath: [...ctx, ...nextLabels],
    };
  }

  const runExpression = (expr, env, options, traceBuffer = null) => {
    const traceSink = Array.isArray(traceBuffer)
      ? (entry) => traceBuffer.push(entry)
      : null;
    return runExpressionWithContext(expr, env, {
      ...(options || {}),
      traceExpressions: Boolean(options?.traceExpressions),
      expressionTraceSink: traceSink,
    });
  };

  function resolveForRange(parsed, env, options){
    const startVal = runExpression(parsed.startExpr, env, options);
    const endVal = runExpression(parsed.endExpr, env, options);
    const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr, env, options) : 1;
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
    return { start, end, step, loopKind };
  }

  function executeSource(source, env, options = {}){
    const opts = normalizeOptions(options);
    const statements = Array.isArray(source) ? source : splitStatements(source);
    const blockResult = {
      lastValue: null,
      results: [],
    };

    for (let stmtIdx = 0; stmtIdx < statements.length; stmtIdx++){
      const stmt = statements[stmtIdx];
      if (!stmt) continue;

      try{
        let parsed = null;
        if (typeof stmt === "string"){
          parsed = evaluate(stmt);
        }else if (typeof stmt === "object"){
          parsed = stmt;
        }else{
          parsed = evaluate(String(stmt));
        }
        if (!parsed) continue;

        const statementResult = executeStatement(parsed, env, opts);
        blockResult.lastValue = statementResult?.value ?? blockResult.lastValue;

        if (opts.captureResults){
          blockResult.results.push(statementResult);
        }
      }catch (err){
        if (!opts.wrapErrors) throw err;
        throw wrapExecutionError(err, stmt, stmtIdx, opts.contextPath);
      }
    }

    return blockResult;
  }

  function executeStatement(parsed, env, options = {}){
    if (!parsed) return makeStatementResult("noop", null);
    const expressionTrace = options.traceExpressions ? [] : null;

    if (parsed.type === "cmd"){
      if (!options.allowCommands){
        throw new Error(options.commandErrorMessage || "Commands are not supported in this context.");
      }
      const value = typeof cmdRunner === "function"
        ? cmdRunner(parsed.cmd, parsed.arg)
        : null;
      return makeStatementResult("cmd", value, {
        meta: {
          command: parsed.cmd,
          arg: parsed.arg,
        },
      });
    }

    if (parsed.type === "def"){
      if (typeof defineUserFn === "function"){
        defineUserFn(parsed.name, parsed.params, parsed.expr);
      }
      return makeStatementResult("def", null, {
        changedSymbols: [parsed.name],
      });
    }

    if (parsed.type === "assy"){
      const assembly = createAssembly(parsed.name, parsed.fields);
      env[parsed.name] = assembly;
      return makeStatementResult("assy", assembly, {
        changedSymbols: [parsed.name],
      });
    }

    if (parsed.type === "assign"){
      const value = runExpression(parsed.expr, env, options, expressionTrace);
      env[parsed.name] = value;
      return makeStatementResult("assign", value, {
        meta: {
          assignedName: parsed.name,
          expressionTrace: expressionTrace || [],
        },
        changedSymbols: [parsed.name],
      });
    }

    if (parsed.type === "equation"){
      const solved = solveEquation(parsed.left, parsed.right);
      if (solved.unknown.unitToken){
        return makeStatementResult(
          "equation",
          makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind),
          {
            meta: {
              unknownName: solved.unknown.name,
              usedUnitToken: true,
              expressionTrace: expressionTrace || [],
            },
          }
        );
      }
      env[solved.unknown.name] = solved.value;
      return makeStatementResult("equation", solved.value, {
        meta: {
          unknownName: solved.unknown.name,
          usedUnitToken: false,
          expressionTrace: expressionTrace || [],
        },
        changedSymbols: [solved.unknown.name],
      });
    }

    if (parsed.type === "if"){
      const cond = runExpression(parsed.condition, env, options, expressionTrace);

      let branchResult = { lastValue: null, results: [] };
      let branchTaken = "none";
      if (isTruthy(cond)){
        branchTaken = "then";
        branchResult = executeSource(parsed.thenBody, env, extendContext(options, "if:then"));
      }else if (parsed.elseBody){
        branchTaken = "else";
        branchResult = executeSource(parsed.elseBody, env, extendContext(options, "if:else"));
      }

      return makeStatementResult("if", branchResult.lastValue, {
        meta: {
          branchTaken,
          expressionTrace: expressionTrace || [],
        },
        results: branchResult.results,
        changedSymbols: mergeChangedSymbols(branchResult.results),
      });
    }

    if (parsed.type === "for"){
      const { start, end, step, loopKind } = resolveForRange(parsed, env, options);
      const forward = step > 0;
      let iter = 0;
      const nestedResults = [];

      return withScopedVar(env, parsed.varName, () => {
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > maxLoopIterations){
            throw new Error(`for loop exceeded ${maxLoopIterations} iterations`);
          }
          env[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          const iterResult = executeSource(
            parsed.body,
            env,
            extendContext(options, `for:${parsed.varName}`, `iter:${iter}`)
          );
          nestedResults.push(iterResult);
        }

        const flattened = nestedResults.flatMap((entry) => entry.results || []);
        const lastValue = nestedResults.length
          ? nestedResults[nestedResults.length - 1].lastValue
          : null;

        return makeStatementResult("for", lastValue, {
          meta: {
            iterationCount: iter,
          },
          results: flattened,
          changedSymbols: mergeChangedSymbols(flattened),
        });
      });
    }

    if (parsed.type === "repeat"){
      const countVal = runExpression(parsed.countExpr, env, options, expressionTrace);
      const count = normalizeCompare(countVal, 0)[0];
      if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
      const n = Math.floor(count);
      if (n > maxLoopIterations){
        throw new Error(`repeat exceeded ${maxLoopIterations} iterations`);
      }
      const nestedResults = [];
      for (let i = 0; i < n; i++){
        const iterResult = executeSource(
          parsed.body,
          env,
          extendContext(options, "repeat", `iter:${i + 1}`)
        );
        nestedResults.push(iterResult);
      }

      const flattened = nestedResults.flatMap((entry) => entry.results || []);
      const lastValue = nestedResults.length
        ? nestedResults[nestedResults.length - 1].lastValue
        : null;

      return makeStatementResult("repeat", lastValue, {
        meta: {
          repeatCount: n,
          expressionTrace: expressionTrace || [],
        },
        results: flattened,
        changedSymbols: mergeChangedSymbols(flattened),
      });
    }

    if (parsed.type === "expr"){
      const value = runExpression(parsed.expr, env, options, expressionTrace);
      return makeStatementResult("expr", value, {
        meta: {
          expressionTrace: expressionTrace || [],
        },
      });
    }

    return makeStatementResult(parsed.type || "unknown", null);
  }

  return {
    executeSource,
    executeStatement,
    withScopedVar,
    normalizeOptions,
    mergeChangedSymbols,
  };
}

export const createExecutor = createReplExecutor;
