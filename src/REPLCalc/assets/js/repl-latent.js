import { splitStatements } from "./repl-parser.js";
import { unbox } from "./repl-values.js";

async function fetchText(url){
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok){
    throw new Error(`Failed to load ${url} (${res.status})`);
  }
  return await res.text();
}

export async function ensureLatentModuleLoaded({
  state,
  evaluator,
  frontend,
  runtime,
  runExpressionAll,
  solveEquation,
  createAssembly,
  defineUserFn,
  makeQty,
  recordSymbolDefinition,
  writeLine,
  url = "assets/est/latent-mux-walker.est",
}){
  if (state.__latentMuxWalkerLoaded) return;
  if (Object.prototype.hasOwnProperty.call(state.userFns || {}, "ltw_step")){
    state.__latentMuxWalkerLoaded = true;
    return;
  }

  const source = await fetchText(url);
  const statements = splitStatements(source);

  for (const stmt of statements){
    const parsed = frontend.evaluate(stmt);
    if (!parsed) continue;

    if (parsed.type === "cmd"){
      throw new Error("latent module may not contain commands");
    }

    if (parsed.type === "def"){
      defineUserFn(parsed.name, parsed.params, parsed.expr);
      continue;
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
      continue;
    }

    if (parsed.type === "assign"){
      const val = runExpressionAll(parsed.expr);
      state.vars[parsed.name] = val;
      recordSymbolDefinition({ name: parsed.name, kind: "var", expr: parsed.expr, value: val });
      continue;
    }

    if (parsed.type === "equation"){
      const solved = solveEquation(parsed.left, parsed.right);
      if (solved.unknown.unitToken){
        continue;
      }
      const solvedValue = solved.value;
      state.vars[solved.unknown.name] = solvedValue;
      recordSymbolDefinition({
        name: solved.unknown.name,
        kind: "var",
        expr: `${parsed.left} = ${parsed.right}`,
        value: solvedValue,
      });
      continue;
    }

    if (parsed.type === "expr"){
      runExpressionAll(parsed.expr);
      continue;
    }

    if (parsed.type === "if" || parsed.type === "for" || parsed.type === "repeat"){
      throw new Error("latent module may not contain flow statements");
    }
  }

  state.__latentMuxWalkerLoaded = true;
  if (typeof writeLine === "function") writeLine("Loaded latent mux walker.", "ok");
}

export async function runLatentCommand({
  arg,
  state,
  evaluator,
  frontend,
  runtime,
  runExpressionAll,
  solveEquation,
  createAssembly,
  defineUserFn,
  makeQty,
  recordSymbolDefinition,
  writeLine,
}){
  const a = String(arg || "").trim();

  if (!a){
    await runLatentCommand({
      arg: "test",
      state,
      evaluator,
      frontend,
      runtime,
      runExpressionAll,
      solveEquation,
      createAssembly,
      defineUserFn,
      makeQty,
      recordSymbolDefinition,
      writeLine,
    });
    return;
  }

  if (a === "load"){
    await ensureLatentModuleLoaded({
      state,
      evaluator,
      frontend,
      runtime,
      runExpressionAll,
      solveEquation,
      createAssembly,
      defineUserFn,
      makeQty,
      recordSymbolDefinition,
      writeLine,
    });
    if (typeof writeLine === "function") writeLine("Usage: :latent | :latent test", "muted");
    return;
  }

  if (a === "test"){
    await ensureLatentModuleLoaded({
      state,
      evaluator,
      frontend,
      runtime,
      runExpressionAll,
      solveEquation,
      createAssembly,
      defineUserFn,
      makeQty,
      recordSymbolDefinition,
      writeLine,
    });

    const csi = "03 30 00";
    const steps = 50;
    const s0 = 0;
    const tmpName = "__latent_tmp";
    const s1 = runExpressionAll(`ltw_seek_csi(${s0}, ${JSON.stringify(csi)}, ${steps})`);
    state.vars[tmpName] = s1;
    const s2 = runExpressionAll(`ltw_rewind_csi(${tmpName}, ${JSON.stringify(csi)}, ${steps})`);
    const s2u = unbox(s2);
    delete state.vars[tmpName];

    if (s2u === s0){
      if (typeof writeLine === "function") writeLine("latent test ok", "ok");
    }else{
      if (typeof writeLine === "function") writeLine(`latent test failed: expected ${s0}, got ${s2u}`, "err");
    }
    return;
  }

  throw new Error("latent usage: :latent | :latent test");
}
