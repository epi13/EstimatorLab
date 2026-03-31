import { IR_KIND, toCanonicalIRNode } from "./repl-expression-ir.js";

const COMMUTATIVE_ASSOCIATIVE_OPS = new Set(["+", "*"]);
const COMMUTATIVE_ONLY_OPS = new Set(["==", "!="]);

function isPlainObject(value){
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stableSortStrings(values){
  return [...values].sort((a, b) => a.localeCompare(b));
}

function stableSerialize(value, context = null){
  const ctx = context || {
    active: new WeakMap(),
    cache: new WeakMap(),
    nextRefId: 1,
  };

  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "number"){
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return Number.isInteger(value) ? String(value) : value.toPrecision(15).replace(/\.?0+$/, "");
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)){
    if (ctx.cache.has(value)) return ctx.cache.get(value);
    if (ctx.active.has(value)) return `{"$ref":${ctx.active.get(value)}}`;
    const refId = ctx.nextRefId++;
    ctx.active.set(value, refId);
    const serialized = `[${value.map((item) => stableSerialize(item, ctx)).join(",")}]`;
    ctx.active.delete(value);
    ctx.cache.set(value, serialized);
    return serialized;
  }
  if (typeof value === "object"){
    if (ctx.cache.has(value)) return ctx.cache.get(value);
    if (ctx.active.has(value)) return `{"$ref":${ctx.active.get(value)}}`;
    const refId = ctx.nextRefId++;
    ctx.active.set(value, refId);
    const keys = stableSortStrings(Object.keys(value));
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key], ctx)}`);
    const serialized = `{${pairs.join(",")}}`;
    ctx.active.delete(value);
    ctx.cache.set(value, serialized);
    return serialized;
  }
  return JSON.stringify(String(value));
}

export function createReplNormalize(){

  function normalizeIdentifier(name, aliasMap = null){
    let next = String(name || "").trim();
    if (!next) return next;
    const seen = new Set();
    while (aliasMap && Object.prototype.hasOwnProperty.call(aliasMap, next) && !seen.has(next)){
      seen.add(next);
      const mapped = aliasMap[next];
      if (typeof mapped !== "string" || !mapped.trim()) break;
      next = mapped.trim();
    }
    return next;
  }

  function canonicalExpressionKey(ir, aliasMap = null){
    return stableSerialize(normalizeExpressionIR(ir, aliasMap));
  }

  function canonicalStateKey(state){
    return stableSerialize(state);
  }

  function normalizeExpressionIR(ir, aliasMap = null){
    const root = toCanonicalIRNode(ir);
    if (!root) return null;

    function normalizeNode(node){
      const canonical = toCanonicalIRNode(node);
      if (!canonical) return null;

      if (canonical.kind === IR_KIND.LITERAL){
        return {
          ...canonical,
          valueType: canonical.valueType,
          value: canonical.value,
          children: [],
        };
      }

      if (canonical.kind === IR_KIND.IDENTIFIER){
        return {
          ...canonical,
          name: normalizeIdentifier(canonical.name, aliasMap),
          children: [],
        };
      }

      if (canonical.kind === IR_KIND.CALL){
        const args = Array.isArray(canonical.args) ? canonical.args.map((arg) => normalizeNode(arg)) : [];
        return {
          ...canonical,
          name: normalizeIdentifier(canonical.name, aliasMap),
          args,
          children: args,
        };
      }

      if (canonical.kind === IR_KIND.CONDITIONAL){
        const cond = normalizeNode(canonical.cond);
        const thenBranch = normalizeNode(canonical.then);
        const elseBranch = normalizeNode(canonical.else);
        return {
          ...canonical,
          cond,
          then: thenBranch,
          else: elseBranch,
          children: [cond, thenBranch, elseBranch].filter(Boolean),
        };
      }

      if (canonical.kind === IR_KIND.BINARY){
        const left = normalizeNode(canonical.left);
        const right = normalizeNode(canonical.right);
        const op = canonical.op;

        if (COMMUTATIVE_ASSOCIATIVE_OPS.has(op)){
          const flattened = [];
          const collect = (candidate) => {
            if (!candidate || candidate.kind !== IR_KIND.BINARY || candidate.op !== op){
              if (candidate) flattened.push(candidate);
              return;
            }
            collect(candidate.left);
            collect(candidate.right);
          };
          collect(left);
          collect(right);
          flattened.sort((a, b) => canonicalExpressionKey(a, aliasMap).localeCompare(canonicalExpressionKey(b, aliasMap)));

          let next = flattened[0] || null;
          for (let i = 1; i < flattened.length; i++){
            next = {
              ...canonical,
              left: next,
              right: flattened[i],
              children: [next, flattened[i]],
            };
          }
          return next;
        }

        if (COMMUTATIVE_ONLY_OPS.has(op)){
          const leftKey = canonicalExpressionKey(left, aliasMap);
          const rightKey = canonicalExpressionKey(right, aliasMap);
          const [orderedLeft, orderedRight] = leftKey <= rightKey ? [left, right] : [right, left];
          return {
            ...canonical,
            left: orderedLeft,
            right: orderedRight,
            children: [orderedLeft, orderedRight],
          };
        }

        return {
          ...canonical,
          left,
          right,
          children: [left, right].filter(Boolean),
        };
      }

      const children = (canonical.children || []).map((child) => normalizeNode(child));
      return {
        ...canonical,
        children,
      };
    }

    return normalizeNode(root);
  }

  function normalizeStatementNode(statement, aliasMap = null){
    if (!isPlainObject(statement)) return statement;
    const normalized = { ...statement };

    if (typeof normalized.expr === "string") normalized.expr = normalized.expr.trim();
    if (typeof normalized.left === "string") normalized.left = normalized.left.trim();
    if (typeof normalized.right === "string") normalized.right = normalized.right.trim();
    if (typeof normalized.condition === "string") normalized.condition = normalized.condition.trim();
    if (typeof normalized.startExpr === "string") normalized.startExpr = normalized.startExpr.trim();
    if (typeof normalized.endExpr === "string") normalized.endExpr = normalized.endExpr.trim();
    if (typeof normalized.stepExpr === "string") normalized.stepExpr = normalized.stepExpr.trim();
    if (typeof normalized.countExpr === "string") normalized.countExpr = normalized.countExpr.trim();
    if (typeof normalized.name === "string") normalized.name = normalizeIdentifier(normalized.name, aliasMap);
    if (Array.isArray(normalized.params)) normalized.params = normalized.params.map((param) => normalizeIdentifier(param, aliasMap));

    if (normalized.exprIr && typeof normalized.exprIr === "object"){
      normalized.exprIr = normalizeExpressionIR(normalized.exprIr, aliasMap);
    }

    if (normalized.thenBody) normalized.thenBody = normalizeBlockNode(normalized.thenBody, aliasMap);
    if (normalized.elseBody) normalized.elseBody = normalizeBlockNode(normalized.elseBody, aliasMap);
    if (normalized.body) normalized.body = normalizeBlockNode(normalized.body, aliasMap);

    if (isPlainObject(normalized.fields)){
      const sortedEntries = Object.entries(normalized.fields)
        .map(([key, value]) => {
          if (!isPlainObject(value)) return [key, value];
          const next = { ...value };
          if (typeof next.expr === "string") next.expr = next.expr.trim();
          if (next.exprIr && typeof next.exprIr === "object") next.exprIr = normalizeExpressionIR(next.exprIr, aliasMap);
          return [key.trim(), next];
        })
        .sort(([a], [b]) => a.localeCompare(b));
      normalized.fields = Object.fromEntries(sortedEntries);
    }

    return normalized;
  }

  function normalizeBlockNode(block, aliasMap = null){
    if (!isPlainObject(block) || !Array.isArray(block.statements)) return block;
    return {
      ...block,
      statements: block.statements.map((statement) => normalizeStatementNode(statement, aliasMap)),
    };
  }

  return {
    normalizeIdentifier,
    normalizeExpressionIR,
    normalizeStatementNode,
    normalizeBlockNode,
    canonicalExpressionKey,
    canonicalStateKey,
  };
}
