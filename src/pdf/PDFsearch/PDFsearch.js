/* ===== Utilities ===== */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Minimal Double Metaphone implementation (lightweight, not fully spec‑complete but good enough for rough phonetics)
// Source adapted from public domain snippets; trimmed for size, not perfect for all languages
function metaphoneLite(word){
  if(!word) return ""; word = word.toLowerCase().replace(/[^a-z]/g, "");
  if(!word) return "";
  const drop = [/^[knwrh]/, /^x/];
  drop.forEach(rx=> word = word.replace(rx, m=> (rx===drop[1] ? 's' : '')));
  const subs = [
    [/cia/g, 'xia'], [/ch/g, 'x'], [/c(?!h)(e|i|y)/g, 's'], [/c/g, 'k'], [/dg(e|y|i)/g, 'j'], [/d/g, 't'],
    [/gh(^$|[^aeiou])/g, 'h'], [/gn/g, 'n'], [/kn/g, 'n'], [/mb$/g, 'm'], [/ph/g, 'f'], [/q/g, 'k'],
    [/sch/g, 'sk'], [/tio/g, 'xio'], [/tia/g, 'xia'], [/th/g, '0'], [/tch/g, 'ch'], [/v/g, 'f'], [/wh/g, 'w'],
    [/wr/g, 'r'], [/x/g, 'ks'], [/z/g, 's']
  ];
  subs.forEach(([a,b])=> word = word.replace(a,b));
  word = word.replace(/[aeiou]/g, (m,idx)=> idx===0?m:'');
  return word.toUpperCase();
}

// Levenshtein distance (for optional extra scoring)
function lev(a,b){
  const m=a.length,n=b.length; const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){
    const cost = a[i-1]==b[j-1]?0:1;
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
  }
  return dp[m][n];
}

/* ===== PDF state ===== */
let pdfDoc = null;
let scale = 1.25;
const pages = []; // {num, canvas, ctx, viewport, textItems:[{str, x, y, w, h}], plainText, ocrText, marks:[]}
let totalChars = 0; let ocrPages = 0;

const statusEl = $('#status');
const countBadge = $('#countBadge');
const kvPages = $('#kvPages');
const kvChars = $('#kvChars');
const kvOCR = $('#kvOCR');
const kvScale = $('#kvScale');

function setStatus(msg){ statusEl.textContent = msg; }

function resetDoc(){
  pdfDoc = null; pages.length=0; totalChars=0; ocrPages=0;
  $('#viewer').innerHTML='';
  kvPages.textContent='–'; kvChars.textContent='–'; kvOCR.textContent='–';
  setStatus('No PDF loaded.');
  countBadge.textContent='0';
  $('#results').innerHTML='';
}

/* ===== PDF Loading ===== */
async function loadPDFFromArrayBuffer(buf){
  resetDoc();
  setStatus('Loading PDF…');
  const loadingTask = pdfjsLib.getDocument({data: buf});
  pdfDoc = await loadingTask.promise;
  kvPages.textContent = pdfDoc.numPages;
  setStatus(`Loaded ${pdfDoc.numPages} pages. Rendering…`);
  await renderAllPages();
  setStatus(`Ready. Indexed ${totalChars.toLocaleString()} characters.`);
  kvChars.textContent = totalChars.toLocaleString();
  kvOCR.textContent = ocrPages;
}

async function fetchAsArrayBuffer(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Failed to fetch PDF');
  return await res.arrayBuffer();
}

/* ===== Rendering & Text extraction ===== */
async function renderAllPages(){
  const viewer = $('#viewer');
  for(let p=1;p<=pdfDoc.numPages;p++){
    const page = await pdfDoc.getPage(p);
    const vport = page.getViewport({scale});
    const container = document.createElement('div');
    container.className='page';
    container.dataset.page = p;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = vport.width; canvas.height = vport.height;
    container.appendChild(canvas);
    const tl = document.createElement('div'); tl.className='textLayer'; container.appendChild(tl);
    viewer.appendChild(container);
    // Render page
    await page.render({canvasContext: ctx, viewport: vport}).promise;
    // Extract text
    let textItems=[]; let plain='';
    try{
      const textContent = await page.getTextContent();
      textItems = textContent.items.map(it=>({str: it.str, x: it.transform[4], y: vport.height - it.transform[5], w: it.width, h: it.height}));
      plain = textContent.items.map(it=>it.str).join(' ');
    }catch(e){ plain=''; textItems=[]; }

    if(plain.trim().length < 6){ // Weak or no text → candidate for OCR
      const ocrChoice = $('#ocr').value;
      if(ocrChoice === 'force' || ocrChoice==='auto'){
        setStatus(`OCR page ${p}/${pdfDoc.numPages}…`);
        const otext = await ocrPage(canvas);
        if(otext && otext.trim().length){ plain = otext; ocrPages++; }
      }
    }

    totalChars += plain.length;
    pages.push({num:p, canvas, ctx, viewport:vport, textItems, plainText:plain, ocrText:null, marks:[], textLayer:tl});
  }
  kvScale.textContent = scale;
  kvOCR.textContent = ocrPages;
}

