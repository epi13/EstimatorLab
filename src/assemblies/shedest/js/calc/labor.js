export function calcLaborHours(state, takeoff, laborRates) {
  const rate = laborRates[state.labor.tradeRateKey] ?? 87;

  const totalSheets =
    takeoff.items
      .filter(it => it.unit === "EA" && (it.name.includes("sheathing") || it.name.includes("Plywood") || it.name.includes("OSB")))
      .reduce((s,it)=>s+it.qty,0);

  // Envelope SF for framing (walls + roof + floor)
  const envSF = takeoff.netWallSheathAreaSF + takeoff.roofAreaSF + (state.geom.includeFloor ? takeoff.floorAreaSF : 0);

  // Base hours: framing + sheathing + roof + foundation
  const mhFraming = envSF * state.labor.mhPerSF;
  const mhSheath = totalSheets * state.labor.mhPerSheet;
  const mhRoof = state.roof.includeRoofFinish ? takeoff.roofAreaSF * state.labor.mhRoofPerSF : 0;
  const mhInsulation = state.interior.includeInsulation ? takeoff.netWallSheathAreaSF * state.labor.mhInsulationPerSF : 0;
  const mhDrywall = state.interior.includeDrywall ? takeoff.netWallSheathAreaSF * state.labor.mhDrywallPerSF : 0;

  // Foundation base + scaled by type (budgetary multipliers)
  const fType = state.foundation.type;
  const fMult = ({ none:0, skids:1.0, piers:1.6, ground_screws:1.4, slab:2.2, crawlspace:3.2, basement:5.5 })[fType] ?? 2.2;
  const mhFoundation = state.labor.mhFoundationBase * fMult;

  const mh = (mhFraming + mhSheath + mhRoof + mhInsulation + mhDrywall + mhFoundation) * state.labor.remoteFactor;
  const laborCost = mh * rate;

  return { mh, laborCost, rate, envSF, totalSheets, mhInsulation, mhDrywall };
}
