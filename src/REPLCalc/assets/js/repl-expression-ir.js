export const IR_KIND = Object.freeze({
  LITERAL: "literal",
  IDENTIFIER: "identifier",
  BINARY: "binary",
  CALL: "call",
  OBJECT: "object",
  CONDITIONAL: "conditional",
});

let nextNodeId = 1;

function genNodeId(){
  const id = `ir_${nextNodeId}`;
  nextNodeId += 1;
  return id;
}

function withSharedFields(kind, payload, options = {}){
  const children = Array.isArray(options.children)
    ? options.children.filter((child) => child && typeof child === "object")
    : [];
  const node = {
    id: options.id || genNodeId(),
    kind,
    children,
    annotations: options.annotations && typeof options.annotations === "object" ? options.annotations : {},
    normalization: options.normalization && typeof options.normalization === "object" ? options.normalization : {},
    origin: options.origin && typeof options.origin === "object" ? options.origin : {},
    ...payload,
  };
  if (options.inferred && typeof options.inferred === "object"){
    node.inferred = options.inferred;
  }
  return node;
}

export function literalNode(valueType, value, options = {}){
  return withSharedFields(IR_KIND.LITERAL, { valueType, value }, options);
}

export function identifierNode(name, options = {}){
  return withSharedFields(IR_KIND.IDENTIFIER, { name }, options);
}

export function binaryNode(op, left, right, options = {}){
  return withSharedFields(IR_KIND.BINARY, { op, left, right }, { ...options, children: [left, right] });
}

export function callNode(name, args = [], options = {}){
  return withSharedFields(IR_KIND.CALL, { name, args }, { ...options, children: args });
}

export function objectNode(raw, options = {}){
  return withSharedFields(IR_KIND.OBJECT, { raw }, options);
}

export function conditionalNode(cond, thenBranch, elseBranch, lazy = true, options = {}){
  return withSharedFields(IR_KIND.CONDITIONAL, {
    lazy: Boolean(lazy),
    cond,
    then: thenBranch,
    else: elseBranch,
  }, { ...options, children: [cond, thenBranch, elseBranch] });
}

export function toCanonicalIRNode(node){
  if (!node || typeof node !== "object") return null;
  const base = {
    ...node,
    id: typeof node.id === "string" ? node.id : genNodeId(),
    annotations: node.annotations && typeof node.annotations === "object" ? node.annotations : {},
    normalization: node.normalization && typeof node.normalization === "object" ? node.normalization : {},
    origin: node.origin && typeof node.origin === "object" ? node.origin : {},
  };
  if (Array.isArray(node.children) && node.children.every((child) => child && typeof child === "object")){
    return base;
  }
  if (node.kind === IR_KIND.BINARY){
    return { ...base, children: [node.left, node.right].filter(Boolean) };
  }
  if (node.kind === IR_KIND.CALL){
    return { ...base, children: Array.isArray(node.args) ? node.args.filter(Boolean) : [] };
  }
  if (node.kind === IR_KIND.CONDITIONAL){
    return { ...base, children: [node.cond, node.then, node.else].filter(Boolean) };
  }
  return { ...base, children: [] };
}

export function getIRNodeChildren(node){
  const canonical = toCanonicalIRNode(node);
  return canonical && Array.isArray(canonical.children) ? canonical.children : [];
}

export function irFromRPN(rpn, parseExpressionIR){
  const stack = [];
  for (const token of rpn){
    if (token.type === "num"){
      stack.push(literalNode("number", token.value));
      continue;
    }
    if (token.type === "str"){
      stack.push(literalNode("string", token.value));
      continue;
    }
    if (token.type === "id"){
      stack.push(identifierNode(token.value));
      continue;
    }
    if (token.type === "obj"){
      stack.push(objectNode(token.value));
      continue;
    }
    if (token.type === "lambda"){
      stack.push(literalNode("lambda", {
        __lambda: true,
        param: token.param,
        body: token.body,
      }));
      continue;
    }
    if (token.type === "lazy_if"){
      if (typeof parseExpressionIR !== "function"){
        throw new Error("IR conversion for lazy_if requires parseExpressionIR");
      }
      stack.push(conditionalNode(
        parseExpressionIR(token.cond),
        parseExpressionIR(token.then),
        parseExpressionIR(token.else),
        true
      ));
      continue;
    }
    if (token.type === "op"){
      const right = stack.pop();
      const left = stack.pop();
      if (!left || !right) throw new Error(`IR conversion failed: missing operand for operator "${token.value}"`);
      stack.push(binaryNode(token.value, left, right));
      continue;
    }
    if (token.type === "fn"){
      const argc = Number.isInteger(token.argc) ? token.argc : 0;
      const args = [];
      for (let i = 0; i < argc; i++){
        const arg = stack.pop();
        if (!arg) throw new Error(`IR conversion failed: missing arg for ${token.value}()`);
        args.unshift(arg);
      }
      stack.push(callNode(token.value, args));
      continue;
    }
    throw new Error(`Unsupported token type for IR conversion: ${token.type}`);
  }
  if (stack.length !== 1){
    throw new Error("IR conversion failed: expression did not reduce to a single node");
  }
  return stack[0];
}
