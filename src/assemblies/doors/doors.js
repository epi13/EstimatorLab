/** ============ DEFAULT CONFIG (Anchorage + March 2025 reference) ============ */
const DEFAULT_CONFIG = {
  laborRates: { Civil: 82, Architectural: 87, Structural: 90, Mechanical: 92, Electrical: 96 },

  general: { referenceHeightFt: 7, useReferenceForManDoors: true },

  doorTypes: {
    "Man Door": {
      trade: "Architectural",
      materials: {
        "HM - Exterior (Insulated)": {
          pricing_mode: "reference",
          door_price_by_width: { "3-0": 1240, "4-0": 1580, "6-0": 2470 },
          door_labor_by_width: { "3-0": 115,  "4-0": 125,  "6-0": 220  },
          weight_lbs_per_sf: 4.5
        },
        "HM - Interior": {
          pricing_mode: "reference",
          door_price_by_width: { "3-0": 1240 },
          door_labor_by_width: { "3-0": 115 },
          weight_lbs_per_sf: 4.0
        },
        "Solid Core Wood (Prefinished)": {
          pricing_mode: "reference_flat",
          door_price: 730,
          door_labor: 115,
          weight_lbs_per_sf: 4.0
        },
        "Aluminum Storefront": {
          pricing_mode: "per_sf",
          cost_per_sf: 35,
          labor_mh_per_sf: 0.06,
          weight_lbs_per_sf: 3.0
        }
      },
      per_sf_fallback: { cost_per_sf: 22, labor_mh_per_sf: 0.05, weight_lbs_per_sf: 4.5 }
    },

    "Sectional Overhead": {
      trade: "Structural",
      materials: {
        "Insulated Steel":    { cost_per_sf: 28, labor_mh_per_sf: 0.18, weight_lbs_per_sf: 4.0 },
        "Non-Insulated Steel":{ cost_per_sf: 20, labor_mh_per_sf: 0.16, weight_lbs_per_sf: 3.0 },
        "Aluminum":           { cost_per_sf: 32, labor_mh_per_sf: 0.18, weight_lbs_per_sf: 3.2 }
      }
    },

    "Roll-Up (Coil)": {
      trade: "Structural",
      materials: {
        "Galvanized Steel": { cost_per_sf: 26, labor_mh_per_sf: 0.22, weight_lbs_per_sf: 3.5 },
        "Stainless Steel":  { cost_per_sf: 38, labor_mh_per_sf: 0.24, weight_lbs_per_sf: 4.0 },
        "Aluminum":         { cost_per_sf: 30, labor_mh_per_sf: 0.22, weight_lbs_per_sf: 3.0 }
      }
    }
  },

  frames: {
    interior_hm: {
      price_by_width: { "3-0": 480 },
      labor_by_width: { "3-0": 130 }
    },
    exterior_ins_hm: {
      price_by_width: { "3-0": 460, "4-0": 620, "6-0": 775 },
      labor_by_width: { "3-0": 145, "4-0": 155, "6-0": 170 }
    }
  },

  glazing_flat: {
    narrow: { mat: 285, labor: 95 },
    half:   { mat: 510, labor: 125 },
    full:   { mat: 1025, labor: 235 }
  },
  glazing_per_sf: { door: { mat: 55, labor: 20 }, transom_sidelite: { mat: 115, labor: 25 } },

  hardware_packs: {
    none: { mat: 0, labor: 0 },
    int_set: { mat: 625, labor: 305 },
    ext_set: { mat: 895, labor: 385 },
    panic_rim: { mat: 2485, labor: 265 },
    closer_std: { mat: 250, labor: 155 },
    closer_hd: { mat: 420, labor: 155 },
    normal_amenities: { mat: 315, labor: 215 }
  },

  hardware_addons: {
    deadbolt:       { mat: 100, labor: 80 },
    hinge_5kn:      { mat: 170, labor: 60 },
    lever_passage:  { mat: 175, labor: 85 },
    lever_privacy:  { mat: 175, labor: 85 },
    lever_keyed:    { mat: 205, labor: 90 },
    keypad_mech:    { mat: 400, labor: 155 },
    keypad_elec:    { mat: 815, labor: 235 },
    electric_strike:{ mat: 830, labor: 115 },
    electric_hinges:{ mat: 790, labor: 115 },
    door_contacts:  { mat: 230, labor: 115 },
    card_reader:    { mat: 460, labor: 435 },
    power_supply:   { mat: 570, labor: 215 }
  },

  shipping: {
    method: {
      "Road System (Anch/Mat-Su)": { base_per_lb: 0.60, handling_pct: 0.05 },
      "Barge (Coastal/SE/W AK)":   { base_per_lb: 1.80, handling_pct: 0.08 },
      "Air Cargo (Remote/Exp)":    { base_per_lb: 3.20, handling_pct: 0.10 }
    },
    min_charge: 75
  }
};

