const DOOM_TICK_RATE = 35;
const DOOM_RENDER_FPS = 60;
const DOOM_VIEW_WIDTH = 96;
const DOOM_VIEW_HEIGHT = 54;
const DOOM_HUD_HEIGHT = 12;
const DOOM_FOV = Math.PI / 3;
const DOOM_MAX_DIST = 20;

const COLOR = {
  wallNear: "accent",
  wallFar: "muted",
  door: "accent-2",
  floor: "text",
  ceiling: "muted",
  player: "ok",
  enemy: "err",
  pickup: "ok",
  projectile: "warn",
  mapWall: "accent",
  mapFloor: "muted",
  mapDoor: "accent-2",
  mapPlayer: "ok",
  mapEnemy: "err",
  hud: "text",
  message: "ok",
};

const FONT_3X5 = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "A": ["010", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["011", "100", "100", "100", "011"],
  "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"],
  "F": ["111", "100", "110", "100", "100"],
  "G": ["011", "100", "101", "101", "011"],
  "H": ["101", "101", "111", "101", "101"],
  "I": ["111", "010", "010", "010", "111"],
  "J": ["001", "001", "001", "101", "010"],
  "K": ["101", "101", "110", "101", "101"],
  "L": ["100", "100", "100", "100", "111"],
  "M": ["101", "111", "111", "101", "101"],
  "N": ["101", "111", "111", "111", "101"],
  "O": ["111", "101", "101", "101", "111"],
  "P": ["111", "101", "111", "100", "100"],
  "Q": ["111", "101", "101", "111", "001"],
  "R": ["111", "101", "111", "110", "101"],
  "S": ["011", "100", "111", "001", "110"],
  "T": ["111", "010", "010", "010", "010"],
  "U": ["101", "101", "101", "101", "111"],
  "V": ["101", "101", "101", "101", "010"],
  "W": ["101", "101", "111", "111", "101"],
  "X": ["101", "101", "010", "101", "101"],
  "Y": ["101", "101", "010", "010", "010"],
  "Z": ["111", "001", "010", "100", "111"],
  ":": ["000", "010", "000", "010", "000"],
  "/": ["001", "001", "010", "100", "100"],
  "-": ["000", "000", "111", "000", "000"],
  "+": ["000", "010", "111", "010", "000"],
  ".": ["000", "000", "000", "000", "010"],
  " ": ["000", "000", "000", "000", "000"],
};

const MAP_LAYOUT = [
  "########################",
  "#S..#.....#............#",
  "#...#..Z..#..I.........#",
  "#...#.....#....M.......#",
  "#...###D###....###.....#",
  "#.......#..R...#..A....#",
  "#####.#.#.####.#.#######",
  "#.....#.#....#.#.......#",
  "#.###.#.####.#.###.###.#",
  "#.#...#..Z.#.#...#.....#",
  "#.#.######.#.###.#.###.#",
  "#...#....#.#.#...#.....#",
  "###.#.##.#.#.#.###.###.#",
  "#...#..#.#...#...#.....#",
  "#.#####.#.###.#.#B#....#",
  "#.....#.#.....#.#..E...#",
  "#.###.#.#######.#.###..#",
  "#...#.#.....K...#......#",
  "#...#.#.#######.#.###..#",
  "#...#.#..P..W...#..F...#",
  "########################",
];

const ENEMY_STATS = {
  zombie: { health: 20, speed: 0.6, attackRange: 4.5, cooldown: 1.2 },
  imp: { health: 35, speed: 0.5, attackRange: 6.5, cooldown: 1.6 },
};

const WEAPONS = [
  { key: "pistol", ammo: 0, cooldown: 0.35, pellets: 1, spread: 0.02, damage: [6, 14] },
  { key: "shotgun", ammo: 1, cooldown: 0.9, pellets: 7, spread: 0.18, damage: [4, 10] },
];

let doomController = null;

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle){
  let out = angle;
  while (out < -Math.PI) out += Math.PI * 2;
  while (out > Math.PI) out -= Math.PI * 2;
  return out;
}

function createRng(seed){
  let state = seed >>> 0;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    getState: () => state >>> 0,
    setState: (value) => { state = value >>> 0; },
  };
}

