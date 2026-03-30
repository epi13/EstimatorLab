function clonePath(path){
  return Array.isArray(path) ? path.slice() : [];
}

export function cloneEnv(env){
  return Object.assign(Object.create(null), env || Object.create(null));
}

export function isExecutionState(value){
  return Boolean(
    value
    && typeof value === "object"
    && value.__executionState === true
    && value.env
    && typeof value.mode === "string"
  );
}

export function createExecutionState({
  env,
  mode = "commit",
  effectsAllowed,
  contextPath = [],
  trace = [],
  diagnostics = [],
  provenance = [],
  score,
  allowCommands = false,
  wrapErrors = false,
  traceExpressions = false,
  captureResults = true,
  commandErrorMessage = null,
  transitionSelectionStrategy = "deterministic-first",
  transitionSelectionSeed = 0,
} = {}){
  if (!env || typeof env !== "object"){
    throw new Error("ExecutionState requires an env object.");
  }

  return {
    __executionState: true,
    env,
    mode,
    effectsAllowed,
    contextPath: clonePath(contextPath),
    trace: Array.isArray(trace) ? trace.slice() : [],
    diagnostics: Array.isArray(diagnostics) ? diagnostics.slice() : [],
    provenance: Array.isArray(provenance) ? provenance.slice() : [],
    ...(typeof score === "number" ? { score } : {}),
    allowCommands: Boolean(allowCommands),
    wrapErrors: Boolean(wrapErrors),
    traceExpressions: Boolean(traceExpressions),
    captureResults: captureResults !== false,
    commandErrorMessage: commandErrorMessage || null,
    transitionSelectionStrategy: transitionSelectionStrategy || "deterministic-first",
    transitionSelectionSeed: transitionSelectionSeed ?? 0,
  };
}

export function withExecutionState(input, fallbackEnv = null){
  if (isExecutionState(input)) return input;
  if (!input || typeof input !== "object"){
    return createExecutionState({ env: fallbackEnv || Object.create(null) });
  }

  const env = input.env && typeof input.env === "object"
    ? input.env
    : (fallbackEnv || Object.create(null));

  return createExecutionState({
    env,
    mode: input.mode || "commit",
    effectsAllowed: input.effectsAllowed ?? input.allowedEffects,
    contextPath: input.contextPath,
    trace: input.trace,
    diagnostics: input.diagnostics,
    provenance: input.provenance,
    score: input.score,
    allowCommands: Boolean(input.allowCommands),
    wrapErrors: Boolean(input.wrapErrors),
    traceExpressions: Boolean(input.traceExpressions),
    captureResults: input.captureResults !== false,
    commandErrorMessage: input.commandErrorMessage || null,
    transitionSelectionStrategy: input.transitionSelectionStrategy || input.selectionStrategy || "deterministic-first",
    transitionSelectionSeed: input.transitionSelectionSeed ?? input.selectionSeed ?? 0,
  });
}

export function stateWithContext(state, ...labels){
  const nextLabels = labels.filter((label) => typeof label === "string" && label.trim());
  return {
    ...state,
    contextPath: [...clonePath(state?.contextPath), ...nextLabels],
  };
}
