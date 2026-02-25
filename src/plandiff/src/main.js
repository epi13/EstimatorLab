import "./styles.css";
import { loadPdfFromFile, renderPageToCanvas, fillPageSelector } from "./pdf.js";
import { alignAndDiff, computeRegionsFromDiffCanvas } from "./align_diff.js";
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

const canvasA = el("canvasA");
const canvasB = el("canvasB");
const canvasDiff = el("canvasDiff");
const regionsList = el("regions");

let pdfA = null;
let pdfB = null;
let lastRegions = [];

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

  setStatus(`Loaded. Set A: ${pdfA.numPages} pages | Set B: ${pdfB.numPages} pages`);
  btnLoad.disabled = false;
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

  setStatus("Aligning + diffing (OpenCV.js)...");
  await alignAndDiff(canvasA, canvasB, canvasDiff);

  setStatus("Computing change regions...");
  lastRegions = await computeRegionsFromDiffCanvas(
    canvasDiff,
    Number(minArea.value),
    Number(maxRegions.value)
  );
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
    Number(maxRegions.value)
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

function renderRegions(regions) {
  regionsList.innerHTML = "";
  regions.forEach((r, i) => {
    const li = document.createElement("li");

    const btn = document.createElement("button");
    btn.className = "region-btn";
    btn.textContent = `#${i + 1}  x=${r.x} y=${r.y}  ${r.width}×${r.height}  area=${r.area}`;

    btn.addEventListener("click", () => zoomToRegion(r));

    li.appendChild(btn);
    regionsList.appendChild(li);
  });
}

function zoomToRegion(r) {
  // Simple “zoom”: open a new window with cropped images
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