function createDoomController({ gfx, writeLine }){
  let game = null;

  function setDeps(nextGfx, nextWriteLine){
    gfx = nextGfx;
    writeLine = nextWriteLine;
    if (game){
      game.updateDependencies({ gfx, writeLine });
    }
  }

  function ensureGame(seed){
    if (game){
      if (seed !== undefined){
        game.reset(seed);
      }
      return game;
    }
    game = new DoomGame({ gfx, writeLine, seed });
    return game;
  }

  function start(seed){
    const instance = ensureGame(seed);
    instance.start();
  }

  function stop(){
    if (game){
      game.stop();
    }
  }

  function save(name){
    const instance = ensureGame();
    instance.save(name);
  }

  function load(name){
    const instance = ensureGame();
    instance.load(name);
  }

  function printState(){
    if (!game){
      writeLine("Doom demo is not running.", "warn");
      return;
    }
    const summary = game.getSummary();
    writeLine(summary, "ok");
  }

  function spawn(enemy, x, y){
    const instance = ensureGame();
    instance.spawnEnemy(enemy, x, y);
  }

  function toggleGod(){
    const instance = ensureGame();
    instance.toggleGod();
  }

  function toggleNoclip(){
    const instance = ensureGame();
    instance.toggleNoclip();
  }

  function handleCommand(commandLine){
    const trimmed = commandLine.trim();
    if (!trimmed.toLowerCase().startsWith("doom.")) return false;
    const parts = trimmed.split(/\s+/);
    const cmdToken = parts.shift();
    const cmd = cmdToken.split(".")[1]?.toLowerCase() || "";
    const argLine = parts.join(" ");

    if (cmd === "start"){
      start();
      return true;
    }
    if (cmd === "run"){
      const seedMatch = argLine.match(/--seed\s+(\d+)/i);
      const seed = seedMatch ? Number(seedMatch[1]) : undefined;
      start(seed);
      return true;
    }
    if (cmd === "replay"){
      const seed = Number(parts[0]);
      start(Number.isFinite(seed) ? seed : undefined);
      return true;
    }
    if (cmd === "stop"){
      stop();
      return true;
    }
    if (cmd === "save"){
      save(argLine);
      return true;
    }
    if (cmd === "load"){
      load(argLine);
      return true;
    }
    if (cmd === "state"){
      printState();
      return true;
    }
    if (cmd === "spawn"){
      const enemy = parts[0];
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      spawn(enemy, x, y);
      return true;
    }
    if (cmd === "god"){
      toggleGod();
      return true;
    }
    if (cmd === "noclip"){
      toggleNoclip();
      return true;
    }

    writeLine(`Unknown doom command: ${cmdToken}`, "warn");
    return true;
  }

  return {
    setDeps,
    start,
    stop,
    save,
    load,
    printState,
    spawn,
    toggleGod,
    toggleNoclip,
    handleCommand,
  };
}

class DoomGame {
  constructor({ gfx, writeLine, seed }){
    this.gfx = gfx;
    this.writeLine = writeLine;
    this.seed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 100000);
    this.rng = createRng(this.seed);
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.lastRender = 0;
    this.loopId = null;
    this.keyState = new Set();
    this.pendingUse = false;
    this.pendingFire = false;
    this.pendingMapToggle = false;
    this.pendingWeapon = null;
    this.godMode = false;
    this.noclip = false;
    this.automap = false;
    this.message = { text: "", timer: 0 };
    this.tickCount = 0;
    this.map = this.buildMap();
    this.player = this.createPlayer();
    this.projectiles = [];
    this.depthBuffer = new Array(DOOM_VIEW_WIDTH).fill(DOOM_MAX_DIST);

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  updateDependencies({ gfx, writeLine }){
    this.gfx = gfx;
    this.writeLine = writeLine;
  }

  reset(seed){
    if (Number.isFinite(seed)){
      this.seed = seed;
    }
    this.rng = createRng(this.seed);
    this.map = this.buildMap();
    this.player = this.createPlayer();
    this.projectiles = [];
    this.message = { text: "", timer: 0 };
    this.tickCount = 0;
    this.godMode = false;
    this.noclip = false;
    this.automap = false;
    this.writeLine(`Doom replay seed set to ${this.seed}.`, "ok");
  }

