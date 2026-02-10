/* Alaska Cost Factor Builder (ACF)
 * Offline vanilla JS editor for the ACF JSON schema.
 * - Import/Export JSON
 * - Add/Remove transport legs
 * - Live composite factor preview (simple multiplication of section multipliers)
 */

const ENUMS = {
  industry: ["General","Government","Military","Healthcare","Education","Aviation","Marine","Utilities","OilAndGas","Mining","Fishing","Tourism","Industrial","Residential","Commercial"],
  projectType: ["NewConstruction","Renovation","OccupiedRenovation","CriticalFacility"],
  baselineRegion: ["Anchorage","Fairbanks","Lower48","Other"],
  baselineBasis: ["UnitCosts","Assemblies","RSMeans","HistoricalHMS","VendorQuotes","EngineerEstimate","Other"],

  region: ["Southcentral","Southeast","Interior","Southwest","Arctic","Aleutians","Western"],

  transportMode: ["Road","Barge","Ferry","AirCargo","CharterAir","WinterRoad","Helicopter","Other"],
  transportSeason: ["AllYear","Summer","Winter","Shoulder","Unknown"],

  seasonalAccessType: ["YearRound","SummerOnly","WinterOnly","ShoulderSeason","HighlyVariable"],
  deliveryWindowType: ["Normal","Narrow","SingleShipmentCritical","MultiShipmentComplex"],

  availabilityLevel: ["FullLocalTrades","PartialLocalTrades","FlyInCrews","SpecializedFlyInOnly"],
  rotationModel: ["LocalDaily","5x2","4x3","2x2","3x3","Other"],
  travelPolicy: ["Paid","Unpaid","Mixed","Unknown"],

  climateZone: ["Southeast","Southcentral","Interior","ArcticCoastal","Aleutians","Western"],
  wageBasis: ["CompanyRates","AnchorageDefault","PrevailingWage","UnionCBA","FederalDavisBacon","Unknown"],

  popBand: ["Over100k","10kTo100k","1kTo10k","Under1k"],
  bidderDepth: ["High","Moderate","Low","SingleSourceLikely"],

  remodelLevel: ["None","Renovation","OccupiedRenovation","CriticalFacility"],
  scaleBand: ["Under250k","250kTo1M","1MTo10M","Over10M"],

  schedLevel: ["Low","Moderate","High","Extreme"],
  permitLevel: ["Low","Moderate","High","FederalOrTribalHeavy"],

  contingencyApplies: ["MaterialsOnly","LaborOnly","DirectCosts","Total","Unknown"]
};

