// State of the document blocks in memory
// Each block = { type: 'text'|'image', title: string, content: string, markdown: bool }
const blocks = [];

const addTextBtn      = document.getElementById("addTextBtn");
const imageInput      = document.getElementById("imageInput");
const printBtn        = document.getElementById("printBtn");

const blockTitleEl    = document.getElementById("blockTitle");
const blockContentEl  = document.getElementById("blockContent");
const renderMdEl      = document.getElementById("renderMarkdown");
const saveBlockBtn    = document.getElementById("saveBlockBtn");

const docTitleEl      = document.getElementById("docTitle");
const docAreaEl       = document.getElementById("docArea");
const emptyHintEl     = document.getElementById("emptyHint");

const printAreaEl     = document.getElementById("printArea");
const printDocTitleEl = document.getElementById("printDocTitle");
const printBlocksEl   = document.getElementById("printBlocks");

// --- Markdown Renderer (very small subset) -----------------------------
// We'll keep it lightweight and offline. We won't cover 100% of Markdown,
// just headers, bold, italic, inline code, fenced code blocks, paragraphs, lists.
function renderMarkdownToHTML(mdText) {
  // Escape HTML first to avoid injection
  let html = mdText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // code fences ```...```
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // headers: ###, ##, #
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // italic *text*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // inline code `code`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // unordered list lines starting with -
  // We need to group consecutive "-" lines into <ul><li>...</li></ul>
  html = groupLists(html);

  // line breaks -> paragraphs
  // We'll split double newlines into paragraphs
  html = html
    .split(/\n\s*\n/)
    .map(chunk => {
      // don't wrap block elements like <h1>, <pre>, <ul>, etc.
      if (/^\s*<(h\d|pre|ul|ol|li)/.test(chunk.trim())) {
        return chunk;
      } else {
        return `<p>${chunk.trim().replace(/\n/g, "<br/>")}</p>`;
      }
    })
    .join("\n");

  return html;
}

// helper to convert groups of "- item" lines into <ul>...</ul>
function groupLists(text) {
  const lines = text.split("\n");
  let out = [];
  let buffer = [];

  function flushList() {
    if (buffer.length) {
      out.push("<ul>");
      for (const li of buffer) {
        out.push(`<li>${li}</li>`);
      }
      out.push("</ul>");
      buffer = [];
    }
  }

  for (let line of lines) {
    const match = line.match(/^\s*-\s+(.*)$/);
    if (match) {
      buffer.push(match[1]);
    } else {
      // end of list
      flushList();
      out.push(line);
    }
  }
  flushList();
  return out.join("\n");
}

// --- Utility functions --------------------------------------------------
function rerenderBlocks() {
  // Clear preview area
  docAreaEl.innerHTML = "";
  if (blocks.length === 0) {
    docAreaEl.appendChild(emptyHintEl);
    emptyHintEl.style.display = "block";
    return;
  } else {
    emptyHintEl.style.display = "none";
  }

  blocks.forEach((block, idx) => {
    const blockEl = document.createElement("div");
    blockEl.className = "block";

    const contentEl = document.createElement("div");
    contentEl.className = "block-text-area";

    if (block.type === "text") {
      if (block.title && block.title.trim() !== "") {
        const h = document.createElement("div");
        h.className = "block-title";
        h.textContent = block.title;
        contentEl.appendChild(h);
      }

      // Show raw text in preview panel (not final print)
      const pre = document.createElement("pre");
      pre.style.margin = "0";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.wordBreak = "break-word";
      pre.textContent = block.content;
      contentEl.appendChild(pre);

      if (block.markdown) {
        const mdNote = document.createElement("div");
        mdNote.style.fontSize = ".7rem";
        mdNote.style.color = "var(--text-dim)";
        mdNote.style.marginTop = ".5rem";
        mdNote.textContent = "Will render as Markdown in PDF";
        contentEl.appendChild(mdNote);
      }

    } else if (block.type === "image") {
      if (block.title && block.title.trim() !== "") {
        const h = document.createElement("div");
        h.className = "block-title";
        h.textContent = block.title;
        contentEl.appendChild(h);
      }
      const img = document.createElement("img");
      img.src = block.content; // dataURL
      img.alt = block.title || "Screenshot";
      contentEl.appendChild(img);
    }

    // tools (up/down/delete)
    const toolsEl = document.createElement("div");
    toolsEl.className = "block-tools";

    const upBtn = document.createElement("button");
    upBtn.className = "tool-btn";
    upBtn.textContent = "↑ Up";
    upBtn.onclick = () => moveBlock(idx, -1);

    const downBtn = document.createElement("button");
    downBtn.className = "tool-btn";
    downBtn.textContent = "↓ Down";
    downBtn.onclick = () => moveBlock(idx, 1);

    const delBtn = document.createElement("button");
    delBtn.className = "tool-btn danger";
    delBtn.textContent = "✕ Del";
    delBtn.onclick = () => {
      blocks.splice(idx, 1);
      rerenderBlocks();
    };

    toolsEl.appendChild(upBtn);
    toolsEl.appendChild(downBtn);
    toolsEl.appendChild(delBtn);

    blockEl.appendChild(contentEl);
    blockEl.appendChild(toolsEl);

    docAreaEl.appendChild(blockEl);
  });
}

