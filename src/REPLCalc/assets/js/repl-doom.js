const DOOM_CONFIG = {
  width: 96,
  height: 54,
  scale: 6,
  fps: 30,
};

const DOOM_SCRIPT = `
cls();
bg("transparent");

# NOTE: Keep in sync with DOOM_CONFIG above.
w = 96;
h = 54;
hud = 10;
view = h - hud;
mid = floor(view / 2);
roll = sin(time * 0.8) * 2;

fill(0, 0, w, mid + roll, "muted");
fill(0, mid + roll, w, view - (mid + roll), "text");

for x in 0..(w - 1):
  ray = (x / w) * 3.1416 - 1.5708;
  wobble = sin(time * 0.9 + x * 0.12);
  dist = 3 + 1.6 * (1 + wobble);
  slice = clamp(floor(view / dist), 1, view);
  y0 = floor((view - slice) / 2 + roll);
  y1 = y0 + slice;
  shade = if(dist < 4, "accent", "accent-2");
  line(x, y0, x, y1, shade);

cx = floor(w / 2);
cy = floor(view / 2 + roll);
line(cx - 3, cy, cx + 3, cy, "ok");
line(cx, cy - 3, cx, cy + 3, "ok");

fill(0, view, w, hud, "transparent");
rect(1, view + 1, w - 2, hud - 2, "muted");
hp = clamp(0.65 + 0.35 * sin(time * 0.5), 0, 1);
ammo = clamp(0.45 + 0.45 * sin(time * 0.7 + 1.4), 0, 1);
barW = floor((w - 6) * hp);
fill(3, view + 3, barW, 3, "ok");
ammoW = floor((w - 6) * ammo);
fill(3, view + 7, ammoW, 2, "warn");
`;

let doomController = null;

function createDoomController({ gfx, writeLine }){
  function setDeps(nextGfx, nextWriteLine){
    gfx = nextGfx;
    writeLine = nextWriteLine;
  }

  function start({ fps } = {}){
    gfx.initBuffer(DOOM_CONFIG.width, DOOM_CONFIG.height, DOOM_CONFIG.scale);
    gfx.configureLoop(DOOM_SCRIPT, Number.isFinite(fps) ? fps : DOOM_CONFIG.fps);
    gfx.playLoop();
    writeLine("Doom estimate running. Space toggles play/pause, arrows step/fps.", "ok");
  }

  function stop(){
    const status = gfx.getLoopStatus();
    if (!status.active){
      writeLine("Doom estimate is not running.", "warn");
      return;
    }
    gfx.pauseLoop();
    gfx.resetLoop();
    writeLine("Doom estimate stopped.", "warn");
  }

  function setFps(value){
    if (!Number.isFinite(value)){
      writeLine("doom.fps expects a number.", "warn");
      return;
    }
    gfx.setLoopFps(value);
    const status = gfx.getLoopStatus();
    writeLine(`Doom estimate fps set to ${status.fps}.`, "ok");
  }

  function printState(){
    const status = gfx.getLoopStatus();
    if (!status.active){
      writeLine("Doom estimate is not running.", "warn");
      return;
    }
    writeLine(
      `Doom estimate ${status.playing ? "playing" : "paused"} @ ${status.fps} fps • frame ${status.frame}.`,
      "ok"
    );
  }

  function handleCommand(commandLine){
    const trimmed = commandLine.trim();
    if (!trimmed.toLowerCase().startsWith("doom.")) return false;
    const parts = trimmed.split(/\s+/);
    const cmdToken = parts.shift();
    const cmd = cmdToken.split(".")[1]?.toLowerCase() || "";
    const argLine = parts.join(" ");

    if (cmd === "start" || cmd === "run"){
      const fpsMatch = argLine.match(/--fps\s+(\d+)/i);
      const fps = fpsMatch ? Number(fpsMatch[1]) : undefined;
      start({ fps });
      return true;
    }
    if (cmd === "stop"){
      stop();
      return true;
    }
    if (cmd === "state"){
      printState();
      return true;
    }
    if (cmd === "fps"){
      const fps = Number(parts[0]);
      setFps(fps);
      return true;
    }

    writeLine(`Unknown doom command: ${cmdToken}`, "warn");
    return true;
  }

  return {
    setDeps,
    start,
    stop,
    setFps,
    printState,
    handleCommand,
  };
}

export function getDoomController({ gfx, writeLine }){
  if (!doomController){
    doomController = createDoomController({ gfx, writeLine });
  }else{
    doomController.setDeps(gfx, writeLine);
  }
  return doomController;
}

export function runDoomDemo({ gfx, writeLine, writeInputEcho }){
  if (typeof writeLine === "function"){
    writeLine("Running doom demo script:", "muted");
  }
  if (typeof writeInputEcho === "function"){
    DOOM_SCRIPT.trim().split("\n").forEach((line) => writeInputEcho(line));
  }else if (typeof writeLine === "function"){
    DOOM_SCRIPT.trim().split("\n").forEach((line) => writeLine(line, "muted"));
  }
  const controller = getDoomController({ gfx, writeLine });
  controller.start();
}

export function handleDoomInput(line, { gfx, writeLine }){
  if (!line.trim().toLowerCase().startsWith("doom.")) return false;
  const controller = getDoomController({ gfx, writeLine });
  return controller.handleCommand(line);
}
