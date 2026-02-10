import { EFFECT } from "./repl-effects.js";
import { isTruthy } from "./repl-expression.js";

export function createRuntime({ state, baseFns, defFn, defFnCtx, renderUserFunctions, parseParams, gfxFns }){
  let runExpressionWithContext = null;
  let runBlockBody = null;
  const callStack = [];
  const MAX_CALL_STACK_DEPTH = 2048;
  const MAX_BOUNDED_ITERATIONS = 100000;

  const metaFns = Object.create(null);

  function normalizeMetaName(value, label){
    if (typeof value !== "string") throw new Error(`${label} expects a string name`);
    const name = value.trim();
    if (!name) throw new Error(`${label} expects a non-empty name`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid name: ${name}`);
    return name;
  }

  function requireExpressionEngine(){
    if (!runExpressionWithContext) throw new Error("Expression engine not ready.");
    return runExpressionWithContext;
  }

  function toNonNegInt(value, label){
    const raw = (value && typeof value === "object" && typeof value.value === "number") ? value.value : Number(value);
    if (!Number.isFinite(raw)) throw new Error(`${label} must be a finite scalar`);
    if (raw < 0) return 0;
    return Math.floor(raw);
  }

  metaFns.repeat = defFnCtx("repeat", 3, {
    args: [
      { label: "n", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "state", kinds: ["any"] },
      { label: "step", kinds: ["string"] },
    ],
    returns: { kinds: ["any"] },
  }, (ctx, n, initState, stepExpr) => {
    const engine = requireExpressionEngine();
    const allowed = typeof ctx?.allowedEffects === "number" ? ctx.allowedEffects : EFFECT.PURE;
    const count = toNonNegInt(n, "repeat n");
    if (count > MAX_BOUNDED_ITERATIONS){
      throw new Error(`repeat(): exceeded ${MAX_BOUNDED_ITERATIONS} iterations`);
    }
    const baseVars = ctx && ctx.vars ? ctx.vars : state.vars;
    let cur = initState;
    for (let i = 0; i < count; i++){
      const scoped = Object.assign(Object.create(null), baseVars, { i, state: cur });
      cur = engine(stepExpr, scoped, { allowedEffects: allowed });
    }
    return cur;
  });

  function requireWitnessTag(value, label){
    if (typeof value !== "string") throw new Error(`${label} expects a string tag`);
    const tag = value.trim();
    if (!tag) throw new Error(`${label} expects a non-empty tag`);
    return tag;
  }

  function getWitnessStack(){
    if (!Array.isArray(state.witness)) state.witness = [];
    return state.witness;
  }

  function getWitnessLog(){
    if (!Array.isArray(state.witnessLog)) state.witnessLog = [];
    return state.witnessLog;
  }

  metaFns.witness_push = defFn("witness_push", 2, {
    args: [
      { label: "tag", kinds: ["string"] },
      { label: "payload", kinds: ["any"] },
    ],
    returns: { kinds: ["any"] },
    effects: EFFECT.STATE,
  }, (tag, payload) => {
    const t = requireWitnessTag(tag, "witness_push");
    getWitnessStack().push({ tag: t, payload });
    return payload;
  });

  metaFns.witness_pop = defFn("witness_pop", 1, {
    args: [{ label: "tag", kinds: ["string"] }],
    returns: { kinds: ["any"] },
    effects: EFFECT.STATE,
  }, (tag) => {
    const t = requireWitnessTag(tag, "witness_pop");
    const st = getWitnessStack();
    if (!st.length) throw new Error("witness_pop(): empty witness stack");
    const top = st[st.length - 1];
    if (!top || top.tag !== t) throw new Error(`witness_pop(): tag mismatch (expected ${t})`);
    st.pop();
    return top.payload;
  });

  metaFns.trace = defFn("trace", 2, {
    args: [
      { label: "value", kinds: ["any"] },
      { label: "tag", kinds: ["string"] },
    ],
    returns: { kinds: ["any"] },
    effects: EFFECT.STATE,
  }, (value, tag) => {
    const t = requireWitnessTag(tag, "trace");
    getWitnessLog().push({ tag: t, payload: value });
    return value;
  });

  metaFns.print = defFnCtx("print", -1, {
    args: [{ label: "value", kinds: ["any"] }],
    returns: { kinds: ["any"] },
    effects: EFFECT.IO_GFX,
  }, (ctx, ...args) => {
    const writeLine = typeof state.writeLine === "function" ? state.writeLine : null;
    if (!writeLine) throw new Error("print(): output sink unavailable");
    const fmt = typeof state.formatValueDisplay === "function"
      ? state.formatValueDisplay
      : (value) => ({ main: String(value), extra: "" });
    const parts = args.map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && value.__kind === "string") return value.value;
      const rendered = fmt(value);
      const main = rendered?.main ?? "";
      const extra = rendered?.extra ?? "";
      return extra ? `${main} ${extra}` : String(main);
    });
    writeLine(parts.join(" "), "out");
    if (!args.length) return 1;
    return args[args.length - 1];
  });

  metaFns.tok = defFn("tok", 2, {
    args: [
      { label: "text", kinds: ["string"] },
      { label: "className", kinds: ["string"] },
    ],
    returns: { kinds: ["any"] },
  }, (text, className) => {
    const t = (typeof text === "string") ? text
      : (text && typeof text === "object" && text.__kind === "string") ? text.value
      : String(text);
    const c = (typeof className === "string") ? className
      : (className && typeof className === "object" && className.__kind === "string") ? className.value
      : String(className);
    return { text: t, className: c };
  });

  metaFns.print_rich = defFnCtx("print_rich", -1, {
    args: [],
    returns: { kinds: ["any"] },
    effects: EFFECT.IO_GFX,
  }, (ctx, ...args) => {
    if (args.length !== 1 && args.length !== 2) throw new Error("print_rich(): expects (parts) or (parts, cls)");
    const writeLineRich = typeof state.writeLineRich === "function" ? state.writeLineRich : null;
    if (!writeLineRich) throw new Error("print_rich(): output sink unavailable");

    const partsVec = args[0];
    if (!partsVec || typeof partsVec !== "object" || !partsVec.__vec) throw new Error("print_rich(): parts must be a vec");

    const clsRaw = args.length === 2 ? args[1] : "out";
    const cls = (typeof clsRaw === "string") ? clsRaw
      : (clsRaw && typeof clsRaw === "object" && clsRaw.__kind === "string") ? clsRaw.value
      : String(clsRaw);

    const fmt = typeof state.formatValueDisplay === "function"
      ? state.formatValueDisplay
      : (value) => ({ main: String(value), extra: "" });

    const data = Array.isArray(partsVec.data) ? partsVec.data : [];
    const outParts = data.map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && value.__kind === "string") return value.value;

      const directText = value && typeof value === "object" ? value.text : null;
      const directClass = value && typeof value === "object" ? value.className : null;
      const text = (typeof directText === "string") ? directText
        : (directText && typeof directText === "object" && directText.__kind === "string") ? directText.value
        : null;
      const className = (typeof directClass === "string") ? directClass
        : (directClass && typeof directClass === "object" && directClass.__kind === "string") ? directClass.value
        : null;
      if (text !== null && className !== null) return { text, className };

      if (value && typeof value === "object" && value.__assy){
        const t0 = value.fields?.text?.value;
        const c0 = value.fields?.className?.value;
        const tt = (typeof t0 === "string") ? t0
          : (t0 && typeof t0 === "object" && t0.__kind === "string") ? t0.value
          : null;
        const cc = (typeof c0 === "string") ? c0
          : (c0 && typeof c0 === "object" && c0.__kind === "string") ? c0.value
          : null;
        if (tt !== null && cc !== null) return { text: tt, className: cc };
      }

      const rendered = fmt(value);
      const main = rendered?.main ?? "";
      const extra = rendered?.extra ?? "";
      return extra ? `${main} ${extra}` : String(main);
    });

    writeLineRich(outParts, cls);
    return partsVec;
  });

  metaFns.audit_add = metaFns.witness_push;
  metaFns.audit_take = metaFns.witness_pop;

  metaFns.while_budget = defFnCtx("while_budget", 4, {
    args: [
      { label: "budget", kinds: ["scalar", "dim"], dim: "scalar" },
      { label: "cond", kinds: ["string"] },
      { label: "state", kinds: ["any"] },
      { label: "step", kinds: ["string"] },
    ],
    returns: { kinds: ["any"] },
  }, (ctx, budget, condExpr, initState, stepExpr) => {
    const engine = requireExpressionEngine();
    const allowed = typeof ctx?.allowedEffects === "number" ? ctx.allowedEffects : EFFECT.PURE;
    const maxIter = toNonNegInt(budget, "while_budget budget");
    if (maxIter > MAX_BOUNDED_ITERATIONS){
      throw new Error(`while_budget(): exceeded ${MAX_BOUNDED_ITERATIONS} iterations`);
    }
    const baseVars = ctx && ctx.vars ? ctx.vars : state.vars;
    let cur = initState;
    for (let i = 0; i < maxIter; i++){
      const scoped = Object.assign(Object.create(null), baseVars, { i, state: cur });
      const condVal = engine(condExpr, scoped, { allowedEffects: allowed });
      if (!isTruthy(condVal)) break;
      cur = engine(stepExpr, scoped, { allowedEffects: allowed });
    }
    return cur;
  });

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
    const trimmedExpr = expr.trim();
    const isBraceBlock = trimmedExpr.startsWith("{") && trimmedExpr.endsWith("}");
    const defn = defFnCtx(name, params.length, (ctx, ...args) => {
      if (callStack.length >= MAX_CALL_STACK_DEPTH){
        throw new Error(`Max call depth exceeded (${MAX_CALL_STACK_DEPTH}).`);
      }
      if (callStack.includes(name)){
        const last = callStack[callStack.length - 1];
        if (last !== name){
          const cycle = [...callStack, name].join(" -> ");
          throw new Error(`Circular function call: ${cycle}`);
        }
      }
      callStack.push(name);
      const allowed = typeof ctx?.allowedEffects === "number" ? ctx.allowedEffects : EFFECT.PURE;
      if (isBraceBlock && runBlockBody){
        const keysBefore = new Set(Object.keys(state.vars));
        const saved = {};
        const had = {};
        params.forEach((param, idx) => {
          had[param] = Object.prototype.hasOwnProperty.call(state.vars, param);
          if (had[param]) saved[param] = state.vars[param];
          state.vars[param] = args[idx];
        });
        try{
          const body = trimmedExpr.slice(1, -1);
          const bodyResult = runBlockBody(body, { allowedEffects: allowed });
          if (bodyResult && typeof bodyResult === "object" && bodyResult.__assy){
            return bodyResult;
          }
          const newFields = Object.create(null);
          let fieldCount = 0;
          for (const k of Object.keys(state.vars)){
            if (!keysBefore.has(k) && !had[k]){
              newFields[k] = { value: state.vars[k] };
              fieldCount++;
            }
          }
          if (fieldCount > 0){
            return { __assy: true, name, fields: newFields };
          }
          return bodyResult;
        }finally{
          params.forEach((param) => {
            if (had[param]) state.vars[param] = saved[param];
            else delete state.vars[param];
          });
          const keysAfter = Object.keys(state.vars);
          for (const k of keysAfter){
            if (!keysBefore.has(k) && !had[k]){
              delete state.vars[k];
            }
          }
          callStack.pop();
        }
      }
      const scoped = Object.create(null);
      Object.assign(scoped, state.vars);
      params.forEach((param, idx) => {
        scoped[param] = args[idx];
      });
      if (!runExpressionWithContext){
        throw new Error("Expression engine not ready.");
      }
      try{
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
  metaFns.get = defFn("get", -1, {
    args: [],
    returns: { kinds: ["any"] },
  }, (...args) => {
    if (args.length === 1){
      const name = args[0];
      const key = normalizeMetaName(name, "get");
      if (!Object.prototype.hasOwnProperty.call(state.vars, key)) throw new Error(`Unknown variable: ${key}`);
      return state.vars[key];
    }
    if (args.length === 2){
      const [obj, fieldName] = args;
      if (!obj || typeof obj !== "object" || !obj.__assy) throw new Error("get(obj, field): obj must be an assembly");
      if (typeof fieldName !== "string") throw new Error("get(obj, field): field must be a string");
      const key = fieldName.trim();
      if (!key) throw new Error("get(obj, field): field must be non-empty");
      const entry = (obj.fields || {})[key];
      if (!entry) throw new Error(`Unknown assembly field: ${key}`);
      return entry.value;
    }
    throw new Error("get(): expects get(name) or get(obj, field)");
  });
  metaFns.has = defFn("has", 1, {
    args: [{ label: "name", kinds: ["string"] }],
    returns: { kinds: ["scalar"] },
  }, (name) => {
    const key = normalizeMetaName(name, "has");
    return Object.prototype.hasOwnProperty.call(state.vars, key) ? 1 : 0;
  });
  metaFns.set = defFn("set", -1, {
    args: [],
    returns: { kinds: ["any"] },
    effects: EFFECT.STATE,
  }, (...args) => {
    if (args.length === 2){
      const [name, value] = args;
      const key = normalizeMetaName(name, "set");
      state.vars[key] = value;
      if (typeof state.onVarDefined === "function"){
        state.onVarDefined({ name: key, value, expr: "" });
      }
      return value;
    }
    if (args.length === 3){
      const [obj, fieldName, value] = args;
      if (!obj || typeof obj !== "object" || !obj.__assy || obj.__vec || obj.__mat || obj.__range){
        throw new Error("set(obj, field, value): obj must be a record/assembly (not vec/mat/range)");
      }
      if (typeof fieldName !== "string") throw new Error("set(obj, field, value): field must be a string");
      const key = fieldName.trim();
      if (!key) throw new Error("set(obj, field, value): field must be non-empty");
      const prevFields = obj.fields || {};
      const nextFields = Object.assign(Object.create(null), prevFields);
      const prev = prevFields[key];
      nextFields[key] = prev ? Object.assign({}, prev, { value }) : { value, note: "", raw: "" };
      return Object.assign({}, obj, { fields: nextFields });
    }
    throw new Error("set(): expects set(name, value) or set(obj, field, value)");
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

  function setRunBlockBody(fn){
    runBlockBody = fn;
  }

  return {
    getFns,
    defineUserFn,
    metaFns,
    setRunExpressionWithContext,
    setRunBlockBody,
  };
}
