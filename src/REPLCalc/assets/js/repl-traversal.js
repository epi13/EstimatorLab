import { cloneEnv, withExecutionState } from "./repl-runtime-state.js";
import {
  createTraversalNode,
  deriveTraversalCanonicalKey,
  transitionTraversalNodeStatus,
  updateTraversalNodeMetadata,
  TRAVERSAL_NODE_STATUSES,
} from "./repl-traversal-state.js";

export const TRAVERSAL_POLICIES = Object.freeze({
  BEST_FIRST: "best_first",
  BEAM: "beam",
  DEPTH_LIMITED: "depth_limited",
  GREEDY: "greedy",
  EXHAUSTIVE_SMALL: "exhaustive_small",
});

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

  const buildWrapper = (input) => {
    const execState = withExecutionState(input.execState || input);
    const statementIndex = Number.isInteger(input.statementIndex) ? Math.max(0, input.statementIndex) : 0;
    const blockId = input.blockNode?.blockId || null;
    const localCanonicalKey = deriveTraversalCanonicalKey(execState, canonicalStateKey, input.canonicalKey || null);
    const canonicalKey = localCanonicalKey
      ? `${blockId || "no-block"}:stmt:${statementIndex}:${localCanonicalKey}`
      : null;
    return createTraversalNode({
      id: input.id || null,
      execState,
      score: toNumber(input.score, 0),
      confidence: toNumber(input.confidence, 1),
      depth: Math.max(0, Math.floor(toNumber(input.depth, 0))),
      blockNode: input.blockNode || null,
      statementIndex,
      parentId: input.parentId || null,
      viaTransitionId: input.viaTransitionId || input.transitionId || null,
      canonicalKey,
      isTerminal: input.isTerminal === true,
      terminationReason: input.terminationReason || null,
      status: input.status || TRAVERSAL_NODE_STATUSES.PENDING,
    });
  };

  const expandTraversalState = (statementNode, wrapperState, traversalConfig = {}) => {
    const baseState = buildWrapper(wrapperState);
    const targetBlock = baseState.blockNode;
    if (targetBlock){
      return expandBlock(targetBlock, baseState, traversalConfig);
    }
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
      return buildWrapper({
        execState: nextExec,
        score,
        confidence,
        depth: baseState.depth + 1,
        blockNode: null,
        statementIndex: 0,
        parentId: baseState.id,
        transitionId: transition?.id || null,
        viaTransitionId: transition?.id || null,
        canonicalKey: deriveTraversalCanonicalKey(nextExec, canonicalStateKey, null),
        status: TRAVERSAL_NODE_STATUSES.PENDING,
      });
    });
  };

  const expandBlock = (blockNode, traversalNode, traversalConfig = {}) => {
    const baseState = buildWrapper({ ...traversalNode, blockNode });
    const statements = Array.isArray(blockNode?.statements) ? blockNode.statements : [];

    if (baseState.statementIndex >= statements.length){
      return [buildWrapper({
        execState: baseState.execState,
        score: baseState.score,
        confidence: baseState.confidence,
        depth: baseState.depth,
        blockNode,
        statementIndex: baseState.statementIndex,
        parentId: baseState.id,
        transitionId: null,
        canonicalKey: baseState.canonicalKey,
        isTerminal: true,
        terminationReason: "end-of-block",
      })];
    }

    const statementNode = statements[baseState.statementIndex];
    const expansions = expandStatement({
      statementNode,
      traversalState: baseState.execState,
      mode: traversalConfig.mode || "speculate",
      detachFromCommit: traversalConfig.detachFromCommit !== false,
    });
    const transitions = Array.isArray(expansions) ? expansions : [];
    const nextStatementIndex = baseState.statementIndex + 1;

    return transitions.map((transition) => {
      const nextExec = withExecutionState(transition?.toState || baseState.execState, cloneEnv(baseState.execState.env));
      const score = scoreTransitionFn(transition, baseState.score);
      const confidence = confidenceTransitionFn(transition, baseState.confidence);
      const isTerminal = nextStatementIndex >= statements.length;
      return buildWrapper({
        execState: nextExec,
        score,
        confidence,
        depth: baseState.depth + 1,
        blockNode,
        statementIndex: nextStatementIndex,
        parentId: baseState.id,
        transitionId: transition?.id || null,
        isTerminal,
        terminationReason: isTerminal ? "end-of-block" : null,
      });
    });
  };

  const isValidGoalState = (state, threshold) => {
    if (!state || state.isTerminal !== true) return false;
    if (!Number.isFinite(threshold)) return true;
    return rankState(state) >= threshold;
  };

  const normalizeGoal = (goalInput = null) => {
    if (typeof goalInput === "string"){
      return { strategy: goalInput, topN: 1, threshold: null };
    }
    const goal = goalInput && typeof goalInput === "object" ? goalInput : {};
    return {
      strategy: goal.strategy || goal.kind || "first-valid",
      topN: Number.isFinite(goal.topN) ? Math.max(1, Math.floor(goal.topN)) : 1,
      threshold: Number.isFinite(goal.threshold) ? goal.threshold : null,
      depthLimit: Number.isFinite(goal.depthLimit) ? Math.max(0, Math.floor(goal.depthLimit)) : null,
      nodeBudget: Number.isFinite(goal.nodeBudget) ? Math.max(1, Math.floor(goal.nodeBudget)) : null,
      expansionBudget: Number.isFinite(goal.expansionBudget) ? Math.max(1, Math.floor(goal.expansionBudget)) : null,
    };
  };

  const runTraversal = ({
    statementNode,
    blockNode = null,
    initialState,
    policy = TRAVERSAL_POLICIES.BEST_FIRST,
    budget = {},
    goal = null,
    beamWidth = 4,
    prune = null,
    mode = "speculate",
  } = {}) => {
    const normalizedGoal = normalizeGoal(goal);
    const normalizedPolicy = normalizePolicy(policy);
    const normalizedBudget = makeBudget({
      ...budget,
      ...(normalizedPolicy === TRAVERSAL_POLICIES.EXHAUSTIVE_SMALL
      ? { nodeBudget: budget.nodeBudget ?? 128, expansionBudget: budget.expansionBudget ?? 128 }
      : {}),
      ...(normalizedGoal.depthLimit !== null ? { depthLimit: normalizedGoal.depthLimit } : {}),
      ...(normalizedGoal.nodeBudget !== null ? { nodeBudget: normalizedGoal.nodeBudget } : {}),
      ...(normalizedGoal.expansionBudget !== null ? { expansionBudget: normalizedGoal.expansionBudget } : {}),
    });

    const frontier = createFrontier(normalizedPolicy, Math.max(1, Math.floor(beamWidth)));
    let start = buildWrapper(initialState || {
      execState: withExecutionState({ env: Object.create(null), mode }),
      blockNode: blockNode || null,
      statementIndex: 0,
    });
    start = transitionTraversalNodeStatus(start, TRAVERSAL_NODE_STATUSES.FRONTIER);
    const visited = new Map();
    const expanded = [];
    const goalMatches = [];
    const traceGraph = {
      nodes: [{
        id: start.id,
        parentId: null,
        depth: start.depth,
        score: start.score,
        confidence: start.confidence,
        canonicalKey: start.canonicalKey,
        statementIndex: start.statementIndex,
        blockId: start.blockNode?.blockId || null,
        isTerminal: start.isTerminal,
        status: start.status,
      }],
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

      const popped = frontier.pop();
      const current = popped ? transitionTraversalNodeStatus(popped, TRAVERSAL_NODE_STATUSES.EXPANDED) : null;
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

        const frontierSuccessor = updateTraversalNodeMetadata(
          transitionTraversalNodeStatus(successor, TRAVERSAL_NODE_STATUSES.FRONTIER),
          {},
        );
        traceGraph.nodes.push({
          id: frontierSuccessor.id,
          parentId: frontierSuccessor.parentId,
          depth: frontierSuccessor.depth,
          score: frontierSuccessor.score,
          confidence: frontierSuccessor.confidence,
          canonicalKey: frontierSuccessor.canonicalKey,
          statementIndex: frontierSuccessor.statementIndex,
          blockId: frontierSuccessor.blockNode?.blockId || null,
          isTerminal: frontierSuccessor.isTerminal,
          status: frontierSuccessor.status,
        });
        traceGraph.edges.push({
          from: current.id,
          to: frontierSuccessor.id,
          viaTransitionId: frontierSuccessor.viaTransitionId,
        });

        if (isValidGoalState(successor, normalizedGoal.threshold)){
          goalMatches.push(successor);
          if (normalizedGoal.strategy === "first-valid"){
            frontier.clear();
            accepted.length = 0;
            break;
          }
        }
        accepted.push(frontierSuccessor);
      }

      frontier.pushAll(accepted);
      frontier.trim(normalizedBudget.frontierBudget);

      if (normalizedGoal.strategy === "first-valid" && goalMatches.length > 0){
        diagnostics.push({ kind: "goal-hit", stateId: goalMatches[0].id, strategy: normalizedGoal.strategy });
        break;
      }
      if (normalizedGoal.strategy === "top-N" && goalMatches.length >= normalizedGoal.topN){
        diagnostics.push({ kind: "goal-hit", stateId: goalMatches[goalMatches.length - 1].id, strategy: normalizedGoal.strategy });
        break;
      }
    }

    const ranked = expanded.slice().sort((a, b) => rankState(b) - rankState(a));
    const rankedGoalMatches = goalMatches.slice().sort((a, b) => rankState(b) - rankState(a));
    return {
      policy: normalizedPolicy,
      budget: normalizedBudget,
      goal: normalizedGoal,
      expanded,
      frontier: frontier.toArray(),
      visited,
      best: rankedGoalMatches[0] || ranked[0] || start,
      goalMatches: normalizedGoal.strategy === "top-N"
        ? rankedGoalMatches.slice(0, normalizedGoal.topN)
        : rankedGoalMatches,
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
    expandBlock,
    runTraversal,
  };
}
