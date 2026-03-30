import { STATEMENT_TYPE } from "./repl-statement-schema.js";
import { isBlockNode } from "./repl-ast.js";

export function createTests({
  state,
  setStatus,
  writeLine,
  renderUserFunctions,
  formatAssemblySummary,
  makeQty,
  isQty,
  formatInput,
  qtyToString,
  frontend,
  executeProgram,
}){

  async function fetchText(url){
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok){
      throw new Error(`Failed to load ${url} (${res.status})`);
    }
    return await res.text();
  }

  function applyModuleSource(source, label){
    const programBlock = frontend.parseSource(source);
    if (!isBlockNode(programBlock)){
      throw new Error(`${label}: expected parser to return an AST block node.`);
    }
    for (const stmt of programBlock.statements || []){
      const stmtType = stmt.type || stmt.kind;
      if (stmtType === STATEMENT_TYPE.IF || stmtType === STATEMENT_TYPE.FOR || stmtType === STATEMENT_TYPE.REPEAT){
        throw new Error(`${label} may not contain flow statements`);
      }
    }
    executeProgram(programBlock, state.vars, "commit", {
      allowCommands: false,
      wrapErrors: false,
      captureResults: false,
      commandErrorMessage: `${label} may not contain commands`,
    });
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

    const suite = executeProgram("test_suite()", state.vars, "commit", {
      allowCommands: false,
      wrapErrors: false,
      captureResults: true,
    }).lastValue;
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
    const programBlock = frontend.parseSource(source);
    if (!isBlockNode(programBlock)){
      throw new Error("Tests: expected parser to return an AST block node.");
    }
    const cmdStmt = (programBlock.statements || []).find((stmt) => (stmt.type || stmt.kind) === STATEMENT_TYPE.CMD);
    if (cmdStmt) throw new Error(`Test cannot use command :${cmdStmt.cmd}`);
    return executeProgram(programBlock, state.vars, "commit", {
      allowCommands: false,
      wrapErrors: false,
      captureResults: true,
      commandErrorMessage: "Test cannot use commands",
    }).lastValue;
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
    try{
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

      if (!failures.length){
        writeLine(`Tests complete: ${passCount}/${tests.length} passed.`, "ok");
      }else{
        writeLine(`Tests complete: ${passCount}/${tests.length} passed.`, "warn");
        failures.forEach((fail) => {
          writeLine(`✗ ${fail.name}: ${fail.reason}`, "err");
        });
      }
    }catch(err){
      writeLine(err?.message || String(err), "err");
    }finally{
      state.vars = savedState.vars;
      state.userFns = savedState.userFns;
      state.history = savedState.history;
      state.histIdx = savedState.histIdx;
      state.witness = savedState.witness;
      state.witnessLog = savedState.witnessLog;
      renderUserFunctions();
      setStatus("Ready", "ok");
    }
  }

  return {
    runTestSuite,
  };
}
