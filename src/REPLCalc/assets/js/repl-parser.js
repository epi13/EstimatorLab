import {
  STATEMENT_TYPE,
  createBlockNode,
  createBlockContext,
  createChildBlockContext,
  createStatementNode,
} from "./repl-ast.js";

function createStatementNodeId(blockContext, statementIndex){
  const blockId = typeof blockContext?.blockId === "string" ? blockContext.blockId.trim() : "";
  if (!blockId || !Number.isInteger(statementIndex) || statementIndex < 0){
    return null;
  }
  return `${blockId}:stmt:${statementIndex}`;
}

export function splitStatements(source){
  const out = [];
  const lines = source.split("\n");

  const isComment = (t) => t.trim().startsWith("#");
  const lineIndent = (l) => (l.match(/^\s*/) || [""])[0].length;

  function scanDelimiters(text){
    let quote = null;
    let escaped = false;
    let depth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    for (let i = 0; i < text.length; i++){
      const c = text[i];
      if (quote){
        if (escaped){
          escaped = false;
          continue;
        }
        if (c === "\\"){
          escaped = true;
          continue;
        }
        if (c === quote){
          quote = null;
          continue;
        }
        continue;
      }
      if (c === "#"){
        while (i < text.length && text[i] !== "\n") i += 1;
        continue;
      }
      if (c === "\"" || c === "'"){
        quote = c;
        continue;
      }
      if (c === "(") depth += 1;
      else if (c === ")") depth = Math.max(0, depth - 1);
      else if (c === "{") braceDepth += 1;
      else if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      else if (c === "[") bracketDepth += 1;
      else if (c === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    }
    return { quoteOpen: Boolean(quote), depth, braceDepth, bracketDepth };
  }

  function splitInlineFlow(stmt){
    const pieces = [];
    let depth = 0;
    let braceDepth = 0;
    let quote = null;
    let escaped = false;
    let start = 0;
    let atStmtStart = true;
    let pendingFlowColon = false;
    let inFlowBody = false;

    const isWs = (c) => /\s/.test(c);

    for (let i = 0; i < stmt.length; i++){
      const c = stmt[i];

      if (quote){
        if (escaped){
          escaped = false;
          continue;
        }
        if (c === "\\"){
          escaped = true;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }

      if (c === "\"" || c === "'"){
        quote = c;
        continue;
      }

      if (c === "(") depth += 1;
      else if (c === ")") depth = Math.max(0, depth - 1);
      else if (c === "{") braceDepth += 1;
      else if (c === "}") braceDepth = Math.max(0, braceDepth - 1);

      if (depth !== 0 || braceDepth !== 0) continue;

      if (atStmtStart){
        if (isWs(c)) continue;
        const rest = stmt.slice(i).toLowerCase();
        if (rest.startsWith("if") && isWs(stmt[i + 2] || "")) pendingFlowColon = true;
        else if (rest.startsWith("for") && isWs(stmt[i + 3] || "")) pendingFlowColon = true;
        else if (rest.startsWith("repeat") && isWs(stmt[i + 6] || "")) pendingFlowColon = true;
        atStmtStart = false;
      }

      if (pendingFlowColon && c === ":"){
        pendingFlowColon = false;
        inFlowBody = true;
        continue;
      }

      if (!inFlowBody && c === ";"){
        const piece = stmt.slice(start, i).trim();
        if (piece) pieces.push(piece);
        start = i + 1;
        atStmtStart = true;
        pendingFlowColon = false;
        inFlowBody = false;
      }
    }

    const tail = stmt.slice(start).trim();
    if (tail) pieces.push(tail);
    return pieces;
  }

  function readStatement(startIdx){
    const baseIndent = lineIndent(lines[startIdx]);
    const stmtLines = [lines[startIdx].trimEnd()];
    const firstTrim = lines[startIdx].trim();
    const isBlock = firstTrim.endsWith(":");
    let i = startIdx + 1;

    if (!isBlock){
      let rendered = stmtLines.join("\n");
      while (i < lines.length){
        const scan = scanDelimiters(rendered);
        if (!scan.quoteOpen && scan.depth === 0 && scan.braceDepth === 0 && scan.bracketDepth === 0) break;
        stmtLines.push(lines[i].trimEnd());
        i += 1;
        rendered = stmtLines.join("\n");
      }
      return { stmt: stmtLines.join("\n"), next: i };
    }

    while (i < lines.length){
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed || isComment(raw)){
        i += 1;
        continue;
      }
      const indent = lineIndent(raw);
      if (indent <= baseIndent){
        if (indent === baseIndent && trimmed.toLowerCase() === "else:"){
          stmtLines.push(raw.trimEnd());
          i += 1;
          continue;
        }
        break;
      }
      stmtLines.push(raw.trimEnd());
      i += 1;
    }
    return { stmt: stmtLines.join("\n"), next: i };
  }

  function hasTopLevelColon(text){
    let depth = 0;
    let braceDepth = 0;
    let quote = null;
    for (let i = 0; i < text.length; i++){
      const c = text[i];
      if (quote){
        if (c === "\\"){
          i += 1;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === "\"" || c === "'"){
        quote = c;
        continue;
      }
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      if (depth === 0 && braceDepth === 0 && c === ":") return true;
    }
    return false;
  }

  function splitSimple(stmt){
    const pieces = [];
    let depth = 0;
    let braceDepth = 0;
    let quote = null;
    let start = 0;
    for (let i = 0; i < stmt.length; i++){
      const c = stmt[i];
      if (quote){
        if (c === "\\"){
          i += 1;
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === "\"" || c === "'"){
        quote = c;
        continue;
      }
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      if (c === "{") braceDepth += 1;
      if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
      if (depth === 0 && braceDepth === 0 && (c === ";" || c === "\n")){
        const piece = stmt.slice(start, i).trim();
        if (piece) pieces.push(piece);
        start = i + 1;
      }
    }
    const tail = stmt.slice(start).trim();
    if (tail) pieces.push(tail);
    return pieces;
  }

  let idx = 0;
  while (idx < lines.length){
    const raw = lines[idx];
    const trimmed = raw.trim();
    if (!trimmed || isComment(raw)){
      idx += 1;
      continue;
    }
    const { stmt, next } = readStatement(idx);
    const rendered = stmt.trimEnd();
    if (rendered.trim()){
      if (rendered.includes("\n")){
        out.push(rendered);
      }else if (hasTopLevelColon(rendered)){
        out.push(...splitInlineFlow(rendered));
      }else{
        out.push(...splitSimple(rendered));
      }
    }
    idx = next;
  }

  return out;
}

export function parseBlockStatements(source, parseStatement, blockContext = null){
  const statements = splitStatements(source || "");
  const context = createBlockContext(blockContext || {});
  const parsedStatements = (typeof parseStatement === "function" ? statements
    .map((stmt, statementIndex) => parseStatement(stmt, {
      source: stmt,
      parentStatementType: context.parentStatementType,
      blockRole: context.blockRole,
      blockDepth: context.blockDepth,
      sourceSpan: context.sourceSpan,
      span: context.sourceSpan,
      blockId: context.blockId,
      statementIndex,
      nodeId: createStatementNodeId(context, statementIndex),
    }))
    .filter(Boolean) : []);
  return createBlockNode(parsedStatements, context);
}

export function findTopLevelChar(source, char){
  let depth = 0;
  let braceDepth = 0;
  for (let i = 0; i < source.length; i++){
    const c = source[i];
    if (c === "(") depth += 1;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (c === "{") braceDepth += 1;
    if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (depth === 0 && braceDepth === 0 && c === char) return i;
  }
  return -1;
}

export function findTopLevelEquals(source){
  let depth = 0;
  let braceDepth = 0;
  for (let i = 0; i < source.length; i++){
    const c = source[i];
    if (c === "(") depth += 1;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (c === "{") braceDepth += 1;
    if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (depth !== 0 || braceDepth !== 0) continue;
    if (c !== "=") continue;
    const prev = source[i - 1];
    const next = source[i + 1];
    if (prev === "!" || prev === "<" || prev === ">") continue;
    if (next === "=") continue;
    return i;
  }
  return -1;
}

export function findTopLevelKeyword(source, keyword){
  let depth = 0;
  let braceDepth = 0;
  const lower = keyword.toLowerCase();
  for (let i = 0; i < source.length; i++){
    const c = source[i];
    if (c === "(") depth += 1;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (c === "{") braceDepth += 1;
    if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (depth !== 0 || braceDepth !== 0) continue;
    if (source.slice(i, i + lower.length).toLowerCase() === lower){
      const before = source[i - 1];
      const after = source[i + lower.length];
      const beforeOk = !before || /\s/.test(before);
      const afterOk = !after || /\s|:/.test(after);
      if (beforeOk && afterOk) return i;
    }
  }
  return -1;
}

export function findTopLevelRange(source){
  let depth = 0;
  let braceDepth = 0;
  for (let i = 0; i < source.length - 1; i++){
    const c = source[i];
    if (c === "(") depth += 1;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (c === "{") braceDepth += 1;
    if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (depth === 0 && braceDepth === 0 && source[i] === "." && source[i + 1] === ".") return i;
  }
  return -1;
}

export function splitAssemblyEntries(source){
  const out = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < source.length; i++){
    const c = source[i];
    if (c === "\\" && quote){
      i += 1;
      continue;
    }
    if (quote){
      if (c === quote) quote = null;
      continue;
    }
    if (c === "\"" || c === "'"){
      quote = c;
      continue;
    }
    if (c === "(") depth += 1;
    if (c === ")") depth = Math.max(0, depth - 1);
    if ((c === "\n" || c === ";") && depth === 0){
      const piece = source.slice(start, i).trim();
      if (piece) out.push(piece);
      start = i + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

export function parseIfStatement(src, parseStatement, blockContext = null, origin = null){
  const lines = src.split("\n");
  const firstRaw = lines[0] || "";
  const first = firstRaw.trim();
  const remainder = first.replace(/^if\s+/i, "");
  const colonIdx = findTopLevelChar(remainder, ":");
  if (colonIdx < 0) throw new Error("if statement missing ':'");
  const condition = remainder.slice(0, colonIdx).trim();
  const inlineRest = remainder.slice(colonIdx + 1).trim();

  const baseIndent = (firstRaw.match(/^\s*/) || [""])[0].length;

  if (lines.length === 1){
    const rest = inlineRest;
    const elseIdx = findTopLevelKeyword(rest, "else");
    if (elseIdx < 0){
      return createStatementNode(STATEMENT_TYPE.IF, { condition, thenBody: parseBlockStatements(rest, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.IF, blockRole: "then" })), elseBody: null }, origin);
    }
    const thenBody = rest.slice(0, elseIdx).trim();
    let elseBody = rest.slice(elseIdx + 4).trim();
    if (elseBody.startsWith(":")) elseBody = elseBody.slice(1).trim();
    if (!elseBody) throw new Error("else statement missing body");
    return createStatementNode(STATEMENT_TYPE.IF, {
      condition,
      thenBody: parseBlockStatements(thenBody, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.IF, blockRole: "then" })),
      elseBody: parseBlockStatements(elseBody, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.IF, blockRole: "else" })),
    }, origin);
  }

  const thenLines = [];
  const elseLines = [];
  let inElse = false;

  if (inlineRest) thenLines.push(inlineRest);

  for (let i = 1; i < lines.length; i++){
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    const indent = (raw.match(/^\s*/) || [""])[0].length;

    if (indent === baseIndent && trimmed.toLowerCase() === "else:"){
      inElse = true;
      continue;
    }

    if (indent <= baseIndent){
      continue;
    }

    if (inElse) elseLines.push(raw.trimEnd());
    else thenLines.push(raw.trimEnd());
  }

  const thenBody = thenLines.join("\n").trimEnd();
  const elseBody = elseLines.join("\n").trimEnd();
  if (!thenBody) throw new Error("if statement missing body");
  if (!elseBody && !thenBody.includes("\n")){
    const inlineElse = findTopLevelKeyword(thenBody, "else");
    if (inlineElse >= 0){
      const actualThen = thenBody.slice(0, inlineElse).trim();
      let actualElse = thenBody.slice(inlineElse + 4).trim();
      if (actualElse.startsWith(":")) actualElse = actualElse.slice(1).trim();
      if (actualThen && actualElse){
        return createStatementNode(STATEMENT_TYPE.IF, {
          condition,
          thenBody: parseBlockStatements(actualThen, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.IF, blockRole: "then" })),
          elseBody: parseBlockStatements(actualElse, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.IF, blockRole: "else" })),
        }, origin);
      }
    }
  }
  return createStatementNode(STATEMENT_TYPE.IF, {
    condition,
    thenBody: parseBlockStatements(thenBody, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.IF, blockRole: "then" })),
    elseBody: elseBody ? parseBlockStatements(elseBody, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.IF, blockRole: "else" })) : null,
  }, origin);
}

