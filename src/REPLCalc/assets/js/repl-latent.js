import { unbox } from "./repl-values.js";
import { EFFECT } from "./repl-effects.js";
import {
  MODULE_REGISTRY,
  isModuleIdentityLoaded,
  markModuleIdentityLoaded,
} from "./repl-module-registry.js";

const LATENT_MODULE = MODULE_REGISTRY.latentMuxWalker;

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
  moduleMeta = LATENT_MODULE,
}){
  if (isModuleIdentityLoaded(state, moduleMeta)) return false;
  if (Object.prototype.hasOwnProperty.call(state.userFns || {}, "ltw_step")){
    markModuleIdentityLoaded(state, moduleMeta);
    return false;
  }

  const source = await fetchText(moduleMeta.path);
  const parsed = executeProgram(source, state.vars, "commit", {
    allowedEffects: EFFECT.ALL,
    allowCommands: false,
    wrapErrors: false,
    captureResults: true,
    commandErrorMessage: `${moduleMeta.label} module may not contain commands`,
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

  markModuleIdentityLoaded(state, moduleMeta);
  if (typeof writeLine === "function") writeLine("Loaded latent mux walker.", "ok");
  return true;
}

function runLatentSelfBenchmark({ state, executeProgram, writeLine }){
  const csi = "03 30 00";
  const benchmarkBudget = {
    rounds: 8,
    steps: 16,
  };
  const tmpName = "__latent_tmp";
  let passes = 0;

  for (let round = 0; round < benchmarkBudget.rounds; round += 1){
    const seed = round;
    const s1 = executeProgram(`${tmpName} = ltw_seek_csi(${seed}, ${JSON.stringify(csi)}, ${benchmarkBudget.steps})`, state.vars, "commit", {
      allowedEffects: EFFECT.ALL,
      allowCommands: false,
      wrapErrors: false,
      captureResults: false,
    }).lastValue;
    state.vars[tmpName] = s1;
    const s2 = executeProgram(`ltw_rewind_csi(${tmpName}, ${JSON.stringify(csi)}, ${benchmarkBudget.steps})`, state.vars, "commit", {
      allowedEffects: EFFECT.ALL,
      allowCommands: false,
      wrapErrors: false,
      captureResults: false,
    }).lastValue;
    const s2u = unbox(s2);
    if (s2u === seed) passes += 1;
  }

  delete state.vars[tmpName];
  if (passes === benchmarkBudget.rounds){
    if (typeof writeLine === "function") writeLine(`latent bench ok (${passes}/${benchmarkBudget.rounds})`, "ok");
  }else if (typeof writeLine === "function"){
    writeLine(`latent bench failed (${passes}/${benchmarkBudget.rounds})`, "err");
  }
}

export async function runLatentCommand({
  arg,
  state,
  executeProgram,
  recordSymbolDefinition,
  writeLine,
}){
  const a = String(arg || "").trim().toLowerCase();

  if (!a || a === "load"){
    const loaded = await ensureLatentModuleLoaded({
      state,
      executeProgram,
      recordSymbolDefinition,
      writeLine,
    });
    if (!loaded && typeof writeLine === "function") writeLine("Latent mux walker already loaded; reusing cached module identity.", "muted");
    return;
  }

  if (a === "test" || a === "bench"){
    await ensureLatentModuleLoaded({
      state,
      executeProgram,
      recordSymbolDefinition,
      writeLine,
    });
    runLatentSelfBenchmark({ state, executeProgram, writeLine });
    return;
  }

  throw new Error("latent usage: :latent | :latent load | :latent bench");
}
