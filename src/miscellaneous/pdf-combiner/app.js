const { PDFDocument } = window.PDFLib || {};

const pdfInput = document.getElementById('pdfInput');
const combineBtn = document.getElementById('combineBtn');
const clearBtn = document.getElementById('clearBtn');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const statusText = document.getElementById('statusText');
const statusProgress = document.getElementById('statusProgress');
const dropZone = document.getElementById('dropZone');

/** @type {File[]} */
let queuedFiles = [];

if (!PDFDocument) {
  statusText.textContent = 'Could not load PDF engine. Check your internet connection and reload.';
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const updateControls = () => {
  const totalSize = queuedFiles.reduce((sum, file) => sum + file.size, 0);
  fileCount.textContent = `${queuedFiles.length} file${queuedFiles.length === 1 ? '' : 's'} • ${formatFileSize(totalSize)}`;
  combineBtn.disabled = queuedFiles.length === 0 || !PDFDocument;
  clearBtn.disabled = queuedFiles.length === 0;
};

const renderList = () => {
  fileList.innerHTML = '';

  queuedFiles.forEach((file, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'file-item';

    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = `${index + 1}. ${file.name} (${formatFileSize(file.size)})`;

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '↑';
    upBtn.title = 'Move up';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      [queuedFiles[index - 1], queuedFiles[index]] = [queuedFiles[index], queuedFiles[index - 1]];
      renderList();
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '↓';
    downBtn.title = 'Move down';
    downBtn.disabled = index === queuedFiles.length - 1;
    downBtn.addEventListener('click', () => {
      [queuedFiles[index], queuedFiles[index + 1]] = [queuedFiles[index + 1], queuedFiles[index]];
      renderList();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      queuedFiles = queuedFiles.filter((_, queuedIndex) => queuedIndex !== index);
      renderList();
      updateControls();

      if (queuedFiles.length === 0) {
        statusText.textContent = 'No PDF files loaded yet.';
        statusProgress.value = 0;
      }
    });

    actions.append(upBtn, downBtn, removeBtn);
    listItem.append(fileName, actions);
    fileList.appendChild(listItem);
  });

  updateControls();
};

const pushFiles = (files) => {
  const validPdfFiles = Array.from(files).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

  if (validPdfFiles.length === 0) {
    statusText.textContent = 'No valid PDF files were detected.';
    return;
  }

  queuedFiles.push(...validPdfFiles);
  renderList();
  statusText.textContent = `Loaded ${validPdfFiles.length} PDF file${validPdfFiles.length === 1 ? '' : 's'}.`;
};

pdfInput.addEventListener('change', (event) => {
  pushFiles(event.target.files || []);
  pdfInput.value = '';
});

clearBtn.addEventListener('click', () => {
  queuedFiles = [];
  renderList();
  statusText.textContent = 'Cleared queued files.';
  statusProgress.value = 0;
});

const handleDrop = (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-over');
  pushFiles(event.dataTransfer?.files || []);
};

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === 'dragleave' && event.relatedTarget && dropZone.contains(event.relatedTarget)) {
      return;
    }
    dropZone.classList.remove('is-over');
  });
});

dropZone.addEventListener('drop', handleDrop);

combineBtn.addEventListener('click', async () => {
  if (!PDFDocument || queuedFiles.length === 0) return;

  try {
    combineBtn.disabled = true;
    clearBtn.disabled = true;
    statusProgress.value = 0;
    statusText.textContent = `Combining ${queuedFiles.length} PDFs...`;

    const mergedPdf = await PDFDocument.create();

    for (let index = 0; index < queuedFiles.length; index += 1) {
      const file = queuedFiles[index];
      statusText.textContent = `Processing ${index + 1} of ${queuedFiles.length}: ${file.name}`;

      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));

      statusProgress.value = Math.round(((index + 1) / queuedFiles.length) * 100);
    }

    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `combined-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);

    statusText.textContent = `Done. Combined ${queuedFiles.length} PDF files.`;
  } catch (error) {
    console.error(error);
    statusText.textContent = `Unable to combine files: ${error.message || error}`;
  } finally {
    combineBtn.disabled = queuedFiles.length === 0;
    clearBtn.disabled = queuedFiles.length === 0;
  }
});

updateControls();
