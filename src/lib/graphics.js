// Shared graphics and IO utilities used across tools

export const Util = {
  uid(){ return 'id-' + Math.random().toString(36).slice(2, 9) },
  clamp(n,min,max){ return Math.max(min, Math.min(max, n)) },
  snap(n, step=1){ return Math.round(n/step)*step },
  lerp(a,b,t){ return a + (b-a)*t },
  // Matrix helpers (a c e; b d f; 0 0 1)
  mIdent(){ return [1,0,0,1,0,0] },
  mTranslate(m,tx,ty){ const [a,b,c,d,e,f]=m; return [a,b,c,d,e+tx,f+ty] },
  mScale(m,sx,sy,ox=0,oy=0){ const [a,b,c,d,e,f]=m; return [a*sx,b*sx,c*sy,d*sy, e-ox*(sx-1), f-oy*(sy-1)] },
  mRotate(m,rad,ox=0,oy=0){ const [a,b,c,d,e,f]=m; const cos=Math.cos(rad), sin=Math.sin(rad);
    const tx=e-ox, ty=f-oy;
    return [a*cos + c*sin, b*cos + d*sin, c*cos - a*sin, d*cos - b*sin, ox + tx*cos - ty*sin, oy + tx*sin + ty*cos]
  },
  rectFromPts(a,b){ const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y), w=Math.abs(a.x-b.x), h=Math.abs(a.y-b.y); return {x,y,w,h} },
  ptInRect(p,r){ return p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h },
  rectInter(a,b){ return !(a.x+a.w<b.x || b.x+b.w<a.x || a.y+a.h<b.y || b.y+b.h<a.y) },
  // Arrowhead path for SVG
  arrowPath(len=12, w=6){ return `M0,0 L${-len},${w} L${-len},${-w} Z` },
  // Color utilities
  parseColor(c){ return c },
  mulAlpha(css, a){
    if(css.startsWith('#')){
      const hex=css.replace('#','');
      if(hex.length===8){ return `#${hex.slice(0,6)}${Math.round(a*255).toString(16).padStart(2,'0')}` }
      if(a<1){ const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16); return `rgba(${r},${g},${b},${a})` }
      return css;
    }
    if(css.startsWith('rgba')){ return css.replace(/rgba\(([^)]+)\)/, (_,vals)=>{ const [r,g,b,_a]=vals.split(',').map(s=>+s); return `rgba(${r},${g},${b},${a})` }) }
    return css;
  },
};

export function apply(m, p){ return { x: m[0]*p.x + m[2]*p.y + m[4], y: m[1]*p.x + m[3]*p.y + m[5] } }
export function inv(m){
  const [a,b,c,d,e,f]=m; const det=a*d-b*c || 1e-8;
  const ia=d/det, ib=-b/det, ic=-c/det, id=a/det, ie=-(ia*e+ic*f), ifv=-(ib*e+id*f);
  return [ia,ib,ic,id,ie,ifv];
}
export function toLocal(p, m){ const im=inv(m); return apply(im,p) }

export async function blobToImage(url){
  return new Promise((res,rej)=>{
    const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=url;
  });
}
export function dataURLtoBlob(dataurl){
  const [meta, b64] = dataurl.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] || 'application/octet-stream';
  const bin = atob(b64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr], {type:mime});
}
export function downloadBlob(blob, name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}
export function downloadText(text, name){ downloadBlob(new Blob([text], {type:'text/plain'}), name) }
export function downloadDataURL(dataURL, name){
  const a=document.createElement('a'); a.href=dataURL; a.download=name; a.click();
}
export function makeZipData(items){
  const json = JSON.stringify(items, null, 2);
  return 'data:application/octet-stream;base64,' + btoa(unescape(encodeURIComponent(json)));
}
