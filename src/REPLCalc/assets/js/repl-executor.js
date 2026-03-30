import { isBlockNode } from "./repl-ast.js";
import { EFFECT } from "./repl-effects.js";
import {
  cloneEnv,
  createExecutionState,
  isExecutionState,
  withExecutionState,
} from "./repl-runtime-state.js";

export const TRANSITION_SELECTION_STRATEGY = Object.freeze({
  BEST_SCORE: "best-score",
  MAX_CONFIDENCE: "max-confidence",
  DETERMINISTIC_FIRST: "deterministic-first",
  RANDOM_SEEDED: "random-seeded",
});

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
    transitionSelectionStrategy: options.transitionSelectionStrategy
      || options.selectionStrategy
      || TRANSITION_SELECTION_STRATEGY.DETERMINISTIC_FIRST,
    transitionSelectionSeed: options.transitionSelectionSeed ?? options.selectionSeed ?? 0,
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
    transitionSelectionStrategy: incoming.transitionSelectionStrategy
      || incoming.selectionStrategy
      || TRANSITION_SELECTION_STRATEGY.DETERMINISTIC_FIRST,
    transitionSelectionSeed: incoming.transitionSelectionSeed ?? incoming.selectionSeed ?? 0,
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

  function executeStatement(statementNode, state){
    const transitions = expandStatement(statementNode, state);
    const selection = selectTransitionForMode(transitions, state);
    const transition = selection?.transition || null;
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
    if (selection?.diagnostics?.length){
      const currentDiagnostics = Array.isArray(transition.toState?.diagnostics)
        ? transition.toState.diagnostics
        : [];
      transition.toState = {
        ...transition.toState,
        diagnostics: [...currentDiagnostics, ...selection.diagnostics],
      };
    }
    return {
      nextState: transition.toState || withModeAppliedState(state),
      record: transition.record || null,
      transition,
    };
  }

  function toFiniteNumber(value, fallback){
    return Number.isFinite(value) ? value : fallback;
  }

  function normalizeSeed(seed){
    if (typeof seed === "number" && Number.isFinite(seed)){
      return Math.floor(seed) >>> 0;
    }
    const str = String(seed ?? "");
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1){
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom01(seed){
    const s = normalizeSeed(seed);
    let x = s || 1;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 4294967296);
  }

  function rankTransitions(transitions, strategy, seed){
    const entries = transitions.map((transition, index) => {
      const scoreDelta = toFiniteNumber(transition?.scoreDelta, 0);
      const confidence = toFiniteNumber(transition?.confidence, 1);
      return {
        transition,
        index,
        scoreDelta,
        confidence,
        combined: scoreDelta + confidence,
        randomScore: seededRandom01(`${seed}:${index}:${transition?.id || transition?.transitionType || "transition"}`),
      };
    });

    entries.sort((a, b) => {
      if (strategy === "max-confidence"){
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (b.scoreDelta !== a.scoreDelta) return b.scoreDelta - a.scoreDelta;
      }else if (strategy === "best-score"){
        if (b.combined !== a.combined) return b.combined - a.combined;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (b.scoreDelta !== a.scoreDelta) return b.scoreDelta - a.scoreDelta;
      }else if (strategy === "random-seeded"){
        if (b.randomScore !== a.randomScore) return b.randomScore - a.randomScore;
      }
      return a.index - b.index;
    });
    return entries;
  }

  function selectTransitionForMode(transitions, stateInput = null){
    if (!Array.isArray(transitions) || transitions.length === 0){
      return { transition: null, diagnostics: [] };
    }
    const state = withModeAppliedState(stateInput);
    const mode = state.mode || "commit";
    const requestedStrategy = String(state.transitionSelectionStrategy || "deterministic-first");
    const validStrategies = new Set(Object.values(TRANSITION_SELECTION_STRATEGY));
    const strategy = validStrategies.has(requestedStrategy)
      ? requestedStrategy
      : TRANSITION_SELECTION_STRATEGY.DETERMINISTIC_FIRST;
    const seed = state.transitionSelectionSeed ?? `${mode}:${transitions.length}`;
    const ranking = rankTransitions(transitions, strategy, seed);
    const winner = ranking[0]?.transition || transitions[0];
    const dropped = ranking.slice(1);
    const diagnostics = dropped.map((entry, rankOffset) => ({
      kind: "candidate-dropped",
      reason: "not-selected-by-policy",
      mode,
      policy: strategy,
      selectedTransitionId: winner?.id || null,
      droppedTransitionId: entry.transition?.id || null,
      ranking: rankOffset + 2,
      totalCandidates: ranking.length,
      scoreDelta: entry.scoreDelta,
      confidence: entry.confidence,
      meta: entry.transition?.meta || {},
    }));
    return { transition: winner, diagnostics };
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

    const buildCandidateTransitions = (candidates, buildTransition) => {
      const transitions = [];
      const droppedDiagnostics = [];
      (Array.isArray(candidates) ? candidates : []).forEach((candidate, index) => {
        if (!candidate || typeof candidate !== "object"){
          droppedDiagnostics.push({
            kind: "candidate-dropped",
            reason: "invalid-candidate",
            mode: execState.mode,
            statementKind: statementNode.kind,
            ranking: index + 1,
          });
          return;
        }
        const built = buildTransition(candidate, index);
        if (built) transitions.push(built);
        else{
          droppedDiagnostics.push({
            kind: "candidate-dropped",
            reason: "candidate-builder-returned-null",
            mode: execState.mode,
            statementKind: statementNode.kind,
            ranking: index + 1,
            meta: candidate.meta || {},
          });
        }
      });
      return { transitions, droppedDiagnostics };
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
      const { transitions, droppedDiagnostics } = buildCandidateTransitions(valueCandidates, (candidate) => {
        const candidateEnv = cloneEnv(execState.env);
        candidateEnv[statementNode.name] = candidate.value;
        const transitionType = candidate.transitionType || "expression-default";
        const transitionMeta = candidate.meta || {};
        const [transition] = finalizeTransition({
          type: "assign",
          value: candidate.value,
          meta: {
            assignedName: statementNode.name,
            expressionStrategy: transitionType,
            expressionTrace: expressionTrace || [],
            ...transitionMeta,
          },
          changedSymbols: [statementNode.name],
          effects: [{ kind: "write-symbol", symbol: statementNode.name, value: candidate.value }],
        }, {
          transitionType,
          scoreDelta: Number.isFinite(candidate.scoreDelta) ? candidate.scoreDelta : 0,
          confidence: Number.isFinite(candidate.confidence) ? candidate.confidence : 1,
          meta: transitionMeta,
          canonicalKey: `assign|${statementNode.nodeId || "no-node"}|${statementNode.name}|${candidate.transitionType || "expression-default"}`,
          strategy: candidate.transitionType || "expression-default",
          reasoningTags: ["assign", "expression-eval"],
          meta: {
            assignedName: statementNode.name,
          },
        });
        transition.toState = { ...transition.toState, env: candidateEnv };
        transition.record.after = snapshotStateRef(transition.toState);
        return transition;
      });
      if (transitions.length){
        if (droppedDiagnostics.length){
          transitions.forEach((transition) => {
            transition.toState = {
              ...transition.toState,
              diagnostics: [...(transition.toState.diagnostics || []), ...droppedDiagnostics],
            };
          });
        }
        return transitions;
      }
      throw new Error("Assignment produced no expression candidates.");
    }

    if (statementNode.kind === STATEMENT_TYPE.EQUATION){
      const solvedCandidates = typeof solveEquationCandidates === "function"
        ? solveEquationCandidates(statementNode.left, statementNode.right)
        : [solveEquation(statementNode.left, statementNode.right)];
      const { transitions, droppedDiagnostics } = buildCandidateTransitions(solvedCandidates, (solved) => {
        const transitionType = solved.transitionType || "equation-solve";
        const transitionMeta = solved.meta || {};
        const transitionInput = {
          transitionType,
          scoreDelta: Number.isFinite(solved?.scoreDelta) ? solved.scoreDelta : 0,
          confidence: Number.isFinite(solved?.confidence) ? solved.confidence : 1,
          meta: transitionMeta,
          canonicalKey: `equation|${statementNode.nodeId || "no-node"}|${solved?.unknown?.name || "unknown"}|${solved?.strategy || "numeric-solve"}`,
          strategy: solved?.strategy || "numeric-solve",
          reasoningTags: ["equation", "solver"],
          meta: {
            unknownName: solved?.unknown?.name || null,
          },
        };
        if (solved?.unknown?.unitToken){
          const [transition] = finalizeTransition({
            type: "equation",
            value: makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind),
            meta: {
              unknownName: solved.unknown.name,
              usedUnitToken: true,
              strategy: solved.strategy || "numeric-solve",
              expressionTrace: expressionTrace || [],
              ...transitionMeta,
            },
          }, transitionInput);
          transition.toState = { ...transition.toState, env: cloneEnv(execState.env) };
          transition.record.after = snapshotStateRef(transition.toState);
          return transition;
        }
        const candidateEnv = cloneEnv(execState.env);
        candidateEnv[solved.unknown.name] = solved.value;
        const [transition] = finalizeTransition({
          type: "equation",
          value: solved.value,
          meta: {
            unknownName: solved.unknown.name,
            usedUnitToken: false,
            strategy: solved.strategy || "numeric-solve",
            expressionTrace: expressionTrace || [],
            ...transitionMeta,
          },
          changedSymbols: [solved.unknown.name],
          effects: [{ kind: "write-symbol", symbol: solved.unknown.name, value: solved.value }],
        }, transitionInput);
        transition.toState = { ...transition.toState, env: candidateEnv };
        transition.record.after = snapshotStateRef(transition.toState);
        return transition;
      });
      if (transitions.length){
        if (droppedDiagnostics.length){
          transitions.forEach((transition) => {
            transition.toState = {
              ...transition.toState,
              diagnostics: [...(transition.toState.diagnostics || []), ...droppedDiagnostics],
            };
          });
        }
        return transitions;
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
          ...(candidate.meta || {}),
        },
      }, {
        transitionType: candidate.transitionType || "expression-default",
        scoreDelta: Number.isFinite(candidate.scoreDelta) ? candidate.scoreDelta : 0,
        confidence: Number.isFinite(candidate.confidence) ? candidate.confidence : 1,
        meta: candidate.meta || {},
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
    expandStatement,
    selectTransitionForMode,
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
