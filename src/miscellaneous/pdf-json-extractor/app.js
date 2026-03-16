import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/+esm';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs';

const pdfInput = document.getElementById('pdfFile');
const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const statusProgress = document.getElementById('statusProgress');
const output = document.getElementById('jsonOutput');
const debugModeInput = document.getElementById('debugMode');
const debugContainer = document.getElementById('debugCanvases');

let latestJson = null;

const DISCIPLINE_RULES = [
  { discipline: 'civil', terms: ['grading', 'storm', 'civil', 'site', 'curb', 'sanitary', 'waterline', 'detention'] },
  { discipline: 'structural', terms: ['structural', 'steel', 'rebar', 'foundation', 'anchor'] },
  { discipline: 'architectural', terms: ['architectural', 'door', 'finish', 'partition', 'room'] },
  { discipline: 'mechanical', terms: ['hvac', 'mechanical', 'duct', 'cfm', 'air handler'] },
  { discipline: 'electrical', terms: ['electrical', 'panel', 'transformer', 'conduit', 'circuit'] },
  { discipline: 'instrumentation', terms: ['instrument', 'plc', 'i/o', 'loop', 'control panel'] },
];

const SHEET_TYPE_RULES = [
  { type: 'schedule_sheet', terms: ['schedule', 'table'] },
  { type: 'general_notes', terms: ['general notes', 'notes'] },
  { type: 'legend', terms: ['legend', 'symbols'] },
  { type: 'site_plan', terms: ['site plan', 'overall plan'] },
  { type: 'utility_plan', terms: ['utility'] },
  { type: 'grading_plan', terms: ['grading'] },
  { type: 'detail_sheet', terms: ['details', 'detail'] },
  { type: 'section_sheet', terms: ['section'] },
  { type: 'cover', terms: ['cover'] },
  { type: 'index', terms: ['index'] },
];

const updateStatus = (message, progress = null) => {
  statusText.textContent = message;
  if (typeof progress === 'number') {
    statusProgress.value = Math.max(0, Math.min(100, progress));
  }
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const unionBoxes = (boxes) => {
  if (!boxes.length) return [0, 0, 0, 0];
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
};

const area = (box) => Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);

const iou = (a, b) => {
  const overlap = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  const overlapArea = area(overlap);
  if (!overlapArea) return 0;
  return overlapArea / Math.max(1, area(a) + area(b) - overlapArea);
};

const textSimilarity = (a, b) => {
  const x = (a || '').replace(/\s+/g, '').toUpperCase();
  const y = (b || '').replace(/\s+/g, '').toUpperCase();
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  if (x === y) return 1;
  const min = Math.min(x.length, y.length);
  let hits = 0;
  for (let i = 0; i < min; i += 1) {
    if (x[i] === y[i]) hits += 1;
  }
  return hits / Math.max(x.length, y.length);
};

