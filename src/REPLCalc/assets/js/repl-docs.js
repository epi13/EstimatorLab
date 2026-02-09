export function createDocs({ state, formatValueDisplay, writeLine, writeLineRich, token, GFX_COLOR_TOKENS }){
  function showDocs(){
    writeLine("Estimator REPL docs", "ok");
    writeLineRich([token("Overview:", "out-label")], "muted");
    writeLineRich(["  This REPL mixes calculator math with takeoff helpers, units, and quick scripting."], "muted");
    writeLineRich(["  Use it for one-off computations or build up a session with variables + methods."], "muted");
    writeLineRich([token("Syntax quickstart:", "out-label")], "muted");
    writeLineRich([
      "  Expressions: ",
      token("2+2*5", "out-op"),
      "  |  ",
      token("(1200 sf * 4 in) / 27", "out-op"),
      "  |  ",
      token("pow", "out-fn"),
      token("(3,2)", "out-op")
    ], "muted");
    writeLineRich([
      "  Constants: ",
      token("pi", "out-number"),
      ", ",
      token("e", "out-number")
    ], "muted");
    writeLineRich([
      "  Assignment: ",
      token("x", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("144", "out-number"),
      "  |  ",
      token("total", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("markup", "out-fn"),
      token("(burden(12500, 16.7), 35)", "out-op")
    ], "muted");
    writeLineRich([
      "  Solutions: ",
      token("so", "out-keyword"),
      " ",
      token("name", "out-fn"),
      token("(a,b)", "out-op"),
      " = expression  (call with ",
      token("name(1,2)", "out-op"),
      ")"
    ], "muted");
    writeLineRich([
      "  Also accepts: ",
      token("def", "out-keyword"),
      ", ",
      token("fn", "out-keyword"),
      ", ",
      token("function", "out-keyword"),
      " (same as ",
      token("so", "out-keyword"),
      ")"
    ], "muted");
    writeLineRich([
      "  Flow: ",
      token("if", "out-keyword"),
      " ",
      token("labor", "out-var"),
      " ",
      token(">", "out-op"),
      " ",
      token("40", "out-number"),
      ": ",
      token("overtime", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("labor", "out-var"),
      " ",
      token("-", "out-op"),
      " ",
      token("40", "out-number"),
      " ",
      token("else", "out-keyword"),
      ": ",
      token("overtime", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("0", "out-number")
    ], "muted");
    writeLineRich([
      "  Blocks: end a line with ",
      token(":", "out-op"),
      " then indent the next line(s): ",
      token("if x > 0:", "out-op"),
      " ↳ ",
      token("total = total + 1", "out-op")
    ], "muted");
    writeLineRich([
      "  Loop: ",
      token("for", "out-keyword"),
      " i ",
      token("in", "out-keyword"),
      " ",
      token("1..5", "out-number"),
      " ",
      token("step", "out-keyword"),
      " ",
      token("1", "out-number"),
      ": expr   |   ",
      token("repeat", "out-keyword"),
      " ",
      token("3", "out-number"),
      ": expr"
    ], "muted");
    writeLineRich([
      "  Solve: ",
      token("56", "out-number"),
      " ",
      token("cy", "out-unit"),
      " ",
      token("=", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(sf, 6 in)", "out-op")
    ], "muted");
    writeLineRich([
      "  Strings: ",
      token("\"crew\"", "out-string"),
      " or ",
      token("'crew'", "out-string"),
      " (required for meta-programming helpers)"
    ], "muted");
    writeLineRich([token("Units:", "out-label")], "muted");
    writeLineRich([
      "  Supported: ",
      token("in, ft, yd, mi, sf, sy, cf, cy, lb, ton, oz, s, min, hr, day, wk, yr, mph, psi, psf, ksi, %, $, ea, layer, deg, rad", "out-unit"),
      "."
    ], "muted");
    writeLineRich([
      "  Use as tokens: ",
      token("12", "out-number"),
      " ",
      token("ft", "out-unit"),
      " + ",
      token("6", "out-number"),
      " ",
      token("in", "out-unit"),
      "  |  ",
      token("1200", "out-number"),
      " ",
      token("sf", "out-unit"),
      " * ",
      token("4", "out-number"),
      " ",
      token("in", "out-unit"),
      "  |  ",
      token("3", "out-number"),
      " ",
      token("cy", "out-unit"),
      " + ",
      token("9", "out-number"),
      " ",
      token("cf", "out-unit")
    ], "muted");
    writeLineRich([token("Assemblies:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("assy", "out-keyword"),
      " ",
      token("wall", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("{", "out-op"),
      " ",
      token("studs", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("16 in o.c.", "out-number"),
      "; ",
      token("height", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("10 ft", "out-number"),
      "; ",
      token("sheathing", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("1 layer", "out-number"),
      " ",
      token("}", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("qty", "out-fn"),
      token("(wall, 120 lf)", "out-op"),
      " → studs + area breakdown"
    ], "muted");
    writeLineRich([
      "  Converters: ",
      token("to_in", "out-fn"),
      token("/", "out-op"),
      token("to_ft", "out-fn"),
      ", ",
      token("to", "out-fn"),
      token("(x, unit)", "out-op"),
      "  |  time: ",
      token("to_sec", "out-fn"),
      token("/", "out-op"),
      token("to_min", "out-fn"),
      token("/", "out-op"),
      token("to_hr", "out-fn"),
      ", ",
      token("to_sf", "out-fn"),
      token("/", "out-op"),
      token("to_sy", "out-fn"),
      ", ",
      token("to_cf", "out-fn"),
      token("/", "out-op"),
      token("to_cy", "out-fn"),
      ", ",
      token("to_lb", "out-fn"),
      token("/", "out-op"),
      token("to_ton", "out-fn"),
      "."
    ], "muted");
    writeLineRich([token("Construction helpers:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("waste", "out-fn"),
      token("(qty,pct)", "out-op"),
      "  ",
      token("markup", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("burden", "out-fn"),
      token("(labor,pct)", "out-op"),
      "  ",
      token("tax", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("contingency", "out-fn"),
      token("(cost,pct)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("overhead", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("profit", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("ohp", "out-fn"),
      token("(cost,overhead,profit)", "out-op"),
      "  ",
      token("discount", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("retainage", "out-fn"),
      token("(cost,pct)", "out-op"),
      "  ",
      token("escalate", "out-fn"),
      token("(cost,pct,periods)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("unit", "out-fn"),
      token("(cost,qty)", "out-op"),
      "  ",
      token("round_up", "out-fn"),
      token("(x,step)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("scale_linear", "out-fn"),
      token("(value, old_scale, new_scale)", "out-op"),
      "  ",
      token("scale_pow", "out-fn"),
      token("(value, old_scale, new_scale, k)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("perim_rect", "out-fn"),
      token("(len, wid)", "out-op"),
      "  ",
      token("wall_area", "out-fn"),
      token("(perim, height)", "out-op"),
      "  ",
      token("roof_squares", "out-fn"),
      token("(area)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("oc_linear_ft", "out-fn"),
      token("(area, oc)", "out-op"),
      "  ",
      token("oc_linear_ft_parallel", "out-fn"),
      token("(area, height, oc)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("oc_run_count", "out-fn"),
      token("(height, oc)", "out-op"),
      "  ",
      token("oc_count", "out-fn"),
      token("(length, oc)", "out-op"),
      "  ",
      token("coils_needed", "out-fn"),
      token("(total_lf, coil_len)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("stick_count", "out-fn"),
      token("(lf, stick_len, waste_pct)", "out-op"),
      "  ",
      token("sheet_count", "out-fn"),
      token("(area, sheet_area, waste_pct)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("paint_gal", "out-fn"),
      token("(area, coverage_sf_per_gal, coats, waste_pct)", "out-op"),
      "  ",
      token("wt_from_cy", "out-fn"),
      token("(vol, lb_per_cy)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("bar_count", "out-fn"),
      token("(run_len, bar_len, lap_len, waste_pct)", "out-op"),
      "  ",
      token("fastener_count", "out-fn"),
      token("(items, per_item, waste_pct)", "out-op")
    ], "muted");
    writeLineRich([
      "  Framing: ",
      token("studs_wall studs_perim plates_lf plates_sticks sheets_wall joist_count joist_lf joist_sticks rim_sticks subfloor_sheets", "out-keyword"),
      "."
    ], "muted");
    writeLineRich([
      "  Drywall: ",
      token("drywall_sheets drywall_screws tape_rolls corner_bead_sticks mud_gal", "out-keyword"),
      "."
    ], "muted");
    writeLineRich([
      "  Concrete: ",
      token("slab_cy wall_cy footing_cy concrete_bags rebar_grid_bars", "out-keyword"),
      "."
    ], "muted");
    writeLineRich([
      "  Roofing: ",
      token("shingle_bundles underlayment_rolls ridgecap_bundles", "out-keyword"),
      "."
    ], "muted");
    writeLineRich([
      "  Earthwork: ",
      token("trench_cy bank_to_loose loose_to_bank bank_to_compacted compacted_to_bank truck_loads", "out-keyword"),
      "."
    ], "muted");
    writeLineRich([
      "  Pipe: ",
      token("pipe_wt_total hanger_count fitting_count pipe_jacket_area", "out-keyword"),
      "."
    ], "muted");
    writeLineRich([token("Rate calculus:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("rate", "out-fn"),
      token("(\"name\", base, {crew:2, eff:0.8})", "out-op"),
      "  ",
      token("is_rate", "out-fn"),
      token("(x)", "out-op"),
      "  ",
      token("rate_eff", "out-fn"),
      token("(r)", "out-op"),
      "  ",
      token("prod", "out-fn"),
      token("(r, 2 hr)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("time_for", "out-fn"),
      token("(400 sf, r)", "out-op"),
      "  ",
      token("rate_inv", "out-fn"),
      token("(r)", "out-op"),
      "  ",
      token("crew", "out-fn"),
      token("(3, r)", "out-op"),
      "  ",
      token("learn", "out-fn"),
      token("(r, 4, -0.5)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("rate_with", "out-fn"),
      token("(r, {crew:3})", "out-op"),
      "  ",
      token("rate_factors", "out-fn"),
      token("(r)", "out-op"),
      "  ",
      token("rate_factor", "out-fn"),
      token("(r, \"key\")", "out-op"),
      "  ",
      token("tsim", "out-fn"),
      token("(1 hr, 15 min, \"dt\")", "out-op")
    ], "muted");
    writeLineRich([token("Scenarios (compare futures):", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("scenario", "out-fn"),
      token("(\"base\", {qty: 100, unit: 2.5, total: qty*unit})", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("sc_eval", "out-fn"),
      token("(sc, \"total\")", "out-op"),
      "  ",
      token("sc_get", "out-fn"),
      token("(sc, \"qty\")", "out-op"),
      "  ",
      token("sc_resolve", "out-fn"),
      token("(sc)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("sc_merge", "out-fn"),
      token("(a, b)", "out-op"),
      "  ",
      token("sc_compare", "out-fn"),
      token("(base, alt, \"total\", \"cmp\")", "out-op")
    ], "muted");
    writeLineRich([token("Unit + cost algebra:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("kind dim dimkey is_dim compat assert_dim uqty simplify", "out-keyword"),
      "  |  ",
      token("is_cost cost_leaf cost_label cost_total cost_breakdown", "out-keyword")
    ], "muted");
    writeLineRich([token("Linear/nonlinear algebra:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("vec", "out-fn"),
      token("(1,2,3)", "out-op"),
      " ",
      token("mat", "out-fn"),
      token("(\"1,2;3,4\")", "out-op"),
      "  ",
      token("vec_dot", "out-fn"),
      token("(a,b)", "out-op"),
      "  ",
      token("vec_len", "out-fn"),
      token("(v)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("mat_T", "out-fn"),
      token("(m)", "out-op"),
      "  ",
      token("mat_solve", "out-fn"),
      token("(A, b)", "out-op"),
      "  ",
      token("nsolve", "out-fn"),
      token("(\"x^2-2\", \"x\", 1)", "out-op")
    ], "muted");
    writeLineRich([token("Uncertainty & risk:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("range", "out-fn"),
      token("(lo,hi)", "out-op"),
      "  ",
      token("mean", "out-fn"),
      token("(range)", "out-op"),
      "  ",
      token("dist.normal dist.tri dist.uniform", "out-keyword")
    ], "muted");
    writeLineRich([
      "  ",
      token("cdf pvalue prob_lt prob_gt", "out-keyword"),
      "  ",
      token("sample", "out-fn"),
      token("(dist)", "out-op"),
      "  ",
      token("mc", "out-fn"),
      token("(2000, range(0,10))", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("area_rect", "out-fn"),
      token("(a,b)", "out-op"),
      " ",
      token("area_circle", "out-fn"),
      token("(diam)", "out-op"),
      " ",
      token("vol_rect", "out-fn"),
      token("(area,thk_in)", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(area,thk_in)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("bf", "out-fn"),
      token("(t_in,w_in,len_ft,qty)", "out-op"),
      "  ",
      token("pipe_wt", "out-fn"),
      token("(nps_in,schedule,len_ft)", "out-op")
    ], "muted");
    writeLineRich([token("Math + logic:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("abs min max round ceil floor sqrt pow exp log log10 sin cos tan asin acos atan atan2 clamp not and or", "out-keyword")
    ], "muted");
    writeLineRich([
      "  Comparisons return ",
      token("1", "out-number"),
      "/",
      token("0", "out-number"),
      ": ",
      token("== != < <= > >=", "out-op"),
      "  |  Logic: ",
      token("&& ||", "out-op")
    ], "muted");
    writeLineRich([token("Meta-programming:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("eval", "out-fn"),
      token("(\"expr\")", "out-op"),
      " ",
      token("set", "out-fn"),
      token("(\"name\", value)", "out-op"),
      " ",
      token("get", "out-fn"),
      token("(\"name\")", "out-op"),
      " ",
      token("has", "out-fn"),
      token("(\"name\")", "out-op"),
      " ",
      token("unset", "out-fn"),
      token("(\"name\")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("define", "out-fn"),
      token("(\"solution\", \"a,b\", \"a+b\")", "out-op"),
      " ",
      token("undefine", "out-fn"),
      token("(\"solution\")", "out-op"),
      " ",
      token("vars()", "out-fn"),
      " ",
      token("methods()", "out-fn")
    ], "muted");

    writeLineRich([token("Text + parsing helpers:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("len", "out-fn"),
      token("(s)", "out-op"),
      " ",
      token("char_code", "out-fn"),
      token("(s,i)", "out-op"),
      " ",
      token("charclass", "out-fn"),
      token("(code)", "out-op"),
      " (alias ",
      token("class", "out-fn"),
      ")",
    ], "muted");
    writeLineRich([
      "  ",
      token("scan", "out-fn"),
      token("(s,i)", "out-op"),
      " → assy {i,code,ch,cls}",
    ], "muted");
    writeLineRich([
      "  ",
      token("scan_while", "out-fn"),
      token("(s,i,\"pred\")", "out-op"),
      " or ",
      token("scan_while(s,i,\"pred\", acc0, \"accExpr\")", "out-op"),
    ], "muted");
    writeLineRich([
      "  ",
      token("take_while", "out-fn"),
      token("(s,i,\"pred\")", "out-op"),
      " → text",
    ], "muted");

    writeLineRich([token("Serialization:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("to_json", "out-fn"),
      token("(value)", "out-op"),
      " ",
      token("from_json", "out-fn"),
      token("(text)", "out-op"),
      " ",
      token("to_csv", "out-fn"),
      token("(value)", "out-op"),
      " ",
      token("from_csv", "out-fn"),
      token("(text)", "out-op"),
    ], "muted");

    writeLineRich([token("Finishes + textures:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("finishIds()", "out-fn"),
      " list available texture ids",
    ], "muted");
    writeLineRich([
      "  ",
      token("wallFinish", "out-fn"),
      token("(finish)", "out-op"),
      " ",
      token("floorFinish", "out-fn"),
      token("(finish)", "out-op"),
      " ",
      token("ceilingFinish", "out-fn"),
      token("(finish)", "out-op"),
    ], "muted");
    writeLineRich([
      "  ",
      token("trimFinish", "out-fn"),
      token("(\"BASE\"|\"CASING\", finish)", "out-op"),
      " ",
      token("wainscot", "out-fn"),
      token("(height, finish)", "out-op"),
    ], "muted");
    writeLineRich([
      "  ",
      token("finishInfo", "out-fn"),
      token("(\"ID\")", "out-op"),
      " → assy {id,ok,group,label,csi}",
    ], "muted");

    writeLineRich([token("Graphics:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("gfx", "out-fn"),
      token("(w,h)", "out-op"),
      " ",
      token("gfxs", "out-fn"),
      token("(scale)", "out-op"),
      " ",
      token("gfxbackend", "out-fn"),
      token("(\"auto\"|\"2d\"|\"webgl2\"|\"webgpu\")", "out-op"),
      " ",
      token("bg", "out-fn"),
      token("(color)", "out-op"),
      " ",
      token("cls()", "out-fn")
    ], "muted");
    writeLineRich([token("Maps + raycasting:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("map", "out-fn"),
      token("(\"####|#S.#|####\")", "out-op"),
      " ",
      token("dungeon", "out-fn"),
      token("(seed,w,h,difficulty)", "out-op"),
      " ",
      token("mw/mh", "out-fn"),
      " ",
      token("mget/mset", "out-fn"),
      " ",
      token("mspawnx/mspawny", "out-fn")
    ], "muted");
    writeLineRich([token("Graphs (cost graph theory):", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("graph", "out-fn"),
      token("(\"name\")", "out-op"),
      "  ",
      token("gnode", "out-fn"),
      token("(g,\"id\", cost)", "out-op"),
      "  ",
      token("gexpr", "out-fn"),
      token("(g,\"id\", \"expr\")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("gedge", "out-fn"),
      token("(g,\"from\",\"to\")", "out-op"),
      "  ",
      token("gsum", "out-fn"),
      token("(g)", "out-op"),
      "  ",
      token("gcalc", "out-fn"),
      token("(g)", "out-op"),
      "  ",
      token("gcalcx", "out-fn"),
      token("(g)", "out-op"),
      "  ",
      token("gtotal", "out-fn"),
      token("(g)", "out-op")
    ], "muted");

    writeLineRich([token("Geometry:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("pt", "out-fn"),
      token("(x,y)", "out-op"),
      "  ",
      token("dist", "out-fn"),
      token("(ptA,ptB)", "out-op"),
      "  ",
      token("poly", "out-fn"),
      token("(pt1,pt2,pt3,...)", "out-op"),
    ], "muted");
    writeLineRich([
      "  ",
      token("poly_perim", "out-fn"),
      token("(poly)", "out-op"),
      "  ",
      token("poly_area", "out-fn"),
      token("(poly)", "out-op"),
    ], "muted");

    writeLineRich([token("Materials:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("material", "out-fn"),
      token("(\"name\", {density:..., unit_cost:...})", "out-op"),
      "  ",
      token("density", "out-fn"),
      token("(mat)", "out-op"),
      "  ",
      token("weight", "out-fn"),
      token("(qty, mat)", "out-op"),
    ], "muted");
    writeLineRich([
      "  ",
      token("vol_from_wt", "out-fn"),
      token("(wt, mat)", "out-op"),
      "  ",
      token("cost", "out-fn"),
      token("(qty, mat)", "out-op"),
    ], "muted");

    writeLineRich([token("Projects:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("project", "out-fn"),
      token("(\"name\")", "out-op"),
      "  ",
      token("ptask", "out-fn"),
      token("(p, \"id\", {dur: 4 hr; cost: 100 $})", "out-op"),
      "  ",
      token("pdep", "out-fn"),
      token("(p, \"a\", \"b\")", "out-op"),
    ], "muted");
    writeLineRich([
      "  ",
      token("pschedule", "out-fn"),
      token("(p)", "out-op"),
      "  ",
      token("pcost", "out-fn"),
      token("(p)", "out-op"),
    ], "muted");
    writeLineRich([token("CSI semantics:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("csi_norm csi_div csi_section csi_item", "out-keyword"),
      "  ",
      token("csi_rollup", "out-fn"),
      token("(line1, line2, ...)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("raycast", "out-fn"),
      token("(map, px, py, yaw, fov, viewH, maxD, step, steps, colStep)", "out-op"),
      " (draws into gfx buffer)"
    ], "muted");
    writeLineRich([
      "  ",
      token("raycast_tex", "out-fn"),
      token("(map, px, py, yaw, fov, viewH, maxD, step, steps, colStep, {floor_step:2; ceil_step:2; tex_res:1})", "out-op"),
      " (textured finishes)"
    ], "muted");
    writeLineRich([
      "  ",
      token("pix", "out-fn"),
      token("(x,y,color)", "out-op"),
      " ",
      token("line", "out-fn"),
      token("(x0,y0,x1,y1,color)", "out-op"),
      " ",
      token("rect", "out-fn"),
      token("(x,y,w,h,color)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("fill", "out-fn"),
      token("(x,y,w,h,color)", "out-op"),
      " ",
      token("plot", "out-fn"),
      token("(x,y,\"dx,dy|...\",color)", "out-op"),
      "  ",
      token("txt", "out-fn"),
      token("(x,y,\"text\",color[,scale])", "out-op"),
      "  colors: ",
      token(GFX_COLOR_TOKENS.join(", "), "out-unit")
    ], "muted");
    writeLineRich([
      "  ",
      token("gfxloop", "out-fn"),
      token("(\"script\")", "out-op"),
      " ",
      token("gfxplay()", "out-fn"),
      " ",
      token("gfxpause()", "out-fn")
    ], "muted");
    writeLineRich([
      "  ",
      token("gfxstep", "out-fn"),
      token("(n)", "out-op"),
      " ",
      token("gfxrewind", "out-fn"),
      token("(n)", "out-op"),
      " ",
      token("gfxfps", "out-fn"),
      token("(fps)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("Loop vars:", "out-label"),
      " ",
      token("frame", "out-var"),
      ", ",
      token("time", "out-var"),
      ", ",
      token("dt", "out-var"),
      " • focus gfx canvas for Space/Arrow controls"
    ], "muted");
    writeLineRich([
      "  ",
      token("Input vars:", "out-label"),
      " ",
      token("key_w key_a key_s key_d key_left key_right key_up key_down key_shift key_space key_e key_q key_f", "out-var"),
      " | ",
      token("mouse_dx mouse_dy mouse_btn0 mouse_btn1 mouse_btn2", "out-var"),
    ], "muted");
    writeLineRich([token("Session commands:", "out-label")], "muted");
    writeLineRich(["  ", token(":docs", "out-command"), " show this page"], "muted");
    writeLineRich(["  ", token(":clear", "out-command"), " clear terminal output"], "muted");
    writeLineRich(["  ", token(":vars", "out-command"), " list variables"], "muted");
    writeLineRich(["  ", token(":methods", "out-command"), " list user methods"], "muted");
    writeLineRich(["  ", token(":reset", "out-command"), " reset vars + history"], "muted");
    writeLineRich(["  ", token(":save", "out-command"), " name [--include-globals] [--recent|--last] [--roots=a,b] save modular profile"], "muted");
    writeLineRich(["  ", token(":mux", "out-command"), " name (alias of :save)"], "muted");
    writeLineRich(["  ", token(":load", "out-command"), " name load saved profile"], "muted");
    writeLineRich(["  ", token(":profiles", "out-command"), " list saved profiles"], "muted");
    writeLineRich(["  ", token(":pin", "out-command"), " name always include symbol when saving"], "muted");
    writeLineRich(["  ", token(":unpin", "out-command"), " name remove pin"], "muted");
    writeLineRich(["  ", token(":which", "out-command"), " name show resolved symbol origin"], "muted");
    writeLineRich(["  ", token(":use", "out-command"), " name@profile force symbol selection"], "muted");
    writeLineRich(["  ", token(":diff", "out-command"), " name compare symbol versions"], "muted");
    writeLineRich(["  ", token(":export", "out-command"), " copy profile JSON to clipboard"], "muted");
    writeLineRich(["  ", token(":import", "out-command"), " load profile JSON from clipboard"], "muted");
    writeLineRich(["  ", token(":upload", "out-command"), " name upload a file into a variable (json auto-parsed)"], "muted");
    writeLineRich(["  ", token(":download", "out-command"), " name [csv|json] [filename] download a variable"], "muted");
    writeLineRich(["  ", token(":theme", "out-command"), " default|amber|matrix"], "muted");
    writeLineRich(["  ", token(":test", "out-command"), " run the built-in test suite"], "muted");
    writeLineRich(["  ", token(":doom", "out-command"), " run the gfx loop demo"], "muted");
    writeLineRich(["  ", token(":latent", "out-command"), " [load|test] load/test latent mux walker module"], "muted");

    writeLineRich([token("Effects + determinism:", "out-label")], "muted");
    writeLineRich([
      "  Some functions are side-effecting and are blocked in pure contexts.",
    ], "muted");
    writeLineRich([
      "  Errors are prefixed with ",
      token("ERR[E_EFFECT]", "out-op"),
      " when a disallowed effect is used.",
    ], "muted");
    writeLineRich([
      "  Effect groups: ",
      token("PURE", "out-keyword"),
      " | ",
      token("IO_GFX", "out-keyword"),
      " | ",
      token("STATE", "out-keyword"),
      " | ",
      token("RNG", "out-keyword"),
      " | ",
      token("TIME", "out-keyword"),
      ".",
    ], "muted");
    writeLineRich([
      "  Seeded randomness: ",
      token("seed", "out-fn"),
      token("(123)", "out-op"),
      " makes random sampling deterministic for the session.",
    ], "muted");
    writeLineRich([
      "  Expression if is lazy: ",
      token("if", "out-fn"),
      token("(cond, thenExpr, elseExpr)", "out-op"),
      " only evaluates the chosen branch.",
    ], "muted");
    writeLineRich([
      "  Type/unit errors use ",
      token("ERR[E_TYPE]", "out-op"),
      " and ",
      token("ERR[E_DIM]", "out-op"),
      " (expected vs got).",
    ], "muted");
    writeLineRich([token("Tips:", "out-label")], "muted");
    writeLineRich([
      "  - Shift+Enter inserts a new line. Enter runs when the statement is complete."
    ], "muted");
    writeLineRich([
      "  - Use the Construction Helpers panel to preview a function and insert a starter template."
    ], "muted");
    writeLineRich([
      "  - Use Up/Down to cycle history; Ctrl/Cmd+L clears the terminal."
    ], "muted");
    writeLineRich([
      "  - Autocomplete works for commands (:), functions, units, variables, constants."
    ], "muted");
  }

  function listVars(){
    const keys = Object.keys(state.vars).sort();
    if (!keys.length){
      writeLine("No variables set.", "muted");
      return;
    }
    writeLine("Variables:", "ok");
    for (const k of keys){
      const formatted = formatValueDisplay(state.vars[k]);
      writeLineRich([
        "  ",
        token(k, "out-var"),
        " ",
        token("=", "out-op"),
        " ",
        token(formatted.main, "out-number")
      ], "muted");
      if (formatted.extra) writeLine(`↳ ${formatted.extra}`, "muted");
    }
  }

  function listMethods(){
    const keys = Object.keys(state.userFns).sort();
    if (!keys.length){
      writeLine("No user solutions defined.", "muted");
      return;
    }
    writeLine("User solutions:", "ok");
    for (const k of keys){
      const defn = state.userFns[k];
      const params = defn.params ? defn.params.join(", ") : "";
      writeLineRich([
        "  ",
        token(k, "out-fn"),
        token("(", "out-op"),
        token(params, "out-var"),
        token(")", "out-op"),
        " ",
        token("=", "out-op"),
        " ",
        token(defn.expr, "out-string")
      ], "muted");
    }
  }

  return {
    showDocs,
    listVars,
    listMethods,
  };
}
