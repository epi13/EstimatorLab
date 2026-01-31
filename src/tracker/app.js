/* Construction Commodity Tracker
   - Demo provider included (offline).
   - Provider adapters scaffolded for real data sources.
   - Watchlist + alerts + theme persisted in localStorage.
*/

const LS = {
  THEME: "ct.theme",
  RANGE: "ct.range",
  WATCH: "ct.watch",
  SELECTED: "ct.selected",
  ALERTS: "ct.alerts",
  PROVIDER: "ct.provider",
  UPLIFT_ON: "ct.uplift.on",
  UPLIFT_VAL: "ct.uplift.val",
  CUSTOM: "ct.custom"
};

const DEFAULT_RANGE = "1M";
const AUTO_REFRESH_MS = 60_000;

const fmtMoney = (n) => {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
};
const fmtPct = (n) => {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

const nowISO = () => new Date().toISOString();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

/* ---------------------------
   Demo dataset (construction)
---------------------------- */
const BASE_ITEMS = [
  { id:"lumber", name:"Lumber (Index)", unit:"Index", category:"Wood" },
  { id:"steel", name:"Steel (Index)", unit:"Index", category:"Metals" },
  { id:"copper", name:"Copper (Index)", unit:"Index", category:"Metals" },
  { id:"aluminum", name:"Aluminum (Index)", unit:"Index", category:"Metals" },
  { id:"diesel", name:"Diesel (Wholesale)", unit:"$/gal", category:"Fuel" },
  { id:"gasoline", name:"Gasoline (Wholesale)", unit:"$/gal", category:"Fuel" },
  { id:"concrete", name:"Ready-Mix Concrete", unit:"$/CY", category:"Concrete" },
  { id:"asphalt", name:"Asphalt Binder", unit:"$/ton", category:"Asphalt" },
  { id:"gypsum", name:"Gypsum Board", unit:"$/sheet", category:"Finishes" },
  { id:"pvc", name:"PVC Pipe Resin", unit:"Index", category:"Plastics" },
];

/* --------------------------------
   Provider interface + adapters
-----------------------------------
Expected provider methods:
- listItems(): returns array of items {id,name,unit,category}
- getSnapshot(range): returns per-item latest + change vs prev
  { updatedAt, rows:[{id, price, changeAbs, changePct, series:[{t, v}]}] }
*/
const Providers = {
  demo: demoProvider(),
  fred: fredProviderScaffold(),
  commoditiesApi: commoditiesApiScaffold()
};

function demoProvider() {
  // Deterministic-ish pseudo series generation
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }
  const seedBase = 1234567;
  const rnd = mulberry32(seedBase);

  const basePrices = {
    lumber: 520, steel: 305, copper: 420, aluminum: 210,
    diesel: 3.45, gasoline: 3.10,
    concrete: 265, asphalt: 620, gypsum: 15.25, pvc: 185
  };

  function rangePoints(range) {
    const now = Date.now();
    const day = 24*60*60*1000;
    const ranges = {
      "1W": { n: 7*4, step: 6*60*60*1000 },
      "1M": { n: 30, step: day },
      "3M": { n: 90, step: day },
      "1Y": { n: 52, step: 7*day },
      "5Y": { n: 60, step: 30*day }
    };
    return ranges[range] ?? ranges["1M"];
  }

  function genSeries(itemId, range) {
    const { n, step } = rangePoints(range);
    const start = Date.now() - (n-1)*step;

    const b = basePrices[itemId] ?? (50 + rnd()*200);
    const vol = (itemId === "diesel" || itemId === "gasoline") ? 0.02 :
                (itemId === "concrete" || itemId === "asphalt") ? 0.01 : 0.015;

    let v = b;
    const series = [];
    for (let i=0; i<n; i++){
      const t = start + i*step;
      // small drift + noise + occasional spikes
      const drift = (rnd()-0.5) * vol;
      const spike = (rnd() < 0.03) ? (rnd()-0.5) * vol * 10 : 0;
      v = v * (1 + drift + spike);
      v = Math.max(0.01, v);
      series.push({ t, v: +v.toFixed(3) });
    }
    return series;
  }

  return {
    async listItems() {
      const custom = readJSON(LS.CUSTOM, []);
      return [...BASE_ITEMS, ...custom];
    },
    async getSnapshot(range) {
      const items = await this.listItems();
      const rows = items.map(it => {
        const series = genSeries(it.id, range);
        const last = series[series.length-1]?.v ?? NaN;
        const prev = series[series.length-2]?.v ?? last;
        const changeAbs = last - prev;
        const changePct = prev ? (changeAbs/prev)*100 : 0;
        return { id: it.id, price:last, changeAbs, changePct, series };
      });

      // mimic latency
      await new Promise(r => setTimeout(r, 250));
      return { updatedAt: nowISO(), rows };
    }
  };
}

