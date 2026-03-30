export function attachLinAlgBuiltins(baseFns, {
  defFn,
  defFnCtx,
  isQty,
  makeQty,
  add,
  sub,
  mul,
  div,
  pow,
  OPS_INTERNAL,
}){
  function requireScalarArg(value, label){
    if (isQty(value) && value.kind !== "scalar"){
      throw new Error(`${label} expects a dimensionless scalar value`);
    }
    return isQty(value) ? value.value : value;
  }

  function isVec(value){
    return OPS_INTERNAL.isVec(value);
  }

  function isMat(value){
    return OPS_INTERNAL.isMat(value);
  }

  function requireVec(value, label){
    if (!isVec(value)) throw new Error(`${label} expects a vector`);
    return value;
  }

  function requireMat(value, label){
    if (!isMat(value)) throw new Error(`${label} expects a matrix`);
    return value;
  }

  function scalarNumber(value, label){
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && typeof value.__kind === "string"){
      if (value.__kind === "scalar") return value.value;
      if (value.__kind === "bool") return value.value ? 1 : 0;
    }
    if (isQty(value)){
      if (value.kind !== "scalar") throw new Error(`${label} expects dimensionless scalar values`);
      return value.value;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${label} expects numeric scalar`);
    return n;
  }

  baseFns.vec = defFn("vec", -1, {
    args: [],
    returns: { kinds: ["vec"] },
  }, (...args) => {
    return OPS_INTERNAL.makeVec("vec", args);
  });

  baseFns.mat = defFn("mat", -1, {
    args: [
      { label: "rows_or_text", kinds: ["scalar", "dim", "string"] },
      { label: "cols", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["mat"] },
  }, (...args) => {
    if (args.length === 1 && typeof args[0] === "string"){
      const text = args[0].trim();
      if (!text) throw new Error("mat expects a non-empty string");
      const rows = text.split(";").map((row) => row.trim()).filter(Boolean);
      const parsedRows = rows.map((row) => row.split(",").map((cell) => cell.trim()).filter(Boolean));
      const rowCount = parsedRows.length;
      const colCount = parsedRows[0]?.length || 0;
      if (!rowCount || !colCount) throw new Error("mat expects at least 1x1");
      for (const row of parsedRows){
        if (row.length !== colCount) throw new Error("mat rows must all be same length");
      }
      const elements = [];
      for (let r = 0; r < rowCount; r++){
        for (let c = 0; c < colCount; c++){
          const raw = parsedRows[r][c];
          const num = Number(raw);
          if (!Number.isFinite(num)) throw new Error("mat string cells must be numeric");
          elements.push(num);
        }
      }
      return OPS_INTERNAL.makeMat("mat", rowCount, colCount, elements);
    }

    if (args.length < 3) throw new Error("mat expects (rows, cols, ...elements) or mat(\"...\")");
    const rows = Math.floor(requireScalarArg(args[0], "mat"));
    const cols = Math.floor(requireScalarArg(args[1], "mat"));
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0) throw new Error("mat rows/cols must be > 0");
    const elements = args.slice(2);
    if (elements.length !== rows * cols) throw new Error("mat element count mismatch");
    return OPS_INTERNAL.makeMat("mat", rows, cols, elements);
  });

  baseFns.vec_len = defFn("vec_len", 1, {
    args: [{ label: "vec", kinds: ["vec"] }],
  }, (vec) => {
    const v = requireVec(vec, "vec_len");
    const data = Array.isArray(v.data) ? v.data : [];
    let acc = null;
    for (const x of data){
      const term = mul(x, x);
      acc = acc === null ? term : add(acc, term);
    }
    return pow(acc === null ? 0 : acc, 0.5);
  });

  baseFns.vec_dot = defFn("vec_dot", 2, {
    args: [{ label: "a", kinds: ["vec"] }, { label: "b", kinds: ["vec"] }],
  }, (a, b) => {
    const va = requireVec(a, "vec_dot");
    const vb = requireVec(b, "vec_dot");
    if ((va.data || []).length !== (vb.data || []).length) throw new Error("vec_dot size mismatch");
    let acc = null;
    for (let i = 0; i < va.data.length; i++){
      const term = mul(va.data[i], vb.data[i]);
      acc = acc === null ? term : add(acc, term);
    }
    return acc === null ? 0 : acc;
  });

  baseFns.mat_T = defFn("mat_T", 1, {
    args: [{ label: "m", kinds: ["mat"] }],
    returns: { kinds: ["mat"] },
  }, (m) => {
    const mat = requireMat(m, "mat_T");
    const rows = mat.rows;
    const cols = mat.cols;
    const out = [];
    for (let c = 0; c < cols; c++){
      for (let r = 0; r < rows; r++){
        out.push(mat.data[r * cols + c]);
      }
    }
    return OPS_INTERNAL.makeMat("mat", cols, rows, out);
  });

  baseFns.mat_shape = defFn("mat_shape", 1, {
    args: [{ label: "m", kinds: ["mat"] }],
    returns: { kinds: ["assy"] },
  }, (m) => {
    const mat = requireMat(m, "mat_shape");
    return { __assy: true, name: "shape", fields: {
      rows: { value: mat.rows, note: "", raw: "" },
      cols: { value: mat.cols, note: "", raw: "" },
    } };
  });

  baseFns.mat_solve = defFn("mat_solve", 2, {
    args: [{ label: "A", kinds: ["mat"] }, { label: "b", kinds: ["vec"] }],
    returns: { kinds: ["vec"] },
  }, (A, b) => {
    const mat = requireMat(A, "mat_solve");
    const vec = requireVec(b, "mat_solve");
    const n = mat.rows;
    if (mat.cols !== n) throw new Error("mat_solve requires square matrix");
    if ((vec.data || []).length !== n) throw new Error("mat_solve vector size mismatch");

    const M = new Array(n);
    for (let r = 0; r < n; r++){
      M[r] = new Array(n);
      for (let c = 0; c < n; c++){
        M[r][c] = scalarNumber(mat.data[r * n + c], "mat_solve");
      }
    }
    const y = vec.data.map((v) => scalarNumber(v, "mat_solve"));

    for (let k = 0; k < n; k++){
      let piv = k;
      let best = Math.abs(M[k][k]);
      for (let r = k + 1; r < n; r++){
        const v = Math.abs(M[r][k]);
        if (v > best){ best = v; piv = r; }
      }
      if (best < 1e-12) throw new Error("mat_solve singular matrix");
      if (piv !== k){
        const tmp = M[k];
        M[k] = M[piv];
        M[piv] = tmp;
        const ty = y[k];
        y[k] = y[piv];
        y[piv] = ty;
      }

      const diag = M[k][k];
      for (let c = k; c < n; c++) M[k][c] /= diag;
      y[k] /= diag;

      for (let r = 0; r < n; r++){
        if (r === k) continue;
        const f = M[r][k];
        if (f === 0) continue;
        for (let c = k; c < n; c++) M[r][c] -= f * M[k][c];
        y[r] -= f * y[k];
      }
    }

    return OPS_INTERNAL.makeVec("vec", y);
  });

  baseFns.nsolve = defFnCtx("nsolve", 3, {
    args: [
      { label: "expr", kinds: ["string"] },
      { label: "varName", kinds: ["string"] },
      { label: "guess", kinds: ["scalar", "dim"], dim: "scalar" },
    ],
    returns: { kinds: ["scalar"] },
  }, (ctx, expr, varName, guess) => {
    if (!ctx || typeof ctx.evalExpr !== "function") throw new Error("nsolve requires evalExpr support");
    if (typeof expr !== "string") throw new Error("nsolve expects expression string");
    if (typeof varName !== "string") throw new Error("nsolve expects variable name string");
    const v = varName.trim();
    if (!v) throw new Error("nsolve expects non-empty variable name");

    let x = scalarNumber(guess, "nsolve guess");
    const tol = 1e-9;
    const maxIter = 50;

    const f = (xv) => {
      const out = ctx.evalExpr(expr, { [v]: xv });
      return scalarNumber(out, "nsolve f(x)");
    };

    let fx = f(x);
    if (Math.abs(fx) <= tol) return x;

    for (let i = 0; i < maxIter; i++){
      const h = 1e-6 * (Math.abs(x) + 1);
      const d = (f(x + h) - f(x - h)) / (2 * h);
      if (!Number.isFinite(d) || Math.abs(d) < 1e-12) break;
      const step = fx / d;
      const x2 = x - step;
      if (!Number.isFinite(x2)) break;
      x = x2;
      fx = f(x);
      if (Math.abs(fx) <= tol) return x;
      if (Math.abs(step) <= tol) return x;
    }

    let x0 = scalarNumber(guess, "nsolve guess");
    let x1 = x0 + 1;
    let f0 = f(x0);
    let f1 = f(x1);
    for (let i = 0; i < 80; i++){
      const denom = (f1 - f0);
      if (Math.abs(denom) < 1e-12) break;
      const x2 = x1 - f1 * (x1 - x0) / denom;
      if (!Number.isFinite(x2)) break;
      const f2 = f(x2);
      if (Math.abs(f2) <= tol) return x2;
      x0 = x1;
      f0 = f1;
      x1 = x2;
      f1 = f2;
    }

    throw new Error("nsolve did not converge");
  });
}
