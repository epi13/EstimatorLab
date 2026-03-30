import { STATEMENT_TYPE, isBlockNode, isStatementNode } from "./repl-ast.js";
import { createTransition } from "./repl-transitions.js";
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

function snapshotStateRef(state){
  return {
    mode: state.mode || "commit",
    contextPath: Array.isArray(state.contextPath) ? state.contextPath.slice() : [],
    env: cloneEnv(state.env || Object.create(null)),
  };
}

function makeExecutionRecord({
  statementNode = null,
  mode = "commit",
  before = null,
  after = null,
  type = "unknown",
  value = null,
  meta = {},
  effects = [],
  changedSymbols = [],
  children = [],
  ...extra
} = {}){
  const statementText = statementNode?.stmt || extra.statement || "";
  const statementNodeId = statementNode?.nodeId || extra.statementNodeId || null;
  return {
    type,
    value,
    statement: statementText,
    statementKind: statementNode?.kind || extra.statementKind || type,
    statementNode,
    statementNodeId,
    mode,
    before,
    after,
    effects: Array.isArray(effects) ? effects : [],
    children: Array.isArray(children) ? children : [],
    meta: meta || {},
    changedSymbols: Array.isArray(changedSymbols) ? changedSymbols : [],
    ...extra,
  };
}

export function flattenExecutionRecord(record){
  if (!record) return [];
  const children = Array.isArray(record.children) ? record.children : [];
  const flatChildren = children.flatMap((child) => flattenExecutionRecord(child));
  return [record, ...flatChildren];
}

