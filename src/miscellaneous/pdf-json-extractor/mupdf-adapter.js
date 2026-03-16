// MuPDF WASM adapter for EstimatorLab blueprint extraction
//
// This adapter uses the precompiled MuPDF WASM build to extract vector text
// atoms from PDF pages. It is dynamically loaded so that the heavy WASM
// runtime is only pulled in when the user selects the MuPDF engine. The
// adapter flattens MuPDF’s structured text output into a simple array of
// atoms compatible with the existing extraction pipeline.

import { ENGINE_IDS } from './pdf-engines.js';

export default class MuPdfWasmAdapter {
  constructor() {
    this.id = ENGINE_IDS.MUPDF;
    this._runtime = null;
  }

  async _ensureRuntime() {
    if (this._runtime) return;
    // Dynamically import the MuPDF runtime. The `webpackIgnore` comment
    // prevents bundlers from trying to analyze the import at build time.
    const module = await import(/* webpackIgnore: true */ '../../../public/wasm/mupdf/mupdf.js');
    // Initialize the runtime; locateFile tells MuPDF where to load its .wasm file from.
    this._runtime = await module.default({
      locateFile: (file) => `/public/wasm/mupdf/${file}`,
    });
  }

  async loadDocument(data) {
    await this._ensureRuntime();
    // MuPDF expects a Uint8Array for PDF data
    return new this._runtime.Document(new Uint8Array(data));
  }

  getPageCount(doc) {
    return doc.countPages();
  }

  getPageSize(doc, pageIndex) {
    const page = doc.loadPage(pageIndex);
    // width/height come from page bounds
    return { width: page.width, height: page.height };
  }

  async renderPageToBitmap(doc, pageIndex, scale = 1.5) {
    await this._ensureRuntime();
    const page = doc.loadPage(pageIndex);
    const matrix = this._runtime.Matrix.scale(scale, scale);
    const pixmap = page.toPixmap(matrix);
    // Convert to ImageData-like object. In browsers, ImageData
    // constructor expects width and height along with a Uint8ClampedArray.
    return new ImageData(
      new Uint8ClampedArray(pixmap.samples),
      pixmap.width,
      pixmap.height,
    );
  }

  async extractTextAtoms(doc, pageIndex) {
    await this._ensureRuntime();
    const page = doc.loadPage(pageIndex);
    const textDict = page.getText('rawdict');
    const atoms = [];
    // Flatten MuPDF structured text into simple atoms; each span maps to a text atom.
    textDict.blocks.forEach((block, blockIndex) => {
      block.lines.forEach((line, lineIndex) => {
        line.spans.forEach((span, spanIndex) => {
          const text = (span.text || '').replace(/\s+/g, ' ').trim();
          if (!text) return;
          atoms.push({
            id: `mupdf-${pageIndex}-${blockIndex}-${lineIndex}-${spanIndex}`,
            text,
            bbox: span.bbox,
            rotation: 0,
            fontName: span.font || null,
            fontSize: span.size || null,
            source: 'native',
            confidence: 0.96,
          });
        });
      });
    });
    return atoms;
  }
}
