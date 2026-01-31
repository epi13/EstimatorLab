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

  function formatExpectedValue(expected){
    if (expected && typeof expected === "object" && expected.type === "qty"){
      return qtyToString(makeQty(expected.value, expected.kind));
    }
    if (expected && typeof expected === "object" && expected.type === "scalar"){
      return String(expected.value);
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
