import {
  findTopLevelEquals,
  parseForStatement,
  parseIfStatement,
  parseBlockStatements,
  parseRepeatStatement,
  parseParams,
  splitAssemblyEntries,
} from "./repl-parser.js";
import {
  STATEMENT_TYPE,
  createBlockNode,
  createStatementNode,
} from "./repl-ast.js";

export function parseAssemblyValue(valueStr, parseExpressionIR){
  const raw = valueStr.trim();
  if (!raw) throw new Error("Assembly entry missing value.");

  const tryExpr = (expr) => {
    try{
      return { ok: true, exprIr: parseExpressionIR(expr) };
    }catch{
      return { ok: false };
    }
  };

  const direct = tryExpr(raw);
  if (direct.ok) return { expr: raw, exprIr: direct.exprIr, note: "", raw };

  const parts = raw.split(/\s+/);
  for (let idx = parts.length - 1; idx >= 1; idx--){
    const candidate = parts.slice(0, idx).join(" ");
    const attempt = tryExpr(candidate);
    if (attempt.ok){
      const note = parts.slice(idx).join(" ");
      return { expr: candidate, exprIr: attempt.exprIr, note, raw };
    }
  }

  return { expr: null, exprIr: null, note: "", raw };
}

export function parseAssemblyStatement(src, parseExpressionIR, origin = null){
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
    const parsed = parseAssemblyValue(valueStr, parseExpressionIR);
    fields[key] = parsed;
  }
  return createStatementNode(STATEMENT_TYPE.ASSY, { name, fields }, origin);
}

export function createReplFrontend({ parseExpressionIR }){
  function evaluate(line, origin = null){
    const raw = line.trimEnd();
    const src = raw.trim();
    if (!src) return null;

    if (src.startsWith(":")){
      const parts = src.slice(1).trim().split(/\s+/);
      const cmd = (parts[0] || "").toLowerCase();
      const arg = parts.slice(1).join(" ");
      return createStatementNode(STATEMENT_TYPE.CMD, { cmd, arg }, origin);
    }

    if (/^if\s+/i.test(src)){
      return parseIfStatement(raw, evaluate, origin, origin);
    }

    if (/^for\s+/i.test(src)){
      return parseForStatement(raw, evaluate, origin, origin);
    }

    if (/^repeat\s+/i.test(src)){
      return parseRepeatStatement(raw, evaluate, origin, origin);
    }

    if (/^assy\b/i.test(src)){
      const parsed = parseAssemblyStatement(src, parseExpressionIR, origin);
      if (!parsed) throw new Error("Assembly must use: assy name = { key = value }");
      return parsed;
    }

    if (src.startsWith("#")) return null;

    const defMatch = src.match(/^(?:def|fn|so|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/);
    if (defMatch){
      const name = defMatch[1];
      const params = parseParams(defMatch[2]);
      return createStatementNode(STATEMENT_TYPE.DEF, { name, params, expr:defMatch[3] }, origin);
    }

    const m = src.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (m){
      return createStatementNode(STATEMENT_TYPE.ASSIGN, { name:m[1], expr:m[2], exprIr: parseExpressionIR(m[2]) }, origin);
    }

    const eqIdx = findTopLevelEquals(src);
    if (eqIdx >= 0){
      const left = src.slice(0, eqIdx).trim();
      const right = src.slice(eqIdx + 1).trim();
      if (!left || !right) throw new Error("Equation must have left and right expressions.");
      return createStatementNode(STATEMENT_TYPE.EQUATION, { left, right }, origin);
    }

    return createStatementNode(STATEMENT_TYPE.EXPR, { expr:src, exprIr: parseExpressionIR(src) }, origin);
  }

  function parseSource(source, origin = null){
    const src = String(source || "");
    if (!src.trim()){
      return createBlockNode([], origin && typeof origin === "object" ? origin : null);
    }
    const parsed = parseBlockStatements(src, evaluate, origin || null);
    return parsed;
  }

  return {
    evaluate,
    parseSource,
  };
}
