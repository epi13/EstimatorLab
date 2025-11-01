// --- Configurable Pricing Engine (edit in the UI) ---
const defaultConfig = {
  version: "2025-10-16",
  notes: "ROM industry pricing; replace with local vendor quotes",
  panelBase: {
    enclosure_base: 350,
    per_space: 12,
    amp_adders: {"100": 0, "225": 250, "400": 1500, "600": 4000},
    type_multipliers: {"Lighting": 1.0, "Distribution": 1.12}
  },
  mainBreakerAdders: {"100": 450, "225": 800, "400": 2500, "600": 4500},
  nemaMultipliers: {"NEMA 1 (indoor)": 1.0, "NEMA 3R (weatherproof)": 1.12, "NEMA 4X (corrosion resistant)": 1.45},
  busMultipliers: {"Aluminum": 1.0, "Copper": 1.20},
  kaicMultipliers: {"22": 1.00, "42": 1.05, "65": 1.12, "100": 1.25},
  accessories: {
    ground_bar: { material: 85, labor_mh: 0.3 },
    spd: { material: 750, labor_mh: 1.2 },
    feed_thru: { material: 180, labor_mh: 0.6 },
    subfeed: { material: 650, labor_mh: 1.3 },
    nameplates: { material: 95, labor_mh: 0.2 },
    key_interlock: { material: 320, labor_mh: 0.8 }
  },
  // Alaska logistics heuristics (editable)
  logistics: {
    road: { base: 75, per_mile: 0.35, per_lb: 0.25 },
    barge:{ base: 250, per_mile: 0.15, per_lb: 0.65 },
    bush: { base: 120, per_mile: 0.80, per_lb: 2.50 }
  },
  // Weight model (very approximate)
  weightModel:{ base: 80, per_space: 1.0, amp_adders:{"100":0, "225":10, "400":40, "600":70}, nema_adders:{"NEMA 1 (indoor)":0, "NEMA 3R (weatherproof)":6, "NEMA 4X (corrosion resistant)":14} },
  // Labor model (field install)
  labor: {
    base_mh: 6.0,
    per_space_mh: 0.05,
    main_breaker_mh: 1.5,
    terminations_mh: {"1": 1.0, "3": 1.8},
    mounting_mh: 1.25,
    commissioning_mh: 0.8
  }
};

// Persisted / current config
const cfgArea = document.getElementById('configArea');
function loadConfigToEditor(){ cfgArea.value = JSON.stringify(currentCfg, null, 2); }
let currentCfg = JSON.parse(localStorage.getItem('panel_calc_cfg')||'null') || structuredClone(defaultConfig);
loadConfigToEditor();

// Helpers (FIX: split $ and $$ declarations)
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const fmt = n => n.toLocaleString(undefined,{style:'currency',currency:'USD'});

function estimateWeight(cfg, inputs){
  const wm = cfg.weightModel;
  let w = wm.base + wm.per_space*inputs.spaces + (wm.amp_adders[inputs.amps]||0) + (wm.nema_adders[inputs.nema]||0);
  if(inputs.bus==='Copper') w *= 1.08; // copper bus slightly heavier
  return w; // lbs
}

