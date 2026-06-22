import { readStateFromInputs, defaultState, applyStateToUI, updateState } from "./state.js";
import { getShedWarnings } from "./warnings.js";
import { createScene } from "../three/scene.js";
import { buildTakeoff } from "./calc/takeoff.js";
import { costItems } from "./calc/costing.js";
import { calcLaborHours } from "./calc/labor.js";
import { buildCutSheets } from "./calc/cutsheets.js";

async function safeFetchJson(path, fallback) {
  try {
    const r = await fetch(path, { cache:"no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return fallback;
  }
}

function money(n) {
  return (n ?? 0).toLocaleString(undefined, { style:"currency", currency:"USD" });
}

function round2(n) { return Math.round((n ?? 0) * 100) / 100; }

function makeDB(materials) {
  // normalize lookups
  const flat = {
    ...materials.lumber,
    ...materials.sheet_goods,
    ...materials.trim,
    ...materials.foundation,
    ...(materials.interior ?? {}),
    ...materials.exterior,
    ...materials.misc
  };
  return {
    get: (key) => flat[key],
    desc: (key) => (flat[key]?.desc ?? key),
    sheetSF: (key) => (flat[key]?.sf ?? 32),
    item: (name, key, qty, unitOverride=null) => {
      const it = flat[key];
      const unit = unitOverride ?? it?.unit ?? "EA";
      const base_price = it?.base_price ?? 0;
      const freight_class = it?.freight_class ?? "bulk";
      return {
        name,
        qty,
        unit,
        base: qty * base_price,
        freight_class
      };
    }
  };
}

// minimal fallbacks so the app still runs if JSON is blocked (e.g. file://)
const fallbackMaterials = {
  lumber:{ "2x4x8":{desc:"2x4x8",unit:"EA",base_price:4.25,freight_class:"bulk"}, "2x6x8":{desc:"2x6x8",unit:"EA",base_price:8.95,freight_class:"bulk"} },
  sheet_goods:{ "osb_7_16":{desc:"4x8 7/16 OSB",unit:"EA",sf:32,base_price:11.25,freight_class:"flat"}, "ply_1_2":{desc:"4x8 1/2 Plywood",unit:"EA",sf:32,base_price:27.50,freight_class:"flat"}, "tg_ply_3_4":{desc:"4x8 3/4 T&G Plywood",unit:"EA",sf:32,base_price:35.50,freight_class:"flat"} },
  trim:{ "trim_1x4":{desc:"1x4 Trim",unit:"LF",base_price:1.15,freight_class:"bulk"}, "trim_1x6":{desc:"1x6 Trim",unit:"LF",base_price:1.55,freight_class:"bulk"} },
  foundation:{
    "geotextile":{desc:"Geotextile",unit:"SF",base_price:0.35,freight_class:"pallet"},
    "gravel":{desc:"Gravel",unit:"CY",base_price:68,freight_class:"heavy"},
    "pt_skid_4x6x12":{desc:"PT 4x6x12",unit:"EA",base_price:42,freight_class:"bulk"},
    "sonotube_12x4":{desc:"12in Sonotube x 4ft",unit:"EA",base_price:17,freight_class:"pallet"},
    "concrete":{desc:"Concrete",unit:"CY",base_price:245,freight_class:"heavy"},
    "rebar":{desc:"Rebar allowance",unit:"SF",base_price:0.80,freight_class:"heavy"},
    "vapor_barrier":{desc:"10 mil VB",unit:"SF",base_price:0.12,freight_class:"flat"},
    "ground_screw":{desc:"Helical ground screw",unit:"EA",base_price:95,freight_class:"heavy"},
    "excavation":{desc:"Excavation / spoil handling allowance",unit:"CY",base_price:38,freight_class:"heavy"}
  },
  interior:{
    "batt_r13":{desc:"R-13 fiberglass batt insulation",unit:"SF",base_price:1.15,freight_class:"flat"},
    "batt_r19":{desc:"R-19 fiberglass batt insulation",unit:"SF",base_price:1.45,freight_class:"flat"},
    "rigid_1in":{desc:"1in rigid foam insulation allowance",unit:"SF",base_price:1.85,freight_class:"flat"},
    "drywall_1_2":{desc:"4x8 1/2 drywall",unit:"EA",sf:32,base_price:15.75,freight_class:"flat"},
    "drywall_finish_level3_sf":{desc:"Drywall tape / Level 3 finish allowance",unit:"SF",base_price:0.85,freight_class:"pallet"},
    "drywall_finish_level4_sf":{desc:"Drywall Level 4 paint-ready finish allowance",unit:"SF",base_price:1.20,freight_class:"pallet"}
  },
  exterior:{
    "lap_siding_sf":{desc:"Factory-primed lap siding allowance",unit:"SF",base_price:1.95,freight_class:"flat"},
    "bb_siding_sf":{desc:"Board-and-batten siding allowance",unit:"SF",base_price:2.35,freight_class:"flat"},
    "panel_siding_sf":{desc:"T1-11 / panel siding allowance",unit:"SF",base_price:1.35,freight_class:"flat"},
    "metal_roof_sf":{desc:"Ribbed metal roofing package",unit:"SF",base_price:3.25,freight_class:"flat"},
    "shingle_roof_sf":{desc:"Asphalt shingle roofing package",unit:"SF",base_price:1.45,freight_class:"pallet"},
    "membrane_roof_sf":{desc:"Low-slope membrane roofing package",unit:"SF",base_price:3.75,freight_class:"flat"},
    "shed_door_single":{desc:"Prehung single shed door",unit:"EA",base_price:185,freight_class:"pallet"},
    "shed_door_double":{desc:"Double shed door set",unit:"EA",base_price:285,freight_class:"pallet"},
    "rollup_door":{desc:"Light-duty roll-up door",unit:"EA",base_price:575,freight_class:"pallet"},
    "vinyl_window":{desc:"Vinyl shed window",unit:"EA",base_price:105,freight_class:"pallet"}
  },
  misc:{ "fasteners_ls":{desc:"Fasteners",unit:"LS",base_price:75,freight_class:"pallet"} }
};
const fallbackFreight = { by_class_pct:{ bulk:0.18, flat:0.22, pallet:0.15, heavy:0.28 } };
const fallbackRates = { civil:82, architectural:87, structural:90, mechanical:92, electrical:96 };

const $ = (id) => document.getElementById(id);

async function main() {
  const [materials, freightRules, laborRates] = await Promise.all([
    safeFetchJson("./data/materials.json", fallbackMaterials),
    safeFetchJson("./data/freight_rules.json", fallbackFreight),
    safeFetchJson("./data/labor_rate.json", fallbackRates)
  ]);

  const db = makeDB(materials);

  const canvas = $("canvas");
  const scene = createScene(canvas);
  let latestEstimateItems = [];
  let latestWarnings = [];
  let latestState = null;
  let latestTotals = { material: 0, labor: 0, freight: 0, handling: 0, total: 0 };

  canvas.addEventListener("shed-element-hovered", (event) => {
    if (event.detail?.label) $("assemblyInspector").dataset.preview = event.detail.label;
  });
  canvas.addEventListener("shed-element-selected", (event) => {
    const { label, text, assemblyId, objectId } = event.detail;
    updateState({ ui: { selectedAssemblyId: assemblyId, selectedEstimateItemId: null } });
    $("selectedInfo").innerHTML = `<b>Selected element:</b> ${label}<br>${text}`;
    renderAssemblyInspector({ type:"assembly", assemblyId, objectId, label, text });
    highlightEstimateRowsForAssembly(assemblyId);
  });

  function render(state, takeoff, costs, labor, cutSheets) {
    $("outMatBase").textContent = money(costs.matBase);
    $("outShip").textContent = money(costs.ship);
    $("outHand").textContent = money(costs.handling);
    $("outMatDel").textContent = money(costs.matDelivered);

    $("outMH").textContent = round2(labor.mh).toString();
    $("outLabor").textContent = money(labor.laborCost);
    $("outTotal").textContent = money(costs.matDelivered + labor.laborCost);

    latestState = state;
    latestEstimateItems = enrichEstimateItems(takeoff.items, costs, labor, takeoff, state);
    latestWarnings = getShedWarnings(state, latestEstimateItems);
    latestTotals = { material: costs.matBase, labor: labor.laborCost, freight: costs.ship, handling: costs.handling, total: costs.matDelivered + labor.laborCost };
    renderSummaryRail(latestTotals);
    renderWarnings(latestWarnings);

    const tbody = $("takeoffBody");
    tbody.innerHTML = "";
    for (const it of latestEstimateItems) {
      const tr = document.createElement("tr");
      const unit = it.unit === "LS" ? "LOT" : it.unit;
      tr.dataset.assembly = it.assemblyId;
      tr.dataset.itemId = it.id;
      tr.className = "estimate-row";
      tr.innerHTML = `<td><span class="row-section">${it.section}</span>${it.item}<div class="muted mini-note">${it.quantityBasis}</div></td><td>${round2(it.quantity)}</td><td>${unit}</td><td>${money(it.materialCost)}</td>`;
      tr.addEventListener("mouseenter", () => { tr.classList.add("estimate-row-linked"); scene.highlightAssembly?.(it.assemblyId); });
      tr.addEventListener("mouseleave", () => tr.classList.remove("estimate-row-linked"));
      tr.addEventListener("click", () => selectEstimateLine(tr, it, costs, labor));
      tbody.appendChild(tr);
    }

    const cutBody = $("cutSheetBody");
    cutBody.innerHTML = "";
    for (const cut of cutSheets) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${cut.assembly}</td><td>${cut.cut}<div class="muted mini-note">${cut.layout}</div></td><td>${round2(cut.qty)}</td><td>${cut.stock}<div class="muted mini-note">${cut.notes}</div></td>`;
      cutBody.appendChild(tr);
    }

    $("specDeck").innerHTML = `
      <div><b>Plan footprint</b><span>${state.geom.lenFt}' × ${state.geom.widFt}'</span></div>
      <div><b>Wall system</b><span>${state.walls.studType} @ ${state.walls.studSpacingIn}" o.c., ${state.walls.wallSheathKey.replaceAll("_", " ")}</span></div>
      <div><b>Exterior palette</b><span>${state.walls.wallColor} ${state.walls.sidingProfile}, ${state.walls.trimColor} trim</span></div>
      <div><b>Roof assembly</b><span>${state.roof.type} ${state.roof.pitchX12}:12, ${state.roof.roofFinish} over ${state.roof.roofSheathKey.replaceAll("_", " ")}</span></div>
      <div><b>Foundation</b><span>${state.foundation.type.replaceAll("_", " ")}</span></div>
      <div><b>Cut-sheet rows</b><span>${cutSheets.length} fabrication lines</span></div>
    `;

    $("notes").innerHTML = `
      <div class="pill">Wall area: ${round2(takeoff.wallAreaSF)} SF</div>
      <div class="pill">Wall net sheath: ${round2(takeoff.netWallSheathAreaSF)} SF</div>
      <div class="pill">Roof area: ${round2(takeoff.roofAreaSF)} SF</div>
      <div class="pill">Perimeter: ${round2(takeoff.perimFt)} LF</div>
      <div style="margin-top:10px">${takeoff.notes.map(x=>`• ${x}`).join("<br>")}</div>
    `;

    $("badge").textContent =
      `Shed ${state.geom.lenFt}’×${state.geom.widFt}’×${state.geom.htFt}’ | ` +
      `Roof: ${state.roof.type} | Foundation: ${state.foundation.type} | Total: ${money(costs.matDelivered + labor.laborCost)}`;
    ["outMatBase","outShip","outHand","outMatDel","outMH","outLabor","outTotal"].forEach(id => { $(id).classList.remove("cost-pulse"); void $(id).offsetWidth; $(id).classList.add("cost-pulse"); });

    scene.rebuild(state);
    renderAssemblyInspector();
  }

  function computeAndRender() {
    const state = readStateFromInputs(document);

    const takeoff = buildTakeoff(state, db);
    const costs = costItems(takeoff.items, db, state.logistics, freightRules);
    const labor = calcLaborHours(state, takeoff, laborRates);
    const cutSheets = buildCutSheets(state, takeoff, db);

    render(state, takeoff, costs, labor, cutSheets);
  }

  function classifyAssembly(name="") {
    const lower = name.toLowerCase();
    if (lower.includes("roof") || lower.includes("fascia") || lower.includes("soffit") || lower.includes("rafter")) return "roof";
    if (lower.includes("foundation") || lower.includes("gravel") || lower.includes("slab") || lower.includes("skid") || lower.includes("pier") || lower.includes("screw")) return "foundation";
    if (lower.includes("door")) return "doors";
    if (lower.includes("window")) return "windows";
    if (lower.includes("trim")) return "openings";
    if (lower.includes("stud") || lower.includes("plate") || lower.includes("wall") || lower.includes("siding") || lower.includes("sheath")) return "walls";
    if (lower.includes("floor") || lower.includes("joist")) return "floor";
    return "shed";
  }

  function selectEstimateLine(row, item, costs, labor) {
    document.querySelectorAll("#takeoffBody tr").forEach(tr => tr.classList.toggle("estimate-row-selected", tr === row));
    const assembly = row.dataset.assembly;
    updateState({ ui: { selectedAssemblyId: assembly, selectedEstimateItemId: item.id } });
    scene.highlightAssembly?.(assembly);
    renderAssemblyInspector({ type:"estimate", itemId:item.id });
    $("tracePanel").innerHTML = `<b>Estimate Trace · ${assembly.toUpperCase()}</b><span>${item.item}: ${round2(item.quantity)} ${item.unit === "LS" ? "LOT" : item.unit}, base ${money(item.materialCost)}. ${getTraceForEstimateItem(item.id)?.formula ?? item.quantityBasis}</span>`;
  }

  function enrichEstimateItems(items, costs, labor, takeoff, state) {
    const totalBase = items.reduce((sum, it) => sum + (it.base || 0), 0) || 1;
    return items.map((it, index) => {
      const assemblyId = classifyAssembly(it.name);
      const share = (it.base || 0) / totalBase;
      const laborHours = round2((labor.mh || 0) * share);
      const materialCost = it.base || 0;
      const freightCost = round2(((costs.ship || 0) + (costs.handling || 0)) * share);
      const id = `${assemblyId}-${slugify(it.name)}-${index}`;
      return {
        ...it,
        id,
        section: sectionForAssembly(assemblyId),
        assemblyId,
        assemblyType: assemblyId,
        linkedObjectIds: [`${assemblyId}-assembly`],
        item: it.name,
        quantity: it.qty,
        materialCost,
        laborHours,
        laborCost: round2((labor.laborCost || 0) * share),
        freightCost,
        totalCost: materialCost + freightCost + round2((labor.laborCost || 0) * share),
        quantityBasis: quantityBasisFor(it.name, takeoff, state),
        assumptions: assumptionsFor(assemblyId, state)
      };
    });
  }

  function getEstimateItemsByAssembly(assemblyId) { return latestEstimateItems.filter(item => item.assemblyId === assemblyId); }
  function getObjectsByEstimateItem(itemId) { return latestEstimateItems.find(item => item.id === itemId)?.linkedObjectIds ?? []; }
  function getTraceForEstimateItem(itemId) {
    const item = latestEstimateItems.find(row => row.id === itemId);
    if (!item) return null;
    return { itemId, formula: item.quantityBasis, inputs: { lengthFt: latestState?.geom.lenFt, widthFt: latestState?.geom.widFt, spacingIn: latestState?.walls.studSpacingIn }, result: item.quantity };
  }
  function getAssemblySummary(assemblyId) {
    const rows = getEstimateItemsByAssembly(assemblyId);
    return rows.reduce((sum, row) => ({ materialCost: sum.materialCost + row.materialCost, laborHours: sum.laborHours + row.laborHours, laborCost: sum.laborCost + row.laborCost, freightCost: sum.freightCost + row.freightCost, totalCost: sum.totalCost + row.totalCost }), { materialCost:0, laborHours:0, laborCost:0, freightCost:0, totalCost:0 });
  }

  function renderAssemblyInspector(selection={}) {
    const panel = $("assemblyInspector");
    if (!panel || !latestState) return;
    if (selection.type === "estimate") {
      const item = latestEstimateItems.find(row => row.id === selection.itemId);
      const trace = getTraceForEstimateItem(selection.itemId);
      panel.innerHTML = `<h2>Estimate Inspector</h2><h3>${item.item}</h3><div class="metric-grid"><div><b>${round2(item.quantity)}</b><span>${item.unit === "LS" ? "LOT" : item.unit}</span></div><div><b>${money(item.totalCost)}</b><span>Total</span></div></div><p>${item.quantityBasis}</p><b>Linked objects</b><p>${getObjectsByEstimateItem(item.id).join(", ")}</p><b>Calculation trace</b><pre>${JSON.stringify(trace, null, 2)}</pre>`;
      return;
    }
    const assemblyId = selection.assemblyId;
    const rows = assemblyId ? getEstimateItemsByAssembly(assemblyId) : [];
    const summary = assemblyId ? getAssemblySummary(assemblyId) : latestTotals;
    const warnings = latestWarnings.filter(w => !assemblyId || w.assemblyId === assemblyId);
    panel.innerHTML = `<h2>Assembly Inspector</h2><h3>${selection.label ?? "Select a wall, roof, opening, or estimate row"}</h3><p class="muted">Current mode: ${latestState.walls.visualMode}. Shed ${latestState.geom.lenFt}' × ${latestState.geom.widFt}' × ${latestState.geom.htFt}'.</p><div class="metric-grid"><div><b>${money(summary.materialCost ?? latestTotals.material)}</b><span>Material</span></div><div><b>${round2(summary.laborHours ?? 0)}</b><span>Labor hrs</span></div><div><b>${money(summary.freightCost ?? latestTotals.freight)}</b><span>Freight/Handling</span></div><div><b>${money(summary.totalCost ?? latestTotals.total)}</b><span>Total</span></div></div><b>Related estimate items</b><ul>${(rows.length ? rows : latestEstimateItems.slice(0,4)).map(r=>`<li>${r.item} · ${money(r.totalCost)}</li>`).join("")}</ul><b>Assumptions / warnings</b><ul>${warnings.map(w=>`<li>${w.message}</li>`).join("") || "<li>No advisory warnings for this selection.</li>"}</ul>`;
  }

  function renderSummaryRail(totals) {
    const target = $("estimateSummaryCompact");
    if (!target) return;
    target.innerHTML = `<div><span>Material</span><b>${money(totals.material)}</b></div><div><span>Labor</span><b>${money(totals.labor)}</b></div><div><span>Freight / Handling</span><b>${money(totals.freight + totals.handling)}</b></div><div><span>Total</span><b>${money(totals.total)}</b></div>`;
  }

  function renderWarnings(warnings) {
    const html = warnings.map(w => `<li class="warning-${w.severity}">${w.message}</li>`).join("");
    const left = $("warningsPanel"); if (left) left.innerHTML = html || "<li>No warnings.</li>";
    const drawer = $("estimateAssumptions"); if (drawer) drawer.innerHTML = html || "<li>No advisory warnings.</li>";
  }

  function highlightEstimateRowsForAssembly(assemblyId) {
    document.querySelectorAll("#takeoffBody tr").forEach(tr => tr.classList.toggle("estimate-row-linked", tr.dataset.assembly === assemblyId));
  }

  function sectionForAssembly(assembly) { return ({ foundation:"Foundation", floor:"Floor", walls:"Walls", doors:"Openings", windows:"Openings", openings:"Openings", roof:"Roof", logistics:"Logistics", shed:"Labor" })[assembly] ?? "Shed"; }
  function slugify(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 42); }
  function quantityBasisFor(name, takeoff, state) {
    const lower = name.toLowerCase();
    if (lower.includes("stud")) return "Wall length / stud spacing + corners + opening framing";
    if (lower.includes("sheath")) return "Net assembly area divided by sheet coverage with waste factor";
    if (lower.includes("roof")) return "Roof footprint adjusted for overhang and slope";
    if (lower.includes("gravel") || lower.includes("concrete")) return "Foundation footprint, depth/thickness, and selected foundation type";
    return "Quantity calculated by existing shed takeoff rules";
  }
  function assumptionsFor(assembly, state) { return [`${sectionForAssembly(assembly)} quantities preserve existing estimator formulas.`, `Freight multiplier ${state.logistics.shipMult}; handling ${round2(state.logistics.handlingPct * 100)}%.`]; }


  // listeners
  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", computeAndRender);
    el.addEventListener("change", computeAndRender);
  });

  $("btnReset").addEventListener("click", () => {
    applyStateToUI(defaultState(), document);
    document.body.classList.remove("basic-mode");
    computeAndRender();
  });

  document.querySelectorAll(".mode-chip").forEach(btn => btn.addEventListener("click", () => {
    $("visualMode").value = btn.dataset.mode;
    document.querySelectorAll(".mode-chip").forEach(b => b.classList.toggle("active", b === btn));
    computeAndRender();
  }));

  document.querySelectorAll("[data-camera]").forEach(btn => btn.addEventListener("click", () => scene.setCameraPreset?.(btn.dataset.camera)));

  document.querySelectorAll(".config-section summary").forEach(summary => summary.addEventListener("click", () => { setTimeout(() => summary.parentElement.scrollIntoView({ block:"nearest" }), 0); }));
  $("basicModeToggle")?.addEventListener("click", () => { document.body.classList.toggle("basic-mode"); computeAndRender(); });

  $("visualMode").addEventListener("change", () => {
    document.querySelectorAll(".mode-chip").forEach(b => b.classList.toggle("active", b.dataset.mode === $("visualMode").value));
  });

  $("btnCopyJson").addEventListener("click", async () => {
    const state = readStateFromInputs(document);
    const text = JSON.stringify(state, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      $("badge").textContent = "Copied inputs JSON to clipboard.";
      setTimeout(computeAndRender, 800);
    } catch {
      alert(text);
    }
  });

  computeAndRender();
  window.addEventListener("resize", () => scene.resize());
}

main();
