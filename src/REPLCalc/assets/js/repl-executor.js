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
