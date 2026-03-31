import { createEnvOverlay, withExecutionState } from "./repl-runtime-state.js";
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

export const TRAVERSAL_OUTPUT_MODES = Object.freeze({
  FULL: "full",
  SUMMARY: "summary",
  STREAM: "stream",
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

function clampPositiveInt(value, fallback){
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}


function projectTraversalNode(node){
  if (!node || typeof node !== "object") return null;
  return {
    id: node.id,
    parentId: node.parentId,
    depth: node.depth,
    score: node.score,
    confidence: node.confidence,
    canonicalKey: node.canonicalKey,
    statementIndex: node.statementIndex,
    blockId: node.blockNode?.blockId || null,
    isTerminal: node.isTerminal,
    status: node.status,
  };
}

function createRingBuffer(maxSize){
  const limit = clampPositiveInt(maxSize, 64);
  const entries = [];
  return {
    push(value){
      entries.push(value);
      if (entries.length > limit) entries.shift();
    },
    toArray(){
      return entries.slice();
    },
  };
}

function makeBudget(options = {}){
  const nodeBudget = Number.isFinite(options.nodeBudget) ? options.nodeBudget : 256;
  const expansionBudget = Number.isFinite(options.expansionBudget) ? options.expansionBudget : nodeBudget;
  const frontierBudget = Number.isFinite(options.frontierBudget) ? options.frontierBudget : Math.max(32, nodeBudget);
  const depthLimit = Number.isFinite(options.depthLimit)
    ? Math.max(0, Math.floor(options.depthLimit))
    : Number.POSITIVE_INFINITY;
  const maxTraceNodes = clampPositiveInt(options.maxTraceNodes, 256);
  const maxTraceEdges = clampPositiveInt(options.maxTraceEdges, 512);
  const maxDiagnostics = clampPositiveInt(options.maxDiagnostics, 256);
  const streamBufferSize = clampPositiveInt(options.streamBufferSize, 64);
  const bestKFrontier = clampPositiveInt(options.bestKFrontier, 8);
  const minBudgetScale = Number.isFinite(options.minBudgetScale) ? Math.max(0.2, Math.min(1, options.minBudgetScale)) : 0.35;
  const pressureTargetFrameMs = Number.isFinite(options.pressureTargetFrameMs) ? Math.max(4, options.pressureTargetFrameMs) : 16.7;
  const memoryWatermark = Number.isFinite(options.memoryWatermark) ? Math.max(0.1, Math.min(1, options.memoryWatermark)) : 0.85;
  const queuePressureWeight = Number.isFinite(options.queuePressureWeight) ? Math.max(0, options.queuePressureWeight) : 0.4;
  const framePressureWeight = Number.isFinite(options.framePressureWeight) ? Math.max(0, options.framePressureWeight) : 0.35;
  const memoryPressureWeight = Number.isFinite(options.memoryPressureWeight) ? Math.max(0, options.memoryPressureWeight) : 0.25;
  return {
    nodeBudget,
    expansionBudget,
    frontierBudget,
    depthLimit,
    maxTraceNodes,
    maxTraceEdges,
    maxDiagnostics,
    streamBufferSize,
    bestKFrontier,
    minBudgetScale,
    pressureTargetFrameMs,
    memoryWatermark,
    queuePressureWeight,
    framePressureWeight,
    memoryPressureWeight,
  };
}

function estimateMemoryPressure(memoryWatermark){
  if (typeof performance === "undefined" || !performance?.memory?.usedJSHeapSize || !performance?.memory?.jsHeapSizeLimit){
    return 0;
  }
  const ratio = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
  if (!Number.isFinite(ratio) || ratio <= memoryWatermark) return 0;
  return Math.min(1, (ratio - memoryWatermark) / Math.max(0.05, 1 - memoryWatermark));
}

function deriveAdaptiveBudget(baseBudget, runtimeSignals = {}, frontierSize = 0){
  const targetFrame = baseBudget.pressureTargetFrameMs;
  const frameTime = Number.isFinite(runtimeSignals.frameTimeMs) ? runtimeSignals.frameTimeMs : 0;
  const framePressure = frameTime > targetFrame ? Math.min(1, (frameTime - targetFrame) / targetFrame) : 0;
  const queueRatio = baseBudget.frontierBudget > 0 ? frontierSize / baseBudget.frontierBudget : 0;
  const queuePressure = Number.isFinite(runtimeSignals.queuePressure)
    ? Math.max(0, runtimeSignals.queuePressure)
    : Math.max(0, queueRatio - 0.75);
  const memoryPressure = Number.isFinite(runtimeSignals.memoryPressure)
    ? Math.max(0, runtimeSignals.memoryPressure)
    : estimateMemoryPressure(baseBudget.memoryWatermark);
  const totalWeight = baseBudget.queuePressureWeight + baseBudget.framePressureWeight + baseBudget.memoryPressureWeight;
  const normalizedPressure = totalWeight > 0
    ? Math.min(1, (
      (queuePressure * baseBudget.queuePressureWeight)
      + (framePressure * baseBudget.framePressureWeight)
      + (memoryPressure * baseBudget.memoryPressureWeight)
    ) / totalWeight)
    : 0;
  const scale = Math.max(baseBudget.minBudgetScale, 1 - (normalizedPressure * 0.7));
  return {
    pressure: normalizedPressure,
    nodeBudget: Math.max(1, Math.floor(baseBudget.nodeBudget * scale)),
    expansionBudget: Math.max(1, Math.floor(baseBudget.expansionBudget * scale)),
    frontierBudget: Math.max(1, Math.floor(baseBudget.frontierBudget * scale)),
  };
}

function normalizeOutput(outputInput){
  if (typeof outputInput === "string"){
    if (Object.values(TRAVERSAL_OUTPUT_MODES).includes(outputInput)){
      return { mode: outputInput };
    }
    return { mode: TRAVERSAL_OUTPUT_MODES.SUMMARY };
  }
  const output = outputInput && typeof outputInput === "object" ? outputInput : {};
  const mode = Object.values(TRAVERSAL_OUTPUT_MODES).includes(output.mode)
    ? output.mode
    : TRAVERSAL_OUTPUT_MODES.SUMMARY;
  return {
    ...output,
    mode,
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
  defaultRunConfig = null,
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
      const nextExec = withExecutionState(transition?.toState || baseState.execState, createEnvOverlay(baseState.execState.env));
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
        transitionCost: toNumber(transition?.cost ?? transition?.meta?.cost, 0),
        transitionConfidence: toNumber(transition?.confidence, 1),
        transitionMeta: transition?.meta || null,
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
      const nextExec = withExecutionState(transition?.toState || baseState.execState, createEnvOverlay(baseState.execState.env));
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
        transitionCost: toNumber(transition?.cost ?? transition?.meta?.cost, 0),
        transitionConfidence: toNumber(transition?.confidence, 1),
        transitionMeta: transition?.meta || null,
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
    output = null,
    runtimeSignals = null,
    pruning = null,
  } = {}) => {
    const runConfig = {
      ...(defaultRunConfig && typeof defaultRunConfig === "object" ? defaultRunConfig : {}),
      output,
    };
    const normalizedGoal = normalizeGoal(goal);
    const normalizedPolicy = normalizePolicy(policy);
    const normalizedOutput = normalizeOutput(runConfig.output);
    const normalizedBudget = makeBudget({
      ...(runConfig || {}),
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
    const expanded = normalizedOutput.mode === TRAVERSAL_OUTPUT_MODES.FULL ? [] : null;
    let bestExpanded = start;
    const goalMatches = [];
    const traceGraph = {
      nodes: [projectTraversalNode(start)],
      edges: [],
      dropped: {
        nodes: 0,
        edges: 0,
      },
    };
    const diagnostics = [];
    let droppedDiagnostics = 0;
    const streamBuffers = normalizedOutput.mode === TRAVERSAL_OUTPUT_MODES.STREAM
      ? {
        expanded: createRingBuffer(normalizedBudget.streamBufferSize),
        frontier: createRingBuffer(normalizedBudget.streamBufferSize),
        diagnostics: createRingBuffer(normalizedBudget.streamBufferSize),
      }
      : null;

    const pushDiagnostic = (entry) => {
      if (diagnostics.length >= normalizedBudget.maxDiagnostics){
        diagnostics.shift();
        droppedDiagnostics += 1;
      }
      diagnostics.push(entry);
      if (streamBuffers) streamBuffers.diagnostics.push(entry);
    };

    const pushTraceNode = (node) => {
      if (traceGraph.nodes.length >= normalizedBudget.maxTraceNodes){
        traceGraph.dropped.nodes += 1;
        return;
      }
      traceGraph.nodes.push(projectTraversalNode(node));
    };

    const pushTraceEdge = (edge) => {
      if (traceGraph.edges.length >= normalizedBudget.maxTraceEdges){
        traceGraph.dropped.edges += 1;
        return;
      }
      traceGraph.edges.push(edge);
    };

    if (start.canonicalKey){
      visited.set(start.canonicalKey, {
        rank: rankState(start),
        score: start.score,
        confidence: start.confidence,
        depth: start.depth,
        stateId: start.id,
      });
    }
    frontier.pushAll([start]);

    let expansions = 0;
    let pruned = 0;
    let peakPressure = 0;

    while (frontier.size() > 0){
      const adaptiveBudget = deriveAdaptiveBudget(normalizedBudget, runtimeSignals || {}, frontier.size());
      if (adaptiveBudget.pressure > peakPressure) peakPressure = adaptiveBudget.pressure;
      const expandedCount = expanded ? expanded.length : expansions;
      if (expandedCount >= adaptiveBudget.nodeBudget) break;
      if (expansions >= adaptiveBudget.expansionBudget) break;

      const popped = frontier.pop();
      const current = popped ? transitionTraversalNodeStatus(popped, TRAVERSAL_NODE_STATUSES.EXPANDED) : null;
      if (!current) break;
      if (current.depth >= normalizedBudget.depthLimit){
        pushDiagnostic({ kind: "depth-limit", stateId: current.id, depth: current.depth });
        continue;
      }

      if (expanded){
        expanded.push(current);
      }else if (rankState(current) > rankState(bestExpanded)){
        bestExpanded = current;
      }
      expansions += 1;
      if (streamBuffers) streamBuffers.expanded.push(projectTraversalNode(current));

      const successors = expandTraversalState(statementNode, current, { mode });
      const accepted = [];
      const pruneConfig = pruning && typeof pruning === "object" ? pruning : {};
      const minConfidence = Number.isFinite(pruneConfig.minTransitionConfidence) ? pruneConfig.minTransitionConfidence : 0.08;
      const maxCost = Number.isFinite(pruneConfig.maxTransitionCost) ? pruneConfig.maxTransitionCost : Number.POSITIVE_INFINITY;
      const costWeight = Number.isFinite(pruneConfig.costWeight) ? pruneConfig.costWeight : 0.4;

      for (const successor of successors){
        const expectedUtility = (toNumber(successor.score, 0) + toNumber(successor.transitionConfidence, 1))
          - (toNumber(successor.transitionCost, 0) * costWeight);
        if (successor.transitionConfidence < minConfidence){
          pruned += 1;
          pushDiagnostic({ kind: "pruned", stateId: successor.id, parentId: current.id, reason: "low-confidence", confidence: successor.transitionConfidence });
          continue;
        }
        if (successor.transitionCost > maxCost){
          pruned += 1;
          pushDiagnostic({ kind: "pruned", stateId: successor.id, parentId: current.id, reason: "high-cost", cost: successor.transitionCost });
          continue;
        }
        if (expectedUtility < (rankState(bestExpanded) - 2)){
          pruned += 1;
          pushDiagnostic({ kind: "pruned", stateId: successor.id, parentId: current.id, reason: "low-utility", utility: expectedUtility });
          continue;
        }
        if (typeof prune === "function" && prune(successor, current)){
          pruned += 1;
          pushDiagnostic({ kind: "pruned", stateId: successor.id, parentId: current.id, reason: "predicate" });
          continue;
        }

        if (successor.canonicalKey){
          const seen = visited.get(successor.canonicalKey);
          if (seen && seen.rank >= rankState(successor)){
            pruned += 1;
            pushDiagnostic({ kind: "pruned", stateId: successor.id, parentId: current.id, reason: "visited" });
            continue;
          }
          visited.set(successor.canonicalKey, {
            rank: rankState(successor),
            score: successor.score,
            confidence: successor.confidence,
            depth: successor.depth,
            stateId: successor.id,
          });
        }

        const frontierSuccessor = updateTraversalNodeMetadata(
          transitionTraversalNodeStatus(successor, TRAVERSAL_NODE_STATUSES.FRONTIER),
          {},
        );
        pushTraceNode(frontierSuccessor);
        pushTraceEdge({
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
      frontier.trim(adaptiveBudget.frontierBudget);
      if (streamBuffers){
        const frontierView = frontier.toArray().slice(0, normalizedBudget.bestKFrontier).map(projectTraversalNode);
        streamBuffers.frontier.push(frontierView);
      }

      if (normalizedGoal.strategy === "first-valid" && goalMatches.length > 0){
        pushDiagnostic({ kind: "goal-hit", stateId: goalMatches[0].id, strategy: normalizedGoal.strategy });
        break;
      }
      if (normalizedGoal.strategy === "top-N" && goalMatches.length >= normalizedGoal.topN){
        pushDiagnostic({ kind: "goal-hit", stateId: goalMatches[goalMatches.length - 1].id, strategy: normalizedGoal.strategy });
        break;
      }
    }

    const ranked = (expanded || [bestExpanded]).slice().sort((a, b) => rankState(b) - rankState(a));
    const rankedGoalMatches = goalMatches.slice().sort((a, b) => rankState(b) - rankState(a));
    const frontierSnapshot = frontier.toArray();
    const bestKFrontier = frontierSnapshot
      .slice()
      .sort((a, b) => rankState(b) - rankState(a))
      .slice(0, normalizedBudget.bestKFrontier)
      .map(projectTraversalNode);
    return {
      policy: normalizedPolicy,
      output: normalizedOutput,
      budget: normalizedBudget,
      goal: normalizedGoal,
      expanded: expanded || [],
      frontier: normalizedOutput.mode === TRAVERSAL_OUTPUT_MODES.FULL ? frontierSnapshot : [],
      bestKFrontier,
      visited,
      best: rankedGoalMatches[0] || ranked[0] || start,
      goalMatches: normalizedGoal.strategy === "top-N"
        ? rankedGoalMatches.slice(0, normalizedGoal.topN)
        : rankedGoalMatches,
      diagnostics,
      metrics: {
        expandedCount: expansions,
        visitedCount: visited.size,
        prunedCount: pruned,
        peakPressure,
        droppedDiagnostics,
        traceNodesDropped: traceGraph.dropped.nodes,
        traceEdgesDropped: traceGraph.dropped.edges,
      },
      traceGraph: normalizedOutput.mode === TRAVERSAL_OUTPUT_MODES.FULL
        ? traceGraph
        : {
          nodes: traceGraph.nodes,
          edges: traceGraph.edges,
          dropped: traceGraph.dropped,
        },
      stream: streamBuffers
        ? {
          expanded: streamBuffers.expanded.toArray(),
          frontier: streamBuffers.frontier.toArray(),
          diagnostics: streamBuffers.diagnostics.toArray(),
        }
        : null,
    };
  };

  return {
    buildWrapper,
    expandTraversalState,
    expandBlock,
    runTraversal,
  };
}