  buildMap(){
    const grid = MAP_LAYOUT.map((row) => row.split(""));
    const doors = [];
    const pickups = [];
    const enemies = [];
    let start = { x: 1.5, y: 1.5 };

    for (let y = 0; y < grid.length; y++){
      for (let x = 0; x < grid[y].length; x++){
        const cell = grid[y][x];
        if (cell === "S"){
          start = { x: x + 0.5, y: y + 0.5 };
          grid[y][x] = ".";
        }
        if (cell === "D" || cell === "B"){
          doors.push({
            id: `${x},${y}`,
            x,
            y,
            open: 0,
            opening: false,
            closing: false,
            locked: cell === "B" ? "blue" : null,
            autoClose: cell === "D",
            timer: 0,
          });
          grid[y][x] = "D";
        }
        if (cell === "K"){
          pickups.push({ type: "key", key: "blue", x: x + 0.5, y: y + 0.5, taken: false });
          grid[y][x] = ".";
        }
        if (cell === "W"){
          pickups.push({ type: "weapon", weapon: "shotgun", x: x + 0.5, y: y + 0.5, taken: false });
          grid[y][x] = ".";
        }
        if (cell === "A"){
          pickups.push({ type: "armor", amount: 25, x: x + 0.5, y: y + 0.5, taken: false });
          grid[y][x] = ".";
        }
        if (cell === "R"){
          pickups.push({ type: "ammo", amount: 10, x: x + 0.5, y: y + 0.5, taken: false });
          grid[y][x] = ".";
        }
        if (cell === "M"){
          pickups.push({ type: "health", amount: 20, x: x + 0.5, y: y + 0.5, taken: false });
          grid[y][x] = ".";
        }
        if (cell === "Z"){
          enemies.push(this.createEnemy("zombie", x + 0.5, y + 0.5));
          grid[y][x] = ".";
        }
        if (cell === "I"){
          enemies.push(this.createEnemy("imp", x + 0.5, y + 0.5));
          grid[y][x] = ".";
        }
        if (cell === "E"){
          grid[y][x] = "E";
        }
      }
    }

    return { grid, doors, pickups, enemies, start };
  }

  createPlayer(){
    const start = this.map.start;
    return {
      x: start.x,
      y: start.y,
      angle: 0,
      health: 100,
      armor: 0,
      ammo: 50,
      weapon: 0,
      hasShotgun: false,
      keys: { blue: false },
      fireCooldown: 0,
      useCooldown: 0,
    };
  }

  createEnemy(type, x, y){
    const stats = ENEMY_STATS[type];
    return {
      id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      x,
      y,
      health: stats.health,
      state: "idle",
      timer: 0,
      cooldown: 0,
    };
  }

  start(){
    if (this.running) return;
    this.running = true;
    this.gfx.initBuffer(DOOM_VIEW_WIDTH, DOOM_VIEW_HEIGHT, 6);
    this.focusCanvas();
    this.installInput();
    this.writeLine(
      "Doom Test running. W/A/S/D to move, arrows/QE to turn, Space/E to use, F/Ctrl to fire, Tab for map, Esc to exit.",
      "ok"
    );
    this.lastTime = performance.now();
    this.lastRender = this.lastTime;
    this.loopId = window.requestAnimationFrame((t) => this.loop(t));
  }

  stop(){
    if (!this.running) return;
    this.running = false;
    if (this.loopId){
      window.cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }
    this.removeInput();
    this.writeLine("Doom demo stopped.", "warn");
  }

  focusCanvas(){
    const canvas = this.gfx.getCanvas();
    if (canvas){
      canvas.focus();
    }
  }

