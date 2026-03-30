import { cloneEnv, withExecutionState } from "./repl-runtime-state.js";

export const TRAVERSAL_POLICIES = Object.freeze({
  BEST_FIRST: "best_first",
  BEAM: "beam",
  DEPTH_LIMITED: "depth_limited",
  GREEDY: "greedy",
  EXHAUSTIVE_SMALL: "exhaustive_small",
});

let traversalStateId = 0;

function nextTraversalStateId(){
  traversalStateId += 1;
  return `ts-${traversalStateId}`;
}

function toNumber(value, fallback = 0){
  return Number.isFinite(value) ? value : fallback;
}

function scoreTransition(transition, baseScore){
  const delta = toNumber(transition?.scoreDelta, 0);
  return baseScore + delta;
}

function confidenceTransition(transition, priorConfidence){
  const stepConfidence = toNumber(transition?.confidence, 1);
  return priorConfidence * stepConfidence;
}

function rankState(state){
  return state.score + state.confidence;
}

function normalizePolicy(policy){
  if (Object.values(TRAVERSAL_POLICIES).includes(policy)) return policy;
  return TRAVERSAL_POLICIES.BEST_FIRST;
}

function makeBudget(options = {}){
  const nodeBudget = Number.isFinite(options.nodeBudget) ? options.nodeBudget : 256;
  const expansionBudget = Number.isFinite(options.expansionBudget) ? options.expansionBudget : nodeBudget;
  const frontierBudget = Number.isFinite(options.frontierBudget) ? options.frontierBudget : Math.max(32, nodeBudget);
  const depthLimit = Number.isFinite(options.depthLimit)
    ? Math.max(0, Math.floor(options.depthLimit))
    : Number.POSITIVE_INFINITY;
  return {
    nodeBudget,
    expansionBudget,
    frontierBudget,
    depthLimit,
  };
}

function createTraversalState({
  execState,
  score = 0,
  confidence = 1,
  depth = 0,
  parentId = null,
  transitionId = null,
  canonicalKey = null,
  id = null,
}){
  return {
    id: id || nextTraversalStateId(),
    execState,
    score,
    confidence,
    depth,
    parentId,
    transitionId,
    canonicalKey,
  };
}

function createFrontier(policy, beamWidth = 4){
  const entries = [];

  const sortBestFirst = () => {
    entries.sort((a, b) => {
      const rankDiff = rankState(b) - rankState(a);
      if (rankDiff !== 0) return rankDiff;
      return a.depth - b.depth;
    });
  };

  return {
    size(){
      return entries.length;
    },
    clear(){
      entries.length = 0;
    },
    pushAll(states){
      const incoming = Array.isArray(states) ? states : [];
      if (!incoming.length) return;

      if (policy === TRAVERSAL_POLICIES.GREEDY){
        let best = incoming[0];
        for (const state of incoming){
          if (rankState(state) > rankState(best)) best = state;
        }
        entries.length = 0;
        entries.push(best);
        return;
      }

      if (policy === TRAVERSAL_POLICIES.BEAM){
        entries.push(...incoming);
        sortBestFirst();
        entries.splice(beamWidth);
        return;
      }

      if (policy === TRAVERSAL_POLICIES.DEPTH_LIMITED){
        entries.push(...incoming);
        return;
      }

      entries.push(...incoming);
      sortBestFirst();
    },
    pop(){
      if (!entries.length) return null;
      if (policy === TRAVERSAL_POLICIES.DEPTH_LIMITED){
        return entries.pop();
      }
      return entries.shift();
    },
    trim(maxSize){
      if (entries.length <= maxSize) return;
      if (policy === TRAVERSAL_POLICIES.DEPTH_LIMITED){
        entries.splice(0, entries.length - maxSize);
        return;
      }
      entries.splice(maxSize);
    },
    toArray(){
      return entries.slice();
    },
  };
}