const normalizeText = (value) => (value || '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/ﬁ/g, 'fi')
  .replace(/ﬂ/g, 'fl')
  .replace(/\s+/g, ' ')
  .trim();

const estimateRotation = (transform = []) => {
  const a = transform[0] || 0;
  const b = transform[1] || 0;
  const angle = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const rightAngles = [0, 90, 180, 270];
  let closest = rightAngles[0];
  let minDiff = 360;
  for (const candidate of rightAngles) {
    const diff = Math.min(Math.abs(candidate - angle), 360 - Math.abs(candidate - angle));
    if (diff < minDiff) {
      minDiff = diff;
      closest = candidate;
    }
  }
  return minDiff <= 12 ? closest : Math.round(angle);
};

const detectCharacterSoup = (text) => {
  if (!text) return false;
  const clean = text.replace(/\s+/g, '');
  if (clean.length < 8) return false;
  const repeated = clean.match(/(.)\1+/g) || [];
  const repeatedChars = repeated.reduce((sum, chunk) => sum + chunk.length, 0);
  const alternating = clean.match(/([A-Za-z])([A-Za-z])\1\2/g) || [];
  return (repeatedChars / clean.length > 0.38) || alternating.length >= 2;
};

const extractNativeTextAtoms = (textItems, pageHeight) => {
  const atoms = [];
  textItems.forEach((item, itemIndex) => {
    const text = normalizeText(item.str);
    if (!text) return;

    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const rotation = estimateRotation(transform);
    const fontSize = Math.max(4, Math.hypot(transform[0] || 0, transform[1] || 0));
    const width = Math.max(0.5, item.width || fontSize * 0.6 * text.length);
    const height = Math.max(fontSize, item.height || fontSize);
    const x = transform[4] || 0;
    const yTopPdf = transform[5] || 0;
    const yTop = pageHeight - yTopPdf;

    atoms.push({
      id: `native-${itemIndex}`,
      text,
      rawText: item.str || '',
      bbox: [x, yTop, x + width, yTop + height],
      fontName: item.fontName || 'unknown',
      fontSize,
      transform,
      rotation,
      source: 'native_pdf_text',
      confidence: 0.96,
    });
  });
  return atoms;
};

const dedupeOverlappingTextAtoms = (atoms) => {
  const sorted = [...atoms].sort((a, b) => area(a.bbox) - area(b.bbox));
  const deduped = [];
  const dropped = [];

  sorted.forEach((atom) => {
    const duplicate = deduped.find((existing) => {
      if (Math.abs(existing.rotation - atom.rotation) > 8) return false;
      return iou(existing.bbox, atom.bbox) > 0.72 && textSimilarity(existing.text, atom.text) > 0.86;
    });

    if (!duplicate) {
      deduped.push(atom);
      return;
    }

    const keepExisting = (duplicate.source === 'native_pdf_text' && atom.source !== 'native_pdf_text')
      || duplicate.confidence >= atom.confidence;

    if (keepExisting) {
      dropped.push(atom);
    } else {
      dropped.push(duplicate);
      deduped.splice(deduped.indexOf(duplicate), 1, atom);
    }
  });

  return { deduped, dropped };
};

const groupAtomsIntoLines = (atoms) => {
  const lines = [];
  const sorted = [...atoms].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);

  sorted.forEach((atom) => {
    const centerY = (atom.bbox[1] + atom.bbox[3]) / 2;
    const line = lines.find((candidate) => {
      if (Math.abs(candidate.rotation - atom.rotation) > 8) return false;
      if (Math.abs(candidate.avgFontSize - atom.fontSize) > Math.max(4, candidate.avgFontSize * 0.8)) return false;
      const yTolerance = Math.max(3, candidate.avgFontSize * 0.65);
      return Math.abs(candidate.centerY - centerY) <= yTolerance;
    });

    if (!line) {
      lines.push({
        atoms: [atom],
        rotation: atom.rotation,
        avgFontSize: atom.fontSize,
        centerY,
      });
      return;
    }

    line.atoms.push(atom);
    line.avgFontSize = (line.avgFontSize * (line.atoms.length - 1) + atom.fontSize) / line.atoms.length;
    line.centerY = (line.centerY * (line.atoms.length - 1) + centerY) / line.atoms.length;
  });

  return lines
    .map((line, index) => {
      const atomsOrdered = [...line.atoms].sort((a, b) => a.bbox[0] - b.bbox[0]);
      const words = [];
      let current = [atomsOrdered[0]];

      for (let i = 1; i < atomsOrdered.length; i += 1) {
        const prev = atomsOrdered[i - 1];
        const next = atomsOrdered[i];
        const gap = next.bbox[0] - prev.bbox[2];
        const maxGap = Math.max(3, line.avgFontSize * 1.3);
        if (gap > maxGap) {
          words.push(current);
          current = [next];
        } else {
          current.push(next);
        }
      }
      words.push(current);

      const wordText = words
        .map((wordAtoms) => normalizeText(wordAtoms.map((entry) => entry.text).join('')))
        .filter(Boolean);

      const text = normalizeText(wordText.join(' '));
      return {
        id: `line-${index}`,
        text,
        atoms: atomsOrdered,
        words: wordText,
        bbox: unionBoxes(atomsOrdered.map((entry) => entry.bbox)),
        rotation: line.rotation,
        avgFontSize: line.avgFontSize,
      };
    })
    .filter((line) => line.text && !detectCharacterSoup(line.text))
    .sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
};

