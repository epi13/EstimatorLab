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

export async function alignAndDiff(canvasA, canvasB, canvasDiff) {
  await ensureCvReady();

  let matA = canvasToMat(canvasA);
  let matB = canvasToMat(canvasB);

  // Convert to gray
  let grayA = new cv.Mat();
  let grayB = new cv.Mat();
  cv.cvtColor(matA, grayA, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(matB, grayB, cv.COLOR_RGBA2GRAY);

  // ORB features
  const orb = new cv.ORB();
  const kpA = new cv.KeyPointVector();
  const kpB = new cv.KeyPointVector();
  const desA = new cv.Mat();
  const desB = new cv.Mat();
  orb.detectAndCompute(grayA, new cv.Mat(), kpA, desA);
  orb.detectAndCompute(grayB, new cv.Mat(), kpB, desB);

  // Match descriptors
  const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
  const matches = new cv.DMatchVector();
  if (!desA.empty() && !desB.empty()) {
    bf.match(desA, desB, matches);
  }

  // Build point arrays for homography
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

  // Diff (abs) on grayscale
  let alignedGrayB = new cv.Mat();
  cv.cvtColor(alignedB, alignedGrayB, cv.COLOR_RGBA2GRAY);

  let diff = new cv.Mat();
  cv.absdiff(grayA, alignedGrayB, diff);

  // Heatmap-ish: threshold + dilate to get blobs
  let thr = new cv.Mat();
  cv.threshold(diff, thr, 25, 255, cv.THRESH_BINARY);

  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.dilate(thr, thr, k);

  // Create display: overlay red on A
  let overlay = matA.clone();
  // Make a red mask
  let red = new cv.Mat(matA.rows, matA.cols, matA.type(), new cv.Scalar(255, 0, 0, 255));
  red.copyTo(overlay, thr);

  matToCanvas(overlay, canvasDiff);

  // Cleanup
  matA.delete(); matB.delete(); grayA.delete(); grayB.delete();
  kpA.delete(); kpB.delete(); desA.delete(); desB.delete();
  matches.delete(); orb.delete();
  if (H) H.delete();
  if (alignedB !== matB) alignedB.delete();
  alignedGrayB.delete(); diff.delete(); k.delete(); red.delete();

  return {
    // Return the binary mask by re-reading from canvasDiff later is expensive.
    // We'll recompute regions from canvasDiff’s red overlay by comparing A vs overlay.
    ok: true
  };
}

export async function computeRegionsFromDiffCanvas(canvasDiff, minAreaPx2 = 800, maxRegions = 30) {
  await ensureCvReady();

  // We detect red-ish pixels on diff canvas as "changed"
  const mat = canvasToMat(canvasDiff);

  let hsv = new cv.Mat();
  cv.cvtColor(mat, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  // Red in HSV wraps; we capture two ranges
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

  // Clean up noise
  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, k);

  // Find contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const regions = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const rect = cv.boundingRect(c);
    const area = rect.width * rect.height;
    if (area >= minAreaPx2) {
      regions.push({ ...rect, area });
    }
    c.delete();
  }
  regions.sort((a, b) => b.area - a.area);
  const trimmed = regions.slice(0, maxRegions);

  // cleanup
  mat.delete(); hsv.delete();
  low1.delete(); high1.delete(); low2.delete(); high2.delete();
  mask1.delete(); mask2.delete(); mask.delete();
  k.delete(); contours.delete(); hierarchy.delete();

  return trimmed;
}
