// ESM module for PDF Page Extractor, relying on PDFLib from CDN via runtime wrapper
import { getPDFLib } from '../../lib/pdf/runtime.js';

function pdfLib(){
  try{ return getPDFLib(); }catch{ return undefined; }
}

const statusEl = document.getElementById('status');
const fileEl = document.getElementById('pdfFile');
const pagesEl = document.getElementById('pages');
const extractBtn = document.getElementById('extractBtn');
const tryExampleBtn = document.getElementById('tryExampleBtn');

function setStatus(msg, cls='') {
  statusEl.className = 'status ' + cls;
  statusEl.textContent = msg || '';
}

function parsePages(spec, maxPage) {
  // spec like "1,3-5,9"
  // returns array of zero-based indices
  if (!spec || !spec.trim()) throw new Error('Enter pages to extract.');
  const out = [];
  for (const tokenRaw of spec.split(',')) {
    const token = tokenRaw.trim();
    if (!token) continue;
    if (token.includes('-')) {
      const [a, b] = token.split('-').map(s => parseInt(s.trim(), 10));
      if (Number.isNaN(a) || Number.isNaN(b)) throw new Error(`Bad range: "${token}"`);
      const start = Math.min(a, b), end = Math.max(a, b);
      for (let p = start; p <= end; p++) {
        if (p < 1 || (maxPage && p > maxPage)) throw new Error(`Page ${p} out of bounds (1..${maxPage})`);
        out.push(p - 1);
      }
    } else {
      const p = parseInt(token, 10);
      if (Number.isNaN(p)) throw new Error(`Bad page: "${token}"`);
      if (p < 1 || (maxPage && p > maxPage)) throw new Error(`Page ${p} out of bounds (1..${maxPage})`);
      out.push(p - 1);
    }
  }
  return out;
}

async function readFileAsUint8Array(file) {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

async function extractPagesFromBytes(pdfBytes, pagesSpec, suggestedName='extracted.pdf') {
  const { PDFDocument } = pdfLib() || {};
  if (!PDFDocument) throw new Error('PDFLib is not loaded');
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  const total = srcDoc.getPageCount();
  const wanted = parsePages(pagesSpec, total);
  if (wanted.length === 0) throw new Error('No pages selected.');

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, wanted);
  copied.forEach(p => newDoc.addPage(p));

  // Optionally preserve metadata (title/author, etc.) if present
  try {
    const title = srcDoc.getTitle(); if (title) newDoc.setTitle(title + ' (extracted)');
    const author = srcDoc.getAuthor(); if (author) newDoc.setAuthor(author);
    const subject = srcDoc.getSubject(); if (subject) newDoc.setSubject(subject);
    const keywords = srcDoc.getKeywords(); if (keywords) newDoc.setKeywords(keywords);
    const producer = srcDoc.getProducer(); if (producer) newDoc.setProducer(producer);
    const creator = srcDoc.getCreator(); if (creator) newDoc.setCreator(creator);
  } catch { /* metadata may not exist; ignore */ }

  const outBytes = await newDoc.save({ updateFieldAppearances: false });
  const blob = new Blob([outBytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(a.href);
}

extractBtn.addEventListener('click', async () => {
  setStatus('');
  try {
    const file = fileEl.files?.[0];
    if (!file) { setStatus('Choose a PDF first.', 'err'); return; }
    const pagesSpec = pagesEl.value;
    setStatus('Processing…');
    const bytes = await readFileAsUint8Array(file);
    const baseName = (file.name || 'document.pdf').replace(/\.pdf$/i, '');
    await extractPagesFromBytes(bytes, pagesSpec, `${baseName}-pages.pdf`);
    setStatus('Done! Download should start automatically.', 'ok');
  } catch (err) {
    console.error(err);
    setStatus(err.message || String(err), 'err');
  }
});

tryExampleBtn.addEventListener('click', async () => {
  setStatus('Generating example PDF…');
  try {
    const { PDFDocument, StandardFonts, rgb } = pdfLib() || {};
    if (!PDFDocument) throw new Error('PDFLib is not loaded');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    // Create 3 pages so ranges can be tested
    for (let i = 1; i <= 3; i++) {
      const page = doc.addPage([612, 792]);
      page.drawText(`Example PDF — Page ${i}`, {
        x: 72, y: 720, size: 24, font, color: rgb(0,0,0)
      });
    }
    const bytes = await doc.save();
    pagesEl.value = '1-2'; // prefill example
    await extractPagesFromBytes(bytes, pagesEl.value, 'example-extracted.pdf');
    setStatus('Example created and extracted. Check your downloads.', 'ok');
  } catch (err) {
    console.error(err);
    setStatus(err.message || String(err), 'err');
  }
});