  installInput(){
    const canvas = this.gfx.getCanvas();
    if (canvas){
      canvas.addEventListener("keydown", this.handleKeyDown);
      canvas.addEventListener("keyup", this.handleKeyUp);
    }
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  removeInput(){
    const canvas = this.gfx.getCanvas();
    if (canvas){
      canvas.removeEventListener("keydown", this.handleKeyDown);
      canvas.removeEventListener("keyup", this.handleKeyUp);
    }
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  handleKeyDown(event){
    if (!this.running) return;
    const key = event.key.toLowerCase();
    const code = event.code;
    const isRepeat = event.repeat;
    const isGameKey =
      ["w", "a", "s", "d", "q", "e", " ", "tab", "escape", "f"].includes(key) ||
      ["arrowleft", "arrowright"].includes(key) ||
      code.startsWith("Digit") ||
      ["BracketLeft", "BracketRight", "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight"].includes(code);

    if (isGameKey) event.preventDefault();

    if (!isRepeat && key === " ") this.pendingUse = true;
    if (!isRepeat && key === "e") this.pendingUse = true;
    if (!isRepeat && key === "tab") this.pendingMapToggle = true;
    if (!isRepeat && key === "escape") this.stop();
    if (!isRepeat && key === "f") this.pendingFire = true;
    if (!isRepeat && key === "control") this.pendingFire = true;

    if (!isRepeat && code.startsWith("Digit")){
      const digit = Number(code.replace("Digit", ""));
      if (digit >= 1 && digit <= 7){
        this.pendingWeapon = digit - 1;
      }
    }
    if (!isRepeat && code === "BracketLeft") this.pendingWeapon = (this.player.weapon + WEAPONS.length - 1) % WEAPONS.length;
    if (!isRepeat && code === "BracketRight") this.pendingWeapon = (this.player.weapon + 1) % WEAPONS.length;

    this.keyState.add(key);
    this.keyState.add(code);
  }

  handleKeyUp(event){
    const key = event.key.toLowerCase();
    this.keyState.delete(key);
    this.keyState.delete(event.code);
  }

  loop(timestamp){
    if (!this.running) return;
    const delta = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    this.accumulator += delta;

    const step = 1 / DOOM_TICK_RATE;
    while (this.accumulator >= step){
      this.tick(step);
      this.accumulator -= step;
    }

    if (timestamp - this.lastRender >= 1000 / DOOM_RENDER_FPS){
      this.render();
      this.lastRender = timestamp;
    }

    this.loopId = window.requestAnimationFrame((t) => this.loop(t));
  }

  tick(dt){
    this.tickCount += 1;
    const player = this.player;

    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.useCooldown = Math.max(0, player.useCooldown - dt);

    const speedBase = this.keyState.has("ShiftLeft") || this.keyState.has("ShiftRight") ? 2.4 : 1.6;
    let forward = 0;
    let strafe = 0;
    let turn = 0;

    if (this.keyState.has("w")) forward += 1;
    if (this.keyState.has("s")) forward -= 1;
    if (this.keyState.has("a")) strafe -= 1;
    if (this.keyState.has("d")) strafe += 1;
    if (this.keyState.has("arrowleft") || this.keyState.has("q")) turn -= 1;
    if (this.keyState.has("arrowright") || this.keyState.has("e")) turn += 1;

    player.angle = normalizeAngle(player.angle + turn * dt * 2.4);

    const moveX = Math.cos(player.angle) * forward + Math.cos(player.angle + Math.PI / 2) * strafe;
    const moveY = Math.sin(player.angle) * forward + Math.sin(player.angle + Math.PI / 2) * strafe;

    this.tryMove(player, moveX * dt * speedBase, moveY * dt * speedBase);

    if (this.pendingUse && player.useCooldown <= 0){
      this.pendingUse = false;
      player.useCooldown = 0.2;
      this.handleUse();
    }

    if (this.pendingMapToggle){
      this.pendingMapToggle = false;
      this.automap = !this.automap;
      this.pushMessage(this.automap ? "Automap enabled" : "Automap disabled");
    }

    if (this.pendingWeapon !== null){
      this.selectWeapon(this.pendingWeapon);
      this.pendingWeapon = null;
    }

    if (this.pendingFire || this.keyState.has("control") || this.keyState.has("f")){
      if (player.fireCooldown <= 0){
        this.pendingFire = false;
        this.fireWeapon();
      }
    }

    this.updateDoors(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups();
    this.updateMessage(dt);
  }

  updateMessage(dt){
    if (this.message.timer > 0){
      this.message.timer = Math.max(0, this.message.timer - dt);
      if (this.message.timer === 0){
        this.message.text = "";
      }
    }
  }

  pushMessage(text){
    this.message.text = text;
    this.message.timer = 3.5;
  }

  selectWeapon(idx){
    const weapon = WEAPONS[idx];
    if (!weapon) return;
    if (weapon.key === "shotgun" && !this.player.hasShotgun){
      this.pushMessage("Need shotgun first");
      return;
    }
    this.player.weapon = idx;
    this.pushMessage(`Switched to ${weapon.key}`);
  }

  tryMove(entity, dx, dy){
    if (this.noclip){
      entity.x += dx;
      entity.y += dy;
      return;
    }
    const nextX = entity.x + dx;
    const nextY = entity.y + dy;
    if (!this.isBlocked(nextX, entity.y)){
      entity.x = nextX;
    }
    if (!this.isBlocked(entity.x, nextY)){
      entity.y = nextY;
    }
  }

  isBlocked(x, y){
    const cell = this.getCell(x, y);
    if (cell === "#" || cell === "P" || cell === "F") return true;
    if (cell === "D"){
      const door = this.getDoorAt(Math.floor(x), Math.floor(y));
      return door ? door.open < 0.9 : true;
    }
    return false;
  }

  getCell(x, y){
    const grid = this.map.grid;
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    if (!grid[gy] || grid[gy][gx] === undefined) return "#";
    return grid[gy][gx];
  }

  getDoorAt(x, y){
    return this.map.doors.find((door) => door.x === x && door.y === y) || null;
  }

  updateDoors(dt){
    for (const door of this.map.doors){
      if (door.opening){
        door.open = clamp(door.open + dt * 1.4, 0, 1);
        if (door.open >= 1){
          door.opening = false;
          door.timer = door.autoClose ? 2.5 : 0;
        }
      }
      if (door.timer > 0){
        door.timer -= dt;
        if (door.timer <= 0){
          door.closing = true;
        }
      }
      if (door.closing){
        door.open = clamp(door.open - dt * 1.2, 0, 1);
        if (door.open <= 0){
          door.closing = false;
        }
      }
    }
  }

  handleUse(){
    const player = this.player;
    const targetX = player.x + Math.cos(player.angle) * 0.8;
    const targetY = player.y + Math.sin(player.angle) * 0.8;
    const gx = Math.floor(targetX);
    const gy = Math.floor(targetY);
    const cell = this.map.grid[gy]?.[gx];

    if (cell === "D"){
      const door = this.getDoorAt(gx, gy);
      if (!door) return;
      if (door.locked === "blue" && !player.keys.blue){
        this.pushMessage("Blue key required");
        return;
      }
      door.opening = true;
      door.closing = false;
      this.pushMessage("Door opening");
      return;
    }

    if (cell === "P"){
      this.map.grid[gy][gx] = ".";
      this.pushMessage("You found a secret pushwall!");
      return;
    }

    if (cell === "F"){
      this.map.grid[gy][gx] = ".";
      this.map.pickups.push({ type: "health", amount: 25, x: gx + 0.5, y: gy + 0.5, taken: false, secret: true });
      this.pushMessage("A hidden stash is revealed!");
      return;
    }

    if (cell === "E"){
      this.stop();
      this.writeLine("Exit switch activated. Demo complete!", "ok");
    }
  }

  updatePickups(){
    const player = this.player;
    for (const pickup of this.map.pickups){
      if (pickup.taken) continue;
      const dx = pickup.x - player.x;
      const dy = pickup.y - player.y;
      if (Math.hypot(dx, dy) < 0.6){
        pickup.taken = true;
        if (pickup.type === "ammo"){
          player.ammo += pickup.amount;
          this.pushMessage("Picked up ammo");
        }
        if (pickup.type === "health"){
          player.health = clamp(player.health + pickup.amount, 0, 100);
          this.pushMessage("Picked up a medkit");
        }
        if (pickup.type === "armor"){
          player.armor = clamp(player.armor + pickup.amount, 0, 100);
          this.pushMessage("Picked up armor");
        }
        if (pickup.type === "key"){
          player.keys[pickup.key] = true;
          this.pushMessage("Picked up blue key");
        }
        if (pickup.type === "weapon"){
          if (pickup.weapon === "shotgun"){
            player.hasShotgun = true;
            this.pushMessage("Picked up shotgun");
          }
        }
      }
    }
  }

  updateEnemies(dt){
    const player = this.player;
    for (const enemy of this.map.enemies){
      if (enemy.state === "dead") continue;
      enemy.timer = Math.max(0, enemy.timer - dt);
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);

      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      const canSee = this.hasLineOfSight(enemy.x, enemy.y, player.x, player.y);

      if (enemy.state === "idle" && canSee && dist < 8){
        enemy.state = "alert";
        enemy.timer = 0.4;
      }

      if (enemy.state === "alert" && enemy.timer <= 0){
        enemy.state = "chase";
      }

      if (enemy.state === "pain" && enemy.timer <= 0){
        enemy.state = "chase";
      }

      if (enemy.state === "chase"){
        if (dist < ENEMY_STATS[enemy.type].attackRange && canSee){
          enemy.state = "attack";
          enemy.timer = 0.2;
        }else{
          this.moveEnemyToward(enemy, player, dt);
        }
      }

      if (enemy.state === "attack" && enemy.timer <= 0){
        if (enemy.cooldown <= 0 && canSee){
          this.enemyAttack(enemy);
          enemy.cooldown = ENEMY_STATS[enemy.type].cooldown;
        }
        enemy.state = "chase";
      }
    }
  }

  moveEnemyToward(enemy, player, dt){
    const speed = ENEMY_STATS[enemy.type].speed;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const moveX = (dx / dist) * speed * dt;
    const moveY = (dy / dist) * speed * dt;
    if (!this.isBlocked(enemy.x + moveX, enemy.y)) enemy.x += moveX;
    if (!this.isBlocked(enemy.x, enemy.y + moveY)) enemy.y += moveY;
  }

  enemyAttack(enemy){
    if (enemy.type === "zombie"){
      const hit = this.hasLineOfSight(enemy.x, enemy.y, this.player.x, this.player.y);
      if (hit){
        const dmg = this.randomRange(5, 12);
        this.applyDamage(this.player, dmg);
        this.pushMessage("Zombie hits you!");
      }
      return;
    }

    if (enemy.type === "imp"){
      const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      this.projectiles.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * 3.4,
        vy: Math.sin(angle) * 3.4,
        life: 3,
        owner: "imp",
      });
    }
  }

