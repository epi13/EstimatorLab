export function createTests({
  state,
  setStatus,
  writeLine,
  renderUserFunctions,
  evaluate,
  runExpression,
  solveEquation,
  defineUserFn,
  createAssembly,
  formatAssemblySummary,
  splitStatements,
  isTruthy,
  normalizeCompare,
  makeQty,
  isQty,
  formatInput,
  qtyToString,
}){
  const expectQty = (value, kind, tol = 1e-6) => ({ type: "qty", value, kind, tol });
  const expectNear = (value, tol = 1e-6) => ({ type: "scalar", value, tol });
  const expectError = (message) => ({ type: "error", message });

  function createTestSuite(){
    return [
      { name: "basic arithmetic", expr: "2+2", expect: 4 },
      { name: "operator precedence", expr: "2+2*5", expect: 12 },
      { name: "parentheses", expr: "(2+2)*5", expect: 20 },
      { name: "exponentiation", expr: "2^3", expect: 8 },
      { name: "comparisons", expr: "3 > 2", expect: 1 },
      { name: "logic", expr: "1 && 0", expect: 0 },
      { name: "subtraction", expr: "10-3", expect: 7 },
      { name: "division", expr: "20/4", expect: 5 },
      { name: "combined ops", expr: "18/3+2*4", expect: 14 },
      { name: "absolute value", expr: "abs(-12)", expect: 12 },
      { name: "min max", expr: "max(5, min(3, 9))", expect: 5 },
      { name: "rounding", expr: "round(2.6)", expect: 3 },
      { name: "ceil", expr: "ceil(2.1)", expect: 3 },
      { name: "floor", expr: "floor(2.9)", expect: 2 },
      { name: "sqrt", expr: "sqrt(81)", expect: 9 },
      { name: "pow function", expr: "pow(3, 4)", expect: 81 },
      { name: "log/exp", expr: "log(exp(2))", expect: expectNear(2) },
      { name: "sine", expr: "sin(pi / 2)", expect: expectNear(1) },
      { name: "atan2", expr: "atan2(1, 1)", expect: expectNear(Math.PI / 4) },
      { name: "clamp", expr: "clamp(12, 0, 10)", expect: 10 },
      { name: "if function", expr: "if(3>2, 7, 4)", expect: 7 },
      { name: "pi constant", expr: "pi * 2", expect: expectNear(Math.PI * 2) },
      { name: "assignment + reference", steps: ["x = 10", "x * 3"], expect: 30 },
      { name: "variable reassignment", steps: ["x = 5", "x = x + 2", "x"], expect: 7 },
      { name: "unit addition", expr: "12 in + 1 ft", expect: expectQty(2, "len") },
      { name: "linear foot unit", expr: "10 lf", expect: expectQty(10, "len") },
      { name: "unit subtraction", expr: "5 ft - 6 in", expect: expectQty(4.5, "len") },
      { name: "unit scaling", expr: "3 * 4 ft", expect: expectQty(12, "len") },
      { name: "area from multiplication", expr: "12 ft * 10 ft", expect: expectQty(120, "area") },
      { name: "rectangle area helper", expr: "area_rect(12 ft, 8 ft)", expect: expectQty(96, "area") },
      { name: "volume helper", expr: "vol_rect(1200 sf, 4 in)", expect: expectQty(400, "vol") },
      { name: "concrete volume", expr: "concrete_cy(1200 sf, 4 in)", expect: expectQty(400, "vol") },
      { name: "waste factor", expr: "waste(500 sf, 10)", expect: expectQty(550, "area") },
      { name: "markup", expr: "markup(200, 15)", expect: 230 },
      { name: "burden", expr: "burden(80, 25)", expect: 100 },
      { name: "round up", expr: "round_up(11, 5)", expect: 15 },
      { name: "round up qty", expr: "round_up(5.1 ft, 2 ft)", expect: expectQty(6, "len") },
      { name: "unit cost", expr: "unit(1200, 30)", expect: 40 },
      { name: "circle area", expr: "area_circle(10 ft)", expect: expectNear(Math.PI * 25) },
      { name: "pipe weight", expr: "pipe_wt(2, 40, 10 ft)", expect: expectQty(36.5, "wt") },
      { name: "pipe weight alt", expr: "pipe_wt(1, 80, 5 ft)", expect: expectQty(10.85, "wt") },
      { name: "board feet", expr: "bf(2, 6, 8, 12)", expect: 96 },
      { name: "mil unit", expr: "1000 mil", expect: expectQty(1/12, "len") },
      { name: "square inches", expr: "144 in2", expect: expectQty(1, "area") },
      { name: "convert length to inches", expr: "to_in(2 ft)", expect: 24 },
      { name: "generic to() length conversion", expr: "to(2 ft, in)", expect: 24 },
      { name: "convert length to feet", expr: "to_ft(18 in)", expect: 1.5 },
      { name: "convert area to sf", expr: "to_sf(2 sy)", expect: 18 },
      { name: "convert area to sy", expr: "to_sy(90 sf)", expect: 10 },
      { name: "convert volume to cf", expr: "to_cf(2 cy)", expect: 54 },
      { name: "convert volume", expr: "to_cy(27 cf)", expect: 1 },
      { name: "convert weight to lb", expr: "to_lb(2 ton)", expect: 4000 },
      { name: "convert weight to ton", expr: "to_ton(1000 lb)", expect: 0.5 },
      { name: "pressure conversion", expr: "to(1 psi, psf)", expect: 144 },
      { name: "pressure aliases", expr: "to(1 psig, psi) + to(1 psia, psi)", expect: 2 },
      { name: "ksi alias", expr: "to(1 ksi, kip_per_in2)", expect: 1 },
      { name: "productivity sf/hr", expr: "to((3600 sfhr) * (1 hr), sf)", expect: 3600 },
      { name: "productivity sy/hr", expr: "to((3600 syhr) * (1 hr), sf)", expect: 32400 },
      { name: "productivity cy/hr", expr: "to((3600 cyhr) * (1 hr), cf)", expect: 97200 },
      { name: "percent token waste", expr: "to_sf(waste(100 sf, 10%))", expect: 110 },
      { name: "percent token markup", expr: "markup(100, 10%)", expect: 110 },
      { name: "currency composite formatting", expr: "unit(1200 $, 300 sf)", expect: expectQty(4, "cur*len^-2") },
      { name: "clamp qty", expr: "clamp(12 ft, 0 ft, 10 ft)", expect: expectQty(10, "len") },
      { name: "user solution", steps: ["so crew_cost(rate, hours) = rate * hours", "crew_cost(85, 12)"], expect: 1020 },
      { name: "user solution with units", steps: ["so wall_area(len, ht) = len * ht", "wall_area(12 ft, 8 ft)"], expect: expectQty(96, "area") },
      { name: "define meta function", steps: ["define(\"adder\", \"a,b\", \"a+b\")", "adder(4, 6)"], expect: 10 },
      { name: "methods listing", steps: ["define(\"double\", \"x\", \"x*2\")", "methods()"], expect: "double" },
      { name: "vars listing", steps: ["a = 1", "b = 2", "vars()"], expect: "a, b" },
      { name: "meta helpers", steps: ["set(\"crew\", 5)", "get(\"crew\")"], expect: 5 },
      { name: "unset meta", steps: ["set(\"crew\", 5)", "unset(\"crew\")"], expect: 1 },
      { name: "eval expression", steps: ["eval(\"2+3*4\")"], expect: 14 },
      { name: "undefine solution", steps: ["define(\"temp\", \"x\", \"x+1\")", "undefine(\"temp\")"], expect: 1 },
      { name: "if statement", steps: ["total = 0", "if 3 > 2: total = 5 else: total = 2", "total"], expect: 5 },
      { name: "nested if statement", steps: ["total = 0", "if 2 > 3: total = 1 else: if 4 > 2: total = 7 else: total = 3", "total"], expect: 7 },
      { name: "for loop", steps: ["total = 0", "for i in 1..4: total = total + i", "total"], expect: 10 },
      { name: "for loop step", steps: ["total = 0", "for i in 1..5 step 2: total = total + i", "total"], expect: 9 },
      { name: "for loop descending", steps: ["total = 0", "for i in 5..1 step -2: total = total + i", "total"], expect: 9 },
      { name: "for loop unit range", steps: ["total = 0 ft", "for i in 1 ft..3 ft: total = total + i", "total"], expect: expectQty(6, "len") },
      { name: "repeat loop", steps: ["total = 0", "repeat 3: total = total + 2", "total"], expect: 6 },
      { name: "repeat loop with units", steps: ["total = 0 ft", "repeat 3: total = total + 2 ft", "total"], expect: expectQty(6, "len") },
      { name: "equation solver", expr: "56 cy = concrete_cy(sf, 6 in)", expect: 3024 },
      { name: "equation solver larger", expr: "100 cy = concrete_cy(sf, 8 in)", expect: 4050 },
      {
        name: "nested markup loop total",
        steps: [
          "so item_cost(rate, hours, waste_pct) = markup(rate * hours, waste_pct)",
          "total = 0",
          "for crew in 1..3: total = total + item_cost(45 + crew * 5, 8 + crew, 10)",
          "if total > 0: total = round(total) else: total = 0",
          "total",
        ],
        expect: 1826,
      },
      {
        name: "looped unit accumulation",
        steps: ["total = 0 ft", "for i in 1..5: total = total + (i * (2 ft))", "total"],
        expect: expectQty(30, "len"),
      },
      {
        name: "area waste rounding chain",
        steps: [
          "base = area_rect(45 ft, 30 ft)",
          "with_waste = waste(base, 12.5)",
          "with_waste_sy = to_sy(with_waste)",
          "round_up(with_waste_sy, 5)",
        ],
        expect: 170,
      },
      {
        name: "bay area loop accumulation",
        steps: [
          "so bay_area(span, bays) = area_rect(span, 20 ft) * bays",
          "total = 0 sf",
          "for i in 1..4: total = total + bay_area(15 ft + i ft, i)",
          "total",
        ],
        expect: expectQty(3600, "area"),
      },
      {
        name: "conditional scoring loop",
        steps: [
          "score = 0",
          "for i in 1..6: if i > 3 && i < 6: score = score + i else: score = score + (i * 2)",
          "score",
        ],
        expect: 33,
      },
      {
        name: "repeat bump function",
        steps: ["so bump(x) = x * 1.1 + 3", "val = 0", "repeat 4: val = bump(val)", "val"],
        expect: expectNear(13.923),
      },
      {
        name: "trench volume to cy",
        steps: [
          "so trench_vol(len, width, depth) = vol_rect(area_rect(len, width), depth)",
          "volume = trench_vol(120 ft, 3 ft, 2 ft)",
          "to_cy(volume)",
        ],
        expect: expectNear(26.6666666667),
      },
      {
        name: "eval with variables",
        steps: ["x = 12", "y = 3", "eval(\"x^2 + y^3 + 2*x*y\")"],
        expect: 243,
      },
      {
        name: "unit comparisons with if",
        steps: [
          "total = 0 ft",
          "if 2 ft > 1 ft: total = total + 3 ft else: total = total + 5 ft",
          "if total >= 3 ft: total = total + 2 ft else: total = total + 1 ft",
          "total",
        ],
        expect: expectQty(5, "len"),
      },
      {
        name: "log sqrt trig compound",
        expr: "log(exp(3)) + sqrt(144) - (sin(pi/6)^2 + cos(pi/6)^2)",
        expect: expectNear(14),
      },
      {
        name: "unit cost with markup and burden",
        expr: "unit(markup(200, 15) + burden(80, 25), 4)",
        expect: 82.5,
      },
      {
        name: "meta set/get with arithmetic",
        steps: ["set(\"crew\", 4)", "set(\"rate\", 95)", "get(\"crew\") * get(\"rate\") * 8"],
        expect: 3040,
      },
      {
        name: "slab volume to cy",
        steps: [
          "so slab_volume(area, thk_in) = vol_rect(area, thk_in)",
          "volume = slab_volume(2400 sf, 5 in)",
          "to_cy(volume)",
        ],
        expect: expectNear(37.037037037),
      },
      {
        name: "for loop with computed step",
        steps: ["total = 0", "for i in 2..10 step 2 + 1: total = total + i", "total"],
        expect: 15,
      },
      {
        name: "descending loop with condition",
        steps: [
          "total = 0",
          "for i in 9..1 step -2: if i > 4: total = total + i else: total = total + (i * 2)",
          "total",
        ],
        expect: 29,
      },
      {
        name: "repeat loop unit round_up",
        steps: ["total = 0 ft", "repeat 4: total = total + 2.5 ft", "round_up(total, 2 ft)"],
        expect: expectQty(10, "len"),
      },
      {
        name: "if function with logical",
        expr: "if(5 > 3 && 2 < 1, 10, 20) + if(3 == 3, 7, 0)",
        expect: 27,
      },
      {
        name: "unit conversion length expression",
        expr: "to_in(6 ft + 18 in)",
        expect: 90,
      },
      {
        name: "equation solver slab area",
        expr: "80 cy = concrete_cy(sf, 5 in)",
        expect: 5184,
      },
      {
        name: "pipe weight to tons",
        steps: ["wt = pipe_wt(2, 40, 120 ft)", "to_ton(wt)"],
        expect: expectNear(0.219),
      },
      { name: "gfx create buffer", expr: "gfx(12, 8)", expect: "gfx 12x8" },
      {
        name: "gfx scale and background",
        steps: ["gfx(8, 6)", "gfxs(3)", "bg(\"accent\")"],
        expect: "accent",
      },
      {
        name: "gfx pixel + line",
        steps: ["gfx(10, 10)", "pix(0, 0, \"ok\")", "line(0, 0, 9, 9, \"warn\")"],
        expect: 1,
      },
      {
        name: "gfx fill plot rect",
        steps: [
          "gfx(12, 12)",
          "fill(2, 2, 8, 8, \"accent-2\")",
          "plot(1, 10, \"1,0|1,0|0,-1|0,-1\", \"err\")",
          "rect(0, 0, 12, 12, \"muted\")",
        ],
        expect: 1,
      },
      {
        name: "gfx user solution tile pattern",
        steps: [
          "gfx(20, 12)",
          "so tile(x, y, sz) = rect(x, y, sz, sz, \"accent\") + line(x, y, x + sz - 1, y + sz - 1, \"ok\") + line(x + sz - 1, y, x, y + sz - 1, \"warn\") + plot(x + 1, y + 1, \"1,0|0,1|1,0\", \"err\")",
          "total = 0",
          "for i in 0..3: total = total + tile(i * 4, 2, 3)",
          "total",
        ],
        expect: 16,
      },
      {
        name: "user solution sparse structured data repl",
        steps: [
          "assy wall_main = { studs = 16 in o.c.; height = 10 ft; sheathing = 1 }",
          "assy wall_alt = { height = 12 ft; sheathing = 2 }",
          "assy wall_misc = { studs = 24 in o.c.; height = 9 ft; fire_rating = \"1 hr\" }",
          "so default(val, fallback) = if(val == 0, fallback, val)",
          "so line_total(qty, unit_cost, labor, waste) = if(qty > 0, markup(qty * unit_cost + labor, waste), 0)",
          "so pick_cost(trade, target, cost) = if(trade == target, cost, 0)",
          "so pick_area(trade, target, area) = if(trade == target, area, 0 sf)",
          "trade_1 = \"framing\"",
          "name_1 = \"studs\"",
          "qty_1 = 420 lf",
          "unit_1 = 1.35",
          "labor_1 = 300",
          "waste_1 = 8",
          "trade_2 = \"skin\"",
          "name_2 = \"sheathing\"",
          "qty_2 = 1200 sf",
          "unit_2 = 0.85",
          "labor_2 = 0",
          "waste_2 = 12",
          "trade_3 = \"framing\"",
          "name_3 = \"blocking\"",
          "qty_3 = 0 lf",
          "unit_3 = 1.1",
          "labor_3 = 180",
          "waste_3 = 5",
          "len_main = 120 ft",
          "len_alt = 80 ft",
          "len_misc = 40 ft",
          "layers_main = 1",
          "layers_alt = 2",
          "layers_misc = 0",
          "adj_layers_misc = default(layers_misc, 1)",
          "takeoff_main = qty(wall_main, len_main)",
          "takeoff_alt = qty(wall_alt, len_alt)",
          "takeoff_misc = qty(wall_misc, len_misc)",
          "area_main = area_rect(len_main, 10 ft) * layers_main",
          "area_alt = area_rect(len_alt, 12 ft) * layers_alt",
          "area_misc = area_rect(len_misc, 9 ft) * adj_layers_misc",
          "framing_area = pick_area(trade_1, \"framing\", area_main) + pick_area(trade_2, \"framing\", area_alt) + pick_area(trade_3, \"framing\", area_misc)",
          "skin_area = pick_area(trade_1, \"skin\", area_main) + pick_area(trade_2, \"skin\", area_alt) + pick_area(trade_3, \"skin\", area_misc)",
          "cost_1 = line_total(to_ft(qty_1), unit_1, labor_1, waste_1)",
          "cost_2 = line_total(to_sf(qty_2), unit_2, labor_2, waste_2)",
          "cost_3 = line_total(to_ft(qty_3), unit_3, labor_3, waste_3)",
          "framing_cost = pick_cost(trade_1, \"framing\", cost_1) + pick_cost(trade_2, \"framing\", cost_2) + pick_cost(trade_3, \"framing\", cost_3)",
          "skin_cost = pick_cost(trade_1, \"skin\", cost_1) + pick_cost(trade_2, \"skin\", cost_2) + pick_cost(trade_3, \"skin\", cost_3)",
          "framing_rate = framing_cost / to_sf(framing_area)",
          "skin_rate = skin_cost / to_sf(skin_area)",
          "round((framing_rate + skin_rate) * 100) / 100",
        ],
        expect: expectNear(1.2, 1e-2),
      },
      {
        name: "user solution gfx spinning cube animation",
        steps: [
          "gfx(64, 64)",
          "gfxs(2)",
          "bg(\"muted\")",
          "so rx(x, z, a) = x * cos(a) - z * sin(a)",
          "so rz(x, z, a) = x * sin(a) + z * cos(a)",
          "so ry(y, z, a) = y * cos(a) - z * sin(a)",
          "so rz2(y, z, a) = y * sin(a) + z * cos(a)",
          "so persp(v, z) = v * (22 / (z + 4))",
          "so px(x, y, z, ay, ax) = round(32 + persp(rx(x, z, ay), rz2(ry(y, rz(x, z, ay), ax), rz(x, z, ay), ax)))",
          "so py(x, y, z, ay, ax) = round(32 - persp(ry(y, rz(x, z, ay), ax), rz2(ry(y, rz(x, z, ay), ax), rz(x, z, ay), ax)))",
          "gfxloop(\"cls(); ay = time * 0.7 + (key_left - key_right) * 0.3; ax = time * 0.5 + (key_up - key_down) * 0.3; ax0 = px(-1, -1, -1, ay, ax); ay0 = py(-1, -1, -1, ay, ax); bx0 = px(1, -1, -1, ay, ax); by0 = py(1, -1, -1, ay, ax); cx0 = px(1, 1, -1, ay, ax); cy0 = py(1, 1, -1, ay, ax); dx0 = px(-1, 1, -1, ay, ax); dy0 = py(-1, 1, -1, ay, ax); ex0 = px(-1, -1, 1, ay, ax); ey0 = py(-1, -1, 1, ay, ax); fx0 = px(1, -1, 1, ay, ax); fy0 = py(1, -1, 1, ay, ax); gx0 = px(1, 1, 1, ay, ax); gy0 = py(1, 1, 1, ay, ax); hx0 = px(-1, 1, 1, ay, ax); hy0 = py(-1, 1, 1, ay, ax); hash = ax0 + ay0 + bx0 + by0 + cx0 + cy0 + dx0 + dy0 + ex0 + ey0 + fx0 + fy0 + gx0 + gy0 + hx0 + hy0 + frame * 100000; drawn = 0; drawn = drawn + pix(32, 32, 'err'); drawn = drawn + line(ax0, ay0, bx0, by0, 'accent'); drawn = drawn + line(bx0, by0, cx0, cy0, 'accent'); drawn = drawn + line(cx0, cy0, dx0, dy0, 'accent'); drawn = drawn + line(dx0, dy0, ax0, ay0, 'accent'); drawn = drawn + line(ex0, ey0, fx0, fy0, 'ok'); drawn = drawn + line(fx0, fy0, gx0, gy0, 'ok'); drawn = drawn + line(gx0, gy0, hx0, hy0, 'ok'); drawn = drawn + line(hx0, hy0, ex0, ey0, 'ok'); drawn = drawn + line(ax0, ay0, ex0, ey0, 'warn'); drawn = drawn + line(bx0, by0, fx0, fy0, 'warn'); drawn = drawn + line(cx0, cy0, gx0, gy0, 'warn'); drawn = drawn + line(dx0, dy0, hx0, hy0, 'warn'); set('cube_hash', hash); set('cube_drawn', drawn); set('cube_frame', frame); set('cube_time', time); set('cube_dt', dt)\")",
          "gfxfps(30)",
          "gfxstep(0)",
          "h0 = get(\"cube_hash\")",
          "draw0 = get(\"cube_drawn\")",
          "f0 = get(\"cube_frame\")",
          "d0 = get(\"cube_dt\")",
          "gfxstep(1)",
          "h1 = get(\"cube_hash\")",
          "gfxstep(9)",
          "h10 = get(\"cube_hash\")",
          "gfxrewind(10)",
          "h0b = get(\"cube_hash\")",
          "check = if(draw0 == 13 && f0 == 0 && abs(d0 - (1/30)) < 1e-9 && h1 != h0 && h10 != h1 && abs(h0b - h0) < 1e-9, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "user solution dependency mutation graph",
        steps: [
          "len = 10 ft",
          "width = 5 ft",
          "area = len * width",
          "total = area * 2",
          "len = 12 ft",
          "width = 6 ft",
          "stale_area = area",
          "area = 200 sf",
          "total = total + area",
          "check = if(stale_area == 50 sf && area == 200 sf && total == 300 sf, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "user solution mixed units conversion chain",
        steps: [
          "run = 2 ft + 6 in",
          "rise = 3 ft + 4 in",
          "run_ft = to_ft(run)",
          "rise_ft = to_ft(rise)",
          "slope_ft = sqrt(run_ft^2 + rise_ft^2)",
          "area = area_rect(run, 4 ft) + area_rect(1 yd, 2 ft)",
          "area_sy = to_sy(area)",
          "area_back = to_sf(area_sy sy)",
          "len_in = to_in(run)",
          "check = if(len_in == 30 && abs(area_back - to_sf(area)) < 1e-6 && slope_ft > 4, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "unit mismatch blocks illegal math",
        expr: "1 ft + 1 sf",
        expect: expectError(/Unit mismatch/),
      },
      {
        name: "unit conversion guards mismatched dimensions",
        expr: "to_sf(10 ft)",
        expect: expectError("to_sf expects area"),
      },
      {
        name: "user solution temporal history diff",
        steps: [
          "cost = 1200",
          "cost_v1 = cost",
          "cost = markup(cost, 10)",
          "cost_v2 = cost",
          "cost = markup(cost, 5)",
          "cost_v3 = cost",
          "delta_12 = cost_v2 - cost_v1",
          "delta_23 = cost_v3 - cost_v2",
          "delta_total = cost_v3 - cost_v1",
          "check = if(delta_12 == 120 && delta_23 == 66 && delta_total == 186, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "circular function call detection",
        steps: [
          "so a(x) = b(x) + 1",
          "so b(x) = c(x) + 1",
          "so c(x) = a(x) + 1",
          "a(1)",
        ],
        expect: expectError(/Circular function call/),
      },
      {
        name: "forward reference requires definition",
        steps: [
          "so price_with_tax(x) = x + tax",
          "price_with_tax(100)",
        ],
        expect: expectError("Unknown identifier: tax"),
      },
      {
        name: "forward reference resolves after definition",
        steps: [
          "so price_with_tax(x) = x + tax",
          "tax = 8",
          "price_with_tax(100)",
        ],
        expect: 108,
      },
      {
        name: "large data streaming accumulation",
        steps: [
          "sum = 0",
          "for i in 1..200: sum = sum + i",
          "even_sum = 0",
          "for i in 2..200 step 2: even_sum = even_sum + i",
          "rolling = 0",
          "repeat 5: rolling = rolling + sum",
          "area_total = 0 sf",
          "for i in 1..10: area_total = area_total + (i * 10 sf)",
          "check = if(sum == 20100 && even_sum == 10100 && rolling == 100500 && area_total == 550 sf, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "precision accumulation drift check",
        steps: [
          "sum = 0",
          "repeat 100: sum = sum + 0.1",
          "sum",
        ],
        expect: expectNear(10, 1e-6),
      },
      {
        name: "user solution ambiguous profile selection",
        steps: [
          "so markup_a(x) = x * 1.25",
          "so markup_b(x) = x * 1.30",
          "so pick_markup(x, profile) = if(profile == \"A\", markup_a(x), markup_b(x))",
          "result_a = pick_markup(100, \"A\")",
          "result_b = pick_markup(100, \"B\")",
          "check = if(result_a == 125 && result_b == 130, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "assy qty detailed takeoff string",
        steps: [
          "assy wall = { studs = 16 in o.c.; height = 8 ft; sheathing = 2 }",
          "len = 32 ft",
          "takeoff = qty(wall, len)",
          "takeoff",
        ],
        expect: "len: 32 ft | studs: 25 ea | stud length: 200 ft | area: 256 sf | sheathing x2: 512 sf",
      },
      {
        name: "meta stores active assembly and consumes via get()",
        steps: [
          "assy wallA = { studs = 16 in o.c.; height = 10 ft; sheathing = 1 }",
          "assy wallB = { studs = 24 in o.c.; height = 12 ft; sheathing = 2 }",
          "set(\"active\", wallB)",
          "so takeoff(assy, len) = qty(assy, len)",
          "len = 48 ft",
          "result = takeoff(get(\"active\"), len)",
          "result",
        ],
        expect: "len: 48 ft | studs: 25 ea | stud length: 300 ft | area: 576 sf | sheathing x2: 1152 sf",
      },
      {
        name: "equation solves for thickness in inches",
        steps: [
          "area = 2400 sf",
          "target = 100",
          "target cy = concrete_cy(area, t in)",
          "t",
        ],
        expect: expectNear(13.5),
      },
      {
        name: "unit pipe weight accumulation with loop + if()",
        steps: [
          "total = 0 lb",
          "so segment(i) = if(i < 3, pipe_wt(2, 40, 10 ft), pipe_wt(1, 80, 5 ft))",
          "for i in 1..4: total = total + segment(i)",
          "total",
        ],
        expect: expectQty(94.7, "wt"),
      },
      {
        name: "room program takeoff chain with waste/convert/round_up",
        steps: [
          "so room_area(i) = area_rect(10 ft + i ft, 12 ft)",
          "base = 0 sf",
          "for i in 1..5: base = base + room_area(i)",
          "with_waste = waste(base, 7.5)",
          "area_sy = to_sy(with_waste)",
          "round_up(area_sy, 5)",
        ],
        expect: 95,
      },
      {
        name: "meta-defined function + eval + methods registry consistency",
        steps: [
          "define(\"adder\", \"a,b\", \"a+b\")",
          "define(\"mul3\", \"x\", \"x*3\")",
          "so square(x) = x ^ 2",
          "value = eval(\"adder(2,3) + mul3(4) + square(5)\")",
          "names = methods()",
          "check = if(value == 42 && names == \"adder, mul3, square\", 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "nested meta get/set drives rate model inside user solutions",
        steps: [
          "set(\"rate_base\", 50)",
          "set(\"burden_pct\", 18)",
          "set(\"markup_pct\", 12)",
          "so loaded_rate() = burden(get(\"rate_base\"), get(\"burden_pct\"))",
          "total = 0",
          "for crew in 1..4: total = total + (loaded_rate() * (8 + crew))",
          "result = round(markup(total, get(\"markup_pct\")) * 100) / 100",
          "result",
        ],
        expect: expectNear(2775.36),
      },
      {
        name: "unit-range loop + conditional + repeat with implicit unit math",
        steps: [
          "total = 0 ft",
          "for x in 1 ft..10 ft step 3 ft: total = total + x",
          "if total > 20 ft: total = total + 2 ft else: total = total + 1 ft",
          "repeat 3: total = total + 6 in",
          "total",
        ],
        expect: expectQty(25.5, "len"),
      },
      {
        name: "gfx loop script mutates state via set/get with for loop",
        steps: [
          "gfx(16, 8)",
          "gfxs(2)",
          "bg(\"muted\")",
          "set(\"hits\", 0)",
          "gfxloop(\"cls(); total = 0; for i in 0..3: total = total + pix(i, frame, \\\"ok\\\"); set(\\\"hits\\\", total)\")",
          "gfxstep(5)",
          "get(\"hits\")",
        ],
        expect: 4,
      },
      {
        name: "map builtins - parse + dimensions + spawn",
        steps: [
          "m = map(\"####|#S.#|#..#|####\")",
          "w = mw(m)",
          "h = mh(m)",
          "sx = mspawnx(m)",
          "spy = mspawny(m)",
          "check = if(w == 4 && h == 4 && abs(sx - 1.5) < 1e-9 && abs(spy - 1.5) < 1e-9, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "map builtins - get/set",
        steps: [
          "m = map(\"###|#.#|###\")",
          "a = mget(m, 0, 0)",
          "b = mget(m, 1, 1)",
          "ok1 = if(a == 1 && b == 0, 1, 0)",
          "mset(m, 1, 1, 2)",
          "c = mget(m, 1, 1)",
          "ok2 = if(c == 2, 1, 0)",
          "ok1 + ok2",
        ],
        expect: 2,
      },
      {
        name: "doom test - gfx loop determinism (playable level)",
        steps: [
          "gfx(80, 45)",
          "gfxs(2)",
          "bg(\"transparent\")",
          "gfxfps(30)",
          "gfxloop(\"# Doom loop - minimal deterministic harness\nif has('doom_init') == 0: doom_init = 1; doom_map = map('#####|#S..#|#...#|#..E#|#####'); doom_px = mspawnx(doom_map); doom_py = mspawny(doom_map) else: 0;\ndoom_yaw = frame * 0.01;\ndoom_hash = floor((abs(sin(time * 3.1 + doom_px * 1.7 + doom_py * 2.3 + doom_yaw)) + 0.5) * 1000000) + frame * 1000003;\nset('doom_hash', doom_hash);\n\")",
          "gfxstep(0)",
          "h0 = get(\"doom_hash\")",
          "gfxstep(1)",
          "h1 = get(\"doom_hash\")",
          "gfxstep(9)",
          "h10 = get(\"doom_hash\")",
          "gfxrewind(10)",
          "h0b = get(\"doom_hash\")",
          "check = if(h1 != h0 && h10 != h1 && abs(h0b - h0) < 1e-9, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "equation-driven slab plan with gfx marker + cost model",
        steps: [
          "target = 50",
          "thk = 6 in",
          "target cy = concrete_cy(area, thk)",
          "cost_per_cy = 125",
          "total_cost = markup(target * cost_per_cy, 10)",
          "bar = round(area / 200)",
          "gfx(20, 5)",
          "cls()",
          "line(0, 0, bar, 0, \"ok\")",
          "check = if(area == 2700 && abs(total_cost - 6875) < 1e-6 && bar == 14, 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "EST DSL kitchen sink",
        steps: [
          "# full DSL coverage (syntax + helpers)",
          "total = 0",
          "def inc(x) = x + 1",
          "fn dec(x) = x - 1",
          "function mix(a,b) = if(a != b || a == 0, a + b, a - b)",
          "assy wall = { studs = 16 in o.c.; height = 10 ft; sheathing = 2 }",
          "len = 24 ft",
          "takeoff = qty(wall, len)",
          "set(\"note\", \"line1\\nline2\")",
          "note_ok = if(get(\"note\") == \"line1\\nline2\", 1, 0)",
          "if note_ok == 1:",
          "  total = total + 1",
          "for i in 1..4 step 1: total = total + inc(i) + dec(i)",
          "repeat 3: total = total + mix(1,0)",
          "bounds = if(total >= 0 && total <= 24, 1, 0)",
          "if total < 0:",
          "  total = 999",
          "val = 2(3+4) + 2pi",
          "tri = log10(1000) + atan(1) + tan(0) + asin(0) + acos(1) + e - e",
          "u = to(24 in, \"ft\")",
          "gfx(32, 20)",
          "gfxbackend(\"2d\")",
          "m = map(\"#####|#S..#|#...#|#####\")",
          "raycast(m, mspawnx(m), mspawny(m), 0, 1.0, 20, 8, 0.1, 40, 2)",
          "check = if(total == 24 && bounds == 1 && abs(val - (14 + 2 * pi)) < 1e-9 && abs(tri - (3 + (pi/4))) < 1e-9 && u == 2 && takeoff != \"\", 1, 0)",
          "check",
        ],
        expect: 1,
      },

      {
        name: "line item total with meta",
        steps: [
          "l = line(\"studs\", 100 lf, 2.5 $, {trade: \"framing\", csi: \"06 11 16\", waste: 10%, markup: 5%})",
          "field(l, \"trade\")",
        ],
        expect: "framing",
      },
      {
        name: "rollup by trade",
        steps: [
          "a = line(\"a\", 10 ea, 5 $, {trade: \"t1\"})",
          "b = line(\"b\", 20 ea, 2 $, {trade: \"t1\"})",
          "c = line(\"c\", 1 ea, 100 $, {trade: \"t2\"})",
          "r = rollup(a, b, c)",
          "to( field(r, \"total\"), usd )",
        ],
        expect: 190,
      },
      {
        name: "json roundtrip preserves qty",
        steps: [
          "x = 12 ft",
          "j = to_json(x)",
          "y = from_json(j)",
          "to_in(y)",
        ],
        expect: 144,
      },
      {
        name: "mc dist returns summary assy",
        steps: [
          "d = dist.normal(100, 10)",
          "s = mc(200, d)",
          "check = if(field(s, \"p10\") < field(s, \"p50\") && field(s, \"p50\") < field(s, \"p90\"), 1, 0)",
          "check",
        ],
        expect: 1,
      },
      {
        name: "gcalc gtotal accumulates into sinks",
        steps: [
          "g = graph(\"g\")",
          "gnode(g, \"a\", 10 $)",
          "gnode(g, \"b\", 5 $)",
          "gnode(g, \"c\", 0 $)",
          "gedge(g, \"a\", \"c\")",
          "gedge(g, \"b\", \"c\")",
          "gcalc(g)",
          "to(gtotal(g), usd)",
        ],
        expect: 15,
      },
      {
        name: "gcalc detects cycles",
        steps: [
          "g = graph(\"cyc\")",
          "gnode(g, \"a\", 1 $)",
          "gnode(g, \"b\", 1 $)",
          "gedge(g, \"a\", \"b\")",
          "gedge(g, \"b\", \"a\")",
          "gcalc(g)",
        ],
        expect: expectError(/cycle/),
      },

      {
        name: "cost graph theory gexpr + gcalcx evaluates expression nodes",
        steps: [
          "g = graph(\"g\")",
          "gnode(g, \"labor\", 100 $)",
          "gnode(g, \"mat\", 50 $)",
          "gexpr(g, \"subtotal\", \"labor + mat\")",
          "gexpr(g, \"total\", \"markup(subtotal, 10%)\")",
          "gedge(g, \"labor\", \"subtotal\")",
          "gedge(g, \"mat\", \"subtotal\")",
          "gedge(g, \"subtotal\", \"total\")",
          "gcalcx(g)",
          "to(gtotal(g), usd)",
        ],
        expect: 165,
      },

      {
        name: "csi_norm normalizes codes",
        steps: [
          "csi_norm(\"06-11-16\")",
        ],
        expect: "06 11 16",
      },
      {
        name: "csi_rollup sums by CSI",
        steps: [
          "a = line(\"studs\", 10 ea, 5 $, {csi: \"06 11 16\"})",
          "b = line(\"ply\", 1 ea, 100 $, {csi: \"06-11-16\"})",
          "r = csi_rollup(a, b)",
          "to(field(r, \"csi_06_11_16\"), usd)",
        ],
        expect: 150,
      },

      {
        name: "unit-aware sqrt reduces len^2 to len",
        steps: [
          "a = 3 ft",
          "b = 4 ft",
          "c2 = a^2 + b^2",
          "c = sqrt(c2)",
          "to_ft(c)",
        ],
        expect: expectNear(5, 1e-6),
      },
      {
        name: "geometry distance uses units",
        steps: [
          "p = pt(0 ft, 0 ft)",
          "q = pt(3 ft, 4 ft)",
          "to_ft(dist(p, q))",
        ],
        expect: 5,
      },
      {
        name: "polygon area",
        steps: [
          "p1 = pt(0 ft, 0 ft)",
          "p2 = pt(10 ft, 0 ft)",
          "p3 = pt(10 ft, 5 ft)",
          "p4 = pt(0 ft, 5 ft)",
          "shape = poly(p1, p2, p3, p4)",
          "to_sf(poly_area(shape))",
        ],
        expect: 50,
      },

      {
        name: "linalg vec_len supports unit vectors",
        steps: [
          "v = vec(3 ft, 4 ft)",
          "to_ft(vec_len(v))",
        ],
        expect: 5,
      },
      {
        name: "linalg vec_dot",
        steps: [
          "a = vec(1, 2, 3)",
          "b = vec(4, 5, 6)",
          "vec_dot(a, b)",
        ],
        expect: 32,
      },
      {
        name: "linalg mat_T transpose",
        steps: [
          "m = mat(\"1,2;3,4\")",
          "mt = mat_T(m)",
          "field(mt, \"m12\")",
        ],
        expect: 3,
      },
      {
        name: "linalg mat_solve solves 2x2",
        steps: [
          "A = mat(\"2,0;0,4\")",
          "b = vec(10, 8)",
          "x = mat_solve(A, b)",
          "field(x, \"v1\") + field(x, \"v2\")",
        ],
        expect: 7,
      },
      {
        name: "nsolve finds sqrt(2)",
        steps: [
          "x = nsolve(\"x^2 - 2\", \"x\", 1)",
          "x",
        ],
        expect: expectNear(Math.SQRT2, 1e-6),
      },

      {
        name: "uncertainty dist.uniform + cdf",
        steps: [
          "d = dist.uniform(0, 10)",
          "cdf(d, 5)",
        ],
        expect: expectNear(0.5, 1e-9),
      },
      {
        name: "uncertainty prob_gt/prob_lt",
        steps: [
          "d = dist.uniform(0, 10)",
          "prob_gt(d, 5) + prob_lt(d, 5)",
        ],
        expect: expectNear(1, 1e-9),
      },
      {
        name: "uncertainty dist.uniform supports unit bounds",
        steps: [
          "d = dist.uniform(0 ft, 10 ft)",
          "cdf(d, 5 ft)",
        ],
        expect: expectNear(0.5, 1e-9),
      },
      {
        name: "material density weight chaining",
        steps: [
          "conc = material(\"concrete\", {density: 150 pcf, unit_cost: 125 $/cy})",
          "v = 1 cy",
          "w = weight(v, conc)",
          "to_lb(w)",
        ],
        expect: expectNear(4050, 1e-6),
      },
      {
        name: "material cost from qty",
        steps: [
          "conc = material(\"concrete\", {density: 150 pcf, unit_cost: 125 $/cy})",
          "c = cost(2 cy, conc)",
          "to(c, usd)",
        ],
        expect: 250,
      },

      {
        name: "cmd reset clears vars",
        steps: [
          "a = 123",
          "cmd(\"reset\")",
          "has(\"a\")",
        ],
        expect: 0,
      },
      {
        name: "linear coefficient extraction",
        steps: [
          "c = lin_coeff(\"2*x + 3\", \"x\")",
          "field(c, \"a\") + field(c, \"b\")",
        ],
        expect: 5,
      },
      {
        name: "solve_linear solves ax+b=c",
        steps: [
          "solve_linear(\"2*x + 3\", \"11\", \"x\")",
        ],
        expect: 4,
      },
      {
        name: "argmin finds minimum on grid",
        steps: [
          "r = argmin(\"x\", -5, 5, 1, \"(x-2)^2\")",
          "field(r, \"x\")",
        ],
        expect: 2,
      },

      {
        name: "rate object computes effective rate",
        steps: [
          "r = rate(\"place\", 100 sfph, {crew: 2, eff: 0.8})",
          "to_sf(rate_eff(r) * (1 hr))",
        ],
        expect: expectNear(160, 1e-6),
      },
      {
        name: "prod(rate, duration)",
        steps: [
          "r = rate(\"place\", 50 sfph, {crew: 3})",
          "to_sf(prod(r, 2 hr))",
        ],
        expect: expectNear(300, 1e-6),
      },
      {
        name: "time_for(qty, rate) computes duration",
        steps: [
          "r = rate(\"place\", 100 sfph, {crew: 2})",
          "t = time_for(400 sf, r)",
          "to_hr(t)",
        ],
        expect: expectNear(2, 1e-6),
      },
      {
        name: "rate_inv(rate) inverts a rate object",
        steps: [
          "r = rate(\"place\", 100 sfph, {crew: 2})",
          "rinv = rate_inv(r)",
          "to_hr( prod(rinv, 200 sf) )",
        ],
        expect: expectNear(1, 1e-6),
      },
      {
        name: "crew(count, rate) scales rate object",
        steps: [
          "r = rate(\"place\", 50 sfph, {crew: 2})",
          "r2 = crew(3, r)",
          "to_sf(prod(r2, 1 hr))",
        ],
        expect: expectNear(300, 1e-6),
      },
      {
        name: "learn(rate, n, exp) applies learning curve to rate",
        steps: [
          "r = rate(\"place\", 100 sfph, {crew: 1})",
          "r2 = learn(r, 4, -0.5)",
          "to_sf(prod(r2, 1 hr))",
        ],
        expect: expectNear(50, 1e-6),
      },
      {
        name: "rate_factors returns assembly",
        steps: [
          "r = rate(\"place\", 100 sfph, {crew: 2, eff: 0.8})",
          "field(rate_factors(r), \"crew\")",
        ],
        expect: 2,
      },
      {
        name: "rate_factor returns factor or 1",
        steps: [
          "r = rate(\"place\", 100 sfph, {crew: 2})",
          "rate_factor(r, \"crew\") + rate_factor(r, \"missing\")",
        ],
        expect: 3,
      },
      {
        name: "rate_with overrides factors",
        steps: [
          "r = rate(\"place\", 100 sfph, {crew: 2, eff: 0.8})",
          "r2 = rate_with(r, {crew: 3})",
          "to_sf(prod(r2, 1 hr))",
        ],
        expect: expectNear(240, 1e-6),
      },
      {
        name: "tsim integrates expression over time steps",
        steps: [
          "s = tsim(1 hr, 15 min, \"dt\")",
          "to_hr(field(s, \"sum\"))",
        ],
        expect: expectNear(1, 1e-6),
      },
      {
        name: "scenario resolve returns assembly of evaluated keys",
        steps: [
          "sc = scenario(\"base\", {a: 1, b: 2, c: a + b})",
          "s = sc_resolve(sc)",
          "field(s, \"c\")",
        ],
        expect: 3,
      },
      {
        name: "scenario get returns a resolved value",
        steps: [
          "sc = scenario(\"base\", {a: 10, b: a + 5})",
          "sc_get(sc, \"b\")",
        ],
        expect: 15,
      },
      {
        name: "scenario merge stacks entries (later can override at eval time)",
        steps: [
          "a = scenario(\"a\", {x: 1, y: 2})",
          "b = scenario(\"b\", {y: 5, z: x + y})",
          "m = sc_merge(a, b)",
          "sc_eval(m, \"z\")",
        ],
        expect: 6,
      },
      {
        name: "scenario compare returns delta",
        steps: [
          "base = scenario(\"base\", {qty: 100, unit: 2.5, total: qty * unit})",
          "alt = scenario(\"alt\", {qty: 120, unit: 2.5, total: qty * unit})",
          "cmp = sc_compare(base, alt, \"total\", \"cmp\")",
          "field(cmp, \"delta\")",
        ],
        expect: 50,
      },
      {
        name: "project schedule and cost rollup",
        steps: [
          "p = project(\"demo\")",
          "ptask(p, \"A\", {dur: 2 hr, cost: 1000 $})",
          "ptask(p, \"B\", {dur: 1 hr, cost: 500 $})",
          "pdep(p, \"A\", \"B\")",
          "sch = pschedule(p)",
          "to_hr(field(sch, \"total_time\"))",
        ],
        expect: expectNear(3, 1e-6),
      },
      {
        name: "pcost sums task costs",
        steps: [
          "p = project(\"demo\")",
          "ptask(p, \"A\", {dur: 2 hr, cost: 1000 $})",
          "ptask(p, \"B\", {dur: 1 hr, cost: 500 $})",
          "to(pcost(p), usd)",
        ],
        expect: 1500,
      },

      {
        name: "unit algebra kind() recognizes qty and objects",
        steps: [
          "a = 3 ft",
          "b = graph(\"g\")",
          "kind(a) + ',' + kind(b)",
        ],
        expect: "len,graph",
      },
      {
        name: "unit algebra dimkey supports qty and kind strings",
        steps: [
          "k1 = dimkey(3 ft)",
          "k2 = dimkey(\"len\")",
          "k1 == k2",
        ],
        expect: 1,
      },
      {
        name: "unit algebra compat detects dimensional compatibility",
        steps: [
          "compat(3 ft, 12 in) + compat(3 ft, 1 sf)",
        ],
        expect: 1,
      },
      {
        name: "unit algebra assert_dim returns value on match",
        steps: [
          "x = assert_dim(3 ft, \"len\")",
          "to_in(x)",
        ],
        expect: 36,
      },
      {
        name: "unit algebra assert_dim errors on mismatch",
        expr: "assert_dim(3 ft, \"area\")",
        expect: expectError(/Unit mismatch/),
      },
      {
        name: "unit algebra simplify reduces len*len to area",
        steps: [
          "a = 3 ft * 4 ft",
          "kind(a)",
        ],
        expect: "area",
      },
      {
        name: "unit algebra uqty makes quantities from kind string",
        steps: [
          "x = uqty(2, \"len\")",
          "to_in(x)",
        ],
        expect: 24,
      },
      {
        name: "unit algebra uqty rejects non-numeric",
        expr: "uqty(\"nope\", \"len\")",
        expect: expectError("uqty expects a numeric value"),
      },
      {
        name: "unit algebra udiv/umul build composite kinds",
        steps: [
          "r = udiv(1 $, 2 sf)",
          "kind(r)",
        ],
        expect: "cur*len^-2",
      },
      {
        name: "unit algebra uadd/usub enforce dimension match",
        steps: [
          "a = uadd(1 ft, 12 in)",
          "b = usub(2 ft, 6 in)",
          "to_in(a) + to_in(b)",
        ],
        expect: 42,
      },
      {
        name: "unit algebra uadd errors on mismatch",
        expr: "uadd(1 ft, 1 sf)",
        expect: expectError(/Unit mismatch/),
      },
      {
        name: "unit algebra ucmp orders compatible quantities",
        steps: [
          "ucmp(12 in, 1 ft)",
        ],
        expect: 0,
      },
      {
        name: "unit algebra uerr returns mismatch message",
        steps: [
          "uerr(1 ft, 1 sf)",
        ],
        expect: "Unit mismatch: len vs area",
      },

      {
        name: "cost algebra cost_leaf creates labeled cost and is_cost detects it",
        steps: [
          "c = cost_leaf(\"labor\", 100)",
          "is_cost(c)",
        ],
        expect: 1,
      },
      {
        name: "cost algebra cost_total returns numeric dollars",
        steps: [
          "c = cost_leaf(\"labor\", 100)",
          "cost_total(c)",
        ],
        expect: 100,
      },
      {
        name: "cost algebra cost_breakdown sums leaves after add/scale",
        steps: [
          "a = cost_leaf(\"labor\", 100)",
          "b = cost_leaf(\"mat\", 50)",
          "t = markup(a + b, 10%)",
          "bd = cost_breakdown(t)",
          "to(field(bd, \"total\"), usd)",
        ],
        expect: 165,
      },
      {
        name: "cost algebra breakdown fields include per-label rollups",
        steps: [
          "a = cost_leaf(\"labor\", 100)",
          "b = cost_leaf(\"mat\", 50)",
          "t = markup(a + b, 10%)",
          "bd = cost_breakdown(t)",
          "to(field(bd, \"labor\"), usd)",
        ],
        expect: 110,
      },
      {
        name: "cost algebra cost_label relabels leaf",
        steps: [
          "c = cost_label(cost_leaf(\"labor\", 100), \"crew\")",
          "bd = cost_breakdown(markup(c, 10%))",
          "to(field(bd, \"crew\"), usd)",
        ],
        expect: 110,
      },
      {
        name: "cost algebra cost_breakdown errors on non-cost",
        expr: "cost_breakdown(5 ft)",
        expect: expectError("cost_breakdown expects a currency quantity"),
      },
    ];
  }

  function formatTestValue(value){
    if (isQty(value)) return qtyToString(value);
    if (value && value.__assy) return formatAssemblySummary(value);
    return String(value);
  }

  function evaluateTestStatements(source){
    const statements = splitStatements(source);
    let lastValue = null;
    for (const stmt of statements){
      const parsed = evaluate(stmt);
      if (!parsed) continue;
      if (parsed.type === "cmd") throw new Error(`Test cannot use command :${parsed.cmd}`);
      if (parsed.type === "def"){
        defineUserFn(parsed.name, parsed.params, parsed.expr);
        continue;
      }
      if (parsed.type === "assy"){
        const assembly = createAssembly(parsed.name, parsed.fields);
        state.vars[parsed.name] = assembly;
        lastValue = assembly;
        continue;
      }
      if (parsed.type === "assign"){
        const val = runExpression(parsed.expr);
        state.vars[parsed.name] = val;
        lastValue = val;
        continue;
      }
      if (parsed.type === "equation"){
        const solved = solveEquation(parsed.left, parsed.right);
        if (solved.unknown.unitToken){
          lastValue = makeQty(solved.value * solved.unknown.toBase, solved.unknown.kind);
        }else{
          lastValue = solved.value;
          state.vars[solved.unknown.name] = solved.value;
        }
        continue;
      }
      if (parsed.type === "if"){
        const cond = runExpression(parsed.condition);
        if (isTruthy(cond)){
          lastValue = evaluateTestStatements(parsed.thenBody);
        }else if (parsed.elseBody){
          lastValue = evaluateTestStatements(parsed.elseBody);
        }
        continue;
      }
      if (parsed.type === "for"){
        const startVal = runExpression(parsed.startExpr);
        const endVal = runExpression(parsed.endExpr);
        const stepVal = parsed.stepExpr ? runExpression(parsed.stepExpr) : 1;
        let start;
        let end;
        let step;
        let loopKind = null;
        if (isQty(startVal) || isQty(endVal)){
          if (!isQty(startVal) || !isQty(endVal)){
            throw new Error("for loop range must use matching unit quantities");
          }
          if (startVal.kind !== endVal.kind){
            throw new Error("for loop range units must match");
          }
          loopKind = startVal.kind;
          start = startVal.value;
          end = endVal.value;
          if (isQty(stepVal)){
            if (stepVal.kind !== loopKind) throw new Error("for loop step unit mismatch");
            step = stepVal.value;
          }else{
            step = stepVal;
          }
        }else{
          [start, end] = normalizeCompare(startVal, endVal);
          step = normalizeCompare(stepVal, 0)[0];
        }
        if (step === 0) throw new Error("for loop step cannot be 0");
        const hadVar = Object.prototype.hasOwnProperty.call(state.vars, parsed.varName);
        const prevVal = state.vars[parsed.varName];
        const forward = step > 0;
        for (let i = start; forward ? i <= end : i >= end; i += step){
          state.vars[parsed.varName] = loopKind ? makeQty(i, loopKind) : i;
          lastValue = evaluateTestStatements(parsed.body);
        }
        if (hadVar) state.vars[parsed.varName] = prevVal;
        else delete state.vars[parsed.varName];
        continue;
      }
      if (parsed.type === "repeat"){
        const countVal = runExpression(parsed.countExpr);
        const count = normalizeCompare(countVal, 0)[0];
        if (!Number.isFinite(count) || count < 0) throw new Error("repeat count must be >= 0");
        for (let i = 0; i < Math.floor(count); i++){
          lastValue = evaluateTestStatements(parsed.body);
        }
        continue;
      }
      if (parsed.type === "expr"){
        lastValue = runExpression(parsed.expr);
      }
    }
    return lastValue;
  }

  function matchExpected(actual, expected){
    const tol = 1e-9;
    if (expected && typeof expected === "object" && expected.type === "error"){
      return { pass: false, message: "expected error, got value" };
    }
    if (expected && typeof expected === "object" && expected.type === "qty"){
      if (!isQty(actual)) return { pass: false, message: `expected quantity ${expected.kind}` };
      if (actual.kind !== expected.kind) return { pass: false, message: `expected ${expected.kind}, got ${actual.kind}` };
      const delta = Math.abs(actual.value - expected.value);
      if (delta > expected.tol) return { pass: false, message: `expected ${expected.value} ${expected.kind}, got ${actual.value} ${actual.kind}` };
      return { pass: true };
    }
    if (expected && typeof expected === "object" && expected.type === "scalar"){
      const actualValue = isQty(actual) ? actual.value : actual;
      const delta = Math.abs(actualValue - expected.value);
      if (delta > expected.tol) return { pass: false, message: `expected ${expected.value}, got ${actualValue}` };
      return { pass: true };
    }
    if (typeof expected === "number"){
      const actualValue = isQty(actual) ? actual.value : actual;
      if (Math.abs(actualValue - expected) > tol){
        return { pass: false, message: `expected ${expected}, got ${actualValue}` };
      }
      return { pass: true };
    }
    if (Object.is(actual, expected)) return { pass: true };
    return { pass: false, message: `expected ${String(expected)}, got ${formatTestValue(actual)}` };
  }

  function matchExpectedError(err, expected){
    if (!expected || expected.type !== "error"){
      return { pass: false, message: "unexpected error" };
    }
    const message = err && err.message ? err.message : String(err);
    if (!expected.message) return { pass: true };
    if (expected.message instanceof RegExp){
      if (expected.message.test(message)) return { pass: true };
      return { pass: false, message: `expected error ${expected.message}, got ${message}` };
    }
    if (typeof expected.message === "string"){
      if (message.includes(expected.message)) return { pass: true };
      return { pass: false, message: `expected error "${expected.message}", got "${message}"` };
    }
    return { pass: true };
  }

  function formatExpectedValue(expected){
    if (expected && typeof expected === "object" && expected.type === "qty"){
      return qtyToString(makeQty(expected.value, expected.kind));
    }
    if (expected && typeof expected === "object" && expected.type === "scalar"){
      return String(expected.value);
    }
    if (expected && typeof expected === "object" && expected.type === "error"){
      if (!expected.message) return "error";
      if (expected.message instanceof RegExp) return `error ${expected.message}`;
      return `error ${expected.message}`;
    }
    if (typeof expected === "number") return String(expected);
    if (expected === undefined) return "undefined";
    return String(expected);
  }

  function runTestSuite(){
    setStatus("Testing...", "warn");
    writeLine("Running REPLCalc tests...", "ok");
    const savedState = {
      vars: state.vars,
      userFns: state.userFns,
      history: state.history,
      histIdx: state.histIdx,
    };
    state.vars = Object.create(null);
    state.userFns = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    renderUserFunctions();

    const tests = createTestSuite();
    let passCount = 0;
    const failures = [];

    writeLine(`Test plan: ${tests.length} checks.`, "muted");

    for (const test of tests){
      try{
        state.vars = Object.create(null);
        state.userFns = Object.create(null);
        state.history = [];
        state.histIdx = -1;
        const source = test.steps ? test.steps.join("\n") : test.expr;
        const formattedSource = formatInput(source);
        const formattedExpected = formatExpectedValue(test.expect);
        const result = evaluateTestStatements(source);
        if (test.expect && typeof test.expect === "object" && test.expect.type === "error"){
          failures.push({ name: test.name, reason: "expected error, got value" });
          writeLine(`• ${test.name}`, "muted");
          writeLine(`  input: ${formattedSource}`, "muted");
          writeLine(`  outcome: ${formatTestValue(result)}`, "muted");
          writeLine(`  expected: ${formattedExpected}`, "muted");
          writeLine(`✗ ${test.name}: expected error, got value`, "err");
          continue;
        }
        const match = matchExpected(result, test.expect);
        writeLine(`• ${test.name}`, "muted");
        writeLine(`  input: ${formattedSource}`, "muted");
        writeLine(`  outcome: ${formatTestValue(result)}`, "muted");
        writeLine(`  expected: ${formattedExpected}`, "muted");
        if (match.pass){
          passCount += 1;
          writeLine(`✓ ${test.name}`, "ok");
        }else{
          failures.push({ name: test.name, reason: match.message || "failed" });
          writeLine(`✗ ${test.name}: ${match.message || "failed"}`, "err");
        }
      }catch(err){
        const source = test.steps ? test.steps.join("\n") : test.expr;
        const formattedSource = formatInput(source);
        const formattedExpected = formatExpectedValue(test.expect);
        if (test.expect && typeof test.expect === "object" && test.expect.type === "error"){
          const match = matchExpectedError(err, test.expect);
          if (match.pass){
            passCount += 1;
            writeLine(`• ${test.name}`, "muted");
            writeLine(`  input: ${formattedSource}`, "muted");
            writeLine(`  outcome: error (${err.message || String(err)})`, "muted");
            writeLine(`  expected: ${formattedExpected}`, "muted");
            writeLine(`✓ ${test.name}`, "ok");
            continue;
          }
          failures.push({ name: test.name, reason: match.message || err.message || String(err) });
          writeLine(`• ${test.name}`, "muted");
          writeLine(`  input: ${formattedSource}`, "muted");
          writeLine(`  outcome: error (${err.message || String(err)})`, "muted");
          writeLine(`  expected: ${formattedExpected}`, "muted");
          writeLine(`✗ ${test.name}: ${match.message || err.message || String(err)}`, "err");
          continue;
        }
        failures.push({ name: test.name, reason: err.message || String(err) });
        writeLine(`• ${test.name}`, "muted");
        writeLine(`  input: ${formattedSource}`, "muted");
        writeLine(`  outcome: error (${err.message || String(err)})`, "muted");
        writeLine(`  expected: ${formattedExpected}`, "muted");
        writeLine(`✗ ${test.name}: ${err.message || String(err)}`, "err");
      }
    }

    state.vars = savedState.vars;
    state.userFns = savedState.userFns;
    state.history = savedState.history;
    state.histIdx = savedState.histIdx;
    renderUserFunctions();

    if (!failures.length){
      writeLine(`Tests complete: ${passCount}/${tests.length} passed.`, "ok");
    }else{
      writeLine(`Tests complete: ${passCount}/${tests.length} passed.`, "warn");
      failures.forEach((fail) => {
        writeLine(`✗ ${fail.name}: ${fail.reason}`, "err");
      });
    }
    setStatus("Ready", "ok");
  }

  return {
    runTestSuite,
  };
}
