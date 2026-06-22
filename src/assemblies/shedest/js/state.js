export function parseSizeToken(token) {
  // "3x7" => {w:3,h:7}
  const [w, h] = token.split("x").map(Number);
  return { w, h };
}

export function readStateFromUI(doc=document) {
  const $ = (id) => doc.getElementById(id);
  const door = parseSizeToken($("doorSize").value);
  const win = parseSizeToken($("winSize").value);

  return {
    geom: {
      lenFt: Number($("lenFt").value),
      widFt: Number($("widFt").value),
      htFt: Number($("htFt").value),
      includeFloor: $("includeFloor").value === "yes"
    },
    walls: {
      studType: $("studType").value,               // "2x4" | "2x6"
      studSpacingIn: Number($("studSpacing").value),
      topPlate: $("topPlate").value,              // "single" | "double"
      cornerStyle: $("cornerStyle").value,        // "3-stud" | "california"
      includeWallSheath: $("includeWallSheath").value === "yes",
      wallSheathKey: $("wallSheath").value,
      includeSiding: $("includeSiding").value === "yes",
      sidingProfile: $("sidingProfile").value,
      wallColor: $("wallColor").value,
      trimColor: $("trimColor").value,
      showStuds: $("showStuds").value === "yes",
      visualMode: $("visualMode").value
    },
    interior: {
      includeInsulation: $("includeInsulation").value === "yes",
      insulationKey: $("insulationType").value,
      includeDrywall: $("includeDrywall").value === "yes",
      drywallFinish: $("drywallFinish").value
    },
    openings: {
      doorCount: Number($("doorCount").value),
      doorWft: door.w,
      doorHft: door.h,
      winCount: Number($("winCount").value),
      winWft: win.w,
      winHft: win.h,
      trimKey: $("trimType").value,
      doorStyle: $("doorStyle").value,
      windowLayout: $("windowLayout").value
    },
    roof: {
      type: $("roofType").value,                  // flat | shed | gable
      pitchX12: Number($("pitch").value),
      overhangFt: Number($("overhangFt").value),
      includeRoofSheath: $("includeRoofSheath").value === "yes",
      roofSheathKey: $("roofSheath").value,
      includeRoofFinish: $("includeRoofFinish").value === "yes",
      roofFinish: $("roofFinish").value,
      roofColor: $("roofColor").value,
      includeFasciaSoffit: $("includeFasciaSoffit").value === "yes",
      soffitWidthFt: Number($("soffitWidthFt").value)
    },
    foundation: {
      type: $("foundationType").value,            // skids | piers | slab
      gravelDepthFt: Number($("gravelDepthFt").value),
      slabThkIn: Number($("slabThkIn").value),
      pierSpacingFt: Number($("pierSpacingFt").value)
    },
    logistics: {
      shipMult: Number($("shipMult").value),
      handlingPct: Number($("handlingPct").value) / 100
    },
    labor: {
      tradeRateKey: $("tradeRateKey").value,
      remoteFactor: Number($("remoteFactor").value),
      mhPerSF: Number($("mhPerSF").value),
      mhPerSheet: Number($("mhPerSheet").value),
      mhInsulationPerSF: Number($("mhInsulationPerSF").value),
      mhDrywallPerSF: Number($("mhDrywallPerSF").value),
      mhRoofPerSF: Number($("mhRoofPerSF").value),
      mhFoundationBase: Number($("mhFoundationBase").value)
    }
  };
}

export function defaultState() {
  return {
    geom: { lenFt:10, widFt:10, htFt:8, includeFloor:true },
    walls: { studType:"2x4", studSpacingIn:16, topPlate:"single", cornerStyle:"3-stud", includeWallSheath:true, wallSheathKey:"osb_7_16", includeSiding:true, sidingProfile:"lap", wallColor:"cedar", trimColor:"white", showStuds:false, visualMode:"finished" },
    interior: { includeInsulation:false, insulationKey:"batt_r13", includeDrywall:false, drywallFinish:"hang_only" },
    openings: { doorCount:1, doorWft:3, doorHft:7, winCount:1, winWft:3, winHft:3, trimKey:"none", doorStyle:"single", windowLayout:"balanced" },
    roof: { type:"flat", pitchX12:3, overhangFt:0.5, includeRoofSheath:true, roofSheathKey:"osb_7_16", includeRoofFinish:true, roofFinish:"metal", roofColor:"galvalume", includeFasciaSoffit:true, soffitWidthFt:0.5 },
    foundation: { type:"skids", gravelDepthFt:0.5, slabThkIn:4, pierSpacingFt:6 },
    logistics: { shipMult:1.0, handlingPct:0.05 },
    labor: { tradeRateKey:"architectural", remoteFactor:1.15, mhPerSF:0.045, mhPerSheet:0.18, mhInsulationPerSF:0.018, mhDrywallPerSF:0.055, mhRoofPerSF:0.020, mhFoundationBase:4.0 }
  };
}

