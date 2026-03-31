import { EFFECT } from "./repl-effects.js";

const DOOM_W = 256;
const DOOM_H = 144;
const DOOM_SCALE = 3;
const DOOM_DEFAULT_FPS = 18;

async function fetchText(url){
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok){
    throw new Error(`Failed to load ${url} (${res.status})`);
  }
  return await res.text();
}

async function ensureDoomModulesLoaded({ state, executeProgram, writeLine }){
  const DOOM_MODULES_VERSION = 5;
  if (state.__doomModulesLoaded && state.__doomModulesVersion === DOOM_MODULES_VERSION){
    state.__doomModulesLoaded = true;
    return;
  }
  const hasFn = (name) => Object.prototype.hasOwnProperty.call(state.userFns || {}, name);
  if (hasFn("get_texel") && hasFn("render_3d_view") && hasFn("analyze_map_tiles") && hasFn("update_monster_ai")){
    state.__doomModulesVersion = DOOM_MODULES_VERSION;
    state.__doomModulesLoaded = true;
    return;
  }

  const applyModuleSource = (source, label) => executeProgram(source, state.vars, "commit", {
    allowedEffects: EFFECT.ALL,
    allowCommands: false,
    wrapErrors: false,
    captureResults: false,
    commandErrorMessage: `${label} may not contain commands`,
  });

  const ltwSource = await fetchText("assets/est/math/latent-mux-walker.est");
  applyModuleSource(ltwSource, "latent mux walker");

  const constantsSource = await fetchText("assets/est/core/constants.est");
  applyModuleSource(constantsSource, "constants");

  const mathSource = await fetchText("assets/est/math/math-helpers.est");
  applyModuleSource(mathSource, "math helpers");

  const geometrySource = await fetchText("assets/est/geometry/geometry-helpers.est");
  applyModuleSource(geometrySource, "geometry helpers");

  const playerSource = await fetchText("assets/est/systems/player-system.est");
  applyModuleSource(playerSource, "player system");

  const combatSource = await fetchText("assets/est/systems/combat-system.est");
  applyModuleSource(combatSource, "combat system");

  const monsterSource = await fetchText("assets/est/systems/monster-system.est");
  applyModuleSource(monsterSource, "monster system");

  const metricsSource = await fetchText("assets/est/systems/metrics-system.est");
  applyModuleSource(metricsSource, "metrics system");

  const textureHelpersSource = await fetchText("assets/est/textures/texture-helpers.est");
  applyModuleSource(textureHelpersSource, "texture helpers");

  const doomTexturesSource = await fetchText("assets/est/textures/doom-textures.est");
  applyModuleSource(doomTexturesSource, "doom textures");

  const renderingHelpersSource = await fetchText("assets/est/textures/rendering-helpers.est");
  applyModuleSource(renderingHelpersSource, "rendering helpers");

  const procSource = await fetchText("assets/est/textures/doom-proc-textures.est");
  applyModuleSource(procSource, "doom proc textures");

  state.__doomModulesVersion = DOOM_MODULES_VERSION;
  state.__doomModulesLoaded = true;
  if (typeof writeLine === "function"){
    writeLine("Loaded Doom modules: math, geometry, systems, textures (using runtime traversal built-ins)", "ok");
  }
}

async function loadDoomDemoScript(){
  return await fetchText("assets/est/systems/doom-demo.est");
}

export async function runDoomDemo({ gfx, writeLine, writeInputEcho, state, executeProgram }) {
  writeLine("Doom level - playable EST DSL raycaster", "muted");
  writeLine("Click the canvas to capture the mouse.", "muted");
  writeLine("Controls: Mouse look • WASD move/strafe • Shift run • Space use • LMB shoot • E view • Q panel • F upgrade", "muted");
  writeLine("Loop UI: P play/pause (when mouse not captured) • Arrows step/fps • R reset", "muted");

  if (!state || typeof executeProgram !== "function"){
    throw new Error("runDoomDemo requires state/executeProgram (update caller to pass these)");
  }

  await ensureDoomModulesLoaded({ state, executeProgram, writeLine });
  const script = await loadDoomDemoScript();

  if (typeof gfx.setActiveBackend === "function"){
    try{
      // Prefer the 2D backend for :doom to avoid GPU/driver WebGL instability.
      gfx.setActiveBackend("2d");
    }catch{}
  }

  const status = typeof gfx.getLoopStatus === "function" ? gfx.getLoopStatus() : null;
  if (status?.playing && typeof gfx.pauseLoop === "function"){
    gfx.pauseLoop();
  }

  const buf = typeof gfx.getBuffer === "function" ? gfx.getBuffer() : null;
  const needsBuffer = !buf || buf.width !== DOOM_W || buf.height !== DOOM_H || buf.scale !== DOOM_SCALE;
  if (needsBuffer && typeof gfx.initBuffer === "function"){
    gfx.initBuffer(DOOM_W, DOOM_H, DOOM_SCALE);
  }

  const buf2 = typeof gfx.getBuffer === "function" ? gfx.getBuffer() : null;
  if (buf2 && buf2.__gfx){
    buf2.presentLocked = true;
    buf2.presentWidth = DOOM_W;
    buf2.presentHeight = DOOM_H;
    buf2.presentScale = DOOM_SCALE;
  }

  gfx.configureLoop(script, DOOM_DEFAULT_FPS);
  gfx.playLoop();
}