  updateProjectiles(dt){
    const remaining = [];
    for (const proj of this.projectiles){
      proj.life -= dt;
      if (proj.life <= 0) continue;
      const nx = proj.x + proj.vx * dt;
      const ny = proj.y + proj.vy * dt;
      if (this.isBlocked(nx, ny)) continue;
      if (Math.hypot(nx - this.player.x, ny - this.player.y) < 0.4){
        this.applyDamage(this.player, this.randomRange(6, 14));
        this.pushMessage("Imp fireball!");
        continue;
      }
      proj.x = nx;
      proj.y = ny;
      remaining.push(proj);
    }
    this.projectiles = remaining;
  }

  fireWeapon(){
    const weapon = WEAPONS[this.player.weapon];
    if (weapon.ammo > 0 && this.player.ammo <= 0){
      this.pushMessage("Out of ammo");
      return;
    }

    if (weapon.ammo > 0){
      this.player.ammo = Math.max(0, this.player.ammo - weapon.ammo);
    }

    let totalHits = 0;
    for (let i = 0; i < weapon.pellets; i++){
      const spread = (this.rng.next() - 0.5) * weapon.spread;
      const angle = this.player.angle + spread;
      const hit = this.hitscan(angle);
      if (hit){
        totalHits += 1;
        const dmg = this.randomRange(weapon.damage[0], weapon.damage[1]);
        this.damageEnemy(hit, dmg);
      }
    }
    this.player.fireCooldown = weapon.cooldown;
    this.pushMessage(totalHits ? "Hit!" : "Miss");
  }