/** ==================== Helpers ==================== */
const $ = s => document.querySelector(s);
const fmt = v => v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const feet = (ft, inch) => (isFinite(+ft) ? +ft : 0) + (isFinite(+inch) ? +inch : 0)/12;
const areaSF = (wft, win, hft, hin) => feet(wft, win) * feet(hft, hin);

function widthBand(w_ft, w_in) {
  const w = feet(w_ft, w_in);
  if (w <= 3.33) return "3-0";
  if (w <= 4.33) return "4-0";
  return "6-0";
}
function scaled(val, curHft, refHft) {
  if (!isFinite(val)) return 0;
  return val * (Math.max(1e-6, curHft) / Math.max(1e-6, refHft));
}
function addRow(tbody, label, units, unitCost, ext) {
  const tr = document.createElement("tr");
  const td1 = document.createElement("td"); td1.textContent = label;
  const td2 = document.createElement("td"); td2.textContent = units || "—";
  const td3 = document.createElement("td"); td3.textContent = unitCost != null ? fmt(unitCost) : "—";
  const td4 = document.createElement("td"); td4.textContent = fmt(ext || 0);
  tr.append(td1, td2, td3, td4); tbody.appendChild(tr);
}

/** ==================== UI wiring ==================== */
let CONFIG = structuredClone(DEFAULT_CONFIG);

function populateDoorTypes() {
  const sel = $("#doorType"); sel.innerHTML = "";
  Object.keys(CONFIG.doorTypes).forEach(k => {
    const o = document.createElement("option"); o.value = k; o.textContent = k; sel.appendChild(o);
  });
}
function populateMaterials() {
  const t = $("#doorType").value, sel = $("#material"); sel.innerHTML = "";
  const mats = CONFIG.doorTypes[t].materials;
  Object.keys(mats).forEach(k => {
    const o = document.createElement("option"); o.value = k; o.textContent = k; sel.appendChild(o);
  });
}
function populateShipping() {
  const sel = $("#shipMethod"); sel.innerHTML = "";
  Object.keys(CONFIG.shipping.method).forEach(k => {
    const o = document.createElement("option"); o.value = k; o.textContent = k; sel.appendChild(o);
  });
}
function loadConfigBox() { $("#configBox").value = JSON.stringify(CONFIG, null, 2); }
function restoreDefaults() {
  CONFIG = structuredClone(DEFAULT_CONFIG);
  populateDoorTypes(); populateMaterials(); populateShipping(); loadConfigBox();
}
function applyConfig() {
  try {
    const parsed = JSON.parse($("#configBox").value);
    CONFIG = parsed;
    populateDoorTypes(); populateMaterials(); populateShipping();
    alert("Config applied.");
  } catch (e) { alert("Invalid JSON in Pricing Config.\n\n" + e.message); }
}

