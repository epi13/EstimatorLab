import { EFFECT } from "./repl-effects.js";

export function createRuntime({ state, baseFns, defFn, defFnCtx, renderUserFunctions, parseParams, gfxFns }){
  let runExpressionWithContext = null;
  const callStack = [];

  const metaFns = Object.create(null);

  function normalizeMetaName(value, label){
    if (typeof value !== "string") throw new Error(`${label} expects a string name`);
    const name = value.trim();
    if (!name) throw new Error(`${label} expects a non-empty name`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid name: ${name}`);
    return name;
  }

  function normalizeMetaParams(value){
    if (typeof value !== "string") throw new Error("define expects params as a string");
    return parseParams(value);
  }

  function getFns(){
    const merged = Object.assign(Object.create(null), baseFns, metaFns, state.userFns);
    if (baseFns.line && metaFns.line){
      merged.line = {
        arity: -1,
        ctx: true,
        impl: (ctx, ...args) => {
          const first = args.length ? args[0] : null;
          if (typeof first === "string" || (first && typeof first === "object" && first.__kind === "string")){
            return baseFns.line.impl(ctx, ...args);
          }
          const allowed = typeof ctx?.allowedEffects === "number" ? ctx.allowedEffects : EFFECT.ALL;
          const need = typeof metaFns.line.effects === "number" ? metaFns.line.effects : EFFECT.IO_GFX;
          if ((need & ~allowed) !== 0){
            throw new Error(`ERR[E_EFFECT] line(): effect IO_GFX not allowed in this context`);
          }
          return metaFns.line.impl(...args);
        },
      };
    }
    return merged;
  }

  function defineUserFn(name, params, expr){
    if (Object.prototype.hasOwnProperty.call(baseFns, name) || Object.prototype.hasOwnProperty.call(metaFns, name)){
      throw new Error(`Cannot redefine built-in function: ${name}`);
    }
    if (typeof defFnCtx !== "function") throw new Error("Runtime missing defFnCtx");
    const defn = defFnCtx(name, params.length, (ctx, ...args) => {
      if (callStack.includes(name)){
        const cycle = [...callStack, name].join(" -> ");
        throw new Error(`Circular function call: ${cycle}`);
      }
      callStack.push(name);
      const scoped = Object.create(null);
      Object.assign(scoped, state.vars);
      params.forEach((param, idx) => {
        scoped[param] = args[idx];
      });
      if (!runExpressionWithContext){
        throw new Error("Expression engine not ready.");
      }
      try{
        const allowed = typeof ctx?.allowedEffects === "number" ? ctx.allowedEffects : EFFECT.PURE;
        return runExpressionWithContext(expr, scoped, { allowedEffects: allowed });
      }finally{
        callStack.pop();
      }
    });
    defn.params = params.slice();
    defn.expr = expr.trim();
    defn.name = name;
    state.userFns[name] = defn;
    renderUserFunctions();
    if (typeof state.onUserFnDefined === "function"){
      state.onUserFnDefined({ name, params: params.slice(), expr: defn.expr });
    }
  }

  metaFns.eval = defFn("eval", 1, {
    args: [{ label: "expr", kinds: ["string"] }],
    returns: { kinds: ["any"] },
  }, (expr) => {
    if (typeof expr !== "string") throw new Error("eval expects a string expression");
    if (!runExpressionWithContext) throw new Error("Expression engine not ready.");
    return runExpressionWithContext(expr, state.vars);
  });
  metaFns.get = defFn("get", 1, {
    args: [{ label: "name", kinds: ["string"] }],
    returns: { kinds: ["any"] },
  }, (name) => {
    const key = normalizeMetaName(name, "get");
    if (!Object.prototype.hasOwnProperty.call(state.vars, key)) throw new Error(`Unknown variable: ${key}`);
    return state.vars[key];
  });
  metaFns.has = defFn("has", 1, {
    args: [{ label: "name", kinds: ["string"] }],
    returns: { kinds: ["scalar"] },
  }, (name) => {
    const key = normalizeMetaName(name, "has");
    return Object.prototype.hasOwnProperty.call(state.vars, key) ? 1 : 0;
  });
  metaFns.set = defFn("set", 2, {
    args: [{ label: "name", kinds: ["string"] }, { label: "value", kinds: ["any"] }],
    returns: { kinds: ["any"] },
    effects: EFFECT.STATE,
  }, (name, value) => {
    const key = normalizeMetaName(name, "set");
    state.vars[key] = value;
    if (typeof state.onVarDefined === "function"){
      state.onVarDefined({ name: key, value, expr: "" });
    }
    return value;
  });
  metaFns.unset = defFn("unset", 1, {
    args: [{ label: "name", kinds: ["string"] }],
    returns: { kinds: ["scalar"] },
    effects: EFFECT.STATE,
  }, (name) => {
    const key = normalizeMetaName(name, "unset");
    const existed = Object.prototype.hasOwnProperty.call(state.vars, key);
    if (existed) delete state.vars[key];
    if (existed && typeof state.onVarRemoved === "function"){
      state.onVarRemoved(key);
    }
    return existed ? 1 : 0;
  });
  metaFns.vars = defFn("vars", 0, {
    returns: { kinds: ["string"] },
  }, () => Object.keys(state.vars).sort().join(", "));
  metaFns.methods = defFn("methods", 0, {
    returns: { kinds: ["string"] },
  }, () => Object.keys(state.userFns).sort().join(", "));
  metaFns.define = defFn("define", 3, {
    args: [
      { label: "name", kinds: ["string"] },
      { label: "params", kinds: ["string"] },
      { label: "expr", kinds: ["string"] },
    ],
    returns: { kinds: ["string"] },
    effects: EFFECT.STATE,
  }, (name, params, expr) => {
    const fnName = normalizeMetaName(name, "define");
    const paramList = normalizeMetaParams(params);
    if (typeof expr !== "string") throw new Error("define expects an expression string");
    defineUserFn(fnName, paramList, expr);
    return fnName;
  });
  metaFns.undefine = defFn("undefine", 1, {
    args: [{ label: "name", kinds: ["string"] }],
    returns: { kinds: ["scalar"] },
    effects: EFFECT.STATE,
  }, (name) => {
    const fnName = normalizeMetaName(name, "undefine");
    if (!Object.prototype.hasOwnProperty.call(state.userFns, fnName)) return 0;
    delete state.userFns[fnName];
    renderUserFunctions();
    if (typeof state.onFnRemoved === "function"){
      state.onFnRemoved(fnName);
    }
    return 1;
  });

  Object.assign(metaFns, gfxFns);

  function setRunExpressionWithContext(fn){
    runExpressionWithContext = fn;
  }

  return {
    getFns,
    defineUserFn,
    metaFns,
    setRunExpressionWithContext,
  };
}
