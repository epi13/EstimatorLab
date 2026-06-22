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

  if (type === "none") {
    notes.push("Foundation excluded / provided by others.");
    return { type, geoSF: 0, gravelCY: 0, skidCountEA: 0, pierCountEA: 0, groundScrewCountEA: 0, slabCY: 0, wallCY: 0, excavationCY: 0, rebarSF: 0, vaporSF: 0, notes };
  }

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
      groundScrewCountEA: 0,
      slabCY: 0,
      rebarSF: 0,
      vaporSF: 0,
      notes
    };
  }

  if (type === "piers" || type === "ground_screws") {
    // piers: rows along length, 2 rows (sides)
    const perRow = Math.ceil(lenFt / pierSpacingFt) + 1;
    const pierCount = perRow * 2;
    if (type === "ground_screws") {
      notes.push(`Ground screws: ${pierCount} budgetary helical ground screws.`);
      return {
        type,
        geoSF: 0,
        gravelCY: gravelCY * 0.25,
        skidCountEA: 0,
        pierCountEA: 0,
        groundScrewCountEA: pierCount,
        slabCY: 0,
        wallCY: 0,
        excavationCY: 0,
        rebarSF: 0,
        vaporSF: 0,
        notes
      };
    }

    // concrete per pier budgetary 0.15 CY (about 12" dia x 4' w/ bell etc.)
    const concCY = pierCount * 0.15;
    notes.push(`Piers: ${pierCount} (12" sonotube x 4'). Concrete ≈ ${concCY.toFixed(2)} CY`);
    return {
      type,
      geoSF: areaSF * 0.0,
      gravelCY: gravelCY * 0.5, // less gravel typically
      skidCountEA: 0,
      pierCountEA: pierCount,
      groundScrewCountEA: 0,
      slabCY: 0,
      rebarSF: 0,
      vaporSF: 0,
      notes
    };
  }

  // slab / crawlspace / basement
  const thkFt = slabThkIn / 12;
  const slabCY = (areaSF * thkFt) / 27;
  const vaporSF = areaSF * 1.10;
  const rebarSF = areaSF; // allowance per SF
  let wallCY = 0;
  let excavationCY = 0;

  if (type === "crawlspace" || type === "basement") {
    const wallHeightFt = type === "basement" ? 8 : 3;
    const wallThkFt = type === "basement" ? 8 / 12 : 6 / 12;
    wallCY = ((2 * (lenFt + widFt)) * wallHeightFt * wallThkFt) / 27;
    excavationCY = type === "basement" ? (areaSF * 9) / 27 : (areaSF * 2) / 27;
    notes.push(`${type === "basement" ? "Basement" : "Crawlspace"}: ${wallHeightFt}' walls ≈ ${wallCY.toFixed(2)} CY; excavation ≈ ${excavationCY.toFixed(2)} CY.`);
  } else {
    notes.push(`Slab: ${slabThkIn}" thick ≈ ${slabCY.toFixed(2)} CY`);
  }

  return {
    type,
    geoSF: areaSF * 0.0,
    gravelCY,
    skidCountEA: 0,
    pierCountEA: 0,
    groundScrewCountEA: 0,
    slabCY,
    wallCY,
    excavationCY,
    rebarSF,
    vaporSF,
    notes
  };
}
