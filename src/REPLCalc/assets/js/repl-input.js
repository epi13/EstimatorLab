import { handleDoomInput, runDoomDemo } from "./repl-doom.js";
import { parseParams, splitStatements } from "./repl-parser.js";

export function createInputHandlers({
  state,
  ui,
  editor,
  userFnUi,
  docs,
  session,
  tests,
  evaluator,
  runtime,
  gfx,
  isTruthy,
  normalizeCompare,
  isQty,
  makeQty,
}){
  const {
    inputEl,
    highlightEl,
    btnHelp,
    btnClear,
    btnVars,
    btnMethods,
    btnExport,
    btnImport,
    btnReset,
    fnNameInput,
    fnParamsInput,
    fnExprInput,
    btnFnSave,
    btnFnClear,
    writeLine,
    writeInputEcho,
    setStatus,
    clearTerminal,
    nowStamp,
    setTheme,
  } = ui;

  const {
    formatInput,
    isStatementComplete,
    updateHighlight,
    syncEditorHeight,
    scheduleLiveResult,
    getTokenAtCursor,
    openAutocomplete,
    closeAutocomplete,
    applyAutocomplete,
    renderAutocomplete,
    autocompleteState,
  } = editor;
  const { renderUserFunctions, clearFnForm } = userFnUi;

  const { showHelp, showDocs, listVars, listMethods } = docs;
  const {
    exportSession,
    importSession,
    copyText,
    readClipboard,
    saveProfile,
    loadProfile,
    listProfiles,
    beginUsage,
    endUsage,
    pinSymbol,
    unpinSymbol,
    whichSymbol,
    useSymbolFromProfile,
    diffSymbol,
    muxProfile,
    recordSymbolDefinition,
    resetAll,
  } = session;
  const { runTestSuite } = tests;
  const {
    evaluate,
    runExpression,
    solveEquation,
    createAssembly,
    formatValueDisplay,
  } = evaluator;
  const { defineUserFn } = runtime;
  const { flushGfxOutput } = gfx;


  function pushHistory(line){
    const trimmed = line.trim();
    if (!trimmed) return;
    if (state.history.length && state.history[state.history.length-1] === trimmed) return;
    state.history.push(trimmed);
    if (state.history.length > 500) state.history.shift();
    state.histIdx = state.history.length;
  }

  function countOpenParens(text){
    let depth = 0;
    for (const c of text){
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(depth - 1, 0);
    }
    return depth;
  }

  function getIndentation(value, cursor){
    const before = value.slice(0, cursor);
    const lineStart = before.lastIndexOf("\n") + 1;
    const line = before.slice(lineStart);
    const leading = (line.match(/^\s*/) || [""])[0];
    const depth = countOpenParens(before);
    let desired = "  ".repeat(depth);
    const trimmed = line.trim();
    if (!depth && trimmed.endsWith(":")){
      desired += "  ";
    }
    return desired.length > leading.length ? desired : leading;
  }

  async function handleLine(line){
    const statementList = splitStatements(line);
    if (!statementList.length) return;

    try{
      for (const stmt of statementList){
        if (handleDoomInput(stmt, { gfx, writeLine })){
          continue;
        }
        const parsed = evaluate(stmt);
        if (!parsed) continue;
        const usageEntry = beginUsage(parsed, stmt);

        try{
          if (parsed.type === "cmd"){
            const {cmd,arg} = parsed;
            if (cmd === "help"){ showHelp(); continue; }
            if (cmd === "docs"){ showDocs(); continue; }
            if (cmd === "clear"){ clearTerminal(); continue; }
            if (cmd === "vars"){ listVars(); continue; }
            if (cmd === "methods"){ listMethods(); continue; }
            if (cmd === "reset"){ resetAll(); continue; }
            if (cmd === "save"){ saveProfile(arg); continue; }
            if (cmd === "mux"){ muxProfile(arg); continue; }
            if (cmd === "load"){ loadProfile(arg); continue; }
            if (cmd === "profiles"){ listProfiles(); continue; }
            if (cmd === "pin"){ pinSymbol(arg); continue; }
            if (cmd === "unpin"){ unpinSymbol(arg); continue; }
            if (cmd === "which"){ whichSymbol(arg); continue; }
            if (cmd === "use"){ useSymbolFromProfile(arg); continue; }
            if (cmd === "diff"){ diffSymbol(arg); continue; }
            if (cmd === "theme"){ setTheme((arg||"").trim()); writeLine(`Theme set to ${state.theme}.`, "ok"); continue; }
            if (cmd === "doom"){ runDoomDemo({ gfx, writeLine, writeInputEcho }); continue; }
            if (cmd === "test"){ runTestSuite(); continue; }

            if (cmd === "export"){
              const text = exportSession();
              await copyText(text);
              continue;
            }
            if (cmd === "import"){
              const text = await readClipboard();
              importSession(text);
              writeLine("Imported profile from clipboard.", "ok");
              continue;
            }
            throw new Error(`Unknown command: :${cmd}`);
          }

        if (parsed.type === "def"){
          const existed = Object.prototype.hasOwnProperty.call(state.userFns, parsed.name);
          defineUserFn(parsed.name, parsed.params, parsed.expr);
          const verb = existed ? "Updated" : "Added";
          writeLine(`${verb} function ${parsed.name}(${parsed.params.join(", ")}).`, "ok");
          continue;
        }

        if (parsed.type === "assy"){
          const assembly = createAssembly(parsed.name, parsed.fields);
          state.vars[parsed.name] = assembly;
          recordSymbolDefinition({
            name: parsed.name,
            kind: "assy",
            fields: parsed.fields,
            value: assembly,
          });
          const fr = formatValueDisplay(assembly);
          writeLine(`${parsed.name} = ${fr.main}`, "ok");
          continue;
        }

        if (parsed.type === "assign"){
          const val = runExpression(parsed.expr);
          state.vars[parsed.name] = val;
          recordSymbolDefinition({
            name: parsed.name,
            kind: "var",
            expr: parsed.expr,
            value: val,
          });
          const fr = formatValueDisplay(val);
          writeLine(`${parsed.name} = ${fr.main}`, "ok");
          if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
          continue;
        }

        if (parsed.type === "equation"){
          const solved = solveEquation(parsed.left, parsed.right);
          let solvedValue;
          if (solved.unknown.unitToken){
            solvedValue = makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind);
          }else{
            solvedValue = solved.value;
            state.vars[solved.unknown.name] = solvedValue;
            recordSymbolDefinition({
              name: solved.unknown.name,
              kind: "var",
              expr: `${parsed.left} = ${parsed.right}`,
              value: solvedValue,
            });
          }
          const fr = formatValueDisplay(solvedValue);
          writeLine(`${solved.unknown.name} = ${fr.main}`, "ok");
          if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
          continue;
        }

        if (parsed.type === "if"){
          const cond = runExpression(parsed.condition);
          if (isTruthy(cond)){
            await handleLine(parsed.thenBody);
          }else if (parsed.elseBody){
            await handleLine(parsed.elseBody);
          }
          continue;
        }

        if (parsed.type === "for"){
          const startVal = runExpression(parsed.startExpr);
          const endVal = runExpression(parsed.endExpr);
          const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr) : 1;
          let start;
          let end;
          let step;
          let loopKind = null;
          if (isQty(startVal) || isQty(endVal)){
            if (!isQty(startVal) || !isQty(endVal)){
              throw new Error("for loop range must use matching unit quantities");
            }
            if (startVal.kind !== endVal.kind){
              throw new Error("for loop range units must match");
            }
            loopKind = startVal.kind;
            start = startVal.value;
            end = endVal.value;
            if (isQty(stepVal)){
              if (stepVal.kind !== loopKind) throw new Error("for loop step unit mismatch");
              step = stepVal.value;
            }else{
              step = stepVal;
            }
          }else{
            [start, end] = normalizeCompare(startVal, endVal);
            step = normalizeCompare(stepVal, 0)[0];
          }
          if (step === 0) throw new Error("for loop step cannot be 0");
          const hadVar = Object.prototype.hasOwnProperty.call(state.vars, parsed.varName);
          const prevVal = state.vars[parsed.varName];
          const forward = step > 0;
          for (let i = start; forward ? i <= end : i >= end; i += step){
            state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
            await handleLine(parsed.body);
          }
          if (hadVar) state.vars[parsed.varName] = prevVal;
          else delete state.vars[parsed.varName];
          continue;
        }

        if (parsed.type === "repeat"){
          const countVal = runExpression(parsed.countExpr);
          const count = normalizeCompare(countVal, 0)[0];
          if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
          for (let i = 0; i < Math.floor(count); i++){
            await handleLine(parsed.body);
          }
          continue;
        }

        if (parsed.type === "expr"){
          const val = runExpression(parsed.expr);
          const fr = formatValueDisplay(val);
          writeLine(fr.main, "out");
          if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
          continue;
        }
        }finally{
          endUsage(usageEntry);
        }
      }
    }catch(err){
      setStatus("Error", "err");
      writeLine(`[${nowStamp()}] ${err.message || String(err)}`, "err");
    }finally{
      flushGfxOutput();
      setStatus("Ready", "ok");
    }
  }

  async function submitInput(){
    const raw = inputEl.value;
    const formatted = formatInput(raw);
    if (!formatted.trim()) return;
    inputEl.value = "";
    closeAutocomplete();
    writeInputEcho(formatted);
    pushHistory(formatted);
    updateHighlight();
    syncEditorHeight();
    await handleLine(formatted);
    scheduleLiveResult();
  }

  inputEl.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey){
      if (autocompleteState.open && autocompleteState.userNavigated){
        applyAutocomplete(autocompleteState.index);
        e.preventDefault();
        return;
      }
      const value = inputEl.value;
      if (!isStatementComplete(value)){
        const cursor = inputEl.selectionStart;
        const indent = getIndentation(value, cursor);
        const insert = `\n${indent}`;
        const before = value.slice(0, cursor);
        const after = value.slice(inputEl.selectionEnd);
        inputEl.value = `${before}${insert}${after}`;
        const newPos = before.length + insert.length;
        inputEl.setSelectionRange(newPos, newPos);
        updateHighlight();
        syncEditorHeight();
        scheduleLiveResult();
        e.preventDefault();
        return;
      }
      await submitInput();
      e.preventDefault();
      return;
    }

    if (autocompleteState.open){
      if (e.key === "ArrowDown"){
        autocompleteState.index = (autocompleteState.index + 1) % autocompleteState.items.length;
        autocompleteState.userNavigated = true;
        renderAutocomplete();
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp"){
        autocompleteState.index = (autocompleteState.index - 1 + autocompleteState.items.length) % autocompleteState.items.length;
        autocompleteState.userNavigated = true;
        renderAutocomplete();
        e.preventDefault();
        return;
      }
      if (e.key === "Tab"){
        applyAutocomplete(autocompleteState.index);
        e.preventDefault();
        return;
      }
      if (e.key === "Escape"){
        closeAutocomplete();
        e.preventDefault();
        return;
      }
    }

    if (e.key === "ArrowUp" && !autocompleteState.open){
      if (!state.history.length) return;
      state.histIdx = Math.max(0, state.histIdx - 1);
      inputEl.value = state.history[state.histIdx] || "";
      updateHighlight();
      syncEditorHeight();
      scheduleLiveResult();
      setTimeout(() => inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length), 0);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown" && !autocompleteState.open){
      if (!state.history.length) return;
      state.histIdx = Math.min(state.history.length, state.histIdx + 1);
      inputEl.value = state.history[state.histIdx] || "";
      updateHighlight();
      syncEditorHeight();
      scheduleLiveResult();
      setTimeout(() => inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length), 0);
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l"){
      clearTerminal();
      e.preventDefault();
    }
  });

  inputEl.addEventListener("input", () => {
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
    const cursor = inputEl.selectionStart;
    const token = getTokenAtCursor(inputEl.value, cursor);
    if (token.text){
      openAutocomplete(token);
    }else{
      closeAutocomplete();
    }
  });

  inputEl.addEventListener("scroll", () => {
    highlightEl.scrollTop = inputEl.scrollTop;
    highlightEl.scrollLeft = inputEl.scrollLeft;
  });

  inputEl.addEventListener("blur", () => {
    closeAutocomplete();
  });

  btnHelp.addEventListener("click", showHelp);
  btnClear.addEventListener("click", clearTerminal);
  btnVars.addEventListener("click", listVars);
  btnMethods.addEventListener("click", listMethods);
  btnReset.addEventListener("click", resetAll);

  btnExport.addEventListener("click", async () => {
    const text = exportSession();
    await copyText(text);
  });
  btnImport.addEventListener("click", async () => {
    try{
      const text = await readClipboard();
      importSession(text);
      writeLine("Imported session from clipboard.", "ok");
    }catch(err){
      writeLine(err.message || String(err), "err");
    }
  });

  btnFnSave.addEventListener("click", () => {
    try{
      const name = fnNameInput.value.trim();
      const expr = fnExprInput.value.trim();
      if (!name) throw new Error("Function name is required.");
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid function name.");
      if (!expr) throw new Error("Function expression is required.");
      const params = parseParams(fnParamsInput.value);
      const existed = Object.prototype.hasOwnProperty.call(state.userFns, name);
      defineUserFn(name, params, expr);
      const verb = existed ? "Updated" : "Added";
      writeLine(`${verb} function ${name}(${params.join(", ")}).`, "ok");
      clearFnForm();
    }catch(err){
      writeLine(err.message || String(err), "err");
    }
  });

  btnFnClear.addEventListener("click", () => {
    clearFnForm();
    fnNameInput.focus();
  });

  function boot(){
    setTheme("default");
    writeLine("Estimator REPL initialized.", "ok");
    writeLine("Type :help for commands and examples.", "muted");
    writeLine("Try: concrete_cy(1200 sf, 4 in)", "muted");
    writeLine("Try: total = markup(burden(12500, 16.7), 35)", "muted");
    writeLine("Try: so crew_cost(rate, hours) = rate * hours", "muted");
    writeLine("Try: for i in 1..4: total = total + i", "muted");
    writeLine("Try: gfx(32, 16); line(0,0,31,15,\"accent\")", "muted");

    state.vars.hr = 1;
    state.vars.pi = Math.PI;

    renderUserFunctions();
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
    inputEl.focus();
  }

  boot();

  return {};
}
