// Regex detectors (mirror Python defaults)
const DIM_PATTERNS = [
  /\b\d+['\"]?\s?x\s?\d+['\"]?\s?x\s?\d+['\"]?\b/i,
  /\b\d+['\"]?\s?x\s?\d+['\"]?\b/i,
  /\b\d+(?:\.\d+)?\s?(inch|in\.?|\")\b/i,
  /\b\d+(?:\.\d+)?\s?(ft|lf)\b/i,
];
const POWER_PATTERNS = [
  /\b\d{2,3}(?:\/\d{2,3})?\s?v\b/i,
  /\b\d{1,2}\s?hp\b/i,
  /\b\d{1,3}\s?a\b/i,
];
const CAP_PATTERNS = [
  /\b\d+(?:\.\d+)?\s?(btu|btuh|cfm|gpm|kw|w\/ft|w\/lf|tons?)\b/i,
];

function anyMatch(text, arr) {
  for (const rg of arr) { if (rg.test(text)) return true; }
  return false;
}

function setNeighborLexiconsFromDocs(docs) {
  const base = extractSuggestionsFromDocs(docs);
  const tokSet = (arr) => {
    const s = new Set();
    for (const v of (arr||[])) {
      const toks = (String(v||'').match(TOKEN_RE) || []).map(t=>t.toLowerCase());
      for (const t of toks) s.add(t);
    }
    return s;
  };
  const bigramSet = new Set();
  const addBigrams = (arr) => {
    for (const v of (arr||[])) {
      const toks = (String(v||'').match(TOKEN_RE) || []).map(t=>t.toLowerCase());
      for (let i=0;i+1<toks.length;i++) {
        bigramSet.add(toks[i]+'_'+toks[i+1]);
      }
    }
  };
  State.neighborItemTokSet = tokSet(base.itemsTop);
  State.neighborFeatTokSet = tokSet(base.featsTop);
  addBigrams(base.itemsTop);
  addBigrams(base.featsTop);
  State.neighborBGSet = bigramSet;
  return base;
}

// Lazy-loaded CRF tagger + TF-IDF + LSH retrieval for descriptionTranslator.html
// Consumes artifacts in ./translator_artifacts built by step1.py and step2_build_models.py

const ART_ROOT = './translator_artifacts';
const RETR_ROOT = ART_ROOT + '/retrieval';
const MODEL_ROOT = ART_ROOT + '/model';
const GAZ_ROOT = ART_ROOT + '/gazetteers/global';
const GAZ_BY_TRADE_ROOT = ART_ROOT + '/gazetteers/by_trade';
const GAZ_BY_DIV_ROOT = ART_ROOT + '/gazetteers/by_division';
const MANIFEST_URL = ART_ROOT + '/gazetteers/manifest.json';
const PROTO_URL = MODEL_ROOT + '/cluster_prototypes.json';

const TOKEN_RE = /[A-Za-z0-9]+(?:[\/.\-][A-Za-z0-9]+)*/g;
const STOP = new Set(['the','and','or','a','an','to','of','in','on','for','with','by','as','at','is','are','be','from','this','that','new','existing','remove','demolish','demo','install','including','incl','w','w/']);

function tokenize(text) {
  if (!text) return [];
  const m = text.match(TOKEN_RE);
  return m ? m.map(s => s.toLowerCase()) : [];
}

function djb2_32(str) {
  let h = 5381 >>> 0;
  for (let i=0;i<str.length;i++) {
    h = (((h << 5) >>> 0) + h + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function djb2_64(str) {
  let hi = 5381n, lo = 5381n;
  for (let i=0;i<str.length;i++) {
    const v = BigInt(str.charCodeAt(i));
    if ((i & 1) === 0) {
      hi = ((hi << 5n) + hi + v) & 0xFFFFFFFFn;
    } else {
      lo = ((lo << 5n) + lo + v) & 0xFFFFFFFFn;
    }
  }
  return ((hi << 32n) | lo) & 0xFFFFFFFFFFFFFFFFn;
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Fetch failed: '+url);
  return r.json();
}

// Globals loaded on-demand
const State = {
  loaded: false,
  config: null,
  idf: new Map(),          // hash32(str) -> idf
  model: null,             // { labels, weights: { tag: [[feat, wt], ...] } }
  weights: {},             // tag -> Map(feature -> wt)
  manifest: null,          // { trades:[], divisions:[] }
  itemsGlobal: [],
  featsGlobal: [],
  itemsActive: [],
  featsActive: [],
  thresholds: { dimension: 0.60, capacity: 0.65, power: 0.70, features: 0.55, item: 0.70, ancillaries: 0.50 },
  prototypes: null,
  neighborItemTokSet: null,
  neighborFeatTokSet: null,
  neighborBGSet: null,
};

async function ensureLoaded() {
  if (State.loaded) return;
  const [cfg, model, items, features, conf] = await Promise.all([
    fetchJSON(RETR_ROOT + '/config.json'),
    fetchJSON(MODEL_ROOT + '/crf_model.json'),
    fetchJSON(GAZ_ROOT + '/items.json').catch(()=>[]),
    fetchJSON(GAZ_ROOT + '/features.json').catch(()=>[]),
    fetchJSON(ART_ROOT + '/confidence_config.json').catch(()=>null),
  ]);
  State.config = cfg;
  // idf keys are hashed strings
  State.idf = new Map(Object.entries(cfg.idf || {}).map(([k,v])=>[Number(k), Number(v)]));
  State.model = model;
  State.itemsGlobal = items || [];
  State.featsGlobal = features || [];
  if (conf && conf.thresholds) State.thresholds = conf.thresholds;
  // weights
  State.weights = {};
  for (const tag of model.labels) {
    const w = new Map();
    const arr = model.weights[tag] || [];
    for (const [f,wt] of arr) w.set(f, Number(wt));
    State.weights[tag] = w;
  }
  if (Array.isArray(model.labels)) {
    TAGS = model.labels.slice();
  }
  State.loaded = true;
}

async function ensureManifest() {
  if (State.manifest) return;
  try {
    State.manifest = await fetchJSON(MANIFEST_URL);
  } catch (e) {
    State.manifest = { trades: [], divisions: [] };
  }
}

async function ensurePrototypes() {
  if (State.prototypes !== null) return;
  try { State.prototypes = await fetchJSON(PROTO_URL); }
  catch (e) { State.prototypes = null; }
}

async function ensureDomainLoaded(tradeKey, divisionKey) {
  await ensureLoaded();
  await ensureManifest();
  const items = [];
  const feats = [];
  async function tryLoad(path) {
    try { return await fetchJSON(path); } catch(e) { return []; }
  }
  // prioritize trade, then division, then global
  if (tradeKey && (State.manifest.trades||[]).includes(tradeKey)) {
    const ti = await tryLoad(`${GAZ_BY_TRADE_ROOT}/${encodeURIComponent(tradeKey)}/items.json`);
    const tf = await tryLoad(`${GAZ_BY_TRADE_ROOT}/${encodeURIComponent(tradeKey)}/features.json`);
    items.push(...ti); feats.push(...tf);
  }
  if (divisionKey && (State.manifest.divisions||[]).includes(divisionKey)) {
    const di = await tryLoad(`${GAZ_BY_DIV_ROOT}/${encodeURIComponent(divisionKey)}/items.json`);
    const df = await tryLoad(`${GAZ_BY_DIV_ROOT}/${encodeURIComponent(divisionKey)}/features.json`);
    items.push(...di); feats.push(...df);
  }
  items.push(...(State.itemsGlobal||[]));
  feats.push(...(State.featsGlobal||[]));
  // dedupe preserve order
  const seenI = new Set();
  const seenF = new Set();
  State.itemsActive = items.filter(x=>{ if(!x) return false; const k=x.toLowerCase(); if(seenI.has(k)) return false; seenI.add(k); return true; });
  State.featsActive = feats.filter(x=>{ if(!x) return false; const k=x.toLowerCase(); if(seenF.has(k)) return false; seenF.add(k); return true; });
  // build gazetteer token sets for CRF features
  State.itemTokSet = new Set();
  State.featTokSet = new Set();
  for (const s of State.itemsActive) {
    const toks = (String(s||'').match(TOKEN_RE) || []).map(t=>t.toLowerCase());
    for (const t of toks) State.itemTokSet.add(t);
  }
  for (const s of State.featsActive) {
    const toks = (String(s||'').match(TOKEN_RE) || []).map(t=>t.toLowerCase());
    for (const t of toks) State.featTokSet.add(t);
  }
}

function buildQueryVec(text) {
  const toks = tokenize(text).filter(t => !STOP.has(t) && t.length>=2);
  const tf = new Map();
  for (const t of toks) {
    const idf = State.idf.get(djb2_32(t));
    if (!idf) continue;
    tf.set(t, (tf.get(t)||0)+1);
  }
  let norm = 0;
  const vec = new Map(); // hash32 -> weight
  for (const [t,c] of tf.entries()) {
    const idf = State.idf.get(djb2_32(t)) || 0;
    const w = c * idf;
    const h = djb2_32(t);
    vec.set(h, (vec.get(h)||0) + w);
    norm += w*w;
  }
  norm = Math.sqrt(norm)||1;
  for (const [h,w] of vec.entries()) vec.set(h, w/norm);
  // simhash
  const accum = new Array(64).fill(0);
  for (const [t,c] of tf.entries()) {
    const idf = State.idf.get(djb2_32(t)) || 0;
    const w = (c/(toks.length||1)) * idf;
    const sig = djb2_64(t);
    for (let i=0;i<64;i++) {
      const bit = (sig >> BigInt(63 - i)) & 1n;
      accum[i] += bit ? w : -w;
    }
  }
  let sig = 0n;
  for (let i=0;i<64;i++) if (accum[i] > 0) sig |= (1n << BigInt(63 - i));
  return { vec, sig };
}

async function lshCandidates(q) {
  const bands = State.config.bands;
  const bits = State.config.band_bits;
  const files = new Set();
  for (let b=0;b<bands;b++) {
    const shift = 64 - (b+1)*bits;
    const prefix = Number((q.sig >> BigInt(shift)) & BigInt((1<<bits)-1));
    const name = `b${b}_` + prefix.toString(16).padStart(4,'0') + '.json';
    files.add(name);
  }
  const shardPromises = Array.from(files).map(async name => {
    try { return await fetchJSON(`${RETR_ROOT}/shards/${name}`); } catch(e) { return { docs: [] }; }
  });
  const shards = await Promise.all(shardPromises);
  const seen = new Set();
  const cands = [];
  for (const sh of shards) {
    for (const d of (sh.docs||[])) {
      const id = d.id;
      if (seen.has(id)) continue;
      seen.add(id);
      cands.push(d);
    }
  }
  return cands;
}

function dotSim(qvec, dvec) {
  let s = 0;
  for (const [h, w] of dvec) {
    const qw = qvec.get(h);
    if (qw) s += qw * w;
  }
  return s;
}

async function topKDocs(text, k=10) {
  const q = buildQueryVec(text);
  const cands = await lshCandidates(q);
  const scored = cands.map(d => ({ id: d.id, sim: dotSim(q.vec, new Map(d.vec)) })).sort((a,b)=>b.sim-a.sim).slice(0,k);
  // load doc chunks
  const chunkSize = State.config.doc_chunk_size || 1000;
  const chunks = new Map();
  async function getDoc(id) {
    const chunkIdx = Math.floor(id / chunkSize);
    if (!chunks.has(chunkIdx)) {
      const part = await fetchJSON(`${RETR_ROOT}/docs/docs_${String(chunkIdx).padStart(3,'0')}.json`);
      chunks.set(chunkIdx, part.docs || []);
    }
    const arr = chunks.get(chunkIdx);
    const offset = id - chunkIdx*chunkSize;
    return arr[offset] || '';
  }
  const docs = [];
  for (const s of scored) {
    const txt = await getDoc(s.id);
    docs.push({ id: s.id, sim: s.sim, text: txt });
  }
  return docs;
}

// CRF tagger --------------------------------------------------------

let TAGS = ['O','B-DIM','I-DIM','B-CAP','I-CAP','B-POW','I-POW','B-FEAT','I-FEAT','B-ITEM','I-ITEM','B-ANC','I-ANC'];

function featsFor(tokens, i, prevTag) {
  const t = tokens[i];
  const tl = t.toLowerCase();
  const feats = ['BIAS', 'tok='+tl, 'ptag='+prevTag,
    /\d/.test(t) ? 'has_digit' : '',
    (t.includes('"')||t.includes("'")) ? 'has_quote' : '',
    'pref2='+tl.slice(0,2), 'suf2='+tl.slice(-2), 'pref3='+tl.slice(0,3), 'suf3='+tl.slice(-3)
  ];
  if (i>0) feats.push('prev='+tokens[i-1].toLowerCase());
  if (i+1<tokens.length) feats.push('next='+tokens[i+1].toLowerCase());
  // gazetteer token presence (mirrors Python training features)
  if (State.itemTokSet && State.itemTokSet.has(tl)) feats.push('gazI');
  if (State.featTokSet && State.featTokSet.has(tl)) feats.push('gazF');
  if (State.neighborItemTokSet && State.neighborItemTokSet.has(tl)) feats.push('nbrI');
  if (State.neighborFeatTokSet && State.neighborFeatTokSet.has(tl)) feats.push('nbrF');
  if (State.neighborBGSet) {
    if (i>0) {
      const bgp = tokens[i-1].toLowerCase()+'_'+tl;
      if (State.neighborBGSet.has(bgp)) feats.push('nbrBGp');
    }
    if (i+1<tokens.length) {
      const bgn = tl+'_'+tokens[i+1].toLowerCase();
      if (State.neighborBGSet.has(bgn)) feats.push('nbrBGn');
    }
  }
  return feats.filter(Boolean);
}

function scoreTag(feats, tag) {
  const w = State.weights[tag];
  let s = 0;
  if (!w) return s;
  for (const f of feats) s += (w.get(f) || 0);
  return s;
}

function viterbi(tokens) {
  if (tokens.length===0) return { tags: [], V: [] };
  const V = [{}];
  const back = [{}];
  for (const tag of TAGS) {
    V[0][tag] = scoreTag(featsFor(tokens,0,'START'), tag);
    back[0][tag] = null;
  }
  for (let i=1;i<tokens.length;i++) {
    V.push({}); back.push({});
    for (const tag of TAGS) {
      let best=-Infinity, bestTag=null;
      for (const ptag of TAGS) {
        const sc = V[i-1][ptag] + scoreTag(featsFor(tokens,i,ptag), tag);
        if (sc>best) { best=sc; bestTag=ptag; }
      }
      V[i][tag]=best; back[i][tag]=bestTag;
    }
  }
  let last = TAGS[0]; let best=-Infinity;
  for (const tag of TAGS) { if (V[V.length-1][tag]>best) { best=V[V.length-1][tag]; last=tag; } }
  const tags = [last];
  for (let i=tokens.length-1;i>0;i--) { last = back[i][last]; tags.push(last); }
  tags.reverse();
  return { tags, V };
}

function softmax(scores) {
  const mx = Math.max(...scores);
  const exps = scores.map(s=>Math.exp(s-mx));
  const sum = exps.reduce((a,b)=>a+b,0);
  return exps.map(e=>e/sum);
}

function baseTag(t) {
  if (t==='O') return 'O';
  return t.replace(/^B-/, '').replace(/^I-/, '');
}

function tagWithConfidence(text) {
  const tokens = (text.match(TOKEN_RE)||[]);
  const { tags, V } = viterbi(tokens);
  const probs = tokens.map((_,i)=>{
    const scs = TAGS.map(tag=> scoreTag(featsFor(tokens,i, i?tags[i-1]:'START'), tag));
    const ps = softmax(scs);
    return { scores: scs, probs: ps };
  });
  // aggregate fields
  const agg = { DIM:[], CAP:[], POW:[], FEAT:[], ITEM:[], ANC:[] };
  for (let i=0;i<tokens.length;i++) {
    const bt = baseTag(tags[i]);
    if (bt!=='O' && agg[bt]) agg[bt].push(tokens[i]);
  }
  const fields = {
    dimension: agg.DIM.join(' '),
    capacity: agg.CAP.join(' '),
    power: agg.POW.join(' '),
    features: Array.from(new Set(agg.FEAT)).join(' '),
    item: agg.ITEM.join(' '),
    ancillaries: agg.ANC.join(' ')
  };
  const confs = {};
  function avgProbBase(tagBase) {
    let s=0,c=0;
    for (let i=0;i<tokens.length;i++) {
      const bt = baseTag(tags[i]);
      if (bt===tagBase) {
        const idx = TAGS.indexOf(tags[i]);
        if (idx>=0) { s+=probs[i].probs[idx]; c++; }
      }
    }
    return c? s/c : 0;
  }
  confs.dimension = avgProbBase('DIM');
  confs.capacity = avgProbBase('CAP');
  confs.power = avgProbBase('POW');
  confs.features = avgProbBase('FEAT');
  confs.item = avgProbBase('ITEM');
  confs.ancillaries = avgProbBase('ANC');

  // Rule-based boosts to reduce false low confidence for obvious patterns
  if (anyMatch(text, DIM_PATTERNS)) confs.dimension = Math.max(confs.dimension, 0.9);
  if (anyMatch(text, POWER_PATTERNS)) confs.power = Math.max(confs.power, 0.85);
  if (anyMatch(text, CAP_PATTERNS)) confs.capacity = Math.max(confs.capacity, 0.85);
  return { fields, confs, tokens, tags };
}

function extractSuggestionsFromDocs(docs, kItems=8, kFeats=12) {
  const itemsCnt = new Map();
  const featsCnt = new Map();
  const itemsSrc = (State.itemsActive && State.itemsActive.length) ? State.itemsActive : (State.itemsGlobal||[]);
  const featsSrc = (State.featsActive && State.featsActive.length) ? State.featsActive : (State.featsGlobal||[]);
  for (const d of docs) {
    const low = d.text.toLowerCase();
    for (const it of itemsSrc) {
      if (!it) continue; if (low.includes(it.toLowerCase())) itemsCnt.set(it, (itemsCnt.get(it)||0)+1);
    }
    for (const ft of featsSrc) {
      if (!ft) continue; if (low.includes(ft.toLowerCase())) featsCnt.set(ft, (featsCnt.get(ft)||0)+1);
    }
  }
  const itemsTop = Array.from(itemsCnt.entries()).sort((a,b)=>b[1]-a[1]).slice(0,kItems).map(x=>x[0]);
  const featsTop = Array.from(featsCnt.entries()).sort((a,b)=>b[1]-a[1]).slice(0,kFeats).map(x=>x[0]);
  return { itemsTop, featsTop };
}

async function suggestFor(text, k=10) {
  const docs = await topKDocs(text, k);
  const base = extractSuggestionsFromDocs(docs);
  await ensurePrototypes();
  if (State.prototypes && Array.isArray(State.prototypes.clusters)) {
    const low = (text||'').toLowerCase();
    const termHit = new Set();
    for (const cl of State.prototypes.clusters) {
      const tops = cl && cl.top_terms ? cl.top_terms : [];
      for (const t of tops) {
        const tt = String(t||'').toLowerCase();
        if (!tt) continue;
        if (low.includes(tt)) termHit.add(tt);
      }
    }
    if (termHit.size>0) {
      const itemsSrc = (State.itemsActive && State.itemsActive.length) ? State.itemsActive : (State.itemsGlobal||[]);
      const featsSrc = (State.featsActive && State.featsActive.length) ? State.featsActive : (State.featsGlobal||[]);
      const extraItems = [];
      const extraFeats = [];
      for (const it of itemsSrc) { if (termHit.has(String(it).toLowerCase())) extraItems.push(it); }
      for (const ft of featsSrc) { if (termHit.has(String(ft).toLowerCase())) extraFeats.push(ft); }
      function dedupe(arr) { const s = new Set(); const out=[]; for (const x of arr) { const k=String(x).toLowerCase(); if (s.has(k)) continue; s.add(k); out.push(x);} return out; }
      base.itemsTop = dedupe([...(base.itemsTop||[]), ...extraItems]).slice(0, 8);
      base.featsTop = dedupe([...(base.featsTop||[]), ...extraFeats]).slice(0, 12);
    }
  }
  return base;
}

async function autoParseIntoUI(text, tradeKey, divisionKey) {
  await ensureDomainLoaded(tradeKey, divisionKey);
  const docs = await topKDocs(text, 20);
  const sug = setNeighborLexiconsFromDocs(docs);
  const res = tagWithConfidence(text);
  // Fill fields
  const set = (id, v) => { const el=document.getElementById(id); if (el) el.value=(v||'').trim(); };
  set('dimensionField', res.fields.dimension);
  set('capacityField', res.fields.capacity);
  set('powerField', res.fields.power);
  set('featuresField', res.fields.features);
  set('itemField', res.fields.item);
  set('ancillariesField', res.fields.ancillaries);

  // Clarification prompts
  const cf = State.thresholds;
  const warnings = [];
  function check(name,label,val){ if ((val||'').trim() && (res.confs[name]||0) < (cf[name]||0)) warnings.push(label); }
  check('dimension','Dimension', res.fields.dimension);
  check('capacity','Capacity', res.fields.capacity);
  check('power','Power', res.fields.power);
  check('features','Features', res.fields.features);
  check('item','Item', res.fields.item);
  check('ancillaries','Ancillaries', res.fields.ancillaries);
  const clarifyBox = document.getElementById('clarifyBox');
  if (clarifyBox) {
    clarifyBox.innerHTML = '';
    if (warnings.length>0) {
      const msg = document.createElement('div');
      msg.className = 'small muted';
      msg.textContent = 'Low confidence – please confirm: ' + warnings.join(', ');
      clarifyBox.appendChild(msg);
    }
  }

  const cfItem = State.thresholds.item || 0.7;
  if ((res.confs.item||0) < cfItem) {
    const el = document.getElementById('itemField');
    if (el && (!el.value || el.value.split(/\s+/).length<=1) && (sug.itemsTop||[]).length>0) {
      el.value = sug.itemsTop[0];
    }
  }

  // Suggestions UI
  function fillChips(id, arr, onClick) {
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML='';
    for (const v of arr) {
      const chip = document.createElement('button');
      chip.className = 'pill';
      chip.type = 'button';
      chip.textContent = v;
      chip.addEventListener('click', ()=> onClick(v));
      box.appendChild(chip);
    }
  }
  fillChips('itemSuggestions', sug.itemsTop, v => {
    const el = document.getElementById('itemField');
    if (el) el.value = v;
  });
  fillChips('featureSuggestions', sug.featsTop, v => {
    const el = document.getElementById('featuresField');
    if (el) {
      const cur = el.value.trim();
      el.value = cur ? (cur + ', ' + v) : v;
    }
  });
}

// Quick parse variant for typing: skip retrieval suggestions for speed
async function quickParseIntoUI(text, tradeKey, divisionKey) {
  await ensureDomainLoaded(tradeKey, divisionKey);
  const res = tagWithConfidence(text);
  const set = (id, v) => { const el=document.getElementById(id); if (el) el.value=(v||'').trim(); };
  set('dimensionField', res.fields.dimension);
  set('capacityField', res.fields.capacity);
  set('powerField', res.fields.power);
  set('featuresField', res.fields.features);
  set('itemField', res.fields.item);
  set('ancillariesField', res.fields.ancillaries);
  // Clarification prompts only (no suggestions)
  const cf = State.thresholds;
  const warnings = [];
  function check(name,label,val){ if ((val||'').trim() && (res.confs[name]||0) < (cf[name]||0)) warnings.push(label); }
  check('dimension','Dimension', res.fields.dimension);
  check('capacity','Capacity', res.fields.capacity);
  check('power','Power', res.fields.power);
  check('features','Features', res.fields.features);
  check('item','Item', res.fields.item);
  check('ancillaries','Ancillaries', res.fields.ancillaries);
  const clarifyBox = document.getElementById('clarifyBox');
  if (clarifyBox) {
    clarifyBox.innerHTML = '';
    if (warnings.length>0) {
      const msg = document.createElement('div');
      msg.className = 'small muted';
      msg.textContent = 'Low confidence – please confirm: ' + warnings.join(', ');
      clarifyBox.appendChild(msg);
    }
  }
}

window.CRFTagger = { ensureLoaded, autoParseIntoUI, quickParseIntoUI };