export function flattenExecutionRecords(records){
  return (Array.isArray(records) ? records : []).flatMap((record) => flattenExecutionRecord(record));
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
  runExpressionCandidatesWithContext = null,
  solveEquation,
  solveEquationCandidates,
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
    if (!isBlockNode(source)){
      throw new Error("executeSource expects an AST block node with a statements array.");
    }
    const statements = source.statements;

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
    const transitions = expandStatement(statementNode, state);
    const transition = selectTransitionForMode(transitions, state?.mode);
    if (!transition){
      const execState = withModeAppliedState(state);
      return {
        nextState: execState,
        record: makeExecutionRecord({
          statementNode,
          type: "noop",
          mode: execState.mode,
          before: snapshotStateRef(execState),
          after: snapshotStateRef(execState),
        }),
      };
    }
    return {
      nextState: transition.toState || withModeAppliedState(state),
      record: transition.record || null,
      transition,
    };
  }

  function selectTransitionForMode(transitions, mode = "commit"){
    if (!Array.isArray(transitions) || transitions.length === 0) return null;
    if (mode === "commit"){
      return transitions[0];
    }
    return transitions[0];
  }

  function normalizeExpandStatementArgs(statementNodeOrInput, traversalState, expandOptions = {}){
    if (statementNodeOrInput && typeof statementNodeOrInput === "object" && !isStatementNode(statementNodeOrInput) && Object.prototype.hasOwnProperty.call(statementNodeOrInput, "statementNode")){
      const input = statementNodeOrInput;
      return {
        statementNode: input.statementNode || null,
        traversalState: input.traversalState || input.execState || traversalState || null,
        options: {
          ...expandOptions,
          ...(input.options || {}),
          mode: input.mode ?? expandOptions.mode,
          detachFromCommit: input.detachFromCommit ?? expandOptions.detachFromCommit,
        },
      };
    }
    return {
      statementNode: statementNodeOrInput,
      traversalState,
      options: { ...expandOptions },
    };
  }

  function expandStatement(statementNodeOrInput, traversalState, expandOptions = {}){
    const { statementNode, traversalState: traversalStateInput, options } = normalizeExpandStatementArgs(
      statementNodeOrInput,
      traversalState,
      expandOptions
    );
    const incomingState = withExecutionState(traversalStateInput);
    const requestedMode = typeof options.mode === "string" ? options.mode : incomingState.mode;
    const detachFromCommit = options.detachFromCommit === true;
    const effectiveMode = detachFromCommit && requestedMode === "commit" ? "speculate" : requestedMode;
    const execState = withModeAppliedState({ ...incomingState, mode: effectiveMode });
    const beforeStateRef = snapshotStateRef(execState);
    const env = execState.env;
    const expressionTrace = execState.traceExpressions ? [] : null;

    if (!statementNode){
      const record = makeExecutionRecord({
        type: "noop",
        mode: execState.mode,
        before: beforeStateRef,
        after: snapshotStateRef(execState),
      });
      return [createTransition({
        transitionType: "noop",
        fromState: beforeStateRef,
        toState: execState,
        record,
      })];
    }
    if (!isStatementNode(statementNode)){
      throw new Error("expandStatement expects an AST statement node.");
    }

    const provenanceEntry = {
      kind: statementNode.kind,
      nodeId: statementNode.nodeId || null,
      contextPath: execState.contextPath.slice(),
      statement: statementNode.stmt || "",
    };

    const finalizeTransition = (recordInput, transitionInput = {}) => {
      const record = makeExecutionRecord({
        statementNode,
        mode: execState.mode,
        before: beforeStateRef,
        after: snapshotStateRef(execState),
        ...recordInput,
      });
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
      return [createTransition({
        transitionType: record.type || statementNode.kind || "unknown",
        fromState: beforeStateRef,
        toState: nextState,
        record,
        ...transitionInput,
      })];
    };

    if (statementNode.kind === STATEMENT_TYPE.CMD){
      if (!execState.allowCommands){
        throw new Error(execState.commandErrorMessage || "Commands are not supported in this context.");
      }
      const value = typeof cmdRunner === "function"
        ? cmdRunner(statementNode.cmd, statementNode.arg)
        : null;
      return finalizeTransition({
        type: "cmd",
        value,
        meta: {
          command: statementNode.cmd,
          arg: statementNode.arg,
        },
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.DEF){
      if (typeof defineUserFn === "function"){
        defineUserFn(statementNode.name, statementNode.params, statementNode.expr);
      }
      return finalizeTransition({
        type: "def",
        value: null,
        changedSymbols: [statementNode.name],
        effects: [{ kind: "define-function", symbol: statementNode.name }],
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.ASSY){
      const assembly = createAssembly(statementNode.name, statementNode.fields, env, execState);
      env[statementNode.name] = assembly;
      return finalizeTransition({
        type: "assy",
        value: assembly,
        changedSymbols: [statementNode.name],
        effects: [{ kind: "write-symbol", symbol: statementNode.name, value: assembly }],
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.ASSIGN){
      const exprInput = statementNode.exprIr || statementNode.expr;
      const valueCandidates = typeof runExpressionCandidatesWithContext === "function"
        ? runExpressionCandidatesWithContext(exprInput, execState.env, execState)
        : [{ value: runExpression(exprInput, execState, expressionTrace), scoreDelta: 0, confidence: 1 }];
      const candidate = valueCandidates[0];
      if (candidate){
        env[statementNode.name] = candidate.value;
        return finalizeTransition({
          type: "assign",
          value: candidate.value,
          meta: {
            assignedName: statementNode.name,
            expressionStrategy: candidate.transitionType || "expression-default",
            expressionTrace: expressionTrace || [],
          },
          changedSymbols: [statementNode.name],
          effects: [{ kind: "write-symbol", symbol: statementNode.name, value: candidate.value }],
        }, {
          scoreDelta: Number.isFinite(candidate.scoreDelta) ? candidate.scoreDelta : 0,
          confidence: Number.isFinite(candidate.confidence) ? candidate.confidence : 1,
        });
      }
      throw new Error("Assignment produced no expression candidates.");
    }

    if (statementNode.kind === STATEMENT_TYPE.EQUATION){
      const solvedCandidates = typeof solveEquationCandidates === "function"
        ? solveEquationCandidates(statementNode.left, statementNode.right)
        : [solveEquation(statementNode.left, statementNode.right)];
      const solved = solvedCandidates[0];
      if (solved){
        const transitionInput = {
          scoreDelta: Number.isFinite(solved?.scoreDelta) ? solved.scoreDelta : 0,
          confidence: Number.isFinite(solved?.confidence) ? solved.confidence : 1,
        };
        if (solved.unknown.unitToken){
          return finalizeTransition({
            type: "equation",
            value: makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind),
            meta: {
              unknownName: solved.unknown.name,
              usedUnitToken: true,
              strategy: solved.strategy || "numeric-solve",
              expressionTrace: expressionTrace || [],
            },
          }, transitionInput);
        }
        env[solved.unknown.name] = solved.value;
        return finalizeTransition({
          type: "equation",
          value: solved.value,
          meta: {
            unknownName: solved.unknown.name,
            usedUnitToken: false,
            strategy: solved.strategy || "numeric-solve",
            expressionTrace: expressionTrace || [],
          },
          changedSymbols: [solved.unknown.name],
          effects: [{ kind: "write-symbol", symbol: solved.unknown.name, value: solved.value }],
        }, transitionInput);
      }
      throw new Error("Equation solver produced no candidates.");
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

      const branchChildren = Array.isArray(branchResult.results) ? branchResult.results : [];
      return finalizeTransition({
        type: "if",
        value: branchResult.lastValue,
        meta: {
          branchTaken,
          expressionTrace: expressionTrace || [],
        },
        children: branchChildren,
        changedSymbols: mergeChangedSymbols(flattenExecutionRecords(branchChildren)),
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.FOR){
      const { start, end, step, loopKind } = resolveForRange(statementNode, execState);
      const forward = step > 0;
      let iter = 0;
      const iterationRecords = [];

      const record = withScopedVar(env, statementNode.varName, () => {
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > maxLoopIterations){
            throw new Error(`for loop exceeded ${maxLoopIterations} iterations`);
          }
          const iterStateBefore = snapshotStateRef(execState);
          env[statementNode.varName] = loopKind ? makeQty(i, loopKind) : i;
          const iterResult = executeSource(
            statementNode.body,
            stateWithContext(execState, `for:${statementNode.varName}`, `iter:${iter}`)
          );
          iterationRecords.push(makeExecutionRecord({
            statementNode,
            type: "for-iteration",
            statement: `for ${statementNode.varName} iteration ${iter}`,
            statementKind: "for-iteration",
            mode: execState.mode,
            before: iterStateBefore,
            after: snapshotStateRef(execState),
            value: iterResult.lastValue,
            meta: {
              index: iter,
              loopVar: statementNode.varName,
              loopValue: env[statementNode.varName],
            },
            children: Array.isArray(iterResult.results) ? iterResult.results : [],
            changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterResult.results)),
          }));
        }
        const lastValue = iterationRecords.length
          ? iterationRecords[iterationRecords.length - 1].value
          : null;

        return {
          type: "for",
          value: lastValue,
          meta: {
            iterationCount: iter,
            expressionTrace: expressionTrace || [],
          },
          children: iterationRecords,
          changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterationRecords)),
        };
      });

      return finalizeTransition(record);
    }

    if (statementNode.kind === STATEMENT_TYPE.REPEAT){
      const countVal = runExpression(statementNode.countExpr, execState, expressionTrace);
      const count = normalizeCompare(countVal, 0)[0];
      if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
      const n = Math.floor(count);
      if (n > maxLoopIterations){
        throw new Error(`repeat exceeded ${maxLoopIterations} iterations`);
      }
      const iterationRecords = [];
      for (let i = 0; i < n; i++){
        const iterStateBefore = snapshotStateRef(execState);
        const iterResult = executeSource(
          statementNode.body,
          stateWithContext(execState, "repeat", `iter:${i + 1}`)
        );
        iterationRecords.push(makeExecutionRecord({
          statementNode,
          type: "repeat-iteration",
          statement: `repeat iteration ${i + 1}`,
          statementKind: "repeat-iteration",
          mode: execState.mode,
          before: iterStateBefore,
          after: snapshotStateRef(execState),
          value: iterResult.lastValue,
          meta: {
            index: i + 1,
          },
          children: Array.isArray(iterResult.results) ? iterResult.results : [],
          changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterResult.results)),
        }));
      }
      const lastValue = iterationRecords.length
        ? iterationRecords[iterationRecords.length - 1].value
        : null;

      return finalizeTransition({
        type: "repeat",
        value: lastValue,
        meta: {
          repeatCount: n,
          expressionTrace: expressionTrace || [],
        },
        children: iterationRecords,
        changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterationRecords)),
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.EXPR){
      const exprInput = statementNode.exprIr || statementNode.expr;
      const valueCandidates = typeof runExpressionCandidatesWithContext === "function"
        ? runExpressionCandidatesWithContext(exprInput, execState.env, execState)
        : [{ value: runExpression(exprInput, execState, expressionTrace), scoreDelta: 0, confidence: 1 }];
      const transitions = valueCandidates.flatMap((candidate) => finalizeTransition({
        type: "expr",
        value: candidate.value,
        meta: {
          expressionStrategy: candidate.transitionType || "expression-default",
          expressionTrace: expressionTrace || [],
        },
      }, {
        scoreDelta: Number.isFinite(candidate.scoreDelta) ? candidate.scoreDelta : 0,
        confidence: Number.isFinite(candidate.confidence) ? candidate.confidence : 1,
      }));
      if (transitions.length) return transitions;
      throw new Error("Expression produced no candidates.");
    }

    return finalizeTransition({
      type: statementNode.kind || "unknown",
      value: null,
    });
  }

  return {
    executeSource,
    executeStatement,
    expandStatement,
    withScopedVar,
    normalizeOptions,
    mergeChangedSymbols,
    flattenExecutionRecord,
    flattenExecutionRecords,
  };
}

export const createExecutor = createReplExecutor;