const classifyDiscipline = (lines) => {
  const haystack = lines.map((line) => line.text.toLowerCase()).join(' ');
  let best = { discipline: 'unknown', score: 0 };

  DISCIPLINE_RULES.forEach((rule) => {
    const score = rule.terms.reduce((hits, term) => (haystack.includes(term) ? hits + 1 : hits), 0);
    if (score > best.score) best = { discipline: rule.discipline, score };
  });

  return best.discipline;
};

const classifySheetType = (lines) => {
  const haystack = lines.slice(0, 80).map((line) => line.text.toLowerCase()).join(' ');
  let best = { type: 'detail_sheet', score: 0 };

  SHEET_TYPE_RULES.forEach((rule) => {
    const score = rule.terms.reduce((hits, term) => (haystack.includes(term) ? hits + 1 : hits), 0);
    if (score > best.score) best = { type: rule.type, score };
  });

  return best.type;
};

const segmentPageRegions = (lines, pageWidth, pageHeight) => {
  const titleBlockCandidates = lines.filter((line) => {
    const [x1, y1, x2, y2] = line.bbox;
    const inBottomBand = y1 > pageHeight * 0.73;
    const inRightBand = x1 > pageWidth * 0.62;
    const metadataLike = /(sheet|title|scale|date|rev|revision|project|drawn|checked|issue)/i.test(line.text);
    return (inBottomBand && inRightBand) || metadataLike;
  });

  const notesCandidates = lines.filter((line) => /notes?\b|general notes?/i.test(line.text) || /^\d+[\.)\-]/.test(line.text));
  const tableCandidates = lines.filter((line) => line.words.length >= 3);

  const titleBlock = titleBlockCandidates.length ? unionBoxes(titleBlockCandidates.map((line) => line.bbox)) : null;
  const notesBlock = notesCandidates.length >= 2 ? unionBoxes(notesCandidates.map((line) => line.bbox)) : null;
  const scheduleBlock = tableCandidates.length >= 4 ? unionBoxes(tableCandidates.map((line) => line.bbox)) : null;

  return {
    title_block: titleBlock,
    notes: notesBlock,
    schedule: scheduleBlock,
    main_viewport: [0, 0, pageWidth, pageHeight],
  };
};

const inBox = (box, regionBox) => {
  if (!box || !regionBox) return false;
  const overlap = [
    Math.max(box[0], regionBox[0]),
    Math.max(box[1], regionBox[1]),
    Math.min(box[2], regionBox[2]),
    Math.min(box[3], regionBox[3]),
  ];
  return area(overlap) > area(box) * 0.55;
};

const extractMetadata = (titleLines, discipline) => {
  const sheetNumberLine = titleLines.find((line) => /[A-Z]{1,3}-?\d{1,4}[A-Z]?/i.test(line.text));
  const titleLine = titleLines.find((line) => /(plan|notes|details|schedule|legend|section)/i.test(line.text));
  const scaleLine = titleLines.find((line) => /\bscale\b/i.test(line.text));
  const issueLine = titleLines.find((line) => /\b(for|issue|permit|construction|bid)\b/i.test(line.text));
  const dateLine = titleLines.find((line) => /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(line.text));

  const sheetNumber = sheetNumberLine?.text.match(/[A-Z]{1,3}-?\d{1,4}[A-Z]?/i)?.[0] || null;

  return {
    sheetNumber,
    sheetTitle: titleLine?.text || null,
    discipline,
    scaleText: scaleLine?.text || null,
    issueStatus: issueLine?.text || null,
    date: dateLine?.text || null,
    confidence: clamp01((sheetNumber ? 0.35 : 0) + (titleLine ? 0.3 : 0) + (scaleLine ? 0.15 : 0) + (issueLine ? 0.1 : 0) + 0.1),
  };
};

