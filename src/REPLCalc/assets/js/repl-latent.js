import { unbox } from "./repl-values.js";
import { EFFECT } from "./repl-effects.js";

async function fetchText(url){
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok){
    throw new Error(`Failed to load ${url} (${res.status})`);
  }
  return await res.text();
}

export async function ensureLatentModuleLoaded({
  state,
  executeProgram,
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
  const parsed = executeProgram(source, state.vars, "commit", {
    allowedEffects: EFFECT.ALL,
    allowCommands: false,
    wrapErrors: false,
    captureResults: true,
    commandErrorMessage: "latent module may not contain commands",
  });
  for (const record of parsed.results || []){
    if (record.type === "assy"){
      const name = record.changedSymbols?.[0];
      if (!name) continue;
      recordSymbolDefinition({
        name,
        kind: "assy",
        value: state.vars[name],
      });
    }else if (record.type === "assign"){
      const name = record.changedSymbols?.[0];
      if (!name) continue;
      recordSymbolDefinition({ name, kind: "var", expr: record.statement, value: state.vars[name] });
    }else if (record.type === "equation" && !record?.meta?.usedUnitToken){
      recordSymbolDefinition({
        name: record.meta.unknownName,
        kind: "var",
        expr: record.statement,
        value: state.vars[record.meta.unknownName],
      });
    }
  }

  state.__latentMuxWalkerLoaded = true;
  if (typeof writeLine === "function") writeLine("Loaded latent mux walker.", "ok");
}

export async function runLatentCommand({
  arg,
  state,
  executeProgram,
  recordSymbolDefinition,
  writeLine,
}){
  const a = String(arg || "").trim();

  if (!a){
    await runLatentCommand({
      arg: "test",
      state,
      executeProgram,
      recordSymbolDefinition,
      writeLine,
    });
    return;
  }

  if (a === "load"){
    await ensureLatentModuleLoaded({
      state,
      executeProgram,
      recordSymbolDefinition,
      writeLine,
    });
    if (typeof writeLine === "function") writeLine("Usage: :latent | :latent test", "muted");
    return;
  }

  if (a === "test"){
    await ensureLatentModuleLoaded({
      state,
      executeProgram,
      recordSymbolDefinition,
      writeLine,
    });

    const csi = "03 30 00";
    const steps = 50;
    const s0 = 0;
    const tmpName = "__latent_tmp";
    const s1 = executeProgram(`__latent_tmp = ltw_seek_csi(${s0}, ${JSON.stringify(csi)}, ${steps})`, state.vars, "commit", {
      allowedEffects: EFFECT.ALL,
      allowCommands: false,
      wrapErrors: false,
      captureResults: true,
    }).lastValue;
    state.vars[tmpName] = s1;
    const s2 = executeProgram(`ltw_rewind_csi(${tmpName}, ${JSON.stringify(csi)}, ${steps})`, state.vars, "commit", {
      allowedEffects: EFFECT.ALL,
      allowCommands: false,
      wrapErrors: false,
      captureResults: true,
    }).lastValue;
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