function materialPrice(cfg, inputs){
  const base = cfg.panelBase.enclosure_base + cfg.panelBase.per_space*inputs.spaces + (cfg.panelBase.amp_adders[inputs.amps]||0);
  const typeMult = cfg.panelBase.type_multipliers[inputs.panelType]||1;
  const busMult = cfg.busMultipliers[inputs.bus]||1;
  const nemaMult = cfg.nemaMultipliers[inputs.nema]||1;
  const kaicMult = cfg.kaicMultipliers[inputs.kaic]||1;
  const brandMult = inputs.brandMult || 1;
  let price = base * typeMult * busMult * nemaMult * kaicMult * brandMult;
  if(inputs.mainType==='MB') price += (cfg.mainBreakerAdders[inputs.amps]||0);
  // Accessories
  const acc = cfg.accessories; let accTotal = 0; const accLines = [];
  if(inputs.acc.ground_bar){ accTotal+=acc.ground_bar.material; accLines.push(['Ground bar','Allowance',acc.ground_bar.material]); }
  if(inputs.acc.spd){ accTotal+=acc.spd.material; accLines.push(['SPD/TVSS','Allowance',acc.spd.material]); }
  if(inputs.acc.feed_thru){ accTotal+=acc.feed_thru.material; accLines.push(['Feed-through lugs','Allowance',acc.feed_thru.material]); }
  if(inputs.acc.subfeed){ accTotal+=acc.subfeed.material; accLines.push(['Sub-feed breaker(s)','Allowance',acc.subfeed.material]); }
  if(inputs.acc.nameplates){ accTotal+=acc.nameplates.material; accLines.push(['Engraved nameplates','Allowance',acc.nameplates.material]); }
  if(inputs.acc.key_interlock){ accTotal+=acc.key_interlock.material; accLines.push(['Key interlock','Allowance',acc.key_interlock.material]); }
  return { base: price, accessories: accTotal, accLines };
}

function shippingCost(cfg, inputs, weight){
  const L = cfg.logistics;
  const mode = inputs.shipMode;
  const spec = mode==='Barge / Marine'?L.barge : mode==='Bush Air'?L.bush : L.road;
  // Simple blended model: base + per_mile*miles + per_lb*weight
  const cost = spec.base + spec.per_mile * inputs.miles + spec.per_lb * weight;
  return cost;
}

function laborCost(cfg, inputs){
  const L = cfg.labor;
  let mh = L.base_mh + L.per_space_mh * inputs.spaces + L.mounting_mh; // fixed typo
  mh += L.terminations_mh[inputs.phase]||0;
  mh += L.commissioning_mh;
  if(inputs.mainType==='MB') mh += L.main_breaker_mh;
  // Accessory labor
  const acc = currentCfg.accessories;
  if(inputs.acc.ground_bar) mh += acc.ground_bar.labor_mh;
  if(inputs.acc.spd) mh += acc.spd.labor_mh;
  if(inputs.acc.feed_thru) mh += acc.feed_thru.labor_mh;
  if(inputs.acc.subfeed) mh += acc.subfeed.labor_mh;
  if(inputs.acc.nameplates) mh += acc.nameplates.labor_mh;
  if(inputs.acc.key_interlock) mh += acc.key_interlock.labor_mh;
  // Remote/productivity factor
  mh *= inputs.remoteFactor;
  const cost = mh * inputs.laborRate;
  return { mh: mh, cost: cost };
}

function buildItemName(inputs){
  // (Dimension)(Capacity)(Power)(Features) ITEM (Ancillaries)
  const dim = `${inputs.spaces*1.2|0}"x${(inputs.amps>=400?60:42)}`; // rough face dims placeholder
  const capacity = `${inputs.kaic} kAIC`;
  const power = `${inputs.voltage}, ${inputs.phase}Ø`;
  const feats = [inputs.nema, `${inputs.bus} bus`, inputs.mainType==='MB'?`Main breaker ${inputs.amps}A`:`Main lugs ${inputs.amps}A`].join(', ');
  const item = `Panelboard`;
  const anc = Object.entries(inputs.acc).filter(([k,v])=>v).map(([k])=>k.replace('_',' ')).join(', ');
  return `${dim} (${capacity}) (${power}) (${feats}) ${item}${anc?` (${anc})`:''}`;
}