const parseNotesBlock = (lines, bbox) => {
  if (!bbox) return null;
  const noteLines = lines.filter((line) => inBox(line.bbox, bbox)).sort((a, b) => a.bbox[1] - b.bbox[1]);
  if (noteLines.length < 2) return null;

  const heading = noteLines.find((line) => /notes?\b/i.test(line.text));
  const items = [];
  let current = null;

  noteLines.forEach((line) => {
    const match = line.text.match(/^(\d+)[\.)\-:]\s*(.*)$/);
    if (match) {
      if (current) items.push(current);
      current = { number: match[1], text: match[2] || '' };
      return;
    }
    if (current) {
      current.text = normalizeText(`${current.text} ${line.text}`);
    }
  });
  if (current) items.push(current);

  if (!items.length) return null;
  return {
    type: 'notes_block',
    title: heading?.text || 'NOTES',
    items,
    bbox,
    source: 'native_pdf_text',
    confidence: clamp01(0.72 + Math.min(items.length, 6) * 0.04),
  };
};

const detectTable = (lines, bbox) => {
  if (!bbox) return null;
  const tableLines = lines.filter((line) => inBox(line.bbox, bbox));
  if (tableLines.length < 3) return null;

  const rowCandidates = tableLines
    .map((line) => ({
      line,
      cells: line.words,
    }))
    .filter((entry) => entry.cells.length >= 3);

  if (rowCandidates.length < 2) return null;

  const maxCells = Math.max(...rowCandidates.map((row) => row.cells.length));
  const columns = Array.from({ length: maxCells }, (_, i) => ({ name: rowCandidates[0].cells[i] || `Column ${i + 1}` }));
  const rows = rowCandidates.slice(1).map((row) => {
    const data = {};
    columns.forEach((col, i) => {
      data[col.name] = row.cells[i] || '';
    });
    return data;
  });

  const title = tableLines.find((line) => /schedule|table/i.test(line.text))?.text || 'Schedule';

  return {
    type: 'table',
    tableRole: 'schedule',
    title,
    bbox,
    columns,
    rows,
    source: 'native_pdf_text',
    confidence: clamp01(0.7 + Math.min(rows.length, 5) * 0.04),
  };
};

const classifyLineSemantic = (line, regions) => {
  if (regions.title_block && inBox(line.bbox, regions.title_block)) {
    return 'title_block_meta';
  }

  if (/\b(see|typ|match existing|ref\.|detail|section)\b/i.test(line.text) || /\d+\s*[\/-]\s*[A-Z]-?\d+/i.test(line.text)) {
    return 'reference_callout';
  }

  if (/\b\d+\s*'\s*-?\s*\d*\s*\"|\b\d+\s*\"\s*(dia|ø)?|\bR\s*\d+/i.test(line.text)) {
    return 'dimension';
  }

  if (/\blegend\b/i.test(line.text)) return 'legend_block';
  if (/\b(detail|section)\b/i.test(line.text)) return 'detail_title';
  if (/\b(notes?)\b/i.test(line.text)) return 'viewport_label';
  return 'equipment_label';
};

const classifyLineBlocks = (lines, regions, consumedLineIds = new Set()) => lines
  .filter((line) => !consumedLineIds.has(line.id))
  .map((line) => {
    const type = classifyLineSemantic(line, regions);
    const block = {
      type,
      text: line.text,
      bbox: line.bbox,
      source: line.atoms.some((atom) => atom.source === 'ocr_raster_region') ? 'ocr_raster_region' : 'native_pdf_text',
      confidence: type === 'title_block_meta' ? 0.92 : 0.8,
    };

    if (type === 'dimension') {
      const value = line.text.match(/(\d+(?:\.\d+)?)/)?.[1];
      const unit = /"/.test(line.text) ? 'in' : /'/.test(line.text) ? 'ft' : null;
      block.value = value ? Number(value) : null;
      block.unit = unit;
      block.context = /gate/i.test(line.text) ? 'fence_gate' : 'drawing';
    }

    if (type === 'reference_callout') {
      const detail = line.text.match(/(\d+)\s*[\/-]\s*([A-Z]-?\d+)/i);
      if (detail) {
        block.referenceType = 'detail';
        block.detailNumber = detail[1];
        block.targetSheet = detail[2].toUpperCase();
      } else if (/see electrical/i.test(line.text)) {
        block.referenceType = 'discipline_ref';
        block.targetDiscipline = 'electrical';
      } else {
        block.referenceType = 'reference_text';
      }
    }

    return block;
  });