/** ==================== Cost calcs ==================== */
function calcManDoorCosts(area, w_ft, w_in, h_ft, h_in, qty, matKey, frameOpt, glazingOpt, customGlassSf, tsGlassSf, packKey, addOnKeys, remotePct) {
  const refH = CONFIG.general.referenceHeightFt;
  const band = widthBand(w_ft, w_in);
  const matCfg = CONFIG.doorTypes["Man Door"].materials[matKey];
  const rate = CONFIG.laborRates.Architectural;
  let matSubtotal = 0, laborSubtotal = 0, weightPerDoor = (matCfg.weight_lbs_per_sf || 4.0) * area;
  const hFeet = feet(h_ft, h_in);

  const useRef = CONFIG.general.useReferenceForManDoors && (matCfg.pricing_mode?.startsWith("reference"));

  // Door leaf
  if (useRef) {
    let basePrice=0, baseLabor=0;
    if (matCfg.pricing_mode === "reference") {
      basePrice = matCfg.door_price_by_width[band] ?? 0;
      baseLabor = matCfg.door_labor_by_width[band] ?? 0;
    } else { // reference_flat
      basePrice = matCfg.door_price ?? 0;
      baseLabor = matCfg.door_labor ?? 0;
    }
    matSubtotal += scaled(basePrice, hFeet, refH) * qty;
    laborSubtotal += scaled(baseLabor, hFeet, refH) * qty;
  } else {
    const f = CONFIG.doorTypes["Man Door"].per_sf_fallback;
    matSubtotal += f.cost_per_sf * area * qty;
    laborSubtotal += (f.labor_mh_per_sf * area * rate) * qty;
  }

  // Frame
  if (frameOpt !== "none") {
    const fcfg = frameOpt === "interior" ? CONFIG.frames.interior_hm : CONFIG.frames.exterior_ins_hm;
    const p = fcfg.price_by_width[band] ?? 0, l = fcfg.labor_by_width[band] ?? 0;
    matSubtotal += scaled(p, hFeet, refH) * qty;
    laborSubtotal += scaled(l, hFeet, refH) * qty;
    weightPerDoor *= 1.15;
  }

  // Glazing (flat + per sf)
  if (glazingOpt !== "none") {
    const g = CONFIG.glazing_flat[glazingOpt]; if (g) { matSubtotal += g.mat * qty; laborSubtotal += g.labor * qty; }
  }
  if (customGlassSf > 0) {
    const cg = CONFIG.glazing_per_sf.door; matSubtotal += cg.mat * customGlassSf * qty; laborSubtotal += cg.labor * customGlassSf * qty;
  }
  if (tsGlassSf > 0) {
    const ts = CONFIG.glazing_per_sf.transom_sidelite; matSubtotal += ts.mat * tsGlassSf * qty; laborSubtotal += ts.labor * tsGlassSf * qty;
  }

  // Hardware (pack + add-ons)
  const pack = CONFIG.hardware_packs[packKey] ?? { mat:0, labor:0 };
  matSubtotal += pack.mat * qty; laborSubtotal += pack.labor * qty;
  addOnKeys.forEach(k => { const a = CONFIG.hardware_addons[k]; if (a) { matSubtotal += a.mat * qty; laborSubtotal += a.labor * qty; } });

  // Remote factor on labor
  laborSubtotal *= (1 + remotePct);

  return { matSubtotal, laborSubtotal, weightPerDoor };
}

function calcPerSfDoor(typeKey, matKey, area, qty, remotePct) {
  const tcfg = CONFIG.doorTypes[typeKey];
  const m = tcfg.materials[matKey];
  const rate = CONFIG.laborRates[tcfg.trade] ?? 87;
  const mat = (m.cost_per_sf || 0) * area * qty;
  const labor = (m.labor_mh_per_sf || 0) * area * rate * (1 + remotePct) * qty;
  const weightPerDoor = (m.weight_lbs_per_sf || 3.5) * area;
  return { matSubtotal: mat, laborSubtotal: labor, weightPerDoor };
}