  hitscan(angle){
    const maxRange = 8;
    const step = 0.05;
    let x = this.player.x;
    let y = this.player.y;
    for (let t = 0; t < maxRange; t += step){
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      if (this.isBlocked(x, y)) return null;
      for (const enemy of this.map.enemies){
        if (enemy.state === "dead") continue;
        if (Math.hypot(enemy.x - x, enemy.y - y) < 0.3){
          return enemy;
        }
      }
    }
    return null;
  }

  damageEnemy(enemy, damage){
    enemy.health -= damage;
    if (enemy.health <= 0){
      enemy.state = "dead";
      this.pushMessage(`${enemy.type} down`);
      return;
    }
    enemy.state = "pain";
    enemy.timer = 0.3;
  }

  applyDamage(target, damage){
    if (this.godMode) return;
    let remaining = damage;
    if (target.armor > 0){
      const absorbed = Math.min(target.armor, Math.ceil(damage * 0.4));
      target.armor -= absorbed;
      remaining = Math.max(0, damage - absorbed);
    }
    target.health = Math.max(0, target.health - remaining);
    if (target.health <= 0){
      this.stop();
      this.writeLine("You died. Doom demo over.", "err");
    }
  }

  randomRange(min, max){
    return Math.floor(this.rng.next() * (max - min + 1)) + min;
  }

  hasLineOfSight(x0, y0, x1, y1){
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const step = 0.2;
    const steps = Math.ceil(dist / step);
    let x = x0;
    let y = y0;
    for (let i = 0; i < steps; i++){
      x += dx / steps;
      y += dy / steps;
      if (this.isBlocked(x, y)) return false;
    }
    return true;
  }

  render(){
    const buffer = this.gfx.getBuffer();
    if (!buffer) return;

    const pixels = buffer.pixels;
    const width = buffer.width;
    const height = buffer.height;
    const viewHeight = height - DOOM_HUD_HEIGHT;

    for (let i = 0; i < width * viewHeight; i++){
      pixels[i] = i < (width * viewHeight) / 2 ? COLOR.ceiling : COLOR.floor;
    }

    this.depthBuffer.fill(DOOM_MAX_DIST);

    for (let x = 0; x < width; x++){
      const rayAngle = this.player.angle - DOOM_FOV / 2 + (x / width) * DOOM_FOV;
      const hit = this.castRay(rayAngle);
      const dist = hit ? hit.distance : DOOM_MAX_DIST;
      this.depthBuffer[x] = dist;
      const sliceHeight = clamp(Math.floor((viewHeight / dist) * 1.2), 1, viewHeight);
      const sliceStart = Math.floor((viewHeight - sliceHeight) / 2);
      const color = hit && hit.type === "door" ? COLOR.door : dist < 6 ? COLOR.wallNear : COLOR.wallFar;
      for (let y = 0; y < sliceHeight; y++){
        const idx = (sliceStart + y) * width + x;
        if (idx >= 0 && idx < width * viewHeight){
          pixels[idx] = color;
        }
      }
    }

    this.renderSprites(width, viewHeight, pixels);
    this.renderProjectiles(width, viewHeight, pixels);
    this.renderHud(width, height, viewHeight, pixels);
    if (this.automap){
      this.renderAutomap(width, height, pixels);
    }

    this.gfx.markDirty();
    this.gfx.flushGfxOutput();
  }

  castRay(angle){
    const step = 0.05;
    let x = this.player.x;
    let y = this.player.y;
    for (let dist = 0; dist < DOOM_MAX_DIST; dist += step){
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      const cell = this.getCell(x, y);
      if (cell === "#" || cell === "P" || cell === "F"){
        return { distance: dist, type: "wall" };
      }
      if (cell === "D"){
        const door = this.getDoorAt(Math.floor(x), Math.floor(y));
        if (door && door.open < 0.9){
          return { distance: dist, type: "door" };
        }
      }
    }
    return null;
  }

