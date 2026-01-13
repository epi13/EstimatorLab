// freight/app.js
const $ = (id) => document.getElementById(id);

const state = {
    locations: [],
    routes: [],
    rates: null,
    accessorials: [],
    assumptions: null
};

const appBaseUrl = new URL(".", import.meta.url);

async function loadJson(path) {
    const attempts = [
        new URL(path, appBaseUrl).toString(),
        new URL(path, document.baseURI).toString()
    ];

    for (const resolvedPath of attempts) {
        const res = await fetch(resolvedPath, { cache: "no-store" });
        if (res.ok) return res.json();
    }

    throw new Error(`Failed to load ${path} (tried ${attempts.join(", ")})`);
}

function money(n) {
    const v = Number.isFinite(n) ? n : 0;
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function round2(n){ return Math.round(n * 100) / 100; }

function parseDateOrNull(v){
    if (!v) return null;
    const d = new Date(v + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
}

function monthOf(d){ return d.getMonth() + 1; }

function routeIsInSeason(route, dateObj){
    if (!route.season || !dateObj) return true;
    const m = monthOf(dateObj);
    const { start_month, end_month } = route.season;
    // supports wrap-around seasons if you ever need it
    if (start_month <= end_month) return m >= start_month && m <= end_month;
    return (m >= start_month) || (m <= end_month);
}

function buildSelect(selectEl, items, getValue, getLabel) {
    selectEl.innerHTML = "";
    for (const it of items) {
        const opt = document.createElement("option");
        opt.value = getValue(it);
        opt.textContent = getLabel(it);
        selectEl.appendChild(opt);
    }
}

function buildAccessorialChecks(container, accessorials){
    container.innerHTML = "";
    for (const a of accessorials) {
        const div = document.createElement("label");
        div.className = "check";
        div.innerHTML = `
        <input type="checkbox" data-acc="${a.id}" />
        <div>
        <div>${a.label}</div>
        <div class="desc">${a.type === "flat" ? money(a.value) : (a.value + "%")} • ${a.note ?? ""}</div>
        </div>
        `;
        container.appendChild(div);
    }
}

function getSelectedAccessorialIds(){
    return Array.from(document.querySelectorAll('input[type="checkbox"][data-acc]'))
    .filter(x => x.checked)
    .map(x => x.getAttribute("data-acc"));
}

function findLocation(id){
    return state.locations.find(l => l.id === id);
}

/**
 * Simple routing:
 * 1) direct lane exists
 * 2) one-stop via any hub location that connects origin->hub and hub->dest
 * You can extend later to Dijkstra / multi-leg scoring.
 */
function findRoutePlan(originId, destId, deliveryDateObj) {
    const direct = state.routes.find(r =>
    r.from === originId && r.to === destId && routeIsInSeason(r, deliveryDateObj)
    );
    if (direct) return { legs: [direct], note: "Direct lane" };

    const hubs = state.locations.filter(l => l.hub).map(l => l.id);
    for (const h of hubs) {
        const leg1 = state.routes.find(r => r.from === originId && r.to === h && routeIsInSeason(r, deliveryDateObj));
        const leg2 = state.routes.find(r => r.from === h && r.to === destId && routeIsInSeason(r, deliveryDateObj));
        if (leg1 && leg2) return { legs: [leg1, leg2], note: `Hub transfer via ${h}` };
    }
    return { legs: [], note: "No modeled lane found (add route in routes.ak.json)" };
}

function estimateDeclaredValueCharge(rates, declaredValue){
    const included = rates.declared_value?.included ?? 0;
    const per1000 = rates.declared_value?.per_1000_over ?? 0;
    const over = Math.max(0, declaredValue - included);
    const units = Math.ceil(over / 1000);
    return round2(units * per1000);
}

function estimateBaseForLeg({ shipType, weightLbs, volumeCf, nmfcClass }, leg, rates){
    // returns { base, meta: { rule, ... } }
    const mode = leg.mode;

    if (shipType === "ltl") {
        const cwt = Math.ceil(weightLbs / 100);
        const basePerCwt = rates.ltl.base_per_cwt;
        const classMult = rates.ltl.class_multipliers[String(nmfcClass)] ?? 1.45;
        const laneFactor = rates.ltl.lane_factor_by_mode[mode] ?? 1.0;

        const raw = cwt * basePerCwt * classMult * laneFactor;
        const base = Math.max(rates.ltl.min_charge, raw);

        return {
            base: round2(base),
            meta: { rule: "LTL: cwt * base_per_cwt * class_mult * lane_factor, min_charge", cwt, basePerCwt, classMult, laneFactor }
        };
    }

    if (shipType === "ftl") {
        const miles = leg.distance_mi ?? 0;
        const raw = miles * (rates.ftl.per_mile ?? 0);
        const base = Math.max(rates.ftl.min_charge ?? 0, raw);
        return {
            base: round2(base),
            meta: { rule: "FTL: miles * per_mile, min_charge", miles, perMile: rates.ftl.per_mile }
        };
    }

    if (shipType === "airCargo") {
        // Approx dim weight from cuft if that's all we have
        const divisor = rates.airCargo.dim_divisor ?? 166;
        const dimLbs = Math.ceil((volumeCf * 1728) / divisor);
        const chargeable = Math.max(weightLbs, dimLbs);
        const raw = chargeable * (rates.airCargo.rate_per_lb ?? 0);
        const base = Math.max(rates.airCargo.min_charge ?? 0, raw);
        return {
            base: round2(base),
            meta: { rule: "AIR: max(actual, dim) * rate_per_lb, min_charge", dimLbs, chargeable, ratePerLb: rates.airCargo.rate_per_lb }
        };
    }

    if (shipType === "container") {
        // v0.1: choose 20ft vs 40ft by a crude volume threshold
        const size = volumeCf <= 1100 ? "20ft" : "40ft";
        const base = (rates.container[size]?.base ?? 0);
        const port = (rates.container[size]?.port_handling ?? 0);
        return {
            base: round2(base + port),
            meta: { rule: "Container: base + port_handling (size by volume threshold)", size, base, port }
        };
    }

    // parcel or fallback:
    // Treat as LTL-lite for now
    const cwt = Math.ceil(weightLbs / 100);
    const raw = cwt * (rates.ltl.base_per_cwt ?? 0) * 1.1;
    const base = Math.max(250, raw);
    return {
        base: round2(base),
        meta: { rule: "Parcel fallback: cwt * base_per_cwt * 1.1, min 250", cwt }
    };
}

function sum(n){ return n.reduce((a,b)=>a+b,0); }

function estimate() {
    const originId = $("origin").value;
    const destId = $("destination").value;
    const shipType = $("shipType").value;

    const weightLbs = Number($("weightLbs").value || 0);
    const volumeCf = Number($("volumeCf").value || 0);
    const nmfcClass = $("nmfcClass").value;
    const declaredValue = Number($("declaredValue").value || 0);
    const deliveryDateObj = parseDateOrNull($("deliveryDate").value);

    const remoteOverride = Number($("remoteMultiplier").value || 1);
    const markupPct = Number($("markupPct").value || 0);

    const dest = findLocation(destId);
    const origin = findLocation(originId);

    const routePlan = findRoutePlan(originId, destId, deliveryDateObj);

    const breakdown = [];
    const debug = {
        input: { originId, destId, shipType, weightLbs, volumeCf, nmfcClass, declaredValue, deliveryDate: $("deliveryDate").value || null },
        route: routePlan,
        legs: routePlan.legs
    };

    if (!routePlan.legs.length) {
        renderResults({ total: 0, breakdown, debug, note: routePlan.note });
        return;
    }

    // Base freight by legs
    const legResults = routePlan.legs.map(leg =>
    estimateBaseForLeg({ shipType, weightLbs, volumeCf, nmfcClass }, leg, state.rates)
    );

    const baseFreight = sum(legResults.map(x => x.base));
    breakdown.push({
        component: "Base freight (route legs)",
                   qtyRule: `${routePlan.legs.length} leg(s)`,
                   rate: "Per lane rules",
                   cost: baseFreight
    });

    // Fuel surcharge (applied to base)
    const fuelPct = (state.rates.fuel_surcharge_pct ?? 0) / 100;
    const fuel = round2(baseFreight * fuelPct);
    breakdown.push({ component: "Fuel surcharge", qtyRule: `${state.rates.fuel_surcharge_pct ?? 0}%`, rate: "Base × %", cost: fuel });

    // Handling fee (applied to base)
    const handlingPct = (state.rates.handling_base_pct ?? 0) / 100;
    const handling = round2(baseFreight * handlingPct);
    breakdown.push({ component: "Handling / processing", qtyRule: `${state.rates.handling_base_pct ?? 0}%`, rate: "Base × %", cost: handling });

    // Declared value
    const dv = estimateDeclaredValueCharge(state.rates, declaredValue);
    if (dv > 0) breakdown.push({ component: "Declared value coverage", qtyRule: `Over ${money(state.rates.declared_value.included)}`, rate: "$/1000", cost: dv });

    // Accessorials
    const accIds = getSelectedAccessorialIds();
    const accItems = state.accessorials.filter(a => accIds.includes(a.id) && (a.applies_to?.includes(shipType) || a.applies_to?.includes("barge")));
    let accCost = 0;
    for (const a of accItems) {
        let c = 0;
        if (a.type === "flat") c = a.value;
        if (a.type === "percent") c = round2((baseFreight + fuel + handling) * (a.value / 100));
        accCost += c;
        breakdown.push({ component: a.label, qtyRule: a.type === "flat" ? "Flat" : `${a.value}%`, rate: a.type, cost: c });
    }

    // Remote factor: destination default * override
    const remoteFactor = round2((dest?.remote_factor ?? 1) * Math.max(1, remoteOverride));
    const subtotal = baseFreight + fuel + handling + dv + accCost;
    const remoteAdj = round2(subtotal * (remoteFactor - 1));
    if (remoteAdj !== 0) breakdown.push({ component: "Remote factor", qtyRule: `×${remoteFactor}`, rate: "Subtotal × (factor-1)", cost: remoteAdj });

    const subtotal2 = subtotal + remoteAdj;

    // Markup
    const markup = round2(subtotal2 * (markupPct / 100));
    if (markup !== 0) breakdown.push({ component: "Markup", qtyRule: `${markupPct}%`, rate: "Subtotal × %", cost: markup });

    const total = round2(subtotal2 + markup);

    debug.calc = {
        baseFreight,
        legResults,
        fuelPct,
        handlingPct,
        declaredValueCharge: dv,
        accessorialIds: accIds,
        remoteFactor,
        markupPct
    };

    renderResults({
        total,
        breakdown,
        debug,
        note: `${origin?.name ?? originId} → ${dest?.name ?? destId} • ${routePlan.note}`
    });
}

function renderResults({ total, breakdown, debug, note }) {
    $("totalCost").textContent = money(total);
    $("resultMeta").textContent = note || "";

    const tbody = $("breakdownTable").querySelector("tbody");
    tbody.innerHTML = "";

    for (const row of breakdown) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td>${row.component}</td>
        <td class="num">${row.qtyRule ?? ""}</td>
        <td class="num">${row.rate ?? ""}</td>
        <td class="num">${money(row.cost ?? 0)}</td>
        `;
        tbody.appendChild(tr);
    }

    $("routeDebug").textContent = JSON.stringify(debug, null, 2);
}

function serializeToQuery() {
    const params = new URLSearchParams();
    params.set("o", $("origin").value);
    params.set("d", $("destination").value);
    params.set("t", $("shipType").value);
    params.set("w", $("weightLbs").value);
    params.set("v", $("volumeCf").value);
    params.set("c", $("nmfcClass").value);
    params.set("dv", $("declaredValue").value);
    params.set("rm", $("remoteMultiplier").value);
    params.set("mu", $("markupPct").value);
    if ($("deliveryDate").value) params.set("date", $("deliveryDate").value);

    const accIds = getSelectedAccessorialIds();
    if (accIds.length) params.set("acc", accIds.join(","));
    return params.toString();
}

function hydrateFromQuery() {
    const q = new URLSearchParams(location.search);
    const setIf = (id, key) => { if (q.has(key)) $(id).value = q.get(key); };

    setIf("origin", "o");
    setIf("destination", "d");
    setIf("shipType", "t");
    setIf("weightLbs", "w");
    setIf("volumeCf", "v");
    setIf("nmfcClass", "c");
    setIf("declaredValue", "dv");
    setIf("remoteMultiplier", "rm");
    setIf("markupPct", "mu");
    setIf("deliveryDate", "date");

    // accessorials
    const acc = q.get("acc");
    if (acc) {
        const set = new Set(acc.split(",").map(s => s.trim()).filter(Boolean));
        for (const el of document.querySelectorAll('input[type="checkbox"][data-acc]')) {
            const id = el.getAttribute("data-acc");
            el.checked = set.has(id);
        }
    }
}

async function init() {
    const [locations, routes, rates, accessorials, assumptions] = await Promise.all([
        loadJson("./lib/locations.ak.json"),
                                                                                    loadJson("./lib/routes.ak.json"),
                                                                                    loadJson("./lib/rate.ak.json"),
                                                                                    loadJson("./lib/accessorials.ak.json"),
                                                                                    loadJson("./lib/assumptions.ak.json")
    ]);

    state.locations = locations.locations;
    state.routes = routes.routes;
    state.rates = rates;
    state.accessorials = accessorials.accessorials;
    state.assumptions = assumptions;

    // Populate selects
    const hubs = state.locations.filter(l => l.hub);
    buildSelect($("origin"), hubs, l => l.id, l => `${l.name} (${l.id})`);

    buildSelect($("destination"), state.locations, l => l.id, l => `${l.name} — ${l.type} — ${l.region} (${l.id})`);

    // Defaults
    $("origin").value = assumptions.defaults.origin_default ?? "ANC";
    $("shipType").value = assumptions.defaults.ship_type_default ?? "ltl";
    $("nmfcClass").value = assumptions.defaults.nmfc_default ?? "85";
    $("markupPct").value = assumptions.defaults.markup_pct ?? 10;
    $("remoteMultiplier").value = assumptions.defaults.remote_multiplier ?? 1;

    buildAccessorialChecks($("accessorials"), state.accessorials);

    // Hydrate share link after checks exist
    hydrateFromQuery();

    // Wire events
    $("btnEstimate").addEventListener("click", estimate);
    $("btnReset").addEventListener("click", () => {
        location.search = "";
        location.reload();
    });

    $("btnShare").addEventListener("click", async () => {
        const qs = serializeToQuery();
        const url = `${location.origin}${location.pathname}?${qs}`;
        try {
            await navigator.clipboard.writeText(url);
            $("resultMeta").textContent = "Share link copied to clipboard.";
        } catch {
            $("resultMeta").textContent = "Could not copy automatically. (Clipboard blocked)";
            console.log(url);
        }
    });

    // Auto-estimate when query has params
    if (location.search.length > 1) estimate();
}

init().catch(err => {
    console.error(err);
    alert(`Freight calculator failed to load.\n\n${err.message}`);
});
