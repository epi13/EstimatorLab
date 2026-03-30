import { irFromRPN } from "./repl-expression-ir.js";

export function createReplLowering({
  getFns,
  tokenize,
  toRPN,
  insertImplicitMultiplication,
  buildAliasMap,
  ensureSymbolsLoaded,
  isUnitToken,
  UNIT,
}){
  function collectIdentifierNames(tokens){
    const names = new Set();
    for (let i = 0; i < tokens.length; i++){
      const t = tokens[i];
      if (t.type !== "id") continue;
      names.add(t.value);
    }
    return names;
  }

  function maybeEnsureSymbols(tokens){
    if (!ensureSymbolsLoaded) return;
    const names = collectIdentifierNames(tokens);
    if (names.size) ensureSymbolsLoaded(names);
  }

  function isBareUnitToken(tokens, idx){
    const token = tokens[idx];
    if (!token || token.type !== "id" || !isUnitToken(token.value)) return false;
    const prev = tokens[idx - 1];
    if (!prev) return true;
    if (prev.type === "num" || prev.type === "id" || prev.type === ")") return false;
    return true;
  }

  function expandTrailingNumericIdentifiers(tokens, vars, fnNames){
    const out = [];
    const suffixPattern = /^([A-Za-z_$%][A-Za-z0-9_$%.]*?)(\d+)$/;
    for (const token of tokens){
      if (!token || token.type !== "id"){
        out.push(token);
        continue;
      }
      const name = token.value;
      if (Object.prototype.hasOwnProperty.call(vars, name) || isUnitToken(name) || name === "pi" || name === "e" || (fnNames && fnNames.has(name))){
        out.push(token);
        continue;
      }
      const match = name.match(suffixPattern);
      if (!match){
        out.push(token);
        continue;
      }
      const baseName = match[1];
      const numericSuffix = Number(match[2]);
      if (!Object.prototype.hasOwnProperty.call(vars, baseName) || !Number.isFinite(numericSuffix)){
        out.push(token);
        continue;
      }
      out.push({ type: "id", value: baseName });
      out.push({ type: "num", value: numericSuffix });
    }
    return out;
  }

  function tokenizeExpressionIR(ir){
    const out = [];
    function walk(node){
      if (!node || typeof node !== "object") return;
      if (node.kind === "identifier"){
        out.push({ type: "id", value: node.name });
        return;
      }
      if (node.kind === "binary"){
        walk(node.left);
        walk(node.right);
        return;
      }
      if (node.kind === "call"){
        for (const arg of (node.args || [])) walk(arg);
        return;
      }
      if (node.kind === "conditional"){
        walk(node.cond);
        walk(node.then);
        walk(node.else);
      }
    }
    walk(ir);
    return out;
  }

  function parseExpressionIR(expr, vars){
    if (expr && typeof expr === "object" && expr.kind) return expr;
    const source = String(expr ?? "");
    const fnNames = new Set(Object.keys(getFns()));
    const expanded = expandTrailingNumericIdentifiers(tokenize(source), vars, fnNames);
    const tokens = insertImplicitMultiplication(expanded);
    return irFromRPN(toRPN(tokens), (innerExpr) => parseExpressionIR(innerExpr, vars));
  }

  function analyzeExpression(expr, vars){
    const source = String(expr ?? "");
    const fnNames = new Set(Object.keys(getFns()));
    const expanded = expandTrailingNumericIdentifiers(tokenize(source), vars, fnNames);
    const tokens = insertImplicitMultiplication(expanded);
    maybeEnsureSymbols(tokens);
    const aliases = buildAliasMap(tokens, vars, fnNames);
    const ir = irFromRPN(toRPN(tokens), (innerExpr) => parseExpressionIR(innerExpr, vars));
    return { source, tokens, aliases, ir };
  }

  function analyzeExpressionIR(ir, vars){
    const fnNames = new Set(Object.keys(getFns()));
    const tokens = tokenizeExpressionIR(ir);
    maybeEnsureSymbols(tokens);
    const aliases = buildAliasMap(tokens, vars, fnNames);
    return { tokens, aliases };
  }

  function findEquationUnknowns(expr, vars){
    const fns = new Set(Object.keys(getFns()));
    const tokens = expandTrailingNumericIdentifiers(tokenize(expr), vars, fns);
    const unknowns = [];
    for (let i = 0; i < tokens.length; i++){
      const t = tokens[i];
      if (t.type !== "id") continue;
      const name = t.value;
      const next = tokens[i + 1];
      if (next && next.type === "(") continue;
      if (name === "pi" || name === "e") continue;
      if (Object.prototype.hasOwnProperty.call(vars, name)) continue;
      if (fns.has(name)) continue;
      if (isUnitToken(name)){
        if (isBareUnitToken(tokens, i)){
          const nextId = tokens[i + 1];
          if (nextId && nextId.type === "id" && isUnitToken(nextId.value)){
            unknowns.push({ name, kind: "scalar", unitToken: false });
          }else{
            const unit = UNIT[name];
            unknowns.push({ name, kind: unit.kind, toBase: unit.toBase, unitToken: true });
          }
        }
        continue;
      }
      unknowns.push({ name, kind: "scalar", unitToken: false });
    }
    return unknowns;
  }

  function analyzeEquationUnknowns(leftExpr, rightExpr, vars){
    const unknowns = [
      ...findEquationUnknowns(leftExpr, vars),
      ...findEquationUnknowns(rightExpr, vars),
    ];
    const unique = new Map();
    for (const item of unknowns){
      if (!unique.has(item.name)) unique.set(item.name, item);
    }
    return Array.from(unique.values());
  }

  return {
    parseExpressionIR,
    analyzeExpression,
    analyzeExpressionIR,
    analyzeEquationUnknowns,
  };
}
