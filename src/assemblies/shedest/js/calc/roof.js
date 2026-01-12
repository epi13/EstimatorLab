import { ceilSheets, rafterLengthFromSpan, sticksFromLF } from "./geometry.js";

export function roofTakeoff({
  lenFt, widFt,
  roofType,
  pitchX12,
  overhangFt,
  studSpacingIn,
  includeFasciaSoffit,
  soffitWidthFt
}) {
  const spacingFt = studSpacingIn / 12;

  // Overhang increases plan dimensions
  const L = lenFt + 2*overhangFt;
  const W = widFt + 2*overhangFt;

  let roofAreaSF = 0;
  let rafterLF = 0;
  let ridgeLF = 0;
  let fasciaLF = 0;
  let soffitSF = 0;

  if (roofType === "flat") {
    roofAreaSF = L * W;
    // simple "joists" spanning width, count along length
    const joists = Math.ceil(L / spacingFt) + 1;
    rafterLF = joists * W;
  }

  if (roofType === "shed") {
    // shed: slope across width
    const span = W;
    const rafterLen = rafterLengthFromSpan(span, pitchX12);
    roofAreaSF = rafterLen * L;
    const rafters = Math.ceil(L / spacingFt) + 1;
    rafterLF = rafters * rafterLen;
  }

  if (roofType === "gable") {
    // gable: two planes, slope from ridge to eave across half-span
    const halfSpan = W / 2;
    const oneRafter = rafterLengthFromSpan(halfSpan, pitchX12);
    roofAreaSF = 2 * (oneRafter * L);
    const pairs = Math.ceil(L / spacingFt) + 1;
    rafterLF = pairs * 2 * oneRafter;
    ridgeLF = L;
  }

  // fascia & soffit (budgetary)
  // fascia around eaves perimeter:
  // - flat & shed: perimeter of roof plan
  // - gable: include eaves (2 long) + gable rakes (2 short sloped edges)
  if (includeFasciaSoffit) {
    if (roofType === "gable") {
      const oneRake = rafterLengthFromSpan(W/2, pitchX12);
      fasciaLF = 2 * L + 4 * oneRake;
    } else if (roofType === "shed") {
      // shed has two rakes and two eaves, approximate as roof plan perimeter
      fasciaLF = 2*(L+W);
    } else {
      fasciaLF = 2*(L+W);
    }
    soffitSF = fasciaLF * soffitWidthFt;
  }

  const roofSheets = ceilSheets(roofAreaSF, 32, 0.10);
  const rafterSticksEA = sticksFromLF(rafterLF, 8, 0.12);
  const ridgeSticksEA = ridgeLF > 0 ? sticksFromLF(ridgeLF, 8, 0.12) : 0;

  return {
    roofAreaSF,
    roofSheets,
    rafterSticksEA,
    ridgeSticksEA,
    fasciaLF,
    soffitSF
  };
}