/* -----------------------------
   Real provider scaffolds
------------------------------ */
function fredProviderScaffold() {
  // NOTE: FRED API often needs a proxy due to CORS and to protect your API key.
  // Implement a tiny serverless function:
  // /api/fred?series_id=...&range=...  -> fetch from FRED, return normalized series.
  const seriesMap = {
    // Replace with series IDs you choose.
    // Example concept: PPI indices for lumber/steel/etc.
    // lumber: "WPU08....",
  };

  return {
    async listItems() {
      // In practice: your curated items aligned to your FRED series list
      return [...BASE_ITEMS];
    },
    async getSnapshot(range) {
      throw new Error(
        "FRED provider is scaffolded. Add a serverless proxy endpoint and map series IDs in app.js."
      );
    }
  };
}

function commoditiesApiScaffold() {
  // Example vendor requires API key; also commonly needs a proxy for CORS + key safety.
  return {
    async listItems() { return [...BASE_ITEMS]; },
    async getSnapshot(range) {
      throw new Error(
        "Commodities API provider is scaffolded. Add a proxy endpoint and normalize to {t,v} series."
      );
    }
  };
}

/* -----------------------------
   UI state
------------------------------ */
const els = {
  app: document.getElementById("app"),

  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),

  segBtns: Array.from(document.querySelectorAll(".segbtn")),
  refreshBtn: document.getElementById("refreshBtn"),
  autoRefreshToggle: document.getElementById("autoRefreshToggle"),
  themeToggle: document.getElementById("themeToggle"),

  cards: document.getElementById("cards"),
  boardBody: document.getElementById("boardBody"),
  watchlist: document.getElementById("watchlist"),
  alerts: document.getElementById("alerts"),

  chartTitle: document.getElementById("chartTitle"),
  lastUpdated: document.getElementById("lastUpdated"),
  selectedMeta: document.getElementById("selectedMeta"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),

  details: document.getElementById("details"),

  sortNameBtn: document.getElementById("sortNameBtn"),
  sortChangeBtn: document.getElementById("sortChangeBtn"),
  sortPriceBtn: document.getElementById("sortPriceBtn"),

  providerSelect: document.getElementById("providerSelect"),
  providerStatus: document.getElementById("providerStatus"),

  upliftToggle: document.getElementById("upliftToggle"),
  upliftPreset: document.getElementById("upliftPreset"),
  upliftPctLabel: document.getElementById("upliftPctLabel"),

  newAlertBtn: document.getElementById("newAlertBtn"),
  alertDialog: document.getElementById("alertDialog"),
  alertForm: document.getElementById("alertForm"),
  alertMaterial: document.getElementById("alertMaterial"),
  alertCondition: document.getElementById("alertCondition"),
  alertTarget: document.getElementById("alertTarget"),
  alertLabel: document.getElementById("alertLabel"),

  addCustomBtn: document.getElementById("addCustomBtn"),
  customDialog: document.getElementById("customDialog"),
  customForm: document.getElementById("customForm"),
  customName: document.getElementById("customName"),
  customUnit: document.getElementById("customUnit"),
  customPrice: document.getElementById("customPrice")
};