  renderSprites(width, viewHeight, pixels){
    const sprites = [];
    for (const enemy of this.map.enemies){
      if (enemy.state === "dead") continue;
      sprites.push({ x: enemy.x, y: enemy.y, color: COLOR.enemy, size: 1.0 });
    }
    for (const pickup of this.map.pickups){
      if (pickup.taken) continue;
      sprites.push({ x: pickup.x, y: pickup.y, color: COLOR.pickup, size: 0.6 });
    }

    sprites.sort((a, b) => {
      const da = Math.hypot(a.x - this.player.x, a.y - this.player.y);
      const db = Math.hypot(b.x - this.player.x, b.y - this.player.y);
      return db - da;
    });

    for (const sprite of sprites){
      const dx = sprite.x - this.player.x;
      const dy = sprite.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const angle = normalizeAngle(Math.atan2(dy, dx) - this.player.angle);
      if (Math.abs(angle) > DOOM_FOV / 1.5) continue;
      const screenX = Math.floor(((angle + DOOM_FOV / 2) / DOOM_FOV) * width);
      const spriteHeight = Math.floor((viewHeight / dist) * sprite.size);
      const spriteWidth = Math.floor(spriteHeight * 0.6);
      const xStart = screenX - Math.floor(spriteWidth / 2);
      const yStart = Math.floor(viewHeight / 2 - spriteHeight / 2);
      for (let sx = 0; sx < spriteWidth; sx++){
        const col = xStart + sx;
        if (col < 0 || col >= width) continue;
        if (dist >= this.depthBuffer[col]) continue;
        for (let sy = 0; sy < spriteHeight; sy++){
          const row = yStart + sy;
          if (row < 0 || row >= viewHeight) continue;
          pixels[row * width + col] = sprite.color;
        }
      }
    }
  }

  renderProjectiles(width, viewHeight, pixels){
    for (const proj of this.projectiles){
      const dx = proj.x - this.player.x;
      const dy = proj.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const angle = normalizeAngle(Math.atan2(dy, dx) - this.player.angle);
      if (Math.abs(angle) > DOOM_FOV / 2) continue;
      const screenX = Math.floor(((angle + DOOM_FOV / 2) / DOOM_FOV) * width);
      const spriteHeight = Math.floor((viewHeight / dist) * 0.4);
      const yStart = Math.floor(viewHeight / 2 - spriteHeight / 2);
      for (let sy = 0; sy < spriteHeight; sy++){
        const row = yStart + sy;
        if (row < 0 || row >= viewHeight) continue;
        pixels[row * width + screenX] = COLOR.projectile;
      }
    }
  }

  renderHud(width, height, viewHeight, pixels){
    const hudTop = viewHeight;
    for (let y = hudTop; y < height; y++){
      for (let x = 0; x < width; x++){
        pixels[y * width + x] = "transparent";
      }
    }

    const player = this.player;
    this.drawText(2, hudTop + 2, `HP:${player.health}`, COLOR.hud, width, pixels);
    this.drawText(28, hudTop + 2, `AR:${player.armor}`, COLOR.hud, width, pixels);
    this.drawText(52, hudTop + 2, `AM:${player.ammo}`, COLOR.hud, width, pixels);
    const weaponName = WEAPONS[player.weapon].key.toUpperCase();
    this.drawText(2, hudTop + 8, `WPN:${weaponName}`, COLOR.hud, width, pixels);
    this.drawText(34, hudTop + 8, `KEY:${player.keys.blue ? "BLUE" : "-"}`, COLOR.hud, width, pixels);
    if (this.message.text){
      this.drawText(2, hudTop - 8, this.message.text.toUpperCase(), COLOR.message, width, pixels);
    }
  }

