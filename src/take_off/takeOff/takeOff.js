// ====== State ======
const state = {
  pdf: null,
  page: null,
  pageNum: 1,
  pageCount: 0,
  zoom: 1,
  minZoom: 0.2,
  maxZoom: 6,
  dpr: Math.max(1, window.devicePixelRatio || 1),
  tool: 'pan',
  units: 'ft', // display units
  unitsPerPixel: null, // null until calibrated
  calibrated: false,
  showLabels: true,
  snap: false,
  snapPoints: [],
  measures: [],
  drawing: null, // {type:'line'|'area', points:[{x,y}], temp: {x,y}}
  lastLen: null,
  lastArea: null,
};

// ====== DOM refs ======
const els = {
  file: document.getElementById('file'),
  demoBtn: document.getElementById('demoBtn'),
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  pageNum: document.getElementById('pageNum'),
  pageCount: document.getElementById('pageCount'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  zoomReset: document.getElementById('zoomReset'),
  zoomLbl: document.getElementById('zoomLbl'),
  toolGroup: document.getElementById('toolGroup'),
  undo: document.getElementById('undo'),
  finish: document.getElementById('finish'),
  clear: document.getElementById('clearMeasures'),
  units: document.getElementById('units'),
  scaleLbl: document.getElementById('scaleLbl'),
  exportJson: document.getElementById('exportJson'),
  exportPng: document.getElementById('exportPng'),
  side: document.getElementById('side'),
  measList: document.getElementById('measList'),
  fileName: document.getElementById('fileName'),
  session: {
    status: document.getElementById('statusVal'),
    cal: document.getElementById('calVal'),
    tool: document.getElementById('toolVal'),
    len: document.getElementById('lenVal'),
    area: document.getElementById('areaVal'),
  },
  viewer: document.getElementById('viewer'),
  stack: document.getElementById('stack'),
  pdf: document.getElementById('pdf'),
  overlay: document.getElementById('overlay'),
  labels: document.getElementById('labels'),
  hint: document.getElementById('hint'),
  toggleLabels: document.getElementById('toggleLabels'),
  toggleSnaps: document.getElementById('toggleSnaps'),
  // Modal
  calModal: document.getElementById('calModal'),
  pxDist: document.getElementById('pxDist'),
  calValue: document.getElementById('calValue'),
  calUnits: document.getElementById('calUnits'),
  calApply: document.getElementById('calApply'),
  calCancel: document.getElementById('calCancel'),
};

const ctxs = {
  pdf: els.pdf.getContext('2d'),
  overlay: els.overlay.getContext('2d'),
  labels: els.labels.getContext('2d')
};

const overlayStyles = {
  stroke: 'rgba(111, 182, 255, 0.95)',
  areaFill: 'rgba(130, 224, 170, 0.22)',
  guide: 'rgba(255, 255, 255, 0.35)',
  bubble: 'rgba(0, 0, 0, 0.55)',
  bubbleText: '#e7ecf3'
};

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ====== Helpers ======
function fmtLen(value, units){
  if(value == null || !isFinite(value)) return '–';
  const u = units || state.units;
  let v = value;
  // For feet display, show ft+in when appropriate
  if(u==='ft'){
    const inches = v*12;
    if(inches < 24) return inches.toFixed(2) + ' in';
    const ft = Math.floor(v);
    const remIn = (v-ft)*12;
    return ft + '′ ' + remIn.toFixed(1) + '″';
  }
  if(u==='in') return v.toFixed(2) + ' in';
  if(u==='m'){
    if(v<1) return (v*100).toFixed(1) + ' cm';
    return v.toFixed(3) + ' m';
  }
  return v.toFixed(2) + ' ' + u;
}
function fmtArea(value, units){
  if(value == null || !isFinite(value)) return '–';
  const u = units || state.units;
  if(u==='ft') return value.toFixed(2) + ' ft²';
  if(u==='in') return value.toFixed(0) + ' in²';
  if(u==='m'){
    if(value<1) return (value*10000).toFixed(1) + ' cm²';
    return value.toFixed(3) + ' m²';
  }
  return value.toFixed(2) + ' ' + u + '²';
}
function unitsToBaseFactor(u){
  // Return factor to convert from chosen units to base units (feet and meters are allowed base)
  // We'll use feet as imperial base for display convenience
  if(u==='ft') return 1;
  if(u==='in') return 1/12; // inches -> feet
  if(u==='m') return 3.280839895; // meters -> feet
  return 1;
}
function fromBaseToUnitsFactor(u){
  if(u==='ft') return 1;
  if(u==='in') return 12;
  if(u==='m') return 0.3048; // feet -> meters
  return 1;
}
function worldPerPixel(){
  // returns feet per pixel (base unit feet) if calibrated; else null
  return state.unitsPerPixel; // in feet per px
}
function lenPxToWorld(px){
  const fpp = worldPerPixel();
  if(!fpp) return null;
  const ft = px * fpp; // feet
  return ft * fromBaseToUnitsFactor(state.units);
}
function areaPxToWorld(px2){
  const fpp = worldPerPixel();
  if(!fpp) return null;
  const ft2 = px2 * fpp * fpp; // square feet
  const u = state.units;
  if(u==='ft') return ft2;
  if(u==='in') return ft2 * 144; // 12^2
  if(u==='m') return ft2 * 0.09290304; // ft2->m2
  return ft2;
}
function dist(a,b){
  const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy);
}
function centroid(points){
  let x=0,y=0; for(const p of points){x+=p.x;y+=p.y} return {x:x/points.length,y:y/points.length};
}
function polygonAreaPx(points){
  let a=0; for(let i=0,j=points.length-1;i<points.length;j=i++){
    const p=points[i], q=points[j]; a += (q.x+p.x)*(q.y-p.y);
  } return Math.abs(a/2);
}
function polygonPerimeterPx(points){
  let s=0; for(let i=0;i<points.length;i++){ s+=dist(points[i], points[(i+1)%points.length]); } return s;
}
function refreshSnapPoints(){
  const pts = [];
  for(const m of state.measures){
    if(m.type==='line'){
      pts.push(m.a, m.b);
    } else if(m.type==='area'){
      pts.push(...m.points);
    }
  }
  state.snapPoints = pts;
}

