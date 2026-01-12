import { createFuse } from '../lib/search/fuse.js';
import { debounce, htmlEscape, parseJSONL, detectFields } from '../lib/utils.js';

let rows = [];      // raw objects from JSONL
let fuse = null;    // Fuse instance
let allFields = []; // list of field names
let showCols = [];  // columns to display
let searchKeys = [];// fields to search
let loadedFileName = '';

const STORAGE_KEY = 'fuzzy-search-state';
const DB_NAME = 'fuzzy-search-db';
const STORE_NAME = 'datasets';
const DATA_KEY = 'latest';

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

function getDefaultShowFields(){
  const preferredCols = ['ITEM','UIT','MATERIAL PRICE','LABOR PRICE'];
  const defaults = new Set(preferredCols.filter(c => allFields.includes(c)));
  if(defaults.size === 0){
    allFields.slice(0, Math.min(4, allFields.length)).forEach(f => defaults.add(f));
  }
  return Array.from(defaults);
}

function getDefaultSearchFields(){
  if(!allFields.length) return [];
  const defaults = new Set((allFields.includes('ITEM') ? ['ITEM'] : allFields).slice(0, 8));
  return Array.from(defaults);
}

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

function persistState(){
  try {
    const state = {
      showCols,
      searchKeys,
      limit: +limitInput.value || 200,
      threshold: thresholdInput.value,
      search: searchInput.value,
      fileName: loadedFileName
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch(err){
    console.warn('Unable to persist fuzzy search state', err);
  }
}

function openDb(){
  if(!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB not available'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if(!db.objectStoreNames.contains(STORE_NAME)){
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function saveDataset(payload){
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: DATA_KEY, ...payload });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch(err){
    console.warn('Unable to persist dataset', err);
    return false;
  }
}

async function loadDataset(){
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(DATA_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch(err){
    console.warn('Unable to load dataset', err);
    return null;
  }
}

async function restoreState(){
  let persisted = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    persisted = raw ? JSON.parse(raw) : {};
  } catch(err){
    console.warn('Unable to load persisted state', err);
  }
  const dataset = await loadDataset();
  if(!dataset || !dataset.rows || !dataset.rows.length) return;
  try {
    rows = dataset.rows;
    allFields = detectFields(rows);
    showCols = persisted.showCols || [];
    searchKeys = persisted.searchKeys || [];
    loadedFileName = persisted.fileName || dataset.fileName || '';

    initializeFromRows({
      show: showCols,
      search: searchKeys,
      limit: persisted.limit,
      threshold: persisted.threshold,
      searchValue: persisted.search,
      statusMessage: loadedFileName
        ? `Restored ${rows.length} rows from ${loadedFileName}`
        : `Restored ${rows.length} rows from previous session.`
    });
  } catch(err){
    console.warn('Unable to restore fuzzy search state', err);
    localStorage.removeItem(STORAGE_KEY);
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
  persistState();
}

function buildHeader(cols){
  theadRow.innerHTML = cols.map(c => `<th>${htmlEscape(c)}</th>`).join('');
}

function initializeFromRows({ show, search, limit, threshold, searchValue, statusMessage } = {}){
  fuse = null;

  if(!allFields.length){
    allFields = detectFields(rows);
  }

  const showSet = new Set((show && show.length) ? show : getDefaultShowFields());
  const searchSet = new Set((search && search.length) ? search : getDefaultSearchFields());

  buildCheckboxes(searchKeysWrap, allFields, searchSet);
  buildCheckboxes(columnsWrap, allFields, showSet);

  searchKeys = Array.from(searchSet);
  showCols = Array.from(showSet);

  if(limit) limitInput.value = limit;
  if(threshold !== undefined) thresholdInput.value = threshold;
  if(typeof searchValue === 'string') searchInput.value = searchValue;

  searchInput.disabled = false;
  reindexBtn.disabled = false;

  buildHeader(showCols);
  buildFuse();
  doSearch();

  statusEl.textContent = statusMessage || `Loaded ${rows.length} rows${loadedFileName ? ` from ${loadedFileName}` : ''}.`;
  persistState();
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
  let results = rows;
  if(!q){
    renderTable(results);
    persistState();
    return;
  }
  if(!fuse){
    buildFuse();
  }
  if(!fuse){
    renderTable(results);
    persistState();
    return;
  }
  results = fuse.search(q).map(r => r.item);
  renderTable(results);
  persistState();
}

// --- events ---
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  statusEl.textContent = 'Loading…';
  const text = await file.text();
  rows = parseJSONL(text);
  loadedFileName = file.name;

  if(!rows.length){
    statusEl.textContent = 'No rows found.';
    return;
  }

  allFields = detectFields(rows);
  const persisted = await saveDataset({
    rows,
    fileName: loadedFileName,
    savedAt: Date.now()
  });
  const suffix = persisted ? '' : ' (storage unavailable; session-only)';
  initializeFromRows({ statusMessage: `Loaded ${rows.length} rows from ${file.name}${suffix}` });
});

searchInput.addEventListener('input', debounce(() => { doSearch(); }, 120));
limitInput.addEventListener('change', () => { doSearch(); persistState(); });
thresholdInput.addEventListener('change', () => { buildFuse(); doSearch(); persistState(); });
reindexBtn.addEventListener('click', () => { buildFuse(); doSearch(); persistState(); });

// small debounce helper
// debounce imported from ../lib/utils.js
restoreState();
