import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function loadPdfFromFile(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  return pdf;
}

export async function renderPageToCanvas(pdf, pageIndex1Based, canvas, dpi = 300) {
  const page = await pdf.getPage(pageIndex1Based);
  const scale = dpi / 72; // PDF points are 72 DPI
  const viewport = page.getViewport({ scale });

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return { width: canvas.width, height: canvas.height };
}

export function fillPageSelector(selectEl, numPages) {
  selectEl.innerHTML = "";
  for (let i = 1; i <= numPages; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Page ${i}`;
    selectEl.appendChild(opt);
  }
}
