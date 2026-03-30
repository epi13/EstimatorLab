export const IR_KIND = Object.freeze({
  LITERAL: "literal",
  IDENTIFIER: "identifier",
  BINARY: "binary",
  CALL: "call",
  OBJECT: "object",
  CONDITIONAL: "conditional",
});

export function literalNode(valueType, value){
  return { kind: IR_KIND.LITERAL, valueType, value };
}

export function identifierNode(name){
  return { kind: IR_KIND.IDENTIFIER, name };
}

export function binaryNode(op, left, right){
  return { kind: IR_KIND.BINARY, op, left, right };
}

export function callNode(name, args = []){
  return { kind: IR_KIND.CALL, name, args };
}

export function objectNode(raw){
  return { kind: IR_KIND.OBJECT, raw };
}

export function conditionalNode(cond, thenBranch, elseBranch, lazy = true){
  return {
    kind: IR_KIND.CONDITIONAL,
    lazy: Boolean(lazy),
    cond,
    then: thenBranch,
    else: elseBranch,
  };
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

