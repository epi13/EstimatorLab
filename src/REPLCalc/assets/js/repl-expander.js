import { STATEMENT_TYPE, isStatementNode } from "./repl-ast.js";
import { createTransition } from "./repl-transitions.js";
import { cloneEnv, createExecutionState, withExecutionState } from "./repl-runtime-state.js";

export function createReplExpander({
  runExpression,
  runExpressionCandidatesWithContext = null,
  solveEquation,
  solveEquationCandidates,
  createAssembly,
  defineUserFn,
  cmdRunner,
  isTruthy,
  normalizeCompare,
  isQty,
  makeQty,
  maxLoopIterations = 100000,
  executeSource,
  stateWithContext = (execState, ...contextParts) => ({
    ...execState,
    contextPath: [...(execState.contextPath || []), ...contextParts.filter((part) => typeof part === "string" && part)],
  }),
  withModeAppliedState = (state) => {
    const incoming = withExecutionState(state);
    const mode = incoming.mode || "commit";
    const shouldClone = mode === "speculate" || mode === "plan";
    const primaryEnv = incoming.env || Object.create(null);
    return {
      ...incoming,
      mode,
      primaryEnv,
      env: shouldClone ? cloneEnv(primaryEnv) : primaryEnv,
      traceExpressions: Boolean(incoming.traceExpressions || mode === "trace"),
    };
  },
  snapshotStateRef = (state) => ({
    mode: state.mode || "commit",
    contextPath: Array.isArray(state.contextPath) ? state.contextPath.slice() : [],
    env: cloneEnv(state.env || Object.create(null)),
  }),
  makeExecutionRecord = ({
    statementNode = null,
    mode = "commit",
    before = null,
    after = null,
    type = "unknown",
    value = null,
    meta = {},
    effects = [],
    changedSymbols = [],
    children = [],
    ...extra
  } = {}) => ({
    type,
    value,
    statement: statementNode?.stmt || extra.statement || "",
    statementKind: statementNode?.kind || extra.statementKind || type,
    statementNode,
    statementNodeId: statementNode?.nodeId || extra.statementNodeId || null,
    mode,
    before,
    after,
    effects: Array.isArray(effects) ? effects : [],
    children: Array.isArray(children) ? children : [],
    meta: meta || {},
    changedSymbols: Array.isArray(changedSymbols) ? changedSymbols : [],
    ...extra,
  }),
  flattenExecutionRecords = (records) => {
    const flattenExecutionRecord = (record) => {
      if (!record) return [];
      const children = Array.isArray(record.children) ? record.children : [];
      return [record, ...children.flatMap((child) => flattenExecutionRecord(child))];
    };
    return (Array.isArray(records) ? records : []).flatMap((record) => flattenExecutionRecord(record));
  },
  mergeChangedSymbols = (entries) => {
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
  },
  withScopedVar = (env, name, fn) => {
    const hadVar = Object.prototype.hasOwnProperty.call(env, name);
    const prevVal = env[name];
    try{
      return fn();
    }finally{
      if (hadVar) env[name] = prevVal;
      else delete env[name];
    }
  },
}){
  function normalizeExpandStatementArgs(statementNodeOrInput, traversalState, expandOptions = {}){
    if (statementNodeOrInput && typeof statementNodeOrInput === "object" && !isStatementNode(statementNodeOrInput) && Object.prototype.hasOwnProperty.call(statementNodeOrInput, "statementNode")){
      const input = statementNodeOrInput;
      return {
        statementNode: input.statementNode || null,
        traversalState: input.traversalState || input.execState || traversalState || null,
        options: {
          ...expandOptions,
          ...(input.options || {}),
          mode: input.mode ?? expandOptions.mode,
        },
      };
    }
    return {
      statementNode: statementNodeOrInput,
      traversalState,
      options: { ...expandOptions },
    };
  }

  function resolveForRange(parsed, execState){
    const startVal = runExpression(parsed.startExpr, execState);
    const endVal = runExpression(parsed.endExpr, execState);
    const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr, execState) : 1;
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
    return { start, end, step, loopKind };
  }

  function expandStatement(statementNodeOrInput, traversalState, expandOptions = {}){
    const { statementNode, traversalState: traversalStateInput, options } = normalizeExpandStatementArgs(
      statementNodeOrInput,
      traversalState,
      expandOptions
    );
    const incomingState = withExecutionState(traversalStateInput);
    const requestedMode = typeof options.mode === "string" ? options.mode : incomingState.mode;
    const execState = withModeAppliedState({ ...incomingState, mode: requestedMode });
    const beforeStateRef = snapshotStateRef(execState);
    const env = execState.env;
    const expressionTrace = execState.traceExpressions ? [] : null;

    if (!statementNode){
      const record = makeExecutionRecord({
        type: "noop",
        mode: execState.mode,
        before: beforeStateRef,
        after: snapshotStateRef(execState),
      });
      return [createTransition({
        transitionType: "noop",
        fromState: beforeStateRef,
        toState: execState,
        record,
      })];
    }
    if (!isStatementNode(statementNode)){
      throw new Error("expandStatement expects an AST statement node.");
    }

    const provenanceEntry = {
      kind: statementNode.kind,
      nodeId: statementNode.nodeId || null,
      contextPath: execState.contextPath.slice(),
      statement: statementNode.stmt || "",
    };

    const finalizeTransition = (recordInput, transitionInput = {}) => {
      const record = makeExecutionRecord({
        statementNode,
        mode: execState.mode,
        before: beforeStateRef,
        after: snapshotStateRef(execState),
        ...recordInput,
      });
      const nextState = {
        ...execState,
        trace: [...(execState.trace || []), record],
      };
      if (execState.mode === "trace"){
        nextState.provenance = [...(execState.provenance || []), provenanceEntry];
        record.provenance = provenanceEntry;
      }
      if (execState.mode === "plan"){
        const candidate = createExecutionState({
          ...nextState,
          env: { ...nextState.env },
          mode: "plan",
          score: typeof nextState.score === "number" ? nextState.score : undefined,
        });
        record.candidates = [candidate];
      }
      return [createTransition({
        transitionType: record.type || statementNode.kind || "unknown",
        fromState: beforeStateRef,
        toState: nextState,
        record,
        ...transitionInput,
      })];
    };

    if (statementNode.kind === STATEMENT_TYPE.CMD){
      if (!execState.allowCommands){
        throw new Error(execState.commandErrorMessage || "Commands are not supported in this context.");
      }
      const value = typeof cmdRunner === "function"
        ? cmdRunner(statementNode.cmd, statementNode.arg)
        : null;
      return finalizeTransition({
        type: "cmd",
        value,
        meta: { command: statementNode.cmd, arg: statementNode.arg },
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.DEF){
      if (typeof defineUserFn === "function"){
        defineUserFn(statementNode.name, statementNode.params, statementNode.expr);
      }
      return finalizeTransition({
        type: "def",
        value: null,
        changedSymbols: [statementNode.name],
        effects: [{ kind: "define-function", symbol: statementNode.name }],
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.ASSY){
      const assembly = createAssembly(statementNode.name, statementNode.fields, env, execState);
      env[statementNode.name] = assembly;
      return finalizeTransition({
        type: "assy",
        value: assembly,
        changedSymbols: [statementNode.name],
        effects: [{ kind: "write-symbol", symbol: statementNode.name, value: assembly }],
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.ASSIGN){
      const exprInput = statementNode.exprIr || statementNode.expr;
      const valueCandidates = typeof runExpressionCandidatesWithContext === "function"
        ? runExpressionCandidatesWithContext(exprInput, execState.env, execState)
        : [{ value: runExpression(exprInput, execState, expressionTrace), scoreDelta: 0, confidence: 1 }];
      const candidate = valueCandidates[0];
      if (candidate){
        env[statementNode.name] = candidate.value;
        return finalizeTransition({
          type: "assign",
          value: candidate.value,
          meta: {
            assignedName: statementNode.name,
            expressionStrategy: candidate.transitionType || "expression-default",
            expressionTrace: expressionTrace || [],
          },
          changedSymbols: [statementNode.name],
          effects: [{ kind: "write-symbol", symbol: statementNode.name, value: candidate.value }],
        }, {
          scoreDelta: Number.isFinite(candidate.scoreDelta) ? candidate.scoreDelta : 0,
          confidence: Number.isFinite(candidate.confidence) ? candidate.confidence : 1,
        });
      }
      throw new Error("Assignment produced no expression candidates.");
    }

    if (statementNode.kind === STATEMENT_TYPE.EQUATION){
      const solvedCandidates = typeof solveEquationCandidates === "function"
        ? solveEquationCandidates(statementNode.left, statementNode.right)
        : [solveEquation(statementNode.left, statementNode.right)];
      const solved = solvedCandidates[0];
      if (!solved) throw new Error("Equation solver produced no candidates.");
      const transitionInput = {
        scoreDelta: Number.isFinite(solved?.scoreDelta) ? solved.scoreDelta : 0,
        confidence: Number.isFinite(solved?.confidence) ? solved.confidence : 1,
      };
      if (solved.unknown.unitToken){
        return finalizeTransition({
          type: "equation",
          value: makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind),
          meta: {
            unknownName: solved.unknown.name,
            usedUnitToken: true,
            strategy: solved.strategy || "numeric-solve",
            expressionTrace: expressionTrace || [],
          },
        }, transitionInput);
      }
      env[solved.unknown.name] = solved.value;
      return finalizeTransition({
        type: "equation",
        value: solved.value,
        meta: {
          unknownName: solved.unknown.name,
          usedUnitToken: false,
          strategy: solved.strategy || "numeric-solve",
          expressionTrace: expressionTrace || [],
        },
        changedSymbols: [solved.unknown.name],
        effects: [{ kind: "write-symbol", symbol: solved.unknown.name, value: solved.value }],
      }, transitionInput);
    }

    if (statementNode.kind === STATEMENT_TYPE.IF){
      const cond = runExpression(statementNode.condition, execState, expressionTrace);
      let branchResult = { lastValue: null, results: [], nextState: execState };
      let branchTaken = "none";
      if (isTruthy(cond)){
        branchTaken = "then";
        branchResult = executeSource(statementNode.thenBody, stateWithContext(execState, "if:then"));
      }else if (statementNode.elseBody){
        branchTaken = "else";
        branchResult = executeSource(statementNode.elseBody, stateWithContext(execState, "if:else"));
      }
      const branchChildren = Array.isArray(branchResult.results) ? branchResult.results : [];
      return finalizeTransition({
        type: "if",
        value: branchResult.lastValue,
        meta: { branchTaken, expressionTrace: expressionTrace || [] },
        children: branchChildren,
        changedSymbols: mergeChangedSymbols(flattenExecutionRecords(branchChildren)),
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.FOR){
      const { start, end, step, loopKind } = resolveForRange(statementNode, execState);
      const forward = step > 0;
      let iter = 0;
      const iterationRecords = [];

      const record = withScopedVar(env, statementNode.varName, () => {
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > maxLoopIterations) throw new Error(`for loop exceeded ${maxLoopIterations} iterations`);
          const iterStateBefore = snapshotStateRef(execState);
          env[statementNode.varName] = loopKind ? makeQty(i, loopKind) : i;
          const iterResult = executeSource(statementNode.body, stateWithContext(execState, `for:${statementNode.varName}`, `iter:${iter}`));
          iterationRecords.push(makeExecutionRecord({
            statementNode,
            type: "for-iteration",
            statement: `for ${statementNode.varName} iteration ${iter}`,
            statementKind: "for-iteration",
            mode: execState.mode,
            before: iterStateBefore,
            after: snapshotStateRef(execState),
            value: iterResult.lastValue,
            meta: { index: iter, loopVar: statementNode.varName, loopValue: env[statementNode.varName] },
            children: Array.isArray(iterResult.results) ? iterResult.results : [],
            changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterResult.results)),
          }));
        }
        const lastValue = iterationRecords.length ? iterationRecords[iterationRecords.length - 1].value : null;
        return {
          type: "for",
          value: lastValue,
          meta: { iterationCount: iter, expressionTrace: expressionTrace || [] },
          children: iterationRecords,
          changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterationRecords)),
        };
      });
      return finalizeTransition(record);
    }

    if (statementNode.kind === STATEMENT_TYPE.REPEAT){
      const countVal = runExpression(statementNode.countExpr, execState, expressionTrace);
      const count = normalizeCompare(countVal, 0)[0];
      if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
      const n = Math.floor(count);
      if (n > maxLoopIterations) throw new Error(`repeat exceeded ${maxLoopIterations} iterations`);
      const iterationRecords = [];
      for (let i = 0; i < n; i++){
        const iterStateBefore = snapshotStateRef(execState);
        const iterResult = executeSource(statementNode.body, stateWithContext(execState, "repeat", `iter:${i + 1}`));
        iterationRecords.push(makeExecutionRecord({
          statementNode,
          type: "repeat-iteration",
          statement: `repeat iteration ${i + 1}`,
          statementKind: "repeat-iteration",
          mode: execState.mode,
          before: iterStateBefore,
          after: snapshotStateRef(execState),
          value: iterResult.lastValue,
          meta: { index: i + 1 },
          children: Array.isArray(iterResult.results) ? iterResult.results : [],
          changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterResult.results)),
        }));
      }
      const lastValue = iterationRecords.length ? iterationRecords[iterationRecords.length - 1].value : null;
      return finalizeTransition({
        type: "repeat",
        value: lastValue,
        meta: { repeatCount: n, expressionTrace: expressionTrace || [] },
        children: iterationRecords,
        changedSymbols: mergeChangedSymbols(flattenExecutionRecords(iterationRecords)),
      });
    }

    if (statementNode.kind === STATEMENT_TYPE.EXPR){
      const exprInput = statementNode.exprIr || statementNode.expr;
      const valueCandidates = typeof runExpressionCandidatesWithContext === "function"
        ? runExpressionCandidatesWithContext(exprInput, execState.env, execState)
        : [{ value: runExpression(exprInput, execState, expressionTrace), scoreDelta: 0, confidence: 1 }];
      const transitions = valueCandidates.flatMap((candidate) => finalizeTransition({
        type: "expr",
        value: candidate.value,
        meta: {
          expressionStrategy: candidate.transitionType || "expression-default",
          expressionTrace: expressionTrace || [],
        },
      }, {
        scoreDelta: Number.isFinite(candidate.scoreDelta) ? candidate.scoreDelta : 0,
        confidence: Number.isFinite(candidate.confidence) ? candidate.confidence : 1,
      }));
      if (transitions.length) return transitions;
      throw new Error("Expression produced no candidates.");
    }

    return finalizeTransition({ type: statementNode.kind || "unknown", value: null });
  }

  return { expandStatement };
}
