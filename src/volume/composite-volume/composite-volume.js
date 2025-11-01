(() => {
  // --- State ---
  const workarea = document.getElementById('workarea');
  const bgCanvas = document.getElementById('bgCanvas');
  const gridCanvas = document.getElementById('gridCanvas');
  const svgLayer = document.getElementById('svgLayer');
  const whichViewEl = document.getElementById('whichView');
  const areaOutEl = document.getElementById('areaOut');
  const nodeCountEl = document.getElementById('nodeCount');
  const areaUnitsEl = document.getElementById('areaUnits');
  const areaAEl = document.getElementById('areaA');
  const areaBEl = document.getElementById('areaB');
  const uAreaAEl = document.getElementById('uAreaA');
  const uAreaBEl = document.getElementById('uAreaB');
  const voxCountEl = document.getElementById('voxCount');
  const voxSizeEl = document.getElementById('voxSize');
  const volOutEl = document.getElementById('volOut');
  const volUnitsEl = document.getElementById('volUnits');

  const unitsSel = document.getElementById('units');
  const zunitsSel = document.getElementById('zunits');
  const unitsAEl = document.getElementById('unitsA');
  const unitsBEl = document.getElementById('unitsB');
  const uxEl = document.getElementById('ux'), uyEl = document.getElementById('uy'), uzEl = document.getElementById('uz');

  const state = {
    currentView: 'A',          // 'A' or 'B'
    tool: 'select',            // select | add | close | cal | clear
    snap: false,
    nodes: { A: [], B: [] },   // [{x,y}, ...]
    closed: { A: false, B: false },
    cal: {                     // calibration: pixels per unit for each view
      A: 0, B: 0,
      Aseg: [], Bseg: [],      // two points for calibration segment
      Apx: 0, Bpx: 0
    },
    unit: 'ft',  // planar X and Y unit
    zunit: 'ft', // Z axis unit
    backdrop: { A: {img:null, pdf:null, page:1, scale:1, showGrid:false}, B: {img:null, pdf:null, page:1, scale:1, showGrid:false}},
    extents: { x: 10, y: 10, z: 10 },
    voxN: 60
  };

  // --- Helpers ---
  function resizeLayers() {
    const rect = workarea.getBoundingClientRect();
    for (const c of [bgCanvas, gridCanvas]) {
      c.width = rect.width; c.height = rect.height;
    }
    svgLayer.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    drawAll();
  }
  window.addEventListener('resize', resizeLayers);

  function drawGrid() {
    const ctx = gridCanvas.getContext('2d');
    ctx.clearRect(0,0,gridCanvas.width, gridCanvas.height);
    const show = state.currentView === 'A' ? state.backdrop.A.showGrid : state.backdrop.B.showGrid;
    if (!show) return;
    const step = 25;
    ctx.strokeStyle = 'rgba(148,163,184,.25)';
    ctx.lineWidth = 1;
    // fine grid
    ctx.beginPath();
    for (let x=0; x<gridCanvas.width; x+=step) {
      ctx.moveTo(x,0); ctx.lineTo(x,gridCanvas.height);
    }
    for (let y=0; y<gridCanvas.height; y+=step) {
      ctx.moveTo(0,y); ctx.lineTo(gridCanvas.width,y);
    }
    ctx.stroke();
    // bold every 4
    ctx.strokeStyle = 'rgba(148,163,184,.45)';
    ctx.beginPath();
    for (let x=0; x<gridCanvas.width; x+=step*4) {
      ctx.moveTo(x,0); ctx.lineTo(x,gridCanvas.height);
    }
    for (let y=0; y<gridCanvas.height; y+=step*4) {
      ctx.moveTo(0,y); ctx.lineTo(gridCanvas.width,y);
    }
    ctx.stroke();
  }

  function clearSVG() {
    while (svgLayer.firstChild) svgLayer.removeChild(svgLayer.firstChild);
  }

  function polyArea(pts) {
    if (pts.length < 3) return 0;
    let s = 0;
    for (let i=0;i<pts.length;i++) {
      const a = pts[i], b = pts[(i+1)%pts.length];
      s += a.x*b.y - b.x*a.y;
    }
    return Math.abs(s)*0.5;
  }

  function drawPoly(view) {
    const pts = state.nodes[view];
    const closed = state.closed[view];
    // edges/fill
    if (pts.length >= 2) {
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = ['M', pts[0].x, pts[0].y]
        .concat(pts.slice(1).flatMap(p=>['L',p.x,p.y]));
      if (closed && pts.length>=3) d.push('Z');
      path.setAttribute('d', d.join(' '));
      path.setAttribute('class', closed ? 'poly-fill' : 'edge');
      svgLayer.appendChild(path);
    }
    // nodes
    pts.forEach((p, idx) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 5);
      c.setAttribute('class','node');
      c.dataset.idx = idx;
      c.addEventListener('pointerdown', onNodeDown);
      svgLayer.appendChild(c);
    });

    // calibration line
    const seg = view==='A'? state.cal.Aseg : state.cal.Bseg;
    if (seg.length===2) {
      const l = document.createElementNS('http://www.w3.org/2000/svg','line');
      l.setAttribute('x1', seg[0].x); l.setAttribute('y1', seg[0].y);
      l.setAttribute('x2', seg[1].x); l.setAttribute('y2', seg[1].y);
      l.setAttribute('class','cal-line');
      svgLayer.appendChild(l);
      seg.forEach(p=>{
        const cc = document.createElementNS('http://www.w3.org/2000/svg','circle');
        cc.setAttribute('cx', p.x); cc.setAttribute('cy', p.y); cc.setAttribute('r', 5);
        cc.setAttribute('class','cal-node');
        svgLayer.appendChild(cc);
      });
    }
  }

  function updateAreaReadouts() {
    const rect = workarea.getBoundingClientRect();
    const pixAreaA = polyArea(state.nodes.A);
    const pixAreaB = polyArea(state.nodes.B);

    const pixPerUnitA = state.cal.A || 0;
    const pixPerUnitB = state.cal.B || 0;

    let areaA = 0, areaB = 0, unit2 = `${state.unit}²`;
    if (pixPerUnitA>0) areaA = (pixAreaA / (pixPerUnitA*pixPerUnitA));
    if (pixPerUnitB>0) areaB = (pixAreaB / (pixPerUnitB*pixPerUnitB));

    areaOutEl.textContent = (state.currentView==='A' ? areaA : areaB).toFixed(3);
    nodeCountEl.textContent = state.nodes[state.currentView].length;
    areaUnitsEl.textContent = unit2;
    areaAEl.textContent = areaA.toFixed(3); uAreaAEl.textContent = unit2;
    areaBEl.textContent = areaB.toFixed(3); uAreaBEl.textContent = unit2;
  }

  function drawAll() {
    clearSVG();
    // Backdrop is drawn already to bgCanvas (kept)
    drawGrid();
    drawPoly(state.currentView);
    updateAreaReadouts();
  }

  function snapIf(v) {
    if (!state.snap) return v;
    const s=10; return Math.round(v/s)*s;
  }

  // --- Events: Tools and Drawing ---
  let draggingNode = null;
  function onNodeDown(e) {
    draggingNode = { view: state.currentView, idx: +e.target.dataset.idx };
    window.addEventListener('pointermove', onNodeMove);
    window.addEventListener('pointerup', onNodeUp);
  }
  function onNodeMove(e) {
    if (!draggingNode) return;
    const rect = workarea.getBoundingClientRect();
    const x = snapIf(e.clientX - rect.left);
    const y = snapIf(e.clientY - rect.top);
    const pts = state.nodes[draggingNode.view];
    pts[draggingNode.idx] = {x,y};
    drawAll();
  }
  function onNodeUp() {
    draggingNode = null;
    window.removeEventListener('pointermove', onNodeMove);
    window.removeEventListener('pointerup', onNodeUp);
  }

  svgLayer.addEventListener('pointerdown', (e) => {
    if (draggingNode) return;
    const rect = workarea.getBoundingClientRect();
    const x = snapIf(e.clientX - rect.left);
    const y = snapIf(e.clientY - rect.top);

    if (state.tool === 'add') {
      state.nodes[state.currentView].push({x,y});
      drawAll();
    } else if (state.tool === 'cal') {
      const arr = state.currentView==='A' ? state.cal.Aseg : state.cal.Bseg;
      if (arr.length>=2) arr.length = 0;
      arr.push({x,y});
      drawAll();
    }
  });

  // Toolbar
  document.querySelectorAll('.tool').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const tool = btn.dataset.tool;
      if (tool==='clear') {
        state.nodes[state.currentView] = [];
        state.closed[state.currentView] = false;
        if (state.currentView==='A') state.cal.Aseg = [];
        else state.cal.Bseg = [];
        drawAll();
        return;
      }
      state.tool = tool;
      document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active', b===btn));
    });
  });
  document.getElementById('snap').addEventListener('change', (e)=>{ state.snap = e.target.checked; });

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.currentView = btn.dataset.view;
      whichViewEl.textContent = state.currentView;
      drawAll();
    });
  });

  // Close polygon
  document.querySelector('[data-tool="close"]').addEventListener('click', ()=>{
    const v = state.currentView;
    if (state.nodes[v].length >= 3) state.closed[v] = true;
    drawAll();
  });

  // --- Backdrops: PDF/Image rendering ---
  const fileA = document.getElementById('fileA');
  const fileB = document.getElementById('fileB');
  const pageA = document.getElementById('pageA');
  const pageB = document.getElementById('pageB');
  const renderA = document.getElementById('renderA');
  const renderB = document.getElementById('renderB');
  const scaleA = document.getElementById('scaleA');
  const scaleB = document.getElementById('scaleB');
  const toggleGridA = document.getElementById('toggleGridA');
  const toggleGridB = document.getElementById('toggleGridB');

  toggleGridA.addEventListener('click', ()=>{ state.backdrop.A.showGrid = !state.backdrop.A.showGrid; drawAll();});
  toggleGridB.addEventListener('click', ()=>{ state.backdrop.B.showGrid = !state.backdrop.B.showGrid; drawAll();});

  function drawBackdrop(which) {
    const ctx = bgCanvas.getContext('2d');
    ctx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
    const b = state.backdrop[which];
    if (!b) return;

    const scale = b.scale || 1;
    if (b.img) {
      const iw = b.img.width * scale;
      const ih = b.img.height * scale;
      const x = (bgCanvas.width - iw)/2;
      const y = (bgCanvas.height - ih)/2;
      ctx.drawImage(b.img, x, y, iw, ih);
    } else if (b.pdf && window['pdfjsLib']) {
      b.pdf.getPage(b.page||1).then(page=>{
        const viewport = page.getViewport({ scale: scale * (bgCanvas.width/Math.max(page.view[2], bgCanvas.width)) });
        const vScale = Math.min(bgCanvas.width/viewport.width, bgCanvas.height/viewport.height);
        const finalViewport = page.getViewport({ scale: scale * vScale });
        const tmp = document.createElement('canvas');
        tmp.width = finalViewport.width; tmp.height = finalViewport.height;
        page.render({ canvasContext: tmp.getContext('2d'), viewport: finalViewport }).promise.then(()=>{
          const x = (bgCanvas.width - tmp.width)/2;
          const y = (bgCanvas.height - tmp.height)/2;
          ctx.drawImage(tmp, x, y);
        });
      });
    }
  }

  function handleFile(which, fileInput, pageInput) {
    const f = fileInput.files?.[0];
    if (!f) return;
    const b = state.backdrop[which];
    b.img = null; b.pdf = null;
    if (f.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async () => {
        if (!window['pdfjsLib']) { alert('PDF.js not loaded'); return; }
        const u8 = new Uint8Array(reader.result);
        b.pdf = await pdfjsLib.getDocument({ data: u8 }).promise;
        b.page = Math.max(1, Math.min(parseInt(pageInput.value||'1',10), b.pdf.numPages));
        drawBackdrop(which); drawAll();
      };
      reader.readAsArrayBuffer(f);
    } else {
      const img = new Image();
      img.onload = ()=>{ b.img = img; drawBackdrop(which); drawAll(); };
      img.src = URL.createObjectURL(f);
    }
  }

  fileA.addEventListener('change', ()=>handleFile('A', fileA, pageA));
  fileB.addEventListener('change', ()=>handleFile('B', fileB, pageB));
  renderA.addEventListener('click', ()=>{ const b=state.backdrop.A; if (b.pdf) { b.page = Math.max(1, Math.min(parseInt(pageA.value||'1',10), b.pdf.numPages)); drawBackdrop('A'); }});
  renderB.addEventListener('click', ()=>{ const b=state.backdrop.B; if (b.pdf) { b.page = Math.max(1, Math.min(parseInt(pageB.value||'1',10), b.pdf.numPages)); drawBackdrop('B'); }});
  scaleA.addEventListener('input', ()=>{ state.backdrop.A.scale = parseFloat(scaleA.value); drawBackdrop(state.currentView); });
  scaleB.addEventListener('input', ()=>{ state.backdrop.B.scale = parseFloat(scaleB.value); drawBackdrop(state.currentView); });

  // --- Calibration ---
  const calLenA = document.getElementById('calLenA');
  const calLenB = document.getElementById('calLenB');
  function updateCal(which) {
    const seg = which==='A' ? state.cal.Aseg : state.cal.Bseg;
    const real = parseFloat(which==='A' ? calLenA.value : calLenB.value) || 0;
    if (seg.length===2 && real>0) {
      const dx = seg[1].x - seg[0].x, dy = seg[1].y - seg[0].y;
      const px = Math.hypot(dx, dy);
      const ppu = px / real;  // pixels per unit
      if (which==='A') { state.cal.A = ppu; state.cal.Apx = px; }
      else { state.cal.B = ppu; state.cal.Bpx = px; }
      updateAreaReadouts();
    }
  }
  calLenA.addEventListener('input', ()=>updateCal('A'));
  calLenB.addEventListener('input', ()=>updateCal('B'));

  // Unit selectors
  unitsSel.addEventListener('change', ()=>{
    state.unit = unitsSel.value;
    unitsAEl.textContent = state.unit;
    unitsBEl.textContent = state.unit;
    uxEl.textContent = state.unit; uyEl.textContent = state.unit;
    areaUnitsEl.textContent = `${state.unit}²`; uAreaAEl.textContent = `${state.unit}²`; uAreaBEl.textContent = `${state.unit}²`;
    volUnitsEl.textContent = `${state.unit}³`; // default, if Z is same
    drawAll();
  });
  zunitsSel.addEventListener('change', ()=>{
    state.zunit = zunitsSel.value;
    uzEl.textContent = state.zunit;
    // volume units could be a mix if planar vs Z differ; for display we keep base as unit³ if same, else show explicit later
    drawAll();
  });

  // Extents & Voxel N
  document.getElementById('extentX').addEventListener('input', e=>state.extents.x = parseFloat(e.target.value)||0);
  document.getElementById('extentY').addEventListener('input', e=>state.extents.y = parseFloat(e.target.value)||0);
  document.getElementById('extentZ').addEventListener('input', e=>state.extents.z = parseFloat(e.target.value)||0);
  document.getElementById('voxN').addEventListener('input', e=>{
    const v = Math.max(10, Math.min(160, parseInt(e.target.value||'60',10)));
    state.voxN = v; e.target.value = v;
  });

  // --- Voxel Volume ---
  function pointInPoly(pt, poly) {
    // ray casting
    let c = false;
    for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
      const pi=poly[i], pj=poly[j];
      if (((pi.y>pt.y)!==(pj.y>pt.y)) && (pt.x < (pj.x-pi.x)*(pt.y-pi.y)/(pj.y-pi.y)+pi.x)) c = !c;
    }
    return c;
  }

  function computeVolume() {
    // Need closed polygons & calibrations
    if (!state.closed.A || state.nodes.A.length<3) { alert('Close View A polygon first.'); return; }
    if (!state.closed.B || state.nodes.B.length<3) { alert('Close View B polygon first.'); return; }
    if (!(state.cal.A>0) || !(state.cal.B>0)) { alert('Calibrate both views (A & B).'); return; }

    const N = state.voxN;
    const {x:Ex, y:Ey, z:Ez} = state.extents;

    // Convert screen-space polygons into unit-space for (X,Z) and (Y,Z)
    // We only need to map pixels->units along axes corresponding to each view.
    // View A polygon vertices: (x_px, z_px) → (x = x_px/ppuA, z = z_px/ppuA_z). For simplicity, assume same unit scaling in the canvas for both axes using ppuA.
    // If your Z units differ, we scale z by ppuZ derived from chosen zunits. Here we assume same pixel→unit scale in both axes (planar), but you can provide different calibration lines if needed.
    const ppuA = state.cal.A; // pixels per planar unit in View A
    const ppuB = state.cal.B; // pixels per planar unit in View B

    // If Z uses different unit than planar unit, we convert later when computing volume (unit consistency).
    // Build unit-space polys:
    const polyA = state.nodes.A.map(p=>({x:p.x/ppuA, y:p.y/ppuA})); // interpret as (X,Z)
    const polyB = state.nodes.B.map(p=>({x:p.x/ppuB, y:p.y/ppuB})); // interpret as (Y,Z)

    // Voxel grid in unit space:
    const dx = Ex / N, dy = Ey / N, dz = Ez / N;

    let solid = 0;

    // Precompute bounding boxes to skip tests early
    function bbox(poly) {
      let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
      for (const p of poly) { if (p.x<minx) minx=p.x; if (p.y<miny) miny=p.y; if (p.x>maxx) maxx=p.x; if (p.y>maxy) maxy=p.y; }
      return {minx,miny,maxx,maxy};
    }
    const bbA = bbox(polyA); // (x,z)
    const bbB = bbox(polyB); // (y,z)

    // Iterate voxel centers:
    for (let i=0;i<N;i++) {
      const x = (i+0.5)*dx;
      if (x<bbA.minx || x>bbA.maxx) continue;
      for (let j=0;j<N;j++) {
        const y = (j+0.5)*dy;
        if (y<bbB.minx || y>bbB.maxx) continue; // note: bbB.minx is minY
        for (let k=0;k<N;k++) {
          const z = (k+0.5)*dz;
          if (z<bbA.miny || z>bbA.maxy) continue;
          if (z<bbB.miny || z>bbB.maxy) continue;
          // inside tests:
          const inA = pointInPoly({x, y:z}, polyA);
          if (!inA) continue;
          const inB = pointInPoly({x:y, y:z}, polyB);
          if (!inB) continue;
          solid++;
        }
      }
    }

    const vol_units3 = solid * dx * dy * dz; // in (planar unit)^2 * (z unit) if units match; we'll reconcile units below.

    // Unit reconciliation:
    // If planar unit == z unit, keep as unit³. Otherwise convert Z to planar or vice versa.
    // Simple approach: convert everything to a base (meters) then display in mixed-friendly ft³ if planar=z, else show explicit (unit_planar² * unit_z).
    function toMeters(val, unit) {
      switch(unit){
        case 'm': return val;
        case 'cm': return val/100;
        case 'ft': return val*0.3048;
        case 'in': return val*0.0254;
      }
      return val;
    }
    const dx_m = toMeters(dx, state.unit);
    const dy_m = toMeters(dy, state.unit);
    const dz_m = toMeters(dz, state.zunit);
    const vol_m3 = solid * dx_m * dy_m * dz_m;

    // Display in ft³ if user planar=z='ft', else display in m³ and a helper in yd³
    let disp = vol_m3;
    let dispUnits = 'm³';
    // Prefer ft³ when any involved unit is imperial:
    const preferFt = (state.unit==='ft' || state.unit==='in' || state.zunit==='ft' || state.zunit==='in');
    if (preferFt) {
      const ft3 = vol_m3 / Math.pow(0.3048,3);
      disp = ft3; dispUnits = 'ft³';
    }

    voxCountEl.textContent = solid.toLocaleString();
    voxSizeEl.textContent = `dx=${dx.toFixed(3)} ${state.unit}, dy=${dy.toFixed(3)} ${state.unit}, dz=${dz.toFixed(3)} ${state.zunit}`;
    volOutEl.textContent = disp.toFixed(3);
    volUnitsEl.textContent = dispUnits;
  }

  document.getElementById('compute').addEventListener('click', computeVolume);

  // --- Export / Import ---
  document.getElementById('exportJSON').addEventListener('click', ()=>{
    const payload = {
      nodes: state.nodes,
      closed: state.closed,
      cal: { A: state.cal.A, B: state.cal.B, Aseg: state.cal.Aseg, Bseg: state.cal.Bseg },
      unit: state.unit, zunit: state.zunit,
      extents: state.extents
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'composite_sections.json';
    a.click();
  });
  const jsonFile = document.getElementById('jsonFile');
  document.getElementById('importJSON').addEventListener('click', ()=>jsonFile.click());
  jsonFile.addEventListener('change', ()=>{
    const f = jsonFile.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ()=>{
      try {
        const obj = JSON.parse(r.result);
        state.nodes = obj.nodes || state.nodes;
        state.closed = obj.closed || state.closed;
        if (obj.cal) {
          state.cal.A = obj.cal.A||0; state.cal.B = obj.cal.B||0;
          state.cal.Aseg = obj.cal.Aseg||[]; state.cal.Bseg = obj.cal.Bseg||[];
        }
        state.unit = obj.unit || state.unit;
        state.zunit = obj.zunit || state.zunit;
        unitsSel.value = state.unit; zunitsSel.value = state.zunit;
        unitsAEl.textContent = state.unit; unitsBEl.textContent = state.unit;
        uxEl.textContent = state.unit; uyEl.textContent = state.unit; uzEl.textContent = state.zunit;
        state.extents = obj.extents || state.extents;
        document.getElementById('extentX').value = state.extents.x;
        document.getElementById('extentY').value = state.extents.y;
        document.getElementById('extentZ').value = state.extents.z;
        drawAll();
      } catch(e) { alert('Invalid JSON'); }
    };
    r.readAsText(f);
  });

  // --- Init ---
  resizeLayers();
  // default tool highlight
  document.querySelector('[data-tool="select"]').classList.add('active');

  // Keyboard shortcuts
  window.addEventListener('keydown', (e)=>{
    if (e.key==='a') { state.tool='add'; setToolActive('add'); }
    if (e.key==='s') { state.tool='select'; setToolActive('select'); }
    if (e.key==='c') { state.tool='cal'; setToolActive('cal'); }
    if (e.key==='g') { state.snap = !state.snap; document.getElementById('snap').checked = state.snap; }
  });
  function setToolActive(name) {
    document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active', b.dataset.tool===name));
  }

  // Draw initial blank
  drawBackdrop('A');
  drawBackdrop('B');
  drawAll();

  // Close buttons
  document.querySelector('[data-tool="close"]').addEventListener('click', ()=>{
    const v = state.currentView;
    if (state.nodes[v].length>=3) state.closed[v]=true;
    drawAll();
  });
})();