/** ==================== Calculate ==================== */
function calculate() {
  const t = $("#doorType").value, m = $("#material").value;
  const qty = Math.max(1, Math.floor(+$("#qty").value || 1));
  const wft = +$("#w_ft").value, win = +$("#w_in").value;
  const hft = +$("#h_ft").value, hin = +$("#h_in").value;
  const area = areaSF(wft, win, hft, hin);
  const shipKey = $("#shipMethod").value;
  const remotePct = Math.max(0, +$("#remotePct").value || 0) / 100;
  const opPct = Math.max(0, +$("#opPct").value || 0) / 100;

  const frameOpt = $("#frameOpt").value;
  const glazingOpt = $("#glazingOpt").value;
  const customGlassSf = Math.max(0, +$("#customGlassSf").value || 0);
  const tsGlassSf = Math.max(0, +$("#tsGlassSf").value || 0);
  const packKey = $("#hardwarePack").value;
  const addOnKeys = Array.from($("#hardwareAddOns").selectedOptions).map(o => o.value);

  const tbody = $("#resultsBody"); tbody.innerHTML = "";

  let matSubtotal = 0, laborSubtotal = 0, weightPerDoor = 0, trade = CONFIG.doorTypes[t].trade;

  if (t === "Man Door") {
    const res = calcManDoorCosts(area, wft, win, hft, hin, qty, m, frameOpt, glazingOpt, customGlassSf, tsGlassSf, packKey, addOnKeys, remotePct);
    matSubtotal += res.matSubtotal; laborSubtotal += res.laborSubtotal; weightPerDoor = res.weightPerDoor;
  } else {
    const res = calcPerSfDoor(t, m, area, qty, remotePct);
    matSubtotal += res.matSubtotal; laborSubtotal += res.laborSubtotal; weightPerDoor = res.weightPerDoor;
  }

  // Shipping (DECLARED ONCE — FIX)
  const shipCfg = CONFIG.shipping.method[shipKey];
  const perDoorShip = Math.max( (weightPerDoor * (shipCfg.base_per_lb || 0)) * (1 + (shipCfg.handling_pct || 0)), CONFIG.shipping.min_charge / qty );
  const shipSubtotal = perDoorShip * qty;

  // O&P
  const subtotal = matSubtotal + laborSubtotal + shipSubtotal;
  const opAmt = subtotal * opPct;
  const total = subtotal + opAmt;

  // Rows
  addRow(tbody, "Door Type / Material", `${t} / ${m}`, null, 0);
  addRow(tbody, "Quantity", `${qty}`, null, 0);
  addRow(tbody, "Area (per door)", `${area.toFixed(2)} sf`, null, 0);

  if (t === "Man Door") {
    const band = widthBand(wft, win);
    const refH = CONFIG.general.referenceHeightFt;
    const hFeet = feet(hft, hin);
    const matCfg = CONFIG.doorTypes["Man Door"].materials[m];

    if (CONFIG.general.useReferenceForManDoors && (matCfg.pricing_mode?.startsWith("reference"))) {
      let basePrice=0, baseLabor=0;
      if (matCfg.pricing_mode === "reference") {
        basePrice = matCfg.door_price_by_width[band] ?? 0;
        baseLabor = matCfg.door_labor_by_width[band] ?? 0;
      } else { basePrice = matCfg.door_price ?? 0; baseLabor = matCfg.door_labor ?? 0; }
      addRow(tbody, "Door Leaf (ref)", `${band} scaled to ${hFeet.toFixed(2)}'`, basePrice, scaled(basePrice, hFeet, refH) * qty);
      addRow(tbody, "Door Leaf Labor (ref)", `${band} scaled`, baseLabor, scaled(baseLabor, hFeet, refH) * (1+remotePct) * qty);
    } else {
      const f = CONFIG.doorTypes["Man Door"].per_sf_fallback;
      const rate = CONFIG.laborRates.Architectural;
      addRow(tbody, "Door Leaf (per sf)", `${area.toFixed(2)} sf`, f.cost_per_sf, f.cost_per_sf * area * qty);
      addRow(tbody, "Door Labor (per sf)", `${area.toFixed(2)} sf`, f.labor_mh_per_sf*rate, f.labor_mh_per_sf*rate*(1+remotePct)*area*qty);
    }

    if (frameOpt !== "none") {
      const fcfg = frameOpt === "interior" ? CONFIG.frames.interior_hm : CONFIG.frames.exterior_ins_hm;
      const p = fcfg.price_by_width[band] ?? 0, l = fcfg.labor_by_width[band] ?? 0;
      addRow(tbody, "Frame (ref)", `${band} scaled`, p, scaled(p, hFeet, refH)*qty);
      addRow(tbody, "Frame Labor (ref)", `${band} scaled`, l, scaled(l, hFeet, refH)*(1+remotePct)*qty);
    }

    if (glazingOpt !== "none") {
      const g = CONFIG.glazing_flat[glazingOpt];
      if (g) { addRow(tbody, `Glazing (${glazingOpt})`, "each", g.mat, g.mat*qty);
              addRow(tbody, `Glazing Labor (${glazingOpt})`, "each", g.labor, g.labor*(1+remotePct)*qty); }
    }
    if (customGlassSf > 0) {
      const cg = CONFIG.glazing_per_sf.door;
      addRow(tbody, "Custom Door Glazing", `${customGlassSf} sf`, cg.mat, cg.mat*customGlassSf*qty);
      addRow(tbody, "Custom Door Glazing Labor", `${customGlassSf} sf`, cg.labor, cg.labor*(1+remotePct)*customGlassSf*qty);
    }
    if (tsGlassSf > 0) {
      const ts = CONFIG.glazing_per_sf.transom_sidelite;
      addRow(tbody, "Transom/Sidelites Glazing", `${tsGlassSf} sf`, ts.mat, ts.mat*tsGlassSf*qty);
      addRow(tbody, "Transom/Sidelites Labor", `${tsGlassSf} sf`, ts.labor, ts.labor*(1+remotePct)*tsGlassSf*qty);
    }

    const pack = CONFIG.hardware_packs[packKey] ?? { mat:0, labor:0 };
    if (packKey !== "none") {
      addRow(tbody, `Hardware Pack (${packKey})`, "each", pack.mat, pack.mat*qty);
      addRow(tbody, `Hardware Pack Labor`, "each", pack.labor, pack.labor*(1+remotePct)*qty);
    }
    addOnKeys.forEach(k => {
      const a = CONFIG.hardware_addons[k];
      if (a) {
        addRow(tbody, `Add-On: ${k}`, "each", a.mat, a.mat*qty);
        addRow(tbody, `Add-On Labor: ${k}`, "each", a.labor, a.labor*(1+remotePct)*qty);
      }
    });
  } else {
    const mcfg = CONFIG.doorTypes[t].materials[m];
    addRow(tbody, "Material (per sf)", `${area.toFixed(2)} sf`, mcfg.cost_per_sf, mcfg.cost_per_sf * area * qty);
    const rate = CONFIG.laborRates[trade] ?? 87;
    const mh = mcfg.labor_mh_per_sf || 0;
    addRow(tbody, "Labor (per sf)", `${area.toFixed(2)} sf`, mh*rate, mh*rate*(1+remotePct)*area*qty);
  }

  // Shipping row (REUSE shipCfg)
  addRow(
    tbody,
    "Shipping + Handling",
    `${shipKey}`,
    shipCfg.base_per_lb,
    perDoorShip * qty
  );

  // Totals
  document.getElementById("subtotal").textContent = fmt(subtotal);
  document.getElementById("opAmt").textContent = fmt(opAmt);
  document.getElementById("grandTotal").textContent = fmt(total);

  document.getElementById("assump").innerHTML =
    `Man Door band: <b>${widthBand(wft, win)}</b>; height scaled vs. ${CONFIG.general.referenceHeightFt}'-0"; ` +
    `Remote factor on labor: <b>${Math.round(remotePct*100)}%</b>; Shipping min ${fmt(CONFIG.shipping.min_charge)} applies.`;
}

/** ==================== Init ==================== */
function init() {
  populateDoorTypes(); populateMaterials(); populateShipping(); loadConfigBox();
  document.getElementById("doorType").addEventListener("change", () => { populateMaterials(); });
  document.getElementById("applyCfg").addEventListener("click", applyConfig);
  document.getElementById("restoreCfg").addEventListener("click", restoreDefaults);
  document.getElementById("calcBtn").addEventListener("click", calculate);
  document.getElementById("resetBtn").addEventListener("click", () => location.reload());
}
init();
