/*
  NEW:
  - Trade presets change vocab for ITEM / FEATURE detection
  - Export CSV+JSON of the generated line item

  Still does auto-parse of fuzzy text.
*/

// --- helpers ------------------------------------------------------

function capitalizeFirst(str) {
  if (!str) return "";
  return str
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

// trade-aware vocabulary
const TRADE_DICTIONARIES = {
  mechanical: {
    items: [
      "diffuser","register","grille","fan","pump","thermostat",
      "valve","convector","drain","heat trace","floor drain",
      "snow melt","panel radiator","vav box","air handler"
    ],
    features: [
      "schedule","sch","steel","stainless",
      "4-way","4 way","4-way throw","4 way throw",
      "insulated","surface mounted","surface-mount","surface mount",
      "wall mount","floor mount","trap primer","commercial controls",
      "btuh","btu","cfm","gpm","psi rating"
    ],
  },
  electrical: {
    items: [
      "charger","pedestal","panel","conduit","receptacle","luminaire",
      "light","lighting","ev charger","distribution panel",
      "outlet","duplex","ct4000","control panel"
    ],
    features: [
      "surface mounted","surface mount","weatherproof","nema",
      "outdoor rated","pole mounted","pole-mount","floor mount",
      "120v","208v","240v","277v","480v","50a","15a","20a"
    ],
  },
  site: {
    items: [
      "bench","bike rack","trash can","fire bowl",
      "table","chair","set","patio set","enclosure"
    ],
    features: [
      "yellow cedar","cedar","stacked timber","stacked timbers",
      "locally sourced","surface mounted","surface mount",
      "bar height","ada compliant","battery cafe","foro",
      "commercial controls","portable","propane"
    ],
  }
};

// fallback if unknown trade
const DEFAULT_TRADE = "mechanical";

// regex patterns for categories
const dimensionRegexes = [
  /(\d+['"]?\s?x\s?\d+['"]?\s?x\s?\d+['"]?)/i,
  /(\d+['"]?\s?x\s?\d+['"]?)/i,
  /(\d+(\.\d+)?\s?(inch|in\.?|"))/i,
  /(\d+(\.\d+)?\s?ft\b|\d+(\.\d+)?\s?lf\b)/i
];

const capacityRegexes = [
  /(\d+(\.\d+)?\s?(btu\/lf|btu|cfm|gpm|kw|w\/ft|w\/lf))/i,
  /(\d+(\.\d+)?\s?(cfm|gpm|l\/s))/i
];

const powerRegexes = [
  /(\d+(\.\d+)?\s?(v|volt|volts))/i,
  /(\d+(\.\d+)?\s?(hp|horsepower))/i,
  /(\d+(\.\d+)?\s?(a|amp|amps))/i
];

function splitAncillaries(str) {
  const m = str.match(/\b(with|including|incl\.?|w\/)\b(.*)$/i);
  if (m) {
    return {
      base: str.slice(0, m.index).trim(),
      anc: m[2].trim()
    };
  }
  return { base: str.trim(), anc: "" };
}

function findFirstRegex(str, list) {
  for (const r of list) {
    const m = str.match(r);
    if (m) return m[0].trim();
  }
  return "";
}

function stripFragment(str, frag) {
  if (!frag) return str;
  const esc = frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp(esc,'i')," ").replace(/\s+/g," ").trim();
}

function guessItem(str, tradeDict) {
  let lower = str.toLowerCase();
  const sorted = [...tradeDict.items].sort((a,b)=>b.length-a.length);
  for (const w of sorted) {
    if (lower.includes(w)) {
      return w;
    }
  }
  return "";
}

function guessFeatures(str, tradeDict) {
  let feats = [];
  let lower = str.toLowerCase();
  for (const f of tradeDict.features) {
    if (lower.includes(f)) feats.push(f);
  }
  feats = [...new Set(feats)];
  return feats.join(", ");
}

function buildLineItem(dim, cap, pow, feat, item, anc) {
  function fixSegment(x) {
    return x
      .split(",")
      .map(s => s.trim())
      .map(s => {
        if (/[A-Z]{2,}/.test(s)) return s;
        return capitalizeFirst(s);
      })
      .join(", ");
  }
  const parts = [];
  if (dim) parts.push(fixSegment(dim));
  if (cap) parts.push(fixSegment(cap));
  if (pow) parts.push(fixSegment(pow));
  if (feat) parts.push(fixSegment(feat));
  let main = parts.join(", ");
  if (item) {
    main += (main ? " " : "") + capitalizeFirst(item);
  }
  if (anc) {
    main += " " + "(" + capitalizeFirst(anc) + ")";
  }
  return main.trim();
}

function toCSV(rows) {
  const header = ["lineItem","notes","date","initials"];
  const csvLines = [header.join(",")];
  for (const r of rows) {
    const line = [
      r.lineItem ?? "",
      r.notes ?? "",
      r.date ?? "",
      r.initials ?? ""
    ].map(f => `"${String(f).replace(/"/g,'""')}"`).join(",");
    csvLines.push(line);
  }
  return csvLines.join("\n");
}

function downloadFile(filename, content, mimeType="text/plain") {
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function rerunIfReady() {
  const txt = fuzzyInputEl.value.trim();
  if (!txt) return;
  if (CRF_LOADED && window.CRFTagger && window.CRFTagger.autoParseIntoUI) {
    const t = tradeSelectEl.value || DEFAULT_TRADE;
    const d = divisionSelectEl ? (divisionSelectEl.value || "") : "";
    window.CRFTagger.autoParseIntoUI(txt, t, d).then(()=>{
      appendValidationMessages();
    }).catch(()=>{});
  }
}

const fuzzyInputEl       = document.getElementById("fuzzyInput");
const dimensionFieldEl   = document.getElementById("dimensionField");
const capacityFieldEl    = document.getElementById("capacityField");
const powerFieldEl       = document.getElementById("powerField");
const featuresFieldEl    = document.getElementById("featuresField");
const itemFieldEl        = document.getElementById("itemField");
const ancillariesFieldEl = document.getElementById("ancillariesField");
const finalStringEl      = document.getElementById("finalString");
const notesFieldEl       = document.getElementById("notesField");
const tradeSelectEl      = document.getElementById("tradeSelect");
const divisionSelectEl    = document.getElementById("divisionSelect");

const autoParseBtn = document.getElementById("autoParseBtn");
const generateBtn  = document.getElementById("generateBtn");
const copyBtn      = document.getElementById("copyBtn");
const clearBtn     = document.getElementById("clearBtn");
const copiedBadge  = document.getElementById("copiedBadge");
const exportBtn    = document.getElementById("exportBtn");

let exportLog = [];

let CRF_LOADED = false;
function loadCRF() {
  if (CRF_LOADED && window.CRFTagger) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './crf_tagger.js';
    s.async = true;
    s.onload = () => { CRF_LOADED = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load CRF tagger'));
    document.head.appendChild(s);
  });
}

function fallbackAutoParse() {
  const fuzzy = fuzzyInputEl.value.trim();
  if (!fuzzy) return;
  const tradeKey = tradeSelectEl.value || DEFAULT_TRADE;
  const tradeDict = TRADE_DICTIONARIES[tradeKey] || TRADE_DICTIONARIES[DEFAULT_TRADE];
  let { base, anc } = splitAncillaries(fuzzy);
  const dim = findFirstRegex(base, dimensionRegexes);
  base = stripFragment(base, dim);
  const cap = findFirstRegex(base, capacityRegexes);
  base = stripFragment(base, cap);
  const pow = findFirstRegex(base, powerRegexes);
  base = stripFragment(base, pow);
  const itemGuess = guessItem(base, tradeDict);
  const featGuess = guessFeatures(base, tradeDict);
  let cleanedBase = base;
  if (itemGuess) cleanedBase = stripFragment(cleanedBase, itemGuess);
  dimensionFieldEl.value   = (dim||'').replace(/\s+/g," ").trim();
  capacityFieldEl.value    = (cap||'').replace(/\s+/g," ").trim();
  powerFieldEl.value       = (pow||'').replace(/\s+/g," ").trim();
  featuresFieldEl.value    = (featGuess || cleanedBase).trim();
  itemFieldEl.value        = itemGuess;
  ancillariesFieldEl.value = anc;
  const dVal  = dimensionFieldEl.value.trim();
  const cVal  = capacityFieldEl.value.trim();
  const pVal  = powerFieldEl.value.trim();
  const fVal = featuresFieldEl.value.trim();
  const iVal = itemFieldEl.value.trim();
  const aVal  = ancillariesFieldEl.value.trim();
  finalStringEl.value = buildLineItem(dVal, cVal, pVal, fVal, iVal, aVal);
  appendValidationMessages();
}

async function populateDomainSelectors() {
  try {
    const r = await fetch('./translator_artifacts/gazetteers/manifest.json');
    if (!r.ok) return;
    const manifest = await r.json();
    const seen = new Set(Array.from(tradeSelectEl.options).map(o=>o.value));
    const trades = (manifest.trades||[]).filter(Boolean).filter(t=>!seen.has(t)).sort();
    for (const t of trades) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.replace(/_/g,' ');
      tradeSelectEl.appendChild(opt);
    }
    if (divisionSelectEl) {
      const seenD = new Set(Array.from(divisionSelectEl.options).map(o=>o.value));
      const divs = (manifest.divisions||[]).filter(Boolean).filter(d=>!seenD.has(d)).sort();
      for (const d of divs) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        divisionSelectEl.appendChild(opt);
      }
    }
  } catch (e) {}
}

let ROUTING_MAPS = null;
let userSetTrade = false;
let userSetDivision = false;

async function ensureRoutingMaps() {
  if (ROUTING_MAPS) return;
  try {
    const r = await fetch('./translator_artifacts/routing_maps.json');
    if (!r.ok) return;
    ROUTING_MAPS = await r.json();
  } catch (e) {}
}

function pickFromKeywords(t) {
  const low = t.toLowerCase();
  const tests = [
    {trade:'electrical', div:'26', k:['voltage','volt','amp','breaker','panel','luminaire','fixture','conduit','receptacle','nema','awg','transformer','switchgear']},
    {trade:'plumbing', div:'22', k:['drain','pipe','valve','fixture','gpm','trap','water heater','sewer','pvc','copper','wc','lav']},
    {trade:'hvac', div:'23', k:['diffuser','duct','cfm','btu','ton','vav','ahu','rtu','grille','register','chiller','boiler']},
    {trade:'fire_protection', div:'21', k:['sprinkler','standpipe','fire pump','riser','fp','heads']},
    {trade:'site', div:'32', k:['bollard','bench','rack','paving','curb','asphalt','concrete','landscape','irrigation','manhole']},
    {trade:'concrete', div:'03', k:['concrete','rebar','formwork','slab','footing']},
    {trade:'masonry', div:'04', k:['brick','block','cmu','masonry']},
    {trade:'metals', div:'05', k:['steel','beam','column','metal','aluminum','handrail']},
    {trade:'openings', div:'08', k:['door','window','glazing','frame','hardware']},
    {trade:'finishes', div:'09', k:['paint','drywall','tile','flooring','ceiling','gypsum']},
  ];
  let best=null,score=0;
  for (const tset of tests) {
    let s=0; for (const kw of tset.k) if (low.includes(kw)) s++;
    if (s>score) { score=s; best=tset; }
  }
  return score>0 ? best : null;
}

async function autoPreselectFromText() {
  await ensureRoutingMaps();
  const txt = fuzzyInputEl.value.trim();
  if (!txt || !ROUTING_MAPS) return;
  const csi = ROUTING_MAPS.csi_to_trade || {};
  const elem = ROUTING_MAPS.elemental_to_trade || {};
  const csiKeys = new Set(Object.keys(csi));
  const elemKeys = new Set(Object.keys(elem));
  let foundDiv = "";
  let foundTrade = "";
  const mDiv = txt.match(/\bdiv(?:ision)?\s*(\d{2,3})\b/i);
  if (mDiv) {
    const code = mDiv[1];
    if (code.length===2 && csiKeys.has(code)) { foundDiv = code; foundTrade = csi[code]; }
    else if (code.length===3 && elemKeys.has(code)) { foundDiv = code; foundTrade = elem[code]; }
  }
  if (!foundDiv) {
    const mSheet = txt.match(/\b(\d{2})[\s-]\d{2}(?:[\s-]\d{2})?\b/);
    if (mSheet) {
      const c = mSheet[1];
      if (csiKeys.has(c)) { foundDiv=c; foundTrade=csi[c]; }
    }
  }
  if (!foundDiv) {
    const tokens = (txt.match(/\b\d{3}\b/g) || []);
    for (const t of tokens) { if (elemKeys.has(t)) { foundDiv=t; foundTrade=elem[t]; break; } }
  }
  if (!foundDiv) {
    const tokens2 = (txt.match(/\b\d{2}\b/g) || []);
    for (const t of tokens2) { if (csiKeys.has(t)) { foundDiv=t; foundTrade=csi[t]; break; } }
  }
  if (!foundTrade) {
    const h = pickFromKeywords(txt);
    if (h) { foundTrade = h.trade; if (!foundDiv && csiKeys.has(h.div)) foundDiv=h.div; }
  }
  let changed=false;
  if (foundDiv && !userSetDivision && divisionSelectEl) {
    const prev = divisionSelectEl.value;
    divisionSelectEl.value = foundDiv;
    if (divisionSelectEl.value !== prev) changed=true;
  }
  if (foundTrade && !userSetTrade) {
    const prev = tradeSelectEl.value;
    tradeSelectEl.value = foundTrade;
    if (tradeSelectEl.value !== prev) changed=true;
  }
  if (changed) rerunIfReady();
}

let preTimer = null;
fuzzyInputEl.addEventListener('input', () => {
  if (preTimer) clearTimeout(preTimer);
  preTimer = setTimeout(autoPreselectFromText, 250);
});

tradeSelectEl.addEventListener('change', () => { userSetTrade = true; rerunIfReady(); });
if (divisionSelectEl) divisionSelectEl.addEventListener('change', () => { userSetDivision = true; rerunIfReady(); });

populateDomainSelectors();

autoParseBtn.addEventListener("click", async () => {
  const fuzzy = fuzzyInputEl.value.trim();
  if (!fuzzy) return;
  const tradeKey = tradeSelectEl.value || DEFAULT_TRADE;
  const divisionKey = divisionSelectEl ? (divisionSelectEl.value || "") : "";
  try {
    await loadCRF();
    if (window.CRFTagger && window.CRFTagger.autoParseIntoUI) {
      await window.CRFTagger.autoParseIntoUI(fuzzy, tradeKey, divisionKey);
      const dVal  = dimensionFieldEl.value.trim();
      const cVal  = capacityFieldEl.value.trim();
      const pVal  = powerFieldEl.value.trim();
      const fVal = featuresFieldEl.value.trim();
      const iVal = itemFieldEl.value.trim();
      const aVal  = ancillariesFieldEl.value.trim();
      finalStringEl.value = buildLineItem(dVal, cVal, pVal, fVal, iVal, aVal);
      appendValidationMessages();
      return;
    }
  } catch (e) {}
  fallbackAutoParse();
});

generateBtn.addEventListener("click", () => {
  const dim  = dimensionFieldEl.value.trim();
  const cap  = capacityFieldEl.value.trim();
  const pow  = powerFieldEl.value.trim();
  const feat = featuresFieldEl.value.trim();
  const item = itemFieldEl.value.trim();
  const anc  = ancillariesFieldEl.value.trim();
  finalStringEl.value = buildLineItem(dim, cap, pow, feat, item, anc);
  appendValidationMessages();
});

copyBtn.addEventListener("click", async () => {
  const txt = finalStringEl.value.trim();
  if (!txt) return;
  try {
    await navigator.clipboard.writeText(txt);
    copiedBadge.style.display = "inline-block";
    setTimeout(()=> {
      copiedBadge.style.display = "none";
    }, 1500);
  } catch(e) {
    console.warn("Copy failed", e);
  }
});

clearBtn.addEventListener("click", () => {
  fuzzyInputEl.value = "";
  dimensionFieldEl.value = "";
  capacityFieldEl.value = "";
  powerFieldEl.value = "";
  featuresFieldEl.value = "";
  itemFieldEl.value = "";
  ancillariesFieldEl.value = "";
  finalStringEl.value = "";
  notesFieldEl.value = "";
  if (divisionSelectEl) divisionSelectEl.value = "";
  appendValidationMessages();
});

exportBtn.addEventListener("click", () => {
  const lineItem = finalStringEl.value.trim();
  const notes = notesFieldEl.value.trim();
  if (!lineItem) {
    alert("Nothing to export. Generate a line item first.");
    return;
  }
  let initials = window.localStorage.getItem("estimatorInitials") || "";
  if (!initials) {
    initials = prompt("Your initials for export (e.g. AC):","AC") || "";
    window.localStorage.setItem("estimatorInitials", initials);
  }
  const entry = {
    lineItem,
    notes,
    date: todayISODate(),
    initials
  };
  exportLog.push(entry);
  const csvContent = toCSV(exportLog);
  const jsonContent = JSON.stringify(exportLog, null, 2);
  const stamp = todayISODate();
  downloadFile(`line_items_${stamp}.csv`, csvContent, "text/csv");
  downloadFile(`line_items_${stamp}.json`, jsonContent, "application/json");
});

let VALIDATION_RULES = null;
let VALIDATION_COMPILED = null;

async function loadValidationRules() {
  if (VALIDATION_RULES) return;
  try {
    const r = await fetch('./translator_artifacts/validation_rules.json');
    if (!r.ok) return;
    VALIDATION_RULES = await r.json();
    VALIDATION_COMPILED = {};
    if (VALIDATION_RULES.dimension && Array.isArray(VALIDATION_RULES.dimension.patterns)) {
      VALIDATION_COMPILED.dimension = VALIDATION_RULES.dimension.patterns.map(p => new RegExp(p, 'i'));
    } else {
      VALIDATION_COMPILED.dimension = [];
    }
    if (VALIDATION_RULES.capacity && Array.isArray(VALIDATION_RULES.capacity.patterns)) {
      VALIDATION_COMPILED.capacity = VALIDATION_RULES.capacity.patterns.map(p => new RegExp(p, 'i'));
    } else {
      VALIDATION_COMPILED.capacity = [];
    }
    if (VALIDATION_RULES.power && Array.isArray(VALIDATION_RULES.power.patterns)) {
      VALIDATION_COMPILED.power = VALIDATION_RULES.power.patterns.map(p => new RegExp(p, 'i'));
    } else {
      VALIDATION_COMPILED.power = [];
    }
  } catch (e) {}
}

function validateFields() {
  const issues = [];
  function anyMatch(val, arr){ for (const r of arr) { if (r.test(val)) return true; } return false; }
  const dim = dimensionFieldEl.value.trim();
  const cap = capacityFieldEl.value.trim();
  const pow = powerFieldEl.value.trim();
  if (dim) {
    if (VALIDATION_COMPILED && VALIDATION_COMPILED.dimension && VALIDATION_COMPILED.dimension.length>0) {
      if (!anyMatch(dim, VALIDATION_COMPILED.dimension)) issues.push('Dimension format');
    }
  }
  if (cap) {
    if (VALIDATION_COMPILED && VALIDATION_COMPILED.capacity && VALIDATION_COMPILED.capacity.length>0) {
      if (!anyMatch(cap, VALIDATION_COMPILED.capacity)) issues.push('Capacity format');
    }
  }
  if (pow) {
    if (VALIDATION_COMPILED && VALIDATION_COMPILED.power && VALIDATION_COMPILED.power.length>0) {
      if (!anyMatch(pow, VALIDATION_COMPILED.power)) issues.push('Power format');
    }
  }
  function tooLong(val, max){ return typeof max==='number' && val.length>max; }
  if (VALIDATION_RULES) {
    if (tooLong(featuresFieldEl.value.trim(), (VALIDATION_RULES.features||{}).max_length)) issues.push('Features length');
    if (tooLong(itemFieldEl.value.trim(), (VALIDATION_RULES.item||{}).max_length)) issues.push('Item length');
    if (tooLong(ancillariesFieldEl.value.trim(), (VALIDATION_RULES.ancillaries||{}).max_length)) issues.push('Ancillaries length');
  }
  return issues;
}

function appendValidationMessages() {
  const clarifyBox = document.getElementById('clarifyBox');
  if (!clarifyBox) return;
  const issues = validateFields();
  if (issues.length>0) {
    const div = document.createElement('div');
    div.className = 'small muted';
    div.textContent = 'Validation: ' + issues.join(', ');
    clarifyBox.appendChild(div);
  }
}

loadValidationRules();

// Incremental parse while typing: lightweight CRF pass (no retrieval)
let parseTimer = null;
fuzzyInputEl.addEventListener('input', async () => {
  if (parseTimer) clearTimeout(parseTimer);
  parseTimer = setTimeout(async () => {
    const txt = fuzzyInputEl.value.trim();
    if (!txt) return;
    const tradeKey = tradeSelectEl.value || DEFAULT_TRADE;
    const divisionKey = divisionSelectEl ? (divisionSelectEl.value || "") : "";
    try {
      await loadCRF();
      if (window.CRFTagger && window.CRFTagger.quickParseIntoUI) {
        await window.CRFTagger.quickParseIntoUI(txt, tradeKey, divisionKey);
      } else {
        fallbackAutoParse();
      }
    } catch(e) {
      fallbackAutoParse();
    }
    const dVal  = dimensionFieldEl.value.trim();
    const cVal  = capacityFieldEl.value.trim();
    const pVal  = powerFieldEl.value.trim();
    const fVal  = featuresFieldEl.value.trim();
    const iVal  = itemFieldEl.value.trim();
    const aVal  = ancillariesFieldEl.value.trim();
    finalStringEl.value = buildLineItem(dVal, cVal, pVal, fVal, iVal, aVal);
    appendValidationMessages();
  }, 180);
});
