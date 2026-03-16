import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/+esm';
import { createEngineAdapter, ENGINE_IDS, normalizeBBox } from './pdf-engines.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs';

const pdfInput = document.getElementById('pdfFile');
const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const statusProgress = document.getElementById('statusProgress');
const output = document.getElementById('jsonOutput');
const debugModeInput = document.getElementById('debugMode');
const debugContainer = document.getElementById('debugCanvases');
const engineModeInput = document.getElementById('engineMode');
const bakeoffModeInput = document.getElementById('bakeoffMode');

let latestJson = null;

const DISCIPLINE_RULES = [
  { discipline: 'civil', terms: ['grading', 'storm', 'civil', 'site', 'curb', 'sanitary', 'waterline', 'detention'] },
  { discipline: 'structural', terms: ['structural', 'steel', 'rebar', 'foundation', 'anchor'] },
  { discipline: 'architectural', terms: ['architectural', 'door', 'finish', 'partition', 'room'] },
  { discipline: 'mechanical', terms: ['hvac', 'mechanical', 'duct', 'cfm', 'air handler'] },
  { discipline: 'electrical', terms: ['electrical', 'panel', 'transformer', 'conduit', 'circuit'] },
  { discipline: 'instrumentation', terms: ['instrument', 'plc', 'i/o', 'loop', 'control panel'] },
];

const DISCIPLINE_PREFIX_MAP = {
  G: 'general',
  C: 'civil',
  S: 'structural',
  A: 'architectural',
  M: 'mechanical',
  P: 'plumbing',
  E: 'electrical',
  I: 'instrumentation',
  X: 'misc',
};