function setStatus(txt){ els.session.status.textContent = txt; }
function setTool(name){
  state.tool = name; els.session.tool.textContent = name.charAt(0).toUpperCase()+name.slice(1);
  for(const b of els.toolGroup.querySelectorAll('.tool[data-tool]')) b.classList.toggle('active', b.dataset.tool===name);
}
function updateScaleLabel(){
  if(!state.calibrated || !state.unitsPerPixel){ els.scaleLbl.textContent = 'not set'; return; }
  // Show as: 1 px = X units
  const baseFtPerPx = state.unitsPerPixel; // feet/px
  const val = baseFtPerPx * fromBaseToUnitsFactor(state.units);
  const u = state.units;
  let label = `1 px = ${u==='m'?val.toFixed(6):val.toFixed(4)} ${u}`;
  els.scaleLbl.textContent = label;
  els.session.cal.textContent = 'Yes';
}

// ====== PDF Rendering ======
let renderTask = null;
async function loadPDF(data){
  try{
    state.pdf = await pdfjsLib.getDocument(data).promise;
    state.pageCount = state.pdf.numPages; els.pageCount.textContent = state.pageCount;
    state.pageNum = 1; els.pageNum.textContent = 1;
    setStatus('PDF loaded');
    await renderPage();
  }catch(e){
    console.error(e); setStatus('Failed to load PDF');
    if(els.fileName) els.fileName.textContent = 'No document loaded';
  }
}
async function renderPage(){
  if(!state.pdf) return;
  if(renderTask) {
    try{
      await renderTask.cancel();
    }catch{}
    renderTask = null;
  }
  const page = await state.pdf.getPage(state.pageNum);
  state.page = page;
  const viewport = page.getViewport({ scale: state.zoom * state.dpr });
  const canvas = els.pdf, ctx = ctxs.pdf;
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = (viewport.width / state.dpr) + 'px';
  canvas.style.height = (viewport.height / state.dpr) + 'px';

  // Overlay & label canvases follow same size
  for(const c of [els.overlay, els.labels]){
    c.width = canvas.width; c.height = canvas.height;
    c.style.width = canvas.style.width; c.style.height = canvas.style.height;
  }

  els.stack.style.display = 'inline-block';
  els.hint.style.display = 'none';

  const renderCtx = { canvasContext: ctx, viewport };
  renderTask = page.render(renderCtx);
  await renderTask.promise;
  renderTask = null;
  drawOverlay();
  updateZoomLbl();
}

