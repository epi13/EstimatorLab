import { readStateFromUI, defaultState, applyStateToUI } from "./state.js";
import { createScene } from "../three/scene.js";
import { buildTakeoff } from "./calc/takeoff.js";
import { costItems } from "./calc/costing.js";
import { calcLaborHours } from "./calc/labor.js";

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
    "vapor_barrier":{desc:"10 mil VB",unit:"SF",base_price:0.12,freight_class:"flat"}
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

  function render(state, takeoff, costs, labor) {
    $("outMatBase").textContent = money(costs.matBase);
    $("outShip").textContent = money(costs.ship);
    $("outHand").textContent = money(costs.handling);
    $("outMatDel").textContent = money(costs.matDelivered);

    $("outMH").textContent = round2(labor.mh).toString();
    $("outLabor").textContent = money(labor.laborCost);
    $("outTotal").textContent = money(costs.matDelivered + labor.laborCost);

    const tbody = $("takeoffBody");
    tbody.innerHTML = "";
    for (const it of takeoff.items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${it.name}</td><td>${round2(it.qty)}</td><td>${it.unit}</td><td>${money(it.base)}</td>`;
      tbody.appendChild(tr);
    }

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

    scene.rebuild(state);
  }

  function computeAndRender() {
    const state = readStateFromUI(document);

    const takeoff = buildTakeoff(state, db);
    const costs = costItems(takeoff.items, db, state.logistics, freightRules);
    const labor = calcLaborHours(state, takeoff, laborRates);

    render(state, takeoff, costs, labor);
  }

  // listeners
  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", computeAndRender);
    el.addEventListener("change", computeAndRender);
  });

  $("btnReset").addEventListener("click", () => {
    applyStateToUI(defaultState(), document);
    computeAndRender();
  });

  $("btnCopyJson").addEventListener("click", async () => {
    const state = readStateFromUI(document);
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