function $(id){ return document.getElementById(id); }
function clamp(n, min, max){
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function num(id, min=0, max=1e12){
  const v = Number($(id).value);
  return clamp(v, min, max);
}
function mult(id){
  return clamp(Number($(id).value), 0.5, 10);
}
function text(id){
  return ($(id).value ?? "").toString();
}
function csvToArray(s){
  const raw = (s || "").split(",").map(x => x.trim()).filter(Boolean);
  return raw;
}
function arrayToCsv(arr){
  if (!Array.isArray(arr)) return "";
  return arr.join(", ");
}

function fillSelect(id, options){
  const sel = $(id);
  sel.innerHTML = "";
  for (const o of options){
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  }
}

function initEnums(){
  fillSelect("project_industry", ENUMS.industry);
  fillSelect("project_type", ENUMS.projectType);
  fillSelect("project_baseline_region", ENUMS.baselineRegion);
  fillSelect("project_baseline_basis", ENUMS.baselineBasis);

  fillSelect("loc_region", ENUMS.region);

  fillSelect("log_season_access_type", ENUMS.seasonalAccessType);
  fillSelect("log_delivery_window_type", ENUMS.deliveryWindowType);

  fillSelect("wf_availability_level", ENUMS.availabilityLevel);
  fillSelect("wf_rotation_model", ENUMS.rotationModel);
  fillSelect("wf_travel_policy", ENUMS.travelPolicy);
  fillSelect("wf_climate_zone", ENUMS.climateZone);
  fillSelect("wf_wage_basis", ENUMS.wageBasis);

  fillSelect("mk_pop_band", ENUMS.popBand);
  fillSelect("mk_bidder_depth", ENUMS.bidderDepth);

  fillSelect("pc_remodel_level", ENUMS.remodelLevel);
  fillSelect("pc_scale_band", ENUMS.scaleBand);

  fillSelect("rk_sched_level", ENUMS.schedLevel);
  fillSelect("rk_permit_level", ENUMS.permitLevel);
  fillSelect("rk_cont_applies", ENUMS.contingencyApplies);
}

function defaultModel(){
  return {
    meta: {
      schema_version: "1.0.0",
      created_at: new Date().toISOString(),
      created_by: "",
      notes: ""
    },
    project: {
      name: "",
      industry: "General",
      project_type: "NewConstruction",
      size: { gross_sf: 0, estimated_value_usd: 0 },
      baseline: {
        baseline_region: "Anchorage",
        baseline_cost_basis: "HistoricalHMS",
        baseline_reference: ""
      }
    },
    location: {
      state: "AK",
      place_name: "",
      region: "Southcentral",
      road_system_tier: 0,
      population: { population_count: 0, density_per_sq_mi: 0 },
      proximity: {
        nearest_hub_name: "",
        nearest_hub_distance_miles: 0,
        nearest_port_name: "",
        nearest_port_distance_miles: 0
      }
    },
    logistics: {
      transport_legs: [
        { mode: "Road", distance_miles: 0, season: "AllYear", cost_index: 1.0, constraints: [], notes: "" }
      ],
      seasonal_access: { access_type: "YearRound", season_weight: 1.0, constraints: [] },
      delivery_window: { window_type: "Normal", risk_premium: 1.0, notes: "" },
      material_handling: { handling_complexity: 0, multiplier: 1.0, drivers: [] }
    },
    workforce: {
      local_labor_availability: { availability_level: "FullLocalTrades", multiplier: 1.0, notes: "" },
      crew_mobilization: {
        rotation_model: "LocalDaily",
        camp_required: false,
        travel_time_policy: "Unknown",
        multiplier: 1.0,
        components: { per_diem_usd_per_day: 0, camp_cost_usd_per_person_day: 0, airfare_usd_per_person_roundtrip: 0 }
      },
      productivity: { climate_zone: "Southcentral", climate_factor: 1.0, setup_teardown_overhead_factor: 1.0, drivers: [] },
      wage_overlay: { wage_basis: "AnchorageDefault", multiplier: 1.0, notes: "" }
    },
    market: {
      population_gravity: { band: "Over100k", multiplier: 1.0 },
      competition: { bidder_depth: "High", multiplier: 1.0, notes: "" },
      industry_pressure: { dominant_industries: [], multiplier: 1.0, notes: "" }
    },
    project_characteristics: {
      remodel_complexity: { level: "None", multiplier: 1.0, notes: "" },
      scale_curve: { band: "1MTo10M", multiplier: 1.0 },
      site_constraints: { constraint_score: 0, multiplier: 1.0, drivers: [] }
    },
    risk: {
      unknowns_index: { score: 0, multiplier: 1.0, drivers: [] },
      schedule_volatility: { level: "Low", multiplier: 1.0, drivers: [] },
      permitting_complexity: { level: "Low", multiplier: 1.0, notes: "" },
      contingency: { contingency_percent: 0, applies_to: "Unknown" }
    },
    weights: { logistics: 1, workforce: 1, market: 1, project_characteristics: 1, risk: 1 },
    computed: {
      logistics_factor: 1.0,
      workforce_factor: 1.0,
      market_factor: 1.0,
      project_factor: 1.0,
      risk_factor: 1.0,
      acf_total_factor: 1.0
    }
  };
}

let MODEL = defaultModel();

/* ---------- Transport legs UI ---------- */
function createLegEl(leg, index){
  const tpl = $("tplLeg");
  const node = tpl.content.firstElementChild.cloneNode(true);

  node.querySelector("[data-leg-index]").textContent = `#${index+1}`;

  const selMode = node.querySelector("[data-leg-mode]");
  const selSeason = node.querySelector("[data-leg-season]");
  fillSelectInto(selMode, ENUMS.transportMode);
  fillSelectInto(selSeason, ENUMS.transportSeason);

  selMode.value = leg.mode ?? "Road";
  selSeason.value = leg.season ?? "AllYear";

  node.querySelector("[data-leg-distance]").value = leg.distance_miles ?? 0;
  node.querySelector("[data-leg-costindex]").value = leg.cost_index ?? 1.0;
  node.querySelector("[data-leg-constraints]").value = arrayToCsv(leg.constraints);
  node.querySelector("[data-leg-notes]").value = leg.notes ?? "";

  node.querySelector("[data-remove-leg]").addEventListener("click", () => {
    MODEL.logistics.transport_legs.splice(index, 1);
    if (MODEL.logistics.transport_legs.length === 0){
      MODEL.logistics.transport_legs.push({ mode:"Road", distance_miles:0, season:"AllYear", cost_index:1.0, constraints:[], notes:"" });
    }
    renderLegs();
    syncPreview();
  });

  // Bind changes back to model
  node.addEventListener("input", () => {
    const mode = selMode.value;
    const dist = clamp(Number(node.querySelector("[data-leg-distance]").value), 0, 1e9);
    const season = selSeason.value;
    const cost = clamp(Number(node.querySelector("[data-leg-costindex]").value), 0.5, 10);
    const constraints = csvToArray(node.querySelector("[data-leg-constraints]").value);
    const notes = node.querySelector("[data-leg-notes]").value;

    MODEL.logistics.transport_legs[index] = {
      mode, distance_miles: dist, season, cost_index: cost, constraints, notes
    };
  });

  return node;
}
function fillSelectInto(sel, options){
  sel.innerHTML = "";
  for (const o of options){
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  }
}
function renderLegs(){
  const host = $("legs");
  host.innerHTML = "";
  MODEL.logistics.transport_legs.forEach((leg, i) => host.appendChild(createLegEl(leg, i)));
}

/* ---------- Form <-> Model ---------- */
function modelToForm(){
  // project
  $("project_name").value = MODEL.project.name;
  $("project_industry").value = MODEL.project.industry;
  $("project_type").value = MODEL.project.project_type;
  $("project_gross_sf").value = MODEL.project.size.gross_sf ?? 0;
  $("project_value_usd").value = MODEL.project.size.estimated_value_usd ?? 0;
  $("project_baseline_region").value = MODEL.project.baseline.baseline_region;
  $("project_baseline_basis").value = MODEL.project.baseline.baseline_cost_basis;
  $("project_baseline_ref").value = MODEL.project.baseline.baseline_reference ?? "";

  // location
  $("loc_state").value = MODEL.location.state ?? "AK";
  $("loc_place").value = MODEL.location.place_name ?? "";
  $("loc_region").value = MODEL.location.region ?? "Southcentral";
  $("loc_road_tier").value = MODEL.location.road_system_tier ?? 0;
  $("loc_pop_count").value = MODEL.location.population.population_count ?? 0;
  $("loc_pop_density").value = MODEL.location.population.density_per_sq_mi ?? 0;
  $("loc_hub_name").value = MODEL.location.proximity?.nearest_hub_name ?? "";
  $("loc_hub_mi").value = MODEL.location.proximity?.nearest_hub_distance_miles ?? 0;
  $("loc_port_name").value = MODEL.location.proximity?.nearest_port_name ?? "";
  $("loc_port_mi").value = MODEL.location.proximity?.nearest_port_distance_miles ?? 0;

  // logistics
  renderLegs();
  $("log_season_access_type").value = MODEL.logistics.seasonal_access.access_type ?? "YearRound";
  $("log_season_weight").value = MODEL.logistics.seasonal_access.season_weight ?? 1.0;
  $("log_season_constraints").value = arrayToCsv(MODEL.logistics.seasonal_access.constraints);
  $("log_delivery_window_type").value = MODEL.logistics.delivery_window.window_type ?? "Normal";
  $("log_delivery_risk").value = MODEL.logistics.delivery_window.risk_premium ?? 1.0;
  $("log_delivery_notes").value = MODEL.logistics.delivery_window.notes ?? "";
  $("log_handling_score").value = MODEL.logistics.material_handling.handling_complexity ?? 0;
  $("log_handling_mult").value = MODEL.logistics.material_handling.multiplier ?? 1.0;
  $("log_handling_drivers").value = arrayToCsv(MODEL.logistics.material_handling.drivers);

  $("logistics_factor").value = MODEL.computed.logistics_factor ?? 1.0;

  // workforce
  $("wf_availability_level").value = MODEL.workforce.local_labor_availability.availability_level;
  $("wf_availability_mult").value = MODEL.workforce.local_labor_availability.multiplier ?? 1.0;
  $("wf_availability_notes").value = MODEL.workforce.local_labor_availability.notes ?? "";

  $("wf_rotation_model").value = MODEL.workforce.crew_mobilization.rotation_model;
  $("wf_camp_required").value = String(!!MODEL.workforce.crew_mobilization.camp_required);
  $("wf_travel_policy").value = MODEL.workforce.crew_mobilization.travel_time_policy;
  $("wf_mob_mult").value = MODEL.workforce.crew_mobilization.multiplier ?? 1.0;
  $("wf_per_diem").value = MODEL.workforce.crew_mobilization.components?.per_diem_usd_per_day ?? 0;
  $("wf_camp_cost").value = MODEL.workforce.crew_mobilization.components?.camp_cost_usd_per_person_day ?? 0;
  $("wf_airfare").value = MODEL.workforce.crew_mobilization.components?.airfare_usd_per_person_roundtrip ?? 0;

  $("wf_climate_zone").value = MODEL.workforce.productivity.climate_zone;
  $("wf_climate_factor").value = MODEL.workforce.productivity.climate_factor ?? 1.0;
  $("wf_setup_factor").value = MODEL.workforce.productivity.setup_teardown_overhead_factor ?? 1.0;
  $("wf_prod_drivers").value = arrayToCsv(MODEL.workforce.productivity.drivers);

  $("wf_wage_basis").value = MODEL.workforce.wage_overlay.wage_basis;
  $("wf_wage_mult").value = MODEL.workforce.wage_overlay.multiplier ?? 1.0;
  $("wf_wage_notes").value = MODEL.workforce.wage_overlay.notes ?? "";

  $("workforce_factor").value = MODEL.computed.workforce_factor ?? 1.0;

  // market
  $("mk_pop_band").value = MODEL.market.population_gravity.band;
  $("mk_pop_mult").value = MODEL.market.population_gravity.multiplier ?? 1.0;

  $("mk_bidder_depth").value = MODEL.market.competition.bidder_depth;
  $("mk_comp_mult").value = MODEL.market.competition.multiplier ?? 1.0;
  $("mk_comp_notes").value = MODEL.market.competition.notes ?? "";

  $("mk_industries").value = arrayToCsv(MODEL.market.industry_pressure.dominant_industries);
  $("mk_ind_mult").value = MODEL.market.industry_pressure.multiplier ?? 1.0;
  $("mk_ind_notes").value = MODEL.market.industry_pressure.notes ?? "";

  $("market_factor").value = MODEL.computed.market_factor ?? 1.0;

  // project characteristics
  $("pc_remodel_level").value = MODEL.project_characteristics.remodel_complexity.level;
  $("pc_remodel_mult").value = MODEL.project_characteristics.remodel_complexity.multiplier ?? 1.0;
  $("pc_remodel_notes").value = MODEL.project_characteristics.remodel_complexity.notes ?? "";

  $("pc_scale_band").value = MODEL.project_characteristics.scale_curve.band;
  $("pc_scale_mult").value = MODEL.project_characteristics.scale_curve.multiplier ?? 1.0;

  $("pc_site_score").value = MODEL.project_characteristics.site_constraints.constraint_score ?? 0;
  $("pc_site_mult").value = MODEL.project_characteristics.site_constraints.multiplier ?? 1.0;
  $("pc_site_drivers").value = arrayToCsv(MODEL.project_characteristics.site_constraints.drivers);

  $("project_factor").value = MODEL.computed.project_factor ?? 1.0;

  // risk
  $("rk_unknown_score").value = MODEL.risk.unknowns_index.score ?? 0;
  $("rk_unknown_mult").value = MODEL.risk.unknowns_index.multiplier ?? 1.0;
  $("rk_unknown_drivers").value = arrayToCsv(MODEL.risk.unknowns_index.drivers);

  $("rk_sched_level").value = MODEL.risk.schedule_volatility.level;
  $("rk_sched_mult").value = MODEL.risk.schedule_volatility.multiplier ?? 1.0;
  $("rk_sched_drivers").value = arrayToCsv(MODEL.risk.schedule_volatility.drivers);

  $("rk_permit_level").value = MODEL.risk.permitting_complexity.level;
  $("rk_permit_mult").value = MODEL.risk.permitting_complexity.multiplier ?? 1.0;
  $("rk_permit_notes").value = MODEL.risk.permitting_complexity.notes ?? "";

  $("rk_cont_pct").value = MODEL.risk.contingency?.contingency_percent ?? 0;
  $("rk_cont_applies").value = MODEL.risk.contingency?.applies_to ?? "Unknown";

  $("risk_factor").value = MODEL.computed.risk_factor ?? 1.0;

  // weights
  $("wt_logistics").value = MODEL.weights?.logistics ?? 1;
  $("wt_workforce").value = MODEL.weights?.workforce ?? 1;
  $("wt_market").value = MODEL.weights?.market ?? 1;
  $("wt_project").value = MODEL.weights?.project_characteristics ?? 1;
  $("wt_risk").value = MODEL.weights?.risk ?? 1;

  syncPreview();
}

function formToModel(){
  // project
  MODEL.project.name = text("project_name");
  MODEL.project.industry = $("project_industry").value;
  MODEL.project.project_type = $("project_type").value;
  MODEL.project.size.gross_sf = num("project_gross_sf", 0, 1e12);
  MODEL.project.size.estimated_value_usd = num("project_value_usd", 0, 1e15);
  MODEL.project.baseline.baseline_region = $("project_baseline_region").value;
  MODEL.project.baseline.baseline_cost_basis = $("project_baseline_basis").value;
  MODEL.project.baseline.baseline_reference = text("project_baseline_ref");

  // location
  MODEL.location.state = "AK";
  MODEL.location.place_name = text("loc_place");
  MODEL.location.region = $("loc_region").value;
  MODEL.location.road_system_tier = clamp(Number($("loc_road_tier").value), 0, 5);
  MODEL.location.population.population_count = Math.floor(num("loc_pop_count", 0, 1e12));
  MODEL.location.population.density_per_sq_mi = num("loc_pop_density", 0, 1e9);
  MODEL.location.proximity = {
    nearest_hub_name: text("loc_hub_name"),
    nearest_hub_distance_miles: num("loc_hub_mi", 0, 1e9),
    nearest_port_name: text("loc_port_name"),
    nearest_port_distance_miles: num("loc_port_mi", 0, 1e9)
  };

  // logistics
  MODEL.logistics.seasonal_access.access_type = $("log_season_access_type").value;
  MODEL.logistics.seasonal_access.season_weight = mult("log_season_weight");
  MODEL.logistics.seasonal_access.constraints = csvToArray(text("log_season_constraints"));

  MODEL.logistics.delivery_window.window_type = $("log_delivery_window_type").value;
  MODEL.logistics.delivery_window.risk_premium = mult("log_delivery_risk");
  MODEL.logistics.delivery_window.notes = text("log_delivery_notes");

  MODEL.logistics.material_handling.handling_complexity = clamp(Number($("log_handling_score").value), 0, 5);
  MODEL.logistics.material_handling.multiplier = mult("log_handling_mult");
  MODEL.logistics.material_handling.drivers = csvToArray(text("log_handling_drivers"));

  MODEL.computed.logistics_factor = mult("logistics_factor");

  // workforce
  MODEL.workforce.local_labor_availability.availability_level = $("wf_availability_level").value;
  MODEL.workforce.local_labor_availability.multiplier = mult("wf_availability_mult");
  MODEL.workforce.local_labor_availability.notes = text("wf_availability_notes");

  MODEL.workforce.crew_mobilization.rotation_model = $("wf_rotation_model").value;
  MODEL.workforce.crew_mobilization.camp_required = $("wf_camp_required").value === "true";
  MODEL.workforce.crew_mobilization.travel_time_policy = $("wf_travel_policy").value;
  MODEL.workforce.crew_mobilization.multiplier = mult("wf_mob_mult");
  MODEL.workforce.crew_mobilization.components = {
    per_diem_usd_per_day: num("wf_per_diem", 0, 1e6),
    camp_cost_usd_per_person_day: num("wf_camp_cost", 0, 1e6),
    airfare_usd_per_person_roundtrip: num("wf_airfare", 0, 1e7),
  };

  MODEL.workforce.productivity.climate_zone = $("wf_climate_zone").value;
  MODEL.workforce.productivity.climate_factor = mult("wf_climate_factor");
  MODEL.workforce.productivity.setup_teardown_overhead_factor = mult("wf_setup_factor");
  MODEL.workforce.productivity.drivers = csvToArray(text("wf_prod_drivers"));

  MODEL.workforce.wage_overlay.wage_basis = $("wf_wage_basis").value;
  MODEL.workforce.wage_overlay.multiplier = mult("wf_wage_mult");
  MODEL.workforce.wage_overlay.notes = text("wf_wage_notes");

  MODEL.computed.workforce_factor = mult("workforce_factor");

  // market
  MODEL.market.population_gravity.band = $("mk_pop_band").value;
  MODEL.market.population_gravity.multiplier = mult("mk_pop_mult");

  MODEL.market.competition.bidder_depth = $("mk_bidder_depth").value;
  MODEL.market.competition.multiplier = mult("mk_comp_mult");
  MODEL.market.competition.notes = text("mk_comp_notes");

  MODEL.market.industry_pressure.dominant_industries = csvToArray(text("mk_industries"));
  MODEL.market.industry_pressure.multiplier = mult("mk_ind_mult");
  MODEL.market.industry_pressure.notes = text("mk_ind_notes");

  MODEL.computed.market_factor = mult("market_factor");

  // project characteristics
  MODEL.project_characteristics.remodel_complexity.level = $("pc_remodel_level").value;
  MODEL.project_characteristics.remodel_complexity.multiplier = mult("pc_remodel_mult");
  MODEL.project_characteristics.remodel_complexity.notes = text("pc_remodel_notes");

  MODEL.project_characteristics.scale_curve.band = $("pc_scale_band").value;
  MODEL.project_characteristics.scale_curve.multiplier = mult("pc_scale_mult");

  MODEL.project_characteristics.site_constraints.constraint_score = clamp(Number($("pc_site_score").value), 0, 10);
  MODEL.project_characteristics.site_constraints.multiplier = mult("pc_site_mult");
  MODEL.project_characteristics.site_constraints.drivers = csvToArray(text("pc_site_drivers"));

  MODEL.computed.project_factor = mult("project_factor");

  // risk
  MODEL.risk.unknowns_index.score = clamp(Number($("rk_unknown_score").value), 0, 10);
  MODEL.risk.unknowns_index.multiplier = mult("rk_unknown_mult");
  MODEL.risk.unknowns_index.drivers = csvToArray(text("rk_unknown_drivers"));

  MODEL.risk.schedule_volatility.level = $("rk_sched_level").value;
  MODEL.risk.schedule_volatility.multiplier = mult("rk_sched_mult");
  MODEL.risk.schedule_volatility.drivers = csvToArray(text("rk_sched_drivers"));

  MODEL.risk.permitting_complexity.level = $("rk_permit_level").value;
  MODEL.risk.permitting_complexity.multiplier = mult("rk_permit_mult");
  MODEL.risk.permitting_complexity.notes = text("rk_permit_notes");

  MODEL.risk.contingency = {
    contingency_percent: clamp(Number($("rk_cont_pct").value), 0, 100),
    applies_to: $("rk_cont_applies").value
  };

  MODEL.computed.risk_factor = mult("risk_factor");

  // weights
  MODEL.weights = {
    logistics: clamp(Number($("wt_logistics").value), 0, 1e9),
    workforce: clamp(Number($("wt_workforce").value), 0, 1e9),
    market: clamp(Number($("wt_market").value), 0, 1e9),
    project_characteristics: clamp(Number($("wt_project").value), 0, 1e9),
    risk: clamp(Number($("wt_risk").value), 0, 1e9),
  };

  // computed total
  syncPreview();
}

function syncPreview(){
  // pull values from “section rollups”
  const L = mult("logistics_factor");
  const W = mult("workforce_factor");
  const M = mult("market_factor");
  const P = mult("project_factor");
  const R = mult("risk_factor");

  const total = (L * W * M * P * R);

  $("kLogistics").textContent = L.toFixed(2);
  $("kWorkforce").textContent = W.toFixed(2);
  $("kMarket").textContent = M.toFixed(2);
  $("kProject").textContent = P.toFixed(2);
  $("kRisk").textContent = R.toFixed(2);

  $("acfTotal").textContent = total.toFixed(2);

  MODEL.computed.logistics_factor = L;
  MODEL.computed.workforce_factor = W;
  MODEL.computed.market_factor = M;
  MODEL.computed.project_factor = P;
  MODEL.computed.risk_factor = R;
  MODEL.computed.acf_total_factor = total;
}

/* ---------- Import / Export ---------- */
function downloadJson(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeParseJson(str){
  try { return { ok:true, value: JSON.parse(str) }; }
  catch (e) { return { ok:false, error: String(e) }; }
}

function normalizeImported(obj){
  // Light normalization so old/partial files still load.
  const base = defaultModel();

  // shallow merge helper
  const merge = (dst, src) => {
    if (!src || typeof src !== "object") return dst;
    for (const k of Object.keys(src)){
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])){
        dst[k] = merge(dst[k] ?? {}, src[k]);
      } else {
        dst[k] = src[k];
      }
    }
    return dst;
  };

  const merged = merge(base, obj);

  // ensure legs array
  if (!Array.isArray(merged.logistics.transport_legs) || merged.logistics.transport_legs.length === 0){
    merged.logistics.transport_legs = base.logistics.transport_legs;
  }
  // ensure computed section rollups exist
  merged.computed = merged.computed ?? base.computed;

  return merged;
}

