export function perimeterFt(lenFt, widFt) { return 2 * (lenFt + widFt); }
export function wallAreaSF(perimFt, htFt) { return perimFt * htFt; }
export function floorAreaSF(lenFt, widFt) { return lenFt * widFt; }

export function ceilSheets(areaSF, sheetSF=32, waste=0.10) {
  return Math.ceil((areaSF * (1 + waste)) / sheetSF);
}

export function sticksFromLF(lf, stickLenFt=8, waste=0.12) {
  return Math.ceil((lf * (1 + waste)) / stickLenFt);
}

export function studsCountForPerimeter(perimFt, spacingIn, waste=0.10) {
  const spacingFt = spacingIn / 12;
  const studs = Math.ceil(perimFt / spacingFt) + 4; // corners/ends fudge
  return Math.ceil(studs * (1 + waste));
}

export function rafterLengthFromSpan(spanFt, pitchX12) {
  if (pitchX12 <= 0) return spanFt;
  const rise = spanFt * (pitchX12 / 12);
  return Math.sqrt(spanFt*spanFt + rise*rise);
}