async function ocrPage(canvas){
  try{
    const { createWorker } = Tesseract;
    // Use the high-level recognize directly (CDN build exposes Tesseract.recognize too)
    const res = await Tesseract.recognize(canvas, 'eng', { logger: m=>{} });
    return res.data.text || '';
  }catch(err){ console.warn('OCR failed', err); return ''; }
}

/* ===== Search / Fuzzy ===== */
function buildFuseDataset(){
  // dataset: one entry per page; keys: text
  return pages.map(pg=>({ page: pg.num, text: pg.plainText || '', _len: (pg.plainText||'').length }));
}

function regexSearch(pattern, caseSensitive){
  const rx = new RegExp(pattern, caseSensitive? 'g':'gi');
  const hits=[];
  for(const pg of pages){
    let m; const text = pg.plainText || '';
    while((m = rx.exec(text))){
      const idx = m.index; const snip = snippet(text, idx, $('#prox').value|0);
      hits.push({page: pg.num, start: idx, end: idx + (m[0]?.length||0), score: 0, snippet: snip, term: m[0]});
    }
  }
  return hits;
}

function exactSearch(query, caseSensitive){
  const q = caseSensitive? query : query.toLowerCase();
  const hits=[];
  for(const pg of pages){
    const text = caseSensitive? (pg.plainText||'') : (pg.plainText||'').toLowerCase();
    let idx = 0; while((idx = text.indexOf(q, idx)) !== -1){
      const snip = snippet(pg.plainText||'', idx, $('#prox').value|0);
      hits.push({page: pg.num, start: idx, end: idx+q.length, score: 0, snippet: snip, term: query});
      idx += q.length || 1;
    }
  }
  return hits;
}

function phoneticSearch(query){
  const mq = metaphoneLite(query);
  const hits=[];
  for(const pg of pages){
    const text = (pg.plainText||'');
    const words = text.split(/\W+/);
    for(let i=0;i<words.length;i++){
      if(words[i] && metaphoneLite(words[i])===mq){
        const idx = text.indexOf(words[i]);
        const snip = snippet(text, idx, $('#prox').value|0);
        hits.push({page: pg.num, start: idx, end: idx+words[i].length, score: 0.3, snippet: snip, term: words[i]});
      }
    }
  }
  return hits;
}

function fuseSearch(query, threshold){
  const dataset = buildFuseDataset();
  const fuse = new Fuse(dataset, { includeScore:true, includeMatches:true, threshold, keys:['text'], minMatchCharLength:2, ignoreLocation:true });
  const res = fuse.search(query);
  const hits=[];
  for(const r of res){
    const pg = r.item.page; const m = r.matches?.[0];
    if(!m) continue;
    for(const [start,end] of m.indices || []){
      const full = pages[pg-1].plainText || '';
      const snip = snippet(full, start, $('#prox').value|0);
      hits.push({page: pg, start, end, score: r.score ?? 0, snippet: snip, term: full.slice(start,end+1)});
    }
  }
  return hits;
}

function snippet(text, centerIdx, radius){
  const a = Math.max(0, centerIdx - radius);
  const b = Math.min(text.length, centerIdx + radius);
  let s = text.slice(a,b).replace(/\s+/g,' ').trim();
  if(a>0) s = '… ' + s; if(b<text.length) s = s + ' …';
  return s;
}

function renderResults(hits, query){
  const cont = $('#results'); cont.innerHTML='';
  countBadge.textContent = hits.length;
  const cs = $('#case').value==='true';
  const qrx = ( $('#mode').value==='regex' ? new RegExp(query, cs? 'g':'gi') : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), cs? 'g':'gi') );
  hits.sort((a,b)=> a.page===b.page ? a.start-b.start : a.page-b.page);
  for(const h of hits){
    const card = document.createElement('div'); card.className='res';
    card.innerHTML = `<div class="title">Page ${h.page} <span class="badge">score ${ (1-(h.score||0)).toFixed(2) }</span></div>
      <div class="meta">pos ${h.start.toLocaleString()} — ${h.end.toLocaleString()}</div>
      <div class="snip"></div>`;
    const sn = card.querySelector('.snip');
    sn.textContent = h.snippet;
    // highlight snippet occurrences
    sn.innerHTML = sn.textContent.replace(qrx, m=>`<mark>${m}</mark>`);
    card.addEventListener('click', ()=> jumpTo(h.page, h.start, h.end));
    cont.appendChild(card);
  }
}

