import {
  loadPdfFromFile,
  renderPageToCanvas,
  fillPageSelector,
  autoMatchSheets,
  getPageGeometryOps
} from "./pdf.js";
import { alignAndDiff, computeRegionsFromDiffCanvas, vectorDiff } from "./align_diff.js";
import { exportHtmlReport } from "./report.js";

const el = (id) => document.getElementById(id);

const fileA = el("fileA");
const fileB = el("fileB");
const btnLoad = el("btnLoad");
const pageA = el("pageA");
const pageB = el("pageB");
const dpiSel = el("dpi");
const btnDiff = el("btnDiff");
const btnReport = el("btnReport");
const btnRecalc = el("btnRecalc");
const minArea = el("minArea");
const maxRegions = el("maxRegions");
const status = el("status");
const diffMode = el("diffMode");
const btnAutoMatch = el("btnAutoMatch");
const btnScaleA = el("btnScaleA");
const btnScaleB = el("btnScaleB");
const scaleInfo = el("scaleInfo");
const ignoreZones = el("ignoreZones");
const ocrFallback = el("ocrFallback");

if (!globalThis.Tesseract) {
  ocrFallback.checked = false;
  ocrFallback.disabled = true;
  ocrFallback.title = "OCR fallback unavailable in this build.";
}

const canvasA = el("canvasA");
const canvasB = el("canvasB");
const canvasDiff = el("canvasDiff");
const regionsList = el("regions");

let pdfA = null;
let pdfB = null;
let lastRegions = [];
const scaleStore = { A: {}, B: {} };

function setStatus(msg) { status.textContent = msg; }

function canLoad() {
  btnLoad.disabled = !(fileA.files?.[0] && fileB.files?.[0]);
}

fileA.addEventListener("change", canLoad);
fileB.addEventListener("change", canLoad);

btnLoad.addEventListener("click", async () => {
  setStatus("Loading PDFs...");
  btnLoad.disabled = true;

  pdfA = await loadPdfFromFile(fileA.files[0]);
  pdfB = await loadPdfFromFile(fileB.files[0]);

  fillPageSelector(pageA, pdfA.numPages);
  fillPageSelector(pageB, pdfB.numPages);

  pageA.disabled = false;
  pageB.disabled = false;
  dpiSel.disabled = false;
  btnDiff.disabled = false;
  btnAutoMatch.disabled = false;
  diffMode.disabled = false;
  btnScaleA.disabled = false;
  btnScaleB.disabled = false;

  setStatus(`Loaded. Set A: ${pdfA.numPages} pages | Set B: ${pdfB.numPages} pages`);
  btnLoad.disabled = false;
});

btnAutoMatch.addEventListener("click", async () => {
  if (!pdfA || !pdfB) return;
  setStatus("Auto matching sheets (text + OCR fallback)...");
  const matches = await autoMatchSheets(pdfA, pdfB, { ocrFallback: ocrFallback.checked });
  if (!matches.length) {
    setStatus("No confident sheet matches found.");
    return;
  }
  const best = matches[0];
  pageA.value = String(best.pageA);
  pageB.value = String(best.pageB);
  setStatus(`Matched A:${best.pageA} ↔ B:${best.pageB} (${best.sheetNo || "no sheet #"} ${best.title || ""})`);
});

btnDiff.addEventListener("click", async () => {
  if (!pdfA || !pdfB) return;

  btnDiff.disabled = true;
  btnReport.disabled = true;
  btnRecalc.disabled = true;
  regionsList.innerHTML = "";
  lastRegions = [];

  const pA = Number(pageA.value);
  const pB = Number(pageB.value);
  const dpi = Number(dpiSel.value);

  setStatus(`Rendering pages (DPI ${dpi})...`);
  await renderPageToCanvas(pdfA, pA, canvasA, dpi);
  await renderPageToCanvas(pdfB, pB, canvasB, dpi);

  if (diffMode.value === "vector") {
    setStatus("Vector extraction mode: parsing operator lists...");
    const [geomA, geomB] = await Promise.all([
      getPageGeometryOps(pdfA, pA),
      getPageGeometryOps(pdfB, pB)
    ]);
    const regions = vectorDiff(geomA, geomB, { width: canvasDiff.width || geomA.width, height: canvasDiff.height || geomA.height });

    const ctx = canvasDiff.getContext("2d");
    canvasDiff.width = canvasA.width;
    canvasDiff.height = canvasA.height;
    ctx.clearRect(0, 0, canvasDiff.width, canvasDiff.height);
    ctx.drawImage(canvasA, 0, 0);
    ctx.strokeStyle = "rgba(255,0,0,0.9)";
    ctx.lineWidth = 2;
    for (const r of regions) ctx.strokeRect(r.x, r.y, r.width, r.height);

    lastRegions = regions
      .filter((r) => r.area >= Number(minArea.value))
      .sort((a, b) => b.area - a.area)
      .slice(0, Number(maxRegions.value));
  } else {
    setStatus("Aligning + diffing (OpenCV)...");
    await alignAndDiff(canvasA, canvasB, canvasDiff, { ignoreZones: ignoreZones.checked });

    setStatus("Computing change regions...");
    lastRegions = await computeRegionsFromDiffCanvas(
      canvasDiff,
      Number(minArea.value),
      Number(maxRegions.value),
      {
        canvasA,
        canvasB,
        scale: scaleStore.B[pB] || scaleStore.A[pA]
      }
    );
  }

  renderRegions(lastRegions);

  btnReport.disabled = false;
  btnRecalc.disabled = false;
  btnDiff.disabled = false;
  setStatus(`Done. Found ${lastRegions.length} regions.`);
});

