// HedgeLite — HedgeDoc-like editor with image paste + print + PDF

/* globals marked, DOMPurify, html2pdf */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const editor = $('#editor');
  const preview = $('#preview');
  const stats = $('#stats');
  const msg = $('#msg');
  const fileInput = $('#fileInput');

  // Configure marked
  marked.use({ gfm: true, headerIds: true, smartypants: true, mangle: false });

  // --- State & persistence
  const LS_KEY = 'hedgelite:doc';
  const LS_THEME = 'hedgelite:theme';
  let pasteImageCount = 0;

  const debounce = (fn, ms = 120) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  function setMessage(text, timeout = 1500) {
    msg.textContent = text;
    if (timeout) setTimeout(() => { if (msg.textContent === text) msg.textContent = 'Ready'; }, timeout);
  }

  // Theme init
  const savedTheme = localStorage.getItem(LS_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Initial doc
  const defaultDoc = `# HedgeLite

Paste images directly from your clipboard (Ctrl/Cmd+V) — they get embedded as data URLs.

Buttons added: **PDF** (export) and **Print** (preview-only print).
`;
  editor.value = localStorage.getItem(LS_KEY) ?? defaultDoc;

  // --- Rendering
  function render() {
    const raw = editor.value;
    const html = marked.parse(raw);
    const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    preview.innerHTML = clean;
    updateStats(raw);
  }
  const renderDebounced = debounce(render, 80);

  // --- Stats
  function updateStats(text) {
    const words = (text.match(/\b[\p{L}\p{N}'-]+\b/gu) || []).length;
    const chars = text.length;
    stats.textContent = `${words} words • ${chars} chars`;
  }

  // --- Autosave
  const saveDebounced = debounce(() => {
    localStorage.setItem(LS_KEY, editor.value);
    setMessage('Saved');
  }, 250);

  editor.addEventListener('input', () => { renderDebounced(); saveDebounced(); });

  // Initial render
  render();

  // --- Scroll sync
  let isSyncing = false;
  function syncScroll() {
    if (isSyncing) return;
    isSyncing = true;
    const e = editor;
    const p = preview;
    const ratio = e.scrollTop / (e.scrollHeight - e.clientHeight || 1);
    p.scrollTop = ratio * (p.scrollHeight - p.clientHeight);
    isSyncing = false;
  }
  editor.addEventListener('scroll', debounce(syncScroll, 10));

  // --- Editing helpers
  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const beforeText = editor.value.slice(0, start);
    const afterText = editor.value.slice(end);
    editor.value = beforeText + text + afterText;
    const caret = beforeText.length + text.length;
    editor.focus();
    editor.setSelectionRange(caret, caret);
    renderDebounced();
    saveDebounced();
  }

  function wrapSelection(before, after = before, placeholder = '') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const sel = editor.value.slice(start, end) || placeholder;
    const beforeText = editor.value.slice(0, start);
    const afterText = editor.value.slice(end);
    const insertion = before + sel + after;
    editor.value = beforeText + insertion + afterText;
    const cursorPos = (beforeText + insertion).length - after.length;
    editor.focus();
    editor.setSelectionRange(cursorPos, cursorPos);
    renderDebounced(); saveDebounced();
  }

  function linePrefix(prefix) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const beforeText = editor.value.slice(0, start);
    const lineStart = beforeText.lastIndexOf('\n') + 1;
    const block = editor.value.slice(lineStart, end);
    const lines = block.split('\n');
    const updated = lines.map(l => l.length ? `${prefix}${l}` : prefix.trim()).join('\n');
    editor.value = editor.value.slice(0, lineStart) + updated + editor.value.slice(end);
    editor.focus();
    editor.setSelectionRange(lineStart, lineStart + updated.length);
    renderDebounced(); saveDebounced();
  }

  function insertTable() {
    const tpl = `| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value A  | Value B  | Value C  |`;
    insertAtCursor('\n' + tpl + '\n');
  }

  // Toolbar click
  document.querySelectorAll('.toolbar .btn[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      switch (act) {
        case 'bold': wrapSelection('**', '**', 'bold'); break;
        case 'italic': wrapSelection('*', '*', 'italic'); break;
        case 'h1': wrapSelection('# ', '', 'Heading 1'); break;
        case 'h2': wrapSelection('## ', '', 'Heading 2'); break;
        case 'ul': linePrefix('- '); break;
        case 'ol': linePrefix('1. '); break;
        case 'code': wrapSelection('`', '`', 'code'); break;
        case 'codeblock': wrapSelection('\n```\n', '\n```\n', 'code block'); break;
        case 'link': wrapSelection('[', '](https://example.com)', 'text'); break;
        case 'image': wrapSelection('![](', ')', 'https://placehold.co/600x400'); break;
        case 'table': insertTable(); break;
      }
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSelection('**','**'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSelection('*','*'); }
    if (e.key === 'F8') { e.preventDefault(); togglePreview(); }
    if (e.key === 'F9') { e.preventDefault(); toggleTheme(); }
  });

  // Preview toggle
  const previewPane = document.querySelector('.preview-pane');
  function togglePreview() {
    previewPane.classList.toggle('hidden');
    document.querySelector('.split').style.gridTemplateColumns =
      previewPane.classList.contains('hidden') ? '1fr' : '1fr 1fr';
  }
  $('#togglePreview').addEventListener('click', togglePreview);

  // Theme toggle
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(LS_THEME, next);
  }
  $('#toggleTheme').addEventListener('click', toggleTheme);

  // Import .md
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    editor.value = text;
    render();
    saveDebounced();
    setMessage(`Imported: ${file.name}`);
    fileInput.value = '';
  });

  // Download helpers
  function download(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }

  // Download .md
  $('#downloadMd').addEventListener('click', () => {
    const name = suggestName('.md');
    download(name, editor.value);
  });

  // Download .html (standalone)
  $('#downloadHtml').addEventListener('click', () => {
    const content = editor.value;
    const body = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
    const doc = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Export — HedgeLite</title>
<style>
  body{margin:40px auto;max-width:900px;padding:0 16px;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial}
  pre{background:#f5f5f7;padding:12px;border-radius:10px;overflow:auto}
  code{background:#f0f0f3;padding:2px 6px;border-radius:6px}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px}
  a{color:#2a64f6;text-decoration:none} a:hover{text-decoration:underline}
  blockquote{border-left:3px solid #2a64f6;padding:8px 12px;color:#555;margin:10px 0}
  img{max-width:100%;height:auto}
</style></head><body>
<article class="markdown-body">
${body}
</article>
</body></html>`;
    const name = suggestName('.html');
    download(name, doc, 'text/html;charset=utf-8');
  });

  function suggestName(ext) {
    const firstH1 = editor.value.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const base = (firstH1 || 'document').toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g,'');
    return `${base || 'document'}${ext}`;
  }

  // -------- New: Paste images from clipboard --------
  editor.addEventListener('paste', async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(it => it.kind === 'file' && it.type.startsWith('image/'));

    if (imageItems.length === 0) return; // let text paste happen as usual

    e.preventDefault(); // we'll handle image pastes
    const blocks = [];

    for (const it of imageItems) {
      const file = it.getAsFile();
      if (!file) continue;
      const dataUrl = await fileToDataURL(file);
      const ext = (file.type.split('/')[1] || 'png').toLowerCase();
      pasteImageCount += 1;
      const alt = `pasted-image-${pasteImageCount}.${ext}`;
      blocks.push(`![${alt}](${dataUrl})`);
    }

    if (blocks.length) {
      // Insert each image on a new paragraph
      insertAtCursor('\n' + blocks.join('\n\n') + '\n');
      setMessage(`Pasted ${blocks.length} image${blocks.length > 1 ? 's' : ''}`);
    }
  });

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // -------- New: Print (prints the Preview only) --------
  $('#printDoc').addEventListener('click', () => {
    // Ensure latest render, then open print dialog using @media print rules
    render();
    window.print();
  });

  // -------- New: Export to PDF (client-side) --------
  $('#exportPdf').addEventListener('click', async () => {
    render();
    const filename = suggestName('.pdf');

    // Clone preview content into a printable container to avoid scroll clipping
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.innerHTML = preview.innerHTML;

    // Use html2pdf on our container
    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5], // inches: top, left, bottom, right
      filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(container).save();
      setMessage('PDF exported');
    } catch (err) {
      console.error(err);
      setMessage('PDF export failed', 2500);
    }
  });

  // Accessibility niceties
  editor.setAttribute('aria-multiline', 'true');
})();