const State = {
  providerKey: localStorage.getItem(LS.PROVIDER) || "demo",
  range: localStorage.getItem(LS.RANGE) || DEFAULT_RANGE,
  search: "",
  sort: { key: "name", dir: "asc" }, // name|price|pct
  selectedId: localStorage.getItem(LS.SELECTED) || "lumber",
  watch: readJSON(LS.WATCH, ["lumber","steel","diesel"]),
  alerts: readJSON(LS.ALERTS, []),
  upliftOn: (localStorage.getItem(LS.UPLIFT_ON) || "false") === "true",
  upliftVal: parseFloat(localStorage.getItem(LS.UPLIFT_VAL) || "0.08"),
  items: [],
  snapshot: null
};

let chart = null;
let autoTimer = null;

/* -----------------------------
   Init
------------------------------ */
init().catch(err => {
  console.error(err);
  toast(err?.message || "Init failed");
});

async function init() {
  // Theme
  const theme = localStorage.getItem(LS.THEME) || "dark";
  applyTheme(theme);
  els.themeToggle.checked = theme === "dark";

  // Range
  setRange(State.range);

  // Provider
  els.providerSelect.value = State.providerKey;
  els.providerStatus.textContent = State.providerKey;

  // Uplift
  els.upliftToggle.checked = State.upliftOn;
  els.upliftPreset.value = String(State.upliftVal);
  updateUpliftLabel();

  // Wire events
  wire();

  // Load initial
  await refreshAll();
  startAutoRefreshIfNeeded();
}

function wire() {
  els.segBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      setRange(btn.dataset.range);
      refreshAll().catch(console.error);
    });
  });

  els.refreshBtn.addEventListener("click", () => refreshAll().catch(console.error));

  els.autoRefreshToggle.addEventListener("change", () => {
    startAutoRefreshIfNeeded();
  });

  els.themeToggle.addEventListener("change", () => {
    applyTheme(els.themeToggle.checked ? "dark" : "light");
  });

  els.searchInput.addEventListener("input", () => {
    State.search = els.searchInput.value.trim().toLowerCase();
    renderBoard();
  });
  els.clearSearchBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    State.search = "";
    renderBoard();
  });

  els.sortNameBtn.addEventListener("click", () => { State.sort = { key:"name", dir: flipDirIfSame("name") }; renderBoard(); });
  els.sortPriceBtn.addEventListener("click", () => { State.sort = { key:"price", dir: flipDirIfSame("price") }; renderBoard(); });
  els.sortChangeBtn.addEventListener("click", () => { State.sort = { key:"pct", dir: flipDirIfSame("pct") }; renderBoard(); });

  els.providerSelect.addEventListener("change", async () => {
    State.providerKey = els.providerSelect.value;
    localStorage.setItem(LS.PROVIDER, State.providerKey);
    els.providerStatus.textContent = State.providerKey;
    await refreshAll();
  });

  els.upliftToggle.addEventListener("change", () => {
    State.upliftOn = els.upliftToggle.checked;
    localStorage.setItem(LS.UPLIFT_ON, String(State.upliftOn));
    updateUpliftLabel();
    renderAll();
  });
  els.upliftPreset.addEventListener("change", () => {
    State.upliftVal = parseFloat(els.upliftPreset.value);
    localStorage.setItem(LS.UPLIFT_VAL, String(State.upliftVal));
    updateUpliftLabel();
    renderAll();
  });

  els.exportCsvBtn.addEventListener("click", exportSelectedCsv);

  // Alerts
  els.newAlertBtn.addEventListener("click", () => openAlertDialog());
  els.alertDialog.addEventListener("close", () => {
    // no-op
  });
  els.alertForm.addEventListener("submit", (e) => {
    e.preventDefault();
  });
  els.alertDialog.addEventListener("close", () => {
    // handled via save button click below if needed
  });
  document.getElementById("saveAlertBtn").addEventListener("click", () => saveAlert());

  // Custom items
  els.addCustomBtn.addEventListener("click", () => els.customDialog.showModal());
  document.getElementById("saveCustomBtn").addEventListener("click", () => saveCustomItem());
}

