// Regex & Dictionary Lab logic
let state = {
  dataset: null,
  fileHandle: null,
};

const el = sel => document.querySelector(sel);
const els = sel => Array.from(document.querySelectorAll(sel));

// ---------- UI bindings ----------
window.addEventListener('DOMContentLoaded', () => {
  el('#btn-load').addEventListener('click', onLoadJSON);
  el('#btn-save').addEventListener('click', onDownloadJSON);
  el('#btn-fs-open').addEventListener('click', onFsOpen);
  el('#btn-fs-save').addEventListener('click', onFsSave);
  el('#btn-add-category').addEventListener('click', () => addCategoryUI());

  el('#btn-apply-json').addEventListener('click', applyJsonFromEditor);
  el('#btn-run-test').addEventListener('click', onRunTest);
  el('#file-input').addEventListener('change', onFilePicked);

  // Try to load starter JSON via fetch (works on GH Pages when placed alongside files)
  fetch('dictionaries.json').then(r => r.json()).then((data) => {
    setDataset(data);
  }).catch(() => {
    // fallback blank
    setDataset(makeEmptyDataset());
  });
});

function makeEmptyDataset() {
  return { version:'0.1.0', globals:{ uoms:['LF','SF','EA','HR','FT','GAL','LB'] }, categories: [] };
}

function setDataset(ds) {
  state.dataset = ds;
  el('#dataset-version').value = ds.version || '';
  el('#dataset-uoms').value = (ds.globals?.uoms || []).join(',');
  renderCategories();
  refreshJsonView();
  refreshTesterSelectors();
}

// ---------- Load / Save ----------
function onLoadJSON() {
  el('#file-input').click();
}

function onFilePicked(e) {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      setDataset(data);
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  };
  reader.readAsText(f);
}

