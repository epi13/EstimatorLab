import { runDoomDemo } from "./repl-doom.js";
import { runLatentCommand } from "./repl-latent.js";
import { parseParams, splitStatements } from "./repl-parser.js";
import { EFFECT } from "./repl-effects.js";

export function createInputHandlers({
  state,
  ui,
  editor,
  userFnUi,
  session,
  tests,
  evaluator,
  frontend,
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
    btnClear,
    btnVars,
    btnMethods,
    btnExport,
    btnImport,
    btnUpload,
    btnDownload,
    btnReset,
    fileImport,
    fnNameInput,
    fnParamsInput,
    fnExprInput,
    btnFnSave,
    btnFnClear,
    helperSearch,
    helperClear,
    helperList,
    helperHint,
    helperPreview,
    helperPreviewTitle,
    helperPreviewDetail,
    helperPreviewTemplate,
    helperPreviewExample,
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
    saveAutosave,
    saveAutosaveMeta,
    loadAutosaveMeta,
    clearAutosave,
  } = session;
  const { runTestSuite } = tests;
  const {
    runExpression,
    runExpressionWithContext,
    solveEquation,
    createAssembly,
    formatValueDisplay,
  } = evaluator;
  const { evaluate } = frontend;
  const { defineUserFn, getFns } = runtime;
  const { flushGfxOutput } = gfx;

  const MAX_LOOP_ITERATIONS = 100000;


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

  function listVars(){
    const keys = Object.keys(state.vars).sort();
    if (!keys.length){
      writeLine("No variables set.", "muted");
      return;
    }
    writeLine("Variables:", "ok");
    for (const k of keys){
      const formatted = formatValueDisplay(state.vars[k]);
      writeLine(`  ${k} = ${formatted.main}`, "muted");
      if (formatted.extra) writeLine(`↳ ${formatted.extra}`, "muted");
    }
  }

  function listMethods(){
    const keys = Object.keys(state.userFns).sort();
    if (!keys.length){
      writeLine("No user solutions defined.", "muted");
      return;
    }
    writeLine("User solutions:", "ok");
    for (const k of keys){
      const defn = state.userFns[k];
      const params = defn.params ? defn.params.join(", ") : "";
      writeLine(`  ${k}(${params}) = ${defn.expr}`, "muted");
    }
  }

  async function fetchText(url){
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok){
      throw new Error(`Failed to load ${url} (${res.status})`);
    }
    return await res.text();
  }

  async function ensureDocsModuleLoaded(){
    const DOCS_MODULES_VERSION = 1;
    if (state.__docsModuleLoaded && state.__docsModulesVersion === DOCS_MODULES_VERSION){
      return;
    }

    const runExpressionAll = (expr) => runExpressionWithContext(expr, state.vars, { allowedEffects: EFFECT.ALL });
    const applyModuleSource = (source, label) => {
      const statements = splitStatements(source);
      for (const stmt of statements){
        const parsed = evaluate(stmt);
        if (!parsed) continue;

        if (parsed.type === "cmd"){
          throw new Error(`${label} may not contain commands`);
        }

        if (parsed.type === "def"){
          defineUserFn(parsed.name, parsed.params, parsed.expr);
          continue;
        }

        if (parsed.type === "assy"){
          const assembly = createAssembly(parsed.name, parsed.fields);
          state.vars[parsed.name] = assembly;
          continue;
        }

        if (parsed.type === "assign"){
          state.vars[parsed.name] = runExpressionAll(parsed.expr);
          continue;
        }

        if (parsed.type === "equation"){
          const solved = solveEquation(parsed.left, parsed.right);
          if (!solved.unknown.unitToken){
            state.vars[solved.unknown.name] = solved.value;
          }
          continue;
        }

        if (parsed.type === "expr"){
          runExpressionAll(parsed.expr);
          continue;
        }

        if (parsed.type === "if" || parsed.type === "for" || parsed.type === "repeat"){
          throw new Error(`${label} may not contain flow statements`);
        }
      }
    };

    const docsSource = await fetchText("assets/est/core/docs.est");
    applyModuleSource(docsSource, "docs");
    state.__docsModulesVersion = DOCS_MODULES_VERSION;
    state.__docsModuleLoaded = true;
  }

  async function ensureConstructionModuleLoaded(){
    const CONSTRUCTION_MODULES_VERSION = 1;
    if (state.__constructionModuleLoaded && state.__constructionModulesVersion === CONSTRUCTION_MODULES_VERSION){
      return;
    }

    const runExpressionAll = (expr) => runExpressionWithContext(expr, state.vars, { allowedEffects: EFFECT.ALL });
    const applyModuleSource = (source, label) => {
      const statements = splitStatements(source);
      for (const stmt of statements){
        const parsed = evaluate(stmt);
        if (!parsed) continue;

        if (parsed.type === "cmd"){
          throw new Error(`${label} may not contain commands`);
        }

        if (parsed.type === "def"){
          defineUserFn(parsed.name, parsed.params, parsed.expr);
          continue;
        }

        if (parsed.type === "assy"){
          const assembly = createAssembly(parsed.name, parsed.fields);
          state.vars[parsed.name] = assembly;
          continue;
        }

        if (parsed.type === "assign"){
          state.vars[parsed.name] = runExpressionAll(parsed.expr);
          continue;
        }

        if (parsed.type === "equation"){
          const solved = solveEquation(parsed.left, parsed.right);
          if (!solved.unknown.unitToken){
            state.vars[solved.unknown.name] = solved.value;
          }
          continue;
        }

        if (parsed.type === "expr"){
          runExpressionAll(parsed.expr);
          continue;
        }

        if (parsed.type === "if" || parsed.type === "for" || parsed.type === "repeat"){
          throw new Error(`${label} may not contain flow statements`);
        }
      }
    };

    const source = await fetchText("assets/est/construction/construction-helpers.est");
    applyModuleSource(source, "construction helpers");
    state.__constructionModulesVersion = CONSTRUCTION_MODULES_VERSION;
    state.__constructionModuleLoaded = true;
  }

  const collectChangedSymbols = (results) => {
    const changed = [];
    const seen = new Set();
    for (const result of results || []){
      const names = Array.isArray(result?.changedSymbols) ? result.changedSymbols : [];
      for (const name of names){
        if (!seen.has(name)){
          seen.add(name);
          changed.push(name);
        }
      }
    }
    return changed;
  };

  async function handleLine(line){
    const runExpressionAll = (expr) => runExpressionWithContext(expr, state.vars, { allowedEffects: EFFECT.ALL });
    const statementList = Array.isArray(line) ? line : splitStatements(line);
    const sourceResult = { lastValue: null, results: [] };
    if (!statementList.length) return sourceResult;

    const executeParsed = async (parsed, stmt) => {
      if (parsed.type === "cmd"){
        const {cmd,arg} = parsed;
        if (cmd === "docs"){
          await ensureDocsModuleLoaded();
          runExpressionAll("show_docs()");
          return { type: "cmd", value: null };
        }
        if (cmd === "construction"){
          await ensureConstructionModuleLoaded();
          writeLine("Loaded construction helpers.", "ok");
          return { type: "cmd", value: null };
        }
        if (cmd === "clear"){ clearTerminal(); return { type: "cmd", value: null }; }
        if (cmd === "vars"){ listVars(); return { type: "cmd", value: null }; }
        if (cmd === "methods"){ listMethods(); return { type: "cmd", value: null }; }
        if (cmd === "reset"){
          resetAll();
          clearAutosave();
          return { type: "cmd", value: null };
        }
        if (cmd === "save"){ saveProfile(arg); return { type: "cmd", value: null }; }
        if (cmd === "mux"){ muxProfile(arg); return { type: "cmd", value: null }; }
        if (cmd === "load"){ loadProfile(arg); return { type: "cmd", value: null }; }
        if (cmd === "profiles"){ listProfiles(); return { type: "cmd", value: null }; }
        if (cmd === "pin"){ pinSymbol(arg); return { type: "cmd", value: null }; }
        if (cmd === "unpin"){ unpinSymbol(arg); return { type: "cmd", value: null }; }
        if (cmd === "which"){ whichSymbol(arg); return { type: "cmd", value: null }; }
        if (cmd === "use"){ useSymbolFromProfile(arg); return { type: "cmd", value: null }; }
        if (cmd === "diff"){ diffSymbol(arg); return { type: "cmd", value: null }; }
        if (cmd === "theme"){ setTheme((arg||"").trim()); writeLine(`Theme set to ${state.theme}.`, "ok"); return { type: "cmd", value: state.theme }; }
        if (cmd === "doom"){
          await runDoomDemo({ gfx, writeLine, writeInputEcho, state, evaluator, frontend, runtime });
          return { type: "cmd", value: null };
        }
        if (cmd === "latent"){
          await runLatentCommand({
            arg,
            state,
            evaluator,
            frontend,
            runtime,
            runExpressionAll,
            solveEquation,
            createAssembly,
            defineUserFn,
            makeQty,
            recordSymbolDefinition,
            writeLine,
          });
          return { type: "cmd", value: null };
        }
        if (cmd === "test"){ await runTestSuite(); return { type: "cmd", value: null }; }

        if (cmd === "export"){
          const text = exportSession();
          await copyText(text);
          return { type: "cmd", value: text };
        }
        if (cmd === "import"){
          const text = await readClipboard();
          importSession(text);
          writeLine("Imported profile from clipboard.", "ok");
          return { type: "cmd", value: null };
        }

        if (cmd === "upload"){
          const name = (arg || "").trim() || "file";
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("upload expects a variable name");
          if (!fileImport) throw new Error("File upload not available");
          const file = await new Promise((resolve) => {
            fileImport.value = "";
            fileImport.onchange = () => resolve(fileImport.files && fileImport.files[0] ? fileImport.files[0] : null);
            fileImport.click();
          });
          if (!file) throw new Error("No file selected");
          const text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Could not read file"));
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsText(file);
          });

          if (file.name.toLowerCase().endsWith(".json")){
            try{
              const parsedJson = JSON.parse(text);
              if (parsedJson && typeof parsedJson === "object" && parsedJson.version === 2 && parsedJson.profiles){
                importSession(text);
                writeLine(`Imported profile from ${file.name}.`, "ok");
                return { type: "cmd", value: null };
              }
            }catch{}
          }

          let stored = text;
          if (file.name.toLowerCase().endsWith(".json")){
            try{
              stored = runExpression(`from_json(${JSON.stringify(text)})`);
            }catch{
              stored = text;
            }
          }
          state.vars[name] = stored;
          recordSymbolDefinition({ name, kind: "var", expr: `:upload ${file.name}`, value: stored });
          writeLine(`Uploaded ${file.name} -> ${name}.`, "ok");
          return { type: "cmd", value: stored, changedSymbols: [name] };
        }

        if (cmd === "download"){
          const parts = (arg || "").trim().split(/\s+/).filter(Boolean);
          const name = parts[0];
          const format = (parts[1] || "").toLowerCase();
          const filename = parts[2] || "";
          if (!name) throw new Error("download expects a variable name");
          if (!Object.prototype.hasOwnProperty.call(state.vars, name)) throw new Error(`Unknown variable: ${name}`);
          let mime = "text/plain";
          let content;
          if (format === "csv"){
            mime = "text/csv";
            content = runExpression(`to_csv(get(${JSON.stringify(name)}))`);
          }else if (format === "json" || format === ""){
            mime = "application/json";
            const val = state.vars[name];
            if (typeof val === "string" && format === ""){
              content = val;
              mime = "text/plain";
            }else{
              content = runExpression(`to_json(get(${JSON.stringify(name)}))`);
            }
          }else{
            throw new Error("download format must be csv or json");
          }
          const outName = filename || (format === "csv" ? `${name}.csv` : `${name}.json`);
          const blob = new Blob([String(content)], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = outName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          writeLine(`Downloaded ${name} -> ${outName}.`, "ok");
          return { type: "cmd", value: state.vars[name] };
        }
        throw new Error(`Unknown command: :${cmd}`);
      }

      if (parsed.type === "def"){
        const existed = Object.prototype.hasOwnProperty.call(state.userFns, parsed.name);
        defineUserFn(parsed.name, parsed.params, parsed.expr);
        const verb = existed ? "Updated" : "Added";
        writeLine(`${verb} function ${parsed.name}(${parsed.params.join(", ")}).`, "ok");
        return { type: "def", value: null, changedSymbols: [parsed.name] };
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
        return { type: "assy", value: assembly, changedSymbols: [parsed.name] };
      }

      if (parsed.type === "assign"){
        const val = runExpressionAll(parsed.expr);
        state.vars[parsed.name] = val;
        recordSymbolDefinition({ name: parsed.name, kind: "var", expr: parsed.expr, value: val });
        const fr = formatValueDisplay(val);
        writeLine(`${parsed.name} = ${fr.main}`, "ok");
        if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
        return { type: "assign", value: val, changedSymbols: [parsed.name] };
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
        const changedSymbols = solved.unknown.unitToken ? [] : [solved.unknown.name];
        return { type: "equation", value: solvedValue, changedSymbols };
      }

      if (parsed.type === "if"){
        const cond = runExpressionAll(parsed.condition);
        let branch = { lastValue: null, results: [] };
        if (isTruthy(cond)){
          branch = await handleLine(parsed.thenBody);
        }else if (parsed.elseBody){
          branch = await handleLine(parsed.elseBody);
        }
        return {
          type: "if",
          value: branch.lastValue,
          results: branch.results,
          changedSymbols: collectChangedSymbols(branch.results),
        };
      }

      if (parsed.type === "for"){
        const startVal = runExpressionAll(parsed.startExpr);
        const endVal = runExpressionAll(parsed.endExpr);
        const stepVal = parsed.stepExpr ? runExpressionAll(parsed.stepExpr) : 1;
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
        let iter = 0;
        const iterResults = [];
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > MAX_LOOP_ITERATIONS){
            throw new Error(`for loop exceeded ${MAX_LOOP_ITERATIONS} iterations`);
          }
          state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          const loopResult = await handleLine(parsed.body);
          iterResults.push(loopResult);
        }
        if (hadVar) state.vars[parsed.varName] = prevVal;
        else delete state.vars[parsed.varName];
        const nestedResults = iterResults.flatMap((entry) => entry.results);
        return {
          type: "for",
          value: iterResults.length ? iterResults[iterResults.length - 1].lastValue : null,
          results: nestedResults,
          changedSymbols: collectChangedSymbols(nestedResults),
        };
      }

      if (parsed.type === "repeat"){
        const countVal = runExpressionAll(parsed.countExpr);
        const count = normalizeCompare(countVal, 0)[0];
        if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
        const n = Math.floor(count);
        if (n > MAX_LOOP_ITERATIONS){
          throw new Error(`repeat exceeded ${MAX_LOOP_ITERATIONS} iterations`);
        }
        const iterResults = [];
        for (let i = 0; i < n; i++){
          const loopResult = await handleLine(parsed.body);
          iterResults.push(loopResult);
        }
        const nestedResults = iterResults.flatMap((entry) => entry.results);
        return {
          type: "repeat",
          value: iterResults.length ? iterResults[iterResults.length - 1].lastValue : null,
          results: nestedResults,
          changedSymbols: collectChangedSymbols(nestedResults),
        };
      }

      if (parsed.type === "expr"){
        const val = runExpressionAll(parsed.expr);
        const fr = formatValueDisplay(val);
        writeLine(fr.main, "out");
        if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
        return { type: "expr", value: val };
      }
      return { type: parsed.type, value: null };
    };

    try{
      for (const stmt of statementList){
        const parsed = evaluate(stmt);
        if (!parsed) continue;
        const usageEntry = beginUsage(parsed, stmt);

        try{
          const statementResult = await executeParsed(parsed, stmt);
          if (statementResult){
            sourceResult.results.push(statementResult);
            if (Object.prototype.hasOwnProperty.call(statementResult, "value")){
              sourceResult.lastValue = statementResult.value;
            }
          }
        }finally{
          endUsage(usageEntry);
        }

        saveAutosave();
        saveAutosaveMeta({
          history: state.history.slice(),
          theme: state.theme,
        });
      }
    }catch(err){
      setStatus("Error", "err");
      writeLine(`[${nowStamp()}] ${err.message || String(err)}`, "err");
    }finally{
      flushGfxOutput();
      setStatus("Ready", "ok");
    }
    return sourceResult;
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

  btnClear.addEventListener("click", clearTerminal);
  btnVars.addEventListener("click", listVars);
  btnMethods.addEventListener("click", listMethods);
  btnReset.addEventListener("click", () => {
    resetAll();
    clearAutosave();
  });

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

  if (btnUpload){
    btnUpload.addEventListener("click", async () => {
      try{
        const name = (prompt("Upload into variable name:", "file") || "").trim() || "file";
        await handleLine(`:upload ${name}`);
      }catch(err){
        writeLine(err.message || String(err), "err");
      }
    });
  }

  if (btnDownload){
    btnDownload.addEventListener("click", async () => {
      try{
        const name = (prompt("Download variable name:", "") || "").trim();
        if (!name) return;
        const format = (prompt("Format (json|csv):", "json") || "json").trim();
        const filename = (prompt("Filename (optional):", "") || "").trim();
        const cmd = [":download", name, format, filename].filter((p) => p && p.length).join(" ");
        await handleLine(cmd);
      }catch(err){
        writeLine(err.message || String(err), "err");
      }
    });
  }

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

  const helperUi = (() => {
    if (!helperSearch || !helperClear || !helperList) return null;

    const normalizeText = (s) => String(s || "").toLowerCase();

    const helperSpecs = [
      { name: "waste", category: "Estimating", detail: "Apply waste percentage", insertText: "waste(" },
      { name: "markup", category: "Estimating", detail: "Apply markup percentage", insertText: "markup(" },
      { name: "burden", category: "Estimating", detail: "Apply labor burden percentage", insertText: "burden(" },
      { name: "tax", category: "Estimating", detail: "Apply tax percentage", insertText: "tax(" },
      { name: "contingency", category: "Estimating", detail: "Apply contingency percentage", insertText: "contingency(" },
      { name: "overhead", category: "Estimating", detail: "Apply overhead percentage", insertText: "overhead(" },
      { name: "profit", category: "Estimating", detail: "Apply profit percentage", insertText: "profit(" },
      { name: "ohp", category: "Estimating", detail: "Apply overhead and profit (sequential)", insertText: "ohp(", insertTemplate: true, template: "ohp(cost, overhead_pct, profit_pct)", example: "ohp(120000 $, 12, 8)" },
      { name: "discount", category: "Estimating", detail: "Apply discount percentage", insertText: "discount(" },
      { name: "retainage", category: "Estimating", detail: "Apply retainage percentage", insertText: "retainage(" },
      { name: "escalate", category: "Estimating", detail: "Escalate by percent per period", insertText: "escalate(", insertTemplate: true, template: "escalate(cost, pct, periods)", example: "escalate(90000 $, 3, 2)" },
      { name: "unit", category: "Estimating", detail: "Unit cost from total and quantity", insertText: "unit(" },
      { name: "round_up", category: "Estimating", detail: "Round up to a step", insertText: "round_up(" },
      { name: "line", category: "Estimating", detail: "Build a cost line item assembly", insertText: "line(" },
      { name: "rollup", category: "Estimating", detail: "Roll up line totals", insertText: "rollup(" },

      { name: "scale_linear", category: "Scaling", detail: "Scale a value by (new/old)", insertText: "scale_linear(", insertTemplate: true, template: "scale_linear(value, old_scale, new_scale)", example: "scale_linear(12, 2500, 4000)" },
      { name: "scale_pow", category: "Scaling", detail: "Power-law scaling: value × (new/old)^k", insertText: "scale_pow(", insertTemplate: true, template: "scale_pow(value, old_scale, new_scale, k)", example: "scale_pow(120000 $, 2500, 4000, 0.8)" },

      { name: "roof_squares", category: "Staples", detail: "Roofing squares (area / 100 sf)", insertText: "roof_squares(", template: "roof_squares(area)", example: "roof_squares(2400 sf)" },
      { name: "paint_gal", category: "Staples", detail: "Paint gallons from area, coverage, coats, waste", insertText: "paint_gal(", insertTemplate: true, template: "paint_gal(area, coverage_sf_per_gal, coats, waste_pct)", example: "paint_gal(1800 sf, 350, 2, 10)" },
      { name: "wt_from_cy", category: "Staples", detail: "Weight from volume (cy) and density (lb/cy)", insertText: "wt_from_cy(", insertTemplate: true, template: "wt_from_cy(vol, lb_per_cy)", example: "to_ton(wt_from_cy(12 cy, 3000))" },
      { name: "bar_count", category: "Staples", detail: "Rebar sticks from run length, stick length, lap, waste", insertText: "bar_count(", insertTemplate: true, template: "bar_count(run_len, bar_len, lap_len, waste_pct)", example: "bar_count(420 ft, 20 ft, 2 ft, 5)" },
      { name: "fastener_count", category: "Staples", detail: "Fasteners from items × per-item, w/ waste", insertText: "fastener_count(", insertTemplate: true, template: "fastener_count(items, per_item, waste_pct)", example: "fastener_count(120 ea, 6, 10)" },

      { name: "studs_wall", category: "Framing", detail: "Wall studs from length (defaults: 16 in OC, 10% waste)", insertText: "studs_wall(", insertTemplate: true, template: "studs_wall(length, oc, waste_pct)", example: "studs_wall(32 ft)" },
      { name: "studs_perim", category: "Framing", detail: "Perimeter studs (defaults: 16 in OC, +4 corners, 10% waste)", insertText: "studs_perim(", insertTemplate: true, template: "studs_perim(perim, oc, waste_pct, corner_fudge)", example: "studs_perim(perim_rect(40 ft, 28 ft))" },
      { name: "plates_lf", category: "Framing", detail: "Plate linear footage (defaults: double top + single bottom)", insertText: "plates_lf(", insertTemplate: true, template: "plates_lf(perim, top_plates, bottom_plates)", example: "plates_lf(perim_rect(40 ft, 28 ft))" },
      { name: "plates_sticks", category: "Framing", detail: "Plate sticks from perimeter (defaults: 8 ft sticks, 12% waste)", insertText: "plates_sticks(", insertTemplate: true, template: "plates_sticks(perim, top_plates, bottom_plates, stick_len, waste_pct)", example: "plates_sticks(perim_rect(40 ft, 28 ft))" },
      { name: "sheets_wall", category: "Framing", detail: "Wall sheets from length × height (defaults: 4x8, 10% waste)", insertText: "sheets_wall(", insertTemplate: true, template: "sheets_wall(length, height, sheet_area, waste_pct, layers)", example: "sheets_wall(48 ft, 10 ft)" },
      { name: "joist_count", category: "Framing", detail: "Joist count from run length and OC (defaults: 16 in OC)", insertText: "joist_count(", insertTemplate: true, template: "joist_count(run_len, oc)", example: "joist_count(40 ft)" },
      { name: "joist_lf", category: "Framing", detail: "Joist linear feet from run length, span, and OC", insertText: "joist_lf(", insertTemplate: true, template: "joist_lf(run_len, span, oc)", example: "joist_lf(40 ft, 28 ft)" },
      { name: "joist_sticks", category: "Framing", detail: "Joist sticks from run length × span (defaults: 8 ft sticks, 12% waste)", insertText: "joist_sticks(", insertTemplate: true, template: "joist_sticks(run_len, span, oc, stick_len, waste_pct)", example: "joist_sticks(40 ft, 28 ft)" },
      { name: "rim_sticks", category: "Framing", detail: "Rim board sticks from perimeter (defaults: 8 ft sticks, 12% waste)", insertText: "rim_sticks(", insertTemplate: true, template: "rim_sticks(perim, stick_len, waste_pct)", example: "rim_sticks(perim_rect(40 ft, 28 ft))" },
      { name: "subfloor_sheets", category: "Framing", detail: "Subfloor sheets from L×W (defaults: 4x8, 10% waste)", insertText: "subfloor_sheets(", insertTemplate: true, template: "subfloor_sheets(len, wid, sheet_area, waste_pct, layers)", example: "subfloor_sheets(40 ft, 28 ft)" },

      { name: "drywall_sheets", category: "Drywall", detail: "Drywall sheets from area (defaults: 4x12, 10% waste)", insertText: "drywall_sheets(", insertTemplate: true, template: "drywall_sheets(area, sheet_area, waste_pct, layers)", example: "drywall_sheets(1000 sf)" },
      { name: "drywall_screws", category: "Drywall", detail: "Drywall screws from sheet count (defaults: 16\" OC, 8\" edge / 12\" field)", insertText: "drywall_screws(", insertTemplate: true, template: "drywall_screws(sheets, studs_oc, sheet_w, sheet_h, edge_spacing, field_spacing, waste_pct)", example: "drywall_screws(drywall_sheets(1000 sf))" },
      { name: "tape_rolls", category: "Drywall", detail: "Tape rolls from seam linear feet (default: 500 ft roll, 10% waste)", insertText: "tape_rolls(", insertTemplate: true, template: "tape_rolls(seam_lf, roll_len, waste_pct)", example: "tape_rolls(1200 ft)" },
      { name: "corner_bead_sticks", category: "Drywall", detail: "Corner bead sticks from corner LF (default: 10 ft sticks, 10% waste)", insertText: "corner_bead_sticks(", insertTemplate: true, template: "corner_bead_sticks(corner_lf, stick_len, waste_pct)", example: "corner_bead_sticks(160 ft)" },
      { name: "mud_gal", category: "Drywall", detail: "Joint compound gallons from area, coverage, coats, waste", insertText: "mud_gal(", insertTemplate: true, template: "mud_gal(area, coverage_sf_per_gal, coats, waste_pct)", example: "mud_gal(1000 sf, 100, 3, 10)" },

      { name: "slab_cy", category: "Concrete", detail: "Slab volume (defaults: 5% waste; scalar thickness is inches)", insertText: "slab_cy(", insertTemplate: true, template: "slab_cy(len, wid, thickness_in, waste_pct)", example: "to_cy(slab_cy(40 ft, 28 ft, 4 in))" },
      { name: "wall_cy", category: "Concrete", detail: "Wall volume (defaults: 5% waste; scalar thickness is inches)", insertText: "wall_cy(", insertTemplate: true, template: "wall_cy(length, height, thickness_in, waste_pct)", example: "to_cy(wall_cy(120 ft, 8 ft, 8 in))" },
      { name: "footing_cy", category: "Concrete", detail: "Footing volume (defaults: 5% waste; scalar width/depth are inches)", insertText: "footing_cy(", insertTemplate: true, template: "footing_cy(length, width_in, depth_in, waste_pct)", example: "to_cy(footing_cy(160 ft, 24 in, 12 in))" },
      { name: "concrete_bags", category: "Concrete", detail: "Concrete bags from volume (default yield: 0.6 cf per bag)", insertText: "concrete_bags(", insertTemplate: true, template: "concrete_bags(vol, bag_yield_cf, waste_pct)", example: "concrete_bags(slab_cy(10 ft, 10 ft, 4 in))" },
      { name: "rebar_grid_bars", category: "Concrete", detail: "Grid rebar bars for slab mats (defaults: 20 ft bars, 12\" lap, 5% waste)", insertText: "rebar_grid_bars(", insertTemplate: true, template: "rebar_grid_bars(len, wid, oc, bar_len, lap_len, waste_pct, mats)", example: "rebar_grid_bars(40 ft, 28 ft, 12 in)" },

      { name: "shingle_bundles", category: "Roofing", detail: "Shingle bundles from roof area (defaults: 3 bundles/sq, 10% waste)", insertText: "shingle_bundles(", insertTemplate: true, template: "shingle_bundles(area, bundles_per_square, waste_pct)", example: "shingle_bundles(2400 sf)" },
      { name: "underlayment_rolls", category: "Roofing", detail: "Underlayment rolls from roof area (defaults: 400 sf/roll, 10% waste)", insertText: "underlayment_rolls(", insertTemplate: true, template: "underlayment_rolls(area, roll_coverage_sf, waste_pct)", example: "underlayment_rolls(2400 sf)" },
      { name: "ridgecap_bundles", category: "Roofing", detail: "Ridge cap bundles from ridge LF (defaults: 33 lf/bundle, 10% waste)", insertText: "ridgecap_bundles(", insertTemplate: true, template: "ridgecap_bundles(ridge_lf, coverage_lf_per_bundle, waste_pct)", example: "ridgecap_bundles(120 ft)" },

      { name: "area_rect", category: "Layout / Geometry", detail: "Area from length and width", insertText: "area_rect(" },
      { name: "area_circle", category: "Layout / Geometry", detail: "Area from diameter", insertText: "area_circle(" },
      { name: "vol_rect", category: "Layout / Geometry", detail: "Volume from area and thickness", insertText: "vol_rect(" },
      { name: "concrete_cy", category: "Layout / Geometry", detail: "Concrete volume quantity", insertText: "concrete_cy(" },

      { name: "perim_rect", category: "Takeoff", detail: "Rectangle perimeter", insertText: "perim_rect(", template: "perim_rect(len, wid)", example: "perim_rect(40 ft, 28 ft)" },
      { name: "wall_area", category: "Takeoff", detail: "Wall area from perimeter and height", insertText: "wall_area(", template: "wall_area(perim, height)", example: "wall_area(perim_rect(40 ft, 28 ft), 10 ft)" },
      { name: "stud_count", category: "Takeoff", detail: "Stud count from length and OC spacing", insertText: "stud_count(", insertTemplate: true, template: "stud_count(length, oc)", example: "stud_count(40 ft, 16 in)" },
      { name: "oc_count", category: "Takeoff", detail: "Generic count for items laid out on-center", insertText: "oc_count(", template: "oc_count(length, oc)", example: "oc_count(120 ft, 6 ft)" },
      { name: "stick_count", category: "Takeoff", detail: "Sticks/pieces from LF, stick length, and waste %", insertText: "stick_count(", insertTemplate: true, template: "stick_count(lf, stick_len, waste_pct)", example: "stick_count(640 ft, 8 ft, 12)" },
      { name: "sheet_count", category: "Takeoff", detail: "Sheets from area, sheet area, and waste %", insertText: "sheet_count(", insertTemplate: true, template: "sheet_count(area, sheet_area, waste_pct)", example: "sheet_count(1200 sf, 32 sf, 10)" },

      { name: "trench_cy", category: "Earthwork", detail: "Trench volume with side slopes (e.g. 1:1, 2:1)", insertText: "trench_cy(", insertTemplate: true, template: "trench_cy(length, depth, bottom_width, slope)", example: "trench_cy(120 ft, 4 ft, 2 ft, 2)" },
      { name: "bank_to_loose", category: "Earthwork", detail: "Convert bank volume to loose volume using swell %", insertText: "bank_to_loose(", insertTemplate: true, template: "bank_to_loose(bank_vol, swell_pct)", example: "bank_to_loose(100 cy, 20)" },
      { name: "loose_to_bank", category: "Earthwork", detail: "Convert loose volume to bank volume using swell %", insertText: "loose_to_bank(", insertTemplate: true, template: "loose_to_bank(loose_vol, swell_pct)", example: "loose_to_bank(120 cy, 20)" },
      { name: "bank_to_compacted", category: "Earthwork", detail: "Convert bank volume to compacted volume using shrink %", insertText: "bank_to_compacted(", insertTemplate: true, template: "bank_to_compacted(bank_vol, shrink_pct)", example: "bank_to_compacted(100 cy, 10)" },
      { name: "compacted_to_bank", category: "Earthwork", detail: "Convert compacted volume to bank volume using shrink %", insertText: "compacted_to_bank(", insertTemplate: true, template: "compacted_to_bank(compacted_vol, shrink_pct)", example: "compacted_to_bank(90 cy, 10)" },
      { name: "truck_loads", category: "Earthwork", detail: "Truck loads from volume (defaults: 10 cy truck, 0% waste)", insertText: "truck_loads(", insertTemplate: true, template: "truck_loads(vol, truck_vol, waste_pct)", example: "truck_loads(bank_to_loose(trench_cy(120 ft, 4 ft, 2 ft, 2), 20), 10 cy)" },

      { name: "pipe_wt_total", category: "Pipe", detail: "Pipe total weight (pipe_wt + optional waste)", insertText: "pipe_wt_total(", insertTemplate: true, template: "pipe_wt_total(nps_in, schedule, len_ft, waste_pct)", example: "to_ton(pipe_wt_total(2, 40, 120 ft, 5))" },
      { name: "hanger_count", category: "Pipe", detail: "Hanger count from run length and spacing (default: 8 ft)", insertText: "hanger_count(", insertTemplate: true, template: "hanger_count(run_len, spacing, waste_pct)", example: "hanger_count(240 ft, 8 ft, 5)" },
      { name: "fitting_count", category: "Pipe", detail: "Fittings allowance by run length (per 100 ft)", insertText: "fitting_count(", insertTemplate: true, template: "fitting_count(run_len, per_100ft, waste_pct)", example: "fitting_count(300 ft, 6, 10)" },
      { name: "pipe_jacket_area", category: "Pipe", detail: "Pipe jacket/insulation area from OD and length", insertText: "pipe_jacket_area(", insertTemplate: true, template: "pipe_jacket_area(len, od_in, waste_pct)", example: "pipe_jacket_area(120 ft, 4 in, 10)" },

      { name: "oc_linear_ft", category: "OC Linear Ft", detail: "Continuous run length from area and OC spacing", insertText: "oc_linear_ft(", insertTemplate: true, template: "oc_linear_ft(area, oc)", example: "oc_linear_ft(500 sf, 6 in)" },
      { name: "oc_linear_ft_parallel", category: "OC Linear Ft", detail: "Parallel rows: area + wall height + OC", insertText: "oc_linear_ft_parallel(", insertTemplate: true, template: "oc_linear_ft_parallel(area, height, oc)", example: "oc_linear_ft_parallel(500 sf, 8 ft, 6 in)" },
      { name: "oc_run_count", category: "OC Linear Ft", detail: "Rows/runs count from height and OC", insertText: "oc_run_count(", template: "oc_run_count(height, oc)", example: "oc_run_count(8 ft, 6 in)" },
      { name: "coils_needed", category: "OC Linear Ft", detail: "Coils/rolls needed from LF and coil length", insertText: "coils_needed(", insertTemplate: true, template: "coils_needed(total_lf, coil_len)", example: "coils_needed(waste(oc_linear_ft(500 sf, 6 in), 5), 250 ft)" },

      { name: "qty", category: "Assemblies", detail: "Quantity breakdown from an assembly", insertText: "qty(" },

      { name: "bf", category: "Materials", detail: "Board feet", insertText: "bf(" },
      { name: "pipe_wt", category: "Materials", detail: "Pipe weight from NPS/schedule", insertText: "pipe_wt(" },

      { name: "to", category: "Conversions", detail: "Convert a value to a unit token", insertText: "to(" },
      { name: "to_in", category: "Conversions", detail: "Convert length to inches", insertText: "to_in(" },
      { name: "to_ft", category: "Conversions", detail: "Convert length to feet", insertText: "to_ft(" },
      { name: "to_sf", category: "Conversions", detail: "Convert area to square feet", insertText: "to_sf(" },
      { name: "to_sy", category: "Conversions", detail: "Convert area to square yards", insertText: "to_sy(" },
      { name: "to_cf", category: "Conversions", detail: "Convert volume to cubic feet", insertText: "to_cf(" },
      { name: "to_cy", category: "Conversions", detail: "Convert volume to cubic yards", insertText: "to_cy(" },
      { name: "to_lb", category: "Conversions", detail: "Convert weight to pounds", insertText: "to_lb(" },
      { name: "to_ton", category: "Conversions", detail: "Convert weight to tons", insertText: "to_ton(" },
      { name: "to_min", category: "Conversions", detail: "Convert time to minutes", insertText: "to_min(" },
      { name: "to_hr", category: "Conversions", detail: "Convert time to hours", insertText: "to_hr(" },
    ];

    const categoryOrder = ["Estimating", "Scaling", "Staples", "Takeoff", "Framing", "Drywall", "Concrete", "Roofing", "OC Linear Ft", "Earthwork", "Pipe", "Layout / Geometry", "Assemblies", "Materials", "Conversions"];
    const categoryRank = new Map(categoryOrder.map((c, idx) => [c, idx]));

    function usageForFn(name){
      const fn = getFns && typeof getFns === "function" ? getFns()[name] : null;
      const labels = Array.isArray(fn?.sig?.args) ? fn.sig.args.map((a, i) => String(a?.label || `arg${i + 1}`)) : null;
      if (labels && labels.length){
        return `${name}(${labels.join(", ")})`;
      }
      if (typeof fn?.arity === "number" && fn.arity >= 0){
        const params = Array.from({ length: fn.arity }, (_, i) => `arg${i + 1}`);
        return `${name}(${params.join(", ")})`;
      }
      return `${name}(`;
    }

    function buildItems(){
      const fns = getFns && typeof getFns === "function" ? getFns() : {};
      const out = [];
      for (const spec of helperSpecs){
        if (!Object.prototype.hasOwnProperty.call(fns, spec.name)) continue;
        out.push({
          name: spec.name,
          category: spec.category,
          detail: spec.detail,
          insertText: spec.insertText || `${spec.name}(`,
          usage: usageForFn(spec.name),
          template: typeof spec.template === "string" ? spec.template : usageForFn(spec.name),
          example: typeof spec.example === "string" ? spec.example : "",
          insertTemplate: Boolean(spec.insertTemplate),
        });
      }
      out.sort((a, b) => {
        const ra = categoryRank.has(a.category) ? categoryRank.get(a.category) : 999;
        const rb = categoryRank.has(b.category) ? categoryRank.get(b.category) : 999;
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
      return out;
    }

    const helperState = {
      all: [],
      visible: [],
      index: 0,
    };

    function insertIntoEditor(text){
      const value = inputEl.value;
      const start = inputEl.selectionStart ?? value.length;
      const end = inputEl.selectionEnd ?? value.length;
      const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
      inputEl.value = nextValue;
      const cursorPos = start + text.length;
      inputEl.focus();
      inputEl.setSelectionRange(cursorPos, cursorPos);
      updateHighlight();
      syncEditorHeight();
      scheduleLiveResult();
    }

    function activeInsertText(item){
      if (!item) return "";
      if (item.insertTemplate){
        const t = String(item.template || "").trim();
        if (t) return t;
      }
      return String(item.insertText || "");
    }

    function matchesQuery(item, query){
      const q = normalizeText(query).trim();
      if (!q) return true;
      const parts = q.split(/\s+/).filter(Boolean);
      const hay = `${item.name} ${item.category} ${item.usage} ${item.detail}`.toLowerCase();
      return parts.every((p) => hay.includes(p));
    }

    function clampIndex(){
      if (!helperState.visible.length){
        helperState.index = 0;
        return;
      }
      helperState.index = Math.max(0, Math.min(helperState.index, helperState.visible.length - 1));
    }

    function render(){
      helperList.innerHTML = "";
      if (!helperState.visible.length){
        const empty = document.createElement("div");
        empty.className = "mini muted";
        empty.textContent = "No helpers match your filter.";
        helperList.appendChild(empty);
        if (helperHint) helperHint.textContent = "Tip: type to filter • Enter inserts";
        if (helperPreviewTitle) helperPreviewTitle.textContent = "";
        if (helperPreviewDetail) helperPreviewDetail.textContent = "";
        if (helperPreviewTemplate) helperPreviewTemplate.textContent = "";
        if (helperPreviewExample) helperPreviewExample.textContent = "";
        return;
      }

      if (helperHint){
        const active = helperState.visible[helperState.index];
        helperHint.textContent = active ? active.usage : "Tip: type to filter";
      }

      const active = helperState.visible[helperState.index];
      if (helperPreviewTitle) helperPreviewTitle.textContent = active ? active.name : "";
      if (helperPreviewDetail) helperPreviewDetail.textContent = active ? active.detail : "";
      if (helperPreviewTemplate) helperPreviewTemplate.textContent = active ? active.template : "";
      if (helperPreviewExample) helperPreviewExample.textContent = active ? active.example : "";
      if (helperPreview) helperPreview.style.display = "";

      let lastCategory = null;
      helperState.visible.forEach((item, idx) => {
        if (item.category !== lastCategory){
          lastCategory = item.category;
          const group = document.createElement("div");
          group.className = "helperGroup";
          group.textContent = item.category;
          helperList.appendChild(group);
        }

        const row = document.createElement("div");
        row.className = `helperItem${idx === helperState.index ? " active" : ""}`;
        row.setAttribute("role", "option");
        row.dataset.idx = String(idx);
        row.innerHTML = `<div class="name">${item.name}</div><div class="detail">${item.detail}</div>`;
        row.addEventListener("mousedown", (event) => {
          event.preventDefault();
          helperState.index = idx;
          insertIntoEditor(activeInsertText(item));
          helperSearch.value = "";
          updateVisible();
        });
        helperList.appendChild(row);
      });

      const activeEl = helperList.querySelector(`.helperItem[data-idx="${helperState.index}"]`);
      if (activeEl && typeof activeEl.scrollIntoView === "function"){
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }

    function updateVisible(){
      const q = helperSearch.value;
      helperState.visible = helperState.all.filter((item) => matchesQuery(item, q));
      clampIndex();
      render();
    }

    function rebuild(){
      helperState.all = buildItems();
      updateVisible();
    }

    helperSearch.addEventListener("input", () => {
      helperState.index = 0;
      updateVisible();
    });

    helperSearch.addEventListener("keydown", (e) => {
      if (!helperState.visible.length) return;

      if (e.key === "ArrowDown"){
        helperState.index = (helperState.index + 1) % helperState.visible.length;
        render();
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp"){
        helperState.index = (helperState.index - 1 + helperState.visible.length) % helperState.visible.length;
        render();
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab"){
        const active = helperState.visible[helperState.index];
        if (active){
          insertIntoEditor(activeInsertText(active));
          helperSearch.value = "";
          updateVisible();
        }
        e.preventDefault();
        return;
      }
      if (e.key === "Escape"){
        helperSearch.value = "";
        updateVisible();
        e.preventDefault();
      }
    });

    helperClear.addEventListener("click", () => {
      helperSearch.value = "";
      helperSearch.focus();
      helperState.index = 0;
      updateVisible();
    });

    rebuild();

    return { rebuild };
  })();

  function boot(){
    const meta = loadAutosaveMeta();
    const theme = meta?.theme ? String(meta.theme) : "default";
    setTheme(theme);
    writeLine("Estimator REPL initialized.", "ok");
    writeLine("Type :docs for commands and examples.", "muted");
    writeLine("Try: concrete_cy(1200 sf, 4 in)", "muted");
    writeLine("Try: total = markup(burden(12500, 16.7), 35)", "muted");
    writeLine("Try: so crew_cost(rate, hours) = rate * hours", "muted");
    writeLine("Try: for i in 1..4: total = total + i", "muted");
    writeLine("Try: gfx(32, 16); line(0,0,31,15,\"accent\")", "muted");

    state.vars.hr = 1;
    state.vars.pi = Math.PI;

    try{
      session.loadAutosave();
    }catch{}

    if (meta && Array.isArray(meta.history)){
      state.history = meta.history.map((entry) => String(entry)).filter(Boolean);
      state.histIdx = state.history.length;
    }

    renderUserFunctions();
    helperUi?.rebuild?.();
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
    inputEl.focus();
  }

  boot();

  return {};
}
