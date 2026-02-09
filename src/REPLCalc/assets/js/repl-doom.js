// Doom demo - Pure EST DSL showcase
// This demonstrates the EST DSL capabilities for an engineering grade graphical and temporal  representation of what the app can do. Since the helpers and built-in relate to spatial and temporal features with granular layers. 
// This should take full advantage of as many of the construction helpers, assemblies, solutions, to continue to refine the level. Upgrade built-ins and helpers needed as long as it is inline with the est DSL. 

const DOOM_W = 256;
const DOOM_H = 144;
const DOOM_SCALE = 3;
const DOOM_DEFAULT_FPS = 18;

export const DOOM_DEMO_SCRIPT = `
# Doom level - playable game in EST DSL
# Controls:
# - Click the canvas to capture the mouse (pointer lock)
# - Mouse: look/turn
# - W/S: forward/back
# - A/D: strafe left/right
# - Shift: run
# - Space: use (open doors)
# - Left click: shoot
# - Right click: swap weapon
# - F: buy rifle upgrade (150$)
# - Q: toggle cost/schedule panel (blueprint view)
# - P: play/pause loop (when mouse not captured)

# Display setup
w = ${DOOM_W};
h = ${DOOM_H};
scale = ${DOOM_SCALE};
hud_h = 12;
view_h = h - hud_h

# Math helpers
so sign(x) = if(x < 0, -1, if(x > 0, 1, 0));
so frac(x) = x - floor(x);
so lerp(a, b, t) = a + (b - a) * t;
so smoothstep(a, b, x) = if(a == b, 0, clamp((x - a) / (b - a), 0, 1) * clamp((x - a) / (b - a), 0, 1) * (3 - 2 * clamp((x - a) / (b - a), 0, 1)));

# Scene helpers
so tile_solid(t) = if(t == 1 || t == 2, 1, 0);
so tile_wall(t) = if(t == 1, 1, if(t == 2, 2, 0));
so tile_wallish(t) = if(t == 1 || t == 2, 1, 0);

# Deterministic PRNG (0..1)
so rnd(x) = frac(sin(x * 12.9898 + 78.233) * 43758.5453);

# Unit helpers
tile = 2 ft
tile_per_s = tile / s
tile_per_s2 = tile / (s^2)
per_s = 1 / s

# Persistent init
if has("doom_init") == 0:
  doom_init = 1
  doom_seed = 1337
  doom_level = 0
  doom_regen = 1
  doom_money = 0 $
  doom_view = 0
  doom_panel = 0
  doom_metrics_dirty = 1

  doom_duct_shape = "rect"
  doom_duct_a = 24 in
  doom_duct_b = 12 in
  doom_duct_gauge = 26

  doom_weapon_tier = 1
  doom_armor = 30
  doom_stamina = 100
  doom_combo = 0
  doom_combo_cd = 0

  wallFinish("DRYWALL_PRIMED")
  floorFinish("LVP_OAK_LIGHT")
  ceilingFinish("ACT_2x2")
  trimFinish("BASE", "RUBBER_BASE_BLACK")
  trimFinish("CASING", "WOOD_CASING_WHITE")
  wainscot(4 ft, "WAINSCOT_BEADBOARD_WHITE")

  assy doom_profile = { tile = 2 ft; walk = 5 mph; run = 9 mph; accel = 28 ft / (s^2); friction = 6 / s }
  assy pistol = { dmg = 18; range = 45 ft; cooldown = 0.18 s; spread = 2 deg }
  assy shotgun = { dmg = 42; range = 28 ft; cooldown = 0.42 s; spread = 7 deg }
  assy rifle = { dmg = 28; range = 70 ft; cooldown = 0.12 s; spread = 1.1 deg }
  doom_weapon = pistol

  doom_map = dungeon(doom_seed + doom_level * 101, 30, 22, doom_level)
  doom_px = mspawnx(doom_map)
  doom_py = mspawny(doom_map)
  doom_yaw = 0
  doom_vx = 0
  doom_vy = 0
  doom_hp = 100
  doom_ammo = 30
  doom_key = 0
  doom_kills = 0
  doom_win = 0
  doom_dead = 0
  doom_use_cd = 0
  doom_shoot_cd = 0
  doom_shop_cd = 0
  doom_rifle_unlocked = 0

if has("doom_mat_init") == 0:
  doom_mat_init = 1
  mat_concrete = material("CONCRETE", { density: 150 pcf; unit_cost: 145 $ / cy })
  mat_gyp = material("GYP", { density: 52 pcf; unit_cost: 0.42 $ / sf })
  mat_paint = material("PAINT", { density: 10 pcf; unit_cost: 0.12 $ / sf })
  mat_duct = material("GALV", { density: 490 pcf; unit_cost: 1.8 $ / lb })
  mat_trim = material("TRIM", { density: 35 pcf; unit_cost: 1.4 $ / lf })

# Frame setup
cls();
bg("transparent");

# Timers
doom_use_cd = max(0, doom_use_cd - 1)
doom_shoot_cd = max(0, doom_shoot_cd - 1)
doom_shop_cd = max(0, doom_shop_cd - 1)
doom_combo_cd = max(0, doom_combo_cd - 1)
if doom_combo_cd == 0: doom_combo = 0 else: 0

if key_e == 1 && has("doom_view_toggle") == 0: doom_view_toggle = 1; doom_view = 1 - doom_view else: if key_e == 0: unset("doom_view_toggle")
if key_q == 1 && has("doom_panel_toggle") == 0: doom_panel_toggle = 1; doom_panel = 1 - doom_panel else: if key_q == 0: unset("doom_panel_toggle")

# Input
sens = 0.0022 * (0.8 + 0.4 * smoothstep(0, 1, doom_stamina / 100))
turn = mouse_dx * sens + (key_right - key_left) * 0.045
doom_yaw = doom_yaw + turn

# Weapon swap (RMB)
if mouse_btn2 == 1 && has("doom_swap") == 0:
  doom_swap = 1
  doom_weapon = if(doom_weapon == pistol, shotgun, if(doom_rifle_unlocked == 1, rifle, pistol))
else:
  if mouse_btn2 == 0: unset("doom_swap") else: 0

# Field upgrade (F)
if key_f == 1 && doom_shop_cd == 0 && doom_money >= 150 $ && doom_rifle_unlocked == 0:
  doom_money = doom_money - 150 $
  doom_rifle_unlocked = 1
  doom_weapon = rifle
  doom_shop_cd = 20
else:
  0

# Movement model (tiles/s) tuned via units + assemblies
fw = key_w - key_s
st = key_d - key_a
wish = sqrt(fw * fw + st * st)
cx = cos(doom_yaw)
sx = sin(doom_yaw)

walk = field(doom_profile, "walk")
run = field(doom_profile, "run")
accel_u = field(doom_profile, "accel")
fric_u = field(doom_profile, "friction")

run_req = if(key_shift == 1 && wish > 0, 1, 0)
doom_stamina = clamp(doom_stamina + (if(run_req == 1, -22, 14) * dt), 0, 100)
run_ok = if(run_req == 1 && doom_stamina > 4, 1, 0)

max_spd = to(if(run_ok == 1, run, walk), tile_per_s)
accel = to(accel_u, tile_per_s2)
fric = to(fric_u, per_s)

ax = if(wish > 0, (cx * fw - sx * st) * (accel / wish), 0)
ay = if(wish > 0, (sx * fw + cx * st) * (accel / wish), 0)

doom_vx = doom_vx + ax * dt
doom_vy = doom_vy + ay * dt

damp = max(0, 1 - fric * dt)
doom_vx = doom_vx * damp
doom_vy = doom_vy * damp

vmag = sqrt(doom_vx * doom_vx + doom_vy * doom_vy)
if vmag > max_spd: sc = max_spd / max(0.0001, vmag); doom_vx = doom_vx * sc; doom_vy = doom_vy * sc else: 0

# Collision (radius)
r = 0.18
nx = doom_px + doom_vx * dt
ny = doom_py + doom_vy * dt

so solid_at(x, y) = tile_solid(mget(doom_map, floor(x), floor(y)))
so clear(x, y) = if(solid_at(x - r, y - r) == 0 && solid_at(x + r, y - r) == 0 && solid_at(x - r, y + r) == 0 && solid_at(x + r, y + r) == 0, 1, 0)

if clear(nx, doom_py) == 1: doom_px = nx else: doom_vx = 0
if clear(doom_px, ny) == 1: doom_py = ny else: doom_vy = 0

# Pickups / triggers underfoot
ftx = floor(doom_px)
fty = floor(doom_py)
t_under = mget(doom_map, ftx, fty)
if t_under == 3: doom_key = 1; mset(doom_map, ftx, fty, 0) else: 0
if t_under == 6:
  doom_hp = min(100, doom_hp + 25)
  doom_armor = min(100, doom_armor + 10)
  mset(doom_map, ftx, fty, 0)
else:
  0
if t_under == 7:
  doom_ammo = min(99, doom_ammo + 12)
  doom_stamina = min(100, doom_stamina + 20)
  mset(doom_map, ftx, fty, 0)
else:
  0

# Stairs depth
if t_under == 10 && doom_dead == 0: doom_level = doom_level + 1; doom_key = 0; doom_regen = 1 else: 0
if t_under == 11 && doom_dead == 0: doom_level = max(0, doom_level - 1); doom_key = 0; doom_regen = 1 else: 0

if doom_regen == 1: doom_map = dungeon(doom_seed + doom_level * 101, 30, 22, doom_level); doom_px = mspawnx(doom_map); doom_py = mspawny(doom_map); doom_vx = 0; doom_vy = 0; doom_regen = 0; doom_metrics_dirty = 1 else: 0

# Use: open doors in front
ux = floor(doom_px + cos(doom_yaw) * 1.0)
uy = floor(doom_py + sin(doom_yaw) * 1.0)
t_front = mget(doom_map, ux, uy)
if key_space == 1 && doom_use_cd == 0 && t_front == 2: mset(doom_map, ux, uy, 0); doom_use_cd = 10; doom_metrics_dirty = 1 else: 0

# Shoot: raycast for monster tiles
cooldown = field(doom_weapon, "cooldown")
cd_frames = max(1, ceil(to(cooldown, s) / dt))
spread = field(doom_weapon, "spread")
range = to(field(doom_weapon, "range"), tile)
dmg_base = field(doom_weapon, "dmg")

if mouse_btn0 == 1 && doom_shoot_cd == 0 && doom_ammo > 0 && doom_dead == 0 && doom_win == 0:
  doom_ammo = doom_ammo - 1
  doom_shoot_cd = cd_frames
  hit = 0
  crit = if(sample(dist.uniform(0, 1)) > (0.9 - 0.02 * min(4, doom_combo)), 1, 0)
  dmg = dmg_base * (1 + 0.5 * crit + 0.1 * min(5, doom_combo))
  aim = doom_yaw + (rnd(frame * 7.1 + doom_kills * 11.7) - 0.5) * spread
  for i in 0..240:
    d = i * (range / 240)
    rx = doom_px + cos(aim) * d
    ry = doom_py + sin(aim) * d
    tt = mget(doom_map, rx, ry)
    if hit == 0 && tt == 5:
      mset(doom_map, floor(rx), floor(ry), 0)
      doom_kills = doom_kills + 1
      doom_money = doom_money + (20 + dmg) $
      doom_combo = min(6, doom_combo + 1)
      doom_combo_cd = 70
      hit = 1
    else:
      0
    if hit == 0 && tile_solid(tt) == 1: hit = 2 else: 0

# Monster behavior (sampled movement) + proximity pressure
mn = 2 + min(6, doom_level)
for i in 0..(mn - 1):
  mx = 1 + floor(rnd(frame * 1.31 + i * 9.7) * (mw(doom_map) - 2))
  my = 1 + floor(rnd(frame * 1.73 + i * 13.9) * (mh(doom_map) - 2))
  if mget(doom_map, mx, my) == 5:
    pxm = mx + 0.5
    pym = my + 0.5
    dx = doom_px - pxm
    dy = doom_py - pym
    adx = abs(dx)
    ady = abs(dy)
    stepx = sign(dx)
    stepy = sign(dy)
    tx = mx + if(adx > ady, stepx, 0)
    ty = my + if(adx > ady, 0, stepy)
    if mget(doom_map, tx, ty) == 0: mset(doom_map, mx, my, 0); mset(doom_map, tx, ty, 5) else: 0
  else:
    0

near = 0
for ox in -1..1:
  for oy in -1..1:
    if mget(doom_map, ftx + ox, fty + oy) == 5: near = 1 else: 0
if near == 1 && doom_dead == 0 && doom_win == 0:
  dmg = (16 + 4 * min(6, doom_level)) * dt
  absorb = min(doom_armor, dmg * 0.55)
  doom_armor = max(0, doom_armor - absorb)
  doom_hp = doom_hp - (dmg - absorb)

if doom_hp <= 0: doom_dead = 1 else: 0

# Win condition: reach exit with key
if t_under == 4 && doom_key == 1 && doom_dead == 0: doom_win = if(doom_level >= 3, 1, 0) else: 0

if doom_metrics_dirty == 1:
  doom_wall_edges = 0
  doom_wall_line_tiles = 0
  doom_floor_tiles = 0
  doom_doors = 0
  doom_monsters = 0
  doom_keys = 0
  doom_exits = 0
  doom_lights = 0
  doom_light_2x4 = 0
  doom_light_track = 0
  doom_light_2x2 = 0
  doom_light_dl = 0
  doom_light_lin = 0
  doom_light_hb = 0
  doom_light_wp = 0
  doom_light_exit = 0

  doom_diffusers = 0
  doom_returns = 0
  doom_stairs = 0
  mw0 = mw(doom_map)
  mh0 = mh(doom_map)
  for y in 0..(mh0 - 1):
    for x in 0..(mw0 - 1):
      tt = mget(doom_map, x, y)
      if tile_wallish(tt) == 0: doom_floor_tiles = doom_floor_tiles + 1 else: 0
      if tt == 2: doom_doors = doom_doors + 1 else: 0
      if tt == 3: doom_keys = doom_keys + 1 else: 0
      if tt == 4: doom_exits = doom_exits + 1 else: 0
      if tt == 5: doom_monsters = doom_monsters + 1 else: 0
      if tt == 8: doom_lights = doom_lights + 1; doom_light_2x4 = doom_light_2x4 + 1 else: 0
      if tt == 9: doom_lights = doom_lights + 1; doom_light_track = doom_light_track + 1 else: 0
      if tt == 12: doom_lights = doom_lights + 1; doom_light_2x2 = doom_light_2x2 + 1 else: 0
      if tt == 13: doom_lights = doom_lights + 1; doom_light_dl = doom_light_dl + 1 else: 0
      if tt == 16: doom_lights = doom_lights + 1; doom_light_lin = doom_light_lin + 1 else: 0
      if tt == 17: doom_lights = doom_lights + 1; doom_light_hb = doom_light_hb + 1 else: 0
      if tt == 18: doom_lights = doom_lights + 1; doom_light_wp = doom_light_wp + 1 else: 0
      if tt == 19: doom_lights = doom_lights + 1; doom_light_exit = doom_light_exit + 1 else: 0

      if tt == 20: doom_diffusers = doom_diffusers + 1 else: 0
      if tt == 21: doom_returns = doom_returns + 1 else: 0
      if tt == 10 || tt == 11: doom_stairs = doom_stairs + 1 else: 0
      if tile_wallish(tt) == 1:
        if tile_wallish(mget(doom_map, x + 1, y)) == 0 || tile_wallish(mget(doom_map, x - 1, y)) == 0 || tile_wallish(mget(doom_map, x, y + 1)) == 0 || tile_wallish(mget(doom_map, x, y - 1)) == 0: doom_wall_line_tiles = doom_wall_line_tiles + 1 else: 0
        if tile_wallish(mget(doom_map, x + 1, y)) == 0: doom_wall_edges = doom_wall_edges + 1 else: 0
        if tile_wallish(mget(doom_map, x - 1, y)) == 0: doom_wall_edges = doom_wall_edges + 1 else: 0
        if tile_wallish(mget(doom_map, x, y + 1)) == 0: doom_wall_edges = doom_wall_edges + 1 else: 0
        if tile_wallish(mget(doom_map, x, y - 1)) == 0: doom_wall_edges = doom_wall_edges + 1 else: 0
      else:
        0

  doom_wall_h = 8 ft
  doom_wall_lf = doom_wall_line_tiles * tile
  doom_wall_face_lf = doom_wall_edges * tile
  doom_wall_area = doom_wall_face_lf * doom_wall_h

  doom_studs = studs_wall(doom_wall_lf, 16 in, 10)
  doom_plates = plates_lf(doom_wall_lf)
  doom_sheathing = sheets_wall(doom_wall_lf, doom_wall_h, 32 sf, 10, 1)
  doom_drywall = drywall_sheets(doom_wall_area)
  doom_screws = drywall_screws(doom_drywall)
  doom_paint = paint_gal(doom_wall_area, 350, 2, 10)
  doom_mud = mud_gal(doom_wall_area, 100, 3, 10)

  doom_slab_area = doom_floor_tiles * tile * tile
  doom_slab_cy = to_cy(concrete_cy(doom_slab_area, 4 in))

  doom_flooring = flooring_sf(doom_slab_area, 10)
  doom_base = base_trim_lf(doom_wall_lf, 10)

  lf_2x4 = light_fixture("TROFFER_2X4")
  lf_2x2 = light_fixture("TROFFER_2X2")
  lf_dl = light_fixture("DOWNLIGHT_6")
  lf_lin = light_fixture("LINEAR_4FT")
  lf_hb = light_fixture("HIGHBAY")
  lf_wp = light_fixture("WALLPACK")
  lf_exit = light_fixture("EXIT_SIGN")

  doom_light_fix = light_fixtures(doom_lights, 5)
  doom_lt_2x4 = field(light_takeoff(lf_2x4, doom_light_2x4, 5), "count")
  doom_lt_2x2 = field(light_takeoff(lf_2x2, doom_light_2x2, 5), "count")
  doom_lt_dl = field(light_takeoff(lf_dl, doom_light_dl, 5), "count")
  doom_lt_lin = field(light_takeoff(lf_lin, doom_light_lin + doom_light_track, 5), "count")
  doom_lt_hb = field(light_takeoff(lf_hb, doom_light_hb, 5), "count")
  doom_lt_wp = field(light_takeoff(lf_wp, doom_light_wp, 5), "count")
  doom_lt_exit = field(light_takeoff(lf_exit, doom_light_exit, 5), "count")

  duct_trunk = mw0 * tile
  duct_branch = (doom_diffusers + doom_returns) * tile
  duct_len = duct_trunk + duct_branch

  duct_thk = duct_gauge_thk(doom_duct_gauge)
  duct_spec0 = duct_spec(doom_duct_shape, doom_duct_a, doom_duct_b, duct_thk, 490 pcf)
  duct_take = duct_takeoff(duct_spec0, duct_len, 10)
  doom_duct = field(duct_take, "lf")
  doom_duct_wt = field(duct_take, "weight")
  doom_elbows = duct_elbows((doom_diffusers + doom_returns) * 2, 5)
  doom_supply = duct_diffusers(doom_diffusers, 5)
  doom_return = duct_diffusers(doom_returns, 5)

  doom_treads = stair_treads(doom_stairs * 11, 7)
  doom_risers = stair_risers(doom_stairs * 12, 7)

  doom_rect_area = area_rect(mw0 * tile, mh0 * tile)
  doom_rect_perim = perim_rect(mw0 * tile, mh0 * tile)
  doom_shell_poly = poly(pt(0 ft, 0 ft), pt(mw0 * tile, 0 ft), pt(mw0 * tile, mh0 * tile), pt(0 ft, mh0 * tile))
  doom_shell_area = poly_area(doom_shell_poly)
  doom_shell_perim = poly_perim(doom_shell_poly)
  doom_diag = vec_len(vec(mw0 * tile, mh0 * tile))

  doom_slab_wt = weight(doom_slab_cy, mat_concrete)
  doom_conc_cost = cost(doom_slab_cy, mat_concrete)
  doom_gyp_cost = cost(doom_wall_area, mat_gyp)
  doom_paint_cost = cost(doom_wall_area, mat_paint)
  doom_trim_cost = cost(doom_wall_lf, mat_trim)
  doom_duct_cost = cost(doom_duct_wt, mat_duct)

  t_hr = 3600 s
  framing_rate = rate("framing", 55 sf / t_hr, { shift: 0.92; congestion: 0.9 })
  drywall_rate = rate("drywall", 68 sf / t_hr, { shift: 0.95 })
  mep_rate = rate("mep", 42 lf / t_hr, { lift: 0.88 })
  crew_framing = crew(3, framing_rate)
  crew_drywall = crew(4, drywall_rate)
  crew_mep = crew(2, mep_rate)

  framing_time = time_for(doom_wall_area, crew_framing)
  drywall_time = time_for(doom_wall_area, crew_drywall)
  mep_time = time_for(duct_len, crew_mep)
  labor_hours = framing_time + drywall_time + mep_time
  labor_rate = rate("labor", 48 $ / t_hr, { burden: 1.18; ovr: 1.05 })
  labor_cost = labor_hours * rate_eff(labor_rate)

  cost_shell = cost_leaf("Concrete", cost_total(doom_conc_cost)) + cost_leaf("Drywall", cost_total(doom_gyp_cost)) + cost_leaf("Paint", cost_total(doom_paint_cost))
  cost_mep = cost_leaf("Ductwork", cost_total(doom_duct_cost)) + cost_leaf("Trim", cost_total(doom_trim_cost))
  cost_labor = cost_leaf("Labor", cost_total(labor_cost))
  cost_base = cost_shell + cost_mep + cost_labor
  cost_final = ohp(contingency(cost_base, 5%), 8%, 6%)

  sc_base = scenario("Base", { mat: cost_shell + cost_mep; labor: labor_cost; oh: 8%; profit: 6%; tax: 7% })
  sc_prem = scenario("Premium", { mat: cost_shell + cost_mep * 1.18; labor: labor_cost * 1.1; oh: 10%; profit: 8%; tax: 7% })
  doom_budget = sc_eval(sc_base, "tax(ohp(contingency(mat + labor, 5%), oh, profit), tax)")
  doom_budget_hi = sc_eval(sc_prem, "tax(ohp(contingency(mat + labor, 7%), oh, profit), tax)")
  doom_budget_cmp = sc_compare(sc_base, sc_prem, "tax(ohp(contingency(mat + labor, 6%), oh, profit), tax)", "budget")
  doom_budget_delta = field(doom_budget_cmp, "delta")
  doom_budget_pct = field(doom_budget_cmp, "pct")

  cost_graph = graph("doom")
  cost_graph = gnode(cost_graph, "shell", cost_shell)
  cost_graph = gnode(cost_graph, "mep", cost_mep)
  cost_graph = gnode(cost_graph, "labor", cost_labor)
  cost_graph = gnode(cost_graph, "ohp", cost_final - cost_base)
  cost_graph = gcalc(cost_graph)
  doom_graph_total = gsum(cost_graph)

  labor_dist = dist.tri(labor_hours * 0.85, labor_hours * 1.25, labor_hours * 1.05)
  labor_mc = mc(80, labor_dist)
  doom_labor_p50 = field(labor_mc, "p50")
  doom_labor_p90 = field(labor_mc, "p90")
  doom_cost_range = range(doom_budget * 0.9, doom_budget_hi * 1.05)
  doom_cost_mean = mean(doom_cost_range)

  sched = project("doom-level")
  sched = ptask(sched, "framing", { dur: to_sec(if(is_dim(framing_time, "time") == 1, framing_time, framing_time * t_hr)) })
  sched = ptask(sched, "mep", { dur: to_sec(if(is_dim(mep_time, "time") == 1, mep_time, mep_time * t_hr)) })
  sched = ptask(sched, "drywall", { dur: to_sec(if(is_dim(drywall_time, "time") == 1, drywall_time, drywall_time * t_hr)) })
  finishes_time = time_for(doom_flooring, crew(3, rate("floor", 120 sf / t_hr, { eff: 0.9 })))
  sched = ptask(sched, "finishes", { dur: to_sec(if(is_dim(finishes_time, "time") == 1, finishes_time, finishes_time * t_hr)) })
  sched = pdep(sched, "framing", "mep")
  sched = pdep(sched, "mep", "drywall")
  sched = pdep(sched, "drywall", "finishes")
  sched_out = pschedule(sched)
  doom_total_time = field(sched_out, "total_time")

  doom_csi_wall = csi_item("092900")
  doom_csi_mep = csi_item("230000")
  doom_csi_wall_title = csi_title(doom_csi_wall)
  doom_csi_mep_title = csi_title(doom_csi_mep)
  doom_metrics_dirty = 0
else:
  0

# Camera / rendering params
mid = floor(view_h / 2)
fov = 1.05
max_d = 14
ray_step = 0.08
ray_steps = ceil(max_d / ray_step)
ray_col_step = 1
floor_step = 1
ceil_step = 1
tex_res = 1

if doom_view == 0:
  fill(0, 0, w, mid, "muted")
  fill(0, mid, w, view_h - mid, "text")
  raycast_tex(doom_map, doom_px, doom_py, doom_yaw, fov, view_h, max_d, ray_step, ray_steps, ray_col_step, { floor_step: floor_step; ceil_step: ceil_step; tex_res: tex_res })
  cxh = floor(w / 2)
  cyh = floor(view_h / 2)
  line(cxh - 3, cyh, cxh + 3, cyh, "ok")
  line(cxh, cyh - 3, cxh, cyh + 3, "ok")
else:
  fill(0, 0, w, view_h, "muted")
  bs = 6
  mw1 = mw(doom_map)
  mh1 = mh(doom_map)
  bx = floor((w - mw1 * bs) / 2)
  by = floor((view_h - mh1 * bs) / 2)
  duct_x = bx + floor((mw1 * bs) / 2)
  line(duct_x, by, duct_x, by + mh1 * bs, "accent")
  for y in 0..(mh1 - 1):
    for x in 0..(mw1 - 1):
      tt = mget(doom_map, x, y)
      px = bx + x * bs
      py = by + y * bs
      if tt == 1:
        fill(px, py, bs, bs, "accent")
        fill(px + 1, py + 1, bs - 2, bs - 2, "muted")
        fill(px + 2, py + 2, bs - 4, bs - 4, "text")
        line(px + 2, py + 1, px + 2, py + bs - 2, "muted")
        line(px + 4, py + 1, px + 4, py + bs - 2, "muted")
      else:
        if tt == 2:
          fill(px, py, bs, bs, "warn")
          fill(px + 1, py + 1, bs - 2, bs - 2, "muted")
          line(px + 1, py + 1, px + bs - 2, py + bs - 2, "warn")
        else:
          if tile_wallish(tt) == 0: 0 else: 0

      if tt == 3:
        fill(px + 2, py + 2, 2, 2, "warn")
      else:
        if tt == 4:
          fill(px + 2, py + 2, 2, 2, "ok")
        else:
          if tt == 5:
            fill(px + 2, py + 2, 2, 2, "err")
          else:
            if tt == 8 || tt == 9 || tt == 12 || tt == 13 || tt == 16 || tt == 17 || tt == 18 || tt == 19:
              fill(px + 2, py + 2, 2, 2, if(tt == 8, "accent-2", "accent"))
              line(px + 3, py + 3, duct_x, py + 3, "accent")
            else:
              if tt == 10 || tt == 11:
                fill(px + 1, py + 1, bs - 2, bs - 2, "muted")
                rect(px + 1, py + 1, bs - 2, bs - 2, "accent-2")
              else:
                0

  ppx = floor(bx + doom_px * bs)
  ppy = floor(by + doom_py * bs)
  fill(ppx - 1, ppy - 1, 3, 3, "accent-2")
  line(ppx, ppy, ppx + cos(doom_yaw) * 6, ppy + sin(doom_yaw) * 6, "accent-2")

  lx = 2
  ly = 2
  fill(lx, ly, 118, 56, "muted")
  rect(lx, ly, 118, 56, "text")
  txt(lx + 4, ly + 4, "LEGEND", "text", 1)
  fill(lx + 4, ly + 14, 6, 6, "accent")
  txt(lx + 14, ly + 14, "WALL", "text", 1)
  fill(lx + 4, ly + 22, 6, 6, "warn")
  txt(lx + 14, ly + 22, "DOOR", "text", 1)
  fill(lx + 4, ly + 30, 6, 6, "err")
  txt(lx + 14, ly + 30, "MONSTER", "text", 1)
  fill(lx + 4, ly + 38, 6, 6, "ok")
  txt(lx + 14, ly + 38, "EXIT", "text", 1)
  fill(lx + 52, ly + 14, 6, 6, "accent")
  txt(lx + 62, ly + 14, "SHEATH", "text", 1)
  fill(lx + 52, ly + 22, 6, 6, "muted")
  txt(lx + 62, ly + 22, "FRAME", "text", 1)
  fill(lx + 52, ly + 30, 6, 6, "text")
  txt(lx + 62, ly + 30, "DRYW", "text", 1)
  fill(lx + 52, ly + 38, 6, 6, "accent-2")
  txt(lx + 62, ly + 38, "LIGHT", "text", 1)
  fill(lx + 52, ly + 46, 6, 6, "warn")
  txt(lx + 62, ly + 46, "HVAC", "text", 1)

  tx = w - 124
  ty = 2
  fill(tx, ty, 122, 160, "muted")
  rect(tx, ty, 122, 160, "text")
  if doom_panel == 0:
    txt(tx + 4, ty + 4, "TAKEOFF", "text", 1)
    txt(tx + 4, ty + 14, cat("WALL ", str(doom_wall_lf)), "text", 1)
    txt(tx + 4, ty + 22, cat("AREA ", str(doom_wall_area)), "text", 1)
    txt(tx + 4, ty + 30, cat("STUD ", str(doom_studs)), "text", 1)
    txt(tx + 4, ty + 38, cat("PLATE ", str(doom_plates)), "text", 1)
    txt(tx + 4, ty + 46, cat("SHEATH ", str(doom_sheathing)), "text", 1)
    txt(tx + 4, ty + 54, cat("DRYW ", str(doom_drywall)), "text", 1)
    txt(tx + 4, ty + 62, cat("SCREW ", str(doom_screws)), "text", 1)
    txt(tx + 4, ty + 70, cat("MUD ", round(doom_mud * 10) / 10, " gal"), "text", 1)
    txt(tx + 64, ty + 70, cat("PAINT ", round(doom_paint * 10) / 10, " gal"), "text", 1)
    txt(tx + 4, ty + 78, cat("SLAB ", round(doom_slab_cy * 100) / 100, " cy"), "text", 1)
    txt(tx + 64, ty + 78, cat("FLOOR ", str(doom_flooring)), "text", 1)
    txt(tx + 4, ty + 86, cat("BASE ", str(doom_base)), "text", 1)
    txt(tx + 64, ty + 86, cat("LITE ", str(doom_light_fix)), "text", 1)
    txt(tx + 4, ty + 94, cat("DUCT ", str(doom_duct)), "text", 1)
    txt(tx + 64, ty + 94, cat("ELB ", str(doom_elbows)), "text", 1)
    txt(tx + 4, ty + 102, cat("SUP ", str(doom_supply)), "text", 1)
    txt(tx + 64, ty + 102, cat("RET ", str(doom_return)), "text", 1)
    txt(tx + 4, ty + 110, cat("DWT ", str(doom_duct_wt)), "text", 1)
    txt(tx + 4, ty + 118, cat("L24 ", str(doom_lt_2x4)), "text", 1)
    txt(tx + 64, ty + 118, cat("L22 ", str(doom_lt_2x2)), "text", 1)
    txt(tx + 4, ty + 126, cat("DL ", str(doom_lt_dl)), "text", 1)
    txt(tx + 64, ty + 126, cat("LIN ", str(doom_lt_lin)), "text", 1)
    txt(tx + 4, ty + 134, cat("HB ", str(doom_lt_hb)), "text", 1)
    txt(tx + 64, ty + 134, cat("WP ", str(doom_lt_wp)), "text", 1)
    txt(tx + 4, ty + 142, cat("EXIT ", str(doom_lt_exit)), "text", 1)
    txt(tx + 64, ty + 142, cat("STAI ", str(doom_stairs)), "text", 1)
    txt(tx + 4, ty + 150, cat("TRD ", str(doom_treads)), "text", 1)
    txt(tx + 64, ty + 150, cat("RIS ", str(doom_risers)), "text", 1)
  else:
    txt(tx + 4, ty + 4, "COST/SCHED", "text", 1)
    txt(tx + 4, ty + 14, cat("BUD ", round(doom_budget * 1) / 1), "text", 1)
    txt(tx + 4, ty + 22, cat("HI ", round(doom_budget_hi * 1) / 1), "text", 1)
    txt(tx + 4, ty + 30, cat("DELTA ", round(doom_budget_delta * 1) / 1), "text", 1)
    txt(tx + 4, ty + 38, cat("PCT ", round(doom_budget_pct * 1000) / 10, "%"), "text", 1)
    txt(tx + 4, ty + 46, cat("MEAN ", round(doom_cost_mean * 1) / 1), "text", 1)
    txt(tx + 4, ty + 54, cat("LAB P50 ", round(doom_labor_p50 * 10) / 10, " hr"), "text", 1)
    txt(tx + 4, ty + 62, cat("LAB P90 ", round(doom_labor_p90 * 10) / 10, " hr"), "text", 1)
    txt(tx + 4, ty + 70, cat("SCHED ", round(doom_total_time * 10) / 10, " hr"), "text", 1)
    txt(tx + 4, ty + 78, cat("GRAPH ", round(doom_graph_total * 1) / 1), "text", 1)
    txt(tx + 4, ty + 86, cat("CSI ", doom_csi_wall), "text", 1)
    txt(tx + 4, ty + 94, cat(" ", doom_csi_wall_title), "text", 1)
    txt(tx + 4, ty + 102, cat("CSI ", doom_csi_mep), "text", 1)
    txt(tx + 4, ty + 110, cat(" ", doom_csi_mep_title), "text", 1)
    txt(tx + 4, ty + 118, cat("PERIM ", round(doom_shell_perim * 10) / 10), "text", 1)
    txt(tx + 4, ty + 126, cat("AREA ", round(doom_shell_area * 10) / 10), "text", 1)
    txt(tx + 4, ty + 134, cat("DIAG ", round(doom_diag * 10) / 10), "text", 1)
    txt(tx + 4, ty + 142, cat("KEYS ", doom_keys), "text", 1)
    txt(tx + 64, ty + 142, cat("DOOR ", doom_doors), "text", 1)
    txt(tx + 4, ty + 150, cat("MOBS ", doom_monsters), "text", 1)
    txt(tx + 64, ty + 150, cat("EXIT ", doom_exits), "text", 1)

# HUD
hy = view_h
fill(0, hy, w, hud_h, "transparent")
rect(1, hy + 1, w - 2, hud_h - 2, "muted")

# Health / ammo bars
hpw = floor((w - 12) * (doom_hp / 100))
amw = floor((w - 12) * (doom_ammo / 99))
armw = floor((w - 12) * (doom_armor / 100))
stamw = floor((w - 12) * (doom_stamina / 100))
fill(6, hy + 1, armw, 1, "accent-2")
fill(6, hy + 3, hpw, 3, if(doom_hp < 30, "err", "ok"))
fill(6, hy + 8, amw, 2, if(doom_ammo < 8, "warn", "accent"))
fill(6, hy + 10, stamw, 1, if(doom_stamina < 20, "warn", "accent"))

# Key indicator
fill(2, hy + 3, 3, 3, if(doom_key == 1, "warn", "muted"))

# Kills indicator (up to 6 ticks)
for k in 0..5:
  fill(2 + k * 3, hy + 8, 2, 2, if(doom_kills > k, "ok", "muted"))

# Status badge
badge = if(doom_dead == 1, "err", if(doom_win == 1, "ok", if(doom_key == 1, "warn", "accent-2")))
fill(w - 7, hy + 3, 5, 7, badge)

txt(w - 74, hy + 2, cat("E ", if(doom_view == 1, "BP", "3D")), "text", 1)
txt(w - 32, hy + 2, cat("$", str(doom_money)), "text", 1)

if doom_view == 0:
  # Mini-map (top-left)
  mm_s = 2
  mm_x = 2
  mm_y = 2
  mm_r = 6
  mx0 = floor(doom_px) - mm_r
  my0 = floor(doom_py) - mm_r
  for my in my0..(my0 + mm_r * 2):
    for mx in mx0..(mx0 + mm_r * 2):
      tt = mget(doom_map, mx, my)
      cc = if(tt == 1, "muted", if(tt == 2, "warn", if(tt == 4, "ok", if(tt == 3, "warn", if(tt == 5, "err", if(tt == 6, "ok", if(tt == 7, "accent-2", if(tt == 8 || tt == 9, "warn", if(tt == 10 || tt == 11, "accent", "transparent")))))))))
      ix = mx - mx0
      iy = my - my0
      if cc != "transparent": fill(mm_x + ix * mm_s, mm_y + iy * mm_s, mm_s, mm_s, cc) else: 0
  pxm = floor(mm_x + (doom_px - mx0) * mm_s)
  pym = floor(mm_y + (doom_py - my0) * mm_s)
  fill(pxm, pym, 2, 2, "accent")
else:
  0

# Export a deterministic hash for tests
doom_hash = floor((abs(sin(time * 3.1 + doom_px * 1.7 + doom_py * 2.3 + doom_yaw)) + 0.5) * 1000000) + frame * 1000003
set("doom_hash", doom_hash)
`;

export function runDoomDemo({ gfx, writeLine, writeInputEcho }) {
  writeLine("Doom level - playable EST DSL raycaster", "muted");
  writeLine("Click the canvas to capture the mouse.", "muted");
  writeLine("Controls: Mouse look • WASD move/strafe • Shift run • Space use • LMB shoot • E view • Q panel • F upgrade", "muted");
  writeLine("Loop UI: P play/pause (when mouse not captured) • Arrows step/fps • R reset", "muted");

  if (typeof gfx.setActiveBackend === "function"){
    try{
      gfx.setActiveBackend("webgl2");
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

  gfx.configureLoop(DOOM_DEMO_SCRIPT, DOOM_DEFAULT_FPS);
  gfx.playLoop();
}