const runValidations = (pageOutput) => {
  const warnings = [];
  const allText = pageOutput.blocks.map((block) => block.text || '').join(' ');

  if (detectCharacterSoup(allText)) warnings.push('character_soup_detected');
  if (pageOutput.blocks.some((block) => block.type === 'table' && !block.rows)) warnings.push('table_coherence_failed');
  if (pageOutput.blocks.some((block) => block.type === 'notes_block' && block.items?.length <= 1)) warnings.push('notes_continuity_failed');

  const titleStrings = (pageOutput.blocks || [])
    .filter((block) => block.type === 'title_block_meta')
    .map((block) => (block.text || '').toUpperCase())
    .slice(0, 6);

  if (pageOutput.blocks.some((block) => block.type === 'notes_block' && titleStrings.some((t) => t && JSON.stringify(block).toUpperCase().includes(t)))) {
    warnings.push('metadata_bleed_detected');
  }

  return warnings;
};

const createOcrWorker = async () => createWorker('eng', 1, {
  logger: ({ progress }) => {
    if (typeof progress === 'number') {
      updateStatus(`Running OCR... ${Math.round(progress * 100)}%`);
    }
  },
});

const renderPageToCanvas = async (page, scale = 1.8) => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return { canvas, viewport };
};

const estimateImageCoverage = async (page) => {
  const operatorList = await page.getOperatorList();
  const paintImageOps = operatorList.fnArray.filter((fn) => fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject).length;
  return clamp01(paintImageOps / 45);
};

const buildPageDiagnostics = async (page, textItems) => {
  const viewport = page.getViewport({ scale: 1 });
  const nativeAtoms = extractNativeTextAtoms(textItems, viewport.height);
  const nativeArea = nativeAtoms.reduce((sum, atom) => sum + area(atom.bbox), 0);
  const pageArea = Math.max(1, viewport.width * viewport.height);
  const imageCoverageRatio = await estimateImageCoverage(page);
  const nativeTextDensity = clamp01(nativeArea / pageArea);
  const hasNativeText = nativeAtoms.length > 0;
  const hasRasterRegions = imageCoverageRatio > 0.06 || !hasNativeText;
  const lineProxies = groupAtomsIntoLines(nativeAtoms);

  return {
    width: viewport.width,
    height: viewport.height,
    hasNativeText,
    hasRasterRegions,
    nativeTextDensity,
    imageCoverageRatio,
    suspectedSheetType: classifySheetType(lineProxies),
    suspectedDiscipline: classifyDiscipline(lineProxies),
  };
};

