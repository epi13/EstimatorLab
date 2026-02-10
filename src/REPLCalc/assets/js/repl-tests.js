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

  async function fetchText(url){
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok){
      throw new Error(`Failed to load ${url} (${res.status})`);
    }
    return await res.text();
  }

  function applyModuleSource(source, label){
    const statements = splitStatements(source);
    for (const stmt of statements){
      const parsed = evaluate(stmt);
      if (!parsed) continue;

      if (parsed.type === "cmd"){
        throw new Error(`${label} may not contain commands`);
      }

      if (parsed.type === "def"){
        defineUserFn(parsed.name, parsed.params, parsed.expr);
        continue;
      }

      if (parsed.type === "assy"){
        const assembly = createAssembly(parsed.name, parsed.fields);
        state.vars[parsed.name] = assembly;
        continue;
      }

      if (parsed.type === "assign"){
        state.vars[parsed.name] = runExpression(parsed.expr);
        continue;
      }

      if (parsed.type === "equation"){
        const solved = solveEquation(parsed.left, parsed.right);
        if (!solved.unknown.unitToken){
          state.vars[solved.unknown.name] = solved.value;
        }
        continue;
      }

      if (parsed.type === "expr"){
        runExpression(parsed.expr);
        continue;
      }

      if (parsed.type === "if" || parsed.type === "for" || parsed.type === "repeat"){
        throw new Error(`${label} may not contain flow statements`);
      }
    }
  }

  function assyField(assy, name){
    if (!assy || typeof assy !== "object") return undefined;
    const entry = assy.fields ? assy.fields[name] : null;
    return entry ? entry.value : undefined;
  }

  function unboxEstString(value){
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && value.__kind === "string") return value.value;
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function unboxEstNumber(value){
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && value.__kind === "scalar") return value.value;
    if (value && typeof value === "object" && value.__kind === "bool") return value.value ? 1 : 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function parseEstExpectation(expectVal){
    if (expectVal && typeof expectVal === "object" && expectVal.__assy){
      const type = unboxEstString(assyField(expectVal, "type"));
      if (type === "qty"){
        return {
          type: "qty",
          value: unboxEstNumber(assyField(expectVal, "value")),
          kind: unboxEstString(assyField(expectVal, "kind")),
          tol: unboxEstNumber(assyField(expectVal, "tol")),
        };
      }
      if (type === "scalar"){
        return {
          type: "scalar",
          value: unboxEstNumber(assyField(expectVal, "value")),
          tol: unboxEstNumber(assyField(expectVal, "tol")),
        };
      }
      if (type === "gfx"){
        const scale = assyField(expectVal, "scale");
        return {
          type: "gfx",
          w: unboxEstNumber(assyField(expectVal, "w")),
          h: unboxEstNumber(assyField(expectVal, "h")),
          scale: (scale === undefined) ? null : unboxEstNumber(scale),
        };
      }
      if (type === "error"){
        const re = assyField(expectVal, "re");
        if (re !== undefined){
          const flags = unboxEstString(assyField(expectVal, "flags"));
          return { type: "error", message: new RegExp(unboxEstString(re), flags) };
        }
        return { type: "error", message: unboxEstString(assyField(expectVal, "message")) };
      }
    }
    return unboxTestValue(expectVal);
  }

  async function loadTestSuite(){
    const suiteSource = await fetchText("assets/est/tests/test-suite.est");
    applyModuleSource(suiteSource, "tests");

    const constructionSource = await fetchText("assets/est/construction/construction-helpers.est");
    applyModuleSource(constructionSource, "construction helpers");

    const suite = runExpression("test_suite()");
    if (!suite || typeof suite !== "object" || !suite.__vec || !Array.isArray(suite.data)){
      throw new Error("test_suite(): expected vec");
    }

    return suite.data.map((entry) => {
      if (!entry || typeof entry !== "object" || !entry.__assy){
        throw new Error("test_suite(): entries must be records");
      }
      const name = unboxEstString(assyField(entry, "name"));
      const expr = assyField(entry, "expr");
      const steps = assyField(entry, "steps");
      const expect = parseEstExpectation(assyField(entry, "expect"));
      const out = { name, expect };
      if (steps && typeof steps === "object" && steps.__vec && Array.isArray(steps.data)){
        out.steps = steps.data.map(unboxEstString);
      }else{
        out.expr = unboxEstString(expr);
      }
      return out;
    });
  }



  function unboxTestValue(value){
    if (!value || typeof value !== "object") return value;
    if (value.__kind === "scalar") return value.value;
    if (value.__kind === "bool") return value.value ? 1 : 0;
    if (value.__kind === "string") return value.value;
    if (value.__kind === "null") return null;
    return value;
  }

  function formatTestValue(value){
    if (value && typeof value === "object" && typeof value.__kind === "string") return qtyToString(value);
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
    const actualUnboxed = unboxTestValue(actual);
    if (expected && typeof expected === "object" && expected.type === "error"){
      return { pass: false, message: "expected error, got value" };
    }
    if (expected && typeof expected === "object" && expected.type === "gfx"){
      if (!actualUnboxed || typeof actualUnboxed !== "object" || !actualUnboxed.__gfx){
        return { pass: false, message: "expected gfx" };
      }
      if (Number.isFinite(expected.w) && actualUnboxed.width !== expected.w){
        return { pass: false, message: `expected gfx width ${expected.w}, got ${actualUnboxed.width}` };
      }
      if (Number.isFinite(expected.h) && actualUnboxed.height !== expected.h){
        return { pass: false, message: `expected gfx height ${expected.h}, got ${actualUnboxed.height}` };
      }
      if (expected.scale !== null && expected.scale !== undefined && Number.isFinite(expected.scale) && actualUnboxed.scale !== expected.scale){
        return { pass: false, message: `expected gfx scale ${expected.scale}, got ${actualUnboxed.scale}` };
      }
      return { pass: true };
    }
    if (expected && typeof expected === "object" && expected.type === "qty"){
      if (!isQty(actual)) return { pass: false, message: `expected quantity ${expected.kind}` };
      if (actual.kind !== expected.kind) return { pass: false, message: `expected ${expected.kind}, got ${actual.kind}` };
      const delta = Math.abs(actual.value - expected.value);
      if (delta > expected.tol) return { pass: false, message: `expected ${expected.value} ${expected.kind}, got ${actual.value} ${actual.kind}` };
      return { pass: true };
    }
    if (expected && typeof expected === "object" && expected.type === "scalar"){
      const actualValue = isQty(actual) ? actual.value : actualUnboxed;
      const delta = Math.abs(actualValue - expected.value);
      if (delta > expected.tol) return { pass: false, message: `expected ${expected.value}, got ${actualValue}` };
      return { pass: true };
    }
    if (typeof expected === "number"){
      const actualValue = isQty(actual) ? actual.value : actualUnboxed;
      if (Math.abs(actualValue - expected) > tol){
        return { pass: false, message: `expected ${expected}, got ${actualValue}` };
      }
      return { pass: true };
    }
    if (Object.is(actualUnboxed, expected)) return { pass: true };
    return { pass: false, message: `expected ${String(expected)}, got ${formatTestValue(actualUnboxed)}` };
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

  async function runTestSuite(){
    setStatus("Testing...", "warn");
    writeLine("Running REPLCalc tests...", "ok");
    const savedState = {
      vars: state.vars,
      userFns: state.userFns,
      history: state.history,
      histIdx: state.histIdx,
      witness: state.witness,
      witnessLog: state.witnessLog,
    };
    state.vars = Object.create(null);
    state.userFns = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    state.witness = [];
    state.witnessLog = [];
    renderUserFunctions();

    const tests = await loadTestSuite();
    let passCount = 0;
    const failures = [];

    writeLine(`Test plan: ${tests.length} checks.`, "muted");

    for (const test of tests){
      try{
        state.vars = Object.create(null);
        state.userFns = Object.create(null);
        state.history = [];
        state.histIdx = -1;
        state.witness = [];
        state.witnessLog = [];
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
    state.witness = savedState.witness;
    state.witnessLog = savedState.witnessLog;
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