  renderAutomap(width, height, pixels){
    const mapScale = 3;
    const mapPadding = 2;
    const grid = this.map.grid;
    const mapHeight = grid.length;
    const mapWidth = grid[0].length;

    for (let y = 0; y < mapHeight; y++){
      for (let x = 0; x < mapWidth; x++){
        const cell = grid[y][x];
        let color = null;
        if (cell === "#" || cell === "P" || cell === "F") color = COLOR.mapWall;
        if (cell === "D") color = COLOR.mapDoor;
        if (cell === "." || cell === "E") color = COLOR.mapFloor;
        if (!color) continue;
        const px = mapPadding + x * mapScale;
        const py = mapPadding + y * mapScale;
        for (let dy = 0; dy < mapScale; dy++){
          for (let dx = 0; dx < mapScale; dx++){
            const idx = (py + dy) * width + (px + dx);
            if (idx >= 0 && idx < width * height){
              pixels[idx] = color;
            }
          }
        }
      }
    }

    const px = Math.floor(mapPadding + this.player.x * mapScale);
    const py = Math.floor(mapPadding + this.player.y * mapScale);
    for (let dy = -1; dy <= 1; dy++){
      for (let dx = -1; dx <= 1; dx++){
        const idx = (py + dy) * width + (px + dx);
        if (idx >= 0 && idx < width * height){
          pixels[idx] = COLOR.mapPlayer;
        }
      }
    }

    for (const enemy of this.map.enemies){
      if (enemy.state === "dead") continue;
      const ex = Math.floor(mapPadding + enemy.x * mapScale);
      const ey = Math.floor(mapPadding + enemy.y * mapScale);
      const idx = ey * width + ex;
      if (idx >= 0 && idx < width * height){
        pixels[idx] = COLOR.mapEnemy;
      }
    }
  }

  drawText(x, y, text, color, width, pixels){
    let cursorX = x;
    const upper = text.toUpperCase();
    for (const char of upper){
      const glyph = FONT_3X5[char] || FONT_3X5[" "];
      for (let gy = 0; gy < glyph.length; gy++){
        const row = glyph[gy];
        for (let gx = 0; gx < row.length; gx++){
          if (row[gx] === "1"){
            const idx = (y + gy) * width + (cursorX + gx);
            if (idx >= 0 && idx < pixels.length){
              pixels[idx] = color;
            }
          }
        }
      }
      cursorX += 4;
    }
  }

  save(name){
    const label = name || "quick";
    const payload = JSON.stringify({
      seed: this.seed,
      rngState: this.rng.getState(),
      tick: this.tickCount,
      player: this.player,
      doors: this.map.doors,
      pickups: this.map.pickups,
      enemies: this.map.enemies,
      grid: this.map.grid,
      automap: this.automap,
      god: this.godMode,
      noclip: this.noclip,
    });
    const saves = this.getSaveStore();
    saves[label] = payload;
    localStorage.setItem("replcalc_doom_saves", JSON.stringify(saves));
    this.writeLine(`Doom state saved as ${label}.`, "ok");
  }

  load(name){
    const label = name || "quick";
    const saves = this.getSaveStore();
    if (!saves[label]){
      this.writeLine(`No doom save named ${label}.`, "warn");
      return;
    }
    const data = JSON.parse(saves[label]);
    this.seed = data.seed;
    this.rng = createRng(this.seed);
    this.rng.setState(data.rngState);
    this.tickCount = data.tick;
    this.player = data.player;
    this.map.grid = data.grid;
    this.map.doors = data.doors;
    this.map.pickups = data.pickups;
    this.map.enemies = data.enemies;
    this.automap = data.automap;
    this.godMode = data.god;
    this.noclip = data.noclip;
    this.pushMessage(`Loaded ${label}`);
  }

  getSaveStore(){
    try{
      return JSON.parse(localStorage.getItem("replcalc_doom_saves") || "{}");
    }catch{
      return {};
    }
  }

  getSummary(){
    const alive = this.map.enemies.filter((enemy) => enemy.state !== "dead").length;
    const time = (this.tickCount / DOOM_TICK_RATE).toFixed(1);
    const player = this.player;
    return `HP ${player.health} AR ${player.armor} AM ${player.ammo} | enemies ${alive} | time ${time}s | seed ${this.seed}`;
  }

  spawnEnemy(type, x, y){
    const enemyType = type === "imp" ? "imp" : "zombie";
    const px = Number.isFinite(x) ? x : this.player.x + 1;
    const py = Number.isFinite(y) ? y : this.player.y + 1;
    this.map.enemies.push(this.createEnemy(enemyType, px, py));
    this.pushMessage(`Spawned ${enemyType}`);
  }

  toggleGod(){
    this.godMode = !this.godMode;
    this.pushMessage(`God mode ${this.godMode ? "on" : "off"}`);
  }

  toggleNoclip(){
    this.noclip = !this.noclip;
    this.pushMessage(`Noclip ${this.noclip ? "on" : "off"}`);
  }
}

export function getDoomController({ gfx, writeLine }){
  if (!doomController){
    doomController = createDoomController({ gfx, writeLine });
  }else{
    doomController.setDeps(gfx, writeLine);
  }
  return doomController;
}

export function runDoomDemo({ gfx, writeLine }){
  const controller = getDoomController({ gfx, writeLine });
  controller.start();
}

export function handleDoomInput(line, { gfx, writeLine }){
  if (!line.trim().toLowerCase().startsWith("doom.")) return false;
  const controller = getDoomController({ gfx, writeLine });
  return controller.handleCommand(line);
}
