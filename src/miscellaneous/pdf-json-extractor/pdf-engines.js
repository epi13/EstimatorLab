export const ENGINE_IDS = {
  CURRENT: 'current',
  MUPDF: 'mupdf',
  PDFIUM: 'pdfium',
};

export const normalizeBBox = (raw, pageWidth, pageHeight, engine = ENGINE_IDS.CURRENT) => {
  if (!Array.isArray(raw) || raw.length !== 4) return { bbox: null, invalid: true, reason: 'bbox_missing' };
  let [x1, y1, x2, y2] = raw.map((value) => (Number.isFinite(value) ? value : 0));

  if (engine === ENGINE_IDS.CURRENT) {
    // pdf.js text coordinates are already top-left in this project path.
  }

  if (x1 > x2) [x1, x2] = [x2, x1];
  if (y1 > y2) [y1, y2] = [y2, y1];

  const clipped = [
    Math.max(0, Math.min(pageWidth, x1)),
    Math.max(0, Math.min(pageHeight, y1)),
    Math.max(0, Math.min(pageWidth, x2)),
    Math.max(0, Math.min(pageHeight, y2)),
  ];

  const tolerance = Math.max(8, Math.min(pageWidth, pageHeight) * 0.02);
  const outside = x1 < -tolerance || y1 < -tolerance || x2 > pageWidth + tolerance || y2 > pageHeight + tolerance;
  const invalid = clipped[0] >= clipped[2] || clipped[1] >= clipped[3] || outside;

  return { bbox: clipped, invalid, reason: invalid ? 'bbox_invalid_after_normalization' : null };
};

class CurrentPdfJsAdapter {
  constructor(pdfjsLib) {
    this.id = ENGINE_IDS.CURRENT;
    this.pdfjsLib = pdfjsLib;
  }

  async loadDocument(data) {
    return this.pdfjsLib.getDocument({ data }).promise;
  }

  getPageCount(doc) {
    return doc.numPages;
  }

  async getPageSize(doc, pageIndex) {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  }

  async renderPageToBitmap(doc, pageIndex, scale = 1.5) {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  async extractTextAtoms(doc, pageIndex) {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    return (textContent.items || []).map((item, itemIndex) => {
      const text = (item.str || '').replace(/\s+/g, ' ').trim();
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const rotation = Math.round((((Math.atan2(transform[1] || 0, transform[0] || 0) * 180) / Math.PI) + 360) % 360);
      const fontSize = Math.max(4, Math.hypot(transform[0] || 0, transform[1] || 0));
      const width = Math.max(0.5, item.width || fontSize * 0.6 * Math.max(1, text.length));
      const height = Math.max(fontSize, item.height || fontSize);
      const x = transform[4] || 0;
      const yTop = viewport.height - (transform[5] || 0);
      return {
        id: `native-${itemIndex}`,
        text,
        bbox: [x, yTop, x + width, yTop + height],
        rotation,
        fontName: item.fontName || null,
        fontSize,
        source: 'native',
        confidence: 0.96,
      };
    }).filter((atom) => atom.text);
  }
}

class MuPdfWasmAdapter {
  constructor() { this.id = ENGINE_IDS.MUPDF; }
  async loadDocument() {
    throw new Error('MuPDF adapter is wired, but runtime is not installed. Add MuPDF WASM assets and loader at /public/wasm/mupdf.wasm.');
  }
  getPageCount() { return 0; }
  getPageSize() { return { width: 0, height: 0 }; }
  async renderPageToBitmap() { return new Uint8ClampedArray(); }
  async extractTextAtoms() { return []; }
}

class PdfiumWasmAdapter {
  constructor() { this.id = ENGINE_IDS.PDFIUM; }
  async loadDocument() {
    throw new Error('PDFium adapter is wired, but runtime is not installed. Add PDFium WASM assets and loader at /public/wasm/pdfium.wasm.');
  }
  getPageCount() { return 0; }
  getPageSize() { return { width: 0, height: 0 }; }
  async renderPageToBitmap() { return new Uint8ClampedArray(); }
  async extractTextAtoms() { return []; }
}

export const createEngineAdapter = (engineId, pdfjsLib) => {
  if (engineId === ENGINE_IDS.MUPDF) return new MuPdfWasmAdapter();
  if (engineId === ENGINE_IDS.PDFIUM) return new PdfiumWasmAdapter();
  return new CurrentPdfJsAdapter(pdfjsLib);
};