export function parseForStatement(src, parseStatement, blockContext = null, origin = null){
  const lines = src.split("\n");
  const firstRaw = lines[0] || "";
  const first = firstRaw.trim();
  const remainder = first.replace(/^for\s+/i, "");
  const match = remainder.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([\s\S]+)$/);
  if (!match) throw new Error("for statement must be: for var in start..end : expr");
  const varName = match[1];
  const rest = match[2];
  const colonIdx = findTopLevelChar(rest, ":");
  if (colonIdx < 0) throw new Error("for statement missing ':'");
  const rangePart = rest.slice(0, colonIdx).trim();
  const inlineBody = rest.slice(colonIdx + 1).trim();
  const stepIdx = findTopLevelKeyword(rangePart, "step");
  const rangeExpr = stepIdx >= 0 ? rangePart.slice(0, stepIdx).trim() : rangePart;
  const stepExpr = stepIdx >= 0 ? rangePart.slice(stepIdx + 4).trim() : null;
  const rangeIdx = findTopLevelRange(rangeExpr);
  if (rangeIdx < 0) throw new Error("for statement range must use start..end");
  const startExpr = rangeExpr.slice(0, rangeIdx).trim();
  const endExpr = rangeExpr.slice(rangeIdx + 2).trim();

  if (lines.length === 1){
    const bodyContext = createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.FOR, blockRole: "body" });
    const body = parseBlockStatements(inlineBody, parseStatement, bodyContext);
    return createStatementNode(STATEMENT_TYPE.FOR, { varName, startExpr, endExpr, stepExpr, body }, origin);
  }

  const baseIndent = (firstRaw.match(/^\s*/) || [""])[0].length;
  const bodyLines = [];
  if (inlineBody) bodyLines.push(inlineBody);
  for (let i = 1; i < lines.length; i++){
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    const indent = (raw.match(/^\s*/) || [""])[0].length;
    if (indent <= baseIndent) continue;
    bodyLines.push(raw.trimEnd());
  }
  const body = bodyLines.join("\n").trimEnd();
  if (!body) throw new Error("for statement missing body");
  return createStatementNode(STATEMENT_TYPE.FOR, {
    varName,
    startExpr,
    endExpr,
    stepExpr,
    body: parseBlockStatements(body, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.FOR, blockRole: "body" })),
  }, origin);
}

