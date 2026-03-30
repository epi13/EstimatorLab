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

/**
 * Internal statement-node contract used by parser, evaluator, executor, and tests.
 *
 * Node shapes:
 * - cmd:      { type:"cmd", cmd:string, arg:string, origin?:StatementOrigin }
 * - def:      { type:"def", name:string, params:string[], expr:string, origin?:StatementOrigin }
 * - assy:     { type:"assy", name:string, fields:object, origin?:StatementOrigin }
 * - assign:   { type:"assign", name:string, expr:string, origin?:StatementOrigin }
 * - equation: { type:"equation", left:string, right:string, origin?:StatementOrigin }
 * - if:       { type:"if", condition:string, thenBody:StatementNode[], elseBody:StatementNode[]|null, origin?:StatementOrigin }
 * - for:      { type:"for", varName:string, startExpr:string, endExpr:string, stepExpr:string|null, body:StatementNode[], origin?:StatementOrigin }
 * - repeat:   { type:"repeat", countExpr:string, body:StatementNode[], origin?:StatementOrigin }
 * - expr:     { type:"expr", expr:string, origin?:StatementOrigin }
 *
 * StatementOrigin (optional):
 * - source: original statement text
 * - parentStatementType: owning parent statement type for nested block statements
 * - blockRole: block role within parent (then|else|body|inline|top)
 * - blockDepth: nesting depth (0 for top-level parsed statements)
 * - statementIndex: statement position within the parsed block
 */

export function createStatementNode(type, payload = {}, origin = null){
  if (!STATEMENT_TYPES.includes(type)){
    throw new Error(`Unknown statement type: ${type}`);
  }
  const node = { type, ...payload };
  if (origin && typeof origin === "object") node.origin = origin;
  return node;
}

export function createBlockContext(context = {}){
  return {
    parentStatementType: context.parentStatementType || null,
    blockRole: context.blockRole || "top",
    blockDepth: Number.isInteger(context.blockDepth) ? context.blockDepth : 0,
    sourceSpan: context.sourceSpan || null,
  };
}

export function createChildBlockContext(context = {}, next = {}){
  const base = createBlockContext(context);
  return createBlockContext({
    parentStatementType: next.parentStatementType || base.parentStatementType,
    blockRole: next.blockRole || "body",
    blockDepth: base.blockDepth + 1,
    sourceSpan: next.sourceSpan || null,
  });
}
