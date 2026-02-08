function packRgba(r, g, b, a = 255){
  return (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0;
}

function clampByte(v){
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTexture({ id, label, group, csi, w = 64, h = 64, worldRepeat = 2, data }){
  if (!id || typeof id !== "string") throw new Error("Texture id required");
  if (!(data instanceof Uint32Array) || data.length !== w * h){
    throw new Error(`Texture ${id} data must be Uint32Array(${w * h})`);
  }
  const tex = {
    id,
    label: label || id,
    group: group || "misc",
    csi: csi || "",
    w,
    h,
    maskU: (w & (w - 1)) === 0 ? (w - 1) : 0,
    maskV: (h & (h - 1)) === 0 ? (h - 1) : 0,
    worldRepeat: Number.isFinite(worldRepeat) && worldRepeat > 0 ? worldRepeat : 2,
    data,
  };
  return tex;
}

function texSampleNearest(tex, u, v){
  let x = u | 0;
  let y = v | 0;
  if (tex.maskU){
    x &= tex.maskU;
  }else{
    x = ((x % tex.w) + tex.w) % tex.w;
  }
  if (tex.maskV){
    y &= tex.maskV;
  }else{
    y = ((y % tex.h) + tex.h) % tex.h;
  }
  return tex.data[y * tex.w + x] >>> 0;
}

function makeSolid(id, rgba, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const data = new Uint32Array(w * h);
  data.fill(rgba >>> 0);
  return makeTexture({ id, data, ...meta });
}

function makeNoiseSpeckle(id, baseRgb, speckRgb, density01, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const rng = mulberry32((id.split("").reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381) ^ 0xA53C19) >>> 0);
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const t = rng();
      const rgb = t < density01 ? speckRgb : baseRgb;
      data[y * w + x] = packRgba(rgb[0], rgb[1], rgb[2], 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeGrid(id, baseRgb, lineRgb, cellPx, linePx, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const gx = x % cellPx;
      const gy = y % cellPx;
      const isLine = gx < linePx || gy < linePx;
      const rgb = isLine ? lineRgb : baseRgb;
      data[y * w + x] = packRgba(rgb[0], rgb[1], rgb[2], 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeWood(id, baseRgb, grainRgb, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const rng = mulberry32((id.split("").reduce((a, c) => (a * 131 + c.charCodeAt(0)) >>> 0, 7) ^ 0xC0FFEE) >>> 0);
  const data = new Uint32Array(w * h);
  const knots = [];
  for (let i = 0; i < 6; i++){
    knots.push({
      x: Math.floor(rng() * w),
      y: Math.floor(rng() * h),
      r: 3 + Math.floor(rng() * 8),
    });
  }
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const wave = Math.sin((x / w) * Math.PI * 10 + Math.sin((y / h) * Math.PI * 2) * 0.8);
      const grain = (wave * 0.5 + 0.5);
      let k = 0;
      for (const knot of knots){
        const dx = x - knot.x;
        const dy = y - knot.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const bump = Math.max(0, 1 - d / knot.r);
        k += bump;
      }
      k = Math.min(1, k);
      const mix = Math.min(1, 0.15 + grain * 0.35 + k * 0.45);
      const r = clampByte(baseRgb[0] * (1 - mix) + grainRgb[0] * mix);
      const g = clampByte(baseRgb[1] * (1 - mix) + grainRgb[1] * mix);
      const b = clampByte(baseRgb[2] * (1 - mix) + grainRgb[2] * mix);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeFrp(id, baseRgb, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const bump = (((x >> 3) + (y >> 3)) & 1) ? 10 : -10;
      const r = clampByte(baseRgb[0] + bump);
      const g = clampByte(baseRgb[1] + bump);
      const b = clampByte(baseRgb[2] + bump);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeBeadboard(id, baseRgb, grooveRgb, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const gx = x % 8;
      const isGroove = gx === 0 || gx === 1;
      const rgb = isGroove ? grooveRgb : baseRgb;
      data[y * w + x] = packRgba(rgb[0], rgb[1], rgb[2], 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeSubwayTile(id, baseRgb, groutRgb, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const data = new Uint32Array(w * h);
  const tileW = 16;
  const tileH = 8;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const row = Math.floor(y / tileH);
      const off = (row & 1) ? (tileW >> 1) : 0;
      const xx = (x + off) % tileW;
      const yy = y % tileH;
      const isGrout = xx === 0 || yy === 0 || xx === tileW - 1 || yy === tileH - 1;
      const rgb = isGrout ? groutRgb : baseRgb;
      data[y * w + x] = packRgba(rgb[0], rgb[1], rgb[2], 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makePlasterSmooth(id, baseRgb, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const rng = mulberry32((id.length * 2654435761) >>> 0);
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const n = (rng() - 0.5) * 18;
      const r = clampByte(baseRgb[0] + n);
      const g = clampByte(baseRgb[1] + n);
      const b = clampByte(baseRgb[2] + n);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeConcreteTrowel(id, baseRgb, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const swirl = Math.sin((x / w) * Math.PI * 6) * Math.sin((y / h) * Math.PI * 6);
      const t = swirl * 10;
      const r = clampByte(baseRgb[0] + t);
      const g = clampByte(baseRgb[1] + t);
      const b = clampByte(baseRgb[2] + t);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeActCeiling(id, meta){
  const w = meta?.w || 64;
  const h = meta?.h || 64;
  const data = new Uint32Array(w * h);
  const base = [242, 242, 244];
  const grid = [205, 205, 210];
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const gx = x % 16;
      const gy = y % 16;
      const isGrid = gx === 0 || gy === 0;
      const rgb = isGrid ? grid : base;
      data[y * w + x] = packRgba(rgb[0], rgb[1], rgb[2], 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

const REGISTRY = (() => {
  const tex = Object.create(null);
  const put = (t) => { tex[t.id] = t; };

  put(makePlasterSmooth("DRYWALL_PRIMED", [247, 247, 247], { group: "wall", label: "Drywall (Primed)", csi: "09 29 00", worldRepeat: 2 }));
  put(makeSolid("PAINT_FLAT_WHITE", packRgba(250, 250, 250, 255), { group: "wall", label: "Paint (Flat White)", csi: "09 91 23", worldRepeat: 2 }));
  put(makeSolid("PAINT_EGGSHELL_LIGHTGRAY", packRgba(230, 232, 236, 255), { group: "wall", label: "Paint (Eggshell Light Gray)", csi: "09 91 23", worldRepeat: 2 }));
  put(makeFrp("FRP_WHITE", [245, 245, 248], { group: "wall", label: "FRP White", csi: "06 42 00", worldRepeat: 3 }));
  put(makeSubwayTile("TILE_SUBWAY_WHITE", [248, 248, 250], [215, 215, 220], { group: "wall", label: "Subway Tile White", csi: "09 30 00", worldRepeat: 3 }));
  put(makePlasterSmooth("PLASTER_SMOOTH", [246, 244, 242], { group: "wall", label: "Plaster (Smooth)", csi: "09 24 00", worldRepeat: 2 }));
  put(makeBeadboard("WAINSCOT_BEADBOARD_WHITE", [248, 248, 250], [220, 220, 224], { group: "wall", label: "Wainscot Beadboard White", csi: "06 20 00", worldRepeat: 3 }));

  put(makeNoiseSpeckle("VCT_SPECKLE_LIGHT", [232, 233, 236], [190, 190, 195], 0.22, { group: "floor", label: "VCT Speckle Light", csi: "09 65 00", worldRepeat: 4 }));
  put(makeWood("LVP_OAK_LIGHT", [205, 175, 125], [160, 120, 70], { group: "floor", label: "LVP Oak Light", csi: "09 64 00", worldRepeat: 4 }));
  put(makeNoiseSpeckle("CARPET_LOOP_GRAY", [120, 122, 126], [90, 90, 95], 0.35, { group: "floor", label: "Carpet Loop Gray", csi: "09 68 00", worldRepeat: 4 }));
  put(makeConcreteTrowel("CONCRETE_TROWEL", [156, 158, 160], { group: "floor", label: "Concrete (Trowel)", csi: "03 35 00", worldRepeat: 3 }));
  put(makeGrid("TILE_CERAMIC_GRAY_12X12", [228, 228, 232], [198, 198, 204], 16, 1, { group: "floor", label: "Ceramic Tile Gray 12x12", csi: "09 30 00", worldRepeat: 4 }));
  put(makeGrid("TILE_PORCELAIN_WHITE_24X24", [248, 248, 250], [220, 220, 224], 24, 1, { group: "floor", label: "Porcelain Tile White 24x24", csi: "09 30 00", worldRepeat: 4 }));
  put(makeNoiseSpeckle("CONCRETE_SEALED_LIGHT", [170, 172, 175], [190, 190, 195], 0.08, { group: "floor", label: "Concrete (Sealed Light)", csi: "03 35 00", worldRepeat: 3 }));

  put(makeActCeiling("ACT_2x2", { group: "ceiling", label: "ACT 2x2", csi: "09 51 00", worldRepeat: 4 }));
  put(makeSolid("GWB_SMOOTH_WHITE", packRgba(248, 248, 250, 255), { group: "ceiling", label: "GWB Smooth White", csi: "09 29 00", worldRepeat: 2 }));
  put(makeGrid("ACT_2x4", [242, 242, 244], [205, 205, 210], 16, 1, { group: "ceiling", label: "ACT 2x4", csi: "09 51 00", worldRepeat: 4 }));
  put(makeSolid("CEILING_OPEN_BLACK", packRgba(18, 18, 22, 255), { group: "ceiling", label: "Open Ceiling (Black)", csi: "09 90 00", worldRepeat: 2 }));
  put(makeWood("CEILING_WOOD_SLAT", [186, 156, 110], [125, 90, 55], { group: "ceiling", label: "Wood Slat Ceiling", csi: "06 17 00", worldRepeat: 4 }));

  put(makeBeadboard("WOOD_BASE_WHITE", [246, 246, 248], [220, 220, 224], { group: "trim", label: "Wood Base White", csi: "06 20 00", worldRepeat: 6 }));
  put(makeBeadboard("WOOD_CASING_WHITE", [246, 246, 248], [220, 220, 224], { group: "trim", label: "Wood Casing White", csi: "06 20 00", worldRepeat: 6 }));
  put(makeSolid("RUBBER_BASE_BLACK", packRgba(24, 24, 26, 255), { group: "trim", label: "Rubber Base (Black)", csi: "09 65 00", worldRepeat: 6 }));
  put(makeSolid("MDF_BASE_WHITE", packRgba(245, 245, 248, 255), { group: "trim", label: "MDF Base (White)", csi: "06 20 00", worldRepeat: 6 }));

  put(makeGrid("BRICK_RUNNING_BOND", [150, 60, 50], [190, 190, 195], 16, 1, { group: "wall", label: "Brick (Running Bond)", csi: "04 21 13", worldRepeat: 3 }));
  put(makeGrid("CMU_STACK_BOND", [165, 168, 172], [135, 138, 142], 16, 2, { group: "wall", label: "CMU (Stack Bond)", csi: "04 22 00", worldRepeat: 3 }));
  put(makeWood("WOOD_PANEL_WALNUT", [130, 95, 60], [80, 55, 30], { group: "wall", label: "Wood Panel (Walnut)", csi: "06 41 00", worldRepeat: 3 }));

  return tex;
})();

export function listFinishTextureIds(){
  return Object.keys(REGISTRY).sort();
}

export function getFinishTexture(id){
  if (!id) return null;
  const key = String(id).trim();
  if (!key) return null;
  return REGISTRY[key] || null;
}

export function resolveFinishId(value, fallback = null){
  if (typeof value !== "string") return fallback;
  const key = value.trim();
  if (!key) return fallback;
  if (REGISTRY[key]) return key;
  return fallback;
}

export function sampleFinishTexture(id, u, v, fallbackRgba = packRgba(200, 0, 200, 255)){
  const tex = getFinishTexture(id);
  if (!tex) return fallbackRgba >>> 0;
  return texSampleNearest(tex, u, v);
}

export async function loadFinishTextureImage(id, url){
  const key = String(id || "").trim();
  if (!key) throw new Error("loadFinishTextureImage: id required");
  if (typeof url !== "string" || !url.trim()) throw new Error("loadFinishTextureImage: url required");
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  const p = new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load texture image: ${url}`));
  });
  img.src = url;
  await p;
  const w = 64;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable for texture load");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const data = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++){
    const o = i * 4;
    data[i] = packRgba(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]);
  }
  REGISTRY[key] = makeTexture({ id: key, label: key, group: "custom", csi: "", w, h, worldRepeat: 2, data });
  return key;
}

export const __internal = {
  packRgba,
};
