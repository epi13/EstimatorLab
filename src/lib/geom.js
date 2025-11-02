// Geometry helpers (agnostic)
export function dist(a, b) { const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }
export function centroid(points){ let x=0,y=0; for(const p of points){ x+=p.x; y+=p.y; } const n=points.length||1; return { x:x/n, y:y/n } }
export function polygonArea(points){ let a=0; for(let i=0,j=points.length-1;i<points.length;j=i++){ const p=points[i], q=points[j]; a += (q.x+p.x)*(q.y-p.y); } return Math.abs(a/2); }
export function polygonPerimeter(points){ let s=0; for(let i=0;i<points.length;i++){ const p=points[i], q=points[(i+1)%points.length]; const dx=p.x-q.x, dy=p.y-q.y; s += Math.hypot(dx,dy); } return s; }
export function pointInPolygon(pt, poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const pi=poly[i], pj=poly[j]; if(((pi.y>pt.y)!==(pj.y>pt.y)) && (pt.x < (pj.x-pi.x)*(pt.y-pi.y)/(pj.y-pi.y)+pi.x)) c = !c; } return c; }
