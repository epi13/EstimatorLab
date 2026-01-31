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
  const gfx = createGfxTools({ state, terminalEl: ui.terminalEl });
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

  runtime.setRunExpressionWithContext(evaluator.runExpressionWithContext);

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
