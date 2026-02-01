import { createBaseFns, defFn } from "./repl-builtins.js";
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
import { createGfxTools, GFX_COLOR_TOKENS } from "./repl-gfx.js";
import { createRuntime } from "./repl-runtime.js";
import { createEvaluator } from "./repl-evaluator.js";
import { createDocs } from "./repl-docs.js";
import { createHelp } from "./repl-help.js";
import { createSession } from "./repl-session.js";
import { createEditor } from "./repl-editor.js";
import { createTests } from "./repl-tests.js";
import { createInputHandlers } from "./repl-input.js";
import { createUserFunctionUi } from "./repl-user-functions.js";
import { parseParams, splitStatements } from "./repl-parser.js";

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
  const gfx = createGfxTools({ state, terminalEl: ui.terminalEl, writeLine: ui.writeLine });
  const gfxFns = gfx.buildGfxMetaFns(defFn);

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
  });

  const runLoopStatements = (source) => {
    const statementList = splitStatements(source);
    for (const stmt of statementList){
      if (!stmt) continue;
      const parsed = evaluator.evaluate(stmt);
      if (!parsed) continue;

      if (parsed.type === "cmd"){
        throw new Error("Commands are not supported in gfx loop scripts.");
      }

      if (parsed.type === "def"){
        runtime.defineUserFn(parsed.name, parsed.params, parsed.expr);
        continue;
      }

      if (parsed.type === "assy"){
        const assembly = evaluator.createAssembly(parsed.name, parsed.fields);
        state.vars[parsed.name] = assembly;
        continue;
      }

      if (parsed.type === "assign"){
        state.vars[parsed.name] = evaluator.runExpression(parsed.expr);
        continue;
      }

      if (parsed.type === "equation"){
        const solved = evaluator.solveEquation(parsed.left, parsed.right);
        if (!solved.unknown.unitToken){
          state.vars[solved.unknown.name] = solved.value;
        }
        continue;
      }

      if (parsed.type === "if"){
        const cond = evaluator.runExpression(parsed.condition);
        if (isTruthy(cond)){
          runLoopStatements(parsed.thenBody);
        }else if (parsed.elseBody){
          runLoopStatements(parsed.elseBody);
        }
        continue;
      }

      if (parsed.type === "for"){
        const startVal = evaluator.runExpression(parsed.startExpr);
        const endVal = evaluator.runExpression(parsed.endExpr);
        const stepVal = parsed.stepExpr ? evaluator.runExpression(parsed.stepExpr) : 1;
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
          runLoopStatements(parsed.body);
        }
        if (hadVar) state.vars[parsed.varName] = prevVal;
        else delete state.vars[parsed.varName];
        continue;
      }

      if (parsed.type === "repeat"){
        const countVal = evaluator.runExpression(parsed.countExpr);
        const count = normalizeCompare(countVal, 0)[0];
        if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
        for (let i = 0; i < Math.floor(count); i++){
          runLoopStatements(parsed.body);
        }
        continue;
      }

      if (parsed.type === "expr"){
        evaluator.runExpression(parsed.expr);
      }
    }
  };

  runtime.setRunExpressionWithContext(evaluator.runExpressionWithContext);
  gfx.setRunExpressionWithContext(evaluator.runExpressionWithContext);
  gfx.setRunLoopStatementRunner(runLoopStatements);

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

  const docs = createDocs({
    state,
    formatValueDisplay: evaluator.formatValueDisplay,
    writeLine: ui.writeLine,
    writeLineRich: ui.writeLineRich,
    token: ui.token,
    GFX_COLOR_TOKENS,
  });
  const help = createHelp({
    writeLine: ui.writeLine,
    writeLineRich: ui.writeLineRich,
    token: ui.token,
    GFX_COLOR_TOKENS,
  });

  const tests = createTests({
    state,
    setStatus: ui.setStatus,
    writeLine: ui.writeLine,
    renderUserFunctions: userFnUi.renderUserFunctions,
    evaluate: evaluator.evaluate,
    runExpression: evaluator.runExpression,
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
    docs: { ...docs, ...help },
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
