import { splitStatements } from "./repl-parser.js";

export function withScopedVar(env, name, fn){
  const hadVar = Object.prototype.hasOwnProperty.call(env, name);
  const prevVal = env[name];
  try{
    return fn();
  }finally{
    if (hadVar) env[name] = prevVal;
    else delete env[name];
  }
}

export function createReplExecutor({
  evaluate,
  runExpressionWithContext,
  solveEquation,
  createAssembly,
  defineUserFn,
  isTruthy,
  normalizeCompare,
  isQty,
  makeQty,
  maxLoopIterations = 100000,
}){
  const runExpression = (expr, env, options) => runExpressionWithContext(expr, env, options);

  function executeSource(source, env, options = {}){
    const statements = Array.isArray(source) ? source : splitStatements(source);
    let lastValue = null;

    for (const stmt of statements){
      const parsed = evaluate(stmt);
      if (!parsed) continue;
      lastValue = executeStatement(parsed, env, options);
    }

    return lastValue;
  }

  function executeStatement(parsed, env, options = {}){
    if (!parsed) return null;

    if (parsed.type === "cmd"){
      throw new Error(`Unsupported command: :${parsed.cmd}`);
    }

    if (parsed.type === "def"){
      if (typeof defineUserFn === "function"){
        defineUserFn(parsed.name, parsed.params, parsed.expr);
      }
      return null;
    }

    if (parsed.type === "assy"){
      const assembly = createAssembly(parsed.name, parsed.fields);
      env[parsed.name] = assembly;
      return assembly;
    }

    if (parsed.type === "assign"){
      const value = runExpression(parsed.expr, env, options);
      env[parsed.name] = value;
      return value;
    }

    if (parsed.type === "equation"){
      const solved = solveEquation(parsed.left, parsed.right);
      if (solved.unknown.unitToken){
        return makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind);
      }
      env[solved.unknown.name] = solved.value;
      return solved.value;
    }

    if (parsed.type === "if"){
      const cond = runExpression(parsed.condition, env, options);
      if (isTruthy(cond)) return executeSource(parsed.thenBody, env, options);
      if (parsed.elseBody) return executeSource(parsed.elseBody, env, options);
      return null;
    }

    if (parsed.type === "for"){
      const startVal = runExpression(parsed.startExpr, env, options);
      const endVal = runExpression(parsed.endExpr, env, options);
      const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr, env, options) : 1;
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
      const forward = step > 0;
      let iter = 0;
      let lastValue = null;

      return withScopedVar(env, parsed.varName, () => {
        for (let i = start; forward ? i <= end : i >= end; i += step){
          iter += 1;
          if (iter > maxLoopIterations){
            throw new Error(`for loop exceeded ${maxLoopIterations} iterations`);
          }
          env[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          lastValue = executeSource(parsed.body, env, options);
        }
        return lastValue;
      });
    }

    if (parsed.type === "repeat"){
      const countVal = runExpression(parsed.countExpr, env, options);
      const count = normalizeCompare(countVal, 0)[0];
      if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
      const n = Math.floor(count);
      if (n > maxLoopIterations){
        throw new Error(`repeat exceeded ${maxLoopIterations} iterations`);
      }
      let lastValue = null;
      for (let i = 0; i < n; i++){
        lastValue = executeSource(parsed.body, env, options);
      }
      return lastValue;
    }

    if (parsed.type === "expr"){
      return runExpression(parsed.expr, env, options);
    }

    return null;
  }

  return {
    executeSource,
    executeStatement,
    withScopedVar,
  };
}

export const createExecutor = createReplExecutor;