/* ---------- Wiring ---------- */
function bindFormListeners(){
  // global: update model on any input
  document.body.addEventListener("input", (e) => {
    // ignore template / missing elements or leg node input already updates MODEL.logistics.transport_legs,
    // but we still run formToModel to keep everything consistent.
    formToModel();
  });

  $("btnAddLeg").addEventListener("click", () => {
    MODEL.logistics.transport_legs.push({ mode:"Road", distance_miles:0, season:"AllYear", cost_index:1.0, constraints:[], notes:"" });
    renderLegs();
    syncPreview();
  });

  $("btnExport").addEventListener("click", () => {
    formToModel();
    const place = (MODEL.location.place_name || "AK").replace(/[^a-z0-9_-]+/gi, "_");
    downloadJson(`acf_${place}.json`, MODEL);
  });

  $("btnNew").addEventListener("click", () => {
    MODEL = defaultModel();
    modelToForm();
  });

  $("fileImport").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const txt = await file.text();
    const parsed = safeParseJson(txt);
    if (!parsed.ok){
      alert("Invalid JSON:\n" + parsed.error);
      return;
    }

    MODEL = normalizeImported(parsed.value);
    modelToForm();
    e.target.value = "";
  });
}

function boot(){
  initEnums();
  MODEL = defaultModel();
  modelToForm();
  bindFormListeners();
}

boot();
