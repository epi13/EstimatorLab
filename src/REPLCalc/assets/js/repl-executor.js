export const previewStmt = (stmt) => {
  const trimmed = String(stmt || "").trim();
  if (!trimmed) return "";
  const maxLen = 220;
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
};

export const wrapExecutionError = (err, stmt, stmtIdx, contextPath) => {
  const msg = err?.message || String(err);
  if (typeof msg === "string" && msg.startsWith("Loop error at ")){
    return err instanceof Error ? err : new Error(msg);
  }
  const path = Array.isArray(contextPath) ? contextPath : [];
  const where = path.length ? `${path.join(" > ")} > ` : "";
  const preview = previewStmt(stmt);
  const rendered = preview ? JSON.stringify(preview) : "(empty statement)";
  return new Error(`Loop error at ${where}stmt#${stmtIdx + 1} ${rendered}: ${msg}`);
};

export const executeStatementSafely = (stmt, stmtIdx, env, options = {}) => {
  const parseStatement = env?.parseStatement || env?.parse;
  const executeParsedStatement = env?.executeParsedStatement || env?.executeParsed || env?.execute;

  try{
    const parsed = parseStatement ? parseStatement(stmt, stmtIdx, options) : null;
    if (!parsed) return null;
    if (!executeParsedStatement){
      throw new Error("Missing executeParsedStatement handler");
    }
    return executeParsedStatement(parsed, stmt, stmtIdx, options);
  }catch(err){
    if (options?.wrapErrors){
      throw wrapExecutionError(err, stmt, stmtIdx, options.contextPath);
    }
    throw err;
  }
};
