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
      wallSheathKey: $("wallSheath").value,
      sidingProfile: $("sidingProfile").value,
      wallColor: $("wallColor").value,
      trimColor: $("trimColor").value,
      showStuds: $("showStuds").value === "yes"
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
      roofSheathKey: $("roofSheath").value,
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
      mhRoofPerSF: Number($("mhRoofPerSF").value),
      mhFoundationBase: Number($("mhFoundationBase").value)
    }
  };
}

export function defaultState() {
  return {
    geom: { lenFt:10, widFt:10, htFt:8, includeFloor:true },
    walls: { studType:"2x4", studSpacingIn:16, topPlate:"single", cornerStyle:"3-stud", wallSheathKey:"osb_7_16", sidingProfile:"lap", wallColor:"cedar", trimColor:"white", showStuds:false },
    openings: { doorCount:1, doorWft:3, doorHft:7, winCount:1, winWft:3, winHft:3, trimKey:"none", doorStyle:"single", windowLayout:"balanced" },
    roof: { type:"flat", pitchX12:3, overhangFt:0.5, roofSheathKey:"osb_7_16", roofFinish:"metal", roofColor:"galvalume", includeFasciaSoffit:true, soffitWidthFt:0.5 },
    foundation: { type:"skids", gravelDepthFt:0.5, slabThkIn:4, pierSpacingFt:6 },
    logistics: { shipMult:1.0, handlingPct:0.05 },
    labor: { tradeRateKey:"architectural", remoteFactor:1.15, mhPerSF:0.045, mhPerSheet:0.18, mhRoofPerSF:0.020, mhFoundationBase:4.0 }
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
  $("wallSheath").value = state.walls.wallSheathKey;
  $("sidingProfile").value = state.walls.sidingProfile;
  $("wallColor").value = state.walls.wallColor;
  $("trimColor").value = state.walls.trimColor;
  $("showStuds").value = state.walls.showStuds ? "yes" : "no";

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
  $("roofSheath").value = state.roof.roofSheathKey;
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
  $("mhRoofPerSF").value = state.labor.mhRoofPerSF;
  $("mhFoundationBase").value = state.labor.mhFoundationBase;
}
