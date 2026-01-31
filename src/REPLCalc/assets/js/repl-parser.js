export function splitStatements(source){
  const out = [];
  const normalized = [];
  const lines = source.split("\n");
  let blockIndent = null;
  for (let idx = 0; idx < lines.length; idx++){
    const line = lines[idx];
    const indent = (line.match(/^\s*/) || [""])[0].length;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (blockIndent !== null){
      if (indent > blockIndent){
        const last = normalized.pop();
        normalized.push(`${last}; ${trimmed}`);
        continue;
      }
      blockIndent = null;
    }
    normalized.push(line.trimEnd());
    if (trimmed.endsWith(":")) blockIndent = indent;
  }

  let depth = 0;
  let braceDepth = 0;
  let start = 0;
  const joined = normalized.join("\n");
  for (let i = 0; i < joined.length; i++){
    const c = joined[i];
    if (c === "(") depth += 1;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (c === "{") braceDepth += 1;
    if (c === "}") braceDepth = Math.max(0, braceDepth - 1);
    const isBreak = (c === "\n" || c === ";") && depth === 0 && braceDepth === 0;
    if (isBreak){
      const piece = joined.slice(start, i).trim();
      if (piece) out.push(piece);
      start = i + 1;
    }
  }
  const tail = joined.slice(start).trim();
  if (tail) out.push(tail);
  return out;
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

export function parseIfStatement(src){
  const remainder = src.replace(/^if\s+/i, "");
  const colonIdx = findTopLevelChar(remainder, ":");
  if (colonIdx < 0) throw new Error("if statement missing ':'");
  const condition = remainder.slice(0, colonIdx).trim();
  const rest = remainder.slice(colonIdx + 1).trim();
  const elseIdx = findTopLevelKeyword(rest, "else");
  if (elseIdx < 0){
    return { type:"if", condition, thenBody: rest, elseBody: null };
  }
  const thenBody = rest.slice(0, elseIdx).trim();
  let elseBody = rest.slice(elseIdx + 4).trim();
  if (elseBody.startsWith(":")) elseBody = elseBody.slice(1).trim();
  if (!elseBody) throw new Error("else statement missing body");
  return { type:"if", condition, thenBody, elseBody };
}

export function parseForStatement(src){
  const remainder = src.replace(/^for\s+/i, "");
  const match = remainder.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([\s\S]+)$/);
  if (!match) throw new Error("for statement must be: for var in start..end : expr");
  const varName = match[1];
  const rest = match[2];
  const colonIdx = findTopLevelChar(rest, ":");
  if (colonIdx < 0) throw new Error("for statement missing ':'");
  const rangePart = rest.slice(0, colonIdx).trim();
  const body = rest.slice(colonIdx + 1).trim();
  const stepIdx = findTopLevelKeyword(rangePart, "step");
  const rangeExpr = stepIdx >= 0 ? rangePart.slice(0, stepIdx).trim() : rangePart;
  const stepExpr = stepIdx >= 0 ? rangePart.slice(stepIdx + 4).trim() : null;
  const rangeIdx = findTopLevelRange(rangeExpr);
  if (rangeIdx < 0) throw new Error("for statement range must use start..end");
  const startExpr = rangeExpr.slice(0, rangeIdx).trim();
  const endExpr = rangeExpr.slice(rangeIdx + 2).trim();
  return {
    type:"for",
    varName,
    startExpr,
    endExpr,
    stepExpr,
    body,
  };
}

export function parseRepeatStatement(src){
  const remainder = src.replace(/^repeat\s+/i, "");
  const colonIdx = findTopLevelChar(remainder, ":");
  if (colonIdx < 0) throw new Error("repeat statement missing ':'");
  const countExpr = remainder.slice(0, colonIdx).trim();
  const body = remainder.slice(colonIdx + 1).trim();
  if (!countExpr || !body) throw new Error("repeat statement requires count and body");
  return { type:"repeat", countExpr, body };
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