function flipDirIfSame(key){
  if (State.sort.key === key) return State.sort.dir === "asc" ? "desc" : "asc";
  return "asc";
}

function setRange(range) {
  State.range = range;
  localStorage.setItem(LS.RANGE, range);
  els.segBtns.forEach(b => b.classList.toggle("active", b.dataset.range === range));
}

function applyTheme(theme) {
  localStorage.setItem(LS.THEME, theme);
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function updateUpliftLabel(){
  const pct = State.upliftOn ? (State.upliftVal * 100) : 0;
  els.upliftPctLabel.textContent = `${pct.toFixed(0)}%`;
}

function startAutoRefreshIfNeeded() {
  if (els.autoRefreshToggle.checked) {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => refreshAll().catch(console.error), AUTO_REFRESH_MS);
    toast("Auto-refresh enabled");
  } else {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
  }
}

/* -----------------------------
   Data load + normalize
------------------------------ */
async function refreshAll() {
  const provider = Providers[State.providerKey];
  if (!provider) throw new Error("Unknown provider: " + State.providerKey);

  try {
    State.items = await provider.listItems();
    State.snapshot = await provider.getSnapshot(State.range);
    els.lastUpdated.textContent = `Last updated: ${new Date(State.snapshot.updatedAt).toLocaleString()}`;
    renderAll();
    evaluateAlerts();
  } catch (err) {
    console.error(err);
    toast(err?.message || "Refresh failed");
    // Still render what we have if any
    renderAll();
  }
}

function uplifted(price){
  if (!isFinite(price)) return price;
  if (!State.upliftOn) return price;
  return price * (1 + State.upliftVal);
}

function getRow(id){
  return State.snapshot?.rows?.find(r => r.id === id) || null;
}
function getItem(id){
  return State.items?.find(i => i.id === id) || null;
}

/* -----------------------------
   Render
------------------------------ */
function renderAll() {
  renderCards();
  renderBoard();
  renderWatchlist();
  renderSelected();
  renderAlerts();
}