function updateZoomLbl(){ els.zoomLbl.textContent = Math.round(state.zoom*100) + '%'; }

function setZoom(z, around){
  const scroller = els.viewer;
  const oldZoom = state.zoom;
  z = Math.max(state.minZoom, Math.min(state.maxZoom, z));
  if(!state.page || z===oldZoom) return;

  // Keep point under cursor stable
  let cx=0, cy=0; let sx=0, sy=0;
  if(around){
    const rect = els.pdf.getBoundingClientRect();
    cx = (around.clientX - rect.left) * (els.pdf.width / rect.width);
    cy = (around.clientY - rect.top) * (els.pdf.height / rect.height);
    sx = (around.clientX + scroller.scrollLeft - rect.left);
    sy = (around.clientY + scroller.scrollTop - rect.top);
  }

  state.zoom = z;
  renderPage().then(()=>{
    if(around){
      const rect = els.pdf.getBoundingClientRect();
      const nx = cx / (els.pdf.width / rect.width);
      const ny = cy / (els.pdf.height / rect.height);
      scroller.scrollLeft = nx - sx + scroller.scrollLeft;
      scroller.scrollTop = ny - sy + scroller.scrollTop;
    }
  });
}

// ====== Overlay Drawing ======
function overlayScale(){
  // pixels per CSS pixel
  const rectW = els.overlay.clientWidth || 1; // CSS px
  return els.overlay.width / rectW; // device pixels per CSS px
}
function clientToCanvas(ev){
  const rect = els.overlay.getBoundingClientRect();
  const xCss = ev.clientX - rect.left, yCss = ev.clientY - rect.top;
  const k = overlayScale();
  return { x: xCss * k, y: yCss * k };
}
function snapIfNeeded(p){
  if(!state.snap) return p;
  const pts = state.snapPoints.slice();
  if(state.drawing && state.drawing.points.length){
    const last = state.drawing.points[state.drawing.points.length-1];
    pts.push(last, state.drawing.points[0]);
  }
  let best=p, bestD=8*state.dpr; // 8px radius snap
  for(const q of pts){ const d=dist(p,q); if(d<bestD){ best=q; bestD=d; } }
  return best;
}

function drawOverlay(){
  const o = ctxs.overlay; const l = ctxs.labels;
  o.clearRect(0,0,els.overlay.width,els.overlay.height);
  l.clearRect(0,0,els.labels.width,els.labels.height);

  // Draw existing measures
  for(const m of state.measures){
    if(m.type==='line'){
      o.save();
      o.lineWidth = 2*state.dpr;
      o.lineCap='round';
      o.lineJoin='round';
      o.strokeStyle = overlayStyles.stroke;
      o.beginPath(); o.moveTo(m.a.x,m.a.y); o.lineTo(m.b.x,m.b.y); o.stroke();
      o.restore();
      if(state.showLabels){
        const mid = {x:(m.a.x+m.b.x)/2, y:(m.a.y+m.b.y)/2};
        const lenWorld = lenPxToWorld(m.lengthPx);
        const text = fmtLen(lenWorld);
        drawLabel(mid.x, mid.y, text);
      }
    } else if(m.type==='area'){
      o.save();
      o.lineWidth = 2*state.dpr;
      o.lineCap='round';
      o.lineJoin='round';
      o.strokeStyle = overlayStyles.stroke;
      o.fillStyle = overlayStyles.areaFill;
      o.beginPath(); m.points.forEach((p,i)=> i?o.lineTo(p.x,p.y):o.moveTo(p.x,p.y)); o.closePath(); o.fill(); o.stroke();
      o.restore();
      if(state.showLabels){
        const c = centroid(m.points);
        const areaWorld = areaPxToWorld(m.areaPx2);
        const perWorld = lenPxToWorld(m.perimeterPx);
        drawLabel(c.x,c.y, `${fmtArea(areaWorld)}  (P: ${fmtLen(perWorld)})`);
      }
    }
  }

  // Draw current drawing
  if(state.drawing){
    const d = state.drawing;
    if(d.type==='line' && d.points.length){
      o.save();
      o.setLineDash([6*state.dpr,6*state.dpr]);
      o.strokeStyle = overlayStyles.guide;
      o.lineWidth = 1.5*state.dpr;
      const a = d.points[0]; const b = d.temp || a;
      o.beginPath(); o.moveTo(a.x,a.y); o.lineTo(b.x,b.y); o.stroke();
      o.restore();
      const len = lenPxToWorld(dist(a,b));
      if(len!=null && state.showLabels) drawLabel((a.x+b.x)/2,(a.y+b.y)/2, fmtLen(len));
    }
    if(d.type==='area' && d.points.length){
      o.save();
      o.setLineDash([6*state.dpr,6*state.dpr]);
      o.strokeStyle = overlayStyles.guide;
      o.lineWidth = 1.5*state.dpr;
      o.beginPath(); d.points.forEach((p,i)=> i?o.lineTo(p.x,p.y):o.moveTo(p.x,p.y));
      if(d.temp){ o.lineTo(d.temp.x, d.temp.y); }
      o.stroke(); o.restore();
      if(state.showLabels && d.points.length>=2 && d.temp){
        const pts = d.points.concat([d.temp]);
        const aPx = polygonAreaPx(pts); const aW = areaPxToWorld(aPx);
        const c = centroid(pts);
        drawLabel(c.x,c.y, fmtArea(aW));
      }
    }
  }

  function drawLabel(x,y,text){
    const pad = 6*state.dpr; const r = 6*state.dpr;
    l.save();
    l.font = `${12*state.dpr}px ui-sans-serif,system-ui,Segoe UI,Roboto`;
    const metrics = l.measureText(text);
    const w = metrics.width + pad*2, h = 20*state.dpr;
    const bx = x - w/2, by = y - h - 8*state.dpr;
    // bubble
    l.fillStyle = overlayStyles.bubble;
    roundRect(l, bx,by,w,h,r); l.fill();
    // text
    l.fillStyle = overlayStyles.bubbleText;
    l.fillText(text, bx+pad, by+14*state.dpr);
    l.restore();
  }
}

