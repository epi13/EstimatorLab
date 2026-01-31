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
      { name: "convert length to inches", expr: "to_in(2 ft)", expect: 24 },
      { name: "convert length to feet", expr: "to_ft(18 in)", expect: 1.5 },
      { name: "convert area to sf", expr: "to_sf(2 sy)", expect: 18 },
      { name: "convert area to sy", expr: "to_sy(90 sf)", expect: 10 },
      { name: "convert volume to cf", expr: "to_cf(2 cy)", expect: 54 },
      { name: "convert volume", expr: "to_cy(27 cf)", expect: 1 },
      { name: "convert weight to lb", expr: "to_lb(2 ton)", expect: 4000 },
      { name: "convert weight to ton", expr: "to_ton(1000 lb)", expect: 0.5 },
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
          "assy wall_main = { studs = 16 in o.c.; height = 10 ft; sheathing = 1 layer }",
          "assy wall_alt = { height = 12 ft; sheathing = 2 layers }",
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
          "frame_total = 0",
          "cls()",
          "ay = 0",
          "ax = 0",
          "ax0 = px(-1, -1, -1, ay, ax)",
          "ay0 = py(-1, -1, -1, ay, ax)",
          "bx0 = px(1, -1, -1, ay, ax)",
          "by0 = py(1, -1, -1, ay, ax)",
          "cx0 = px(1, 1, -1, ay, ax)",
          "cy0 = py(1, 1, -1, ay, ax)",
          "dx0 = px(-1, 1, -1, ay, ax)",
          "dy0 = py(-1, 1, -1, ay, ax)",
          "ex0 = px(-1, -1, 1, ay, ax)",
          "ey0 = py(-1, -1, 1, ay, ax)",
          "fx0 = px(1, -1, 1, ay, ax)",
          "fy0 = py(1, -1, 1, ay, ax)",
          "gx0 = px(1, 1, 1, ay, ax)",
          "gy0 = py(1, 1, 1, ay, ax)",
          "hx0 = px(-1, 1, 1, ay, ax)",
          "hy0 = py(-1, 1, 1, ay, ax)",
          "frame_total = frame_total + line(ax0, ay0, bx0, by0, \"accent\")",
          "frame_total = frame_total + line(bx0, by0, cx0, cy0, \"accent\")",
          "frame_total = frame_total + line(cx0, cy0, dx0, dy0, \"accent\")",
          "frame_total = frame_total + line(dx0, dy0, ax0, ay0, \"accent\")",
          "frame_total = frame_total + line(ex0, ey0, fx0, fy0, \"accent\")",
          "frame_total = frame_total + line(fx0, fy0, gx0, gy0, \"accent\")",
          "frame_total = frame_total + line(gx0, gy0, hx0, hy0, \"accent\")",
          "frame_total = frame_total + line(hx0, hy0, ex0, ey0, \"accent\")",
          "frame_total = frame_total + line(ax0, ay0, ex0, ey0, \"accent-2\")",
          "frame_total = frame_total + line(bx0, by0, fx0, fy0, \"accent-2\")",
          "frame_total = frame_total + line(cx0, cy0, gx0, gy0, \"accent-2\")",
          "frame_total = frame_total + line(dx0, dy0, hx0, hy0, \"accent-2\")",
          "cls()",
          "ay = 0.6",
          "ax = 0.4",
          "ax1 = px(-1, -1, -1, ay, ax)",
          "ay1 = py(-1, -1, -1, ay, ax)",
          "bx1 = px(1, -1, -1, ay, ax)",
          "by1 = py(1, -1, -1, ay, ax)",
          "cx1 = px(1, 1, -1, ay, ax)",
          "cy1 = py(1, 1, -1, ay, ax)",
          "dx1 = px(-1, 1, -1, ay, ax)",
          "dy1 = py(-1, 1, -1, ay, ax)",
          "ex1 = px(-1, -1, 1, ay, ax)",
          "ey1 = py(-1, -1, 1, ay, ax)",
          "fx1 = px(1, -1, 1, ay, ax)",
          "fy1 = py(1, -1, 1, ay, ax)",
          "gx1 = px(1, 1, 1, ay, ax)",
          "gy1 = py(1, 1, 1, ay, ax)",
          "hx1 = px(-1, 1, 1, ay, ax)",
          "hy1 = py(-1, 1, 1, ay, ax)",
          "frame_total = frame_total + line(ax1, ay1, bx1, by1, \"ok\")",
          "frame_total = frame_total + line(bx1, by1, cx1, cy1, \"ok\")",
          "frame_total = frame_total + line(cx1, cy1, dx1, dy1, \"ok\")",
          "frame_total = frame_total + line(dx1, dy1, ax1, ay1, \"ok\")",
          "frame_total = frame_total + line(ex1, ey1, fx1, fy1, \"ok\")",
          "frame_total = frame_total + line(fx1, fy1, gx1, gy1, \"ok\")",
          "frame_total = frame_total + line(gx1, gy1, hx1, hy1, \"ok\")",
          "frame_total = frame_total + line(hx1, hy1, ex1, ey1, \"ok\")",
          "frame_total = frame_total + line(ax1, ay1, ex1, ey1, \"warn\")",
          "frame_total = frame_total + line(bx1, by1, fx1, fy1, \"warn\")",
          "frame_total = frame_total + line(cx1, cy1, gx1, gy1, \"warn\")",
          "frame_total = frame_total + line(dx1, dy1, hx1, hy1, \"warn\")",
          "cls()",
          "ay = 1.2",
          "ax = 0.8",
          "ax2 = px(-1, -1, -1, ay, ax)",
          "ay2 = py(-1, -1, -1, ay, ax)",
          "bx2 = px(1, -1, -1, ay, ax)",
          "by2 = py(1, -1, -1, ay, ax)",
          "cx2 = px(1, 1, -1, ay, ax)",
          "cy2 = py(1, 1, -1, ay, ax)",
          "dx2 = px(-1, 1, -1, ay, ax)",
          "dy2 = py(-1, 1, -1, ay, ax)",
          "ex2 = px(-1, -1, 1, ay, ax)",
          "ey2 = py(-1, -1, 1, ay, ax)",
          "fx2 = px(1, -1, 1, ay, ax)",
          "fy2 = py(1, -1, 1, ay, ax)",
          "gx2 = px(1, 1, 1, ay, ax)",
          "gy2 = py(1, 1, 1, ay, ax)",
          "hx2 = px(-1, 1, 1, ay, ax)",
          "hy2 = py(-1, 1, 1, ay, ax)",
          "frame_total = frame_total + line(ax2, ay2, bx2, by2, \"accent\")",
          "frame_total = frame_total + line(bx2, by2, cx2, cy2, \"accent\")",
          "frame_total = frame_total + line(cx2, cy2, dx2, dy2, \"accent\")",
          "frame_total = frame_total + line(dx2, dy2, ax2, ay2, \"accent\")",
          "frame_total = frame_total + line(ex2, ey2, fx2, fy2, \"accent\")",
          "frame_total = frame_total + line(fx2, fy2, gx2, gy2, \"accent\")",
          "frame_total = frame_total + line(gx2, gy2, hx2, hy2, \"accent\")",
          "frame_total = frame_total + line(hx2, hy2, ex2, ey2, \"accent\")",
          "frame_total = frame_total + line(ax2, ay2, ex2, ey2, \"accent-2\")",
          "frame_total = frame_total + line(bx2, by2, fx2, fy2, \"accent-2\")",
          "frame_total = frame_total + line(cx2, cy2, gx2, gy2, \"accent-2\")",
          "frame_total = frame_total + line(dx2, dy2, hx2, hy2, \"accent-2\")",
          "cls()",
          "ay = 1.8",
          "ax = 1.2",
          "ax3 = px(-1, -1, -1, ay, ax)",
          "ay3 = py(-1, -1, -1, ay, ax)",
          "bx3 = px(1, -1, -1, ay, ax)",
          "by3 = py(1, -1, -1, ay, ax)",
          "cx3 = px(1, 1, -1, ay, ax)",
          "cy3 = py(1, 1, -1, ay, ax)",
          "dx3 = px(-1, 1, -1, ay, ax)",
          "dy3 = py(-1, 1, -1, ay, ax)",
          "ex3 = px(-1, -1, 1, ay, ax)",
          "ey3 = py(-1, -1, 1, ay, ax)",
          "fx3 = px(1, -1, 1, ay, ax)",
          "fy3 = py(1, -1, 1, ay, ax)",
          "gx3 = px(1, 1, 1, ay, ax)",
          "gy3 = py(1, 1, 1, ay, ax)",
          "hx3 = px(-1, 1, 1, ay, ax)",
          "hy3 = py(-1, 1, 1, ay, ax)",
          "frame_total = frame_total + line(ax3, ay3, bx3, by3, \"ok\")",
          "frame_total = frame_total + line(bx3, by3, cx3, cy3, \"ok\")",
          "frame_total = frame_total + line(cx3, cy3, dx3, dy3, \"ok\")",
          "frame_total = frame_total + line(dx3, dy3, ax3, ay3, \"ok\")",
          "frame_total = frame_total + line(ex3, ey3, fx3, fy3, \"ok\")",
          "frame_total = frame_total + line(fx3, fy3, gx3, gy3, \"ok\")",
          "frame_total = frame_total + line(gx3, gy3, hx3, hy3, \"ok\")",
          "frame_total = frame_total + line(hx3, hy3, ex3, ey3, \"ok\")",
          "frame_total = frame_total + line(ax3, ay3, ex3, ey3, \"warn\")",
          "frame_total = frame_total + line(bx3, by3, fx3, fy3, \"warn\")",
          "frame_total = frame_total + line(cx3, cy3, gx3, gy3, \"warn\")",
          "frame_total = frame_total + line(dx3, dy3, hx3, hy3, \"warn\")",
          "frame_total",
        ],
        expect: 48,
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