export function parseRepeatStatement(src, parseStatement, blockContext = null, origin = null){
  const lines = src.split("\n");
  const firstRaw = lines[0] || "";
  const first = firstRaw.trim();
  const remainder = first.replace(/^repeat\s+/i, "");
  const colonIdx = findTopLevelChar(remainder, ":");
  if (colonIdx < 0) throw new Error("repeat statement missing ':'");
  const countExpr = remainder.slice(0, colonIdx).trim();
  const inlineBody = remainder.slice(colonIdx + 1).trim();
  if (!countExpr) throw new Error("repeat statement requires count and body");

  if (lines.length === 1){
    const body = inlineBody;
    if (!body) throw new Error("repeat statement requires count and body");
    return createStatementNode(STATEMENT_TYPE.REPEAT, {
      countExpr,
      body: parseBlockStatements(body, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.REPEAT, blockRole: "body" })),
    }, origin);
  }

  const baseIndent = (firstRaw.match(/^\s*/) || [""])[0].length;
  const bodyLines = [];
  if (inlineBody) bodyLines.push(inlineBody);
  for (let i = 1; i < lines.length; i++){
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    const indent = (raw.match(/^\s*/) || [""])[0].length;
    if (indent <= baseIndent) continue;
    bodyLines.push(raw.trimEnd());
  }
  const body = bodyLines.join("\n").trimEnd();
  if (!body) throw new Error("repeat statement requires count and body");
  return createStatementNode(STATEMENT_TYPE.REPEAT, {
    countExpr,
    body: parseBlockStatements(body, parseStatement, createChildBlockContext(blockContext, { parentStatementType: STATEMENT_TYPE.REPEAT, blockRole: "body" })),
  }, origin);
}

export function parseParams(paramText){
  if (!paramText.trim()) return [];
  const params = paramText.split(",").map((p) => p.trim()).filter(Boolean);
  const seen = new Set();
  for (const p of params){
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p)) throw new Error(`Invalid parameter name: ${p}`);
    if (seen.has(p)) throw new Error(`Duplicate parameter name: ${p}`);
    seen.add(p);
  }
  return params;
}
