import { Units, convert as convertUnits, formatSig } from '../../lib/units/index.js';
import { $, $$ } from '../../lib/dom.js';
const note = msg => { const n = $('#note'); n.textContent = msg || ''; n.className = 'panel ' + (msg ? 'notice' : ''); };

  // -------- Unit Catalog (imported from lib) --------

  // Build UI options
  const catSel = $('#category');
  const fromSel = $('#fromUnit');
  const toSel = $('#toUnit');

  Object.keys(Units).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat; catSel.appendChild(opt);
  });

  function loadUnits(cat){
    fromSel.innerHTML=''; toSel.innerHTML='';
    Units[cat].units.forEach(({sym,name})=>{
      const o1=document.createElement('option'); o1.value=sym; o1.textContent = `${sym} — ${name}`; fromSel.appendChild(o1);
      const o2=document.createElement('option'); o2.value=sym; o2.textContent = `${sym} — ${name}`; toSel.appendChild(o2);
    });
    const defaults = {
      Length:['ft','m'], Area:['ft²','m²'], Volume:['bf','ft³'], Mass:['lb','kg'], Force:['lbf','kN'],
      Pressure:['psi','kPa'], Temperature:['°F','°C'], Energy:['BTU','kWh'], Power:['MBH','kW'],
      'Apparent Power':['kVA','kVA'], 'Volumetric Flow':['cfm','L/s'], Velocity:['fpm','m/s'], Density:['lb/ft³','kg/m³'],
      'Linear Density':['lb/ft','kg/m'], Torque:['ft·lbf','N·m'], 'Angle / Slope':['in/ft','°'],
      'Thermal Resistance (R/RSI)':['R','RSI'], 'Thermal Transmittance (U)':['BTU/(h·ft²·°F)','W/m²·K']
    };
    const d = defaults[cat] || [];
    if(d[0]) fromSel.value = d[0];
    if(d[1]) toSel.value = d[1];
  }

  // precision handling
  let sigFigs = Number(localStorage.getItem('uc_sigfigs')||'4');
  const setPrec = n => { sigFigs = Math.max(2, Math.min(12, n|0)); $('#precView').textContent = sigFigs; localStorage.setItem('uc_sigfigs', sigFigs); };
  setPrec(sigFigs);

  // favorites
  let favorites = JSON.parse(localStorage.getItem('uc_favs')||'[]');
  function favKey(cat, from, to){ return `${cat}|${from}>${to}`; }
  function isFav(cat, from, to){ return favorites.includes(favKey(cat,from,to)); }
  function toggleFav(){
    const k = favKey(catSel.value, fromSel.value, toSel.value);
    const i = favorites.indexOf(k);
    if(i>=0) favorites.splice(i,1); else favorites.push(k);
    localStorage.setItem('uc_favs', JSON.stringify(favorites));
    renderFavs();
    paintStar();
  }
  function paintStar(){ $('#star').style.opacity = isFav(catSel.value, fromSel.value, toSel.value) ? '1' : '.55'; }
  function renderFavs(){
    const box = $('#favorites'); box.innerHTML='';
    if(!favorites.length){
      const span = document.createElement('span'); span.className='small muted'; span.textContent='No favorites yet. Click ★ to save current pair.'; box.appendChild(span); return;
    }
    favorites.slice(0,30).forEach(k=>{
      const [cat, flow] = k.split('|');
      const [from,to] = flow.split('>');
      const chip = document.createElement('button');
      chip.className='pill'; chip.title='Use favorite';
      chip.textContent = `${cat}: ${from} → ${to}`;
      chip.onclick=()=>{ catSel.value=cat; loadUnits(cat); fromSel.value=from; toSel.value=to; paintStar(); };
      box.appendChild(chip);
    });
  }

  // search
  function searchUnits(q){
    q = q.trim().toLowerCase();
    if(!q){ note(''); return; }
    const hits=[];
    for(const [cat,def] of Object.entries(Units)){
      def.units.forEach(u=>{
        const hay = `${u.sym} ${u.name}`.toLowerCase();
        if(hay.includes(q)) hits.push({cat, sym:u.sym, name:u.name});
      });
    }
    if(!hits.length){ note('No matching units.'); return; }
    const top = hits[0];
    note(`Found ${hits.length} matches. Focused: ${top.cat} — ${top.sym} (${top.name}).`);
    catSel.value = top.cat; loadUnits(top.cat); fromSel.value = top.sym; paintStar();
  }

  // conversion core
  function getUnit(cat, sym){ return Units[cat].units.find(u=>u.sym===sym); }

  function convertOnce(val, cat, from, to){
    return convertUnits(val, cat, from, to);
  }

  function fmt(x){
    return formatSig(x, sigFigs);
  }

  function addLine(val, cat, from, to){
    const tr=document.createElement('tr');
    const f = getUnit(cat, from), t = getUnit(cat, to);
    const numVal = parseFloat(val);
    const res = isFinite(numVal) ? convertOnce(numVal,cat,from,to) : NaN;
    tr.innerHTML = `
      <td class="mono">${escapeHtml(String(val))}</td>
      <td>${from} <span class="small muted">(${f?.name||''})</span></td>
      <td>${to} <span class="small muted">(${t?.name||''})</span></td>
      <td class="mono">${isFinite(res)?fmt(res):'—'}</td>
      <td class="right"><button class="ghost" title="Remove">✕</button></td>
    `;
    tr.querySelector('button').onclick=()=>tr.remove();
    $('#tbody').prepend(tr);
  }

  function escapeHtml(s){
    return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function doConvert(){
    const v = parseFloat($('#value').value);
    const cat = catSel.value; const from=fromSel.value; const to=toSel.value;
    if(isNaN(v)){ note('Enter a numeric value to convert.'); return; }
    try{
      const out = convertOnce(v, cat, from, to);
      note(`${fmt(v)} ${from} = ${fmt(out)} ${to}`);
      addLine(v,cat,from,to);
    }catch(err){ note(`Conversion error: ${err.message}`); }
  }

  function swap(){
    const a = fromSel.value, b = toSel.value; fromSel.value=b; toSel.value=a; paintStar();
  }

  function copyAll(){
    const TAB = String.fromCharCode(9);
    const NL = String.fromCharCode(10);
    const rows = $$('#tbody tr').map(tr=>
      $$('.mono', tr).map(td=>td.textContent).join(TAB) + TAB +
      $$('.small', tr).map(s=>s.textContent.replace(/[()]/g,'').trim()).join(TAB)
    );
    const text = rows.join(NL);
    navigator.clipboard.writeText(text).then(()=>{
      note(`Copied ${rows.length} line(s) to clipboard.`);
    },()=>{
      note('Copy failed. You can still select and copy manually.');
    });
  }

  // Wire events
  $('#convert').onclick = doConvert;
  $('#swap').onclick = swap;
  $('#star').onclick = toggleFav;
  $('#addRow').onclick = ()=>addLine($('#value').value || '—', catSel.value, fromSel.value, toSel.value);
  $('#clearRows').onclick = ()=>{ $('#tbody').innerHTML=''; };
  $('#copyAll').onclick = copyAll;
  $('#incPrec').onclick = ()=>setPrec(sigFigs+1);
  $('#decPrec').onclick = ()=>setPrec(sigFigs-1);
  $('#search').addEventListener('input', e=>searchUnits(e.target.value));

  // Enter key
  $('#value').addEventListener('keydown', e=>{ if(e.key==='Enter') doConvert(); });

  // Initialize
  catSel.onchange = ()=>{ loadUnits(catSel.value); paintStar(); };
  fromSel.onchange = paintStar; toSel.onchange = paintStar;
  catSel.value = 'Length'; loadUnits('Length'); paintStar();
  renderFavs();

  // Starter hint
  note('Examples: 1) 120 MBH → kW; 2) 6000 cfm → L/s; 3) 1.5 in/ft → % grade; 4) 500 bf → ft³; 5) 24 R → RSI.');
