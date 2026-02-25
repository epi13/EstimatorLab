function ensureCvReady() {
  return new Promise((resolve) => {
    if (globalThis.cv && globalThis.cv.Mat) return resolve();
    const t = setInterval(() => {
      if (globalThis.cv && globalThis.cv.Mat) {
        clearInterval(t);
        resolve();
      }
    }, 50);
  });
}

function canvasToMat(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return cv.matFromImageData(imgData);
}

function matToCanvas(mat, canvas) {
  cv.imshow(canvas, mat);
}

function warpTo(refMat, srcMat, H) {
  const dst = new cv.Mat();
  const dsize = new cv.Size(refMat.cols, refMat.rows);
  cv.warpPerspective(srcMat, dst, H, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
  return dst;
}

function buildIgnoreMask(gray) {
  const mask = new cv.Mat(gray.rows, gray.cols, cv.CV_8UC1, new cv.Scalar(255));
  const marginX = Math.floor(gray.cols * 0.025);
  const marginY = Math.floor(gray.rows * 0.025);

  cv.rectangle(mask, new cv.Point(0, 0), new cv.Point(gray.cols, marginY), new cv.Scalar(0), cv.FILLED);
  cv.rectangle(mask, new cv.Point(0, gray.rows - marginY), new cv.Point(gray.cols, gray.rows), new cv.Scalar(0), cv.FILLED);
  cv.rectangle(mask, new cv.Point(0, 0), new cv.Point(marginX, gray.rows), new cv.Scalar(0), cv.FILLED);
  cv.rectangle(mask, new cv.Point(gray.cols - marginX, 0), new cv.Point(gray.cols, gray.rows), new cv.Scalar(0), cv.FILLED);

  // Bottom-right title block candidate
  const tx = Math.floor(gray.cols * 0.62);
  const ty = Math.floor(gray.rows * 0.74);
  cv.rectangle(mask, new cv.Point(tx, ty), new cv.Point(gray.cols, gray.rows), new cv.Scalar(0), cv.FILLED);
  return mask;
}

function estimateMoveFeet(canvasA, canvasB, rect, scale) {
  if (!scale?.pxPerFoot) return null;
  const pad = 8;
  const x = Math.max(0, rect.x - pad);
  const y = Math.max(0, rect.y - pad);
  const w = Math.min(canvasA.width - x, rect.width + 2 * pad);
  const h = Math.min(canvasA.height - y, rect.height + 2 * pad);

  const ctxA = canvasA.getContext("2d", { willReadFrequently: true });
  const ctxB = canvasB.getContext("2d", { willReadFrequently: true });
  const a = ctxA.getImageData(x, y, w, h).data;
  const b = ctxB.getImageData(x, y, w, h).data;

  const centroid = (arr) => {
    let sx = 0; let sy = 0; let n = 0;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const idx = (yy * w + xx) * 4;
        const lum = arr[idx] * 0.3 + arr[idx + 1] * 0.59 + arr[idx + 2] * 0.11;
        const ink = 255 - lum;
        if (ink > 45) {
          sx += xx;
          sy += yy;
          n++;
        }
      }
    }
    if (n === 0) return null;
    return { x: sx / n, y: sy / n };
  };

  const ca = centroid(a);
  const cb = centroid(b);
  if (!ca || !cb) return null;
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const px = Math.hypot(dx, dy);
  return px / scale.pxPerFoot;
}

