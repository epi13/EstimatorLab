import { STATEMENT_TYPE, isBlockNode, isStatementNode } from "./repl-ast.js";
import {
  cloneEnv,
  createExecutionState,
  isExecutionState,
  stateWithContext,
  withExecutionState,
} from "./repl-runtime-state.js";

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
  return createExecutionState({
    env: options.env || Object.create(null),
    mode: options.mode || "commit",
    effectsAllowed: options.effectsAllowed ?? options.allowedEffects,
    contextPath: Array.isArray(options.contextPath) ? options.contextPath : [],
    trace: Array.isArray(options.trace) ? options.trace : [],
    diagnostics: Array.isArray(options.diagnostics) ? options.diagnostics : [],
    provenance: Array.isArray(options.provenance) ? options.provenance : [],
    score: typeof options.score === "number" ? options.score : undefined,
    allowCommands: Boolean(options.allowCommands),
    wrapErrors: Boolean(options.wrapErrors),
    traceExpressions: Boolean(options.traceExpressions),
    captureResults: options.captureResults !== false,
    commandErrorMessage: options.commandErrorMessage,
  });
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

function withModeAppliedState(state, envOverride = null){
  const incoming = withExecutionState(state);
  const primaryEnv = envOverride || incoming.env;
  if (!primaryEnv || typeof primaryEnv !== "object"){
    throw new Error("ExecutionState.env must be an object.");
  }

  const mode = incoming.mode || "commit";
  const shouldClone = mode === "speculate" || mode === "plan";
  const workingEnv = shouldClone ? cloneEnv(primaryEnv) : primaryEnv;
  return {
    ...incoming,
    env: workingEnv,
    mode,
    primaryEnv,
    allowCommands: Boolean(incoming.allowCommands),
    wrapErrors: Boolean(incoming.wrapErrors),
    traceExpressions: Boolean(incoming.traceExpressions || mode === "trace"),
    captureResults: incoming.captureResults !== false,
    commandErrorMessage: incoming.commandErrorMessage,
  };
}

