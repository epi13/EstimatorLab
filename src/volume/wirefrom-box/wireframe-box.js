(() => {
  // -------- Units & conversions --------
  const LEN_TO_METERS = { m:1, cm:0.01, ft:0.3048, in:0.0254 };
  // Map from displayed unit -> cubic meters per unit
  const VOL_TO_M3 = { m3:1, L:0.001, ft3:0.028316846592, yd3:0.764554857984, in3:0.000016387064, gal:0.003785411784 };

  function fmt(n) {
    if (!isFinite(n)) return '—';
    const abs = Math.abs(n);
    const places = abs >= 100 ? 0 : abs >= 10 ? 2 : 3;
    return Number(n).toFixed(places);
  }

  // -------- Canvas & projection --------
  const canvas = document.getElementById('cv');
  const ctx = canvas.getContext('2d');
  const DPR = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    const { clientWidth:w, clientHeight:h } = canvas;
    canvas.width = Math.max(1, w * DPR);
    canvas.height = Math.max(1, h * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);

  // Simple isometric projection (30°)
  const ISO = {
    c: Math.cos(Math.PI/6), // cos30 ≈ 0.866
    s: Math.sin(Math.PI/6), // sin30 = 0.5
    project([x,y,z]) { // -> [X,Y]
      const X = (x - z) * this.c;
      const Y = y + (x + z) * this.s;
      return [X, Y];
    },
    // 2D delta -> least-squares 3D delta in (x,y,z) along basis of +x, +y, +z projections
    unprojectDelta([dX, dY]) {
      // A = [ax ay az] where ax=(c,s), ay=(0,1), az=(-c,s) -> 2x3
      const c = this.c, s = this.s;
      // Precompute matrices numerically
      function inv3(m){
        const [a,b,c, d,e,f, g,h,i] = [m[0][0],m[0][1],m[0][2], m[1][0],m[1][1],m[1][2], m[2][0],m[2][1],m[2][2]];
        const A = e*i - f*h;
        const B = -(d*i - f*g);
        const C = d*h - e*g;
        const D = -(b*i - c*h);
        const E = a*i - c*g;
        const F = -(a*h - b*g);
        const G = b*f - c*e;
        const H = -(a*f - c*d);
        const I = a*e - b*d;
        const det = a*A + b*B + c*C;
        const invDet = 1/det;
        return [
          [A*invDet, D*invDet, G*invDet],
          [B*invDet, E*invDet, H*invDet],
          [C*invDet, F*invDet, I*invDet]
        ];
      }
      const c2 = c*c, s2 = s*s;
      const ATA = [
        [1, s, -c2 + s2],
        [s, 1, s],
        [-c2 + s2, s, 1]
      ];
      const ATAinv = inv3(ATA);
      const AT = [[c, s],[0,1],[-c,s]]; // 3x2
      // A^+ = (A^T A)^{-1} A^T
      const Aplus = [
        [ATAinv[0][0]*c + ATAinv[0][1]*0 + ATAinv[0][2]*(-c), ATAinv[0][0]*s + ATAinv[0][1]*1 + ATAinv[0][2]*s],
        [ATAinv[1][0]*c + ATAinv[1][1]*0 + ATAinv[1][2]*(-c), ATAinv[1][0]*s + ATAinv[1][1]*1 + ATAinv[1][2]*s],
        [ATAinv[2][0]*c + ATAinv[2][1]*0 + ATAinv[2][2]*(-c), ATAinv[2][0]*s + ATAinv[2][1]*1 + ATAinv[2][2]*s]
      ];
      // Multiply Aplus (3x2) by [dX,dY]
      return [
        Aplus[0][0]*dX + Aplus[0][1]*dY,
        Aplus[1][0]*dX + Aplus[1][1]*dY,
        Aplus[2][0]*dX + Aplus[2][1]*dY
      ];
    }
  };

  // -------- Box model (axis-aligned) --------
  const state = {
    unitLen: 'ft',
    unitVol: 'ft3',
    // internal base in meters
    dims_m: { w: 2, h: 1.5, d: 1.2 },
    center_m: { x: 0, y: 1, z: 0 },
    dragging: null, // { idx }
    coarse: false,
  };

  // 8 corners local offsets from center (±w/2, ±h/2, ±d/2)
  function cornersFromDims({w,h,d}){
    const xs=[-w/2,w/2], ys=[-h/2,h/2], zs=[-d/2,d/2];
    const out=[];
    for (let yi=0; yi<2; yi++)
      for (let zi=0; zi<2; zi++)
        for (let xi=0; xi<2; xi++)
          out.push([ xs[xi], ys[yi], zs[zi] ]);
    return out; // 8 vertices
  }

  function worldCorners(){
    const {w,h,d} = state.dims_m, {x:cx,y:cy,z:cz} = state.center_m;
    return cornersFromDims({w,h,d}).map(([x,y,z]) => [x+cx, y+cy, z+cz]);
  }

  function edges(){
    const E=[];
    const idx = (xi,yi,zi) => yi*4 + zi*2 + xi;
    for (let yi=0; yi<2; yi++)
      for (let zi=0; zi<2; zi++) {
        E.push([idx(0,yi,zi), idx(1,yi,zi)]); // X edges
      }
    for (let yi=0; yi<2; yi++)
      for (let xi=0; xi<2; xi++) {
        E.push([idx(xi,yi,0), idx(xi,yi,1)]); // Z edges
      }
    for (let zi=0; zi<2; zi++)
      for (let xi=0; xi<2; xi++) {
        E.push([idx(xi,0,zi), idx(xi,1,zi)]); // Y edges
      }
    return E;
  }

  // -------- Input handling --------
  const nodeRadiusPx = 8;

  function layoutProjection() {
    const pts3 = worldCorners();
    const proj = pts3.map(p => ISO.project(p));
    const { width, height } = canvas.getBoundingClientRect();
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (const [X,Y] of proj){ minX=Math.min(minX,X); maxX=Math.max(maxX,X); minY=Math.min(minY,Y); maxY=Math.max(maxY,Y); }
    const pad=40;
    const scale = Math.min((width-2*pad)/(maxX-minX||1), (height-2*pad)/(maxY-minY||1));
    const offX = (width - scale*(minX+maxX))/2;
    const offY = (height - scale*(minY+maxY))/2;
    const pts2 = proj.map(([X,Y]) => [X*scale + offX, Y*scale + offY]);
    return { pts2, scale, offX, offY };
  }

  function hitTest(mx,my){
    const { pts2, scale } = layoutProjection();
    for (let i=0;i<pts2.length;i++){
      const [x,y]=pts2[i];
      const dx=mx-x, dy=my-y;
      if (dx*dx+dy*dy <= nodeRadiusPx*nodeRadiusPx) return {idx:i, scale};
    }
    return null;
  }

  let lastMouse=null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const h = hitTest(mx,my);
    if (h){
      state.dragging = { idx:h.idx, scale:h.scale };
      lastMouse = [mx,my];
    }
  });
  window.addEventListener('pointerup', () => {
    if (state.dragging){ state.dragging=null; lastMouse=null; draw(); }
  });
  window.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const [pmx,pmy] = lastMouse || [mx,my];
    let d = [ (mx-pmx)/state.dragging.scale, (my-pmy)/state.dragging.scale ]; // screen delta in projected units
    if (state.coarse) { d = [d[0]*2, d[1]*2]; }
    const [dx,dy,dz] = ISO.unprojectDelta(d);

    // Determine which corner sign to adjust against center.
    const idxToSigns = [];
    for (let yi=0; yi<2; yi++) for (let zi=0; zi<2; zi++) for (let xi=0; xi<2; xi++) idxToSigns.push([xi?1:-1, yi?1:-1, zi?1:-1]);
    const s = idxToSigns[state.dragging.idx];

    const c = state.center_m, dms = state.dims_m;
    const newW = Math.max(0.01, dms.w + s[0]*dx);
    const newH = Math.max(0.01, dms.h + s[1]*dy);
    const newD = Math.max(0.01, dms.d + s[2]*dz);
    c.x += dx/2; c.y += dy/2; c.z += dz/2;
    dms.w = newW; dms.h = newH; dms.d = newD;

    lastMouse = [mx,my];
    pushDimsToUI();
    draw();
  });
  window.addEventListener('keydown', (e)=>{ if (e.key==='Shift') state.coarse=true; });
  window.addEventListener('keyup', (e)=>{ if (e.key==='Shift') state.coarse=false; });

  // -------- Drawing --------
  function draw(){
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // background grid
    ctx.save();
    ctx.globalAlpha = 0.15;
    const grid=20; ctx.strokeStyle = '#223055';
    ctx.lineWidth = 1;
    for (let x=0; x<width; x+=grid){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
    for (let y=0; y<height; y+=grid){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
    ctx.restore();

    const { pts2 } = layoutProjection();
    const E = edges();
    const order = E.map((e,i)=>({i, z:(pts2[e[0]][1]+pts2[e[1]][1])})).sort((a,b)=>a.z-b.z).map(o=>o.i);

    ctx.lineWidth = 2;
    for (const ei of order){
      const [a,b] = E[ei];
      const [x1,y1] = pts2[a];
      const [x2,y2] = pts2[b];
      ctx.beginPath();
      ctx.strokeStyle = '#5aa7ff';
      ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }

    for (const [x,y] of pts2){
      ctx.beginPath(); ctx.arc(x,y,nodeRadiusPx,0,Math.PI*2);
      ctx.fillStyle = '#0ef'; ctx.globalAlpha=0.85; ctx.fill();
      ctx.globalAlpha=1; ctx.strokeStyle='#004b6b'; ctx.lineWidth=1.5; ctx.stroke();
    }

    // Label three principal edges from the "front-top-right" corner
    let best = 0, bestScore = -Infinity;
    for (let i=0;i<pts2.length;i++){ const s=pts2[i][0]+pts2[i][1]; if (s>bestScore){best=i; bestScore=s;} }
    const neighbors = neigh(best);
    const unit = state.unitLen;
    const toUnit = 1 / LEN_TO_METERS[unit];
    const w = state.dims_m.w * toUnit;
    const h = state.dims_m.h * toUnit;
    const d = state.dims_m.d * toUnit;

    function labelEdge(i,j,text){
      const [x1,y1]=pts2[i], [x2,y2]=pts2[j];
      const mx=(x1+x2)/2, my=(y1+y2)/2;
      ctx.save();
      ctx.fillStyle='white';
      ctx.strokeStyle='rgba(0,0,0,.35)';
      ctx.font='12px ui-sans-serif, system-ui, -apple-system, Segoe UI';
      ctx.lineWidth=4; ctx.lineJoin='round';
      ctx.strokeText(text,mx+6,my-6);
      ctx.fillText(text,mx+6,my-6);
      ctx.restore();
    }
    if (neighbors){
      labelEdge(best, neighbors.x, `${fmt(w)} ${unit}`);
      labelEdge(best, neighbors.y, `${fmt(h)} ${unit}`);
      labelEdge(best, neighbors.z, `${fmt(d)} ${unit}`);
    }

    // KPIs
    document.getElementById('kpiW').textContent = `${fmt(w)} ${unit}`;
    document.getElementById('kpiH').textContent = `${fmt(h)} ${unit}`;
    document.getElementById('kpiD').textContent = `${fmt(d)} ${unit}`;

    const vol_m3 = state.dims_m.w * state.dims_m.h * state.dims_m.d;
    const volUnit = state.unitVol;
    const vol = vol_m3 / VOL_TO_M3[volUnit];
    document.getElementById('kpiVol').innerHTML = `${fmt(vol)} ${prettyVol(volUnit)}`;
  }

  function prettyVol(u){ return ({ft3:'ft³', yd3:'yd³', in3:'in³', m3:'m³', L:'L', gal:'gal'})[u] || u; }

  function neigh(i){
    const C = worldCorners();
    const [xi,yi,zi] = C[i];
    let bestX=null, bestY=null, bestZ=null, dX=1e9, dY=1e9, dZ=1e9;
    for (let j=0;j<C.length;j++) if (j!==i){
      const [x,y,z]=C[j];
      const dx=Math.abs(x-xi), dy=Math.abs(y-yi), dz=Math.abs(z-zi);
      const nonzero = (dx>1e-9)+(dy>1e-9)+(dz>1e-9);
      if (nonzero!==1) continue;
      if (dx>1e-9 && dx<dX){ dX=dx; bestX=j; }
      if (dy>1e-9 && dy<dY){ dY=dy; bestY=j; }
      if (dz>1e-9 && dz<dZ){ dZ=dz; bestZ=j; }
    }
    if (bestX==null||bestY==null||bestZ==null) return null;
    return {x:bestX, y:bestY, z:bestZ};
  }

  // -------- UI wiring --------
  const elLen = document.getElementById('lengthUnit');
  const elVol = document.getElementById('volumeUnit');
  const inW = document.getElementById('inW');
  const inH = document.getElementById('inH');
  const inD = document.getElementById('inD');

  function pushDimsToUI(){
    const u = elLen.value;
    const k = 1 / LEN_TO_METERS[u];
    inW.value = fmt(state.dims_m.w * k);
    inH.value = fmt(state.dims_m.h * k);
    inD.value = fmt(state.dims_m.d * k);
  }

  function pullDimsFromUI(){
    const u = elLen.value;
    const k = LEN_TO_METERS[u];
    const w = Math.max(0.01, parseFloat(inW.value)||0);
    const h = Math.max(0.01, parseFloat(inH.value)||0);
    const d = Math.max(0.01, parseFloat(inD.value)||0);
    state.dims_m.w = w * k;
    state.dims_m.h = h * k;
    state.dims_m.d = d * k;
  }

  elLen.addEventListener('change', ()=>{ state.unitLen = elLen.value; pushDimsToUI(); draw(); });
  elVol.addEventListener('change', ()=>{ state.unitVol = elVol.value; draw(); });
  inW.addEventListener('change', ()=>{ pullDimsFromUI(); draw(); });
  inH.addEventListener('change', ()=>{ pullDimsFromUI(); draw(); });
  inD.addEventListener('change', ()=>{ pullDimsFromUI(); draw(); });

  document.getElementById('btnReset').addEventListener('click', ()=>{
    state.dims_m = { w: 2, h: 1.5, d: 1.2 };
    state.center_m = { x: 0, y: 1, z: 0 };
    pushDimsToUI();
    draw();
  });

  document.getElementById('btnPreset').addEventListener('click', ()=>{
    // 3×4×5 in feet -> meters
    const w = 3 * LEN_TO_METERS.ft;
    const h = 4 * LEN_TO_METERS.ft;
    const d = 5 * LEN_TO_METERS.ft;
    state.dims_m = { w, h, d };
    state.center_m = { x: 0, y: h/2, z: 0 };
    elLen.value = 'ft';
    pushDimsToUI();
    draw();
  });

  // Initial UI & draw
  pushDimsToUI();
  function ensureCanvasSize(){
    const main = canvas.parentElement;
    const rect = main.getBoundingClientRect();
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }
  window.addEventListener('resize', ensureCanvasSize);
  ensureCanvasSize();
  resize();
})();
