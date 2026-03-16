import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/+esm';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs';

const pdfInput = document.getElementById('pdfFile');
const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const statusProgress = document.getElementById('statusProgress');
const output = document.getElementById('jsonOutput');

let latestJson = null;

const updateStatus = (message, progress = null) => {
  statusText.textContent = message;
  if (typeof progress === 'number') {
    statusProgress.value = Math.max(0, Math.min(100, progress));
  }
};

const unionBoxes = (boxes) => {
  if (!boxes.length) return [0, 0, 0, 0];
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
};

const extractCharacters = (textItems) => {
  const chars = [];
  for (const item of textItems) {
    if (!item.str) continue;
    const glyphs = [...item.str];
    const charWidth = Math.max(0.5, (item.width || glyphs.length) / Math.max(1, glyphs.length));
    const xStart = item.transform[4] || 0;
    const yBase = item.transform[5] || 0;
    const fontSize = Math.max(6, Math.hypot(item.transform[0] || 0, item.transform[1] || 0));

    glyphs.forEach((char, index) => {
      const x = xStart + index * charWidth;
      chars.push({
        char,
        x,
        y: yBase,
        fontName: item.fontName || 'unknown',
        fontSize,
        box: [x, yBase - fontSize, x + charWidth, yBase],
      });
    });
  }
  return chars;
};

const groupIntoLines = (chars) => {
  const sorted = [...chars].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];

  for (const char of sorted) {
    const match = lines.find((line) => Math.abs(line.y - char.y) <= Math.max(2.5, line.avgFontSize * 0.45));
    if (!match) {
      lines.push({
        y: char.y,
        chars: [char],
        avgFontSize: char.fontSize,
      });
      continue;
    }

    match.chars.push(char);
    match.y = (match.y * (match.chars.length - 1) + char.y) / match.chars.length;
    match.avgFontSize = (match.avgFontSize * (match.chars.length - 1) + char.fontSize) / match.chars.length;
  }

  return lines
    .map((line) => {
      const ordered = line.chars.sort((a, b) => a.x - b.x);
      const text = ordered.map((char, index) => {
        if (!index) return char.char;
        const prev = ordered[index - 1];
        const gap = char.x - prev.box[2];
        return `${gap > Math.max(2, line.avgFontSize * 0.35) ? ' ' : ''}${char.char}`;
      }).join('');

      return {
        text: text.replace(/\s+/g, ' ').trim(),
        y: line.y,
        avgFontSize: line.avgFontSize,
        chars: ordered,
        box: unionBoxes(ordered.map((char) => char.box)),
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => b.y - a.y);
};

const detectTableRows = (lines) => {
  const tokenizedLines = lines.map((line, lineIndex) => {
    const tokens = [];
    let current = [line.chars[0]];

    for (let i = 1; i < line.chars.length; i += 1) {
      const prev = line.chars[i - 1];
      const currentChar = line.chars[i];
      const gap = currentChar.x - prev.box[2];
      if (gap > Math.max(8, line.avgFontSize * 0.85)) {
        tokens.push(current);
        current = [currentChar];
      } else {
        current.push(currentChar);
      }
    }
    tokens.push(current);

    const cells = tokens
      .map((group) => ({
        text: group.map((char) => char.char).join('').trim(),
        x: group[0].x,
        box: unionBoxes(group.map((char) => char.box)),
      }))
      .filter((cell) => cell.text);

    return { lineIndex, cells, y: line.y, box: line.box };
  });

  const candidateRows = tokenizedLines.filter((line) => line.cells.length >= 3);
  if (candidateRows.length < 2) return { tableBlocks: [], consumedLineIndexes: new Set() };

  const columnAnchors = new Map();
  candidateRows.forEach((row) => {
    row.cells.forEach((cell) => {
      const bucket = Math.round(cell.x / 14) * 14;
      columnAnchors.set(bucket, (columnAnchors.get(bucket) || 0) + 1);
    });
  });

  const stableColumns = [...columnAnchors.entries()]
    .filter(([, count]) => count >= 2)
    .map(([bucket]) => bucket)
    .sort((a, b) => a - b);

  if (stableColumns.length < 2) return { tableBlocks: [], consumedLineIndexes: new Set() };

  const alignedRows = candidateRows.filter((row) => {
    const hits = row.cells.filter((cell) => stableColumns.some((col) => Math.abs(col - cell.x) <= 16)).length;
    return hits >= 2;
  });

  if (alignedRows.length < 2) return { tableBlocks: [], consumedLineIndexes: new Set() };

  const tableText = alignedRows
    .map((row) => row.cells.map((cell) => cell.text).join(' | '))
    .join('\n');

  return {
    tableBlocks: [{
      type: 'table',
      text: tableText,
      box: unionBoxes(alignedRows.map((row) => row.box)),
    }],
    consumedLineIndexes: new Set(alignedRows.map((row) => row.lineIndex)),
  };
};

const buildTextBlocks = (lines, consumedLineIndexes) => {
  const blocks = [];
  let current = null;

  lines.forEach((line, index) => {
    if (consumedLineIndexes.has(index)) return;

    if (!current) {
      current = { lines: [line], box: line.box };
      return;
    }

    const prev = current.lines[current.lines.length - 1];
    const verticalGap = prev.box[1] - line.box[3];
    const fontShift = Math.abs(prev.avgFontSize - line.avgFontSize);

    if (verticalGap <= Math.max(18, prev.avgFontSize * 1.4) && fontShift <= Math.max(3, prev.avgFontSize * 0.5)) {
      current.lines.push(line);
      current.box = unionBoxes([current.box, line.box]);
    } else {
      blocks.push({
        type: 'text',
        text: current.lines.map((entry) => entry.text).join('\n'),
        box: current.box,
      });
      current = { lines: [line], box: line.box };
    }
  });

  if (current) {
    blocks.push({
      type: 'text',
      text: current.lines.map((entry) => entry.text).join('\n'),
      box: current.box,
    });
  }

  return blocks;
};

const renderPageToCanvas = async (page, scale = 2) => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return { canvas, viewport };
};