function clearHighlights(){
  for(const pg of pages){
    for(const el of pg.marks){ el.remove(); }
    pg.marks.length = 0;
  }
}

function jumpTo(pageNum, start, end){
  const el = $(`.page[data-page="${pageNum}"]`);
  if(!el) return; el.scrollIntoView({behavior:'smooth', block:'center'});
  // try to highlight approximate region by scanning textItems for containing term border
  try{
    const pg = pages[pageNum-1];
    const text = pg.plainText||'';
    const term = text.slice(start, Math.min(end, start+80));
    // naive: find any item that contains first 8 chars of term
    const k = term.slice(0,8).trim();
    if(k){
      for(const it of pg.textItems){
        if((it.str||'').toLowerCase().includes(k.toLowerCase())){
          const mark = document.createElement('div'); mark.className='hl'; mark.style.left=it.x+'px'; mark.style.top=(it.y-it.h)+'px'; mark.style.width=it.w+'px'; mark.style.height=it.h+'px';
          pg.textLayer.appendChild(mark); pg.marks.push(mark);
          mark.animate([{opacity:0},{opacity:1}],{duration:300});
          setTimeout(()=>{mark.animate([{opacity:1},{opacity:0}],{duration:800}); setTimeout(()=>mark.remove(),900);},1400);
          break;
        }
      }
    }
  }catch(e){}
}

/* ===== Wire up UI ===== */
$('#fileInput').addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const buf = await f.arrayBuffer();
  await loadPDFFromArrayBuffer(buf);
});

$('#clearBtn').addEventListener('click', ()=> resetDoc());

$('#loadUrlBtn').addEventListener('click', async ()=>{
  const url = $('#urlInput').value.trim(); if(!url) return alert('Paste a PDF URL');
  try{
    const buf = await fetchAsArrayBuffer(url);
    await loadPDFFromArrayBuffer(buf);
  }catch(e){ alert('Failed to load: '+e.message); }
});

// Drag + drop
const drop = $('#drop');
;['dragenter','dragover'].forEach(ev=> drop.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); drop.classList.add('drag'); }));
;['dragleave','drop'].forEach(ev=> drop.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag'); }));
drop.addEventListener('drop', async (e)=>{
  const f = e.dataTransfer.files?.[0]; if(!f) return;
  if(f.type!=="application/pdf" && !f.name.toLowerCase().endsWith('.pdf')) return alert('Drop a .pdf file');
  const buf = await f.arrayBuffer(); await loadPDFFromArrayBuffer(buf);
});

// Search
async function doSearch(){
  if(!pdfDoc){ alert('Load a PDF first.'); return; }
  clearHighlights();
  setStatus('Searching…');
  const mode = $('#mode').value;
  const q = $('#q').value.trim();
  if(!q){ setStatus('Enter a query.'); return; }
  const caseSensitive = $('#case').value==='true';
  let hits=[];
  if(mode==='regex') hits = regexSearch(q, caseSensitive);
  else if(mode==='exact') hits = exactSearch(q, caseSensitive);
  else if(mode==='phonetic') hits = phoneticSearch(q);
  else hits = fuseSearch(q, parseFloat($('#thres').value||'0.35'));
  renderResults(hits, q);
  setStatus(`Found ${hits.length} matches.`);
}

$('#searchBtn').addEventListener('click', doSearch);
$('#q').addEventListener('keydown', (e)=>{ if(e.key==='Enter') doSearch(); });

$('#clearMarksBtn').addEventListener('click', clearHighlights);

$('#exportBtn').addEventListener('click', ()=>{
  const items = $$('#results .res').map((el,i)=>{
    return {
      index: i+1,
      page: parseInt(el.querySelector('.title').textContent.replace(/[^0-9]/g,''),10),
      meta: el.querySelector('.meta').textContent,
      snippet: el.querySelector('.snip').innerText
    }
  });
  const blob = new Blob([JSON.stringify({exportedAt:new Date().toISOString(), items}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pdf-search-results.json'; a.click();
});

// Zoom shortcuts
document.addEventListener('keydown', (e)=>{
  if(e.ctrlKey && (e.key==='=' || e.key==='+')){ e.preventDefault(); zoom(0.1); }
  if(e.ctrlKey && e.key==='-'){ e.preventDefault(); zoom(-0.1); }
});

async function zoom(d){
  if(!pdfDoc) return; scale = Math.max(0.5, Math.min(3, scale + d)); kvScale.textContent=scale.toFixed(2);
  setStatus('Re-rendering at new scale…');
  const buf = await (await pdfDoc.getData()).buffer; // pdf.js exposes getData() as Uint8Array
  await loadPDFFromArrayBuffer(buf);
}

// Hints
setStatus('No PDF loaded. Drop a file or paste a URL.');