btnRecalc.addEventListener("click", async () => {
  btnRecalc.disabled = true;
  setStatus("Recomputing regions...");
  lastRegions = await computeRegionsFromDiffCanvas(
    canvasDiff,
    Number(minArea.value),
    Number(maxRegions.value),
    {
      canvasA,
      canvasB,
      scale: scaleStore.B[Number(pageB.value)] || scaleStore.A[Number(pageA.value)]
    }
  );
  renderRegions(lastRegions);
  setStatus(`Done. Found ${lastRegions.length} regions.`);
  btnRecalc.disabled = false;
});

btnReport.addEventListener("click", () => {
  exportHtmlReport({
    pageA: pageA.value,
    pageB: pageB.value,
    dpi: dpiSel.value,
    regions: lastRegions,
    canvasA,
    canvasB,
    canvasDiff
  });
});

btnScaleA.addEventListener("click", () => beginScaleCapture(canvasA, "A", Number(pageA.value)));
btnScaleB.addEventListener("click", () => beginScaleCapture(canvasB, "B", Number(pageB.value)));

function beginScaleCapture(canvas, setName, pageNum) {
  const pts = [];
  setStatus(`Scale ${setName}/page ${pageNum}: click two points along known distance.`);

  const onClick = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((evt.clientY - rect.top) * canvas.height) / rect.height;
    pts.push({ x, y });

    if (pts.length === 2) {
      canvas.removeEventListener("click", onClick);
      const px = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const feet = Number(prompt("Known distance between those points (feet)", "10"));
      if (feet > 0) {
        const pxPerFoot = px / feet;
        scaleStore[setName][pageNum] = { pxPerFoot, feet, px };
        scaleInfo.textContent = `${setName} page ${pageNum}: ${pxPerFoot.toFixed(2)} px/ft`;
        setStatus(`Scale saved for ${setName} page ${pageNum}.`);
      } else {
        setStatus("Scale capture canceled.");
      }
    }
  };

  canvas.addEventListener("click", onClick);
}

function renderRegions(regions) {
  regionsList.innerHTML = "";
  regions.forEach((r, i) => {
    const li = document.createElement("li");

    const btn = document.createElement("button");
    btn.className = "region-btn";
    const moved = Number.isFinite(r.movedFeet) ? ` | delta moved by ${r.movedFeet.toFixed(2)} ft` : "";
    btn.textContent = `#${i + 1}  x=${r.x} y=${r.y}  ${r.width}×${r.height}  area=${r.area}${moved}`;

    btn.addEventListener("click", () => zoomToRegion(r));

    li.appendChild(btn);
    regionsList.appendChild(li);
  });
}

function zoomToRegion(r) {
  const crop = (canvas) => {
    const c = document.createElement("canvas");
    const pad = 20;
    const x = Math.max(0, r.x - pad);
    const y = Math.max(0, r.y - pad);
    const w = Math.min(canvas.width - x, r.width + pad * 2);
    const h = Math.min(canvas.height - y, r.height + pad * 2);
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return c.toDataURL("image/png");
  };

  const a = crop(canvasA);
  const b = crop(canvasB);
  const d = crop(canvasDiff);

  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>Region</title>
  <style>
    body{font-family:system-ui,Arial;margin:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
    img{max-width:100%;border:1px solid #ccc;border-radius:10px}
    h3{margin:0 0 6px;font-size:13px}
  </style></head>
  <body>
    <div><b>Region</b> x=${r.x} y=${r.y} ${r.width}×${r.height}</div>
    <div class="grid">
      <div><h3>A</h3><img src="${a}"/></div>
      <div><h3>B</h3><img src="${b}"/></div>
      <div><h3>Diff</h3><img src="${d}"/></div>
    </div>
  </body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}
