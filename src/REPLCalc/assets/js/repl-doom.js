// Doom demo - Pure EST DSL showcase
// This demonstrates the EST DSL capabilities for graphics and animation

const DOOM_W = 160;
const DOOM_H = 90;
const DOOM_SCALE = 5;

export const DOOM_DEMO_SCRIPT = `
# Doom level - playable raycaster in EST DSL
# Controls:
# - Click the canvas to capture the mouse (pointer lock)
# - Mouse: look/turn
# - W/S: forward/back
# - A/D: strafe left/right
# - Shift: run
# - Space: use (open doors)
# - Left click: shoot
# - P: play/pause loop (when mouse not captured)

# Display setup
w = ${DOOM_W};
h = ${DOOM_H};
scale = ${DOOM_SCALE};
hud_h = 12;
view_h = h - hud_h;

# Math helpers
so sign(x) = if(x < 0, -1, if(x > 0, 1, 0));
so frac(x) = x - floor(x);
so lerp(a, b, t) = a + (b - a) * t;

# Scene helpers
so tile_solid(t) = if(t == 1 || t == 2, 1, 0);
so tile_wall(t) = if(t == 1, 1, if(t == 2, 2, 0));

# Persistent init
if has("doom_init") == 0:
  doom_init = 1
  doom_map = map("########################|#S......#........#....E#|#.####..#.######.#.###.#|#......##......#.#.....#|#..D...#..M....#.#.###.#|#......#......##.#.....#|#.####.#.####.#..#...#.#|#..#K..#......#..#..A..#|#..###.#.####.#..####..#|#......#....H.#..#.....#|#.####.######.#..#.###.#|#..M...#......#..#..M..#|#......#.####.#..#.###.#|#..####.#....D#..#.....#|#......#......#..#.....#|########################")
  doom_px = mspawnx(doom_map)
  doom_py = mspawny(doom_map)
  doom_yaw = 0
  doom_hp = 100
  doom_ammo = 30
  doom_key = 0
  doom_kills = 0
  doom_win = 0
  doom_dead = 0
  doom_use_cd = 0
  doom_shoot_cd = 0

# Frame setup
cls();
bg("transparent");

# Timers
doom_use_cd = max(0, doom_use_cd - 1)
doom_shoot_cd = max(0, doom_shoot_cd - 1)

# Input
sens = 0.0022
turn = mouse_dx * sens + (key_right - key_left) * 0.045
doom_yaw = doom_yaw + turn

speed = (2.4 + 1.4 * key_shift) * dt
fw = (key_w - key_s) * speed
st = (key_d - key_a) * speed

cx = cos(doom_yaw)
sx = sin(doom_yaw)
nx = doom_px + cx * fw - sx * st
ny = doom_py + sx * fw + cx * st

# Collision (walls + closed doors)
tx = floor(nx)
ty = floor(doom_py)
if tile_solid(mget(doom_map, tx, ty)) == 0: doom_px = nx else: 0
tx2 = floor(doom_px)
ty2 = floor(ny)
if tile_solid(mget(doom_map, tx2, ty2)) == 0: doom_py = ny else: 0

# Pickups / triggers underfoot
ftx = floor(doom_px)
fty = floor(doom_py)
t_under = mget(doom_map, ftx, fty)
if t_under == 3: doom_key = 1; mset(doom_map, ftx, fty, 0) else: 0
if t_under == 6: doom_hp = min(100, doom_hp + 25); mset(doom_map, ftx, fty, 0) else: 0
if t_under == 7: doom_ammo = min(99, doom_ammo + 12); mset(doom_map, ftx, fty, 0) else: 0

# Use: open doors in front
ux = floor(doom_px + cos(doom_yaw) * 1.0)
uy = floor(doom_py + sin(doom_yaw) * 1.0)
t_front = mget(doom_map, ux, uy)
if key_space == 1 && doom_use_cd == 0 && t_front == 2: mset(doom_map, ux, uy, 0); doom_use_cd = 10 else: 0

# Shoot: raycast for monster tiles
if mouse_btn0 == 1 && doom_shoot_cd == 0 && doom_ammo > 0 && doom_dead == 0 && doom_win == 0:
  doom_ammo = doom_ammo - 1
  doom_shoot_cd = 6
  hit = 0
  for i in 0..160:
    d = i * 0.05
    rx = doom_px + cos(doom_yaw) * d
    ry = doom_py + sin(doom_yaw) * d
    tt = mget(doom_map, rx, ry)
    if hit == 0 && tt == 5: mset(doom_map, floor(rx), floor(ry), 0); doom_kills = doom_kills + 1; hit = 1
    if hit == 0 && tile_solid(tt) == 1: hit = 2

# Monster proximity damage (simple Doom-style pressure)
near = 0
for ox in -1..1:
  for oy in -1..1:
    if mget(doom_map, ftx + ox, fty + oy) == 5: near = 1 else: 0
if near == 1 && doom_dead == 0 && doom_win == 0:
  doom_hp = doom_hp - (18 * dt)

if doom_hp <= 0: doom_dead = 1 else: 0

# Win condition: reach exit with key
if t_under == 4 && doom_key == 1 && doom_dead == 0: doom_win = 1 else: 0

# Camera / rendering params
mid = floor(view_h / 2)
fov = 1.05
max_d = 10
ray_step = 0.08
ray_steps = 90
ray_col_step = 2

# Floor + ceiling
fill(0, 0, w, mid, "muted")
fill(0, mid, w, view_h - mid, "text")

# Raycast walls (fast builtin)
raycast(doom_map, doom_px, doom_py, doom_yaw, fov, view_h, max_d, ray_step, ray_steps, ray_col_step)

# Crosshair
cxh = floor(w / 2)
cyh = floor(view_h / 2)
line(cxh - 3, cyh, cxh + 3, cyh, "ok")
line(cxh, cyh - 3, cxh, cyh + 3, "ok")

# HUD
hy = view_h
fill(0, hy, w, hud_h, "transparent")
rect(1, hy + 1, w - 2, hud_h - 2, "muted")

# Health / ammo bars
hpw = floor((w - 12) * (doom_hp / 100))
amw = floor((w - 12) * (doom_ammo / 99))
fill(6, hy + 3, hpw, 3, if(doom_hp < 30, "err", "ok"))
fill(6, hy + 8, amw, 2, if(doom_ammo < 8, "warn", "accent"))

# Key indicator
fill(2, hy + 3, 3, 3, if(doom_key == 1, "warn", "muted"))

# Kills indicator (up to 6 ticks)
for k in 0..5:
  fill(2 + k * 3, hy + 8, 2, 2, if(doom_kills > k, "ok", "muted"))

# Status badge
badge = if(doom_dead == 1, "err", if(doom_win == 1, "ok", if(doom_key == 1, "warn", "accent-2")))
fill(w - 7, hy + 3, 5, 7, badge)

# Mini-map (top-left)
mm_s = 2
mm_x = 2
mm_y = 2
mw0 = mw(doom_map)
mh0 = mh(doom_map)
for my in 0..(mh0 - 1):
  for mx in 0..(mw0 - 1):
    tt = mget(doom_map, mx, my)
    cc = if(tt == 1, "muted", if(tt == 2, "warn", if(tt == 4, "ok", if(tt == 3, "warn", if(tt == 5, "err", "transparent")))))
    if cc != "transparent": fill(mm_x + mx * mm_s, mm_y + my * mm_s, mm_s, mm_s, cc) else: 0
pxm = floor(mm_x + doom_px * mm_s)
pym = floor(mm_y + doom_py * mm_s)
fill(pxm, pym, 2, 2, "accent")

# Export a deterministic hash for tests
doom_hash = floor((abs(sin(time * 3.1 + doom_px * 1.7 + doom_py * 2.3 + doom_yaw)) + 0.5) * 1000000) + frame * 1000003
set("doom_hash", doom_hash)
`;

export function runDoomDemo({ gfx, writeLine, writeInputEcho }) {
  writeLine("Doom level - playable EST DSL raycaster", "muted");
  writeLine("Click the canvas to capture the mouse.", "muted");
  writeLine("Controls: Mouse look • WASD move/strafe • Shift run • Space use • LMB shoot", "muted");
  writeLine("Loop UI: P play/pause (when mouse not captured) • Arrows step/fps • R reset", "muted");
  
  // Initialize graphics
  gfx.initBuffer(DOOM_W, DOOM_H, DOOM_SCALE);
  gfx.configureLoop(DOOM_DEMO_SCRIPT, 30);
  gfx.playLoop();
}
