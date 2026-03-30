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

function createReplExecutor({
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

    let nextState = withExecutionState(transition.toState || base, base.env);
    if (mode === "speculate" || mode === "plan"){
      nextState = { ...nextState, env: cloneEnv(nextState.env || Object.create(null)) };
    }else if (mode === "commit" && base.primaryEnv && nextState.env !== base.primaryEnv){
      const nextEnv = nextState.env || Object.create(null);
      for (const key of Object.keys(base.primaryEnv)){
        if (!Object.prototype.hasOwnProperty.call(nextEnv, key)) delete base.primaryEnv[key];
      }
      Object.assign(base.primaryEnv, nextEnv);
      nextState = { ...nextState, env: base.primaryEnv };
    }

    const record = transition.record || null;
    if (record){
      record.mode = nextState.mode;
      if (!record.before) record.before = snapshotStateRef(base);
      record.after = snapshotStateRef(nextState);
    }

    return {
      nextState,
      record,
      transition: {
        ...transition,
        toState: nextState,
        record,
      },
    };
  }

  function selectTransitionForPolicy(policy, transitions, stateInput = null){
    return selectTransitionForMode(transitions, {
      ...(stateInput || {}),
      transitionSelectionStrategy: policy,
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

export { createReplExecutor };
export const createExecutor = createReplExecutor;