function moveBlock(currentIndex, delta) {
  const newIndex = currentIndex + delta;
  if (newIndex < 0 || newIndex >= blocks.length) return;
  const [b] = blocks.splice(currentIndex, 1);
  blocks.splice(newIndex, 0, b);
  rerenderBlocks();
}

// build printable DOM
function buildPrintArea() {
  // doc title
  const titleVal = docTitleEl.value.trim();
  if (titleVal === "") {
    printDocTitleEl.style.display = "none";
  } else {
    printDocTitleEl.style.display = "block";
    printDocTitleEl.textContent = titleVal;
  }

  // blocks
  printBlocksEl.innerHTML = "";
  blocks.forEach(block => {
    const wrap = document.createElement("div");
    wrap.className = "print-block";

    if (block.title && block.title.trim() !== "") {
      const h2 = document.createElement("h2");
      h2.textContent = block.title;
      wrap.appendChild(h2);
    }

    if (block.type === "text") {
      if (block.markdown) {
        const mdDiv = document.createElement("div");
        mdDiv.className = "print-markdown";
        mdDiv.innerHTML = renderMarkdownToHTML(block.content);
        wrap.appendChild(mdDiv);
      } else {
        // plain text -> <p> paragraph split
        const paras = block.content.split(/\n\s*\n/);
        paras.forEach(pText => {
          const p = document.createElement("p");
          p.textContent = pText.trim();
          wrap.appendChild(p);
        });
      }
    } else if (block.type === "image") {
      const img = document.createElement("img");
      img.src = block.content;
      img.alt = block.title || "Screenshot";
      wrap.appendChild(img);
    }

    printBlocksEl.appendChild(wrap);
  });
}

// --- Event handlers -----------------------------------------------------

// Pre-fill new text block editor when you click "+ Text / Markdown"
addTextBtn.addEventListener("click", () => {
  blockTitleEl.focus();
});

saveBlockBtn.addEventListener("click", () => {
  const title = blockTitleEl.value.trim();
  const content = blockContentEl.value;
  const markdown = renderMdEl.checked;

  if (!content.trim() && !title) {
    alert("Nothing to add.");
    return;
  }

  blocks.push({
    type: "text",
    title,
    content,
    markdown
  });

  // clear form
  blockTitleEl.value = "";
  blockContentEl.value = "";
  renderMdEl.checked = false;

  rerenderBlocks();
});

// Upload image / screenshot
imageInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataURL = evt.target.result;
    blocks.push({
      type: "image",
      title: file.name.replace(/\.[^/.]+$/, ""), // strip extension-ish
      content: dataURL,
      markdown: false
    });
    rerenderBlocks();
  };
  reader.readAsDataURL(file);

  // reset input so you can re-upload same file again
  e.target.value = "";
});

// Export -> build print area -> trigger print dialog
printBtn.addEventListener("click", () => {
  // 1. Build the printable content
  buildPrintArea();

  // 2. Force #printArea visible before print so layout isn't empty
  const prevDisplay = printAreaEl.style.display;
  printAreaEl.style.display = "block";

  // 3. Hide the on-screen app chrome while previewing print
  //    (not strictly required, but it keeps the preview clean
  //     in browsers that ignore @media print until the dialog)
  const headerEl = document.querySelector(".app-header");
  const mainEl   = document.querySelector(".main-layout");
  const footerEl = document.querySelector(".app-footer");

  const hiddenEls = [headerEl, mainEl, footerEl];
  const previousDisplays = hiddenEls.map(el => el ? el.style.display : "");

  hiddenEls.forEach(el => {
    if (el) el.style.display = "none";
  });

  // 4. Wait a tick so the browser can paint the printArea,
  //    THEN open the print dialog
  setTimeout(() => {
    window.print();

    // 5. After print dialog closes, restore everything
    printAreaEl.style.display = prevDisplay || "none";
    hiddenEls.forEach((el, i) => {
      if (el) el.style.display = previousDisplays[i];
    });
  }, 50);
});


// Initial
rerenderBlocks();
