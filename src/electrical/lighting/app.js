// Alaska Lighting Cost Calculator
// - Material = Base + Shipping + Handling
// - Shipping = Base * shipPctByClassAndMode * freightMultiplier
// - Handling = (Base + Shipping) * handlingPct
// - Labor = laborHrs * laborRate * (1 + laborPremiumPct)

const $ = (id) => document.getElementById(id);

let LIB = null;
let lines = [];

function money(n){
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function num(n){ return Number(n || 0); }

function shipPctFor(freightClassId, mode){
  const cls = LIB.meta.freightClasses.find(c => c.id === freightClassId);
  if(!cls) return 0.25;
  if(mode === "truck") return cls.truckPct;
  if(mode === "air") return cls.airPct;
  if(mode === "barge") return cls.bargePct;
  return cls.mixedPct;
}

function buildLineItemName({
  dim,
  cap,
  watt,
  pwr,
  cct,
  cri,
  optics,
  rating,
  mount,
  controls,
  finish,
  lens,
  driver,
  feat,
  itemName,
  anc
}){
  // Enforce order: Dim, Output, Watt, Power, CCT, CRI, Optics, Rating, Mount, Controls, Finish, Lens, Driver, Features, ITEM (Ancillaries)
  const parts = [];
  if(dim?.trim()) parts.push(capFirst(dim.trim()));
  if(cap?.trim()) parts.push(capFirst(cap.trim()));
  if(watt?.trim()) parts.push(capFirst(watt.trim()));
  if(pwr?.trim()) parts.push(capFirst(pwr.trim()));
  if(cct?.trim()) parts.push(capFirst(cct.trim()));
  if(cri?.trim()) parts.push(capFirst(cri.trim()));
  if(optics?.trim()) parts.push(capFirst(optics.trim()));
  if(rating?.trim()) parts.push(capFirst(rating.trim()));
  if(mount?.trim()) parts.push(capFirst(mount.trim()));
  if(controls?.trim()) parts.push(capFirst(controls.trim()));
  if(finish?.trim()) parts.push(capFirst(finish.trim()));
  if(lens?.trim()) parts.push(capFirst(lens.trim()));
  if(driver?.trim()) parts.push(capFirst(driver.trim()));
  if(feat?.trim()) parts.push(capFirst(feat.trim()));
  const head = parts.join(", ");
  const item = itemName?.trim() ? capFirst(itemName.trim()) : "Fixture";
  const ancText = anc?.trim() ? ` (${anc.trim()})` : "";
  return `${head ? head + " " : ""}${item}${ancText}`;
}

function capFirst(s){
  if(!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function recalcPreview(){
  const model = readForm();
  $("namePreview").textContent = buildLineItemName(model);
}

function readForm(){
  return {
    typeTag: $("typeTag").value.trim(),
    qty: Math.max(1, parseInt($("qty").value || "1", 10)),
    dim: $("dim").value,
    cap: $("cap").value,
    watt: $("watt").value,
    pwr: $("pwr").value,
    cct: $("cct").value,
    cri: $("cri").value,
    optics: $("optics").value,
    rating: $("rating").value,
    mount: $("mount").value,
    controls: $("controls").value,
    finish: $("finish").value,
    lens: $("lens").value,
    driver: $("driver").value,
    feat: $("feat").value,
    itemName: $("itemName").value,
    anc: $("anc").value,
    baseCost: num($("baseCost").value),
    freightClass: $("freightClass").value,
    laborHrs: num($("laborHrs").value)
  };
}

function computeCosts(line){
  const mode = $("freightMode").value;
  const mult = num($("freightMultiplier").value);
  const handlingPct = num($("handlingPct").value) / 100.0;

  const laborRate = num($("laborRate").value);
  const laborPremiumPct = num($("laborPremiumPct").value) / 100.0;

  const shipPct = shipPctFor(line.freightClass, mode);

  const shipEA = line.baseCost * shipPct * mult;
  const handleEA = (line.baseCost + shipEA) * handlingPct;

  const matEA = line.baseCost + shipEA + handleEA;

  const laborEA = line.laborHrs * laborRate * (1 + laborPremiumPct);
  const totalEA = matEA + laborEA;
  const ext = totalEA * line.qty;

  return { shipPct, shipEA, handleEA, matEA, laborEA, totalEA, ext };
}

function renderTable(){
  const tbody = $("linesTable").querySelector("tbody");
  tbody.innerHTML = "";

  let grand = 0;

  lines.forEach((ln, idx) => {
    const costs = computeCosts(ln);
    grand += costs.ext;

    const tr = document.createElement("tr");

    const lineName = buildLineItemName(ln);

    tr.innerHTML = `
      <td>${escapeHtml(ln.typeTag || "")}</td>
      <td>${escapeHtml(lineName)}</td>
      <td class="num">${ln.qty}</td>
      <td class="num">${money(ln.baseCost)}</td>
      <td class="num">${money(costs.shipEA)}</td>
      <td class="num">${money(costs.handleEA)}</td>
      <td class="num">${money(costs.matEA)}</td>
      <td class="num">${ln.laborHrs.toFixed(2)}</td>
      <td class="num">${money(costs.laborEA)}</td>
      <td class="num">${money(costs.totalEA)}</td>
      <td class="num">${money(costs.ext)}</td>
      <td class="num"><button class="ghost danger" data-del="${idx}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  $("grandTotal").textContent = money(grand);

  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-del"), 10);
      lines.splice(i, 1);
      renderTable();
    });
  });
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function applyFixtureDefaults(fx){
  const d = fx.defaults;
  $("dim").value = d.dim ?? "";
  $("cap").value = d.cap ?? "";
  $("watt").value = d.watt ?? "";
  $("pwr").value = d.pwr ?? "";
  $("cct").value = d.cct ?? "";
  $("cri").value = d.cri ?? "";
  $("optics").value = d.optics ?? "";
  $("rating").value = d.rating ?? "";
  $("mount").value = d.mount ?? "";
  $("controls").value = d.controls ?? "";
  $("finish").value = d.finish ?? "";
  $("lens").value = d.lens ?? "";
  $("driver").value = d.driver ?? "";
  $("feat").value = d.feat ?? "";
  $("itemName").value = d.itemName ?? "";
  $("anc").value = d.anc ?? "";
  $("baseCost").value = d.baseCost ?? 0;
  $("freightClass").value = d.freightClass ?? "standard";
  $("laborHrs").value = d.laborHrs ?? 0.75;
  recalcPreview();
}

function fillFreightClasses(){
  const sel = $("freightClass");
  sel.innerHTML = "";
  LIB.meta.freightClasses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
}

function fillLocationPresets(){
  const sel = $("locationPreset");
  sel.innerHTML = "";
  LIB.meta.locationPresets.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", () => {
    const p = LIB.meta.locationPresets.find(x => x.id === sel.value);
    if(!p) return;
    $("freightMultiplier").value = p.freightMultiplier;
    $("freightMode").value = p.freightMode;
    renderTable();
  });

  // default to Nenana if present
  const nen = LIB.meta.locationPresets.find(x => x.id === "nenana");
  sel.value = nen ? "nenana" : LIB.meta.locationPresets[0]?.id;
  sel.dispatchEvent(new Event("change"));
}

function fillFixtures(){
  const sel = $("fixtureSelect");
  sel.innerHTML = "";
  LIB.fixtures.forEach(fx => {
    const opt = document.createElement("option");
    opt.value = fx.id;
    opt.textContent = fx.label;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", () => {
    const fx = LIB.fixtures.find(x => x.id === sel.value);
    if(!fx) return;
    applyFixtureDefaults(fx);
  });

  sel.value = LIB.fixtures[0]?.id;
  sel.dispatchEvent(new Event("change"));
}

function exportCSV(){
  // Columns aligned to your typical estimating needs
  const headers = [
    "Type","Line Item","Qty",
    "Base_EA","Ship_EA","Handling_EA","Material_EA",
    "LaborHrs_EA","LaborRate","Labor_EA",
    "Total_EA","Extended_Total",
    "FreightClass","FreightMode","FreightMultiplier","HandlingPct","LaborPremiumPct"
  ];

  const mode = $("freightMode").value;
  const mult = num($("freightMultiplier").value);
  const handlingPct = num($("handlingPct").value);
  const laborRate = num($("laborRate").value);
  const laborPrem = num($("laborPremiumPct").value);

  const rows = lines.map(ln => {
    const c = computeCosts(ln);
    return [
      ln.typeTag || "",
      buildLineItemName(ln),
      ln.qty,
      ln.baseCost.toFixed(2),
      c.shipEA.toFixed(2),
      c.handleEA.toFixed(2),
      c.matEA.toFixed(2),
      ln.laborHrs.toFixed(2),
      laborRate.toFixed(2),
      c.laborEA.toFixed(2),
      c.totalEA.toFixed(2),
      c.ext.toFixed(2),
      ln.freightClass,
      mode,
      mult.toFixed(2),
      handlingPct.toFixed(2),
      laborPrem.toFixed(2)
    ];
  });

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lighting_estimate_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init(){
  const res = await fetch("./fixtures.json");
  LIB = await res.json();

  // Seed defaults
  $("laborRate").value = LIB.meta.defaultLaborRate ?? 96;
  $("laborRatePill").textContent = money($("laborRate").value).replace(".00","") + "/hr";

  fillFreightClasses();
  fillLocationPresets();
  fillFixtures();

  // Live preview updates
  ["dim","cap","watt","pwr","cct","cri","optics","rating","mount","controls","finish","lens","driver","feat","itemName","anc"].forEach(id => {
    $(id).addEventListener("input", recalcPreview);
  });
  $("laborRate").addEventListener("input", () => {
    $("laborRatePill").textContent = money($("laborRate").value).replace(".00","") + "/hr";
    renderTable();
  });
  ["freightMode","freightMultiplier","handlingPct","laborPremiumPct"].forEach(id => {
    $(id).addEventListener("input", renderTable);
    $(id).addEventListener("change", renderTable);
  });

  $("addBtn").addEventListener("click", () => {
    const model = readForm();
    lines.push(model);
    renderTable();
  });

  $("clearFormBtn").addEventListener("click", () => {
    const fx = LIB.fixtures.find(x => x.id === $("fixtureSelect").value);
    if(fx) applyFixtureDefaults(fx);
    $("qty").value = 1;
    $("typeTag").value = "";
    recalcPreview();
  });

  $("clearLinesBtn").addEventListener("click", () => {
    lines = [];
    renderTable();
  });

  $("exportBtn").addEventListener("click", exportCSV);

  recalcPreview();
  renderTable();
}

init().catch(err => {
  console.error(err);
  alert("Failed to load fixtures.json. Serve the folder with a local server (not file://).");
});
