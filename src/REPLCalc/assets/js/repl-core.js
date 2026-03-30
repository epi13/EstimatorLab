import { createBaseFns, defFn, defFnCtx } from "./repl-builtins.js";
import { EFFECT } from "./repl-effects.js";
import {
  buildAliasMap,
  evalRPN,
  insertImplicitMultiplication,
  isTruthy,
  normalizeCompare,
  tokenize,
  toRPN,
} from "./repl-expression.js";
import {
  UNIT,
  formatResult,
  isQty,
  isUnitToken,
  makeQty,
  qtyToString,
} from "./repl-units.js";
import { createUi } from "./repl-ui.js";
import { createGfxTools } from "./repl-gfx.js";
import { createRuntime } from "./repl-runtime.js";
import { createEvaluator } from "./repl-evaluator.js";
import { createSession } from "./repl-session.js";
import { createEditor } from "./repl-editor.js";
import { createTests } from "./repl-tests.js";
import { createInputHandlers } from "./repl-input.js";
import { createUserFunctionUi } from "./repl-user-functions.js";
import { createExecutor } from "./repl-executor.js";
import { parseParams, splitStatements } from "./repl-parser.js";
import { createExecutor } from "./repl-executor.js";

export function initRepl(){
  const state = {
    vars: Object.create(null),
    history: [],
    histIdx: -1,
    theme: "default",
    userFns: Object.create(null),
    gfx: null,
    gfxDirty: false,
    symbolTable: new Map(),
    shadowTable: new Map(),
    depGraph: new Map(),
    usageLog: [],
    usageSeq: 0,
    touchedSymbols: new Map(),
    lastSaveSeq: 0,
    symbolVersions: new Map(),
    pinnedSymbols: new Set(),
    loadedProfiles: new Map(),
    forcedSymbols: new Map(),
    currentUsage: null,
    loadingProfileSymbol: false,
  };
  state.resolver = state.symbolTable;

  const KEYWORDS = new Set(["if", "else", "for", "in", "step", "repeat", "def", "fn", "so", "function", "assy"]);
  const baseFns = createBaseFns();

  const ui = createUi(state);
  state.writeLine = ui.writeLine;
  state.writeLineRich = ui.writeLineRich;
  const gfx = createGfxTools({ state, terminalEl: ui.terminalEl, writeLine: ui.writeLine });
  const gfxFns = gfx.buildGfxMetaFns(defFn, defFnCtx);

  let editor;

  const userFnUi = createUserFunctionUi({
    state,
    inputEl: ui.inputEl,
    fnNameInput: ui.fnNameInput,
    fnParamsInput: ui.fnParamsInput,
    fnExprInput: ui.fnExprInput,
    userFnList: ui.userFnList,
    userFnEmpty: ui.userFnEmpty,
    updateHighlight: () => editor?.updateHighlight(),
    syncEditorHeight: () => editor?.syncEditorHeight(),
    scheduleLiveResult: () => editor?.scheduleLiveResult(),
    writeLine: ui.writeLine,
  });

  const runtime = createRuntime({
    state,
    baseFns,
    defFn,
    defFnCtx,
    renderUserFunctions: userFnUi.renderUserFunctions,
    parseParams,
    gfxFns,
  });

  const session = createSession({
    state,
    setTheme: ui.setTheme,
    writeLine: ui.writeLine,
    setStatus: ui.setStatus,
    renderUserFunctions: userFnUi.renderUserFunctions,
    defineUserFn: runtime.defineUserFn,
  });

  const cmdRunner = (cmd, arg) => {
    const name = String(cmd || "").trim();
    const a = String(arg || "").trim();
    if (name === "reset"){ session.resetAll(); return 1; }
    if (name === "save"){ session.saveProfile(a); return 1; }
    if (name === "mux"){ session.muxProfile(a); return 1; }
    if (name === "load"){ session.loadProfile(a); return 1; }
    if (name === "profiles"){ session.listProfiles(); return 1; }
    if (name === "pin"){ session.pinSymbol(a); return 1; }
    if (name === "unpin"){ session.unpinSymbol(a); return 1; }
    if (name === "which"){ session.whichSymbol(a); return 1; }
    if (name === "use"){ session.useSymbolFromProfile(a); return 1; }
    if (name === "diff"){ session.diffSymbol(a); return 1; }
    if (name === "theme"){ ui.setTheme(a || "default"); return state.theme; }
    throw new Error(`cmd(): unsupported command: ${name}`);
  };

  const evaluator = createEvaluator({
    state,
    getFns: runtime.getFns,
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
    ensureSymbolsLoaded: session.ensureSymbolsLoaded,
    usageTracker: session.usageTracker,
    cmdRunner,
  });
  state.formatValueDisplay = evaluator.formatValueDisplay;

  const runLoopStatements = (source, context = null) => {
    const loopOptions = { allowedEffects: EFFECT.ALL };
    const statementList = splitStatements(source);
    const ctx = Array.isArray(context) ? context : [];

    const executeLoopParsedStatement = (parsed, stmtIdx) => {
      if (parsed.type === "cmd"){
        throw new Error("Commands are not supported in gfx loop scripts.");
      }

      if (parsed.type === "def"){
        runtime.defineUserFn(parsed.name, parsed.params, parsed.expr);
        return;
      }

      if (parsed.type === "assy"){
        const assembly = evaluator.createAssembly(parsed.name, parsed.fields);
        state.vars[parsed.name] = assembly;
        return;
      }

      if (parsed.type === "assign"){
        state.vars[parsed.name] = evaluator.runExpressionWithContext(parsed.expr, state.vars, loopOptions);
        return;
      }

      if (parsed.type === "equation"){
        const solved = evaluator.solveEquation(parsed.left, parsed.right);
        if (!solved.unknown.unitToken){
          state.vars[solved.unknown.name] = solved.value;
        }
        return;
      }

      if (parsed.type === "if"){
        const cond = evaluator.runExpressionWithContext(parsed.condition, state.vars, loopOptions);
        const childCtx = ctx.concat([`if#${stmtIdx + 1}`]);
        if (isTruthy(cond)){
          runLoopStatements(parsed.thenBody, childCtx);
        }else if (parsed.elseBody){
          runLoopStatements(parsed.elseBody, childCtx);
        }
        return;
      }

      if (parsed.type === "for"){
        const startVal = evaluator.runExpressionWithContext(parsed.startExpr, state.vars, loopOptions);
        const endVal = evaluator.runExpressionWithContext(parsed.endExpr, state.vars, loopOptions);
        const stepVal = parsed.stepExpr ? evaluator.runExpressionWithContext(parsed.stepExpr, state.vars, loopOptions) : 1;
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
        const childCtx = ctx.concat([`for#${stmtIdx + 1}`]);
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > MAX_LOOP_ITERATIONS){
            throw new Error(`for loop exceeded ${MAX_LOOP_ITERATIONS} iterations`);
          }
          state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          runLoopStatements(parsed.body, childCtx);
        }
        if (hadVar) state.vars[parsed.varName] = prevVal;
        else delete state.vars[parsed.varName];
        return;
      }

      if (parsed.type === "repeat"){
        const countVal = evaluator.runExpressionWithContext(parsed.countExpr, state.vars, loopOptions);
        const count = normalizeCompare(countVal, 0)[0];
        if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
        const n = Math.floor(count);
        if (n > MAX_LOOP_ITERATIONS){
          throw new Error(`repeat exceeded ${MAX_LOOP_ITERATIONS} iterations`);
        }
        const childCtx = ctx.concat([`repeat#${stmtIdx + 1}`]);
        for (let i = 0; i < n; i++){
          runLoopStatements(parsed.body, childCtx);
        }
        return;
      }

      if (parsed.type === "expr"){
        evaluator.runExpressionWithContext(parsed.expr, state.vars, loopOptions);
      }
    };

    for (let stmtIdx = 0; stmtIdx < statementList.length; stmtIdx++){
      const stmt = statementList[stmtIdx];
      if (!stmt) continue;
      executeStatementSafely(stmt, stmtIdx, {
        parseStatement: (sourceStmt) => evaluator.evaluate(sourceStmt),
        executeParsedStatement: (parsed) => executeLoopParsedStatement(parsed, stmtIdx),
      }, {
        wrapErrors: true,
        contextPath: ctx,
      });
    }
  };

  const mergeChangedSymbols = (entries) => {
    const changed = [];
    const seen = new Set();
    for (const entry of entries || []){
      const symbols = Array.isArray(entry?.changedSymbols) ? entry.changedSymbols : [];
      for (const name of symbols){
        if (!seen.has(name)){
          seen.add(name);
          changed.push(name);
        }
      }
    }
    return changed;
  };

  const executeBlock = (source, options) => {
    const opts = options || { allowedEffects: EFFECT.ALL };
    const statementList = splitStatements(source);
    const blockResult = { lastValue: null, results: [] };

    for (let stmtIdx = 0; stmtIdx < statementList.length; stmtIdx++){
      const stmt = statementList[stmtIdx];
      if (!stmt) continue;
      const cleaned = stmt.replace(/;\s*$/, "");
      const parsed = evaluator.evaluate(cleaned);
      if (!parsed) continue;
      let statementResult = { type: parsed.type, value: null };

      if (parsed.type === "cmd"){
        throw new Error("Commands are not supported in function bodies.");
      }

      if (parsed.type === "def"){
        runtime.defineUserFn(parsed.name, parsed.params, parsed.expr);
        statementResult = { type: "def", value: null, changedSymbols: [parsed.name] };
        blockResult.results.push(statementResult);
        continue;
      }

      if (parsed.type === "assy"){
        const assembly = evaluator.createAssembly(parsed.name, parsed.fields);
        state.vars[parsed.name] = assembly;
        statementResult = { type: "assy", value: assembly, changedSymbols: [parsed.name] };
        blockResult.lastValue = assembly;
        blockResult.results.push(statementResult);
        continue;
      }

      if (parsed.type === "assign"){
        const assignedValue = evaluator.runExpressionWithContext(parsed.expr, state.vars, opts);
        state.vars[parsed.name] = assignedValue;
        statementResult = { type: "assign", value: assignedValue, changedSymbols: [parsed.name] };
        blockResult.lastValue = assignedValue;
        blockResult.results.push(statementResult);
        continue;
      }

      if (parsed.type === "equation"){
        const solved = evaluator.solveEquation(parsed.left, parsed.right);
        const changedSymbols = [];
        if (!solved.unknown.unitToken){
          state.vars[solved.unknown.name] = solved.value;
          changedSymbols.push(solved.unknown.name);
        }
        statementResult = { type: "equation", value: solved.value, changedSymbols };
        blockResult.lastValue = solved.value;
        blockResult.results.push(statementResult);
        continue;
      }

      if (parsed.type === "if"){
        const cond = evaluator.runExpressionWithContext(parsed.condition, state.vars, opts);
        let branchResult = { lastValue: null, results: [] };
        if (isTruthy(cond)){
          branchResult = executeBlock(parsed.thenBody, opts);
        }else if (parsed.elseBody){
          branchResult = executeBlock(parsed.elseBody, opts);
        }
        statementResult = {
          type: "if",
          value: branchResult.lastValue,
          results: branchResult.results,
          changedSymbols: mergeChangedSymbols(branchResult.results),
        };
        blockResult.lastValue = branchResult.lastValue;
        blockResult.results.push(statementResult);
        continue;
      }

      if (parsed.type === "for"){
        const startVal = evaluator.runExpressionWithContext(parsed.startExpr, state.vars, opts);
        const endVal = evaluator.runExpressionWithContext(parsed.endExpr, state.vars, opts);
        const stepVal = parsed.stepExpr ? evaluator.runExpressionWithContext(parsed.stepExpr, state.vars, opts) : 1;
        let start, end, step;
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
        const nestedResults = [];
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > MAX_LOOP_ITERATIONS){
            throw new Error(`for loop exceeded ${MAX_LOOP_ITERATIONS} iterations`);
          }
          state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          const iterResult = executeBlock(parsed.body, opts);
          nestedResults.push(iterResult);
        }
        if (hadVar) state.vars[parsed.varName] = prevVal;
        else delete state.vars[parsed.varName];
        const flattened = nestedResults.flatMap((entry) => entry.results);
        const forValue = nestedResults.length ? nestedResults[nestedResults.length - 1].lastValue : null;
        statementResult = {
          type: "for",
          value: forValue,
          results: flattened,
          changedSymbols: mergeChangedSymbols(flattened),
        };
        blockResult.lastValue = forValue;
        blockResult.results.push(statementResult);
        continue;
      }

      if (parsed.type === "repeat"){
        const countVal = evaluator.runExpressionWithContext(parsed.countExpr, state.vars, opts);
        const count = normalizeCompare(countVal, 0)[0];
        if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
        const n = Math.floor(count);
        if (n > MAX_LOOP_ITERATIONS){
          throw new Error(`repeat exceeded ${MAX_LOOP_ITERATIONS} iterations`);
        }
        const nestedResults = [];
        for (let i = 0; i < n; i++){
          const iterResult = executeBlock(parsed.body, opts);
          nestedResults.push(iterResult);
        }
        const flattened = nestedResults.flatMap((entry) => entry.results);
        const repeatValue = nestedResults.length ? nestedResults[nestedResults.length - 1].lastValue : null;
        statementResult = {
          type: "repeat",
          value: repeatValue,
          results: flattened,
          changedSymbols: mergeChangedSymbols(flattened),
        };
        blockResult.lastValue = repeatValue;
        blockResult.results.push(statementResult);
        continue;
      }

      if (parsed.type === "expr"){
        const exprValue = evaluator.runExpressionWithContext(parsed.expr, state.vars, opts);
        statementResult = { type: "expr", value: exprValue };
        blockResult.lastValue = exprValue;
        blockResult.results.push(statementResult);
      }
    }

    return blockResult;
  };
  const executeSource = (source, options) => executeBlock(source, options);
  const runBlockBody = (source, options) => executeBlock(source, options).lastValue;
  state.executeBlock = executeBlock;
  state.executeSource = executeSource;

  runtime.setRunExpressionWithContext(evaluator.runExpressionWithContext);
  runtime.setRunBlockBody(runBlockBody);
  gfx.setRunExpressionWithContext((expr, vars, options = null) => {
    const opts = executor.normalizeOptions(options);
    return evaluator.runExpressionWithContext(expr, vars, opts);
  });
  gfx.setRunLoopStatementRunner((source, options = null) => {
    const opts = executor.normalizeOptions(options);
    return runLoopStatements(source, opts);
  });

  editor = createEditor({
    state,
    inputEl: ui.inputEl,
    highlightEl: ui.highlightEl,
    autocompleteEl: ui.autocompleteEl,
    liveResultEl: ui.liveResultEl,
    getFns: runtime.getFns,
    evaluate: evaluator.evaluate,
    runExpressionWithContext: evaluator.runExpressionWithContext,
    solveEquation: evaluator.solveEquation,
    formatValueDisplay: evaluator.formatValueDisplay,
    tokenize,
    UNIT,
    KEYWORDS,
  });

  const tests = createTests({
    state,
    setStatus: ui.setStatus,
    writeLine: ui.writeLine,
    renderUserFunctions: userFnUi.renderUserFunctions,
    evaluate: evaluator.evaluate,
    runExpression: (expr) => evaluator.runExpressionWithContext(expr, state.vars, { allowedEffects: EFFECT.ALL }),
    solveEquation: evaluator.solveEquation,
    defineUserFn: runtime.defineUserFn,
    createAssembly: evaluator.createAssembly,
    formatAssemblySummary: evaluator.formatAssemblySummary,
    splitStatements,
    isTruthy,
    normalizeCompare,
    makeQty,
    isQty,
    formatInput: editor.formatInput,
    qtyToString,
  });

  createInputHandlers({
    state,
    ui,
    editor,
    userFnUi,
    session,
    tests,
    evaluator,
    runtime,
    gfx,
    isTruthy,
    normalizeCompare,
    isQty,
    makeQty,
  });
}
