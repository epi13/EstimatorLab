import { createFuse } from '../lib/search/fuse.js';
import { debounce, htmlEscape, parseJSONL, detectFields } from '../lib/utils.js';

let rows = [];      // raw objects from JSONL
let fuse = null;    // Fuse instance
let allFields = []; // list of field names
let showCols = [];  // columns to display
let searchKeys = [];// fields to search

const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('searchInput');
const limitInput = document.getElementById('limitInput');
const thresholdInput = document.getElementById('thresholdInput');
const statusEl = document.getElementById('status');
const theadRow = document.getElementById('theadRow');
const tbody = document.getElementById('tbody');
const searchKeysWrap = document.getElementById('searchKeysWrap');
const columnsWrap = document.getElementById('columnsWrap');
const reindexBtn = document.getElementById('reindexBtn');

function buildCheckboxes(container, fields, selectedSet){
  container.innerHTML = '';
  for(const f of fields){
    const id = container.id + '__' + f;
    const wrap = document.createElement('label');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.value = f;
    cb.checked = selectedSet.has(f);
    cb.addEventListener('change', onOptionsChanged);
    wrap.appendChild(cb);
    const span = document.createElement('span');
    span.textContent = f;
    wrap.appendChild(span);
    container.appendChild(wrap);
  }
}

function onOptionsChanged(){
  // read checkboxes
  const sk = new Set();
  searchKeysWrap.querySelectorAll('input[type=checkbox]').forEach(cb => { if(cb.checked) sk.add(cb.value); });
  const sc = new Set();
  columnsWrap.querySelectorAll('input[type=checkbox]').forEach(cb => { if(cb.checked) sc.add(cb.value); });

  searchKeys = Array.from(sk);
  showCols = Array.from(sc);

  // re-render and optionally rebuild index if keys changed
  buildHeader(showCols);
  renderTable(rows.slice(0, +limitInput.value)); // show first page for context
}

function buildHeader(cols){
  theadRow.innerHTML = cols.map(c => `<th>${htmlEscape(c)}</th>`).join('');
}

function renderTable(data){
  const lim = Math.max(1, +limitInput.value || 200);
  const subset = data.slice(0, lim);
  const cells = [];
  for(const r of subset){
    const tds = showCols.map(c => `<td>${htmlEscape(r[c])}</td>`).join('');
    cells.push(`<tr>${tds}</tr>`);
  }
  tbody.innerHTML = cells.join('') || `<tr><td colspan="${showCols.length || 1}"><em>No results</em></td></tr>`;
  statusEl.textContent = `Showing ${subset.length} of ${data.length} result(s).`;
}

function buildFuse(){
  if(!rows.length) return;
  if(!searchKeys.length){
    fuse = null;
    return;
  }
  const threshold = parseFloat(thresholdInput.value) || 0.3;
  fuse = createFuse(rows, {
    includeScore: true,
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: searchKeys
  });
}

function doSearch(){
  const q = searchInput.value.trim();
  if(!q){
    renderTable(rows);
    return;
  }
  if(!fuse){
    buildFuse();
  }
  if(!fuse){
    renderTable(rows);
    return;
  }
  const res = fuse.search(q).map(r => r.item);
  renderTable(res);
}

// --- events ---
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  statusEl.textContent = 'Loading…';
  const text = await file.text();
  rows = parseJSONL(text);

  if(!rows.length){
    statusEl.textContent = 'No rows found.';
    return;
  }

  allFields = detectFields(rows);

  // Preferred defaults for your dataset if present:
  const preferredCols = ['ITEM','UIT','MATERIAL PRICE','LABOR PRICE'];
  const defaultShow = new Set(preferredCols.filter(c => allFields.includes(c)));
  if(defaultShow.size === 0){
    // fallback: first four fields
    allFields.slice(0, Math.min(4, allFields.length)).forEach(f => defaultShow.add(f));
  }

  // Default search keys: if ITEM exists use it, else all string-like columns
  const defaultSearch = new Set(
    (allFields.includes('ITEM') ? ['ITEM'] : allFields).slice(0, 8) // cap defaults
  );

  buildCheckboxes(searchKeysWrap, allFields, defaultSearch);
  buildCheckboxes(columnsWrap, allFields, defaultShow);

  searchKeys = Array.from(defaultSearch);
  showCols = Array.from(defaultShow);
  buildHeader(showCols);

  searchInput.disabled = false;
  reindexBtn.disabled = false;

  buildFuse();
  renderTable(rows);
  statusEl.textContent = `Loaded ${rows.length} rows from ${file.name}`;
});

searchInput.addEventListener('input', debounce(doSearch, 120));
limitInput.addEventListener('change', () => doSearch());
thresholdInput.addEventListener('change', () => { buildFuse(); doSearch(); });
reindexBtn.addEventListener('click', () => { buildFuse(); doSearch(); });

// small debounce helper
// debounce imported from ../lib/utils.js
