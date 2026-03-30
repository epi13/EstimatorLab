export const STATEMENT_TYPE = Object.freeze({
  CMD: "cmd",
  DEF: "def",
  ASSY: "assy",
  ASSIGN: "assign",
  EQUATION: "equation",
  IF: "if",
  FOR: "for",
  REPEAT: "repeat",
  EXPR: "expr",
});

export const STATEMENT_TYPES = Object.freeze(Object.values(STATEMENT_TYPE));

let nextBlockCounter = 1;

function nextBlockId(){
  const id = nextBlockCounter;
  nextBlockCounter += 1;
  return `block-${id}`;
}

function deriveStatementNodeId(metadata = null){
  if (!metadata || typeof metadata !== "object") return null;
  if (typeof metadata.nodeId === "string" && metadata.nodeId.trim()){
    return metadata.nodeId;
  }
  const blockId = typeof metadata.blockId === "string" ? metadata.blockId.trim() : "";
  const statementIndex = metadata.statementIndex;
  if (!blockId || !Number.isInteger(statementIndex) || statementIndex < 0){
    return null;
  }
  return `${blockId}:stmt:${statementIndex}`;
}

export function createStatementNode(kind, payload = {}, metadata = null){
  if (!STATEMENT_TYPES.includes(kind)){
    throw new Error(`Unknown statement kind: ${kind}`);
  }
  const span = metadata?.span || null;
  const blockId = metadata?.blockId || null;
  const nodeId = deriveStatementNodeId(metadata);
  const node = {
    nodeType: "statement",
    kind,
    type: kind,
    nodeId,
    span,
    blockId,
    ...payload,
  };
  if (metadata && typeof metadata === "object"){
    node.origin = metadata;
  }
  return node;
}

export function createBlockNode(statements = [], metadata = null){
  const blockId = metadata?.blockId || nextBlockId();
  return {
    nodeType: "block",
    kind: "block",
    type: "block",
    blockId,
    span: metadata?.span || null,
    statements: Array.isArray(statements) ? statements : [],
    context: metadata || null,
  };
}

export function isBlockNode(node){
  return Boolean(node && typeof node === "object" && node.nodeType === "block" && Array.isArray(node.statements));
}

export function isStatementNode(node){
  return Boolean(node && typeof node === "object" && node.nodeType === "statement" && typeof node.kind === "string");
}

export function createBlockContext(context = {}){
  return {
    parentStatementType: context.parentStatementType || null,
    blockRole: context.blockRole || "top",
    blockDepth: Number.isInteger(context.blockDepth) ? context.blockDepth : 0,
    sourceSpan: context.sourceSpan || null,
    blockId: context.blockId || nextBlockId(),
  };
}

export function createChildBlockContext(context = {}, next = {}){
  const base = createBlockContext(context);
  return createBlockContext({
    parentStatementType: next.parentStatementType || base.parentStatementType,
    blockRole: next.blockRole || "body",
    blockDepth: base.blockDepth + 1,
    sourceSpan: next.sourceSpan || null,
    blockId: next.blockId || null,
  });
}
