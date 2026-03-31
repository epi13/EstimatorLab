import { createBaseFns, defFn, defFnCtx } from "./repl-builtins.js";
import { EFFECT } from "./repl-effects.js";
import {
  evalExpressionIR,
  isTruthy,
  normalizeCompare,
  tokenize,
  toRPN,
  insertImplicitMultiplication,
  buildAliasMap,
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
import { createReplLowering } from "./repl-lowering.js";
import { createReplFrontend } from "./repl-frontend.js";
import { createSession } from "./repl-session.js";
import { createEditor } from "./repl-editor.js";
import { createTests } from "./repl-tests.js";
import { createInputHandlers } from "./repl-input.js";
import { createUserFunctionUi } from "./repl-user-functions.js";
import { createExecutor } from "./repl-executor.js";
import { createReplExpander } from "./repl-expander.js";
import { createReplTraversal } from "./repl-traversal.js";
import { parseParams } from "./repl-parser.js";
import { createBlockNode, isBlockNode } from "./repl-ast.js";

export function initRepl(){
  const budgetPolicyPresets = Object.freeze({
    interactive: Object.freeze({
      cpuMsPerFrame: 10,
      traversal: { nodeBudget: 96, expansionBudget: 96, frontierBudget: 128 },
      gfx: { internalScaleMin: 0.5, internalScaleMax: 1, qualityTier: "performance" },
    }),
    performance: Object.freeze({
      cpuMsPerFrame: 10,
      traversal: { nodeBudget: 96, expansionBudget: 96, frontierBudget: 128 },
      gfx: { internalScaleMin: 0.5, internalScaleMax: 1, qualityTier: "performance" },
    }),
    balanced: Object.freeze({
      cpuMsPerFrame: 12,
      traversal: { nodeBudget: 192, expansionBudget: 192, frontierBudget: 224 },
      gfx: { internalScaleMin: 0.6, internalScaleMax: 1, qualityTier: "balanced" },
    }),
    cinematic: Object.freeze({
      cpuMsPerFrame: 16,
      traversal: { nodeBudget: 320, expansionBudget: 320, frontierBudget: 384 },
      gfx: { internalScaleMin: 0.8, internalScaleMax: 1, qualityTier: "ultra" },
    }),
    "headless-batch": Object.freeze({
      cpuMsPerFrame: 20,
      traversal: { nodeBudget: 512, expansionBudget: 512, frontierBudget: 640 },
      gfx: { internalScaleMin: 0.5, internalScaleMax: 0.8, qualityTier: "eco" },
    }),
  });

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
    traversalConfig: {
      output: {
        mode: "summary",
      },
      maxTraceNodes: 256,
      maxTraceEdges: 512,
      maxDiagnostics: 256,
      streamBufferSize: 64,
      bestKFrontier: 8,
    },
    traversalDebugConfig: {
      output: {
        mode: "full",
      },
      maxTraceNodes: 4096,
      maxTraceEdges: 8192,
      maxDiagnostics: 2048,
      streamBufferSize: 256,
      bestKFrontier: 32,
    },
    budgetManager: {
      policyPreset: "balanced",
      policyPresets: budgetPolicyPresets,
      cpuMsPerFrame: 12,
      qualityTier: "balanced",
      traversalBudget: {
        nodeBudget: 192,
        expansionBudget: 192,
        frontierBudget: 224,
      },
      gfxBudget: {
        internalScaleMin: 0.6,
        internalScaleMax: 1,
      },
      telemetry: {
        frame: 0,
        traversalExpandMs: 0,
        raycastMs: 0,
        upscaleMs: 0,
        temporalBlendMs: 0,
        totalFrameMs: 0,
        frameHeadroomMs: 0,
        traversalPressure: 0,
        memoryUsedBytes: 0,
        memoryLimitBytes: 0,
        memoryPressure: 0,
      },
      debugHud: false,
    },
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

  const lowering = createReplLowering({
    getFns: runtime.getFns,
    tokenize,
    toRPN,
    insertImplicitMultiplication,
    buildAliasMap,
    ensureSymbolsLoaded: session.ensureSymbolsLoaded,
    isUnitToken,
    UNIT,
  });

  const frontend = createReplFrontend({
    parseExpressionIR: lowering.parseExpressionIR,
    normalizeBlockNode: lowering.normalizeBlockNode,
  });

  state.canonicalKey = lowering.canonicalKey;

  const evaluator = createEvaluator({
    state,
    getFns: runtime.getFns,
    isTruthy,
    normalizeCompare,
    evalExpressionIR,
    makeQty,
    isQty,
    qtyToString,
    formatResult,
    usageTracker: session.usageTracker,
    cmdRunner,
    lowering,
  });
  state.formatValueDisplay = evaluator.formatValueDisplay;

  const MAX_LOOP_ITERATIONS = 100000;

  let executeSourceRef = null;
  const expander = createReplExpander({
    runExpression: (expr, execState, traceBuffer = null) => {
      const traceSink = Array.isArray(traceBuffer)
        ? (entry) => traceBuffer.push(entry)
        : null;
      return evaluator.runExpressionWithContext(expr, execState.env, {
        ...execState,
        allowedEffects: execState.effectsAllowed,
        effectsAllowed: execState.effectsAllowed,
        traceExpressions: Boolean(execState.traceExpressions || execState.mode === "trace"),
        expressionTraceSink: traceSink,
      });
    },
    runExpressionWithContext: evaluator.runExpressionWithContext,
    runExpressionCandidatesWithContext: evaluator.runExpressionCandidatesWithContext,
    solveEquation: evaluator.solveEquation,
    solveEquationCandidates: evaluator.solveEquationCandidates,
    createAssembly: evaluator.createAssembly,
    defineUserFn: runtime.defineUserFn,
    cmdRunner,
    isTruthy,
    normalizeCompare,
    isQty,
    makeQty,
    maxLoopIterations: MAX_LOOP_ITERATIONS,
    executeSource: (...args) => executeSourceRef(...args),
  });
  const executor = createExecutor({
    expandStatement: expander.expandStatement,
  });
  executeSourceRef = executor.executeSource;
  const traversal = createReplTraversal({
    expandStatement: expander.expandStatement,
    canonicalStateKey: lowering.canonicalKey.state,
    defaultRunConfig: state.traversalConfig,
  });
  state.traversal = traversal;

  const runLoopStatements = (source, context = null) => {
    const opts = executor.normalizeOptions({
      allowedEffects: EFFECT.ALL,
      allowCommands: false,
      wrapErrors: true,
      captureResults: false,
      contextPath: Array.isArray(context) ? context : [],
      commandErrorMessage: "Commands are not supported in gfx loop scripts.",
    });

    const ast = frontend.parseSource(source);
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
    const ast = frontend.parseSource(source);
    return executor.executeSource(ast, state.vars, opts);
  };
  const toProgramBlockNode = (programInput) => {
    if (typeof programInput === "string"){
      return frontend.parseSource(programInput);
    }
    if (isBlockNode(programInput)){
      return programInput;
    }
    if (Array.isArray(programInput)){
      return createBlockNode(programInput, { sourceKind: "statement-array" });
    }
    throw new Error("executeProgram expects a source string, an AST block node, or a legacy statement-node array convertible to a block node.");
  };

  const executeProgram = (sourceOrAst, env = state.vars, mode = "commit", options = null) => {
    const normalized = executor.normalizeOptions({
      ...(options || {}),
      mode,
    });
    const ast = toProgramBlockNode(sourceOrAst);
    return executor.executeSource(ast, env, normalized);
  };
  const executeSource = (source, options) => executeBlock(source, options);
  const runBlockBody = (source, options) => executeBlock(source, options).lastValue;
  state.executeBlock = executeBlock;
  state.executeSource = executeSource;
  state.executeProgram = executeProgram;

  runtime.setRunExpressionWithContext(evaluator.runExpressionWithContext);
  runtime.setRunBlockBody(runBlockBody);
  gfx.setRunExpressionWithContext((expr, vars, options = null) => {
    const opts = executor.normalizeOptions(options || {});
    return evaluator.runExpressionWithContext(expr, vars, opts);
  });
  gfx.setRunLoopStatementRunner((source, options = null) => {
    const opts = {
      ...(options || {}),
      allowCommands: false,
      wrapErrors: true,
      captureResults: false,
      commandErrorMessage: "Commands are not supported in gfx loop scripts.",
    };
    return executeProgram(source, state.vars, "commit", opts);
  });

  editor = createEditor({
    state,
    inputEl: ui.inputEl,
    highlightEl: ui.highlightEl,
    autocompleteEl: ui.autocompleteEl,
    liveResultEl: ui.liveResultEl,
    getFns: runtime.getFns,
    evaluate: frontend.evaluate,
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
    formatAssemblySummary: evaluator.formatAssemblySummary,
    makeQty,
    isQty,
    formatInput: editor.formatInput,
    qtyToString,
    frontend,
    executeProgram,
  });

  createInputHandlers({
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
    executeProgram,
  });
}