function gatherInputs(){
  return {
    panelType: $('#panelType').value,
    mainType: $('#mainType').value,
    amps: $('#amps').value,
    voltage: $('#voltage').value,
    phase: $('#phase').value,
    spaces: parseInt($('#spaces').value||'0',10),
    bus: $('#bus').value,
    kaic: $('#kaic').value,
    nema: $('#nema').value,
    brandMult: parseFloat($('#brandMult').value||'1'),
    acc: {
      ground_bar: $('#acc_ground').checked,
      spd: $('#acc_spd').checked,
      feed_thru: $('#acc_feedthru').checked,
      subfeed: $('#acc_subfeed').checked,
      nameplates: $('#acc_nameplates').checked,
      key_interlock: $('#acc_keyinterlock').checked
    },
    shipMode: $('#shipMode').value,
    miles: parseFloat($('#miles').value||'0'),
    remoteFactor: parseFloat($('#remoteFactor').value||'1'),
    handlingPct: parseFloat($('#handlingPct').value||'0'),
    laborRate: parseFloat($('#laborRate').value||'96'),
  };
}

function calculate(){
const inputs = gatherInputs();
const mat = materialPrice(currentCfg, inputs);
const weight = estimateWeight(currentCfg, inputs);
const ship = shippingCost(currentCfg, inputs, weight);
const handling = (mat.base + mat.accessories) * inputs.handlingPct;
const labor = laborCost(currentCfg, inputs);


const tbody = $('#breakdown tbody');
tbody.innerHTML = '';
const lines = [];
lines.push(['Base panel (enclosure, bus, rating, spec mult.)', `${inputs.panelType}, ${inputs.nema}, ${inputs.bus}, ${inputs.amps}A, kAIC ${inputs.kaic}`, mat.base]);
mat.accLines.forEach(l=>lines.push(l));
lines.forEach(([label,basis,cost])=>{
const tr = document.createElement('tr');
tr.innerHTML = `<td>${label}</td><td>${basis}</td><td class="right">${fmt(cost)}</td>`;
tbody.appendChild(tr);
});


const matSubtotal = mat.base + mat.accessories;
$('#matSubtotal').textContent = fmt(matSubtotal);
$('#shipping').textContent = fmt(ship);
$('#handling').textContent = fmt(handling);


// Add man hours to labor basis output
const laborBasis = `${labor.mh.toFixed(2)} MH @ $${inputs.laborRate.toFixed(0)}/hr`;
const laborCell = document.querySelector('#breakdown tfoot tr:nth-child(4) td:nth-child(2)');
if (laborCell) {
laborCell.textContent = laborBasis;
}
$('#labor').textContent = fmt(labor.cost);


const grand = matSubtotal + ship + handling + labor.cost;
$('#grandTotal').textContent = fmt(grand);
$('#itemName').textContent = buildItemName(inputs);


// Assumptions
const asm = $('#assumptions');
asm.innerHTML = '';
const assumptions = [
'Material pricing is ROM and configurable in the Pricing Config panel.',
`Logistics mode: ${inputs.shipMode}; miles: ${inputs.miles}; estimated ship weight ${weight.toFixed(0)} lb.`,
`Handling applied at ${(inputs.handlingPct*100).toFixed(1)}% of material subtotal.`,
`Electrical labor rate: $${inputs.laborRate.toFixed(0)}/hr; Remote/productivity factor: ${inputs.remoteFactor.toFixed(2)}.`,
`Total labor man hours: ${labor.mh.toFixed(2)} MH.`,
'Labor model includes mounting, terminations, labeling, and basic commissioning. Conduit/wiring not included.',
'Final price subject to submittals, manufacturer, lead time, and exact accessories specified by the drawings.',
];
assumptions.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; asm.appendChild(li); });
}