export function applyStateToUI(state, doc=document) {
  const $ = (id) => doc.getElementById(id);
  $("lenFt").value = state.geom.lenFt;
  $("widFt").value = state.geom.widFt;
  $("htFt").value  = state.geom.htFt;
  $("includeFloor").value = state.geom.includeFloor ? "yes" : "no";

  $("studType").value = state.walls.studType;
  $("studSpacing").value = state.walls.studSpacingIn;
  $("topPlate").value = state.walls.topPlate;
  $("cornerStyle").value = state.walls.cornerStyle;
  $("includeWallSheath").value = state.walls.includeWallSheath ? "yes" : "no";
  $("wallSheath").value = state.walls.wallSheathKey;
  $("includeSiding").value = state.walls.includeSiding ? "yes" : "no";
  $("sidingProfile").value = state.walls.sidingProfile;
  $("wallColor").value = state.walls.wallColor;
  $("trimColor").value = state.walls.trimColor;
  $("showStuds").value = state.walls.showStuds ? "yes" : "no";
  $("visualMode").value = state.walls.visualMode ?? "finished";

  $("includeInsulation").value = state.interior.includeInsulation ? "yes" : "no";
  $("insulationType").value = state.interior.insulationKey;
  $("includeDrywall").value = state.interior.includeDrywall ? "yes" : "no";
  $("drywallFinish").value = state.interior.drywallFinish;

  $("doorCount").value = state.openings.doorCount;
  $("doorSize").value = `${state.openings.doorWft}x${state.openings.doorHft}`;
  $("winCount").value = state.openings.winCount;
  $("winSize").value = `${state.openings.winWft}x${state.openings.winHft}`;
  $("trimType").value = state.openings.trimKey;
  $("doorStyle").value = state.openings.doorStyle;
  $("windowLayout").value = state.openings.windowLayout;

  $("roofType").value = state.roof.type;
  $("pitch").value = state.roof.pitchX12;
  $("overhangFt").value = state.roof.overhangFt;
  $("includeRoofSheath").value = state.roof.includeRoofSheath ? "yes" : "no";
  $("roofSheath").value = state.roof.roofSheathKey;
  $("includeRoofFinish").value = state.roof.includeRoofFinish ? "yes" : "no";
  $("roofFinish").value = state.roof.roofFinish;
  $("roofColor").value = state.roof.roofColor;
  $("includeFasciaSoffit").value = state.roof.includeFasciaSoffit ? "yes" : "no";
  $("soffitWidthFt").value = state.roof.soffitWidthFt;

  $("foundationType").value = state.foundation.type;
  $("gravelDepthFt").value = state.foundation.gravelDepthFt;
  $("slabThkIn").value = state.foundation.slabThkIn;
  $("pierSpacingFt").value = state.foundation.pierSpacingFt;

  $("shipMult").value = state.logistics.shipMult;
  $("handlingPct").value = state.logistics.handlingPct * 100;

  $("tradeRateKey").value = state.labor.tradeRateKey;
  $("remoteFactor").value = state.labor.remoteFactor;
  $("mhPerSF").value = state.labor.mhPerSF;
  $("mhPerSheet").value = state.labor.mhPerSheet;
  $("mhInsulationPerSF").value = state.labor.mhInsulationPerSF;
  $("mhDrywallPerSF").value = state.labor.mhDrywallPerSF;
  $("mhRoofPerSF").value = state.labor.mhRoofPerSF;
  $("mhFoundationBase").value = state.labor.mhFoundationBase;
}

