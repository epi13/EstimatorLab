/**
 * @typedef {Object} Transition
 * @property {string} transitionType
 * @property {object|null} fromState
 * @property {object|null} toState
 * @property {object|null} record
 * @property {number} scoreDelta
 * @property {number} confidence
 * @property {number} cost
 * @property {object} meta
 * @property {string} id
 */

let transitionCounter = 0;

export function nextTransitionId(prefix = "transition"){
  transitionCounter += 1;
  return `${prefix}-${transitionCounter}`;
}

export function createTransition({
  transitionType = "unknown",
  fromState = null,
  toState = null,
  record = null,
  scoreDelta = 0,
  confidence = 1,
  cost = 0,
  meta = {},
  id = null,
} = {}){
  return {
    transitionType,
    fromState,
    toState,
    record,
    scoreDelta,
    confidence,
    cost,
    meta: meta && typeof meta === "object" ? { ...meta } : {},
    id: id || nextTransitionId(transitionType),
  };
}
