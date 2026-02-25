const pdfjsLib = globalThis.pdfjsLib;

if (!pdfjsLib) {
  throw new Error("PDF.js failed to load. Ensure pdf.min.js is included before this module.");
}

pdfjsLib.GlobalWorkerOptions.workerSrc = "/src/lib/vendor/pdfjs/pdf.worker.min.js";

const SHEET_REGEX = /\b([A-Z]{1,3}-?\d{1,3}(?:\.\d+)?)\b/g;

export async function loadPdfFromFile(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  return pdf;
}

export async function renderPageToCanvas(pdf, pageIndex1Based, canvas, dpi = 300) {
  const page = await pdf.getPage(pageIndex1Based);
  const scale = dpi / 72;
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

async function extractTextFromPage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const text = await page.getTextContent();
  const merged = text.items.map((item) => item.str || "").join(" ");
  return merged.replace(/\s+/g, " ").trim();
}

function parseSheetIdentity(text) {
  if (!text) return { sheetNo: null, title: "" };
  const sheetMatches = [...text.matchAll(SHEET_REGEX)].map((m) => m[1]);
  const sheetNo = sheetMatches[0] || null;
  const title = text
    .split(/\s{2,}|\|/)
    .map((part) => part.trim())
    .filter(Boolean)
    .find((part) => part.length >= 6 && !SHEET_REGEX.test(part)) || "";
  return { sheetNo, title: title.slice(0, 120) };
}

async function runOcrFallback(pdf, pageNumber) {
  if (!globalThis.Tesseract) return "";
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;
  const result = await globalThis.Tesseract.recognize(canvas, "eng", { logger: () => {} });
  return result?.data?.text?.replace(/\s+/g, " ").trim() || "";
}

export async function extractSheetDescriptors(pdf, { ocrFallback = true } = {}) {
  const descriptors = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    let text = await extractTextFromPage(pdf, pageNo);
    if (!text && ocrFallback) {
      text = await runOcrFallback(pdf, pageNo);
    }
    const { sheetNo, title } = parseSheetIdentity(text);
    descriptors.push({ pageNo, sheetNo, title, text });
  }
  return descriptors;
}

export async function autoMatchSheets(pdfA, pdfB, options = {}) {
  const [a, b] = await Promise.all([
    extractSheetDescriptors(pdfA, options),
    extractSheetDescriptors(pdfB, options)
  ]);

  const usedB = new Set();
  const pairs = [];

  for (const sa of a) {
    let best = null;
    for (const sb of b) {
      if (usedB.has(sb.pageNo)) continue;
      let score = 0;
      if (sa.sheetNo && sb.sheetNo && sa.sheetNo === sb.sheetNo) score += 100;
      if (sa.title && sb.title && sa.title.toLowerCase() === sb.title.toLowerCase()) score += 35;
      if (sa.title && sb.title) {
        const wa = new Set(sa.title.toLowerCase().split(/\W+/).filter(Boolean));
        const wb = new Set(sb.title.toLowerCase().split(/\W+/).filter(Boolean));
        let overlap = 0;
        for (const w of wa) if (wb.has(w)) overlap++;
        score += overlap;
      }
      if (!best || score > best.score) best = { score, sb };
    }
    if (best && best.score > 0) {
      usedB.add(best.sb.pageNo);
      pairs.push({
        pageA: sa.pageNo,
        pageB: best.sb.pageNo,
        score: best.score,
        sheetNo: sa.sheetNo || best.sb.sheetNo,
        title: sa.title || best.sb.title
      });
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  return pairs;
}

export async function getPageGeometryOps(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;
  const viewport = page.getViewport({ scale: 1 });

  const segments = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.rectangle) {
      const [x, y, w, h] = args;
      segments.push({ x1: x, y1: y, x2: x + w, y2: y });
      segments.push({ x1: x + w, y1: y, x2: x + w, y2: y + h });
      segments.push({ x1: x + w, y1: y + h, x2: x, y2: y + h });
      segments.push({ x1: x, y1: y + h, x2: x, y2: y });
    }
    if (fn === OPS.constructPath && Array.isArray(args) && args.length >= 2) {
      const ops = args[0] || [];
      const nums = args[1] || [];
      let p = 0;
      let last = null;
      for (const op of ops) {
        if (op === OPS.moveTo) {
          last = { x: nums[p++], y: nums[p++] };
        } else if (op === OPS.lineTo && last) {
          const next = { x: nums[p++], y: nums[p++] };
          segments.push({ x1: last.x, y1: last.y, x2: next.x, y2: next.y });
          last = next;
        } else if (op === OPS.closePath) {
          // noop
        }
      }
    }
  }

  return { segments, width: viewport.width, height: viewport.height };
}
