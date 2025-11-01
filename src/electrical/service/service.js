// -----------------------------
// NEC DATA (subset) & HELPERS
// -----------------------------
const NEC = {
  // Ampacity base tables at 60/75/90°C (A) for Cu THHN/THWN-2 and Al XHHW-2 (subset common sizes)
  ampacity: {
    CU: {
      // size: {60: A, 75: A, 90: A}
      "14":{60:15,75:20,90:25},
      "12":{60:20,75:25,90:30},
      "10":{60:30,75:35,90:40},
      "8": {60:40,75:50,90:55},
      "6": {60:55,75:65,90:75},
      "4": {60:70,75:85,90:95},
      "3": {60:85,75:100,90:110},
      "2": {60:95,75:115,90:130},
      "1": {60:110,75:130,90:150},
      "1/0":{60:125,75:150,90:170},
      "2/0":{60:145,75:175,90:195},
      "3/0":{60:165,75:200,90:225},
      "4/0":{60:195,75:230,90:260},
      "250":{60:215,75:255,90:290},
      "300":{60:240,75:285,90:320},
      "350":{60:260,75:310,90:350},
      "400":{60:280,75:335,90:380},
      "500":{60:320,75:380,90:430},
      "600":{60:355,75:420,90:475},
      "700":{60:385,75:460,90:520},
      "750":{60:400,75:475,90:535},
      "800":{60:410,75:490,90:555},
      "900":{60:435,75:520,90:585},
      "1000":{60:455,75:545,90:615},
    },
    AL: {
      "12":{60:15,75:20,90:25},
      "10":{60:20,75:25,90:30},
      "8": {60:25,75:30,90:35},
      "6": {60:30,75:40,90:45},
      "4": {60:40,75:55,90:65},
      "2": {60:50,75:75,90:90},
      "1": {60:55,75:85,90:95},
      "1/0":{60:65,75:100,90:120},
      "2/0":{60:75,75:115,90:135},
      "3/0":{60:85,75:130,90:155},
      "4/0":{60:95,75:150,90:180},
      "250":{60:110,75:170,90:205},
      "300":{60:120,75:185,90:230},
      "350":{60:135,75:200,90:250},
      "400":{60:145,75:210,90:270},
      "500":{60:165,75:230,90:310},
      "600":{60:180,75:250,90:340},
      "700":{60:200,75:275,90:375},
      "750":{60:205,75:285,90:385},
      "800":{60:210,75:290,90:400},
      "900":{60:225,75:305,90:415},
      "1000":{60:235,75:320,90:430},
    }
  },
  // Conductor areas (in^2) from Chapter 9, Tbl 5 (approx THHN/XHHW-2 insulation dims, subset)
  condArea: {
    CU: {
      "14":0.0133, "12":0.0209, "10":0.0331, "8":0.0507, "6":0.0824, "4":0.1333, "3":0.1672,
      "2":0.2116, "1":0.2668, "1/0":0.3320, "2/0":0.4040, "3/0":0.4840, "4/0":0.5720,
      "250":0.7070, "300":0.8170, "350":0.9510, "400":1.0690, "500":1.3250, "600":1.5850,
      "700":1.8450, "750":1.9750, "800":2.1000, "900":2.3600, "1000":2.6200
    },
    AL: {
      "12":0.0264, "10":0.0333, "8":0.053, "6":0.085, "4":0.132, "2":0.211, "1":0.252,
      "1/0":0.31, "2/0":0.38, "3/0":0.45, "4/0":0.53, "250":0.66, "300":0.77, "350":0.89,
      "400":1.00, "500":1.26, "600":1.47, "700":1.68, "750":1.78, "800":1.90, "900":2.15,
      "1000":2.40
    }
  },
  // Raceway internal area (in^2) — Chapter 9, Tbl 4 (subset common sizes)
  racewayArea: {
    EMT: { "1/2":0.304, "3/4":0.533, "1":0.864, "1-1/4":1.496, "1-1/2":2.036, "2":3.356, "2-1/2":5.858, "3":8.864, "3-1/2":11.494, "4":14.753 },
    RMC: { "1/2":0.285, "3/4":0.533, "1":0.864, "1-1/4":1.496, "1-1/2":2.036, "2":3.356, "2-1/2":5.858, "3":8.864, "3-1/2":11.494, "4":14.753 },
    PVC40: { "1/2":0.233, "3/4":0.409, "1":0.647, "1-1/4":1.102, "1-1/2":1.590, "2":2.619, "2-1/2":4.321, "3":6.530, "3-1/2":8.632, "4":11.042 },
    PVC80: { "1/2":0.146, "3/4":0.266, "1":0.442, "1-1/4":0.780, "1-1/2":1.131, "2":1.832, "2-1/2":3.069, "3":4.580, "3-1/2":6.176, "4":7.978 }
  },
  // Maximum fill fraction for >2 conductors: 40%
  maxFill: 0.40,
  // Ambient correction factors (90°C insulation applied then limited by terminal rating) — simplified
  ambientFactors: [
    { tMax: 25, factor: 1.08 },
    { tMax: 30, factor: 1.00 },
    { tMax: 35, factor: 0.94 },
    { tMax: 40, factor: 0.87 },
    { tMax: 45, factor: 0.82 },
    { tMax: 50, factor: 0.75 },
  ],
  // CCC (current-carrying conductors in a raceway) adjustment factors — simplified per NEC 310.15(C)(1)
  cccFactors: [
    { max: 3, factor: 1.00 },
    { max: 6, factor: 0.80 },
    { max: 9, factor: 0.70 },
    { max: 20, factor: 0.50 },
    { max: 30, factor: 0.45 },
    { max: 40, factor: 0.40 },
    { max: 100, factor: 0.35 },
  ],
  // EGC sizing by OCPD (A) per NEC 250.122 (subset; copper sizes)
  egcByOCPD: [
    { maxOCPD: 15, size: "14" },
    { maxOCPD: 20, size: "12" },
    { maxOCPD: 60, size: "10" },
    { maxOCPD: 100, size: "8" },
    { maxOCPD: 200, size: "6" },
    { maxOCPD: 300, size: "4" },
    { maxOCPD: 400, size: "3" },
    { maxOCPD: 500, size: "2" },
    { maxOCPD: 600, size: "1" },
    { maxOCPD: 800, size: "1/0" },
    { maxOCPD: 1000, size: "2/0" },
    { maxOCPD: 1200, size: "3/0" },
    { maxOCPD: 1600, size: "4/0" },
    { maxOCPD: 2000, size: "250" },
  ],
  // DC resistances @ 75°F (ohms/1000ft) — approximate
  resist75: {
    CU: { "14":3.14, "12":1.98, "10":1.24, "8":0.778, "6":0.491, "4":0.308, "3":0.245, "2":0.194, "1":0.154,
      "1/0":0.122, "2/0":0.0967, "3/0":0.0766, "4/0":0.0608, "250":0.051, "300":0.0426, "350":0.0366, "400":0.0322, "500":0.0258, "600":0.0216, "700":0.0185, "750":0.0172, "800":0.0162, "900":0.0144, "1000":0.0129 },
    AL: { "12":3.18, "10":2.00, "8":1.26, "6":0.795, "4":0.500, "2":0.321, "1":0.255,
      "1/0":0.202, "2/0":0.160, "3/0":0.127, "4/0":0.101, "250":0.086, "300":0.072, "350":0.062, "400":0.055, "500":0.044, "600":0.037, "700":0.032, "750":0.030, "800":0.028, "900":0.025, "1000":0.023 }
  }
};

