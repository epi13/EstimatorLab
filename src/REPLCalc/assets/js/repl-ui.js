export function createUi(state){
  const terminalEl = document.getElementById('terminal');
  const inputEl = document.getElementById('replInput');
  const highlightEl = document.getElementById('replHighlight');
  const autocompleteEl = document.getElementById('autocomplete');
  const liveResultEl = document.getElementById('liveResult');
  const statusPill = document.getElementById('statusPill');
  const hintRight = document.getElementById('hintRight');

  const btnHelp = document.getElementById('btnHelp');
  const btnClear = document.getElementById('btnClear');
  const btnVars = document.getElementById('btnVars');
  const btnMethods = document.getElementById('btnMethods');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const btnUpload = document.getElementById('btnUpload');
  const btnDownload = document.getElementById('btnDownload');
  const btnReset = document.getElementById('btnReset');

  const fileImport = document.getElementById('fileImport');

  const fnNameInput = document.getElementById('fnName');
  const fnParamsInput = document.getElementById('fnParams');
  const fnExprInput = document.getElementById('fnExpr');
  const btnFnSave = document.getElementById('btnFnSave');
  const btnFnClear = document.getElementById('btnFnClear');
  const userFnList = document.getElementById('userFnList');
  const userFnEmpty = document.getElementById('userFnEmpty');

  const helperSearch = document.getElementById('helperSearch');
  const helperClear = document.getElementById('helperClear');
  const helperList = document.getElementById('helperList');
  const helperHint = document.getElementById('helperHint');

  function nowStamp(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function writeLine(text, cls="out"){
    const p = document.createElement('p');
    p.className = `line ${cls}`;
    p.textContent = text;
    terminalEl.appendChild(p);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function writeLineRich(parts, cls="out"){
    const p = document.createElement("p");
    p.className = `line ${cls}`;
    for (const part of parts){
      if (typeof part === "string"){
        p.appendChild(document.createTextNode(part));
        continue;
      }
      const span = document.createElement("span");
      span.className = part.className;
      span.textContent = part.text;
      p.appendChild(span);
    }
    terminalEl.appendChild(p);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function token(text, className){
    return { text, className };
  }

  function writeInputEcho(text){
    const p = document.createElement('p');
    p.className = 'line';
    p.innerHTML = `<span class="prompt">est&gt;</span> <span class="input"></span>`;
    p.querySelector('.input').textContent = text;
    terminalEl.appendChild(p);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function setStatus(text, kind="ok"){
    statusPill.textContent = text;
    statusPill.style.color = (kind==="err") ? "var(--err)"
      : (kind==="warn") ? "var(--warn)"
      : "var(--muted)";
  }

  function clearTerminal(){
    terminalEl.innerHTML = "";
  }

  function setTheme(t){
    const ok = ["default","amber","matrix"].includes(t);
    if (!ok) throw new Error("Theme must be: default | amber | matrix");
    state.theme = t;
    document.body.setAttribute("data-theme", t);
    hintRight.textContent = `Theme: ${t}`;
  }

  return {
    terminalEl,
    inputEl,
    highlightEl,
    autocompleteEl,
    liveResultEl,
    statusPill,
    hintRight,
    btnHelp,
    btnClear,
    btnVars,
    btnMethods,
    btnExport,
    btnImport,
    btnUpload,
    btnDownload,
    btnReset,
    fileImport,
    fnNameInput,
    fnParamsInput,
    fnExprInput,
    btnFnSave,
    btnFnClear,
    userFnList,
    userFnEmpty,
    helperSearch,
    helperClear,
    helperList,
    helperHint,
    nowStamp,
    writeLine,
    writeLineRich,
    writeInputEcho,
    token,
    setStatus,
    clearTerminal,
    setTheme,
  };
}
