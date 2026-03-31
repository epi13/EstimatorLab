import { IR_KIND, toCanonicalIRNode } from "./repl-expression-ir.js";

const COMMUTATIVE_ASSOCIATIVE_OPS = new Set(["+", "*"]);
const COMMUTATIVE_ONLY_OPS = new Set(["==", "!="]);
const NULL_ALIAS_MAP = Object.freeze({ __nullAliasMap: true });

function isPlainObject(value){
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stableSortStrings(values){
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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
  const normalizedRootCacheByAlias = new WeakMap();

  function getAliasCacheKey(aliasMap){
    return aliasMap && typeof aliasMap === "object" ? aliasMap : NULL_ALIAS_MAP;
  }

  function getRootCache(aliasMap){
    const key = getAliasCacheKey(aliasMap);
    let cache = normalizedRootCacheByAlias.get(key);
    if (!cache){
      cache = new WeakMap();
      normalizedRootCacheByAlias.set(key, cache);
    }
    return cache;
  }

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
    const rootCache = getRootCache(aliasMap);
    if (ir && typeof ir === "object" && rootCache.has(ir)) return rootCache.get(ir);

    const root = toCanonicalIRNode(ir);
    if (!root) return null;

    const nodeCache = new WeakMap();
    const keyCache = new WeakMap();

    function canonicalKeyForNode(node){
      if (!node || typeof node !== "object") return stableSerialize(node);
      if (keyCache.has(node)) return keyCache.get(node);
      const key = stableSerialize(node);
      keyCache.set(node, key);
      return key;
    }

    function normalizeNode(node){
      const canonical = toCanonicalIRNode(node);
      if (!canonical) return null;
      if (nodeCache.has(node)) return nodeCache.get(node);

      let normalized;
      if (canonical.kind === IR_KIND.LITERAL){
        normalized = {
          ...canonical,
          valueType: canonical.valueType,
          value: canonical.value,
          children: [],
        };
      }else if (canonical.kind === IR_KIND.IDENTIFIER){
        normalized = {
          ...canonical,
          name: normalizeIdentifier(canonical.name, aliasMap),
          children: [],
        };
      }else if (canonical.kind === IR_KIND.CALL){
        const args = Array.isArray(canonical.args) ? canonical.args.map((arg) => normalizeNode(arg)) : [];
        normalized = {
          ...canonical,
          name: normalizeIdentifier(canonical.name, aliasMap),
          args,
          children: args,
        };
      }else if (canonical.kind === IR_KIND.CONDITIONAL){
        const cond = normalizeNode(canonical.cond);
        const thenBranch = normalizeNode(canonical.then);
        const elseBranch = normalizeNode(canonical.else);
        normalized = {
          ...canonical,
          cond,
          then: thenBranch,
          else: elseBranch,
          children: [cond, thenBranch, elseBranch].filter(Boolean),
        };
      }else if (canonical.kind === IR_KIND.BINARY){
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

          const keyed = flattened
            .map((entry) => ({ node: entry, key: canonicalKeyForNode(entry) }))
            .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

          let next = keyed[0]?.node || null;
          for (let i = 1; i < keyed.length; i++){
            next = {
              ...canonical,
              left: next,
              right: keyed[i].node,
              children: [next, keyed[i].node],
            };
          }
          normalized = next;
        }else if (COMMUTATIVE_ONLY_OPS.has(op)){
          const leftKey = canonicalKeyForNode(left);
          const rightKey = canonicalKeyForNode(right);
          const [orderedLeft, orderedRight] = leftKey < rightKey ? [left, right] : leftKey > rightKey ? [right, left] : [left, right];
          normalized = {
            ...canonical,
            left: orderedLeft,
            right: orderedRight,
            children: [orderedLeft, orderedRight],
          };
        }else{
          normalized = {
            ...canonical,
            left,
            right,
            children: [left, right].filter(Boolean),
          };
        }
      }else{
        const children = (canonical.children || []).map((child) => normalizeNode(child));
        normalized = {
          ...canonical,
          children,
        };
      }

      nodeCache.set(node, normalized);
      return normalized;
    }

    const normalizedRoot = normalizeNode(root);
    if (ir && typeof ir === "object") rootCache.set(ir, normalizedRoot);
    return normalizedRoot;
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