// ====== Interactions ======
// File loading
els.file.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  if(els.fileName) els.fileName.textContent = f.name;
  setStatus('Loading…');
  const buf = await f.arrayBuffer();
  loadPDF({data: buf});
});

// Demo document (simple single-page grid created on the fly)
els.demoBtn.addEventListener('click', async ()=>{
  if(els.fileName) els.fileName.textContent = 'Sample demo plan.pdf';
  // Fetch a tiny embedded PDF (data URL) for demo
  // For portability, generate on the fly using a prebuilt minimal PDF string
  const pdfData = atob("JVBERi0xLjMKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Ci9Qcm9jU2V0IFsvUERGL1RleHRdCi9Gb250IDw8Ci9GMCAzIDAgUgo+PgovWE9iamVjdCA8PC9JbWFnZSA8PC9XaWR0aCA2MDAvSGVpZ2h0IDg0MC9Db2xvclNwYWNlIC9EZXZpY2VSR0IvQml0c1BlckNvbXBvbmVudCA4Pj4+PgovRXh0R1N0YXRlIDw8Pj4+PgovTWVkaWFCb3hbMCAwIDU5NSA4MzVdCi9Db250ZW50cyA0IDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWyAxIDAgUiBdCi9Db3VudCAxCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovTmFtZSAvRjAKL0Jhc2VGb250IC9IZWx2ZXRpY2EKL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCAyMDY+PgpzdHJlYW0KQlQKIC9GMCBUIDEyIFRmCiAgMCA3ODAgVGQKICAoR2VuZXJhdGVkIERlbW8gR3JpZCBGb3IgTWVhc3VyZW1lbnQpIFRqCkJUCiAgL0YwIFQgMTIgVGYKICAxMDAgNzEwIFRkCiAgKDIwIGZ0IG1ham9yIGdyaWQ6IGVhY2ggcXVhcmUgaXMgMSBmdClUagpCVApFcApRVQplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEwMCAwMDAwMCBuIAowMDAwMDAwMDg3IDAwMDAwIG4gCjAwMDAwMDAxODIgMDAwMDAgbiAKMDAwMDAwMDMxMSAwMDAwMCBuIAowMDAwMDAwNTE5IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwo+PgpzdGFydHhyZWYKNTM3CiUlRU9G");
  const bytes = new Uint8Array(pdfData.length);
  for(let i=0;i<pdfData.length;i++) bytes[i]=pdfData.charCodeAt(i);
  await loadPDF({data: bytes});
});