const sizesOrder = ["14","12","10","8","6","4","3","2","1","1/0","2/0","3/0","4/0","250","300","350","400","500","600","700","750","800","900","1000"];
const racewayOrder = ["1/2","3/4","1","1-1/4","1-1/2","2","2-1/2","3","3-1/2","4"];

// Populate manual EGC dropdown
(function initEGCManual(){
  const egcSel = document.getElementById('egcManual');
  egcSel.innerHTML = sizesOrder.map(s=>`<option value="${s}">${s}</option>`).join('');
})();

// Show/hide EGC manual
const egcMode = document.getElementById('egcMode');
const egcManualRow = document.getElementById('egcManualRow');
egcMode.addEventListener('change',()=>{
  egcManualRow.classList.toggle('hide', egcMode.value !== 'manual');
});

// Helper lookups
function ambientFactor(t){
  for(const row of NEC.ambientFactors){ if(t <= row.tMax) return row.factor; }
  return NEC.ambientFactors[NEC.ambientFactors.length-1].factor;
}
function cccFactor(n){
  for(const row of NEC.cccFactors){ if(n <= row.max) return row.factor; }
  return NEC.cccFactors[NEC.cccFactors.length-1].factor;
}
function egcSizeByOCPD(oc){
  for(const row of NEC.egcByOCPD){ if(oc <= row.maxOCPD) return row.size; }
  return "250"; // max of subset
}

