/**
 * @typedef {Object} Transition
 * @property {string} transitionType
 * @property {object|null} fromState
 * @property {object|null} toState
 * @property {string|null} fromStateId
 * @property {string|null} toStateId
 * @property {object|null} record
 * @property {string|null} statementNodeId
 * @property {string} canonicalKey
 * @property {object} meta
 * @property {number} scoreDelta
 * @property {number} confidence
 * @property {number} cost
 * @property {object} meta
 * @property {string} id
 */

let transitionNonce = 0;
let transitionSequence = 0;

function safeFiniteNumber(value, fallback, { min = -Infinity, max = Infinity } = {}){
  const numeric = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function stableStringify(value){
  if (value === null || typeof value !== "object"){
    return JSON.stringify(value);
  }
  if (Array.isArray(value)){
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function stableHash(value){
  const input = typeof value === "string" ? value : stableStringify(value);
  let hash = 5381;
  for (let idx = 0; idx < input.length; idx += 1){
    hash = ((hash << 5) + hash) ^ input.charCodeAt(idx);
  }
  return (hash >>> 0).toString(36);
}

function deriveStateId(state, fallbackLabel){
  if (!state || typeof state !== "object"){
    return null;
  }
  if (typeof state.stateId === "string" && state.stateId){
    return state.stateId;
  }
  const descriptor = {
    mode: state.mode || null,
    contextPath: Array.isArray(state.contextPath) ? state.contextPath : [],
    envKeys: state.env && typeof state.env === "object" ? Object.keys(state.env).sort() : [],
  };
  const digest = stableHash(descriptor);
  return `${fallbackLabel}-${digest}`;
}

function buildCanonicalKey({
  transitionType,
  fromStateId,
  toStateId,
  statementNodeId,
  canonicalKey,
}){
  if (typeof canonicalKey === "string" && canonicalKey.trim()){
    return canonicalKey.trim();
  }
  return [
    transitionType || "unknown",
    fromStateId || "none",
    toStateId || "none",
    statementNodeId || "none",
  ].join("|");
}

function withProvenance(meta = {}, {
  sourceModule = "repl-transitions",
  strategy = "default",
  reasoningTags = [],
  sequence = null,
} = {}){
  transitionSequence += 1;
  const provenance = {
    sourceModule,
    strategy,
    sequence: Number.isFinite(sequence) ? sequence : transitionSequence,
    timestamp: new Date().toISOString(),
    reasoningTags: Array.isArray(reasoningTags) ? reasoningTags.filter(Boolean) : [],
  };
  return {
    ...(meta || {}),
    provenance,
  };
}

export function createTransition({
  transitionType = "unknown",
  fromState = null,
  toState = null,
  record = null,
  fromStateId = null,
  toStateId = null,
  statementNodeId = null,
  canonicalKey = "",
  meta = {},
  scoreDelta = 0,
  confidence = 1,
  cost = 0,
  id = null,
  sourceModule = "repl-transitions",
  strategy = "default",
  reasoningTags = [],
  sequence = null,
} = {}){
  const resolvedFromStateId = fromStateId || deriveStateId(fromState, "from");
  const resolvedToStateId = toStateId || deriveStateId(toState, "to");
  const resolvedStatementNodeId = statementNodeId || record?.statementNodeId || record?.statementNode?.nodeId || null;
  const resolvedCanonicalKey = buildCanonicalKey({
    transitionType,
    fromStateId: resolvedFromStateId,
    toStateId: resolvedToStateId,
    statementNodeId: resolvedStatementNodeId,
    canonicalKey,
  });
  const scoreDeltaNormalized = safeFiniteNumber(scoreDelta, 0, { min: -1000, max: 1000 });
  const confidenceNormalized = safeFiniteNumber(confidence, 1, { min: 0, max: 1 });
  const costNormalized = safeFiniteNumber(cost, 0, { min: 0, max: 1_000_000 });
  const deterministicInput = `${transitionType}|${resolvedFromStateId || "none"}|${resolvedToStateId || "none"}|${resolvedStatementNodeId || "none"}|${resolvedCanonicalKey}`;
  let resolvedId = id;
  if (!resolvedId){
    const stableId = `transition-${stableHash(deterministicInput)}`;
    if (deterministicInput.includes("none|none|none|")){
      transitionNonce += 1;
      resolvedId = `${stableId}-n${transitionNonce}`;
    }else{
      resolvedId = stableId;
    }
  }

  return {
    transitionType,
    fromState,
    toState,
    fromStateId: resolvedFromStateId,
    toStateId: resolvedToStateId,
    record,
    statementNodeId: resolvedStatementNodeId,
    canonicalKey: resolvedCanonicalKey,
    meta: withProvenance(meta, { sourceModule, strategy, reasoningTags, sequence }),
    scoreDelta: scoreDeltaNormalized,
    confidence: confidenceNormalized,
    cost: costNormalized,
    id: resolvedId,
  };
}