const METADATA_LABEL_PATTERNS = {
  sheetNumber: /(sheet\s*(no\.?|number|#)|drawing\s*(no\.?|number)|dwg\s*(no\.?|number))/i,
  sheetTitle: /(sheet\s*title|title)/i,
  scaleText: /\bscale\b/i,
  issueStatus: /(issue|status|for\s+(construction|permit|bidding)|revision|rev\.?\s*status)/i,
  date: /\bdate\b/i,
  projectName: /(project|project\s*name)/i,
  client: /(client|owner)/i,
};

const TITLE_BLOCK_VALUE_PATTERNS = [
  /\b[A-Z]{1,2}\s*[-.]\s*\d{1,4}[A-Z]?\b/i,
  /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/,
  /\b(as shown|no scale|\d+\s*\/?\d*"\s*=\s*\d+'?-?\d*"?)\b/i,
  /\b(for construction|for permit|for bidding|issued|revision|rev\.?\s*[A-Z0-9]+)\b/i,
  /\b(project|owner|client|drawn|checked|approved)\b/i,
];

const FURNITURE_PATTERNS = [
  /contractor shall verify/i,
  /copyright/i,
  /reproduction or use/i,
  /original sheet/i,
  /ansi\s*[a-z]/i,
  /\bphone\b|\bfax\b|\bwww\./i,
  /\b\d{3}[-.)\s]\d{3}[-.\s]\d{4}\b/,
  /[a-z]:\\/i,
  /sheet_sets\\/i,
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
        const prevWidth = Math.max(1, prev.bbox[2] - prev.bbox[0]);
        const nextWidth = Math.max(1, next.bbox[2] - next.bbox[0]);
        const tightGap = Math.min(prevWidth, nextWidth) * 0.42;
        const maxGap = Math.max(1.5, Math.min(line.avgFontSize * 0.72, tightGap));
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

const scoreDisciplineEvidence = (lines) => {
  const haystack = lines.map((line) => line.text.toLowerCase()).join(' ');
  return DISCIPLINE_RULES
    .map((rule) => ({
      discipline: rule.discipline,
      score: rule.terms.reduce((hits, term) => (haystack.includes(term) ? hits + 1 : hits), 0),
    }))
    .sort((a, b) => b.score - a.score);
};

const classifySheetTypeLegacy = (lines) => {
  const haystack = lines.slice(0, 80).map((line) => line.text.toLowerCase()).join(' ');
  let best = { type: 'detail_sheet', score: 0 };

  SHEET_TYPE_RULES.forEach((rule) => {
    const score = rule.terms.reduce((hits, term) => (haystack.includes(term) ? hits + 1 : hits), 0);
    if (score > best.score) best = { type: rule.type, score };
  });

  return best.type;
};

const bboxCenter = (box) => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];

const normalizeLineCoordinates = (lines, pageWidth, pageHeight, engineId = ENGINE_IDS.CURRENT) => {
  const normalized = [];
  const invalid = [];
  lines.forEach((line) => {
    const { bbox, invalid: isInvalid, reason } = normalizeBBox(line.bbox, pageWidth, pageHeight, engineId);
    if (isInvalid || !bbox) {
      invalid.push({ ...line, invalidReason: reason });
      return;
    }
    normalized.push({ ...line, bbox });
  });
  return { normalized, invalid };
};

const isFurnitureText = (text = '') => {
  if (!text) return false;
  if (FURNITURE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (/^[A-H]$/.test(text.trim()) || /^\d{1,2}$/.test(text.trim())) return true;
  return false;
};

const detectBorderMarkers = (lines, pageWidth, pageHeight) => lines.filter((line) => {
  const [x1, y1, x2, y2] = line.bbox;
  const text = (line.text || '').trim();
  if (!/^[A-H]$|^\d{1,2}$/.test(text)) return false;
  const nearEdge = x1 < pageWidth * 0.05 || x2 > pageWidth * 0.95 || y1 < pageHeight * 0.05 || y2 > pageHeight * 0.95;
  return nearEdge;
});

const detectTitleBlockRegion = (lines, pageWidth, pageHeight) => {
  const candidates = lines.filter((line) => {
    const [x1, y1, x2] = line.bbox;
    const nearBottom = y1 > pageHeight * 0.68;
    const nearRight = x1 > pageWidth * 0.54;
    const nearCorner = nearBottom && nearRight;
    const metadataLabel = Object.values(METADATA_LABEL_PATTERNS).some((pattern) => pattern.test(line.text));
    const nearEdgeForMetadata = metadataLabel && (y1 > pageHeight * 0.58 || x2 > pageWidth * 0.74);
    return nearCorner || nearEdgeForMetadata;
  });
  if (!candidates.length) return null;

  const region = unionBoxes(candidates.map((line) => line.bbox));
  const bounded = [
    Math.max(pageWidth * 0.58, Math.max(0, region[0] - 8)),
    Math.max(pageHeight * 0.62, Math.max(0, region[1] - 8)),
    Math.min(pageWidth, region[2] + 8),
    Math.min(pageHeight, region[3] + 8),
  ];

  if (bounded[0] >= bounded[2] || bounded[1] >= bounded[3]) {
    return [pageWidth * 0.62, pageHeight * 0.68, pageWidth, pageHeight];
  }

  const regionAreaRatio = area(bounded) / Math.max(1, pageWidth * pageHeight);
  if (regionAreaRatio > 0.34) {
    return [pageWidth * 0.62, pageHeight * 0.68, pageWidth, pageHeight];
  }

  return bounded;
};

const isTitleBlockMetaCandidate = (line, titleBlockRegion = null) => {
  if (!titleBlockRegion || !inBox(line.bbox, titleBlockRegion)) return false;
  const text = (line.text || '').trim();
  if (!text) return false;
  const hasMetadataLabel = Object.values(METADATA_LABEL_PATTERNS).some((pattern) => pattern.test(text));
  const hasMetadataValue = TITLE_BLOCK_VALUE_PATTERNS.some((pattern) => pattern.test(text));
  return hasMetadataLabel || hasMetadataValue;
};

const segmentPageRegions = (lines, pageWidth, pageHeight) => {
  const titleBlockRegion = detectTitleBlockRegion(lines, pageWidth, pageHeight);
  const footerBandTop = pageHeight * 0.935;

  const notesLines = lines.filter((line) => /\b(general\s+notes?|key\s+notes?|notes?)\b/i.test(line.text) || /^\d+[\.)\-:]/.test(line.text));
  const tableLines = lines.filter((line) => /schedule|table|matrix/i.test(line.text));
  const legendLines = lines.filter((line) => /\blegend|abbreviations|symbols\b/i.test(line.text));
  const detailCaptionLines = lines.filter((line) => /\bdetail|section|elevation\b/i.test(line.text));

  const pageBorderRegion = [0, 0, pageWidth, pageHeight];
  const notesRegion = notesLines.length >= 3 ? unionBoxes(notesLines.map((line) => line.bbox)) : null;
  const tableRegion = tableLines.length >= 5 ? unionBoxes(tableLines.map((line) => line.bbox)) : null;
  const legendRegion = legendLines.length >= 2 ? unionBoxes(legendLines.map((line) => line.bbox)) : null;
  const detailCaptionRegion = detailCaptionLines.length >= 2 ? unionBoxes(detailCaptionLines.map((line) => line.bbox)) : null;

  const footerLines = lines.filter((line) => {
    const [, y1] = line.bbox;
    return y1 >= footerBandTop && (/\b(sheet|project|drawn|checked|date|revision|copyright)\b/i.test(line.text) || isFurnitureText(line.text));
  });
  const titleBlockMetaLines = lines.filter((line) => isTitleBlockMetaCandidate(line, titleBlockRegion));
  const furnitureLines = lines.filter((line) => titleBlockMetaLines.some((metaLine) => metaLine.id === line.id) || isFurnitureText(line.text));
  const borderMarkers = detectBorderMarkers(lines, pageWidth, pageHeight);
  const furnitureIds = new Set([...furnitureLines, ...borderMarkers, ...footerLines].map((line) => line.id));

  return {
    title_block_region: titleBlockRegion,
    page_border_region: pageBorderRegion,
    main_viewport_region: [0, 0, pageWidth, pageHeight],
    notes_region: notesRegion,
    table_region: tableRegion,
    legend_region: legendRegion,
    detail_caption_region: detailCaptionRegion,
    likelyTitleBlockSide: titleBlockRegion ? 'bottom_right' : 'unknown',
    furnitureIds,
    furniture: {
      titleBlockMeta: titleBlockMetaLines.map((line) => ({ text: line.text, bbox: line.bbox })),
      borderMarkers: borderMarkers.map((line) => ({ text: line.text, bbox: line.bbox })),
      footerLines: footerLines.map((line) => ({ text: line.text, bbox: line.bbox })),
      timestamps: lines.filter((line) => /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b.*\b\d{1,2}:\d{2}/.test(line.text)).map((line) => ({ text: line.text, bbox: line.bbox })),
      consultantInfo: lines.filter((line) => isFurnitureText(line.text) && !(titleBlockRegion && inBox(line.bbox, titleBlockRegion))).map((line) => ({ text: line.text, bbox: line.bbox })),
    },
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

const detectMetadataValueFromLabel = (titleLines, labelPattern) => {
  const labeledLine = titleLines.find((line) => labelPattern.test(line.text));
  if (!labeledLine) return null;
  const [, cy] = bboxCenter(labeledLine.bbox);
  const neighbor = titleLines
    .filter((line) => line.id !== labeledLine.id)
    .map((line) => {
      const [cx, y] = bboxCenter(line.bbox);
      const horizontal = cx - labeledLine.bbox[2];
      return { line, score: Math.abs(y - cy) + (horizontal < -6 ? 10000 : Math.abs(horizontal)) };
    })
    .sort((a, b) => a.score - b.score)[0];
  return neighbor?.line || null;
};

const containsDisclaimer = (value = '') => /contractor shall verify|reproduction or use|copyright reserved/i.test(value);
const containsFilePath = (value = '') => /[a-z]:\\|sheet_sets\\|\\[^\s]+/i.test(value);

const metadataValueGuard = (value, field) => {
  if (!value) return { ok: false, reason: `${field}_missing` };
  if (containsFilePath(value)) return { ok: false, reason: 'metadata_contains_file_path' };
  if (containsDisclaimer(value)) return { ok: false, reason: 'metadata_contains_disclaimer_text' };
  const longThreshold = field === 'scaleText' ? 80 : 140;
  if (value.length > longThreshold) return { ok: false, reason: `${field}_suspiciously_long` };
  if (field === 'scaleText' && !/(as shown|no scale|\d+\s*\/?\d*"\s*=\s*\d+'?-?\d*"?)/i.test(value)) {
    return { ok: false, reason: 'scale_text_invalid_pattern' };
  }
  return { ok: true };
};

const parseSheetNumber = (lines) => {
  const matchers = [/[A-Z]{1,2}\s*[-.]\s*\d{1,4}[A-Z]?/g, /\b[A-Z]\d{1,3}\b/g];
  for (const line of lines) {
    for (const matcher of matchers) {
      const hit = line.text.match(matcher)?.[0];
      if (hit) return hit.replace(/\s+/g, '').replace('.', '-').toUpperCase();
    }
  }
  return null;
};

const inferDisciplineFromSheetNumber = (sheetNumber) => {
  const prefix = (sheetNumber || '').match(/^([A-Z])/i)?.[1]?.toUpperCase();
  if (!prefix) return { discipline: 'unknown', confidence: 0 };
  return { discipline: DISCIPLINE_PREFIX_MAP[prefix] || 'unknown', confidence: DISCIPLINE_PREFIX_MAP[prefix] ? 0.92 : 0.2 };
};

const extractMetadata = (titleLines, fallbackDiscipline) => {
  const warnings = [];
  const sheetNumber = parseSheetNumber(titleLines);
  const inferred = inferDisciplineFromSheetNumber(sheetNumber);
  const labeledSheetTitle = detectMetadataValueFromLabel(titleLines, METADATA_LABEL_PATTERNS.sheetTitle)?.text || null;
  const titleCandidate = labeledSheetTitle || titleLines
    .filter((line) => /(plan|notes|details?|schedule|legend|section|map|vicinity)/i.test(line.text) && !METADATA_LABEL_PATTERNS.sheetTitle.test(line.text))
    .sort((a, b) => b.avgFontSize - a.avgFontSize)[0]?.text || null;

  const scaleCandidate = detectMetadataValueFromLabel(titleLines, METADATA_LABEL_PATTERNS.scaleText)?.text
    || titleLines.find((line) => /(as shown|no scale|"\s*=\s*\d+'?)/i.test(line.text))?.text
    || null;

  const issueCandidate = detectMetadataValueFromLabel(titleLines, METADATA_LABEL_PATTERNS.issueStatus)?.text
    || titleLines.find((line) => /(for permitting|not for construction|\b\d{2,3}%\b|for bid)/i.test(line.text))?.text
    || null;

  const dateCandidate = detectMetadataValueFromLabel(titleLines, METADATA_LABEL_PATTERNS.date)?.text
    || titleLines.find((line) => /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(line.text))?.text
    || null;

  const guards = {
    sheetTitle: metadataValueGuard(titleCandidate, 'sheetTitle'),
    scaleText: metadataValueGuard(scaleCandidate, 'scaleText'),
    issueStatus: issueCandidate ? metadataValueGuard(issueCandidate, 'issueStatus') : { ok: false, reason: 'issueStatus_missing' },
  };

  Object.values(guards).forEach((guard) => {
    if (!guard.ok && !warnings.includes(guard.reason)) warnings.push(guard.reason);
  });

  const evidenceScores = scoreDisciplineEvidence(titleLines);
  const strongestContent = evidenceScores[0] || { discipline: 'unknown', score: 0 };
  let discipline = inferred.confidence >= 0.85 ? inferred.discipline : fallbackDiscipline;
  if (inferred.discipline === 'civil' && strongestContent.discipline !== 'civil' && strongestContent.score >= 4) {
    discipline = strongestContent.discipline;
  } else if (inferred.discipline !== 'unknown') {
    discipline = inferred.discipline;
  }
  const confidence = clamp01(
    (sheetNumber ? 0.38 : 0)
    + (guards.sheetTitle.ok ? 0.22 : 0)
    + (guards.scaleText.ok ? 0.16 : 0)
    + (guards.issueStatus.ok ? 0.12 : 0)
    + (dateCandidate ? 0.06 : 0)
    + (inferred.confidence > 0.8 ? 0.08 : 0)
    - warnings.length * 0.08,
  );

  if (!sheetNumber && confidence < 0.45) warnings.push('low_metadata_confidence');

  return {
    sheetNumber,
    sheetTitle: guards.sheetTitle.ok ? titleCandidate : null,
    discipline,
    scaleText: guards.scaleText.ok ? scaleCandidate : null,
    issueStatus: guards.issueStatus.ok ? issueCandidate : null,
    date: dateCandidate,
    confidence,
    warnings,
  };
};

const parseNotesBlock = (lines, bbox, regions) => {
  if (!bbox) return null;
  const noteLines = lines.filter((line) => inBox(line.bbox, bbox)).sort((a, b) => a.bbox[1] - b.bbox[1]);
  if (noteLines.length < 3) return null;

  const heading = noteLines.find((line) => /^\s*(general\s+notes?|key\s+notes?)\s*:?\s*$/i.test(line.text));
  const numbered = noteLines.filter((line) => /^\d+[\.)\-:]/.test(line.text));
  if (!heading || numbered.length < 2) return null;

  const contaminated = noteLines.some((line) => regions.title_block_region && inBox(line.bbox, regions.title_block_region));
  if (contaminated) return null;

  const items = [];
  let current = null;
  noteLines.forEach((line) => {
    const match = line.text.match(/^(\d+)[\.)\-:]\s*(.*)$/);
    if (match) {
      if (current) items.push(current);
      current = { number: match[1], text: match[2] || '' };
      return;
    }
    if (current) current.text = normalizeText(`${current.text} ${line.text}`);
  });
  if (current) items.push(current);

  const numbers = items.map((item) => Number(item.number)).filter((value) => Number.isFinite(value));
  const ordered = numbers.length >= 2 && numbers[0] === 1 && numbers.every((value, idx) => idx === 0 || value === numbers[idx - 1] + 1);
  if (!ordered) return null;
  return {
    type: 'notes_block',
    title: heading.text,
    items,
    bbox,
    source: 'native_pdf_text',
    confidence: clamp01(0.58 + Math.min(0.2, items.length * 0.03)),
  };
};

const detectTable = (lines, bbox) => {
  if (!bbox) return { block: null, warning: null };
  const tableLines = lines.filter((line) => inBox(line.bbox, bbox));
  if (tableLines.length < 4) return { block: null, warning: null };

  const rows = tableLines
    .map((line) => ({ line, cells: line.words, y: (line.bbox[1] + line.bbox[3]) / 2 }))
    .filter((row) => row.cells.length >= 2)
    .sort((a, b) => a.y - b.y);

  if (rows.length < 2) return { block: null, warning: 'table_validation_failed' };

  const hasScheduleTitle = tableLines.some((line) => /schedule|table|matrix/i.test(line.text));
  const cellCountSet = new Set(rows.map((row) => row.cells.length));
  const strongGridByColumns = rows.length >= 4 && cellCountSet.size <= 2 && Math.max(...cellCountSet) >= 3;
  const firstCellXs = rows.map((row) => row.line.bbox[0]);
  const avgFirstX = firstCellXs.reduce((sum, value) => sum + value, 0) / Math.max(1, firstCellXs.length);
  const stableFirstColumn = firstCellXs.filter((value) => Math.abs(value - avgFirstX) <= 8).length >= Math.ceil(firstCellXs.length * 0.75);
  const strongGridEvidence = strongGridByColumns && stableFirstColumn;
  const rowHeights = rows.map((row) => row.line.bbox[3] - row.line.bbox[1]);
  const avgHeight = rowHeights.reduce((sum, h) => sum + h, 0) / Math.max(1, rowHeights.length);
  const stableHeights = rowHeights.filter((h) => Math.abs(h - avgHeight) < Math.max(3, avgHeight * 0.7)).length >= Math.ceil(rows.length * 0.6);
  const columnCount = Math.round(rows.reduce((sum, row) => sum + row.cells.length, 0) / rows.length);

  const strongEvidence = [hasScheduleTitle, stableHeights, columnCount > 1, rows.length > 2, strongGridEvidence].filter(Boolean).length;
  if (strongEvidence < 4 || !strongGridEvidence) return { block: null, warning: 'table_validation_failed' };

  const columns = Array.from({ length: columnCount }, (_, i) => ({ name: rows[0].cells[i] || `Column ${i + 1}` }));
  const dataRows = rows.slice(1).map((row) => {
    const payload = {};
    columns.forEach((col, idx) => {
      payload[col.name] = row.cells[idx] || '';
    });
    return payload;
  });

  if (dataRows.length < 1 || columns.length < 2) return { block: null, warning: 'table_validation_failed' };

  return {
    block: {
      type: 'table',
      tableRole: 'schedule',
      title: tableLines.find((line) => /schedule|table/i.test(line.text))?.text || 'Schedule',
      bbox,
      columns,
      rows: dataRows,
      source: 'native_pdf_text',
      confidence: clamp01(0.62 + Math.min(0.2, dataRows.length * 0.03)),
    },
    warning: null,
  };
};

const isEquipmentLike = (text = '', discipline = 'unknown') => {
  const hasTagPattern = /\b(?:P|V|F|AHU|RTU|M|XFMR|PMP)-\d{1,4}[A-Z]?\b/i.test(text);
  const looksLikeSheetRef = /\b[A-Z]-\d{1,4}[A-Z]?\b/.test(text);
  const engineeringNouns = /\b(pump|valve|fan|ahu|rtu|compressor|boiler|chiller|panel|transformer|motor)\b/i.test(text);
  const disciplineCompat = discipline === 'mechanical' || discipline === 'electrical' || discipline === 'plumbing' || discipline === 'instrumentation';
  return !looksLikeSheetRef && (hasTagPattern || (engineeringNouns && disciplineCompat));
};

const parseTakeoff = (text = '') => {
  const actionMatch = text.match(/^\s*(CONSTRUCT|INSTALL|REMOVE|REPLACE|ABANDON|DEMO|PROVIDE)\b/i);
  const quantityMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(LF|SF|CY|EA|TON|SY|FT|IN)\b/i);
  const nominalSizeMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(IN|"|MM)\b/i);
  const tail = text
    .replace(actionMatch?.[0] || '', '')
    .replace(quantityMatch?.[0] || '', '')
    .replace(nominalSizeMatch?.[0] || '', '')
    .replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, '')
    .trim();
  return {
    action: actionMatch ? actionMatch[1].toUpperCase() : null,
    quantity: quantityMatch ? Number(quantityMatch[1]) : null,
    quantityUnit: quantityMatch ? quantityMatch[2].toUpperCase().replace('FT', 'LF').replace('"', 'IN') : null,
    nominalSizes: nominalSizeMatch ? [`${nominalSizeMatch[1]} ${nominalSizeMatch[2] === '"' ? 'in' : nominalSizeMatch[2].toLowerCase()}`] : [],
    materialOrSystem: tail || null,
  };
};

const classifyLineSemantic = (line, regions, discipline) => {
  if (regions.furnitureIds?.has(line.id)) return 'sheet_furniture_label';
  if (regions.title_block_region && inBox(line.bbox, regions.title_block_region)) return 'title_block_meta';

  const text = line.text || '';
  if (/^[A-H]$|^\d{1,2}$/.test(text.trim())) return 'border_marker';
  if (/\b(canada|pacific ocean|atlantic ocean|united states|mexico|city of)\b/i.test(text)) return 'map_label';
  if (/\b\d+\s*[\/-]\s*[A-Z]-?\d+\b/i.test(text)) return 'detail_reference';
  if (/\b[A-Z]-\d{1,4}[A-Z]?\b/.test(text)) return 'sheet_reference';
  if (/\b(see|typ\.?|match existing|ref\.?|note\s*\d+|section|electrical|plumbing|mechanical)\b/i.test(text)) return 'reference_annotation';
  if (/\b\d+\s*'\s*-?\s*\d*\s*"|\b\d+\s*"\s*(dia|ø)?|\bR\s*\d+/i.test(text)) return 'dimension';
  if (/\blegend\b/i.test(text)) return 'legend_block';
  if (/\b(detail|section)\b/i.test(text)) return 'detail_label';
  if (/\b(room|area|corridor|building|plan|section|elevation)\b/i.test(text)) return 'viewport_label';
  if (isEquipmentLike(text, discipline)) return 'equipment_label';
  return 'general_annotation';
};

const classifyLineBlocks = (lines, regions, consumedLineIds = new Set(), discipline = 'unknown') => lines
  .filter((line) => !consumedLineIds.has(line.id) && !regions.furnitureIds?.has(line.id))
  .map((line) => {
    const type = classifyLineSemantic(line, regions, discipline);
    const block = {
      type,
      text: line.text,
      bbox: line.bbox,
      source: line.atoms.some((atom) => atom.source === 'ocr_raster_region') ? 'ocr_raster_region' : 'native_pdf_text',
      confidence: ['general_annotation', 'viewport_label', 'map_label'].includes(type) ? 0.64 : 0.78,
    };

    if (type === 'dimension') {
      const takeoff = parseTakeoff(line.text);
      if (takeoff.action || takeoff.quantity || takeoff.nominalSizes?.length) {
        block.type = 'takeoff_candidate';
        block.action = takeoff.action;
        block.quantity = takeoff.quantity;
        block.quantityUnit = takeoff.quantityUnit;
        block.nominalSizes = takeoff.nominalSizes || [];
        block.materialOrSystem = takeoff.materialOrSystem;
        block.references = [];
        block.confidence = 0.8;
      } else {
        block.takeoff = takeoff;
      }
      block.context = /gate/i.test(line.text) ? 'fence_gate' : 'drawing';
    }

    if (type === 'detail_reference' || type === 'sheet_reference' || type === 'reference_annotation') {
      const detail = line.text.match(/(\d+)\s*[\/-]\s*([A-Z]-?\d+)/i);
      if (detail) {
        block.referenceType = 'detail_reference';
        block.detailNumber = detail[1];
        block.targetSheet = detail[2].toUpperCase();
      } else if (type === 'reference_annotation') {
        block.referenceType = 'reference_annotation';
        block.targetSheet = null;
      } else {
        block.referenceType = 'sheet_reference';
        block.targetSheet = (line.text.match(/\b([A-Z]-\d{1,4}[A-Z]?)\b/i)?.[1] || '').toUpperCase() || null;
      }
    }

    return block;
  });

const classifySheetType = (lines, sheetMeta = null) => {
  const head = lines.slice(0, 120).map((line) => line.text.toLowerCase()).join(' ');
  const metaTitle = (sheetMeta?.sheetTitle || '').toLowerCase();
  const text = `${head} ${metaTitle}`;

  if (/vicinity map|location map/.test(text)) return 'cover_map_general';
  if (/key notes|general notes/.test(text)) return 'notes_sheet';
  if (/legend|abbreviations|symbols/.test(text)) return 'legend_sheet';
  if (/schedule/.test(text)) return 'schedule_sheet';
  if (/section/.test(text)) return 'section_sheet';
  if (/plan/.test(text)) return 'plan_sheet';
  return 'detail_sheet';
};

const runValidations = (pageOutput, invalidLines = []) => {
  const warnings = [...(pageOutput.sheetMeta?.warnings || [])];
  const allText = pageOutput.blocks.map((block) => block.text || '').join(' ');

  if (detectCharacterSoup(allText)) warnings.push('character_soup_detected');
  if (invalidLines.length) warnings.push('negative_bbox_detected');
  if (pageOutput.blocks.some((block) => block.type === 'equipment_label' && /\b(canada|ocean|mexico|city)\b/i.test(block.text || ''))) {
    warnings.push('border_markers_promoted_to_content');
  }
  if (pageOutput.blocks.some((block) => block.type === 'table' && (!block.rows || block.rows.length < 1 || block.columns.length < 2))) {
    warnings.push('table_validation_failed');
  }
  if (pageOutput.blocks.some((block) => block.type === 'notes_block' && block.items?.length <= 1)) warnings.push('notes_region_contaminated_by_viewport_text');

  const prefixDiscipline = inferDisciplineFromSheetNumber(pageOutput.sheetMeta?.sheetNumber).discipline;
  if (prefixDiscipline !== 'unknown' && pageOutput.sheetMeta?.discipline && prefixDiscipline !== pageOutput.sheetMeta.discipline) {
    warnings.push('discipline_mismatch_with_sheet_prefix');
  }

  if (!pageOutput.regions?.title_block_region) warnings.push('title_block_not_isolated');
  if ((pageOutput.sheetMeta?.confidence || 0) < 0.45) warnings.push('low_metadata_confidence');

  return [...new Set(warnings)];
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

const buildPageDiagnostics = async (page, textItems, pageNumber = 1) => {
  const viewport = page.getViewport({ scale: 1 });
  const nativeAtoms = extractNativeTextAtoms(textItems, viewport.height);
  const nativeArea = nativeAtoms.reduce((sum, atom) => sum + area(atom.bbox), 0);
  const pageArea = Math.max(1, viewport.width * viewport.height);
  const imageCoverageRatio = await estimateImageCoverage(page);
  const nativeTextDensity = clamp01(nativeArea / pageArea);
  const hasNativeText = nativeAtoms.length > 0;
  const hasRasterRegions = imageCoverageRatio > 0.06 || !hasNativeText;
  const lineProxies = groupAtomsIntoLines(nativeAtoms);
  const regions = segmentPageRegions(lineProxies, viewport.width, viewport.height);
  const guessedSheetNumber = parseSheetNumber(lineProxies.filter((line) => regions.title_block_region && inBox(line.bbox, regions.title_block_region)));

  return {
    pageNumber,
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    hasNativeText,
    hasRasterRegions,
    nativeTextDensity,
    imageCoverageRatio,
    likelyTitleBlockSide: regions.likelyTitleBlockSide,
    likelyBorderMarkers: regions.furniture.borderMarkers.length,
    likelyDisciplineByPrefix: inferDisciplineFromSheetNumber(guessedSheetNumber).discipline,
    likelySheetType: classifySheetType(lineProxies),
    suspectedDiscipline: classifyDiscipline(lineProxies),
  };
};

const composePageResult = (pageNumber, lines, regions, pageDiagnostics, sourceSelection, invalidLines = []) => {
  const notesBlock = parseNotesBlock(lines, regions.notes_region, regions);
  const tableResult = detectTable(lines, regions.table_region);
  const consumed = new Set();
  const blocks = [];

  if (notesBlock) {
    blocks.push(notesBlock);
    lines.filter((line) => inBox(line.bbox, notesBlock.bbox)).forEach((line) => consumed.add(line.id));
  }

  if (tableResult.block) {
    blocks.push(tableResult.block);
    lines.filter((line) => inBox(line.bbox, tableResult.block.bbox)).forEach((line) => consumed.add(line.id));
  }

  const metaLines = lines.filter((line) => isTitleBlockMetaCandidate(line, regions.title_block_region));
  const sheetMeta = extractMetadata(metaLines, pageDiagnostics.suspectedDiscipline);
  if (tableResult.warning && !sheetMeta.warnings.includes(tableResult.warning)) sheetMeta.warnings.push(tableResult.warning);

  const semanticLines = lines.filter((line) => !regions.furnitureIds?.has(line.id));
  blocks.push(...classifyLineBlocks(semanticLines, regions, consumed, sheetMeta.discipline));

  const pageOutput = {
    pageNumber,
    sheetMeta,
    pageDiagnostics: {
      pageNumber,
      pageWidth: pageDiagnostics.pageWidth,
      pageHeight: pageDiagnostics.pageHeight,
      hasNativeText: pageDiagnostics.hasNativeText,
      hasRasterRegions: pageDiagnostics.hasRasterRegions,
      nativeTextDensity: pageDiagnostics.nativeTextDensity,
      imageCoverageRatio: pageDiagnostics.imageCoverageRatio,
      likelyTitleBlockSide: pageDiagnostics.likelyTitleBlockSide,
      likelyBorderMarkers: pageDiagnostics.likelyBorderMarkers,
      likelyDisciplineByPrefix: pageDiagnostics.likelyDisciplineByPrefix,
      likelySheetType: classifySheetType(lines, sheetMeta),
      sourceSelection,
    },
    regions,
    pageFurniture: regions.furniture,
    blocks,
    validationWarnings: [],
  };

  pageOutput.validationWarnings = runValidations(pageOutput, invalidLines);
  return pageOutput;
};


const extractRegionWithFallbackOCR = async (docHandle, pageIndex, region, nativeAtoms, ocrWorker) => {
  const overlapNative = nativeAtoms.filter((atom) => iou(atom.bbox, region) > 0.2 && (atom.text || '').trim());
  if (overlapNative.length >= 2) return overlapNative;

  const page = await docHandle.getPage(pageIndex + 1);
  const { canvas } = await renderPageToCanvas(page, 2);
  const ctx = canvas.getContext('2d');
  const [x1, y1, x2, y2] = region;
  const crop = ctx.getImageData(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
  const temp = document.createElement('canvas');
  temp.width = crop.width;
  temp.height = crop.height;
  temp.getContext('2d').putImageData(crop, 0, 0);

  const { data } = await ocrWorker.recognize(temp);
  const ocrAtoms = (data?.lines || []).map((line, index) => ({
    id: `ocr-region-${pageIndex}-${index}`,
    text: normalizeText(line.text),
    bbox: [x1 + line.bbox.x0, y1 + line.bbox.y0, x1 + line.bbox.x1, y1 + line.bbox.y1],
    rotation: 0,
    fontName: null,
    fontSize: Math.max(8, line.bbox.y1 - line.bbox.y0),
    source: 'ocr_raster_region',
    confidence: line.confidence ? line.confidence / 100 : 0.65,
  })).filter((atom) => atom.text);

  return dedupeOverlappingTextAtoms([...overlapNative, ...ocrAtoms]).deduped;
};

const extractRasterPage = async (page, pageNumber, pageDiagnostics, ocrWorker) => {
  const { canvas, viewport } = await renderPageToCanvas(page, 2);
  const { data } = await ocrWorker.recognize(canvas);
  const ocrLinesRaw = (data?.lines || []).map((line, index) => ({
    id: `ocr-line-${index}`,
    text: normalizeText(line.text),
    bbox: [line.bbox.x0, line.bbox.y0, line.bbox.x1, line.bbox.y1],
    words: normalizeText(line.text).split(' ').filter(Boolean),
    atoms: [{ source: 'ocr_raster_region' }],
    avgFontSize: Math.max(8, line.bbox.y1 - line.bbox.y0),
    rotation: 0,
  })).filter((line) => line.text && !detectCharacterSoup(line.text));

  const { normalized: ocrLines, invalid } = normalizeLineCoordinates(ocrLinesRaw, viewport.width, viewport.height);
  const regions = segmentPageRegions(ocrLines, viewport.width, viewport.height);
  const pageOutput = composePageResult(pageNumber, ocrLines, regions, pageDiagnostics, 'ocr_raster_region', invalid);

  return {
    pageOutput,
    debug: {
      canvas,
      dedupedAtoms: [],
      droppedAtoms: [],
      lines: ocrLines,
      invalidLines: invalid,
      regions,
      blocks: pageOutput.blocks,
      pageBounds: [0, 0, viewport.width, viewport.height],
      furniture: regions.furniture,
    },
  };
};

const extractVectorPage = async (page, pageNumber, pageDiagnostics, engineId = ENGINE_IDS.CURRENT, adapter = null, doc = null) => {
  const rawAtoms = adapter && doc
    ? await adapter.extractTextAtoms(doc, pageNumber - 1)
    : extractNativeTextAtoms((await page.getTextContent()).items || [], pageDiagnostics.pageHeight);
  const { deduped: dedupedAtoms, dropped: droppedAtoms } = dedupeOverlappingTextAtoms(rawAtoms);
  const rawLines = groupAtomsIntoLines(dedupedAtoms);
  const { normalized: lines, invalid } = normalizeLineCoordinates(rawLines, pageDiagnostics.pageWidth, pageDiagnostics.pageHeight, engineId);
  const regions = segmentPageRegions(lines, pageDiagnostics.pageWidth, pageDiagnostics.pageHeight);
  const pageOutput = composePageResult(pageNumber, lines, regions, pageDiagnostics, 'native_pdf_text', invalid);

  const { canvas } = await renderPageToCanvas(page, 1);
  return {
    pageOutput,
    debug: {
      canvas,
      dedupedAtoms,
      droppedAtoms,
      lines,
      invalidLines: invalid,
      regions,
      blocks: pageOutput.blocks,
      pageBounds: [0, 0, pageDiagnostics.pageWidth, pageDiagnostics.pageHeight],
      furniture: regions.furniture,
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

  drawBox(ctx, debugData.pageBounds, 'rgba(255,255,255,0.8)', 1, 'page_bounds');
  debugData.dedupedAtoms.forEach((atom) => drawBox(ctx, atom.bbox, 'rgba(56,189,248,0.7)', 0.7));
  debugData.lines.forEach((line) => drawBox(ctx, line.bbox, 'rgba(250,204,21,0.45)', 1));

  drawBox(ctx, debugData.regions.title_block_region, 'rgba(59,130,246,0.9)', 1.8, 'title_block');
  drawBox(ctx, debugData.regions.notes_region, 'rgba(34,197,94,0.9)', 1.8, 'notes_region');
  drawBox(ctx, debugData.regions.table_region, 'rgba(168,85,247,0.9)', 1.8, 'table_region');
  drawBox(ctx, debugData.regions.main_viewport_region, 'rgba(148,163,184,0.5)', 1.2, 'viewport');

  (debugData.furniture?.borderMarkers || []).forEach((item) => drawBox(ctx, item.bbox, 'rgba(156,163,175,0.85)', 1.1, 'furniture'));
  debugData.invalidLines.forEach((line) => drawBox(ctx, line.bbox, 'rgba(239,68,68,0.95)', 2, 'invalid bbox'));

  debugData.blocks.forEach((block) => {
    if (block.confidence < 0.7) drawBox(ctx, block.bbox, 'rgba(249,115,22,0.9)', 1.6, 'low confidence');
  });

  wrapper.appendChild(canvas);
  debugContainer.appendChild(wrapper);
};

const processPdf = async (file) => {
  const bytes = await file.arrayBuffer();
  const selectedEngine = engineModeInput?.value || ENGINE_IDS.CURRENT;
  const adapter = createEngineAdapter(selectedEngine, pdfjsLib);
  const pdf = await adapter.loadDocument(bytes);
  const pages = [];
  const bakeoff = Boolean(bakeoffModeInput?.checked);
  const bakeoffScores = [];
  let ocrWorker = null;

  if (debugContainer) debugContainer.innerHTML = '';

  const pageCount = adapter.getPageCount(pdf);
  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageDiagnostics = await buildPageDiagnostics(page, textContent.items || [], pageNum);

    updateStatus(`Inspecting and processing page ${pageNum} of ${pageCount}`, ((pageNum - 1) / pageCount) * 100);

    let result;
    if (!pageDiagnostics.hasNativeText) {
      if (!ocrWorker) {
        updateStatus('Initializing OCR worker...', ((pageNum - 1) / pageCount) * 100);
        ocrWorker = await createOcrWorker();
      }
      result = await extractRasterPage(page, pageNum, pageDiagnostics, ocrWorker);
    } else {
      result = await extractVectorPage(page, pageNum, pageDiagnostics, selectedEngine, adapter, pdf);
    }

    pages.push(result.pageOutput);
    const totalBlocks = Math.max(1, result.pageOutput.blocks.length);
    const invalidCount = result.pageOutput.blocks.filter((block) => !block.bbox || block.bbox[0] >= block.bbox[2] || block.bbox[1] >= block.bbox[3]).length;
    bakeoffScores.push({
      pageIndex: pageNum - 1,
      engine: selectedEngine,
      validBBoxRate: 1 - (invalidCount / totalBlocks),
      duplicateAtomRate: 0,
      suspiciousMergeRate: result.pageOutput.validationWarnings?.includes('character_soup_detected') ? 1 : 0,
      titleBlockLeakageScore: result.pageOutput.validationWarnings?.includes('title_block_not_isolated') ? 1 : 0,
      furnitureLeakageScore: result.pageOutput.validationWarnings?.includes('border_markers_promoted_to_content') ? 1 : 0,
      notesFalsePositiveScore: result.pageOutput.validationWarnings?.includes('notes_region_contaminated_by_viewport_text') ? 1 : 0,
      tableFalsePositiveScore: result.pageOutput.validationWarnings?.includes('table_validation_failed') ? 1 : 0,
      overall: Math.max(0, 1 - (invalidCount / totalBlocks)),
    });
    renderDebugOverlay(pageNum, result.debug);
    updateStatus(`Finished page ${pageNum} of ${pageCount}`, (pageNum / pageCount) * 100);
  }

  if (ocrWorker) await ocrWorker.terminate();

  return {
    filename: file.name,
    extractedAt: new Date().toISOString(),
    engine: selectedEngine,
    bakeoffEnabled: bakeoff,
    bakeoffScores,
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
