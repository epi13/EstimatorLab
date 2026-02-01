import {
  findTopLevelChar,
  findTopLevelEquals,
  findTopLevelKeyword,
  findTopLevelRange,
  parseForStatement,
  parseIfStatement,
  parseRepeatStatement,
  parseParams,
  splitAssemblyEntries,
} from "./repl-parser.js";

export function createEvaluator({
  state,
  getFns,
  isTruthy,
  normalizeCompare,
  tokenize,
  toRPN,
  evalRPN,
  insertImplicitMultiplication,
  buildAliasMap,
  UNIT,
  isQty,
  isUnitToken,
  makeQty,
  qtyToString,
  formatResult,
  ensureSymbolsLoaded,
  usageTracker,
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

  function getUsageHooks(){
    if (!usageTracker) return {};
    return usageTracker.getHooks();
  }
  function isBareUnitToken(tokens, idx){
    const token = tokens[idx];
    if (!token || token.type !== "id" || !isUnitToken(token.value)) return false;
    const prev = tokens[idx - 1];
    if (!prev) return true;
    if (prev.type === "num" || prev.type === "id" || prev.type === ")") return false;
    return true;
  }

  function findEquationUnknowns(expr, vars, fns){
    const tokens = tokenize(expr);
    const unknowns = [];
    for (let i = 0; i < tokens.length; i++){
      const t = tokens[i];
      if (t.type !== "id") continue;
      const name = t.value;
      const next = tokens[i + 1];
      if (next && next.type === "(") continue;
      if (name === "pi" || name === "e") continue;
      if (Object.prototype.hasOwnProperty.call(vars, name)) continue;
      if (fns && fns.has(name)) continue;
      if (isUnitToken(name)){
        if (isBareUnitToken(tokens, i)){
          const unit = UNIT[name];
          unknowns.push({ name, kind: unit.kind, toBase: unit.toBase, unitToken: true });
        }
        continue;
      }
      unknowns.push({ name, kind: "scalar", unitToken: false });
    }
    return unknowns;
  }

  function diffValues(left, right){
    if (isQty(left) && isQty(right)){
      if (left.kind !== right.kind) throw new Error(`Unit mismatch: ${left.kind} vs ${right.kind}`);
      return left.value - right.value;
    }
    if (isQty(left) && !isQty(right)){
      if (left.kind !== "scalar") throw new Error("Unit mismatch between quantity and scalar.");
      return left.value - right;
    }
    if (!isQty(left) && isQty(right)){
      if (right.kind !== "scalar") throw new Error("Unit mismatch between scalar and quantity.");
      return left - right.value;
    }
    return left - right;
  }

  function solveEquation(leftExpr, rightExpr){
    const fns = new Set(Object.keys(getFns()));
    const unknowns = [
      ...findEquationUnknowns(leftExpr, state.vars, fns),
      ...findEquationUnknowns(rightExpr, state.vars, fns),
    ];
    const unique = new Map();
    for (const item of unknowns){
      if (!unique.has(item.name)) unique.set(item.name, item);
    }
    const unknownList = Array.from(unique.values());
    if (unknownList.length !== 1){
      throw new Error("Equation must contain exactly one unknown identifier.");
    }
    const unknown = unknownList[0];
    const evaluateDiff = (x) => {
      const vars = Object.assign(Object.create(null), state.vars);
      let overrides = null;
      if (unknown.unitToken){
        overrides = {
          [unknown.name]: makeQty(x * unknown.toBase, unknown.kind),
        };
      }else{
        vars[unknown.name] = x;
      }
      const left = runExpressionWithOverrides(leftExpr, vars, overrides, Object.create(null));
      const right = runExpressionWithOverrides(rightExpr, vars, overrides, Object.create(null));
      return diffValues(left, right);
    };

    const tol = 1e-9;
    let a = 0;
    let fa = evaluateDiff(a);
    if (Math.abs(fa) <= tol) return { unknown, value: a };
    let b = 1;
    let fb = evaluateDiff(b);
    if (Math.abs(fb) <= tol) return { unknown, value: b };

    let step = 1;
    let bracketed = fa * fb < 0;
    for (let i = 0; i < 30 && !bracketed; i++){
      step *= 2;
      a -= step;
      b += step;
      fa = evaluateDiff(a);
      fb = evaluateDiff(b);
      if (Math.abs(fa) <= tol) return { unknown, value: a };
      if (Math.abs(fb) <= tol) return { unknown, value: b };
      bracketed = fa * fb < 0;
    }

    let x0 = a;
    let x1 = b;
    let f0 = fa;
    let f1 = fb;
    for (let i = 0; i < 60; i++){
      if (Math.abs(f1 - f0) < 1e-12) break;
      const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
      if (!Number.isFinite(x2)) break;
      const f2 = evaluateDiff(x2);
      if (Math.abs(f2) <= tol) return { unknown, value: x2 };
      x0 = x1;
      f0 = f1;
      x1 = x2;
      f1 = f2;
      if (bracketed && f0 * f1 < 0){
        a = x0;
        b = x1;
        fa = f0;
        fb = f1;
      }
    }

    if (bracketed){
      let left = a;
      let right = b;
      let fl = fa;
      let fr = fb;
      for (let i = 0; i < 80; i++){
        const mid = (left + right) / 2;
        const fm = evaluateDiff(mid);
        if (Math.abs(fm) <= tol) return { unknown, value: mid };
        if (fl * fm < 0){
          right = mid;
          fr = fm;
        }else{
          left = mid;
          fl = fm;
        }
      }
      return { unknown, value: (left + right) / 2 };
    }

    throw new Error("Could not solve equation (no convergence).");
  }

  function runExpressionWithContext(expr, vars){
    const tokens = insertImplicitMultiplication(tokenize(expr));
    maybeEnsureSymbols(tokens);
    const fns = getFns();
    const aliasMap = buildAliasMap(tokens, vars, new Set(Object.keys(fns)));
    const rpn = toRPN(tokens);
    return evalRPN(rpn, {
      vars,
      fns,
      aliases: aliasMap,
      ...getUsageHooks(),
    });
  }

  function runExpression(expr){
    return runExpressionWithContext(expr, state.vars);
  }

  function runExpressionWithOverrides(expr, vars, unitOverrides, aliasMap = null){
    const tokens = insertImplicitMultiplication(tokenize(expr));
    maybeEnsureSymbols(tokens);
    const fns = getFns();
    const resolvedAliases = aliasMap || buildAliasMap(tokens, vars, new Set(Object.keys(fns)));
    const rpn = toRPN(tokens);
    return evalRPN(rpn, {
      vars,
      fns,
      aliases: resolvedAliases,
      unitOverrides,
      ...getUsageHooks(),
    });
  }

  function isAssembly(value){
    return value && typeof value === "object" && value.__assy;
  }

  function createAssembly(name, fields){
    return {
      __assy: true,
      name,
      fields,
    };
  }

  function formatAssemblySummary(assy){
    const fields = assy.fields || {};
    const entries = Object.entries(fields).map(([key, info]) => {
      const value = info?.value;
      const note = info?.note;
      let rendered = isQty(value) ? qtyToString(value) : String(value);
      if (note) rendered += ` ${note}`;
      return `${key} = ${rendered}`;
    });
    const inner = entries.join("; ");
    return `assy ${assy.name}${inner ? ` { ${inner} }` : " {}"}`;
  }

  function formatValueDisplay(value){
    if (isAssembly(value)) return { main: formatAssemblySummary(value), extra: "" };
    return formatResult(value);
  }

  function parseAssemblyValue(valueStr){
    const raw = valueStr.trim();
    if (!raw) throw new Error("Assembly entry missing value.");

    const tryExpr = (expr) => {
      try{
        return { ok: true, value: runExpressionWithContext(expr, state.vars) };
      }catch{
        return { ok: false };
      }
    };

    const direct = tryExpr(raw);
    if (direct.ok) return { value: direct.value, note: "", raw };

    const parts = raw.split(/\s+/);
    for (let idx = parts.length - 1; idx >= 1; idx--){
      const candidate = parts.slice(0, idx).join(" ");
      const attempt = tryExpr(candidate);
      if (attempt.ok){
        const note = parts.slice(idx).join(" ");
        return { value: attempt.value, note, raw };
      }
    }

    return { value: raw, note: "", raw };
  }

  function parseAssemblyStatement(src){
    const assyMatch = src.match(/^assy\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([\s\S]*)\}$/i);
    if (!assyMatch) return null;
    const name = assyMatch[1];
    const body = assyMatch[2].trim();
    const entries = body ? splitAssemblyEntries(body) : [];
    const fields = Object.create(null);
    for (const entry of entries){
      const eqIdx = findTopLevelEquals(entry);
      if (eqIdx < 0) throw new Error("Assembly entries must be key = value.");
      const key = entry.slice(0, eqIdx).trim();
      if (!key) throw new Error("Assembly entry missing key.");
      const valueStr = entry.slice(eqIdx + 1).trim();
      const parsed = parseAssemblyValue(valueStr);
      fields[key] = parsed;
    }
    return { type: "assy", name, fields };
  }

  function evaluate(line){
    const src = line.trim();
    if (!src) return null;

    if (src.startsWith(":")){
      const parts = src.slice(1).trim().split(/\s+/);
      const cmd = (parts[0] || "").toLowerCase();
      const arg = parts.slice(1).join(" ");
      return { type:"cmd", cmd, arg };
    }

    if (/^if\s+/i.test(src)){
      return parseIfStatement(src);
    }

    if (/^for\s+/i.test(src)){
      return parseForStatement(src);
    }

    if (/^repeat\s+/i.test(src)){
      return parseRepeatStatement(src);
    }

    if (/^assy\b/i.test(src)){
      const parsed = parseAssemblyStatement(src);
      if (!parsed) throw new Error("Assembly must use: assy name = { key = value }");
      return parsed;
    }

    if (src.startsWith("#")) return null;

    const defMatch = src.match(/^(?:def|fn|so|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/);
    if (defMatch){
      const name = defMatch[1];
      const params = parseParams(defMatch[2]);
      return { type:"def", name, params, expr:defMatch[3] };
    }

    const m = src.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (m){
      return { type:"assign", name:m[1], expr:m[2] };
    }

    const eqIdx = findTopLevelEquals(src);
    if (eqIdx >= 0){
      const left = src.slice(0, eqIdx).trim();
      const right = src.slice(eqIdx + 1).trim();
      if (!left || !right) throw new Error("Equation must have left and right expressions.");
      return { type:"equation", left, right };
    }

    return { type:"expr", expr:src };
  }

  return {
    evaluate,
    runExpression,
    runExpressionWithContext,
    runExpressionWithOverrides,
    solveEquation,
    createAssembly,
    formatAssemblySummary,
    formatValueDisplay,
    isAssembly,
  };
}