export async function alignAndDiff(canvasA, canvasB, canvasDiff, options = {}) {
  await ensureCvReady();

  let matA = canvasToMat(canvasA);
  let matB = canvasToMat(canvasB);

  let grayA = new cv.Mat();
  let grayB = new cv.Mat();
  cv.cvtColor(matA, grayA, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(matB, grayB, cv.COLOR_RGBA2GRAY);

  const orb = new cv.ORB();
  const kpA = new cv.KeyPointVector();
  const kpB = new cv.KeyPointVector();
  const desA = new cv.Mat();
  const desB = new cv.Mat();
  orb.detectAndCompute(grayA, new cv.Mat(), kpA, desA);
  orb.detectAndCompute(grayB, new cv.Mat(), kpB, desB);

  const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
  const matches = new cv.DMatchVector();
  if (!desA.empty() && !desB.empty()) bf.match(desA, desB, matches);

  const good = [];
  for (let i = 0; i < matches.size(); i++) good.push(matches.get(i));
  good.sort((m1, m2) => m1.distance - m2.distance);
  const keep = good.slice(0, Math.min(60, good.length));

  const ptsA = [];
  const ptsB = [];
  for (const m of keep) {
    const pA = kpA.get(m.queryIdx).pt;
    const pB = kpB.get(m.trainIdx).pt;
    ptsA.push(pA.x, pA.y);
    ptsB.push(pB.x, pB.y);
  }

  let alignedB = matB;
  let H = null;

  if (ptsA.length >= 8) {
    const src = cv.matFromArray(ptsB.length / 2, 1, cv.CV_32FC2, ptsB);
    const dst = cv.matFromArray(ptsA.length / 2, 1, cv.CV_32FC2, ptsA);
    const mask = new cv.Mat();
    H = cv.findHomography(src, dst, cv.RANSAC, 5.0, mask);
    alignedB = warpTo(matA, matB, H);

    src.delete(); dst.delete(); mask.delete();
  }

  let alignedGrayB = new cv.Mat();
  cv.cvtColor(alignedB, alignedGrayB, cv.COLOR_RGBA2GRAY);

  let diff = new cv.Mat();
  cv.absdiff(grayA, alignedGrayB, diff);

  let thr = new cv.Mat();
  cv.threshold(diff, thr, 25, 255, cv.THRESH_BINARY);

  if (options.ignoreZones) {
    const ignoreMask = buildIgnoreMask(grayA);
    cv.bitwise_and(thr, ignoreMask, thr);
    ignoreMask.delete();
  }

  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.dilate(thr, thr, k);

  let overlay = matA.clone();
  let red = new cv.Mat(matA.rows, matA.cols, matA.type(), new cv.Scalar(255, 0, 0, 255));
  red.copyTo(overlay, thr);

  matToCanvas(overlay, canvasDiff);

  matA.delete(); matB.delete(); grayA.delete(); grayB.delete();
  kpA.delete(); kpB.delete(); desA.delete(); desB.delete();
  matches.delete(); orb.delete();
  if (H) H.delete();
  if (alignedB !== matB) alignedB.delete();
  alignedGrayB.delete(); diff.delete(); thr.delete(); k.delete(); red.delete(); overlay.delete();

  return { ok: true };
}

export async function computeRegionsFromDiffCanvas(canvasDiff, minAreaPx2 = 800, maxRegions = 30, extras = {}) {
  await ensureCvReady();

  const mat = canvasToMat(canvasDiff);

  let hsv = new cv.Mat();
  cv.cvtColor(mat, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const low1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 80, 80, 0]);
  const high1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [10, 255, 255, 255]);
  const low2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [170, 80, 80, 0]);
  const high2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 255]);

  let mask1 = new cv.Mat();
  let mask2 = new cv.Mat();
  cv.inRange(hsv, low1, high1, mask1);
  cv.inRange(hsv, low2, high2, mask2);

  let mask = new cv.Mat();
  cv.bitwise_or(mask1, mask2, mask);

  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, k);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const regions = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const rect = cv.boundingRect(c);
    const area = rect.width * rect.height;
    if (area >= minAreaPx2) {
      const movedFeet = extras.canvasA && extras.canvasB
        ? estimateMoveFeet(extras.canvasA, extras.canvasB, rect, extras.scale)
        : null;
      regions.push({ ...rect, area, movedFeet });
    }
    c.delete();
  }
  regions.sort((a, b) => b.area - a.area);
  const trimmed = regions.slice(0, maxRegions);

  mat.delete(); hsv.delete();
  low1.delete(); high1.delete(); low2.delete(); high2.delete();
  mask1.delete(); mask2.delete(); mask.delete();
  k.delete(); contours.delete(); hierarchy.delete();

  return trimmed;
}

export function vectorDiff(aGeometry, bGeometry, { width, height, tolerance = 1 } = {}) {
  const round = (v) => Math.round(v / tolerance) * tolerance;
  const keyFor = (s) => {
    const x1 = round(s.x1); const y1 = round(s.y1);
    const x2 = round(s.x2); const y2 = round(s.y2);
    return x1 < x2 || (x1 === x2 && y1 <= y2)
      ? `${x1},${y1}|${x2},${y2}`
      : `${x2},${y2}|${x1},${y1}`;
  };

  const aMap = new Map(aGeometry.segments.map((s) => [keyFor(s), s]));
  const bMap = new Map(bGeometry.segments.map((s) => [keyFor(s), s]));

  const changed = [];
  for (const [k, s] of aMap) if (!bMap.has(k)) changed.push(s);
  for (const [k, s] of bMap) if (!aMap.has(k)) changed.push(s);

  const boxes = changed.map((s) => {
    const x = Math.floor(Math.min(s.x1, s.x2));
    const y = Math.floor(height - Math.max(s.y1, s.y2));
    const widthBox = Math.max(3, Math.ceil(Math.abs(s.x2 - s.x1)));
    const heightBox = Math.max(3, Math.ceil(Math.abs(s.y2 - s.y1)));
    return { x, y, width: widthBox, height: heightBox, area: widthBox * heightBox, movedFeet: null };
  });

  return boxes;
}