// Paging
els.prev.addEventListener('click', ()=>{ if(!state.pdf) return; state.pageNum=Math.max(1,state.pageNum-1); els.pageNum.textContent=state.pageNum; renderPage(); });
els.next.addEventListener('click', ()=>{ if(!state.pdf) return; state.pageNum=Math.min(state.pageCount,state.pageNum+1); els.pageNum.textContent=state.pageNum; renderPage(); });

// Zoom
els.zoomIn.addEventListener('click', ()=> setZoom(state.zoom*1.2));
els.zoomOut.addEventListener('click', ()=> setZoom(state.zoom/1.2));
els.zoomReset.addEventListener('click', ()=> setZoom(1));
els.viewer.addEventListener('wheel', (e)=>{
  if(!e.ctrlKey && !e.metaKey){ return; } // use ctrl/cmd+wheel to zoom for accessibility
  e.preventDefault();
  const delta = e.deltaY<0 ? 1.12 : (1/1.12);
  setZoom(state.zoom*delta, e);
}, {passive:false});

// Tool select
els.toolGroup.addEventListener('click', (e)=>{
  const b = e.target.closest('[data-tool]'); if(!b) return;
  setTool(b.dataset.tool);
});

// Units
els.units.addEventListener('change', ()=>{ state.units = els.units.value; updateScaleLabel(); drawOverlay(); });

// Toggle labels/snaps
els.toggleLabels.addEventListener('click', ()=>{ state.showLabels=!state.showLabels; drawOverlay(); });
els.toggleSnaps.addEventListener('click', ()=>{ state.snap=!state.snap; els.toggleSnaps.classList.toggle('ghost', !state.snap); });

// Overlay pointer events
let isPanning=false; let panStart={x:0,y:0,sl:0,st:0}; let spaceHeld=false;
window.addEventListener('keydown', (e)=>{ if(e.code==='Space') { spaceHeld=true; } if(e.key==='Enter') finishPolygon(); });
window.addEventListener('keyup', (e)=>{ if(e.code==='Space') spaceHeld=false; });

els.overlay.addEventListener('mousedown', (e)=>{
  if(!state.page) return;
  const p = snapIfNeeded(clientToCanvas(e));
  const effectiveTool = (spaceHeld? 'pan' : state.tool);
  if(effectiveTool==='pan' || e.button===1){ // middle mouse pan too
    isPanning=true; const sc=els.viewer; panStart={x:e.clientX,y:e.clientY,sl:sc.scrollLeft,st:sc.scrollTop};
    return;
  }
  if(effectiveTool==='calibrate') handleCalibrateClick(p);
  if(effectiveTool==='line') handleLineClick(p);
  if(effectiveTool==='area') handleAreaClick(p);
});
els.overlay.addEventListener('mousemove', (e)=>{
  if(isPanning){ const sc=els.viewer; sc.scrollLeft = panStart.sl - (e.clientX-panStart.x); sc.scrollTop = panStart.st - (e.clientY-panStart.y); return; }
  if(!state.page) return;
  const p = snapIfNeeded(clientToCanvas(e));
  if(state.drawing){ state.drawing.temp = p; drawOverlay(); }
});
window.addEventListener('mouseup', ()=>{ isPanning=false; });
els.overlay.addEventListener('dblclick', ()=> finishPolygon());

// Undo / Finish / Clear
els.undo.addEventListener('click', ()=>{
  if(state.drawing && state.drawing.points.length){ state.drawing.points.pop(); state.drawing.temp=null; drawOverlay(); }
});
function finishPolygon(){
  if(state.drawing && state.drawing.type==='area' && state.drawing.points.length>=3){
    const pts = state.drawing.points.slice();
    const areaPx2 = polygonAreaPx(pts);
    const perPx = polygonPerimeterPx(pts);
    state.lastArea = areaPxToWorld(areaPx2); els.session.area.textContent = fmtArea(state.lastArea);
    state.drawing = null;
    addMeasure({type:'area', points:pts, areaPx2, perimeterPx: perPx});
  }
}
els.finish.addEventListener('click', finishPolygon);

els.clear.addEventListener('click', ()=>{
  state.measures = []; state.drawing=null; state.lastLen=null; state.lastArea=null; els.session.len.textContent='–'; els.session.area.textContent='–'; refreshSnapPoints(); drawOverlay(); refreshList();
});