// Compute derated ampacity of a given size
function deratedAmpacity({mat, size, termTemp, ambient, ccc}){
  const base = NEC.ampacity[mat][size];
  if(!base) return 0;
  // Start with 90C ampacity for adjustment, then limit by selected terminal temp
  const adjBase = base[90];
  let factor = ambientFactor(ambient) * cccFactor(ccc);
  const adjusted = adjBase * factor;
  // Limit by termination temp column
  const limit = base[parseInt(termTemp,10)];
  return Math.min(adjusted, limit);
}

// Find minimum conductor size meeting target amps
function pickConductor({mat, amps, termTemp, ambient, ccc}){
  for(const s of sizesOrder){
    if(!NEC.ampacity[mat][s]) continue;
    const der = deratedAmpacity({mat, size:s, termTemp, ambient, ccc});
    if(der >= amps) return { size:s, derated:der };
  }
  return { size: null, derated: 0 };
}

// Conduit fill calculation: choose smallest raceway with fill <=40%
function pickRaceway({type, conductors}){
  // conductors: array of { mat, size, qty }
  const totalArea = conductors.reduce((a,c)=>{
    const ar = NEC.condArea[c.mat][c.size] || 0; return a + ar * c.qty;
  },0);
  const limitFrac = NEC.maxFill;
  for(const r of racewayOrder){
    const area = NEC.racewayArea[type][r];
    if(!area) continue;
    if(totalArea <= area * limitFrac){
      return { tradeSize:r, fill: totalArea / area };
    }
  }
  // If none fits, return largest with overfill indication
  const last = racewayOrder[racewayOrder-1];
  const area = NEC.racewayArea[type][last];
  return { tradeSize:last, fill: totalArea / area };
}

// Voltage drop (approx). Single set; parallel sets reduce R.
function voltageDropPct({system, mat, size, lengthFt, amps, sets}){
  const RperK = NEC.resist75[mat][size];
  if(!RperK) return null;
  const R = (RperK/1000) * lengthFt / sets; // ohms
  const is1P = system.startsWith('1P');
  // Using simplified VD: V_drop = 2 * I * R (1Ø) ; 1.732*I*R (3Ø)
  const multiplier = is1P ? 2 : 1.732;
  const Vsys = system.includes('208')?208:(system.includes('480')?480:240);
  const V_drop = multiplier * amps * R;
  return (V_drop / Vsys) * 100;
}

// Material costs (user can enter $/ft globally; in practice price by size varies)
function materialCost({cuPerFt, condLenFt, conduitPerFt, conduitLenFt}){
  const wireCost = cuPerFt * condLenFt; // if user wants, set per-size later
  const condCost = conduitPerFt * conduitLenFt;
  return { wireCost, condCost, total: wireCost + condCost };
}

// Labor calculations (very simplified NECA-like units; editable)
function laborCalc({lengthFt, sets, condQtyPerSet, unitWirePull, unitConduit, rate, remote}){
  const wireHrs = (unitWirePull/100) * lengthFt * condQtyPerSet * sets; // hr
  const condHrs = (unitConduit/100) * lengthFt; // hr
  const totalHrs = (wireHrs + condHrs) * remote;
  const cost = totalHrs * rate;
  return { wireHrs, condHrs, totalHrs, cost };
}

function fmtMoney(n){ return n===null?"—":`$${n.toLocaleString(undefined,{maximumFractionDigits:0})}` }
function pct(p){ return `${(p*100).toFixed(1)}%` }

