import { getIRNodeChildren, irFromRPN, toCanonicalIRNode } from "./repl-expression-ir.js";
import { createReplNormalize } from "./repl-normalize.js";

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
  const normalizer = createReplNormalize({ UNIT, isUnitToken });

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
      const canonicalNode = toCanonicalIRNode(node);
      if (!canonicalNode) return;
      if (canonicalNode.kind === "identifier"){
        out.push({ type: "id", value: canonicalNode.name });
        return;
      }
      const children = getIRNodeChildren(canonicalNode);
      for (const child of children){
        walk(child);
      }
    }
    walk(ir);
    return out;
  }

  function parseExpressionIR(expr, vars){
    if (expr && typeof expr === "object" && expr.kind){
      return normalizer.normalizeExpressionIR(toCanonicalIRNode(expr));
    }
    const source = String(expr ?? "");
    const fnNames = new Set(Object.keys(getFns()));
    const expanded = expandTrailingNumericIdentifiers(tokenize(source), vars, fnNames);
    const tokens = insertImplicitMultiplication(expanded);
    const ir = irFromRPN(toRPN(tokens), (innerExpr) => parseExpressionIR(innerExpr, vars));
    return normalizer.normalizeExpressionIR(ir);
  }

  function analyzeExpression(expr, vars){
    const source = String(expr ?? "");
    const fnNames = new Set(Object.keys(getFns()));
    const expanded = expandTrailingNumericIdentifiers(tokenize(source), vars, fnNames);
    const tokens = insertImplicitMultiplication(expanded);
    maybeEnsureSymbols(tokens);
    const aliases = buildAliasMap(tokens, vars, fnNames);
    const irRaw = irFromRPN(toRPN(tokens), (innerExpr) => parseExpressionIR(innerExpr, vars));
    const ir = normalizer.normalizeExpressionIR(irRaw, aliases);
    const canonicalKey = normalizer.canonicalExpressionKey(ir, aliases);
    return { source, tokens, aliases, ir, canonicalKey };
  }

  function similarityScore(leftName, rightName){
    const left = String(leftName || "").toLowerCase();
    const right = String(rightName || "").toLowerCase();
    let prefix = 0;
    while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]){
      prefix += 1;
    }
    let longest = 0;
    for (let i = 0; i < left.length; i++){
      for (let j = 0; j < right.length; j++){
        let k = 0;
        while (left[i + k] && right[j + k] && left[i + k] === right[j + k]){
          k += 1;
        }
        if (k > longest) longest = k;
      }
    }
    let score = prefix * 2 + longest;
    if (left.includes(right) || right.includes(left)) score += 2;
    return score;
  }

  function rankAliasCandidates(name, candidates){
    return (Array.isArray(candidates) ? candidates : [])
      .map((candidate) => ({
        candidate,
        score: similarityScore(name, candidate),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  function analyzeAliasAmbiguityCandidates(tokens, vars, fnNames){
    const defaultAliases = buildAliasMap(tokens, vars, fnNames);
    const available = new Set(Object.keys(vars || {}));
    const referenced = new Set();
    const unknown = new Set();

    for (let i = 0; i < tokens.length; i++){
      const token = tokens[i];
      if (!token || token.type !== "id") continue;
      const name = token.value;
      const next = tokens[i + 1];
      if (next && next.type === "(") continue;
      if (Object.prototype.hasOwnProperty.call(vars, name)){
        referenced.add(name);
        continue;
      }
      if (isUnitToken(name) || name === "pi" || name === "e") continue;
      if (fnNames && fnNames.has(name)) continue;
      if (name.includes(".")) continue;
      unknown.add(name);
    }

    for (const name of referenced){
      available.delete(name);
    }
    for (const alias of Object.values(defaultAliases)){
      available.delete(alias);
    }

    const out = [{
      transitionType: "alias-default",
      scoreDelta: 0,
      confidence: 1,
      aliases: defaultAliases,
      meta: { strategy: "alias-default" },
    }];
    const seen = new Set([JSON.stringify(defaultAliases)]);

    for (const name of unknown){
      if (Object.prototype.hasOwnProperty.call(defaultAliases, name)) continue;
      const ranked = rankAliasCandidates(name, Array.from(available));
      if (ranked.length < 2) continue;
      if (ranked[0].score !== ranked[1].score) continue;

      for (let i = 0; i < Math.min(2, ranked.length); i++){
        const option = ranked[i];
        const aliases = Object.assign(Object.create(null), defaultAliases, { [name]: option.candidate });
        const key = JSON.stringify(aliases);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          transitionType: "alias-ambiguity",
          scoreDelta: -0.12 - (i * 0.02),
          confidence: 0.7 - (i * 0.05),
          aliases,
          meta: {
            strategy: "alias-ambiguity",
            unknownName: name,
            aliasTarget: option.candidate,
            similarityScore: option.score,
          },
        });
      }
    }

    return out;
  }

  function analyzeExpressionTransitions(expr, vars){
    const source = String(expr ?? "");
    const fnNames = new Set(Object.keys(getFns()));
    const expanded = expandTrailingNumericIdentifiers(tokenize(source), vars, fnNames);
    const tokens = insertImplicitMultiplication(expanded);
    maybeEnsureSymbols(tokens);
    const irRaw = irFromRPN(toRPN(tokens), (innerExpr) => parseExpressionIR(innerExpr, vars));
    const aliasCandidates = analyzeAliasAmbiguityCandidates(tokens, vars, fnNames);
    return aliasCandidates.map((candidate) => {
      const ir = normalizer.normalizeExpressionIR(irRaw, candidate.aliases);
      const canonicalKey = normalizer.canonicalExpressionKey(ir, candidate.aliases);
      return {
        source,
        tokens,
        aliases: candidate.aliases,
        ir,
        canonicalKey,
        transitionType: candidate.transitionType,
        scoreDelta: candidate.scoreDelta,
        confidence: candidate.confidence,
        meta: candidate.meta,
      };
    });
  }

  function analyzeExpressionIR(ir, vars){
    const normalizedIr = normalizer.normalizeExpressionIR(ir);
    const fnNames = new Set(Object.keys(getFns()));
    const tokens = tokenizeExpressionIR(normalizedIr);
    maybeEnsureSymbols(tokens);
    const aliases = buildAliasMap(tokens, vars, fnNames);
    const irWithAliases = normalizer.normalizeExpressionIR(normalizedIr, aliases);
    const canonicalKey = normalizer.canonicalExpressionKey(irWithAliases, aliases);
    return { tokens, aliases, ir: irWithAliases, canonicalKey };
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
    analyzeExpressionTransitions,
    analyzeExpressionIR,
    analyzeEquationUnknowns,
    normalizeExpressionIR: normalizer.normalizeExpressionIR,
    normalizeIdentifier: normalizer.normalizeIdentifier,
    normalizeStatementNode: normalizer.normalizeStatementNode,
    normalizeBlockNode: normalizer.normalizeBlockNode,
    canonicalKey: {
      expression: normalizer.canonicalExpressionKey,
      state: normalizer.canonicalStateKey,
    },
  };
}
