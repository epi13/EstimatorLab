export function createHelp({ writeLine, writeLineRich, token, GFX_COLOR_TOKENS }){
  function showHelp(){
    writeLine("Estimator REPL help", "ok");
    writeLineRich([
      token("Math:", "out-label"),
      " ",
      token("+  -  *  /  ^  ( )", "out-op"),
      " comparisons ",
      token("(== != < <= > >=)", "out-op"),
      " and logic ",
      token("(&& ||)", "out-op")
    ], "muted");
    writeLineRich([
      token("Variables:", "out-label"),
      " ",
      token("x", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("12.5", "out-number"),
      "   |   use: ",
      token("x", "out-var"),
      token("*", "out-op"),
      token("3", "out-number")
    ], "muted");
    writeLineRich([
      token("Solutions:", "out-label"),
      " ",
      token("def", "out-keyword"),
      token("|", "out-op"),
      token("so", "out-keyword"),
      token("|", "out-op"),
      token("function", "out-keyword"),
      " ",
      token("name", "out-fn"),
      token("(", "out-op"),
      token("a,b", "out-var"),
      token(")", "out-op"),
      " = expression (redefine to edit)"
    ], "muted");
    writeLineRich([
      token("Flow:", "out-label"),
      " ",
      token("if", "out-keyword"),
      " condition: expr [",
      token("else", "out-keyword"),
      ": expr]"
    ], "muted");
    writeLineRich([
      token("Loop:", "out-label"),
      " ",
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
      token("Strings:", "out-label"),
      " ",
      token("\"text\"", "out-string"),
      " or ",
      token("'text'", "out-string"),
      " (used for meta commands like ",
      token("eval", "out-fn"),
      "/",
      token("set", "out-fn"),
      ")"
    ], "muted");
    writeLineRich([
      token("Units:", "out-label"),
      " ",
      token("in, ft, lf, yd, sf, sy, cf, cy, lb, ton, layer", "out-unit"),
      " (use like: ",
      token("12", "out-number"),
      " ",
      token("ft", "out-unit"),
      " + ",
      token("6", "out-number"),
      " ",
      token("in", "out-unit"),
      ")"
    ], "muted");
    writeLineRich([
      token("Assemblies:", "out-label"),
      " ",
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
      token("}", "out-op"),
      "  |  ",
      token("qty", "out-fn"),
      token("(wall, 120 lf)", "out-op")
    ], "muted");
    writeLineRich([
      token("Solve:", "out-label"),
      " expr ",
      token("=", "out-op"),
      " expr (one unknown variable, ex: ",
      token("56", "out-number"),
      " ",
      token("cy", "out-unit"),
      " ",
      token("=", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(", "out-op"),
      token("sf", "out-unit"),
      ", ",
      token("6", "out-number"),
      " ",
      token("in", "out-unit"),
      token(")", "out-op"),
      ")"
    ], "muted");
    writeLineRich([
      token("Editor:", "out-label"),
      " autocomplete, syntax highlight, and live preview while typing"
    ], "muted");
    writeLineRich([
      token("Tip:", "out-label"),
      " Enter runs when complete; Enter adds new line if incomplete."
    ], "muted");
    writeLineRich([
      token("Meta:", "out-label"),
      " ",
      token("eval", "out-fn"),
      token("(", "out-op"),
      token("\"expr\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("set", "out-fn"),
      token("(", "out-op"),
      token("\"x\"", "out-string"),
      token(", ", "out-op"),
      token("5", "out-number"),
      token(")", "out-op"),
      " ",
      token("get", "out-fn"),
      token("(", "out-op"),
      token("\"x\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("unset", "out-fn"),
      token("(", "out-op"),
      token("\"x\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("vars()", "out-fn"),
      " ",
      token("methods()", "out-fn")
    ], "muted");
    writeLineRich([
      token("Meta:", "out-label"),
      " ",
      token("define", "out-fn"),
      token("(", "out-op"),
      token("\"solution\"", "out-string"),
      ", ",
      token("\"a,b\"", "out-string"),
      ", ",
      token("\"a+b\"", "out-string"),
      token(")", "out-op"),
      " ",
      token("undefine", "out-fn"),
      token("(", "out-op"),
      token("\"solution\"", "out-string"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      token("Graphics:", "out-label"),
      " ",
      token("gfx", "out-fn"),
      token("(w,h)", "out-op"),
      " ",
      token("pix", "out-fn"),
      token("(x,y,color)", "out-op"),
      " ",
      token("line", "out-fn"),
      token("(x0,y0,x1,y1,color)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("rect", "out-fn"),
      token("(x,y,w,h,color)", "out-op"),
      " ",
      token("fill", "out-fn"),
      token("(x,y,w,h,color)", "out-op"),
      " ",
      token("plot", "out-fn"),
      token("(x,y,\"dx,dy|...\",color)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("bg", "out-fn"),
      token("(color)", "out-op"),
      " ",
      token("gfxs", "out-fn"),
      token("(scale)", "out-op"),
      " ",
      token("cls()", "out-fn"),
      "  colors: ",
      token(GFX_COLOR_TOKENS.join(", "), "out-unit")
    ], "muted");
    writeLineRich([token("Commands:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token(":help", "out-command"),
      "                show help"
    ], "muted");
    writeLineRich([
      "  ",
      token(":docs", "out-command"),
      "                detailed docs + examples"
    ], "muted");
    writeLineRich([
      "  ",
      token(":clear", "out-command"),
      "               clear terminal output"
    ], "muted");
    writeLineRich([
      "  ",
      token(":vars", "out-command"),
      "                list variables"
    ], "muted");
    writeLineRich([
      "  ",
      token(":methods", "out-command"),
      "             list user methods"
    ], "muted");
    writeLineRich([
      "  ",
      token(":reset", "out-command"),
      "               reset vars + history"
    ], "muted");
    writeLineRich([
      "  ",
      token(":save", "out-command"),
      " name [--recent|--roots a,b|--include-globals] save modular profile"
    ], "muted");
    writeLineRich([
      "  ",
      token(":mux", "out-command"),
      " name          merge loaded profiles into new profile"
    ], "muted");
    writeLineRich([
      "  ",
      token(":load", "out-command"),
      " name          load saved profile (no reset)"
    ], "muted");
    writeLineRich([
      "  ",
      token(":profiles", "out-command"),
      "            list saved profiles"
    ], "muted");
    writeLineRich([
      "  ",
      token(":pin", "out-command"),
      " name          always include symbol when saving"
    ], "muted");
    writeLineRich([
      "  ",
      token(":unpin", "out-command"),
      " name        remove pin"
    ], "muted");
    writeLineRich([
      "  ",
      token(":which", "out-command"),
      " name       show resolved symbol origin"
    ], "muted");
    writeLineRich([
      "  ",
      token(":use", "out-command"),
      " name@profile force symbol selection"
    ], "muted");
    writeLineRich([
      "  ",
      token(":diff", "out-command"),
      " name        compare symbol versions"
    ], "muted");
    writeLineRich([
      "  ",
      token(":export", "out-command"),
      "              copy profile JSON to clipboard"
    ], "muted");
    writeLineRich([
      "  ",
      token(":import", "out-command"),
      "              load profile JSON from clipboard"
    ], "muted");
    writeLineRich([
      "  ",
      token(":theme", "out-command"),
      " ",
      token("default", "out-keyword"),
      token("|", "out-op"),
      token("amber", "out-keyword"),
      token("|", "out-op"),
      token("matrix", "out-keyword")
    ], "muted");
    writeLineRich([
      "  ",
      token(":test", "out-command"),
      "                run the built-in test suite"
    ], "muted");
    writeLineRich([token("Solutions:", "out-label")], "muted");
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
      token("unit", "out-fn"),
      token("(cost,qty)", "out-op"),
      "  ",
      token("qty", "out-fn"),
      token("(assy,len)", "out-op"),
      "  ",
      token("round_up", "out-fn"),
      token("(x,step)", "out-op")
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
    writeLineRich([
      "  ",
      token("to_in", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_ft", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_sf", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_sy", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_cf", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_cy", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_lb", "out-fn"),
      token("(x)", "out-op"),
      " ",
      token("to_ton", "out-fn"),
      token("(x)", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("abs min max round ceil floor sqrt pow exp log log10 sin cos tan atan2 clamp if", "out-keyword")
    ], "muted");
    writeLineRich([token("Examples:", "out-label")], "muted");
    writeLineRich([
      "  ",
      token("slab", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("concrete_cy", "out-fn"),
      token("(", "out-op"),
      token("1200", "out-number"),
      " ",
      token("sf", "out-unit"),
      ", ",
      token("4", "out-number"),
      " ",
      token("in", "out-unit"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("total", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("markup", "out-fn"),
      token("(", "out-op"),
      token("burden", "out-fn"),
      token("(", "out-op"),
      token("12500", "out-number"),
      ", ",
      token("16.7", "out-number"),
      token(")", "out-op"),
      ", ",
      token("35", "out-number"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("waste", "out-fn"),
      token("(", "out-op"),
      token("500", "out-number"),
      " ",
      token("sf", "out-unit"),
      ", ",
      token("10", "out-number"),
      token(")", "out-op")
    ], "muted");
    writeLineRich([
      "  ",
      token("so", "out-keyword"),
      " ",
      token("crew_cost", "out-fn"),
      token("(", "out-op"),
      token("rate, hours", "out-var"),
      token(")", "out-op"),
      " ",
      token("=", "out-op"),
      " ",
      token("rate", "out-var"),
      " ",
      token("*", "out-op"),
      " ",
      token("hours", "out-var")
    ], "muted");
    writeLineRich([
      "  ",
      token("for", "out-keyword"),
      " i ",
      token("in", "out-keyword"),
      " ",
      token("1..4", "out-number"),
      ": ",
      token("total", "out-var"),
      " ",
      token("=", "out-op"),
      " ",
      token("total", "out-var"),
      " ",
      token("+", "out-op"),
      " i"
    ], "muted");
    writeLineRich([
      "  ",
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
  }

  return { showHelp };
}