export function createReplExecutor({
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
  const runExpression = (expr, execState, traceBuffer = null) => {
    const traceSink = Array.isArray(traceBuffer)
      ? (entry) => traceBuffer.push(entry)
      : null;
    return runExpressionWithContext(expr, execState.env, {
      ...execState,
      allowedEffects: execState.effectsAllowed,
      effectsAllowed: execState.effectsAllowed,
      traceExpressions: Boolean(execState.traceExpressions || execState.mode === "trace"),
      expressionTraceSink: traceSink,
    });
  };

  function resolveForRange(parsed, execState){
    const startVal = runExpression(parsed.startExpr, execState);
    const endVal = runExpression(parsed.endExpr, execState);
    const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr, execState) : 1;
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

  function executeSource(source, envOrState, options = {}){
    const statements = Array.isArray(source)
      ? source
      : (isBlockNode(source) ? source.statements : null);
    if (!statements){
      throw new Error("executeSource expects AST block nodes or statement-node arrays.");
    }

    const baseState = isExecutionState(envOrState)
      ? withModeAppliedState(envOrState)
      : withModeAppliedState({ ...(options || {}), env: envOrState || options.env || Object.create(null) });

    const blockResult = {
      lastValue: null,
      results: [],
      nextState: baseState,
    };

    let currentState = baseState;
    for (let stmtIdx = 0; stmtIdx < statements.length; stmtIdx++){
      const stmt = statements[stmtIdx];
      if (!stmt) continue;

      try{
        const { nextState, record } = executeStatement(stmt, currentState);
        currentState = nextState;
        blockResult.nextState = nextState;
        blockResult.lastValue = record?.value ?? blockResult.lastValue;

        if (currentState.captureResults){
          blockResult.results.push(record);
        }
      }catch (err){
        if (!currentState.wrapErrors) throw err;
        throw wrapExecutionError(err, stmt, stmtIdx, currentState.contextPath);
      }
    }

    return blockResult;
  }

  function executeStatement(statementNode, state){
    const execState = withModeAppliedState(state);
    if (!statementNode) return { nextState: execState, record: makeStatementResult("noop", null) };
    if (!isStatementNode(statementNode)){
      throw new Error("executeStatement expects an AST statement node.");
    }
    const expressionTrace = execState.traceExpressions ? [] : null;
    const env = execState.env;

    const provenanceEntry = {
      kind: statementNode.kind,
      contextPath: execState.contextPath.slice(),
      statement: statementNode.stmt || "",
    };

    const finalize = (record) => {
      const nextState = {
        ...execState,
        trace: [...(execState.trace || []), record],
      };
      if (execState.mode === "trace"){
        nextState.provenance = [...(execState.provenance || []), provenanceEntry];
        record.provenance = provenanceEntry;
      }
      if (execState.mode === "plan"){
        const candidate = createExecutionState({
          ...nextState,
          env: cloneEnv(nextState.env),
          mode: "plan",
          score: typeof nextState.score === "number" ? nextState.score : undefined,
        });
        record.candidates = [candidate];
      }
      return { nextState, record };
    };

    if (statementNode.kind === STATEMENT_TYPE.CMD){
      if (!execState.allowCommands){
        throw new Error(execState.commandErrorMessage || "Commands are not supported in this context.");
      }
      const value = typeof cmdRunner === "function"
        ? cmdRunner(statementNode.cmd, statementNode.arg)
        : null;
      return finalize(makeStatementResult("cmd", value, {
        meta: {
          command: statementNode.cmd,
          arg: statementNode.arg,
        },
      }));
    }

    if (statementNode.kind === STATEMENT_TYPE.DEF){
      if (typeof defineUserFn === "function"){
        defineUserFn(statementNode.name, statementNode.params, statementNode.expr);
      }
      return finalize(makeStatementResult("def", null, {
        changedSymbols: [statementNode.name],
      }));
    }

    if (statementNode.kind === STATEMENT_TYPE.ASSY){
      const assembly = createAssembly(statementNode.name, statementNode.fields, env, execState);
      env[statementNode.name] = assembly;
      return finalize(makeStatementResult("assy", assembly, {
        changedSymbols: [statementNode.name],
      }));
    }

    if (statementNode.kind === STATEMENT_TYPE.ASSIGN){
      const value = runExpression(statementNode.exprIr || statementNode.expr, execState, expressionTrace);
      env[statementNode.name] = value;
      return finalize(makeStatementResult("assign", value, {
        meta: {
          assignedName: statementNode.name,
          expressionTrace: expressionTrace || [],
        },
        changedSymbols: [statementNode.name],
      }));
    }

    if (statementNode.kind === STATEMENT_TYPE.EQUATION){
      const solved = solveEquation(statementNode.left, statementNode.right);
      if (solved.unknown.unitToken){
        return finalize(makeStatementResult(
          "equation",
          makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind),
          {
            meta: {
              unknownName: solved.unknown.name,
              usedUnitToken: true,
              expressionTrace: expressionTrace || [],
            },
          }
        ));
      }
      env[solved.unknown.name] = solved.value;
      return finalize(makeStatementResult("equation", solved.value, {
        meta: {
          unknownName: solved.unknown.name,
          usedUnitToken: false,
          expressionTrace: expressionTrace || [],
        },
        changedSymbols: [solved.unknown.name],
      }));
    }

    if (statementNode.kind === STATEMENT_TYPE.IF){
      const cond = runExpression(statementNode.condition, execState, expressionTrace);

      let branchResult = { lastValue: null, results: [], nextState: execState };
      let branchTaken = "none";
      if (isTruthy(cond)){
        branchTaken = "then";
        branchResult = executeSource(statementNode.thenBody, stateWithContext(execState, "if:then"));
      }else if (statementNode.elseBody){
        branchTaken = "else";
        branchResult = executeSource(statementNode.elseBody, stateWithContext(execState, "if:else"));
      }

      return finalize(makeStatementResult("if", branchResult.lastValue, {
        meta: {
          branchTaken,
          expressionTrace: expressionTrace || [],
        },
        results: branchResult.results,
        changedSymbols: mergeChangedSymbols(branchResult.results),
      }));
    }

    if (statementNode.kind === STATEMENT_TYPE.FOR){
      const { start, end, step, loopKind } = resolveForRange(statementNode, execState);
      const forward = step > 0;
      let iter = 0;
      const nestedResults = [];

      const record = withScopedVar(env, statementNode.varName, () => {
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > maxLoopIterations){
            throw new Error(`for loop exceeded ${maxLoopIterations} iterations`);
          }
          env[statementNode.varName] = loopKind ? makeQty(i, loopKind) : i;
          const iterResult = executeSource(
            statementNode.body,
            stateWithContext(execState, `for:${statementNode.varName}`, `iter:${iter}`)
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
            flattenedSummary: {
              iterationCount: iter,
              statementCount: flattened.length,
            },
            nestedExecution: nestedResults,
          },
          flattenedResults: flattened,
          nestedResults,
          results: flattened,
          changedSymbols: mergeChangedSymbols(flattened),
        });
      });

      return finalize(record);
    }

    if (statementNode.kind === STATEMENT_TYPE.REPEAT){
      const countVal = runExpression(statementNode.countExpr, execState, expressionTrace);
      const count = normalizeCompare(countVal, 0)[0];
      if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
      const n = Math.floor(count);
      if (n > maxLoopIterations){
        throw new Error(`repeat exceeded ${maxLoopIterations} iterations`);
      }
      const nestedResults = [];
      for (let i = 0; i < n; i++){
        const iterResult = executeSource(
          statementNode.body,
          stateWithContext(execState, "repeat", `iter:${i + 1}`)
        );
        nestedResults.push(iterResult);
      }

      const flattened = nestedResults.flatMap((entry) => entry.results || []);
      const lastValue = nestedResults.length
        ? nestedResults[nestedResults.length - 1].lastValue
        : null;

      return finalize(makeStatementResult("repeat", lastValue, {
        meta: {
          repeatCount: n,
          expressionTrace: expressionTrace || [],
          flattenedSummary: {
            repeatCount: n,
            statementCount: flattened.length,
          },
          nestedExecution: nestedResults,
        },
        flattenedResults: flattened,
        nestedResults,
        results: flattened,
        changedSymbols: mergeChangedSymbols(flattened),
      }));
    }

    if (statementNode.kind === STATEMENT_TYPE.EXPR){
      const value = runExpression(statementNode.exprIr || statementNode.expr, execState, expressionTrace);
      return finalize(makeStatementResult("expr", value, {
        meta: {
          expressionTrace: expressionTrace || [],
        },
      }));
    }

    return finalize(makeStatementResult(statementNode.kind || "unknown", null));
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