function renderCards() {
  const importantIds = [
    State.selectedId,
    "lumber","steel","diesel","concrete"
  ].filter((v,i,a)=>v && a.indexOf(v)===i);

  const cards = importantIds
    .map(id => {
      const it = getItem(id);
      const row = getRow(id);
      if (!it || !row) return null;

      const p = uplifted(row.price);
      const ca = uplifted(row.changeAbs);
      const cp = row.changePct;

      const cls = cp >= 0 ? "good" : "bad";
      return `
        <div class="card" data-pick="${id}">
          <div class="k">${escapeHtml(it.name)}</div>
          <div class="v">${fmtMoney(p)} <span class="muted" style="font-size:12px">${escapeHtml(it.unit)}</span></div>
          <div class="s">
            <span class="chg ${cls}">${cp >= 0 ? "▲" : "▼"} ${fmtMoney(ca)} (${fmtPct(cp)})</span>
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  els.cards.innerHTML = cards || `<div class="muted">No data yet.</div>`;

  Array.from(els.cards.querySelectorAll(".card")).forEach(card => {
    card.addEventListener("click", () => pick(card.getAttribute("data-pick")));
  });
}

function renderBoard() {
  const rows = (State.snapshot?.rows || []).map(r => ({
    ...r,
    item: getItem(r.id)
  })).filter(x => x.item);

  const query = State.search;
  const filtered = query
    ? rows.filter(x => (x.item.name || "").toLowerCase().includes(query) || (x.item.category||"").toLowerCase().includes(query))
    : rows;

  const sorted = filtered.sort((a,b) => {
    const dir = State.sort.dir === "asc" ? 1 : -1;
    if (State.sort.key === "name") return dir * (a.item.name.localeCompare(b.item.name));
    if (State.sort.key === "price") return dir * ((uplifted(a.price) || 0) - (uplifted(b.price) || 0));
    if (State.sort.key === "pct") return dir * ((a.changePct || 0) - (b.changePct || 0));
    return 0;
  });

  els.boardBody.innerHTML = sorted.map(x => {
    const p = uplifted(x.price);
    const ca = uplifted(x.changeAbs);
    const cp = x.changePct;
    const cls = cp >= 0 ? "good" : "bad";
    const starred = State.watch.includes(x.id);

    return `
      <tr data-pick="${x.id}">
        <td class="star">
          <button class="starbtn ${starred ? "active" : ""}" title="Star / pin">★</button>
        </td>
        <td><div style="font-weight:700">${escapeHtml(x.item.name)}</div><div class="muted small">${escapeHtml(x.item.category || "")}</div></td>
        <td class="muted">${escapeHtml(x.item.unit)}</td>
        <td class="num">${fmtMoney(p)}</td>
        <td class="num ${cls}">${cp >= 0 ? "+" : ""}${fmtMoney(ca)}</td>
        <td class="num ${cls}">${fmtPct(cp)}</td>
        <td class="trend"><canvas class="spark" width="110" height="26" data-spark="${x.id}"></canvas></td>
      </tr>
    `;
  }).join("");

  // Row click + star click
  Array.from(els.boardBody.querySelectorAll("tr")).forEach(tr => {
    const id = tr.getAttribute("data-pick");
    tr.addEventListener("click", (e) => {
      const isStar = e.target?.classList?.contains("starbtn");
      if (!isStar) pick(id);
    });

    const sb = tr.querySelector(".starbtn");
    sb.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWatch(id);
    });
  });

  // Sparklines
  Array.from(document.querySelectorAll("canvas[data-spark]")).forEach(c => {
    const id = c.getAttribute("data-spark");
    const row = getRow(id);
    drawSpark(c, row?.series?.map(p => uplifted(p.v)) || []);
  });
}

function renderWatchlist() {
  const ids = State.watch
    .map(id => ({ id, it:getItem(id), row:getRow(id) }))
    .filter(x => x.it && x.row);

  els.watchlist.innerHTML = ids.length ? ids.map(x => {
    const p = uplifted(x.row.price);
    const cp = x.row.changePct;
    const cls = cp >= 0 ? "good" : "bad";
    return `
      <div class="witem" data-pick="${x.id}">
        <div>
          <div class="wname">${escapeHtml(x.it.name)}</div>
          <div class="wsub">${escapeHtml(x.it.unit)} • ${escapeHtml(x.it.category || "")}</div>
        </div>
        <div class="wval">
          <div class="wprice">${fmtMoney(p)}</div>
          <div class="wpct ${cls}">${fmtPct(cp)}</div>
        </div>
      </div>
    `;
  }).join("") : `<div class="muted small">No watchlist items yet.</div>`;

  Array.from(els.watchlist.querySelectorAll(".witem")).forEach(div => {
    div.addEventListener("click", () => pick(div.getAttribute("data-pick")));
  });
}

function renderSelected() {
  const it = getItem(State.selectedId);
  const row = getRow(State.selectedId);
  if (!it || !row) {
    els.chartTitle.textContent = "Select an item";
    els.selectedMeta.textContent = "—";
    els.details.innerHTML = `<div class="muted">Pick a material from the Market Board.</div>`;
    destroyChart();
    return;
  }

  els.chartTitle.textContent = it.name;
  els.selectedMeta.textContent = `${it.category || "—"} • ${it.unit} • Range ${State.range}${State.upliftOn ? ` • AK uplift +${Math.round(State.upliftVal*100)}%` : ""}`;

  const p = uplifted(row.price);
  const ca = uplifted(row.changeAbs);
  const cp = row.changePct;

  els.details.innerHTML = `
    <div class="kv"><div class="k">Current</div><div class="v">${fmtMoney(p)} ${escapeHtml(it.unit)}</div></div>
    <div class="kv"><div class="k">Change</div><div class="v">${fmtMoney(ca)} (${fmtPct(cp)})</div></div>
    <div class="kv"><div class="k">Category</div><div class="v">${escapeHtml(it.category || "—")}</div></div>
    <div class="kv"><div class="k">Provider</div><div class="v">${escapeHtml(State.providerKey)}</div></div>
    <div class="kv"><div class="k">Uplift</div><div class="v">${State.upliftOn ? `Enabled (+${Math.round(State.upliftVal*100)}%)` : "Off"}</div></div>
  `;

  renderChart(it, row.series);
}

function renderAlerts() {
  const itemsById = Object.fromEntries((State.items || []).map(i => [i.id, i]));
  els.alerts.innerHTML = State.alerts.length ? State.alerts.map(a => {
    const it = itemsById[a.materialId];
    const label = a.label ? escapeHtml(a.label) : escapeHtml(it?.name || a.materialId);
    const condTxt = a.condition === "above" ? "Above" : "Below";
    return `
      <div class="alert ${a.fired ? "fired" : ""}" data-id="${a.id}">
        <div>
          <div class="a1">${label}</div>
          <div class="a2">${condTxt} ${fmtMoney(a.target)} • ${escapeHtml(it?.unit || "")}</div>
        </div>
        <button class="rm" title="Remove">🗑</button>
      </div>
    `;
  }).join("") : `<div class="muted small">No alerts yet.</div>`;

  Array.from(els.alerts.querySelectorAll(".alert")).forEach(div => {
    const id = div.getAttribute("data-id");
    div.querySelector(".rm").addEventListener("click", () => {
      State.alerts = State.alerts.filter(a => a.id !== id);
      writeJSON(LS.ALERTS, State.alerts);
      renderAlerts();
    });
  });
}

/* -----------------------------
   Actions
------------------------------ */
function pick(id) {
  State.selectedId = id;
  localStorage.setItem(LS.SELECTED, id);
  renderSelected();
}

function toggleWatch(id) {
  const idx = State.watch.indexOf(id);
  if (idx >= 0) State.watch.splice(idx,1);
  else State.watch.unshift(id);

  // keep clean + unique
  State.watch = Array.from(new Set(State.watch)).slice(0, 12);
  writeJSON(LS.WATCH, State.watch);
  renderBoard();
  renderWatchlist();
}

function openAlertDialog() {
  // Populate material list
  const items = (State.items || []).slice().sort((a,b)=>a.name.localeCompare(b.name));
  els.alertMaterial.innerHTML = items.map(i => `<option value="${escapeAttr(i.id)}">${escapeHtml(i.name)}</option>`).join("");
  els.alertMaterial.value = State.selectedId || items[0]?.id || "";
  els.alertTarget.value = "";
  els.alertLabel.value = "";
  els.alertCondition.value = "above";
  els.alertDialog.showModal();
}

function saveAlert() {
  // dialog "ok" click handler
  if (els.alertDialog.returnValue === "cancel") return;

  const materialId = els.alertMaterial.value;
  const target = parseFloat(els.alertTarget.value);
  if (!materialId || !isFinite(target)) {
    toast("Alert needs a material and numeric target.");
    return;
  }
  const condition = els.alertCondition.value;
  const label = (els.alertLabel.value || "").trim();

  State.alerts.unshift({
    id: uid(),
    materialId,
    condition,
    target,
    label,
    fired: false,
    createdAt: nowISO()
  });
  writeJSON(LS.ALERTS, State.alerts);
  renderAlerts();
  toast("Alert saved");
}

function saveCustomItem() {
  if (els.customDialog.returnValue === "cancel") return;

  const name = (els.customName.value || "").trim();
  const unit = (els.customUnit.value || "").trim() || "Unit";
  const startPrice = parseFloat(els.customPrice.value);

  if (!name || !isFinite(startPrice)) {
    toast("Custom item needs a name and starting price.");
    return;
  }

  const id = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32) + "_" + Date.now().toString(16);

  const custom = readJSON(LS.CUSTOM, []);
  custom.push({ id, name, unit, category: "Custom", _seedPrice: startPrice });
  writeJSON(LS.CUSTOM, custom);

  // Patch demo provider base price for new items by storing seed on the item itself.
  // (Demo provider uses basePrices map; for custom we just let the generator pick unless you expand it.)
  toast("Custom item added");
  // refresh to load it into the table
  refreshAll().catch(console.error);

  // clear fields
  els.customName.value = "";
  els.customUnit.value = "";
  els.customPrice.value = "";
}

/* -----------------------------
   Alerts evaluation
------------------------------ */
function evaluateAlerts(){
  if (!State.snapshot) return;

  let firedCount = 0;
  State.alerts = State.alerts.map(a => {
    const row = getRow(a.materialId);
    const it = getItem(a.materialId);
    if (!row || !it) return { ...a, fired:false };

    const current = uplifted(row.price);
    const isFired =
      (a.condition === "above" && current > a.target) ||
      (a.condition === "below" && current < a.target);

    if (isFired) firedCount++;
    return { ...a, fired:isFired, lastCheckedAt: nowISO(), lastValue: current };
  });

  writeJSON(LS.ALERTS, State.alerts);
  renderAlerts();

  if (firedCount > 0) {
    toast(`${firedCount} alert(s) triggered`);
  }
}

/* -----------------------------
   Chart
------------------------------ */
function destroyChart(){
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

function renderChart(item, series) {
  const ctx = document.getElementById("priceChart");
  destroyChart();

  const pts = (series || []).map(p => ({ x: new Date(p.t), y: uplifted(p.v) }));
  chart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: item.name,
        data: pts,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => `${fmtMoney(c.parsed.y)} ${item.unit}`
          }
        }
      },
      scales: {
        x: {
          type: "time",
          time: { unit: "day" },
          ticks: { color: getComputedStyle(document.documentElement).getPropertyValue("--muted") }
        },
        y: {
          ticks: { color: getComputedStyle(document.documentElement).getPropertyValue("--muted") }
        }
      }
    }
  });
}

/* -----------------------------
   Sparkline draw
------------------------------ */
function drawSpark(canvas, values){
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  if (!values || values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = (max - min) || 1;

  // background line
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2;

  const start = values[0];
  const end = values[values.length-1];
  const up = end >= start;

  // Use computed CSS colors (no hard-coded palette)
  const css = getComputedStyle(document.documentElement);
  const good = css.getPropertyValue("--good").trim();
  const bad = css.getPropertyValue("--bad").trim();
  ctx.strokeStyle = up ? good : bad;

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i/(values.length-1)) * (w-8) + 4;
    const y = h - ((v - min)/span) * (h-8) - 4;
    if (i === 0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

/* -----------------------------
   Export CSV
------------------------------ */
function exportSelectedCsv(){
  const it = getItem(State.selectedId);
  const row = getRow(State.selectedId);
  if (!it || !row) return toast("Select a material first.");

  const header = "timestamp,value\n";
  const lines = (row.series || []).map(p => {
    const t = new Date(p.t).toISOString();
    const v = uplifted(p.v);
    return `${t},${v}`;
  }).join("\n");

  const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${it.id}_${State.range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -----------------------------
   Helpers
------------------------------ */
function toast(msg){
  // minimal toast
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.bottom = "16px";
  t.style.transform = "translateX(-50%)";
  t.style.padding = "10px 12px";
  t.style.borderRadius = "12px";
  t.style.border = "1px solid rgba(255,255,255,.12)";
  t.style.background = "rgba(0,0,0,.65)";
  t.style.color = "#fff";
  t.style.zIndex = 9999;
  t.style.backdropFilter = "blur(8px)";
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2200);
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s).replaceAll('"',"&quot;"); }
