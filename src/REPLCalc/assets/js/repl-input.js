import { runDoomDemo } from "./repl-doom.js";
import { parseParams, splitStatements } from "./repl-parser.js";
import { EFFECT } from "./repl-effects.js";

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

  const { showDocs, listVars, listMethods } = docs;
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
    evaluate,
    runExpression,
    runExpressionWithContext,
    solveEquation,
    createAssembly,
    formatValueDisplay,
  } = evaluator;
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

  async function handleLine(line){
    const runExpressionAll = (expr) => runExpressionWithContext(expr, state.vars, { allowedEffects: EFFECT.ALL });
    const statementList = splitStatements(line);
    if (!statementList.length) return;

    const executeParsed = async (parsed, stmt) => {
      if (parsed.type === "cmd"){
        const {cmd,arg} = parsed;
        if (cmd === "docs"){ showDocs(); return; }
        if (cmd === "clear"){ clearTerminal(); return; }
        if (cmd === "vars"){ listVars(); return; }
        if (cmd === "methods"){ listMethods(); return; }
        if (cmd === "reset"){
          resetAll();
          clearAutosave();
          return;
        }
        if (cmd === "save"){ saveProfile(arg); return; }
        if (cmd === "mux"){ muxProfile(arg); return; }
        if (cmd === "load"){ loadProfile(arg); return; }
        if (cmd === "profiles"){ listProfiles(); return; }
        if (cmd === "pin"){ pinSymbol(arg); return; }
        if (cmd === "unpin"){ unpinSymbol(arg); return; }
        if (cmd === "which"){ whichSymbol(arg); return; }
        if (cmd === "use"){ useSymbolFromProfile(arg); return; }
        if (cmd === "diff"){ diffSymbol(arg); return; }
        if (cmd === "theme"){ setTheme((arg||"").trim()); writeLine(`Theme set to ${state.theme}.`, "ok"); return; }
        if (cmd === "doom"){ runDoomDemo({ gfx, writeLine, writeInputEcho }); return; }
        if (cmd === "test"){ runTestSuite(); return; }

        if (cmd === "export"){
          const text = exportSession();
          await copyText(text);
          return;
        }
        if (cmd === "import"){
          const text = await readClipboard();
          importSession(text);
          writeLine("Imported profile from clipboard.", "ok");
          return;
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
                return;
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
          return;
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
          return;
        }
        throw new Error(`Unknown command: :${cmd}`);
      }

      if (parsed.type === "def"){
        const existed = Object.prototype.hasOwnProperty.call(state.userFns, parsed.name);
        defineUserFn(parsed.name, parsed.params, parsed.expr);
        const verb = existed ? "Updated" : "Added";
        writeLine(`${verb} function ${parsed.name}(${parsed.params.join(", ")}).`, "ok");
        return;
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
        return;
      }

      if (parsed.type === "assign"){
        const val = runExpressionAll(parsed.expr);
        state.vars[parsed.name] = val;
        recordSymbolDefinition({ name: parsed.name, kind: "var", expr: parsed.expr, value: val });
        const fr = formatValueDisplay(val);
        writeLine(`${parsed.name} = ${fr.main}`, "ok");
        if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
        return;
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
        return;
      }

      if (parsed.type === "if"){
        const cond = runExpressionAll(parsed.condition);
        if (isTruthy(cond)){
          await handleLine(parsed.thenBody);
        }else if (parsed.elseBody){
          await handleLine(parsed.elseBody);
        }
        return;
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
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > MAX_LOOP_ITERATIONS){
            throw new Error(`for loop exceeded ${MAX_LOOP_ITERATIONS} iterations`);
          }
          state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          await handleLine(parsed.body);
        }
        if (hadVar) state.vars[parsed.varName] = prevVal;
        else delete state.vars[parsed.varName];
        return;
      }

      if (parsed.type === "repeat"){
        const countVal = runExpressionAll(parsed.countExpr);
        const count = normalizeCompare(countVal, 0)[0];
        if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
        const n = Math.floor(count);
        if (n > MAX_LOOP_ITERATIONS){
          throw new Error(`repeat exceeded ${MAX_LOOP_ITERATIONS} iterations`);
        }
        for (let i = 0; i < n; i++){
          await handleLine(parsed.body);
        }
        return;
      }

      if (parsed.type === "expr"){
        const val = runExpressionAll(parsed.expr);
        const fr = formatValueDisplay(val);
        writeLine(fr.main, "out");
        if (fr.extra) writeLine(`↳ ${fr.extra}`, "muted");
        return;
      }
    };

    try{
      for (const stmt of statementList){
        const parsed = evaluate(stmt);
        if (!parsed) continue;
        const usageEntry = beginUsage(parsed, stmt);

        try{
          await executeParsed(parsed, stmt);
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

  btnHelp.addEventListener("click", showDocs);
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
      { name: "unit", category: "Estimating", detail: "Unit cost from total and quantity", insertText: "unit(" },
      { name: "round_up", category: "Estimating", detail: "Round up to a step", insertText: "round_up(" },
      { name: "line", category: "Estimating", detail: "Build a cost line item assembly", insertText: "line(" },
      { name: "rollup", category: "Estimating", detail: "Roll up line totals", insertText: "rollup(" },

      { name: "area_rect", category: "Layout / Geometry", detail: "Area from length and width", insertText: "area_rect(" },
      { name: "area_circle", category: "Layout / Geometry", detail: "Area from diameter", insertText: "area_circle(" },
      { name: "vol_rect", category: "Layout / Geometry", detail: "Volume from area and thickness", insertText: "vol_rect(" },
      { name: "concrete_cy", category: "Layout / Geometry", detail: "Concrete volume quantity", insertText: "concrete_cy(" },

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

    const categoryOrder = ["Estimating", "Layout / Geometry", "Assemblies", "Materials", "Conversions"];
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
        return;
      }

      if (helperHint){
        const active = helperState.visible[helperState.index];
        helperHint.textContent = active ? active.usage : "Tip: type to filter";
      }

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
          insertIntoEditor(item.insertText);
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
          insertIntoEditor(active.insertText);
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
