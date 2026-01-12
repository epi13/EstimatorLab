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
  const mhRoof = takeoff.roofAreaSF * state.labor.mhRoofPerSF;

  // Foundation base + scaled by type (budgetary multipliers)
  const fType = state.foundation.type;
  const fMult = (fType === "skids") ? 1.0 : (fType === "piers") ? 1.6 : 2.2;
  const mhFoundation = state.labor.mhFoundationBase * fMult;

  const mh = (mhFraming + mhSheath + mhRoof + mhFoundation) * state.labor.remoteFactor;
  const laborCost = mh * rate;

  return { mh, laborCost, rate, envSF, totalSheets };
}