export const defaultShedState = {
  dimensions: { lengthFt: 10, widthFt: 10, wallHeightFt: 8 },
  floor: { includeFloor: true },
  walls: { studType: "2x4", studSpacingIn: 16, topPlate: "single", cornerStyle: "3-stud", includeWallSheathing: true, wallSheathing: "osb_7_16" },
  exterior: { includeSiding: true, sidingProfile: "lap", wallColor: "cedar", trimType: "none", trimColor: "white" },
  interior: { includeInsulation: false, insulationType: "batt_r13", includeDrywall: false, drywallFinish: "hang_only" },
  openings: { doorCount: 1, doorSize: "3x7", doorStyle: "single", windowCount: 1, windowSize: "3x3", windowLayout: "balanced" },
  roof: { roofType: "flat", pitch: 3, overhangFt: 0.5, includeRoofSheathing: true, roofSheathing: "osb_7_16", includeRoofFinish: true, roofFinish: "metal", roofColor: "galvalume", soffitWidthFt: 0.5, includeFasciaSoffit: true },
  foundation: { foundationType: "skids", gravelDepthFt: 0.5, slabThicknessIn: 4, pierSpacingFt: 6 },
  logistics: { shippingMultiplier: 1.0, handlingPct: 5 },
  labor: { tradeRateKey: "architectural", remoteConditionsFactor: 1.15 },
  ui: { visualMode: "finished", showStuds: false, selectedAssemblyId: null, selectedEstimateItemId: null, basicMode: false }
};

let currentState = defaultState();
const stateListeners = new Set();

export function readStateFromInputs(doc=document) {
  currentState = readStateFromUI(doc);
  return currentState;
}

export function writeStateToInputs(state, doc=document) {
  currentState = state;
  applyStateToUI(state, doc);
  notifyState();
}

export function updateState(partial) {
  currentState = deepMerge(currentState, partial);
  notifyState();
  return currentState;
}

export function subscribeToState(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function getCurrentState() { return currentState; }

export function legacyToNormalized(state=currentState) {
  return {
    dimensions: { lengthFt: state.geom.lenFt, widthFt: state.geom.widFt, wallHeightFt: state.geom.htFt },
    floor: { includeFloor: state.geom.includeFloor },
    walls: { studType: state.walls.studType, studSpacingIn: state.walls.studSpacingIn, topPlate: state.walls.topPlate, cornerStyle: state.walls.cornerStyle, includeWallSheathing: state.walls.includeWallSheath, wallSheathing: state.walls.wallSheathKey },
    exterior: { includeSiding: state.walls.includeSiding, sidingProfile: state.walls.sidingProfile, wallColor: state.walls.wallColor, trimType: state.openings.trimKey, trimColor: state.walls.trimColor },
    interior: { includeInsulation: state.interior.includeInsulation, insulationType: state.interior.insulationKey, includeDrywall: state.interior.includeDrywall, drywallFinish: state.interior.drywallFinish },
    openings: { doorCount: state.openings.doorCount, doorSize: `${state.openings.doorWft}x${state.openings.doorHft}`, doorStyle: state.openings.doorStyle, windowCount: state.openings.winCount, windowSize: `${state.openings.winWft}x${state.openings.winHft}`, windowLayout: state.openings.windowLayout },
    roof: { roofType: state.roof.type, pitch: state.roof.pitchX12, overhangFt: state.roof.overhangFt, includeRoofSheathing: state.roof.includeRoofSheath, roofSheathing: state.roof.roofSheathKey, includeRoofFinish: state.roof.includeRoofFinish, roofFinish: state.roof.roofFinish, roofColor: state.roof.roofColor, soffitWidthFt: state.roof.soffitWidthFt, includeFasciaSoffit: state.roof.includeFasciaSoffit },
    foundation: { foundationType: state.foundation.type, gravelDepthFt: state.foundation.gravelDepthFt, slabThicknessIn: state.foundation.slabThkIn, pierSpacingFt: state.foundation.pierSpacingFt },
    logistics: { shippingMultiplier: state.logistics.shipMult, handlingPct: state.logistics.handlingPct * 100 },
    labor: { tradeRateKey: state.labor.tradeRateKey, remoteConditionsFactor: state.labor.remoteFactor },
    ui: { visualMode: state.walls.visualMode, showStuds: state.walls.showStuds, selectedAssemblyId: null, selectedEstimateItemId: null, basicMode: document.body?.classList.contains("basic-mode") ?? false }
  };
}

function notifyState() { for (const listener of stateListeners) listener(currentState); }
function deepMerge(target, patch) {
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(patch ?? {})) out[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(out[key] ?? {}, value) : value;
  return out;
}
