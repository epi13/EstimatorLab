// Doom demo - Pure EST DSL showcase
// This demonstrates the EST DSL capabilities for graphics and animation

export const DOOM_DEMO_SCRIPT = `
# Doom-style raycasting demo in EST DSL
# Shows: graphics, loops, conditionals, math functions, animation

# Setup graphics buffer
gfx(96, 54);
gfxs(6);
cls();
bg("transparent");

# Constants
w = 96;
h = 54;
hud = 10;

# Calculated values
view = h - hud;
mid = floor(view / 2);
roll = sin(time * 0.8) * 2;

# Draw floor and ceiling
fill(0, 0, w, mid + roll, "muted");
fill(0, mid + roll, w, view - (mid + roll), "text");

# Ray casting for each column
for x in 0..(w - 1):
  ray = (x / w) * 3.1416 - 1.5708;
  wobble = sin(time * 0.9 + x * 0.12);
  dist = 3 + 1.6 * (1 + wobble);
  slice = clamp(floor(view / dist), 1, view);
  y0 = floor((view - slice) / 2 + roll);
  y1 = y0 + slice;
  shade = if(dist < 4): "accent" else: "accent-2";
  line(x, y0, x, y1, shade);

# Draw crosshair
cx = floor(w / 2);
cy = floor(view / 2 + roll);
line(cx - 3, cy, cx + 3, cy, "ok");
line(cx, cy - 3, cx, cy + 3, "ok");

# Draw HUD
fill(0, view, w, hud, "transparent");
rect(1, view + 1, w - 2, hud - 2, "muted");

# Animated health bar
hp = clamp(0.65 + 0.35 * sin(time * 0.5), 0, 1);
barW = floor((w - 6) * hp);
fill(3, view + 3, barW, 3, "ok");

# Animated ammo bar  
ammo = clamp(0.45 + 0.45 * sin(time * 0.7 + 1.4), 0, 1);
ammoW = floor((w - 6) * ammo);
fill(3, view + 7, ammoW, 2, "warn");
`;

export function runDoomDemo({ gfx, writeLine, writeInputEcho }) {
  writeLine("Doom demo - EST DSL raycasting showcase", "muted");
  writeLine("Controls: Space=pause/play, Arrows=step/fps", "muted");
  
  // Initialize graphics
  gfx.initBuffer(96, 54, 6);
  gfx.configureLoop(DOOM_DEMO_SCRIPT, 30);
  gfx.playLoop();
}
