let traversalNodeId = 0;

export const TRAVERSAL_NODE_STATUSES = Object.freeze({
  PENDING: "pending",
  FRONTIER: "frontier",
  EXPANDED: "expanded",
  PRUNED: "pruned",
  DEPTH_LIMITED: "depth_limited",
});

const STATUS_TRANSITIONS = Object.freeze({
  [TRAVERSAL_NODE_STATUSES.PENDING]: new Set([
    TRAVERSAL_NODE_STATUSES.FRONTIER,
    TRAVERSAL_NODE_STATUSES.PRUNED,
    TRAVERSAL_NODE_STATUSES.DEPTH_LIMITED,
  ]),
  [TRAVERSAL_NODE_STATUSES.FRONTIER]: new Set([
    TRAVERSAL_NODE_STATUSES.EXPANDED,
    TRAVERSAL_NODE_STATUSES.PRUNED,
    TRAVERSAL_NODE_STATUSES.DEPTH_LIMITED,
  ]),
  [TRAVERSAL_NODE_STATUSES.EXPANDED]: new Set(),
  [TRAVERSAL_NODE_STATUSES.PRUNED]: new Set(),
  [TRAVERSAL_NODE_STATUSES.DEPTH_LIMITED]: new Set(),
});

function nextTraversalNodeId(){
  traversalNodeId += 1;
  return `ts-${traversalNodeId}`;
}

function normalizeStatus(status){
  if (Object.values(TRAVERSAL_NODE_STATUSES).includes(status)) return status;
  return TRAVERSAL_NODE_STATUSES.PENDING;
}

export function deriveTraversalCanonicalKey(execState, deriveFn = null, fallback = null){
  if (typeof deriveFn !== "function") return fallback;
  try{
    return deriveFn(execState);
  }catch {
    return fallback;
  }
}

export function createTraversalNode({
  id = null,
  execState,
  score = 0,
  confidence = 1,
  depth = 0,
  parentId = null,
  viaTransitionId = null,
  canonicalKey = null,
  status = TRAVERSAL_NODE_STATUSES.PENDING,
} = {}){
  return {
    id: id || nextTraversalNodeId(),
    execState,
    score,
    confidence,
    depth,
    parentId,
    viaTransitionId,
    canonicalKey,
    status: normalizeStatus(status),
  };
}

export function cloneTraversalNode(node, metadata = {}){
  return createTraversalNode({
    ...node,
    ...metadata,
    id: metadata.id || node?.id || null,
  });
}

export function updateTraversalNodeMetadata(node, metadata = {}){
  if (!node || typeof node !== "object"){
    return createTraversalNode(metadata);
  }
  return cloneTraversalNode(node, metadata);
}

export function transitionTraversalNodeStatus(node, nextStatus){
  const currentStatus = normalizeStatus(node?.status);
  const normalizedNextStatus = normalizeStatus(nextStatus);
  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed || (!allowed.has(normalizedNextStatus) && normalizedNextStatus !== currentStatus)){
    return cloneTraversalNode(node, { status: currentStatus });
  }
  return cloneTraversalNode(node, { status: normalizedNextStatus });
}