const extractRasterPage = async (page, pageNumber, pageDiagnostics, ocrWorker) => {
  const { canvas, viewport } = await renderPageToCanvas(page, 2);
  const { data } = await ocrWorker.recognize(canvas);
  const ocrLines = (data?.lines || []).map((line, index) => ({
    id: `ocr-line-${index}`,
    text: normalizeText(line.text),
    bbox: [line.bbox.x0, line.bbox.y0, line.bbox.x1, line.bbox.y1],
    words: normalizeText(line.text).split(' ').filter(Boolean),
    atoms: [{ source: 'ocr_raster_region' }],
    avgFontSize: Math.max(8, line.bbox.y1 - line.bbox.y0),
    rotation: 0,
  })).filter((line) => line.text && !detectCharacterSoup(line.text));

  const regions = segmentPageRegions(ocrLines, viewport.width, viewport.height);
  const notesBlock = parseNotesBlock(ocrLines, regions.notes);
  const tableBlock = detectTable(ocrLines, regions.schedule);
  const consumed = new Set();
  const blocks = [];

  if (notesBlock) {
    blocks.push(notesBlock);
    ocrLines.filter((line) => inBox(line.bbox, notesBlock.bbox)).forEach((line) => consumed.add(line.id));
  }
  if (tableBlock) {
    blocks.push(tableBlock);
    ocrLines.filter((line) => inBox(line.bbox, tableBlock.bbox)).forEach((line) => consumed.add(line.id));
  }

  blocks.push(...classifyLineBlocks(ocrLines, regions, consumed));

  const metaLines = ocrLines.filter((line) => regions.title_block && inBox(line.bbox, regions.title_block));
  const sheetMeta = extractMetadata(metaLines, pageDiagnostics.suspectedDiscipline);

  const pageOutput = {
    pageNumber,
    sheetMeta,
    pageDiagnostics: {
      hasNativeText: false,
      hasRasterRegions: true,
      nativeTextDensity: 0,
      imageCoverageRatio: pageDiagnostics.imageCoverageRatio,
      suspectedSheetType: pageDiagnostics.suspectedSheetType,
      suspectedDiscipline: pageDiagnostics.suspectedDiscipline,
      sourceSelection: 'ocr_raster_region',
    },
    blocks,
    validationWarnings: [],
  };

  pageOutput.validationWarnings = runValidations(pageOutput);
  return { pageOutput, debug: { canvas, dedupedAtoms: [], droppedAtoms: [], lines: ocrLines, regions, blocks } };
};

const extractVectorPage = async (page, pageNumber, pageDiagnostics) => {
  const textContent = await page.getTextContent();
  const rawAtoms = extractNativeTextAtoms(textContent.items || [], pageDiagnostics.height);
  const { deduped: dedupedAtoms, dropped: droppedAtoms } = dedupeOverlappingTextAtoms(rawAtoms);
  const lines = groupAtomsIntoLines(dedupedAtoms);
  const regions = segmentPageRegions(lines, pageDiagnostics.width, pageDiagnostics.height);

  const notesBlock = parseNotesBlock(lines, regions.notes);
  const tableBlock = detectTable(lines, regions.schedule);
  const consumed = new Set();
  const blocks = [];

  if (notesBlock) {
    blocks.push(notesBlock);
    lines.filter((line) => inBox(line.bbox, notesBlock.bbox)).forEach((line) => consumed.add(line.id));
  }

  if (tableBlock) {
    blocks.push(tableBlock);
    lines.filter((line) => inBox(line.bbox, tableBlock.bbox)).forEach((line) => consumed.add(line.id));
  }

  blocks.push(...classifyLineBlocks(lines, regions, consumed));

  const metaLines = lines.filter((line) => regions.title_block && inBox(line.bbox, regions.title_block));
  const sheetMeta = extractMetadata(metaLines, pageDiagnostics.suspectedDiscipline);

  const pageOutput = {
    pageNumber,
    sheetMeta,
    pageDiagnostics: {
      hasNativeText: pageDiagnostics.hasNativeText,
      hasRasterRegions: pageDiagnostics.hasRasterRegions,
      nativeTextDensity: pageDiagnostics.nativeTextDensity,
      imageCoverageRatio: pageDiagnostics.imageCoverageRatio,
      suspectedSheetType: pageDiagnostics.suspectedSheetType,
      suspectedDiscipline: pageDiagnostics.suspectedDiscipline,
      sourceSelection: 'native_pdf_text',
    },
    blocks,
    validationWarnings: [],
  };

  pageOutput.validationWarnings = runValidations(pageOutput);
  const { canvas } = await renderPageToCanvas(page, 1);
  return {
    pageOutput,
    debug: {
      canvas,
      dedupedAtoms,
      droppedAtoms,
      lines,
      regions,
      blocks,
    },
  };
};

