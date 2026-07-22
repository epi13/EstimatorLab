const pdfjsLib = globalThis.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../lib/vendor/pdfjs/pdf.worker.min.js', import.meta.url).toString();

const $ = (id) => document.getElementById(id);
const input = $('pdfInput'), pageSelect = $('pageSelect'), preview = $('preview'), wrap = $('canvasWrap');
const emptyState = $('emptyState'), status = $('status');
const buttons = ['cropMode', 'redactMode', 'undoRedaction', 'resetPage', 'download'].map($);
let pdf, pageNumber = 1, sourceCanvas, operations = new Map(), mode = null, dragStart = null, draft = null;

function setStatus(message) { status.textContent = message; }
function pageOps(number = pageNumber) { if (!operations.has(number)) operations.set(number, { crop: null, redactions: [] }); return operations.get(number); }
function setControls(enabled) { pageSelect.disabled = !enabled; buttons.forEach((button) => { button.disabled = !enabled; }); }
function rectFromPoints(a, b) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }; }
function canvasPoint(event) { const rect = preview.getBoundingClientRect(); return { x: (event.clientX - rect.left) * preview.width / rect.width, y: (event.clientY - rect.top) * preview.height / rect.height }; }
function valid(rect) { return rect && rect.width > 8 && rect.height > 8; }

function draw() {
  if (!sourceCanvas) return;
  preview.width = sourceCanvas.width; preview.height = sourceCanvas.height;
  const ctx = preview.getContext('2d'); ctx.drawImage(sourceCanvas, 0, 0);
  const ops = pageOps();
  ops.redactions.forEach((r) => { ctx.fillStyle = '#000'; ctx.fillRect(r.x, r.y, r.width, r.height); });
  if (draft && mode === 'redact') { ctx.fillStyle = '#000'; ctx.fillRect(draft.x, draft.y, draft.width, draft.height); }
  if (ops.crop || (draft && mode === 'crop')) {
    const c = draft && mode === 'crop' ? draft : ops.crop;
    const mask = $('cropMask'); mask.hidden = false;
    mask.style.left = `${(c.x / preview.width) * 100}%`; mask.style.top = `${(c.y / preview.height) * 100}%`;
    mask.style.width = `${(c.width / preview.width) * 100}%`; mask.style.height = `${(c.height / preview.height) * 100}%`;
    mask.style.inset = 'auto';
  } else $('cropMask').hidden = true;
}

async function showPage(number) {
  pageNumber = Number(number); setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}…`);
  const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 2 });
  sourceCanvas = document.createElement('canvas'); sourceCanvas.width = Math.ceil(viewport.width); sourceCanvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: sourceCanvas.getContext('2d'), viewport }).promise;
  draw(); setStatus(`Page ${pageNumber} of ${pdf.numPages}. Select a tool and drag on the drawing.`);
}

input.addEventListener('change', async () => {
  const file = input.files[0]; if (!file) return;
  try {
    setControls(false); operations = new Map(); setStatus('Loading PDF…');
    pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    pageSelect.innerHTML = Array.from({ length: pdf.numPages }, (_, i) => `<option value="${i + 1}">Page ${i + 1}</option>`).join('');
    emptyState.hidden = true; wrap.hidden = false; setControls(true); await showPage(1);
  } catch (error) { setStatus(`Could not load this PDF: ${error.message}`); }
});
pageSelect.addEventListener('change', () => showPage(pageSelect.value));
function selectMode(next) { mode = mode === next ? null : next; $('cropMode').classList.toggle('active', mode === 'crop'); $('redactMode').classList.toggle('active', mode === 'redact'); setStatus(mode ? `${mode === 'crop' ? 'Crop' : 'Blackout'} tool active — drag over the drawing.` : 'Tool deselected.'); }
$('cropMode').addEventListener('click', () => selectMode('crop')); $('redactMode').addEventListener('click', () => selectMode('redact'));
$('undoRedaction').addEventListener('click', () => { pageOps().redactions.pop(); draw(); });
$('resetPage').addEventListener('click', () => { operations.set(pageNumber, { crop: null, redactions: [] }); draw(); setStatus(`Cleared edits for page ${pageNumber}.`); });
preview.addEventListener('pointerdown', (event) => { if (!mode) return; preview.setPointerCapture(event.pointerId); dragStart = canvasPoint(event); draft = { ...dragStart, width: 0, height: 0 }; });
preview.addEventListener('pointermove', (event) => { if (!dragStart) return; draft = rectFromPoints(dragStart, canvasPoint(event)); draw(); });
preview.addEventListener('pointerup', () => { if (!dragStart) return; if (valid(draft)) { if (mode === 'crop') pageOps().crop = draft; else pageOps().redactions.push(draft); } draft = null; dragStart = null; draw(); });

function cleanCanvas(canvas, ops) {
  const crop = ops.crop || { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const result = document.createElement('canvas'); result.width = Math.round(crop.width); result.height = Math.round(crop.height);
  const ctx = result.getContext('2d'); ctx.drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, result.width, result.height);
  ctx.fillStyle = '#000'; ops.redactions.forEach((r) => ctx.fillRect(r.x - crop.x, r.y - crop.y, r.width, r.height));
  return result;
}
function ascii(value) { return new TextEncoder().encode(value); }
function concat(parts) { const size = parts.reduce((n, p) => n + p.length, 0), out = new Uint8Array(size); let offset = 0; parts.forEach((p) => { out.set(p, offset); offset += p.length; }); return out; }
function pdfFromJpegs(images) {
  const objects = []; const add = (parts) => objects.push(concat(parts));
  add([ascii('<< /Type /Catalog /Pages 2 0 R >>')]);
  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(' '); add([ascii(`<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>`)]);
  images.forEach((image, i) => { const pageId = 3 + i * 3, imageId = pageId + 1, contentId = pageId + 2; const w = image.width, h = image.height;
    add([ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)]);
    add([ascii(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`), image.bytes, ascii('\nendstream')]);
    const content = ascii(`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ`); add([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('\nendstream')]);
  });
  const chunks = [ascii('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')], offsets = [0]; let offset = chunks[0].length;
  objects.forEach((object, i) => { offsets.push(offset); const item = concat([ascii(`${i + 1} 0 obj\n`), object, ascii('\nendobj\n')]); chunks.push(item); offset += item.length; });
  const xref = offset; let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; offsets.slice(1).forEach((value) => { table += `${String(value).padStart(10, '0')} 00000 n \n`; });
  chunks.push(ascii(`${table}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)); return concat(chunks);
}
$('download').addEventListener('click', async () => {
  try { setControls(false); setStatus('Flattening and sanitizing pages…'); const images = [];
    for (let i = 1; i <= pdf.numPages; i++) { setStatus(`Sanitizing page ${i} of ${pdf.numPages}…`); const page = await pdf.getPage(i), viewport = page.getViewport({ scale: 2 }), canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise; const clean = cleanCanvas(canvas, pageOps(i)); const blob = await new Promise((resolve) => clean.toBlob(resolve, 'image/jpeg', .92)); if (!blob) throw new Error('The browser could not encode a page image.'); const bytes = new Uint8Array(await blob.arrayBuffer()); images.push({ width: clean.width, height: clean.height, bytes }); }
    const url = URL.createObjectURL(new Blob([pdfFromJpegs(images)], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `${input.files[0].name.replace(/\.pdf$/i, '') || 'blueprint'}-clean.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Clean PDF downloaded. It contains flattened page images only; original document metadata and hidden content are excluded.');
  } catch (error) { setStatus(`Could not create the clean PDF: ${error.message}`); } finally { setControls(true); }
});