function onDownloadJSON() {
  collectDatasetFromUI();
  const blob = new Blob([JSON.stringify(state.dataset, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dictionaries.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function onFsOpen() {
  if (!window.showOpenFilePicker) { alert('File System Access API not supported in this browser.'); return; }
  const [handle] = await window.showOpenFilePicker({ types:[{description:'JSON', accept:{'application/json':['.json']}}]});
  state.fileHandle = handle;
  const file = await handle.getFile();
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    setDataset(data);
  } catch (e) { alert('Invalid JSON: ' + e.message); }
}

async function onFsSave() {
  if (!state.fileHandle) return onDownloadJSON();
  collectDatasetFromUI();
  const writable = await state.fileHandle.createWritable();
  await writable.write(JSON.stringify(state.dataset, null, 2));
  await writable.close();
  alert('Saved.');
}

// ---------- Categories UI ----------
function renderCategories() {
  const wrap = el('#categories');
  wrap.innerHTML = '';
  (state.dataset.categories || []).forEach((cat, idx) => {
    wrap.appendChild(renderCategory(cat, idx));
  });
}

function renderCategory(cat, idx) {
  const tpl = document.getElementById('tpl-category');
  const node = tpl.content.cloneNode(true);

  const root = node.querySelector('.category');
  const code = node.querySelector('.cat-code');
  const name = node.querySelector('.cat-name');
  const keywords = node.querySelector('.cat-keywords');
  const synonyms = node.querySelector('.cat-synonyms');
  const uoms = node.querySelector('.cat-uoms');
  const dims = node.querySelector('.cat-dimensions');
  const list = node.querySelector('.pattern-list');
  const btnDel = node.querySelector('.btn-del-cat');
  const btnAddPattern = node.querySelector('.btn-add-pattern');

  code.value = cat.code || '';
  name.value = cat.name || '';
  keywords.value = (cat.keywords || []).join(',');
  synonyms.value = Object.entries(cat.synonyms || {}).map(([k,v]) => `${k}:${v}`).join('\n');
  uoms.value = (cat.uom_hints || []).join(',');
  dims.value = (cat.dimensions || []).join(',');

  (cat.patterns || []).forEach((p, pidx) => list.appendChild(renderPattern(p, idx, pidx)));

  btnDel.addEventListener('click', () => {
    state.dataset.categories.splice(idx,1);
    renderCategories();
    refreshTesterSelectors();
    refreshJsonView();
  });

  btnAddPattern.addEventListener('click', () => {
    const pat = { name:'pattern_'+Date.now(), desc:'', regex:'', flags:'gi', fields:'dimension:dim' };
    state.dataset.categories[idx].patterns = state.dataset.categories[idx].patterns || [];
    state.dataset.categories[idx].patterns.push(pat);
    renderCategories();
    refreshTesterSelectors();
    refreshJsonView();
  });

  // store back on change
  [code,name,keywords,synonyms,uoms,dims].forEach(inp => inp.addEventListener('input', () => {
    collectDatasetFromUI();
    refreshJsonView();
    refreshTesterSelectors();
  }));

  return root;
}

function renderPattern(pat, catIdx, patIdx) {
  const tpl = document.getElementById('tpl-pattern');
  const node = tpl.content.cloneNode(true);
  const root = node.querySelector('.pattern');
  const name = node.querySelector('.pat-name');
  const desc = node.querySelector('.pat-desc');
  const regex = node.querySelector('.pat-regex');
  const flags = node.querySelector('.pat-flags');
  const fields = node.querySelector('.pat-fields');
  const btnDel = node.querySelector('.btn-del-pattern');

  name.value = pat.name || '';
  desc.value = pat.desc || '';
  regex.value = pat.regex || '';
  flags.value = pat.flags || 'gi';
  fields.value = pat.fields || '';

  const onAny = () => { collectDatasetFromUI(); refreshJsonView(); refreshTesterSelectors(); };
  [name,desc,regex,flags,fields].forEach(inp => inp.addEventListener('input', onAny));
  btnDel.addEventListener('click', () => {
    state.dataset.categories[catIdx].patterns.splice(patIdx,1);
    renderCategories();
    refreshTesterSelectors();
    refreshJsonView();
  });

  return root;
}

function addCategoryUI() {
  state.dataset.categories.push({
    code:'', name:'', keywords:[], synonyms:{}, uom_hints:[], dimensions:[], patterns:[]
  });
  renderCategories();
  refreshTesterSelectors();
  refreshJsonView();
}

// ---------- Collect from UI into state ----------
function collectDatasetFromUI() {
  const ds = state.dataset || makeEmptyDataset();
  ds.version = el('#dataset-version').value || '0.1.0';
  ds.globals = ds.globals || {};
  ds.globals.uoms = (el('#dataset-uoms').value || '').split(',').map(s => s.trim()).filter(Boolean);

  const catNodes = els('#categories > .category');
  const cats = [];
  catNodes.forEach((catNode) => {
    const code = catNode.querySelector('.cat-code').value.trim();
    const name = catNode.querySelector('.cat-name').value.trim();
    const keywords = (catNode.querySelector('.cat-keywords').value || '').split(',').map(x => x.trim()).filter(Boolean);
    const synLines = (catNode.querySelector('.cat-synonyms').value || '').split('\n').map(x => x.trim()).filter(Boolean);
    const synonyms = {};
    synLines.forEach(line => {
      const i = line.indexOf(':');
      if (i>0) { synonyms[line.slice(0,i).trim()] = line.slice(i+1).trim(); }
    });
    const uoms = (catNode.querySelector('.cat-uoms').value || '').split(',').map(x => x.trim()).filter(Boolean);
    const dims = (catNode.querySelector('.cat-dimensions').value || '').split(',').map(x => x.trim()).filter(Boolean);

    const patterns = [];
    catNode.querySelectorAll('.pattern').forEach(pn => {
      const name = pn.querySelector('.pat-name').value.trim();
      const desc = pn.querySelector('.pat-desc').value.trim();
      const regex = pn.querySelector('.pat-regex').value;
      const flags = pn.querySelector('.pat-flags').value.trim();
      const fields = pn.querySelector('.pat-fields').value.trim();
      patterns.push({ name, desc, regex, flags, fields });
    });

    cats.push({ code, name, keywords, synonyms, uom_hints:uoms, dimensions:dims, patterns });
  });

  ds.categories = cats;
  state.dataset = ds;
  return ds;
}

// ---------- Tester ----------
function refreshTesterSelectors() {
  const ds = state.dataset || makeEmptyDataset();
  const catSel = el('#tester-category');
  const patSel = el('#tester-pattern');
  catSel.innerHTML = '';
  ds.categories.forEach((c, idx) => {
    const opt = document.createElement('option');
    opt.value = idx; opt.textContent = `${c.code || '(no code)'} — ${c.name || '(unnamed)'}`;
    catSel.appendChild(opt);
  });
  patSel.innerHTML = '';
  if (ds.categories.length) {
    const pats = ds.categories[0].patterns || [];
    pats.forEach((p, i) => {
      const o = document.createElement('option'); o.value = i; o.textContent = p.name || '(unnamed)';
      patSel.appendChild(o);
    });
  }
  catSel.onchange = () => {
    const c = ds.categories[catSel.value];
    patSel.innerHTML = '';
    (c?.patterns || []).forEach((p, i) => {
      const o = document.createElement('option'); o.value = i; o.textContent = p.name || '(unnamed)';
      patSel.appendChild(o);
    });
  };
}

function onRunTest() {
  collectDatasetFromUI();
  const ds = state.dataset;
  const c = ds.categories[parseInt(el('#tester-category').value || '0',10)];
  if (!c) return;
  const p = (c.patterns || [])[parseInt(el('#tester-pattern').value || '0',10)];
  if (!p) return;

  const text = el('#tester-text').value || '';
  let rx;
  try { rx = new RegExp(p.regex, p.flags || 'gi'); }
  catch (e) { el('#test-results').textContent = 'Invalid regex: ' + e.message; return; }

  const fieldMap = parseFieldMap(p.fields);
  const results = [];
  for (const m of text.matchAll(rx)) {
    const rec = {};
    for (const [field, group] of Object.entries(fieldMap)) {
      rec[field] = m.groups?.[group] ?? null;
    }
    results.push({ match: m[0], index: m.index, groups: rec });
  }
  el('#match-count').textContent = results.length + ' match(es)';
  el('#test-results').textContent = JSON.stringify(results, null, 2);
}

function parseFieldMap(s) {
  const out = {};
  (s || '').split(',').forEach(pair => {
    const [k,v] = pair.split(':').map(x => (x||'').trim());
    if (k && v) out[k]=v;
  });
  return out;
}

// ---------- JSON view ----------
function refreshJsonView() {
  el('#json-view').value = JSON.stringify(state.dataset || makeEmptyDataset(), null, 2);
}

function applyJsonFromEditor() {
  try {
    const obj = JSON.parse(el('#json-view').value);
    setDataset(obj);
  } catch (e) {
    alert('Invalid JSON: ' + e.message);
  }
}