const drawBox = (ctx, box, color, width = 1.2, label = '') => {
  if (!box) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
  if (label) {
    ctx.fillStyle = color;
    ctx.font = '10px sans-serif';
    ctx.fillText(label, box[0] + 2, Math.max(10, box[1] - 4));
  }
  ctx.restore();
};

const renderDebugOverlay = (pageNumber, debugData) => {
  if (!debugModeInput?.checked || !debugContainer) return;

  const wrapper = document.createElement('article');
  wrapper.className = 'debug-page';
  const title = document.createElement('h3');
  title.textContent = `Debug Page ${pageNumber}`;
  wrapper.appendChild(title);

  const canvas = document.createElement('canvas');
  canvas.width = debugData.canvas.width;
  canvas.height = debugData.canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(debugData.canvas, 0, 0);

  debugData.dedupedAtoms.forEach((atom) => drawBox(ctx, atom.bbox, 'rgba(56,189,248,0.9)', 0.7));
  debugData.droppedAtoms.forEach((atom) => drawBox(ctx, atom.bbox, 'rgba(239,68,68,0.9)', 0.9));
  debugData.lines.forEach((line) => drawBox(ctx, line.bbox, 'rgba(34,197,94,0.65)', 1));

  drawBox(ctx, debugData.regions.title_block, 'rgba(249,115,22,0.9)', 1.7, 'title_block');
  drawBox(ctx, debugData.regions.notes, 'rgba(168,85,247,0.9)', 1.7, 'notes');
  drawBox(ctx, debugData.regions.schedule, 'rgba(14,165,233,0.9)', 1.7, 'table');

  debugData.blocks.forEach((block) => {
    if (block.confidence < 0.7) drawBox(ctx, block.bbox, 'rgba(251,191,36,0.9)', 1.6, 'low confidence');
  });

  wrapper.appendChild(canvas);
  debugContainer.appendChild(wrapper);
};

const processPdf = async (file) => {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  let ocrWorker = null;

  if (debugContainer) debugContainer.innerHTML = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageDiagnostics = await buildPageDiagnostics(page, textContent.items || []);

    updateStatus(`Inspecting and processing page ${pageNum} of ${pdf.numPages}`, ((pageNum - 1) / pdf.numPages) * 100);

    let result;
    if (!pageDiagnostics.hasNativeText) {
      if (!ocrWorker) {
        updateStatus('Initializing OCR worker...', ((pageNum - 1) / pdf.numPages) * 100);
        ocrWorker = await createOcrWorker();
      }
      result = await extractRasterPage(page, pageNum, pageDiagnostics, ocrWorker);
    } else {
      result = await extractVectorPage(page, pageNum, pageDiagnostics);
    }

    pages.push(result.pageOutput);
    renderDebugOverlay(pageNum, result.debug);
    updateStatus(`Finished page ${pageNum} of ${pdf.numPages}`, (pageNum / pdf.numPages) * 100);
  }

  if (ocrWorker) await ocrWorker.terminate();

  return {
    filename: file.name,
    extractedAt: new Date().toISOString(),
    pages,
  };
};

extractBtn.addEventListener('click', async () => {
  const file = pdfInput.files?.[0];
  if (!file) {
    updateStatus('Please choose a PDF first.');
    return;
  }

  extractBtn.disabled = true;
  downloadBtn.disabled = true;
  latestJson = null;
  output.textContent = '{}';

  try {
    const result = await processPdf(file);
    latestJson = result;
    output.textContent = JSON.stringify(result, null, 2);
    downloadBtn.disabled = false;
    updateStatus('Extraction complete.', 100);
  } catch (error) {
    console.error(error);
    updateStatus(`Extraction failed: ${error.message}`);
  } finally {
    extractBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', () => {
  if (!latestJson) return;
  const blob = new Blob([JSON.stringify(latestJson, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(latestJson.filename || 'extracted').replace(/\.pdf$/i, '')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
});
