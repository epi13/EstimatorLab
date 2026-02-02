export function attachGeometryBuiltins(baseFns, {
  defFn,
  add,
  sub,
  mul,
  div,
  isQty,
}){
  function isPt(value){
    return value && typeof value === "object" && value.__pt;
  }

  function isPoly(value){
    return value && typeof value === "object" && value.__poly;
  }

  baseFns.pt = defFn("pt", 2, (x, y) => {
    if (isQty(x) && isQty(y) && x.kind !== y.kind) throw new Error("pt coordinates must share units");
    return { __pt: true, x, y };
  });

  baseFns.dist = defFn("dist", 2, (a, b) => {
    if (!isPt(a) || !isPt(b)) throw new Error("dist expects (pt, pt)");
    const dx = sub(b.x, a.x);
    const dy = sub(b.y, a.y);
    return baseFns.sqrt.impl(add(mul(dx, dx), mul(dy, dy)));
  });

  baseFns.poly = defFn("poly", -1, (...pts) => {
    if (pts.length < 3) throw new Error("poly expects at least 3 points");
    for (const p of pts){
      if (!isPt(p)) throw new Error("poly expects pt(...) arguments");
    }
    return { __poly: true, points: pts.slice() };
  });

  baseFns.poly_perim = defFn("poly_perim", 1, (poly) => {
    if (!isPoly(poly)) throw new Error("poly_perim expects a polygon");
    const pts = poly.points || [];
    if (pts.length < 2) return 0;
    let acc = null;
    for (let i = 0; i < pts.length; i++){
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      const seg = baseFns.dist.impl(p0, p1);
      acc = acc === null ? seg : add(acc, seg);
    }
    return acc === null ? 0 : acc;
  });

  baseFns.poly_area = defFn("poly_area", 1, (poly) => {
    if (!isPoly(poly)) throw new Error("poly_area expects a polygon");
    const pts = poly.points || [];
    if (pts.length < 3) return 0;
    let acc = null;
    for (let i = 0; i < pts.length; i++){
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      const cross = sub(mul(p0.x, p1.y), mul(p1.x, p0.y));
      acc = acc === null ? cross : add(acc, cross);
    }
    return div(acc === null ? 0 : acc, 2);
  });
}
