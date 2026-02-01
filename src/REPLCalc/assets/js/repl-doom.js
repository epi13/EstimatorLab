// Doom demo - Pure EST DSL showcase
// This demonstrates the EST DSL capabilities for graphics and animation

export const DOOM_DEMO_SCRIPT = `
# Doom-style raycasting demo - EST DSL showcase
# Demonstrates: flexible variables, lazy typing, solutions, loops, conditionals, input

# Graphics setup - flexible variables
w = 96;
h = 54;
scale = 6;

# Initialize frame
cls();
bg("transparent");

# Level configuration - lazy typing
hud_height = 10;
view = h - hud_height;
mid = floor(view / 2);

# Persistent player state (stored in variables)
if has("doom_yaw") == 0: doom_yaw = 0 else: 0;
if has("doom_walk") == 0: doom_walk = 0 else: 0;

# Controls
turn = (key_d - key_a) * 0.06;
move = (key_w - key_s) * (0.35 + 0.35 * key_shift);
doom_yaw = doom_yaw + turn;
doom_walk = doom_walk + move;

yaw = doom_yaw;
walk = doom_walk;

# Animation variables - calculated each frame
roll = sin(time * 0.8 + walk * 0.25) * 2

# Draw floor and ceiling
fill(0, 0, w, mid + roll, "muted");
fill(0, mid + roll, w, view - (mid + roll), "text");

# Simple ray casting with inline calculations
for x in 0..(w - 1):
  ray = (x / w) * 3.1416 - 1.5708 + yaw
  dist = 3 + 1.6 * (1 + sin(time * 0.9 + x * 0.12 + walk * 0.15))
  slice = max(1, min(view, floor(view / dist)))
  y0 = floor((view - slice) / 2 + roll)
  y1 = y0 + slice
  shade = if(dist < 4, "accent", "accent-2")
  line(x, y0, x, y1, shade)


# Crosshair calculations - flexible variables
crosshair_x = floor(w / 2);
crosshair_y = floor(view / 2 + roll);
crosshair_size = 3;

# Draw crosshair
line(crosshair_x - crosshair_size, crosshair_y, crosshair_x + crosshair_size, crosshair_y, "ok");
line(crosshair_x, crosshair_y - crosshair_size, crosshair_x, crosshair_y + crosshair_size, "ok");

# HUD configuration - lazy typing
hud_y = view;
hud_margin = 1;
bar_height = 3;
ammo_height = 2;

# Animated bar solution
so animated_bar(base_time, freq, amplitude, offset) = max(0, min(1, offset + amplitude * sin(base_time * freq)))

# Draw HUD background
fill(0, hud_y, w, hud_height, "transparent");
rect(hud_margin, hud_y + hud_margin, w - 2 * hud_margin, hud_height - 2 * hud_margin, "muted");

# Health bar using solution
hp = animated_bar(time, 0.5, 0.35, 0.65);
hp_width = floor((w - 6) * hp);
fill(3, hud_y + 3, hp_width, bar_height, "ok");

# Ammo bar using solution
ammo = animated_bar(time, 0.7, 0.45, 0.45);
ammo_width = floor((w - 6) * ammo);
fill(3, hud_y + 7, ammo_width, ammo_height, "warn");
`;

export function runDoomDemo({ gfx, writeLine, writeInputEcho }) {
  writeLine("Doom demo - EST DSL raycasting showcase", "muted");
  writeLine("Controls: Space=pause/play, Arrows=step/fps", "muted");
  
  // Initialize graphics
  gfx.initBuffer(96, 54, 6);
  gfx.configureLoop(DOOM_DEMO_SCRIPT, 30);
  gfx.playLoop();
}
