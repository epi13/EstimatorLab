import { sticksFromLF } from "./geometry.js";

export function wallsTakeoff({
  lenFt, widFt, htFt,
  studSpacingIn,
  studType,
  topPlate, cornerStyle,
  perimFt,
  baseStudsEA,
  openingsInfo,
  shedWallInfill = null
}) {
  const notes = [];

  // Baseline studs from perimeter model
  // We already include some corner assumption in base calc, so here we treat corner style as additive adjustment:
  // Add delta vs a nominal 3-stud baseline used by many fudge factors:
  // We'll implement corner style as explicit corner studs and remove the "+4" fudge by recomputing.
  // For simplicity: keep baseStudsEA and apply opening/corner adjustments.
  let studsEA = baseStudsEA;

  // Apply openings displacement (subtract) and add actual opening studs
  studsEA = Math.max(0, studsEA - openingsInfo.studsToSubtract + openingsInfo.addedStudsEA);

  // Apply corner style adjustment (relative to 3-stud)
  // If corner is california, subtract 4 studs total compared to 3-stud corners
  const cornerDelta = (cornerStyle === "california") ? -4 : 0;
  studsEA = Math.max(0, studsEA + cornerDelta);

  notes.push(`Corner style: ${cornerStyle} (delta ${cornerDelta} studs vs 3-stud)`);

  // Plates
  const topMult = (topPlate === "double") ? 2 : 1;
  const plateLF = perimFt * (1 + topMult); // bottom(1) + top(topMult)
  const plateSticksEA = sticksFromLF(plateLF, 8, 0.12);

  // Add headers as sticks too (same material class for now)
  const headerSticksEA = sticksFromLF(openingsInfo.headerLF, 8, 0.12);

  notes.push(`Top plate: ${topPlate} (top mult ${topMult})`);
  notes.push(`Plates: ${plateLF.toFixed(1)} LF ≈ ${plateSticksEA} sticks`);

  let shedInfillStudSticksEA = 0;
  let shedInfillPlateSticksEA = 0;
  if (shedWallInfill?.enabled && shedWallInfill.riseFt > 0.05) {
    const spacingFt = studSpacingIn / 12;
    const highWallCripples = Math.ceil(lenFt / spacingFt) + 1;
    const endWallCripples = 2 * (Math.ceil(widFt / spacingFt) + 1);
    const avgEndCrippleHt = shedWallInfill.riseFt / 2;
    const crippleLF = (highWallCripples * shedWallInfill.riseFt) + (endWallCripples * avgEndCrippleHt);
    const slopedEndPlateLF = 2 * Math.hypot(widFt, shedWallInfill.riseFt);
    const highWallPlateLF = lenFt;

    shedInfillStudSticksEA = sticksFromLF(crippleLF, 8, 0.12);
    shedInfillPlateSticksEA = sticksFromLF(slopedEndPlateLF + highWallPlateLF, 8, 0.12);
    notes.push(`Shed roof wall infill: ${shedWallInfill.riseFt.toFixed(2)} ft rise adds ${shedInfillStudSticksEA} cripple stud sticks and ${shedInfillPlateSticksEA} sloped/top plate sticks`);
  }

  return {
    studsEA,
    plateSticksEA,
    headerSticksEA,
    shedInfillStudSticksEA,
    shedInfillPlateSticksEA,
    notes
  };
}
