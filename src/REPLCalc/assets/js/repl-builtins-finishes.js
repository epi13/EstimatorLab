import { convert, isQty, makeQty } from "./repl-units.js";
import { EFFECT } from "./repl-effects.js";
import { getFinishTexture, resolveFinishId, listFinishTextureIds } from "./repl-textures-finishes.js";

export function attachFinishBuiltins(baseFns, { defFn, defFnCtx }){
  function normKey(s){
    return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function csiDigitsOnly(code){
    return String(code || "").replace(/[^0-9]/g, "");
  }

  function finishIdFromCsi(code, group){
    const d = csiDigitsOnly(code);
    if (group === "wall"){
      if (d.startsWith("0930")) return "TILE_SUBWAY_WHITE";
      if (d.startsWith("0965")) return "VCT_SPECKLE_LIGHT";
      if (d.startsWith("0964")) return "LVP_OAK_LIGHT";
      if (d.startsWith("0968")) return "CARPET_LOOP_GRAY";
      if (d.startsWith("0642")) return "FRP_WHITE";
      if (d.startsWith("0421")) return "BRICK_RUNNING_BOND";
      if (d.startsWith("0422")) return "CMU_STACK_BOND";
      if (d.startsWith("0924")) return "PLASTER_SMOOTH";
      if (d.startsWith("0991")) return "PAINT_FLAT_WHITE";
      if (d.startsWith("0929")) return "DRYWALL_PRIMED";
      return "DRYWALL_PRIMED";
    }
    if (group === "floor"){
      if (d.startsWith("0335")) return "CONCRETE_TROWEL";
      if (d.startsWith("0965")) return "VCT_SPECKLE_LIGHT";
      if (d.startsWith("0964")) return "LVP_OAK_LIGHT";
      if (d.startsWith("0968")) return "CARPET_LOOP_GRAY";
      if (d.startsWith("0930")) return "TILE_CERAMIC_GRAY_12X12";
      return "CONCRETE_TROWEL";
    }
    if (group === "ceiling"){
      if (d.startsWith("0951")) return "ACT_2x2";
      if (d.startsWith("0929")) return "GWB_SMOOTH_WHITE";
      return "ACT_2x2";
    }
    if (group === "trim"){
      if (d.startsWith("0965")) return "RUBBER_BASE_BLACK";
      return "WOOD_BASE_WHITE";
    }
    return "DRYWALL_PRIMED";
  }

  function normalizeFinishId(value, group, fallback){
    if (typeof value === "string"){
      const direct = resolveFinishId(value, null);
      if (direct) return direct;
      const key = normKey(value);
      const fromKey = resolveFinishId(key, null);
      if (fromKey) return fromKey;
      if (key === "PAINT_WHITE" || key === "PAINT_FLAT" || key === "PAINT_FLATWHITE") return "PAINT_FLAT_WHITE";
      if (key === "PAINT_EGGSHELL" || key === "PAINT_LIGHTGRAY" || key === "PAINT_LIGHT_GRAY") return "PAINT_EGGSHELL_LIGHTGRAY";
      if (key === "DRYWALL" || key === "GWB" || key === "SHEETROCK") return "DRYWALL_PRIMED";
      if (key === "FRP") return "FRP_WHITE";
      if (key === "SUBWAY_TILE" || key === "TILE" || key === "CERAMIC_TILE") return "TILE_SUBWAY_WHITE";
      if (key === "BEADBOARD" || key === "WAINSCOT" || key === "WAINSCOTING") return "WAINSCOT_BEADBOARD_WHITE";
      if (key === "ACT" || key === "T_BAR" || key === "SUSPENDED_CEILING") return "ACT_2x2";
      if (key === "ACT_2X4" || key === "ACT2X4") return "ACT_2x4";
      if (key === "OPEN_CEILING" || key === "CEILING_OPEN" || key === "OPEN_BLACK") return "CEILING_OPEN_BLACK";
      if (key === "WOOD_SLAT_CEILING" || key === "SLAT_CEILING") return "CEILING_WOOD_SLAT";
      if (key === "CONCRETE" || key === "SLAB") return "CONCRETE_TROWEL";
      if (key === "SEALED_CONCRETE" || key === "CONCRETE_SEALED") return "CONCRETE_SEALED_LIGHT";
      if (key === "VCT") return "VCT_SPECKLE_LIGHT";
      if (key === "LVP" || key === "VINYL_PLANK") return "LVP_OAK_LIGHT";
      if (key === "CARPET") return "CARPET_LOOP_GRAY";
      if (key === "CERAMIC_TILE" || key === "CERAMIC_TILE_12X12" || key === "TILE_12X12") return "TILE_CERAMIC_GRAY_12X12";
      if (key === "PORCELAIN_TILE" || key === "PORCELAIN_TILE_24X24" || key === "TILE_24X24") return "TILE_PORCELAIN_WHITE_24X24";
      if (key === "BASE" || key === "WOOD_BASE" || key === "BASEBOARD") return "WOOD_BASE_WHITE";
      if (key === "CASING" || key === "WOOD_CASING") return "WOOD_CASING_WHITE";
      if (key === "RUBBER_BASE" || key === "RUBBER_BASEBOARD") return "RUBBER_BASE_BLACK";
      if (key === "MDF_BASE" || key === "MDF_BASEBOARD") return "MDF_BASE_WHITE";
      if (key === "BRICK" || key === "BRICK_WALL") return "BRICK_RUNNING_BOND";
      if (key === "CMU" || key === "BLOCK" || key === "CONCRETE_BLOCK") return "CMU_STACK_BOND";
      if (key === "WOOD_PANEL" || key === "PANELING" || key === "WALNUT_PANEL") return "WOOD_PANEL_WALNUT";

      const maybeCsi = csiDigitsOnly(value);
      if (maybeCsi.length >= 4){
        const byCsi = finishIdFromCsi(value, group);
        if (resolveFinishId(byCsi, null)) return byCsi;
      }

      return fallback;
    }

    if (value && typeof value === "object" && value.__assy && value.__csi && value.fields && value.fields.code){
      const code = value.fields.code.value;
      const byCsi = finishIdFromCsi(code, group);
      const resolved = resolveFinishId(byCsi, fallback);
      return resolved;
    }

    return fallback;
  }

  function setVar(ctx, key, value){
    const vars = ctx?.vars;
    if (!vars || typeof vars !== "object") return;
    vars[key] = value;
  }

  baseFns.wallProcTex = defFnCtx("wallProcTex", 1, {
    args: [{ label: "id", kinds: ["scalar", "dim"] }],
    returns: { kinds: ["scalar"] },
    effects: EFFECT.STATE,
  }, (ctx, id) => {
    const n = isQty(id) ? id.value : id;
    const v = Number.isFinite(n) ? Math.floor(n) : -1;
    setVar(ctx, "doom_wall_proc_tex", v);
    return v;
  });

  baseFns.floorProcTex = defFnCtx("floorProcTex", 1, {
    args: [{ label: "id", kinds: ["scalar", "dim"] }],
    returns: { kinds: ["scalar"] },
    effects: EFFECT.STATE,
  }, (ctx, id) => {
    const n = isQty(id) ? id.value : id;
    const v = Number.isFinite(n) ? Math.floor(n) : -1;
    setVar(ctx, "doom_floor_proc_tex", v);
    return v;
  });

  baseFns.ceilingProcTex = defFnCtx("ceilingProcTex", 1, {
    args: [{ label: "id", kinds: ["scalar", "dim"] }],
    returns: { kinds: ["scalar"] },
    effects: EFFECT.STATE,
  }, (ctx, id) => {
    const n = isQty(id) ? id.value : id;
    const v = Number.isFinite(n) ? Math.floor(n) : -1;
    setVar(ctx, "doom_ceiling_proc_tex", v);
    return v;
  });

  baseFns.finishIds = defFn("finishIds", 0, {
    returns: { kinds: ["string"] },
  }, () => listFinishTextureIds().join(", "));

  baseFns.wallFinish = defFnCtx("wallFinish", 1, {
    args: [{ label: "finish", kinds: ["any"] }],
    returns: { kinds: ["string"] },
    effects: EFFECT.STATE,
  }, (ctx, finish) => {
    const id = normalizeFinishId(finish, "wall", "DRYWALL_PRIMED");
    setVar(ctx, "doom_wall_finish", id);
    return id;
  });

  baseFns.floorFinish = defFnCtx("floorFinish", 1, {
    args: [{ label: "finish", kinds: ["any"] }],
    returns: { kinds: ["string"] },
    effects: EFFECT.STATE,
  }, (ctx, finish) => {
    const id = normalizeFinishId(finish, "floor", "CONCRETE_TROWEL");
    setVar(ctx, "doom_floor_finish", id);
    return id;
  });

  baseFns.ceilingFinish = defFnCtx("ceilingFinish", 1, {
    args: [{ label: "finish", kinds: ["any"] }],
    returns: { kinds: ["string"] },
    effects: EFFECT.STATE,
  }, (ctx, finish) => {
    const id = normalizeFinishId(finish, "ceiling", "ACT_2x2");
    setVar(ctx, "doom_ceiling_finish", id);
    return id;
  });

  baseFns.trimFinish = defFnCtx("trimFinish", 2, {
    args: [
      { label: "kind", kinds: ["string"] },
      { label: "finish", kinds: ["any"] },
    ],
    returns: { kinds: ["string"] },
    effects: EFFECT.STATE,
  }, (ctx, kind, finish) => {
    const k = normKey(kind);
    const id = normalizeFinishId(finish, "trim", "WOOD_BASE_WHITE");
    if (k === "BASE" || k === "BASEBOARD"){
      setVar(ctx, "doom_trim_base_finish", id);
    }else if (k === "CASING" || k === "DOOR_CASING" || k === "WINDOW_CASING"){
      setVar(ctx, "doom_trim_casing_finish", id);
    }else{
      setVar(ctx, "doom_trim_finish", id);
    }
    return id;
  });

  baseFns.wainscot = defFnCtx("wainscot", 2, {
    args: [
      { label: "height", kinds: ["scalar", "dim"] },
      { label: "finish", kinds: ["any"] },
    ],
    returns: { kinds: ["string"] },
    effects: EFFECT.STATE,
  }, (ctx, height, finish) => {
    const id = normalizeFinishId(finish, "wall", "WAINSCOT_BEADBOARD_WHITE");
    const hQty = isQty(height) ? height : makeQty(Number(height), "len");
    const hFt = convert(hQty, "ft");
    setVar(ctx, "doom_wainscot_finish", id);
    setVar(ctx, "doom_wainscot_h", hFt);
    return id;
  });

  baseFns.finishInfo = defFn("finishInfo", 1, {
    args: [{ label: "id", kinds: ["string"] }],
    returns: { kinds: ["assy"] },
  }, (id) => {
    const key = resolveFinishId(id, null);
    const tex = key ? getFinishTexture(key) : null;
    const fields = Object.create(null);
    fields.id = { value: key || String(id || ""), note: "", raw: "" };
    fields.ok = { value: tex ? 1 : 0, note: "", raw: "" };
    fields.group = { value: tex?.group || "", note: "", raw: "" };
    fields.label = { value: tex?.label || "", note: "", raw: "" };
    fields.csi = { value: tex?.csi || "", note: "", raw: "" };
    return { __assy: true, name: "finish", fields, __finish: true };
  });
}
