export function foundationTakeoff({
  type,
  lenFt, widFt,
  gravelDepthFt,
  slabThkIn,
  pierSpacingFt
}) {
  const areaSF = lenFt * widFt;

  const items = [];
  const notes = [];

  // gravel CY
  const gravelCY = (areaSF * gravelDepthFt) / 27;

  if (type === "skids") {
    // skids: assume skids run length-wise, spaced ~4'
    const skidCount = Math.max(2, Math.ceil(widFt / 4));
    const geoSF = areaSF * 1.10;
    notes.push(`Skids: ${skidCount} (PT 4x6x12 budgetary).`);
    return {
      type,
      geoSF,
      gravelCY,
      skidCountEA: skidCount,
      pierCountEA: 0,
      slabCY: 0,
      rebarSF: 0,
      vaporSF: 0,
      notes
    };
  }

  if (type === "piers") {
    // piers: rows along length, 2 rows (sides)
    const perRow = Math.ceil(lenFt / pierSpacingFt) + 1;
    const pierCount = perRow * 2;
    // concrete per pier budgetary 0.15 CY (about 12" dia x 4' w/ bell etc.)
    const concCY = pierCount * 0.15;
    notes.push(`Piers: ${pierCount} (12" sonotube x 4'). Concrete ≈ ${concCY.toFixed(2)} CY`);
    return {
      type,
      geoSF: areaSF * 0.0,
      gravelCY: gravelCY * 0.5, // less gravel typically
      skidCountEA: 0,
      pierCountEA: pierCount,
      slabCY: 0,
      rebarSF: 0,
      vaporSF: 0,
      notes
    };
  }

  // slab
  const thkFt = slabThkIn / 12;
  const slabCY = (areaSF * thkFt) / 27;
  const vaporSF = areaSF * 1.10;
  const rebarSF = areaSF; // allowance per SF
  notes.push(`Slab: ${slabThkIn}" thick ≈ ${slabCY.toFixed(2)} CY`);
  return {
    type,
    geoSF: areaSF * 0.0,
    gravelCY,
    skidCountEA: 0,
    pierCountEA: 0,
    slabCY,
    rebarSF,
    vaporSF,
    notes
  };
}