// Export
els.exportJson.addEventListener('click', ()=>{
  const out = state.measures.map((m,i)=>{
    if(m.type==='line'){
      return { id:`L${i+1}`, type:'line', a:m.a, b:m.b, length_px:m.lengthPx, length_units: lenPxToWorld(m.lengthPx), units: state.units };
    }else{
      return { id:`A${i+1}`, type:'area', points:m.points, area_px2: m.areaPx2, area_units: areaPxToWorld(m.areaPx2), perimeter_units: lenPxToWorld(m.perimeterPx), units: state.units };
    }
  });
  const blob = new Blob([JSON.stringify(out,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='measurements.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 5000);
});

els.exportPng.addEventListener('click', ()=>{
  // Compose PDF canvas + overlay + labels into a single PNG for quick snapshot
  if(!state.page) return;
  const w = els.pdf.width, h=els.pdf.height;
  const cnv = document.createElement('canvas'); cnv.width=w; cnv.height=h; const c=cnv.getContext('2d');
  c.drawImage(els.pdf,0,0); c.drawImage(els.overlay,0,0); c.drawImage(els.labels,0,0);
  cnv.toBlob(b=>{ const url = URL.createObjectURL(b); const a=document.createElement('a'); a.href=url; a.download='snapshot.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),5000); }, 'image/png');
});

// ====== Measurement handlers ======
// Calibration
let calClicks = [];
function handleCalibrateClick(p){
  calClicks.push(p);
  if(calClicks.length===2){
    const px = dist(calClicks[0], calClicks[1]);
    els.pxDist.textContent = px.toFixed(2);
    els.calUnits.value = state.units; els.calValue.value = '';
    openCalModal(px);
    calClicks = [];
  } else {
    drawOverlay();
  }
}
function openCalModal(px){ els.calModal.style.display='flex'; els.calApply.onclick = ()=>applyCalibration(px); els.calCancel.onclick = closeCalModal; }
function closeCalModal(){ els.calModal.style.display='none'; }
function applyCalibration(px){
  const value = parseFloat(els.calValue.value);
  const u = els.calUnits.value;
  if(!(value>0)) { alert('Enter a valid distance'); return; }
  const inFeet = value * unitsToBaseFactor(u); // feet
  state.unitsPerPixel = inFeet / px; // feet per pixel
  state.calibrated = true; closeCalModal();
  updateScaleLabel(); setStatus('Calibration set'); drawOverlay();
}

// Line measurement
function handleLineClick(p){
  if(!state.calibrated){ alert('Please calibrate first.'); return; }
  if(!state.drawing){ state.drawing = {type:'line', points:[p], temp:null}; }
  else if(state.drawing.type==='line' && state.drawing.points.length===1){
    const a = state.drawing.points[0]; const b = p;
    const Lpx = dist(a,b);
    state.lastLen = lenPxToWorld(Lpx); els.session.len.textContent = fmtLen(state.lastLen);
    state.drawing = null;
    addMeasure({type:'line', a,b, lengthPx:Lpx});
  }
}

// Area measurement
function handleAreaClick(p){
  if(!state.calibrated){ alert('Please calibrate first.'); return; }
  if(!state.drawing){ state.drawing = {type:'area', points:[p], temp:null}; drawOverlay(); return; }
  if(state.drawing.type==='area'){ state.drawing.points.push(p); drawOverlay(); }
}

// List UI
function addMeasure(measure){
  state.measures.push(measure);
  refreshSnapPoints();
  drawOverlay();
  refreshList();
}

function refreshList(){
  els.measList.innerHTML = '';
  state.measures.forEach((m,i)=>{
    const div = document.createElement('div');
    const id = (m.type==='line'?'L':'A') + (i+1);
    if(m.type==='line'){
      const len = lenPxToWorld(m.lengthPx);
      div.innerHTML = `<div class="row-between"><div><b>${id}</b> · Line</div><div class="mono">${fmtLen(len)}</div></div>`;
    } else {
      const a = areaPxToWorld(m.areaPx2); const p = lenPxToWorld(m.perimeterPx);
      div.innerHTML = `<div class="row-between"><div><b>${id}</b> · Area</div><div class="mono">${fmtArea(a)} · P ${fmtLen(p)}</div></div>`;
    }
    els.measList.appendChild(div);
  });
}

// ====== Init defaults ======
refreshSnapPoints();
els.toggleSnaps.classList.toggle('ghost', !state.snap);
setTool('pan'); updateScaleLabel(); updateZoomLbl();
