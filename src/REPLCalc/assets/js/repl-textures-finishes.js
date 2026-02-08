function packRgba(r, g, b, a = 255){
  return (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255)) >>> 0;
}

function clampByte(v){
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

const DEFAULT_TEX_SIZE = 128;

function lerp(a, b, t){
  return a + (b - a) * t;
}

function fade(t){
  return t * t * (3 - 2 * t);
}

function hash2(x, y, seed){
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, y, seed){
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const n00 = hash2(xi, yi, seed);
  const n10 = hash2(xi + 1, yi, seed);
  const n01 = hash2(xi, yi + 1, seed);
  const n11 = hash2(xi + 1, yi + 1, seed);
  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v) * 2 - 1;
}

function fbm2D(x, y, seed, octaves = 4, gain = 0.5, lacunarity = 2){
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++){
    sum += valueNoise2D(x * freq, y * freq, seed + i * 31) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / Math.max(1e-6, norm);
}

function wrapIndex(i, size, mask){
  if (mask){
    return i & mask;
  }
  const m = i % size;
  return m < 0 ? m + size : m;
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

function makeTexture({ id, label, group, csi, w = DEFAULT_TEX_SIZE, h = DEFAULT_TEX_SIZE, worldRepeat = 2, data }){
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
  const x = wrapIndex(u | 0, tex.w, tex.maskU);
  const y = wrapIndex(v | 0, tex.h, tex.maskV);
  return tex.data[y * tex.w + x] >>> 0;
}

function texSampleBilinear(tex, u, v){
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const tx = u - x0;
  const ty = v - y0;
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const ix0 = wrapIndex(x0, tex.w, tex.maskU);
  const ix1 = wrapIndex(x1, tex.w, tex.maskU);
  const iy0 = wrapIndex(y0, tex.h, tex.maskV);
  const iy1 = wrapIndex(y1, tex.h, tex.maskV);

  const c00 = tex.data[iy0 * tex.w + ix0] >>> 0;
  const c10 = tex.data[iy0 * tex.w + ix1] >>> 0;
  const c01 = tex.data[iy1 * tex.w + ix0] >>> 0;
  const c11 = tex.data[iy1 * tex.w + ix1] >>> 0;

  const r00 = (c00 >>> 24) & 255;
  const g00 = (c00 >>> 16) & 255;
  const b00 = (c00 >>> 8) & 255;
  const a00 = c00 & 255;
  const r10 = (c10 >>> 24) & 255;
  const g10 = (c10 >>> 16) & 255;
  const b10 = (c10 >>> 8) & 255;
  const a10 = c10 & 255;
  const r01 = (c01 >>> 24) & 255;
  const g01 = (c01 >>> 16) & 255;
  const b01 = (c01 >>> 8) & 255;
  const a01 = c01 & 255;
  const r11 = (c11 >>> 24) & 255;
  const g11 = (c11 >>> 16) & 255;
  const b11 = (c11 >>> 8) & 255;
  const a11 = c11 & 255;

  const r0 = lerp(r00, r10, tx);
  const g0 = lerp(g00, g10, tx);
  const b0 = lerp(b00, b10, tx);
  const a0 = lerp(a00, a10, tx);
  const r1 = lerp(r01, r11, tx);
  const g1 = lerp(g01, g11, tx);
  const b1 = lerp(b01, b11, tx);
  const a1 = lerp(a01, a11, tx);

  return packRgba(
    clampByte(lerp(r0, r1, ty)),
    clampByte(lerp(g0, g1, ty)),
    clampByte(lerp(b0, b1, ty)),
    clampByte(lerp(a0, a1, ty)),
  );
}

function makeSolid(id, rgba, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const data = new Uint32Array(w * h);
  data.fill(rgba >>> 0);
  return makeTexture({ id, data, ...meta });
}

function makeNoiseSpeckle(id, baseRgb, speckRgb, density01, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.split("").reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381) ^ 0xA53C19) >>> 0;
  const rng = mulberry32(seed);
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const nx = x / w;
      const ny = y / h;
      const baseVar = fbm2D(nx * 6, ny * 6, seed, 4, 0.55) * 18;
      const micro = fbm2D(nx * 24, ny * 24, seed + 19, 3, 0.6) * 8;
      const t = rng();
      const speckBoost = Math.max(0, fbm2D(nx * 18, ny * 18, seed + 3, 2, 0.65) * 0.2);
      const isSpeck = t < (density01 + speckBoost);
      const src = isSpeck ? speckRgb : baseRgb;
      const r = clampByte(src[0] + baseVar + micro);
      const g = clampByte(src[1] + baseVar + micro);
      const b = clampByte(src[2] + baseVar + micro);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeGrid(id, baseRgb, lineRgb, cellPx, linePx, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.length * 2654435761) >>> 0;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const gx = x % cellPx;
      const gy = y % cellPx;
      const isLine = gx < linePx || gy < linePx || gx >= (cellPx - linePx) || gy >= (cellPx - linePx);
      if (isLine){
        const noise = fbm2D(x / w * 12, y / h * 12, seed + 17, 3, 0.55) * 10;
        data[y * w + x] = packRgba(
          clampByte(lineRgb[0] + noise),
          clampByte(lineRgb[1] + noise),
          clampByte(lineRgb[2] + noise),
          255,
        );
        continue;
      }
      const tileX = Math.floor(x / cellPx);
      const tileY = Math.floor(y / cellPx);
      const tileNoise = (hash2(tileX, tileY, seed) - 0.5) * 18;
      const edge = Math.min(gx, gy, cellPx - 1 - gx, cellPx - 1 - gy);
      const bevel = Math.max(0, Math.min(1, (edge - 1) / 6));
      const shade = (1 - bevel) * -12;
      const grain = fbm2D(x / w * 14, y / h * 14, seed + 5, 3, 0.55) * 8;
      data[y * w + x] = packRgba(
        clampByte(baseRgb[0] + tileNoise + shade + grain),
        clampByte(baseRgb[1] + tileNoise + shade + grain),
        clampByte(baseRgb[2] + tileNoise + shade + grain),
        255,
      );
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeWood(id, baseRgb, grainRgb, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.split("").reduce((a, c) => (a * 131 + c.charCodeAt(0)) >>> 0, 7) ^ 0xC0FFEE) >>> 0;
  const rng = mulberry32(seed);
  const data = new Uint32Array(w * h);
  const knots = [];
  for (let i = 0; i < 10; i++){
    knots.push({
      x: Math.floor(rng() * w),
      y: Math.floor(rng() * h),
      r: 4 + Math.floor(rng() * 12),
    });
  }
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const nx = x / w;
      const ny = y / h;
      const flow = Math.sin((nx * 18 + fbm2D(nx * 3, ny * 3, seed + 11, 2, 0.6)) * Math.PI * 2);
      const rings = Math.sin((nx * 26 + fbm2D(nx * 4, ny * 4, seed + 7, 3, 0.6)) * Math.PI * 2);
      const grain = (flow * 0.55 + rings * 0.45) * 0.5 + 0.5;
      const pores = fbm2D(nx * 40, ny * 40, seed + 29, 2, 0.55) * 0.3;
      let k = 0;
      for (const knot of knots){
        const dx = x - knot.x;
        const dy = y - knot.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const bump = Math.max(0, 1 - d / knot.r);
        k += bump;
      }
      k = Math.min(1, k);
      const mix = Math.min(1, 0.12 + grain * 0.45 + pores * 0.2 + k * 0.5);
      const r = clampByte(baseRgb[0] * (1 - mix) + grainRgb[0] * mix);
      const g = clampByte(baseRgb[1] * (1 - mix) + grainRgb[1] * mix);
      const b = clampByte(baseRgb[2] * (1 - mix) + grainRgb[2] * mix);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeFrp(id, baseRgb, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.length * 1597334677) >>> 0;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const nx = x / w;
      const ny = y / h;
      const weave = Math.sin((nx * 18 + ny * 4) * Math.PI * 2) * Math.sin((ny * 18 + nx * 4) * Math.PI * 2);
      const texture = fbm2D(nx * 30, ny * 30, seed + 3, 3, 0.55) * 8;
      const bump = weave * 12 + texture;
      const r = clampByte(baseRgb[0] + bump);
      const g = clampByte(baseRgb[1] + bump);
      const b = clampByte(baseRgb[2] + bump);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeBeadboard(id, baseRgb, grooveRgb, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.length * 1103515245) >>> 0;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const gx = x % 8;
      const isGroove = gx <= 1;
      const depth = isGroove ? -18 : (gx >= 6 ? -6 : 4);
      const boardVar = (hash2(Math.floor(x / 8), Math.floor(y / 32), seed) - 0.5) * 12;
      const micro = fbm2D(x / w * 20, y / h * 20, seed + 5, 2, 0.6) * 6;
      const src = isGroove ? grooveRgb : baseRgb;
      data[y * w + x] = packRgba(
        clampByte(src[0] + depth + boardVar + micro),
        clampByte(src[1] + depth + boardVar + micro),
        clampByte(src[2] + depth + boardVar + micro),
        255,
      );
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeSubwayTile(id, baseRgb, groutRgb, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.length * 2246822519) >>> 0;
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
      if (isGrout){
        const groutNoise = fbm2D(x / w * 14, y / h * 14, seed + 8, 3, 0.6) * 10;
        data[y * w + x] = packRgba(
          clampByte(groutRgb[0] + groutNoise),
          clampByte(groutRgb[1] + groutNoise),
          clampByte(groutRgb[2] + groutNoise),
          255,
        );
        continue;
      }
      const tileX = Math.floor((x + off) / tileW);
      const tileY = Math.floor(y / tileH);
      const tileVar = (hash2(tileX, tileY, seed) - 0.5) * 16;
      const edge = Math.min(xx, yy, tileW - 1 - xx, tileH - 1 - yy);
      const bevel = Math.max(0, Math.min(1, (edge - 1) / 3));
      const shade = (1 - bevel) * -12;
      const gloss = fbm2D(x / w * 18, y / h * 18, seed + 14, 2, 0.6) * 6;
      data[y * w + x] = packRgba(
        clampByte(baseRgb[0] + tileVar + shade + gloss),
        clampByte(baseRgb[1] + tileVar + shade + gloss),
        clampByte(baseRgb[2] + tileVar + shade + gloss),
        255,
      );
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makePlasterSmooth(id, baseRgb, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.length * 2654435761) >>> 0;
  const rng = mulberry32(seed);
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const nx = x / w;
      const ny = y / h;
      const n = (rng() - 0.5) * 8;
      const macro = fbm2D(nx * 4, ny * 4, seed + 3, 3, 0.55) * 16;
      const micro = fbm2D(nx * 18, ny * 18, seed + 7, 2, 0.6) * 8;
      const r = clampByte(baseRgb[0] + n + macro + micro);
      const g = clampByte(baseRgb[1] + n + macro + micro);
      const b = clampByte(baseRgb[2] + n + macro + micro);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeConcreteTrowel(id, baseRgb, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.length * 19349663) >>> 0;
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const nx = x / w;
      const ny = y / h;
      const swirl = Math.sin((nx * 6 + fbm2D(nx * 2, ny * 2, seed + 2, 2, 0.6)) * Math.PI * 2)
        * Math.sin((ny * 6 + fbm2D(nx * 2, ny * 2, seed + 7, 2, 0.6)) * Math.PI * 2);
      const mottling = fbm2D(nx * 8, ny * 8, seed + 5, 4, 0.55) * 20;
      const t = swirl * 12 + mottling;
      const r = clampByte(baseRgb[0] + t);
      const g = clampByte(baseRgb[1] + t);
      const b = clampByte(baseRgb[2] + t);
      data[y * w + x] = packRgba(r, g, b, 255);
    }
  }
  return makeTexture({ id, data, ...meta });
}

function makeActCeiling(id, meta){
  const w = meta?.w || DEFAULT_TEX_SIZE;
  const h = meta?.h || DEFAULT_TEX_SIZE;
  const seed = (id.length * 88675123) >>> 0;
  const data = new Uint32Array(w * h);
  const base = [242, 242, 244];
  const grid = [205, 205, 210];
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const gx = x % 16;
      const gy = y % 16;
      const isGrid = gx === 0 || gy === 0;
      const nx = x / w;
      const ny = y / h;
      const speckle = fbm2D(nx * 24, ny * 24, seed + 9, 2, 0.6) * 10;
      const rgb = isGrid ? grid : base;
      data[y * w + x] = packRgba(
        clampByte(rgb[0] + speckle),
        clampByte(rgb[1] + speckle),
        clampByte(rgb[2] + speckle),
        255,
      );
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
  return texSampleBilinear(tex, u, v);
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
  const maxSize = 256;
  const srcW = img.naturalWidth || img.width || DEFAULT_TEX_SIZE;
  const srcH = img.naturalHeight || img.height || DEFAULT_TEX_SIZE;
  const w = Math.min(maxSize, Math.max(32, srcW));
  const h = Math.min(maxSize, Math.max(32, srcH));
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
