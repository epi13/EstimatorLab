export const __internal = {
  distNormal: null,
  distTri: null,
  distUniform: null,
};

export function attachUncertaintyBuiltins(baseFns, {
  defFn,
  defFnCtx,
  isQty,
  makeQty,
  add,
  sub,
  mul,
  div,
  normalizeCompare,
  OPS_INTERNAL,
  buildAssy,
  fieldInfo,
}){
  function isDist(value){
    return value && typeof value === "object" && value.__dist;
  }

  function scalarOrQty(value, label){
    if (isQty(value)) return value;
    const num = Number(value);
    if (!Number.isFinite(num)) throw new Error(`${label} must be numeric`);
    return num;
  }

  function distNormal(mu, sigma){
    const m = scalarOrQty(mu, "mu");
    const s = scalarOrQty(sigma, "sigma");
    if (isQty(m) !== isQty(s)) throw new Error("dist.normal mu/sigma must both be quantities or both be scalars");
    if (isQty(m)){
      const [mv, sv] = normalizeCompare(m, s);
      if (sv <= 0) throw new Error("dist.normal sigma must be > 0");
      return { __dist: true, kind: "normal", mu: m, sigma: s };
    }
    if (!(Number.isFinite(m) && Number.isFinite(s)) || s <= 0) throw new Error("dist.normal expects sigma > 0");
    return { __dist: true, kind: "normal", mu: m, sigma: s };
  }

  function distTri(a, b, c){
    const aa = scalarOrQty(a, "a");
    const bb = scalarOrQty(b, "b");
    const cc = scalarOrQty(c, "c");
    if (isQty(aa) !== isQty(bb) || isQty(aa) !== isQty(cc)) throw new Error("dist.tri params must all be quantities or all be scalars");
    if (isQty(aa)){
      const av = aa.value;
      const bv = bb.value;
      const cv = cc.value;
      if (aa.kind !== bb.kind || aa.kind !== cc.kind) throw new Error("dist.tri quantity params must have same units");
      if (!(av <= cv && cv <= bv)) throw new Error("dist.tri requires a <= c <= b");
      return { __dist: true, kind: "tri", a: aa, b: bb, c: cc };
    }
    if (!(Number.isFinite(aa) && Number.isFinite(bb) && Number.isFinite(cc))) throw new Error("dist.tri params must be numeric");
    if (!(aa <= cc && cc <= bb)) throw new Error("dist.tri requires a <= c <= b");
    return { __dist: true, kind: "tri", a: aa, b: bb, c: cc };
  }

  function distUniform(lo, hi){
    const l0 = scalarOrQty(lo, "lo");
    const h0 = scalarOrQty(hi, "hi");
    if (isQty(l0) !== isQty(h0)) throw new Error("dist.uniform lo/hi must both be quantities or both be scalars");
    if (isQty(l0)){
      if (l0.kind !== h0.kind) throw new Error("dist.uniform bounds must have same units");
      if (!(l0.value <= h0.value)) throw new Error("dist.uniform requires lo <= hi");
      return { __dist: true, kind: "uniform", lo: l0, hi: h0 };
    }
    if (!(Number.isFinite(l0) && Number.isFinite(h0))) throw new Error("dist.uniform bounds must be numeric");
    if (!(l0 <= h0)) throw new Error("dist.uniform requires lo <= hi");
    return { __dist: true, kind: "uniform", lo: l0, hi: h0 };
  }

  function erf(x){
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return sign * y;
  }

  function normalCdf(z){
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }

  function distCdf(dist, x){
    if (!isDist(dist)) throw new Error("cdf expects a distribution");
    if (dist.kind === "normal"){
      const mu = dist.mu;
      const sigma = dist.sigma;
      if (isQty(mu)){
        if (!isQty(x) || x.kind !== mu.kind) throw new Error("cdf(normal) x must be same unit kind as mu");
        const z = (x.value - mu.value) / sigma.value;
        return normalCdf(z);
      }
      const xv = Number(x);
      if (!Number.isFinite(xv)) throw new Error("cdf(normal) x must be numeric");
      const z = (xv - mu) / sigma;
      return normalCdf(z);
    }
    if (dist.kind === "tri"){
      const a0 = dist.a;
      const b0 = dist.b;
      const c0 = dist.c;
      if (isQty(a0)){
        if (!isQty(x) || x.kind !== a0.kind) throw new Error("cdf(tri) x must be same unit kind as a/b/c");
        const a = a0.value;
        const b = b0.value;
        const c = c0.value;
        const xv = x.value;
        if (xv <= a) return 0;
        if (xv >= b) return 1;
        if (xv <= c) return ((xv - a) * (xv - a)) / ((b - a) * (c - a));
        return 1 - ((b - xv) * (b - xv)) / ((b - a) * (b - c));
      }
      const a = a0;
      const b = b0;
      const c = c0;
      const xv = Number(x);
      if (!Number.isFinite(xv)) throw new Error("cdf(tri) x must be numeric");
      if (xv <= a) return 0;
      if (xv >= b) return 1;
      if (xv <= c) return ((xv - a) * (xv - a)) / ((b - a) * (c - a));
      return 1 - ((b - xv) * (b - xv)) / ((b - a) * (b - c));
    }
    if (dist.kind === "uniform"){
      const lo0 = dist.lo;
      const hi0 = dist.hi;
      if (isQty(lo0)){
        if (!isQty(x) || x.kind !== lo0.kind) throw new Error("cdf(uniform) x must be same unit kind as lo/hi");
        const lo = lo0.value;
        const hi = hi0.value;
        const xv = x.value;
        if (xv <= lo) return 0;
        if (xv >= hi) return 1;
        return (xv - lo) / (hi - lo);
      }
      const lo = lo0;
      const hi = hi0;
      const xv = Number(x);
      if (!Number.isFinite(xv)) throw new Error("cdf(uniform) x must be numeric");
      if (xv <= lo) return 0;
      if (xv >= hi) return 1;
      return (xv - lo) / (hi - lo);
    }
    throw new Error("cdf: unsupported distribution");
  }

  function randn(){
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function distSample(dist){
    if (!isDist(dist)) throw new Error("sample expects a distribution");
    if (dist.kind === "normal"){
      const z = randn();
      if (isQty(dist.mu)){
        return makeQty(dist.mu.value + z * dist.sigma.value, dist.mu.kind);
      }
      return dist.mu + z * dist.sigma;
    }
    if (dist.kind === "tri"){
      const u = Math.random();
      const a0 = dist.a;
      const b0 = dist.b;
      const c0 = dist.c;
      if (isQty(a0)){
        const a = a0.value;
        const b = b0.value;
        const c = c0.value;
        const fc = (c - a) / (b - a);
        const x = u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
        return makeQty(x, a0.kind);
      }
      const a = a0;
      const b = b0;
      const c = c0;
      const fc = (c - a) / (b - a);
      return u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
    }
    if (dist.kind === "uniform"){
      const lo0 = dist.lo;
      const hi0 = dist.hi;
      const u = Math.random();
      if (isQty(lo0)){
        const lo = lo0.value;
        const hi = hi0.value;
        return makeQty(lo + (hi - lo) * u, lo0.kind);
      }
      return lo0 + (hi0 - lo0) * u;
    }
    throw new Error("sample: unsupported distribution");
  }

  function percentile(sorted, p){
    if (!sorted.length) return 0;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const t = idx - lo;
    return sorted[lo] * (1 - t) + sorted[hi] * t;
  }

  function summarizeSamples(samples){
    if (!samples.length){
      return buildAssy("mc", {
        mean: fieldInfo(0),
        p10: fieldInfo(0),
        p50: fieldInfo(0),
        p90: fieldInfo(0),
      });
    }

    const first = samples[0];
    const kind = isQty(first) ? first.kind : null;
    const values = [];
    let sum = 0;
    for (const s of samples){
      if (isQty(s)){
        if (!kind || s.kind !== kind) throw new Error("mc sample unit mismatch");
        values.push(s.value);
        sum += s.value;
      }else{
        if (kind) throw new Error("mc mixed scalar/unit samples");
        const n = Number(s);
        if (!Number.isFinite(n)) throw new Error("mc samples must be numeric");
        values.push(n);
        sum += n;
      }
    }
    values.sort((a, b) => a - b);
    const meanNum = sum / values.length;
    const p10Num = percentile(values, 0.10);
    const p50Num = percentile(values, 0.50);
    const p90Num = percentile(values, 0.90);

    const wrap = (n) => kind ? makeQty(n, kind) : n;
    return buildAssy("mc", {
      mean: fieldInfo(wrap(meanNum)),
      p10: fieldInfo(wrap(p10Num)),
      p50: fieldInfo(wrap(p50Num)),
      p90: fieldInfo(wrap(p90Num)),
      n: fieldInfo(values.length),
    });
  }

  baseFns.range = defFn("range", 2, (lo, hi) => {
    return OPS_INTERNAL.makeRange(lo, hi);
  });

  baseFns.mean = defFn("mean", 1, (x) => {
    if (OPS_INTERNAL.isRange(x)){
      const lo = x.fields?.lo?.value;
      const hi = x.fields?.hi?.value;
      return div(add(lo, hi), 2);
    }
    throw new Error("mean expects a range");
  });

  baseFns["dist.normal"] = defFn("dist.normal", 2, (mu, sigma) => distNormal(mu, sigma));
  baseFns["dist.tri"] = defFn("dist.tri", 3, (a, b, c) => distTri(a, b, c));
  baseFns["dist.uniform"] = defFn("dist.uniform", 2, (lo, hi) => distUniform(lo, hi));
  baseFns.sample = defFn("sample", 1, (dist) => distSample(dist));
  baseFns.cdf = defFn("cdf", 2, (dist, x) => distCdf(dist, x));
  baseFns.pvalue = defFn("pvalue", 2, (dist, x) => {
    const p = distCdf(dist, x);
    const twoSided = 2 * Math.min(p, 1 - p);
    return twoSided;
  });
  baseFns.prob_gt = defFn("prob_gt", 2, (dist, x) => 1 - distCdf(dist, x));
  baseFns.prob_lt = defFn("prob_lt", 2, (dist, x) => distCdf(dist, x));

  baseFns.mc = defFnCtx("mc", 2, (ctx, n, exprOrRange) => {
    const count = Math.max(1, Math.min(100000, Math.floor(requireScalarArg(n, "mc"))));
    if (OPS_INTERNAL.isRange(exprOrRange)){
      const lo = exprOrRange.fields?.lo?.value;
      const hi = exprOrRange.fields?.hi?.value;
      if (isQty(lo) || isQty(hi)){
        if (!isQty(lo) || !isQty(hi)) throw new Error("mc range bounds must both be quantities");
        if (lo.kind !== hi.kind) throw new Error("mc range unit mismatch");
        const loNum = lo.value;
        const hiNum = hi.value;
        if (!Number.isFinite(loNum) || !Number.isFinite(hiNum)) throw new Error("mc range bounds must be numeric");
        if (hiNum < loNum) throw new Error("mc range hi must be >= lo");
        const samples = [];
        for (let i = 0; i < count; i++){
          const v = loNum + (hiNum - loNum) * Math.random();
          samples.push(makeQty(v, lo.kind));
        }
        return summarizeSamples(samples);
      }
      const loNum = Number(lo);
      const hiNum = Number(hi);
      if (!Number.isFinite(loNum) || !Number.isFinite(hiNum)) throw new Error("mc range bounds must be numeric");
      if (hiNum < loNum) throw new Error("mc range hi must be >= lo");
      const samples = [];
      for (let i = 0; i < count; i++){
        samples.push(loNum + (hiNum - loNum) * Math.random());
      }
      return summarizeSamples(samples);
    }
    if (typeof exprOrRange === "string"){
      if (!ctx || typeof ctx.evalString !== "function") throw new Error("mc(expr) requires evalString support");
      const samples = [];
      for (let i = 0; i < count; i++){
        const v = ctx.evalString(exprOrRange);
        samples.push(v);
      }
      return summarizeSamples(samples);
    }
    if (exprOrRange && typeof exprOrRange === "object" && exprOrRange.__dist){
      const samples = [];
      for (let i = 0; i < count; i++){
        samples.push(distSample(exprOrRange));
      }
      return summarizeSamples(samples);
    }
    throw new Error("mc expects (n, range(lo, hi)) or (n, \"expr\")");
  });

  function requireScalarArg(value, label){
    if (isQty(value) && value.kind !== "scalar"){
      throw new Error(`${label} expects a scalar value`);
    }
    return isQty(value) ? value.value : value;
  }

  __internal.distNormal = distNormal;
  __internal.distTri = distTri;
  __internal.distUniform = distUniform;
}