// MAIN CALC
function calculate(){
  const system = document.getElementById('system').value;
  const termTemp = parseInt(document.getElementById('termTemp').value,10);
  const condMat = document.getElementById('condMat').value; // CU/AL
  const lengthFt = parseFloat(document.getElementById('lengthFt').value||0);
  const amps = parseFloat(document.getElementById('ampacityTarget').value||0);
  const ccc = parseInt(document.getElementById('ccc').value||3,10);
  const ambient = parseFloat(document.getElementById('ambient').value||30);
  const neutralMode = document.getElementById('neutral').value;
  const egcModeVal = document.getElementById('egcMode').value;
  const ocpd = parseInt(document.getElementById('ocpd').value||0,10);
  const sets = Math.max(1, parseInt(document.getElementById('sets').value||1,10));
  const conduitType = document.getElementById('conduitType').value;
  const vdLimit = parseFloat(document.getElementById('vdLimit').value||3);
  const cuCost = parseFloat(document.getElementById('cuCost').value||0);
  const conduitCost = parseFloat(document.getElementById('conduitCost').value||0);
  const rate = parseFloat(document.getElementById('laborRate').value||96);
  const unitWirePull = parseFloat(document.getElementById('unitWirePull').value||0.8);
  const unitConduit = parseFloat(document.getElementById('unitConduit').value||9.5);
  const remote = parseFloat(document.getElementById('remoteFactor').value||1.0);
  const opPct = parseFloat(document.getElementById('opPct').value||0)/100;

  // Pick conductor size per set
  const pick = pickConductor({mat:condMat, amps, termTemp, ambient, ccc});
  if(!pick.size){ alert('No conductor size in table meets the target ampacity with current derating. Try parallel sets or reduce amps.'); return; }

  // Neutral & EGC sizes
  const neutral = (neutralMode==='none')? null : (neutralMode==='reduced'? sizesOrder[Math.max(0, sizesOrder.indexOf(pick.size)-1)] : pick.size);
  const egcSize = egcModeVal==='manual' ? document.getElementById('egcManual').value : egcSizeByOCPD(ocpd);

  // Conductor list per set
  let perSet = [ {mat:condMat, size:pick.size, qty:3} ]; // A,B,C
  if(system.includes('Y') || system.startsWith('1P')){
    if(neutral) perSet.push({mat:condMat, size:neutral, qty:1});
  }
  // Equipment Ground (assume CU EGC regardless of phase conductor material; common practice)
  perSet.push({mat:'CU', size:egcSize, qty:1});

  // Raceway pick (per set)
  const race = pickRaceway({type:conduitType, conductors:perSet});

  // Voltage drop (use phase conductor size)
  const vd = voltageDropPct({system, mat:condMat, size:pick.size, lengthFt, amps, sets});

  // Takeoff table
  const tbody = document.querySelector('#takeoffTbl tbody');
  tbody.innerHTML = '';
  const pushRow = (item,size,qty,unit,len,notes='')=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item}</td><td>${size}</td><td>${qty}</td><td>${unit}</td><td>${len}</td><td class="small">${notes}</td>`;
    tbody.appendChild(tr);
  };

  const totalCondLen = lengthFt * sets; // per conductor length times sets (one run)
  // Phase conductors (3 per set)
  pushRow(`${condMat} THHN/XHHW‑2 Conductor`, pick.size, 3*sets, 'ea', lengthFt, 'Phase A/B/C');
  if(neutral) pushRow(`${condMat} Neutral`, neutral, 1*sets, 'ea', lengthFt, 'Neutral');
  pushRow(`CU Equipment Ground (EGC)`, egcSize, 1*sets, 'ea', lengthFt, 'NEC 250.122');
  // Conduit
  pushRow(`${conduitType} Conduit`, race.tradeSize, sets, 'ea', lengthFt, `Fill ${(race.fill*100).toFixed(1)}%`);

  // Totals for cost
  const conductorCountPerSet = perSet.reduce((a,c)=>a+c.qty,0);
  const condQtyAll = conductorCountPerSet * sets;
  const condLenAll = lengthFt * condQtyAll; // ft of wire total
  const conduitLenAll = lengthFt * sets;

  const mat = materialCost({ cuPerFt: cuCost, condLenFt: condLenAll, conduitPerFt: conduitCost, conduitLenFt: conduitLenAll });
  const labor = laborCalc({ lengthFt, sets, condQtyPerSet: conductorCountPerSet, unitWirePull, unitConduit, rate, remote });
  const subtotal = mat.total + labor.cost;
  const grand = subtotal * (1+opPct);

  // UI chips
  document.getElementById('selWire').textContent = `${condMat} ${pick.size}`;
  document.getElementById('selSets').textContent = sets;
  document.getElementById('selConduit').textContent = `${conduitType} ${race.tradeSize}`;
  const fillPct = (race.fill*100).toFixed(1);
  document.getElementById('fillPct').innerHTML = (race.fill<=NEC.maxFill?`<span class="ok">${fillPct}% OK</span>`:`<span class="bad">${fillPct}% OVER</span>`);
  document.getElementById('derAmp').textContent = `${pick.derated.toFixed(0)} A`;
  const vdTxt = vd==null? '—' : `${vd.toFixed(2)}% ${vd>vdLimit? '⚠️' : 'OK'}`;
  document.getElementById('vd').innerHTML = vdTxt;

  // Labor & cost
  document.getElementById('hrsWire').textContent = labor.wireHrs.toFixed(1);
  document.getElementById('hrsCond').textContent = labor.condHrs.toFixed(1);
  document.getElementById('hrsTot').textContent = labor.totalHrs.toFixed(1);
  document.getElementById('laborCost').textContent = fmtMoney(labor.cost);
  document.getElementById('matCost').textContent = fmtMoney(mat.total);
  document.getElementById('adjFactors').textContent = `Remote × O&P = ${(remote).toFixed(2)} × ${(opPct*100).toFixed(0)}%`;
  document.getElementById('grand').innerHTML = `<strong>${fmtMoney(grand)}</strong>`;
}

// Export JSON of current scenario
function exportJSON(){
  const data = {
    ts: new Date().toISOString(),
    inputs: {
      system: document.getElementById('system').value,
      termTemp: document.getElementById('termTemp').value,
      condMat: document.getElementById('condMat').value,
      lengthFt: document.getElementById('lengthFt').value,
      amps: document.getElementById('ampacityTarget').value,
      ccc: document.getElementById('ccc').value,
      ambient: document.getElementById('ambient').value,
      neutral: document.getElementById('neutral').value,
      egcMode: document.getElementById('egcMode').value,
      ocpd: document.getElementById('ocpd').value,
      sets: document.getElementById('sets').value,
      conduitType: document.getElementById('conduitType').value,
      vdLimit: document.getElementById('vdLimit').value,
      prices: { cuPerFt: document.getElementById('cuCost').value, conduitPerFt: document.getElementById('conduitCost').value },
      labor: {
        rate: document.getElementById('laborRate').value,
        unitWirePull: document.getElementById('unitWirePull').value,
        unitConduit: document.getElementById('unitConduit').value,
        remoteFactor: document.getElementById('remoteFactor').value,
        opPct: document.getElementById('opPct').value
      }
    }
  };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `electrical_calc_${Date.now()}.json`;
  a.click();
}

// Reset
function resetAll(){
  document.getElementById('system').value='3P-208Y_120';
  document.getElementById('termTemp').value='75';
  document.getElementById('condMat').value='CU';
  document.getElementById('lengthFt').value='200';
  document.getElementById('ampacityTarget').value='200';
  document.getElementById('ccc').value='3';
  document.getElementById('ambient').value='30';
  document.getElementById('neutral').value='full';
  document.getElementById('egcMode').value='auto';
  egcManualRow.classList.add('hide');
  document.getElementById('ocpd').value='225';
  document.getElementById('sets').value='1';
  document.getElementById('conduitType').value='EMT';
  document.getElementById('vdLimit').value='3';
  document.getElementById('cuCost').value='0';
  document.getElementById('conduitCost').value='0';
  document.getElementById('laborRate').value='96';
  document.getElementById('unitWirePull').value='0.8';
  document.getElementById('unitConduit').value='9.5';
  document.getElementById('remoteFactor').value='1.15';
  document.getElementById('opPct').value='15';
  calculate();
}

// NEC dump
function dumpNEC(){
  const d = {
    ampacity: NEC.ampacity,
    condArea: NEC.condArea,
    racewayArea: NEC.racewayArea,
    ambientFactors: NEC.ambientFactors,
    cccFactors: NEC.cccFactors,
    egcByOCPD: NEC.egcByOCPD
  };
  document.getElementById('necDump').textContent = JSON.stringify(d,null,2);
}

// Wire events
['calcBtn','exportBtn','resetBtn'].forEach(id=>{
  const el = document.getElementById(id);
  el && el.addEventListener('click',()=>{
    if(id==='calcBtn') calculate();
    if(id==='exportBtn') exportJSON();
    if(id==='resetBtn') resetAll();
  });
});

// update header rate chip
document.getElementById('laborRate').addEventListener('input', (e)=>{
  document.getElementById('anchRate').textContent = e.target.value || '—';
});

// Init
dumpNEC();
calculate();
