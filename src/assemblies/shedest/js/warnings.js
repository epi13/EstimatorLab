export function getShedWarnings(state, estimateItems=[]) {
  const warnings = [];
  const add = (id, section, message, severity="advisory", assemblyId=null) => warnings.push({ id, section, message, severity, assemblyId });
  const area = state.geom.lenFt * state.geom.widFt;
  const wallArea = 2 * (state.geom.lenFt + state.geom.widFt) * state.geom.htFt;
  const openingArea = (state.openings.doorCount * state.openings.doorWft * state.openings.doorHft) + (state.openings.winCount * state.openings.winWft * state.openings.winHft);

  if (area < 64) add("small-footprint", "Geometry", "Very small shed footprint; verify clearances, door swing, and constructability.", "info");
  if (area > 320) add("large-footprint", "Geometry", "Large shed footprint; confirm this estimator is still appropriate for code, foundation, and logistics scope.", "warning");
  if (state.geom.htFt < state.openings.doorHft + 0.5) add("door-height", "Openings", "Wall height is close to or below typical rough opening/header depth for the selected door.", "warning", "doors");
  if (openingArea > wallArea * 0.28) add("opening-density", "Openings", "Door/window area is high for the wall area; framing layout and lateral bracing may need review.", "warning", "openings");
  if ((state.openings.doorCount + state.openings.winCount) > 5) add("opening-layout", "Openings", "Multiple openings may conflict with typical stud spacing, headers, and corners.", "advisory", "openings");
  if (state.roof.pitchX12 < 3 && state.roof.roofFinish === "shingle") add("low-slope-shingles", "Roof", "Low-slope roof with shingles selected; verify manufacturer minimum slope and underlayment.", "warning", "roof");
  if (state.roof.type === "flat" && state.roof.includeRoofFinish && state.roof.roofFinish !== "membrane") add("flat-roof-finish", "Roof", "Flat roofs usually need a membrane or low-slope roofing system.", "warning", "roof");
  if (!state.roof.includeRoofFinish && state.roof.type === "flat") add("flat-no-finish", "Roof", "Flat roof has no finish selected; waterproofing is excluded.", "warning", "roof");
  if (state.foundation.type === "slab") add("slab-base-prep", "Foundation", "Slab selected; excavation, base prep, reinforcement, and curing assumptions should be verified.", "advisory", "foundation");
  if (["crawlspace", "basement"].includes(state.foundation.type)) add("deep-foundation", "Foundation", "Crawlspace/basement scope is unusual for a shed estimator; treat as budgetary only.", "warning", "foundation");
  if (state.labor.remoteFactor === 1) add("remote-factor-default", "Labor / Freight", "Remote/conditions factor is still 1.0; Alaska site conditions may require an uplift.", "advisory", "logistics");
  if (state.logistics.shipMult === 1) add("shipping-default", "Labor / Freight", "Shipping multiplier is still 1.0; confirm freight lane and delivery assumptions.", "advisory", "logistics");
  if (state.interior.includeInsulation && state.walls.studType === "2x4" && state.interior.insulationKey === "batt_r19") add("insulation-depth", "Finishes", "R-19 batt is typically deeper than a 2x4 wall cavity.", "warning", "interior-finish");
  if (state.interior.includeDrywall && !state.interior.includeInsulation) add("drywall-no-insulation", "Finishes", "Drywall without insulation is allowed but unusual; confirm interior performance expectations.", "info", "interior-finish");
  if (!estimateItems.length) add("no-estimate", "Estimate", "No estimate rows were produced; verify material data loaded correctly.", "warning");
  return warnings;
}