export function createReplTraversal({
  expandStatement,
  canonicalStateKey = null,
  scoreTransitionFn = scoreTransition,
  confidenceTransitionFn = confidenceTransition,
} = {}){
  if (typeof expandStatement !== "function"){
    throw new Error("createReplTraversal requires an expandStatement function.");
  }

  const getCanonicalKey = (execState, fallback = null) => {
    if (typeof canonicalStateKey !== "function") return fallback;
    try{
      return canonicalStateKey(execState);
    }catch {
      return fallback;
    }
  };

  const buildWrapper = (input) => {
    const execState = withExecutionState(input.execState || input);
    const canonicalKey = getCanonicalKey(execState, input.canonicalKey || null);
    return createTraversalState({
      id: input.id || null,
      execState,
      score: toNumber(input.score, 0),
      confidence: toNumber(input.confidence, 1),
      depth: Math.max(0, Math.floor(toNumber(input.depth, 0))),
      parentId: input.parentId || null,
      transitionId: input.transitionId || null,
      canonicalKey,
    });
  };

  const expandTraversalState = (statementNode, wrapperState, traversalConfig = {}) => {
    const baseState = buildWrapper(wrapperState);
    const expansions = expandStatement({
      statementNode,
      traversalState: baseState.execState,
      mode: traversalConfig.mode || "speculate",
    });

    const transitions = Array.isArray(expansions) ? expansions : [];
    return transitions.map((transition) => {
      const nextExec = withExecutionState(transition?.toState || baseState.execState, cloneEnv(baseState.execState.env));
      const score = scoreTransitionFn(transition, baseState.score);
      const confidence = confidenceTransitionFn(transition, baseState.confidence);
      return createTraversalState({
        execState: nextExec,
        score,
        confidence,
        depth: baseState.depth + 1,
        parentId: baseState.id,
        transitionId: transition?.id || null,
        canonicalKey: getCanonicalKey(nextExec, null),
      });
    });
  };

  const runTraversal = ({
    statementNode,
    initialState,
    policy = TRAVERSAL_POLICIES.BEST_FIRST,
    budget = {},
    beamWidth = 4,
    prune = null,
    mode = "speculate",
  } = {}) => {
    const normalizedPolicy = normalizePolicy(policy);
    const normalizedBudget = makeBudget({ ...budget, ...(normalizedPolicy === TRAVERSAL_POLICIES.EXHAUSTIVE_SMALL
      ? { nodeBudget: budget.nodeBudget ?? 128, expansionBudget: budget.expansionBudget ?? 128 }
      : {}) });

    const frontier = createFrontier(normalizedPolicy, Math.max(1, Math.floor(beamWidth)));
    const start = buildWrapper(initialState || { execState: withExecutionState({ env: Object.create(null), mode }) });
    const visited = new Map();
    const expanded = [];
    const traceGraph = {
      nodes: [{ id: start.id, parentId: null, depth: start.depth, score: start.score, confidence: start.confidence, canonicalKey: start.canonicalKey }],
      edges: [],
    };
    const diagnostics = [];

    if (start.canonicalKey) visited.set(start.canonicalKey, start);
    frontier.pushAll([start]);

    let expansions = 0;
    let pruned = 0;

    while (frontier.size() > 0){
      if (expanded.length >= normalizedBudget.nodeBudget) break;
      if (expansions >= normalizedBudget.expansionBudget) break;

      const current = frontier.pop();
      if (!current) break;
      if (current.depth >= normalizedBudget.depthLimit){
        diagnostics.push({ kind: "depth-limit", stateId: current.id, depth: current.depth });
        continue;
      }

      expanded.push(current);
      expansions += 1;

      const successors = expandTraversalState(statementNode, current, { mode });
      const accepted = [];

      for (const successor of successors){
        if (typeof prune === "function" && prune(successor, current)){
          pruned += 1;
          diagnostics.push({ kind: "pruned", stateId: successor.id, parentId: current.id, reason: "predicate" });
          continue;
        }

        if (successor.canonicalKey){
          const seen = visited.get(successor.canonicalKey);
          if (seen && rankState(seen) >= rankState(successor)){
            pruned += 1;
            diagnostics.push({ kind: "pruned", stateId: successor.id, parentId: current.id, reason: "visited" });
            continue;
          }
          visited.set(successor.canonicalKey, successor);
        }

        traceGraph.nodes.push({
          id: successor.id,
          parentId: successor.parentId,
          depth: successor.depth,
          score: successor.score,
          confidence: successor.confidence,
          canonicalKey: successor.canonicalKey,
        });
        traceGraph.edges.push({
          from: current.id,
          to: successor.id,
          transitionId: successor.transitionId,
        });
        accepted.push(successor);
      }

      frontier.pushAll(accepted);
      frontier.trim(normalizedBudget.frontierBudget);
    }

    const ranked = expanded.slice().sort((a, b) => rankState(b) - rankState(a));
    return {
      policy: normalizedPolicy,
      budget: normalizedBudget,
      expanded,
      frontier: frontier.toArray(),
      visited,
      best: ranked[0] || start,
      diagnostics,
      metrics: {
        expandedCount: expanded.length,
        visitedCount: visited.size,
        prunedCount: pruned,
      },
      traceGraph,
    };
  };

  return {
    buildWrapper,
    expandTraversalState,
    runTraversal,
  };
}
