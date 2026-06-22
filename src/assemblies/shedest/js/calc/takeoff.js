import { perimeterFt, wallAreaSF, floorAreaSF, ceilSheets, studsCountForPerimeter, sticksFromLF } from "./geometry.js";
import { openingsTakeoff } from "./openings.js";
import { wallsTakeoff } from "./walls.js";
import { roofTakeoff } from "./roof.js";
import { foundationTakeoff } from "./foundation.js";

export function buildTakeoff(state, db) {
  const { geom, walls, interior, openings, roof, foundation } = state;

  const perim = perimeterFt(geom.lenFt, geom.widFt);
  const wallArea = wallAreaSF(perim, geom.htFt);
  const floorArea = geom.includeFloor ? floorAreaSF(geom.lenFt, geom.widFt) : 0;

  // Openings
  const openInfo = openingsTakeoff({
    wallHtFt: geom.htFt,
    studSpacingIn: walls.studSpacingIn,
    studType: walls.studType,
    doorCount: openings.doorCount, doorWft: openings.doorWft, doorHft: openings.doorHft,
    winCount: openings.winCount, winWft: openings.winWft, winHft: openings.winHft,
    trimKey: openings.trimKey
  });

  // Wall sheathing after openings
  const netWallSheathArea = Math.max(0, wallArea - openInfo.openingAreaSF);
  const wallSheets = walls.includeWallSheath ? ceilSheets(netWallSheathArea, db.sheetSF(walls.wallSheathKey), 0.10) : 0;

  // Baseline studs
  const baseStuds = studsCountForPerimeter(perim, walls.studSpacingIn, 0.10);

  // Walls framing: studs, plates, headers
  const wallFrame = wallsTakeoff({
    lenFt: geom.lenFt, widFt: geom.widFt, htFt: geom.htFt,
    studSpacingIn: walls.studSpacingIn,
    studType: walls.studType,
    topPlate: walls.topPlate,
    cornerStyle: walls.cornerStyle,
    perimFt: perim,
    baseStudsEA: baseStuds,
    openingsInfo: openInfo
  });

  // Floor framing
  let floorJoistsEA = 0;
  let floorRimEA = 0;
  let floorSheets = 0;
  if (geom.includeFloor) {
    const spacingFt = walls.studSpacingIn / 12;
    const joists = Math.ceil(geom.lenFt / spacingFt) + 1;
    const joistLF = joists * geom.widFt;
    floorJoistsEA = sticksFromLF(joistLF, 8, 0.12);

    floorRimEA = sticksFromLF(perim, 8, 0.12);

    // Use T&G for floor unless you add a selector; here use tg_ply_3_4
    floorSheets = ceilSheets(floorArea, db.sheetSF("tg_ply_3_4"), 0.10);
  }

  // Roof takeoff
  const roofInfo = roofTakeoff({
    lenFt: geom.lenFt,
    widFt: geom.widFt,
    roofType: roof.type,
    pitchX12: roof.pitchX12,
    overhangFt: roof.overhangFt,
    studSpacingIn: walls.studSpacingIn,
    includeFasciaSoffit: roof.includeFasciaSoffit,
    soffitWidthFt: roof.soffitWidthFt
  });

  const roofSheets = roof.includeRoofSheath ? ceilSheets(roofInfo.roofAreaSF, db.sheetSF(roof.roofSheathKey), 0.10) : 0;

  // Foundation
  const fnd = foundationTakeoff({
    type: foundation.type,
    lenFt: geom.lenFt,
    widFt: geom.widFt,
    gravelDepthFt: foundation.gravelDepthFt,
    slabThkIn: foundation.slabThkIn,
    pierSpacingFt: foundation.pierSpacingFt
  });

  // Build items with your naming syntax-ish (Dimension)(Capacity)(Power)(Features) ITEM (Ancillaries)
  const items = [];

  const lumberKey = (walls.studType === "2x6") ? "2x6x8" : "2x4x8";

  items.push(db.item(`${walls.studType.toUpperCase()}, Stud ITEM (Wall studs incl openings)`, lumberKey, wallFrame.studsEA, "EA"));
  items.push(db.item(`${walls.studType.toUpperCase()}, Plate ITEM (Top+Bottom plates, 8')`, lumberKey, wallFrame.plateSticksEA, "EA"));
  items.push(db.item(`${walls.studType.toUpperCase()}, Header ITEM (Budgetary headers, 8')`, lumberKey, wallFrame.headerSticksEA, "EA"));

  if (walls.includeWallSheath) items.push(db.item(`4'x8', ${db.desc(walls.wallSheathKey)} ITEM (Wall sheathing)`, walls.wallSheathKey, wallSheets, "EA"));
  const sidingKey = walls.sidingProfile === "boardbatten" ? "bb_siding_sf" : (walls.sidingProfile === "panel" ? "panel_siding_sf" : "lap_siding_sf");
  if (walls.includeSiding) items.push(db.item(`SF, ${db.desc(sidingKey)} ITEM (Exterior finish)`, sidingKey, netWallSheathArea, "SF"));

  if (roof.includeRoofSheath) items.push(db.item(`4'x8', ${db.desc(roof.roofSheathKey)} ITEM (Roof sheathing)`, roof.roofSheathKey, roofSheets, "EA"));
  const roofFinishKey = roof.roofFinish === "shingle" ? "shingle_roof_sf" : (roof.roofFinish === "membrane" ? "membrane_roof_sf" : "metal_roof_sf");
  if (roof.includeRoofFinish) items.push(db.item(`SF, ${db.desc(roofFinishKey)} ITEM (Roof finish)`, roofFinishKey, roofInfo.roofAreaSF, "SF"));

  // Roof framing
  items.push(db.item(`${walls.studType.toUpperCase()}, Rafter ITEM (Roof framing, 8')`, lumberKey, roofInfo.rafterSticksEA, "EA"));
  if (roofInfo.ridgeSticksEA > 0) {
    items.push(db.item(`${walls.studType.toUpperCase()}, Ridge ITEM (Ridge board, 8')`, lumberKey, roofInfo.ridgeSticksEA, "EA"));
  }

  // Fascia / soffit
  if (roof.includeFasciaSoffit) {
    // model fascia as LF of trim material if trim chosen; else skip cost but keep quantity note
    const fasciaLF = roofInfo.fasciaLF;
    if (openings.trimKey !== "none") {
      items.push(db.item(`${fasciaLF.toFixed(0)} LF, Fascia ITEM (Using ${db.desc(openings.trimKey)})`, openings.trimKey, fasciaLF, "LF"));
    } else {
      // no trim item selected: still track with a $0 placeholder? we’ll keep a note-only item by using misc LS = 0 qty
      items.push({ name:`${fasciaLF.toFixed(0)} LF, Fascia ITEM (No material selected)`, qty: fasciaLF, unit:"LF", base:0, freight_class:"bulk" });
    }

    // Soffit as SF geotextile placeholder? Better: treat as sheet goods later. For now: track only if >0.
    if (roofInfo.soffitSF > 0) {
      items.push({ name:`${roofInfo.soffitSF.toFixed(0)} SF, Soffit ITEM (Budgetary, material TBD)`, qty: roofInfo.soffitSF, unit:"SF", base:0, freight_class:"flat" });
    }
  }


  // Interior finishes
  if (interior.includeInsulation) {
    items.push(db.item(`SF, ${db.desc(interior.insulationKey)} ITEM (Wall insulation)`, interior.insulationKey, netWallSheathArea, "SF"));
  }
  if (interior.includeDrywall) {
    const drywallSheets = ceilSheets(netWallSheathArea, db.sheetSF("drywall_1_2"), 0.10);
    items.push(db.item(`4'x8', ${db.desc("drywall_1_2")} ITEM (Interior drywall)`, "drywall_1_2", drywallSheets, "EA"));
    if (interior.drywallFinish !== "hang_only") {
      const finishKey = interior.drywallFinish === "level4" ? "drywall_finish_level4_sf" : "drywall_finish_level3_sf";
      items.push(db.item(`SF, ${db.desc(finishKey)} ITEM (Drywall finish)`, finishKey, netWallSheathArea, "SF"));
    }
  }

  // Openings assemblies and trim
  const doorKey = openings.doorStyle === "double" ? "shed_door_double" : (openings.doorStyle === "rollup" ? "rollup_door" : "shed_door_single");
  if (openings.doorCount > 0) items.push(db.item(`EA, ${db.desc(doorKey)} ITEM`, doorKey, openings.doorCount, "EA"));
  if (openings.winCount > 0) items.push(db.item(`EA, ${db.desc("vinyl_window")} ITEM`, "vinyl_window", openings.winCount, "EA"));
  if (openings.trimKey !== "none" && openInfo.trimLF > 0) {
    items.push(db.item(`LF, ${db.desc(openings.trimKey)} ITEM (Opening trim)`, openings.trimKey, openInfo.trimLF, "LF"));
  }

  // Floor
  if (geom.includeFloor) {
    items.push(db.item(`${walls.studType.toUpperCase()}, Joist ITEM (Floor framing, 8')`, lumberKey, floorJoistsEA, "EA"));
    items.push(db.item(`${walls.studType.toUpperCase()}, Rim ITEM (Floor rim, 8')`, lumberKey, floorRimEA, "EA"));
    items.push(db.item(`4'x8', ${db.desc("tg_ply_3_4")} ITEM (Floor sheathing)`, "tg_ply_3_4", floorSheets, "EA"));
  }

  // Foundation items
  if (fnd.type === "skids") {
    items.push(db.item(`SF, Geotextile ITEM (Underlayment)`, "geotextile", fnd.geoSF, "SF"));
    items.push(db.item(`CY, Gravel ITEM (Base)`, "gravel", fnd.gravelCY, "CY"));
    items.push(db.item(`PT, 4x6x12 Skid ITEM`, "pt_skid_4x6x12", fnd.skidCountEA, "EA"));
  } else if (fnd.type === "piers") {
    items.push(db.item(`CY, Gravel ITEM (Pads/base)`, "gravel", fnd.gravelCY, "CY"));
    items.push(db.item(`EA, Sonotube ITEM (Piers)`, "sonotube_12x4", fnd.pierCountEA, "EA"));
    items.push(db.item(`CY, Concrete ITEM (Piers)`, "concrete", fnd.pierCountEA * 0.15, "CY"));
  } else if (fnd.type === "ground_screws") {
    items.push(db.item(`CY, Gravel ITEM (Pads/base)`, "gravel", fnd.gravelCY, "CY"));
    items.push(db.item(`EA, Ground Screw ITEM`, "ground_screw", fnd.groundScrewCountEA, "EA"));
  } else if (fnd.type !== "none") {
    items.push(db.item(`CY, Gravel ITEM (Base)`, "gravel", fnd.gravelCY, "CY"));
    items.push(db.item(`SF, Vapor Barrier ITEM`, "vapor_barrier", fnd.vaporSF, "SF"));
    items.push(db.item(`SF, Rebar ITEM (Allowance)`, "rebar", fnd.rebarSF, "SF"));
    items.push(db.item(`CY, Concrete ITEM (Slab)`, "concrete", fnd.slabCY, "CY"));
    if (fnd.wallCY > 0) items.push(db.item(`CY, Concrete ITEM (Foundation walls)`, "concrete", fnd.wallCY, "CY"));
    if (fnd.excavationCY > 0) items.push(db.item(`CY, Excavation ITEM`, "excavation", fnd.excavationCY, "CY"));
  }

  items.push(db.item(`LS, Fasteners ITEM (Nails/screws/misc)`, "fasteners_ls", 1, "LS"));

  const notes = [
    ...openInfo.notes,
    ...wallFrame.notes,
    ...fnd.notes,
    `Wall sheathing net area: ${netWallSheathArea.toFixed(2)} SF (after openings)`,
    walls.includeSiding ? `Exterior finish: ${walls.sidingProfile} siding, ${walls.wallColor} walls, ${walls.trimColor} trim` : `Exterior finish excluded`,
    `Interior: insulation ${interior.includeInsulation ? interior.insulationKey : "excluded"}; drywall ${interior.includeDrywall ? interior.drywallFinish : "excluded"}`,
    `Roof finish: ${roof.roofFinish}, ${roof.roofColor} color`,
    `Roof area: ${roofInfo.roofAreaSF.toFixed(2)} SF (incl overhang/slope)`,
    `Perimeter: ${perim.toFixed(2)} LF`
  ];

  return {
    perimFt: perim,
    wallAreaSF: wallArea,
    netWallSheathAreaSF: netWallSheathArea,
    roofAreaSF: roofInfo.roofAreaSF,
    floorAreaSF: floorArea,
    roofInfo,
    foundationInfo: fnd,
    items,
    notes
  };
}
