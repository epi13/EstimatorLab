export function attachMapBuiltins(baseFns, { defFn, isQty }){
  function requireMap(value, label){
    if (!value || typeof value !== "object" || !value.__map){
      throw new Error(`${label} expects a map as the first argument.`);
    }
    return value;
  }

  baseFns.map = defFn("map", 1, (text) => {
    if (typeof text !== "string") throw new Error("map expects a string");
    const rawRows = text.split("|").map((row) => row.trimEnd()).filter((row) => row.length);
    if (!rawRows.length) throw new Error("map expects at least one row");
    const width = rawRows[0].length;
    if (!width) throw new Error("map expects non-empty rows");
    const height = rawRows.length;
    const data = new Uint8Array(width * height);
    let spawnX = 1.5;
    let spawnY = 1.5;
    let foundSpawn = false;
    for (let y = 0; y < height; y++){
      const row = rawRows[y];
      if (row.length !== width){
        throw new Error("map rows must all be the same width");
      }
      for (let x = 0; x < width; x++){
        const ch = row[x];
        let v = 0;
        if (ch === "#") v = 1;
        else if (ch === ".") v = 0;
        else if (ch === "D") v = 2;
        else if (ch === "K") v = 3;
        else if (ch === "E") v = 4;
        else if (ch === "M") v = 5;
        else if (ch === "H") v = 6;
        else if (ch === "A") v = 7;
        else if (ch === "T") v = 8;
        else if (ch === "L") v = 9;
        else if (ch === ">") v = 10;
        else if (ch === "<") v = 11;
        else if (ch === "S"){
          v = 0;
          if (!foundSpawn){
            spawnX = x + 0.5;
            spawnY = y + 0.5;
            foundSpawn = true;
          }
        }else{
          throw new Error(`map contains unsupported tile '${ch}' (use # . D K E S M H A T L > <)`);
        }
        data[y * width + x] = v;
      }
    }
    return {
      __map: true,
      w: width,
      h: height,
      data,
      spawnX,
      spawnY,
    };
  });

  baseFns.dungeon = defFn("dungeon", 4, (seed, width, height, difficulty) => {
    const w = Math.max(7, Math.min(64, Math.floor(isQty(width) ? width.value : width)));
    const h = Math.max(7, Math.min(64, Math.floor(isQty(height) ? height.value : height)));
    const diff = Math.max(0, Math.min(10, Math.floor(isQty(difficulty) ? difficulty.value : difficulty)));
    let s = (Math.floor(isQty(seed) ? seed.value : seed) >>> 0) || 1;

    const randU32 = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s;
    };
    const rand01 = () => randU32() / 0x100000000;
    const randi = (min, max) => (min + Math.floor(rand01() * (max - min + 1)));

    const data = new Uint8Array(w * h);
    data.fill(1);

    const idx = (x, y) => y * w + x;
    const inBounds = (x, y) => x > 0 && y > 0 && x < (w - 1) && y < (h - 1);
    const carve = (x, y) => { if (inBounds(x, y)) data[idx(x, y)] = 0; };

    const startX = randi(2, w - 3);
    const startY = randi(2, h - 3);
    let cx = startX;
    let cy = startY;
    carve(cx, cy);

    const steps = Math.max(120, Math.floor(w * h * (0.32 + diff * 0.02)));
    for (let i = 0; i < steps; i++){
      const dir = randi(0, 3);
      const nx = cx + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
      const ny = cy + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
      if (inBounds(nx, ny)){
        cx = nx;
        cy = ny;
        carve(cx, cy);
        if (rand01() < 0.25){
          carve(cx + 1, cy);
          carve(cx - 1, cy);
          carve(cx, cy + 1);
          carve(cx, cy - 1);
        }
      }
    }

    const spawnX = startX + 0.5;
    const spawnY = startY + 0.5;

    let best = { x: startX, y: startY, d2: 0 };
    for (let y = 1; y < h - 1; y++){
      for (let x = 1; x < w - 1; x++){
        if (data[idx(x, y)] !== 0) continue;
        const dx = x - startX;
        const dy = y - startY;
        const d2 = dx * dx + dy * dy;
        if (d2 > best.d2) best = { x, y, d2 };
      }
    }
    data[idx(best.x, best.y)] = 4;

    const placeStairs = (tile) => {
      for (let tries = 0; tries < 2000; tries++){
        const x = randi(1, w - 2);
        const y = randi(1, h - 2);
        if (data[idx(x, y)] !== 0) continue;
        const dx = x - startX;
        const dy = y - startY;
        const d2 = dx * dx + dy * dy;
        if (d2 < 20) continue;
        data[idx(x, y)] = tile;
        return true;
      }
      return false;
    };

    const monsterCount = Math.max(2, Math.floor((w * h) / 90) + diff);
    const lightCount = Math.max(2, Math.floor((w * h) / 120));
    const itemCount = Math.max(2, Math.floor((w * h) / 140));

    const placeOnFloor = (tile) => {
      for (let tries = 0; tries < 2000; tries++){
        const x = randi(1, w - 2);
        const y = randi(1, h - 2);
        if (data[idx(x, y)] !== 0) continue;
        if ((x === startX && y === startY) || (x === best.x && y === best.y)) continue;
        data[idx(x, y)] = tile;
        return true;
      }
      return false;
    };

    for (let i = 0; i < monsterCount; i++) placeOnFloor(5);
    for (let i = 0; i < lightCount; i++) placeOnFloor(rand01() < 0.75 ? 8 : 9);
    for (let i = 0; i < itemCount; i++) placeOnFloor(rand01() < 0.5 ? 6 : 7);
    placeOnFloor(3);

    placeStairs(10);
    if (diff > 0) placeStairs(11);

    return {
      __map: true,
      w,
      h,
      data,
      spawnX,
      spawnY,
    };
  });

  baseFns.mw = defFn("mw", 1, (m) => requireMap(m, "mw").w);
  baseFns.mh = defFn("mh", 1, (m) => requireMap(m, "mh").h);
  baseFns.mspawnx = defFn("mspawnx", 1, (m) => requireMap(m, "mspawnx").spawnX);
  baseFns.mspawny = defFn("mspawny", 1, (m) => requireMap(m, "mspawny").spawnY);
  baseFns.mget = defFn("mget", 3, (m, x, y) => {
    const mapObj = requireMap(m, "mget");
    const ix = Math.floor(isQty(x) ? x.value : x);
    const iy = Math.floor(isQty(y) ? y.value : y);
    if (!Number.isFinite(ix) || !Number.isFinite(iy)) return 1;
    if (ix < 0 || iy < 0 || ix >= mapObj.w || iy >= mapObj.h) return 1;
    return mapObj.data[iy * mapObj.w + ix];
  });
  baseFns.mset = defFn("mset", 4, (m, x, y, value) => {
    const mapObj = requireMap(m, "mset");
    const ix = Math.floor(isQty(x) ? x.value : x);
    const iy = Math.floor(isQty(y) ? y.value : y);
    const v = Math.floor(isQty(value) ? value.value : value);
    if (!Number.isFinite(ix) || !Number.isFinite(iy)) return 0;
    if (ix < 0 || iy < 0 || ix >= mapObj.w || iy >= mapObj.h) return 0;
    if (!Number.isFinite(v) || v < 0 || v > 255) throw new Error("mset value must be 0..255");
    mapObj.data[iy * mapObj.w + ix] = v;
    return 1;
  });
}
