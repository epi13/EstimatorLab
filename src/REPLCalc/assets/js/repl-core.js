import { createBaseFns, defFn, defFnCtx } from "./repl-builtins.js";
import { EFFECT } from "./repl-effects.js";
import {
  buildAliasMap,
  evalExpressionIR,
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
    evalExpressionIR,
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

  const MAX_LOOP_ITERATIONS = 100000;

  const executor = createExecutor({
    runExpressionWithContext: evaluator.runExpressionWithContext,
    solveEquation: evaluator.solveEquation,
    createAssembly: evaluator.createAssembly,
    defineUserFn: runtime.defineUserFn,
    cmdRunner,
    isTruthy,
    normalizeCompare,
    isQty,
    makeQty,
    maxLoopIterations: MAX_LOOP_ITERATIONS,
  });

  const runLoopStatements = (source, context = null) => {
    const opts = executor.normalizeOptions({
      allowedEffects: EFFECT.ALL,
      allowCommands: false,
      wrapErrors: true,
      captureResults: false,
      contextPath: Array.isArray(context) ? context : [],
      commandErrorMessage: "Commands are not supported in gfx loop scripts.",
    });

    const ast = evaluator.parseSource(source);
    executor.executeSource(ast, state.vars, opts);
  };

  const executeBlock = (source, options = null) => {
    const opts = executor.normalizeOptions({
      ...(options || {}),
      allowCommands: false,
      wrapErrors: false,
      captureResults: true,
      commandErrorMessage: "Commands are not supported in function bodies.",
    });
    const ast = evaluator.parseSource(source);
    return executor.executeSource(ast, state.vars, opts);
  };
  const executeSource = (source, options) => executeBlock(source, options);
  const runBlockBody = (source, options) => executeBlock(source, options).lastValue;
  state.executeBlock = executeBlock;
  state.executeSource = executeSource;

  runtime.setRunExpressionWithContext(evaluator.runExpressionWithContext);
  runtime.setRunBlockBody(runBlockBody);
  gfx.setRunExpressionWithContext((expr, vars, options = null) => {
    const opts = executor.normalizeOptions(options || {});
    return evaluator.runExpressionWithContext(expr, vars, opts);
  });
  gfx.setRunLoopStatementRunner((source, options = null) => {
    const opts = executor.normalizeOptions({
      ...(options || {}),
      allowCommands: false,
      wrapErrors: true,
      captureResults: false,
      commandErrorMessage: "Commands are not supported in gfx loop scripts.",
    });
    const ast = evaluator.parseSource(source);
    return executor.executeSource(ast, state.vars, opts);
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