// --- Self‑tests ---
function runTests(){
  const out = $('#testResults');
  out.innerHTML = '';
  let pass = 0, total = 0;
  function t(name, fn){
    total++;
    try{ const msg = fn() || 'ok';
      pass++; add(name, true, msg);
    }catch(e){ add(name, false, e.message); }
  }
  function add(name, ok, msg){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${total}</td><td>${name}</td><td>${ok?'<span class="badge ok">PASS</span>':'<span class="badge fail">FAIL</span>'}</td><td>${msg}</td>`;
    out.appendChild(tr);
  }

  // Test 1: helper availability
  t('Helpers $ and $$ exist', ()=>{ if(typeof $!=='function' || typeof $$!=='function') throw new Error('helpers missing'); });

  // Test 2: baseline calculation produces numeric totals
  t('Baseline calculate() runs', ()=>{
    calculate();
    const gt = $('#grandTotal').textContent; if(!gt || gt.indexOf('$')===-1) throw new Error('no total');
  });

  // Test 3: shipping increases with miles (holding other factors constant)
  t('Shipping increases with distance', ()=>{
    const milesEl = $('#miles');
    const orig = milesEl.value;
    milesEl.value = 10; calculate(); const s1 = $('#shipping').textContent;
    milesEl.value = 300; calculate(); const s2 = $('#shipping').textContent;
    milesEl.value = orig; calculate();
    const n1 = Number(s1.replace(/[^0-9.]/g,''));
    const n2 = Number(s2.replace(/[^0-9.]/g,''));
    if(!(n2>n1)) throw new Error(`expected s2> s1, got ${n1} vs ${n2}`);
  });

  // Test 4: copper bus should increase materials vs aluminum (same other inputs)
  t('Copper bus increases material price', ()=>{
    const busEl = $('#bus');
    const orig = busEl.value;
    busEl.value = 'Aluminum'; calculate(); const m1 = Number($('#matSubtotal').textContent.replace(/[^0-9.]/g,''));
    busEl.value = 'Copper'; calculate(); const m2 = Number($('#matSubtotal').textContent.replace(/[^0-9.]/g,''));
    busEl.value = orig; calculate();
    if(!(m2>m1)) throw new Error(`expected copper>aluminum, got ${m1} vs ${m2}`);
  });

  // Test 5: remote factor scales labor cost
  t('Remote factor scales labor', ()=>{
    const rf = $('#remoteFactor'); const orig = rf.value;
    rf.value = 1.0; calculate(); const l1 = Number($('#labor').textContent.replace(/[^0-9.]/g,''));
    rf.value = 1.5; calculate(); const l2 = Number($('#labor').textContent.replace(/[^0-9.]/g,''));
    rf.value = orig; calculate();
    if(!(l2>l1)) throw new Error(`expected labor to increase with remote factor, got ${l1} vs ${l2}`);
  });

  const summary = $('#testSummary');
  summary.textContent = `${pass}/${total} tests passed`;
  summary.className = 'badge ' + (pass===total? 'ok':'fail');
}

// Events
$('#calcBtn').addEventListener('click', calculate);
$('#resetBtn').addEventListener('click', ()=>{
  localStorage.removeItem('panel_calc_cfg');
  currentCfg = structuredClone(defaultConfig);
  loadConfigToEditor();
  // Clear checkboxes & reset some inputs to defaults
  $('#acc_ground').checked = false;
  $('#acc_spd').checked = false;
  $('#acc_feedthru').checked = false;
  $('#acc_subfeed').checked = false;
  $('#acc_nameplates').checked = false;
  $('#acc_keyinterlock').checked = false;
  calculate();
});
$('#loadCfg').addEventListener('click', ()=>{
  try {
    currentCfg = JSON.parse(cfgArea.value);
    localStorage.setItem('panel_calc_cfg', JSON.stringify(currentCfg));
    alert('Config loaded.');
  } catch(e){ alert('Invalid JSON.'); }
});
$('#exportCfg').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(currentCfg, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'panel_pricing_config.json';
  a.click();
});
$('#importCfg').addEventListener('click', ()=>{
  const file = $('#importCfgFile').files[0]; if(!file) return alert('Choose a JSON file first.');
  const reader = new FileReader();
  reader.onload = e=>{
    try { currentCfg = JSON.parse(e.target.result); loadConfigToEditor(); localStorage.setItem('panel_calc_cfg', JSON.stringify(currentCfg)); alert('Config imported.'); } catch(err){ alert('Invalid JSON'); }
  };
  reader.readAsText(file);
});
$('#runTests').addEventListener('click', runTests);

// First paint
try{ calculate(); }catch(e){ console.error(e); }