const createOcrWorker = async () => {
  const worker = await createWorker('eng', 1, {
    logger: ({ progress }) => {
      if (typeof progress === 'number') {
        updateStatus(`Running OCR... ${Math.round(progress * 100)}%`);
      }
    },
  });
  return worker;
};

const extractRasterPage = async (page, pageNumber, ocrWorker) => {
  const { canvas, viewport } = await renderPageToCanvas(page, 2);
  const {
    data: { text: ocrText },
  } = await ocrWorker.recognize(canvas);

  return {
    pageNumber,
    contentBlocks: [
      {
        type: 'image',
        text: 'Raster page content',
        box: [0, 0, viewport.width, viewport.height],
      },
      {
        type: 'text',
        text: (ocrText || '').trim(),
        box: [0, 0, viewport.width, viewport.height],
      },
    ],
  };
};

const extractVectorPage = async (page, pageNumber) => {
  const textContent = await page.getTextContent();
  const chars = extractCharacters(textContent.items || []);
  const lines = groupIntoLines(chars);
  const { tableBlocks, consumedLineIndexes } = detectTableRows(lines);
  const textBlocks = buildTextBlocks(lines, consumedLineIndexes);

  return {
    pageNumber,
    contentBlocks: [...tableBlocks, ...textBlocks],
  };
};

const processPdf = async (file) => {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  let ocrWorker = null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const isRasterLike = (textContent.items || []).length < 8;

    updateStatus(`Processing page ${pageNum} of ${pdf.numPages}`, ((pageNum - 1) / pdf.numPages) * 100);

    if (isRasterLike) {
      if (!ocrWorker) {
        updateStatus('Initializing OCR worker...', ((pageNum - 1) / pdf.numPages) * 100);
        ocrWorker = await createOcrWorker();
      }
      pages.push(await extractRasterPage(page, pageNum, ocrWorker));
    } else {
      pages.push(await extractVectorPage(page, pageNum));
    }

    updateStatus(`Finished page ${pageNum} of ${pdf.numPages}`, (pageNum / pdf.numPages) * 100);
  }

  if (ocrWorker) {
    await ocrWorker.terminate();
  }

  return {
    filename: file.name,
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
