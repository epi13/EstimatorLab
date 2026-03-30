import { isBlockNode } from "./repl-ast.js";
import { EFFECT } from "./repl-effects.js";
import {
  cloneEnv,
  createExecutionState,
  isExecutionState,
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
  const effectsAllowed = options.effectsAllowed ?? options.allowedEffects;
  return createExecutionState({
    env: options.env || Object.create(null),
    mode: options.mode || "commit",
    effectsAllowed: typeof effectsAllowed === "number" ? effectsAllowed : EFFECT.ALL,
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
  expandStatement,
}){
  if (typeof expandStatement !== "function"){
    throw new Error("createReplExecutor requires an expandStatement function.");
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

  function executeStatement(statementNode, state, options = {}){
    const mode = options.mode || state?.mode;
    const transitions = expandStatement({ statementNode, traversalState: state, mode });
    const transition = selectTransitionForPolicy(transitions, mode, options);
    return applyTransition(transition, state, { ...options, statementNode, mode });
  }

  function selectTransitionForPolicy(transitions, mode = "commit", options = {}){
    if (!Array.isArray(transitions) || transitions.length === 0) return null;
    if (typeof options.selector === "function"){
      return options.selector(transitions, mode) || transitions[0];
    }
    if (mode === "plan"){
      return transitions.slice().sort((a, b) => (b?.scoreDelta || 0) - (a?.scoreDelta || 0))[0];
    }
    return transitions[0];
  }

  function applyTransition(transition, traversalStateOrExecState, options = {}){
    const incoming = withExecutionState(traversalStateOrExecState);
    const mode = typeof options.mode === "string" ? options.mode : incoming.mode;
    const base = withModeAppliedState({ ...incoming, mode });
    if (!transition){
      return {
        nextState: base,
        record: makeExecutionRecord({
          statementNode: options.statementNode || null,
          type: "noop",
          mode: base.mode,
          before: snapshotStateRef(base),
          after: snapshotStateRef(base),
        }),
        transition: null,
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
        statementNodeId: null,
        canonicalKey: "noop|empty-statement",
        sourceModule: "repl-executor",
        strategy: "empty-statement",
        reasoningTags: ["noop", "empty-input"],
        meta: {
          mode: execState.mode,
          contextPath: execState.contextPath.slice(),
        },
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

    let nextState = withExecutionState(transition.toState || base, base.env);
    if (mode === "speculate" || mode === "plan"){
      nextState = { ...nextState, env: cloneEnv(nextState.env) };
    }else if (mode === "commit" && base.primaryEnv && nextState.env !== base.primaryEnv){
      const nextEnv = nextState.env || Object.create(null);
      for (const key of Object.keys(base.primaryEnv)){
        if (!Object.prototype.hasOwnProperty.call(nextEnv, key)) delete base.primaryEnv[key];
      }
      Object.assign(base.primaryEnv, nextEnv);
      nextState = { ...nextState, env: base.primaryEnv };
    }
    return {
      nextState,
      record: transition.record || null,
      transition,
    };
      return [createTransition({
        transitionType: record.type || statementNode.kind || "unknown",
        fromState: beforeStateRef,
        toState: nextState,
        record,
        ...transitionInput,
        statementNodeId: statementNode.nodeId || record.statementNodeId || null,
        canonicalKey: transitionInput.canonicalKey || `${record.type || statementNode.kind || "unknown"}|${statementNode.nodeId || "no-node"}`,
        sourceModule: "repl-executor",
        strategy: transitionInput.strategy || "statement-default",
        reasoningTags: transitionInput.reasoningTags || [statementNode.kind || "unknown"],
        meta: {
          mode: execState.mode,
          contextPath: execState.contextPath.slice(),
          statementKind: statementNode.kind || null,
          ...(transitionInput.meta || {}),
        },
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
          canonicalKey: `assign|${statementNode.nodeId || "no-node"}|${statementNode.name}|${candidate.transitionType || "expression-default"}`,
          strategy: candidate.transitionType || "expression-default",
          reasoningTags: ["assign", "expression-eval"],
          meta: {
            assignedName: statementNode.name,
          },
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
          canonicalKey: `equation|${statementNode.nodeId || "no-node"}|${solved?.unknown?.name || "unknown"}|${solved?.strategy || "numeric-solve"}`,
          strategy: solved?.strategy || "numeric-solve",
          reasoningTags: ["equation", "solver"],
          meta: {
            unknownName: solved?.unknown?.name || null,
          },
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
        canonicalKey: `expr|${statementNode.nodeId || "no-node"}|${candidate.transitionType || "expression-default"}`,
        strategy: candidate.transitionType || "expression-default",
        reasoningTags: ["expr", "expression-eval"],
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
    applyTransition,
    selectTransitionForPolicy,
    withScopedVar,
    normalizeOptions,
    mergeChangedSymbols,
    flattenExecutionRecord,
    flattenExecutionRecords,
  };
}

export const createExecutor = createReplExecutor;
