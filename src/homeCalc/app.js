/* EstimatorLab QuickCalc — high-precision tape calculator
 * - Arbitrary precision via decimal.js
 * - Expression parsing via shunting-yard ( + - * / % and parentheses )
 * - Editable tape rows; recalculates dependent subtotals & grand total
 * - Subtotals, notes, export to Text/JSON, undo/redo, localStorage persistence
 */

if (typeof Decimal === "undefined") {
  alert("Decimal.js not loaded — check your <script> order.");
  throw new Error("Decimal.js not loaded");
}


(() => {
  // ---------- State ----------
  const state = {
    tape: [],           // [{id, type:'expr'|'subtotal', expr, note, result: Decimal|string}]
    nextId: 1,
    decimals: 2,
    precision: 40,
    theme: 'dark',
    undoStack: [],
    redoStack: []
  };

  // ---------- DOM ----------
  const el = {
    tape: document.getElementById('tape'),
    grand: document.getElementById('grand-total'),
    exprInput: document.getElementById('expr-input'),
    noteInput: document.getElementById('note-input'),
    btnEnter: document.getElementById('btn-enter'),
    btnEquals: document.getElementById('btn-equals'),
    btnSubtotal: document.getElementById('btn-subtotal'),
    btnExportText: document.getElementById('btn-export-text'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnClear: document.getElementById('btn-clear'),
    fmtDecimals: document.getElementById('fmt-decimals'),
    calcPrecision: document.getElementById('calc-precision'),
    toggleDark: document.getElementById('toggle-dark'),
    keypad: document.querySelector('.keypad'),
    constMarkup: document.getElementById('const-markup'),
    constWaste: document.getElementById('const-waste'),
    constLabor: document.getElementById('const-labor'),
    btnInsertConst: document.getElementById('btn-insert-const'),
  };

  // ---------- Persistence ----------
  const LS_KEY = 'estimatorlab_quickcalc_v1';
  const save = () => {
    const safe = {
      ...state,
      tape: state.tape.map(row => ({ ...row, result: row.result?.toString?.() ?? row.result })),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(safe));
  };
  const load = () => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      state.tape = (data.tape || []).map(r => ({
        ...r,
        result: r.result != null && r.result !== '' ? new Decimal(r.result) : '',
      }));
      state.nextId = data.nextId || 1;
      state.decimals = data.decimals ?? 2;
      state.precision = data.precision ?? 40;
      state.theme = data.theme || 'dark';
      state.undoStack = [];
      state.redoStack = [];
    } catch { /* ignore */ }
  };

  // ---------- Decimal config ----------
  const applyPrecision = () => {
    Decimal.set({ precision: state.precision, rounding: Decimal.ROUND_HALF_UP });
  };

  // ---------- Utilities ----------
  const fmt = (d) => {
    if (!(d instanceof Decimal)) return '';
    return d.toFixed(state.decimals);
  };

  const pushUndo = () => {
    state.undoStack.push(JSON.stringify({
      tape: state.tape.map(r => ({...r, result: r.result?.toString?.() ?? r.result})),
      nextId: state.nextId
    }));
    if (state.undoStack.length > 200) state.undoStack.shift();
    state.redoStack = [];
  };
  const doUndo = () => {
    if (!state.undoStack.length) return;
    const snap = state.undoStack.pop();
    state.redoStack.push(JSON.stringify({
      tape: state.tape.map(r => ({...r, result: r.result?.toString?.() ?? r.result})),
      nextId: state.nextId
    }));
    const data = JSON.parse(snap);
    state.tape = data.tape.map(r => ({...r, result: r.result ? new Decimal(r.result) : ''}));
    state.nextId = data.nextId;
    recalcAll();
    render();
    save();
  };
  const doRedo = () => {
    if (!state.redoStack.length) return;
    const snap = state.redoStack.pop();
    state.undoStack.push(JSON.stringify({
      tape: state.tape.map(r => ({...r, result: r.result?.toString?.() ?? r.result})),
      nextId: state.nextId
    }));
    const data = JSON.parse(snap);
    state.tape = data.tape.map(r => ({...r, result: r.result ? new Decimal(r.result) : ''}));
    state.nextId = data.nextId;
    recalcAll();
    render();
    save();
  };

  // ---------- Parser (shunting-yard) ----------
  const isNum = (ch) => /[0-9.]/.test(ch);
  const isOp = (ch) => /[+\-*/%]/.test(ch);
  const prec = (op) => (op === '+' || op === '-') ? 1 : (op === '*' || op === '/' || op === '%') ? 2 : 0;
  const assocLeft = (op) => op !== '^';

  const tokenize = (s) => {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ') { i++; continue; }
      if (isNum(ch)) {
        let j = i+1;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        out.push({type:'num', value: s.slice(i, j)});
        i = j; continue;
      }
      if (isOp(ch)) { out.push({type:'op', value: ch}); i++; continue; }
      if (ch === '(' || ch === ')') { out.push({type:'par', value: ch}); i++; continue; }
      // unary minus support: treat leading '-' before number as part of number in a second pass
      // For anything unexpected, throw:
      throw new Error(`Unexpected character '${ch}'`);
    }
    // merge unary minus like (-3) or at start or after '(' or operator
    const merged = [];
    for (let k=0; k<out.length; k++) {
      const tok = out[k];
      if (tok.type === 'op' && tok.value === '-') {
        const prev = merged[merged.length - 1];
        const next = out[k+1];
        if ((!prev || (prev.type === 'op' || (prev.type==='par' && prev.value==='('))) && next && next.type==='num') {
          merged.push({type:'num', value: `-${next.value}`});
          k++; continue;
        }
      }
      merged.push(tok);
    }
    return merged;
  };

  const toRPN = (tokens) => {
    const out = [];
    const ops = [];
    for (const t of tokens) {
      if (t.type === 'num') out.push(t);
      else if (t.type === 'op') {
        while (ops.length) {
          const top = ops[ops.length-1];
          if (top.type === 'op' && ((assocLeft(t.value) && prec(t.value) <= prec(top.value)) || (!assocLeft(t.value) && prec(t.value) < prec(top.value)))) {
            out.push(ops.pop());
          } else break;
        }
        ops.push(t);
      } else if (t.type === 'par' && t.value === '(') ops.push(t);
      else if (t.type === 'par' && t.value === ')') {
        while (ops.length && !(ops[ops.length-1].type === 'par' && ops[ops.length-1].value==='(')) {
          out.push(ops.pop());
        }
        if (!ops.length) throw new Error('Mismatched parentheses');
        ops.pop(); // remove '('
      }
    }
    while (ops.length) {
      const t = ops.pop();
      if (t.type === 'par') throw new Error('Mismatched parentheses');
      out.push(t);
    }
    return out;
  };

  const evalRPN = (rpn) => {
    const st = [];
    for (const t of rpn) {
      if (t.type === 'num') st.push(new Decimal(t.value));
      else if (t.type === 'op') {
        const b = st.pop(); const a = st.pop();
        if (a == null || b == null) throw new Error('Invalid expression');
        switch (t.value) {
          case '+': st.push(a.plus(b)); break;
          case '-': st.push(a.minus(b)); break;
          case '*': st.push(a.times(b)); break;
          case '/': st.push(a.div(b)); break;
          case '%': st.push(a.mod(b)); break;
          default: throw new Error('Unknown operator');
        }
      }
    }
    if (st.length !== 1) throw new Error('Invalid expression');
    return st[0];
  };

  const evaluate = (expr) => {
    const tokens = tokenize(expr);
    const rpn = toRPN(tokens);
    return evalRPN(rpn);
  };

  // ---------- Core ops ----------
  const addExpr = (expr, note='') => {
    if (!expr || !expr.trim()) return;
    pushUndo();
    const res = evaluate(expr);
    state.tape.push({ id: state.nextId++, type:'expr', expr: expr.trim(), note: note.trim(), result: res });
    recalcAll();
    render(true);
    save();
  };

  const addSubtotal = () => {
    pushUndo();
    // Sum since last subtotal
    let sum = new Decimal(0);
    for (let i = state.tape.length - 1; i >= 0; i--) {
      const row = state.tape[i];
      if (row.type === 'subtotal') break;
      if (row.type === 'expr' && row.result instanceof Decimal) sum = sum.plus(row.result);
    }
    state.tape.push({ id: state.nextId++, type:'subtotal', expr: '', note: 'Subtotal', result: sum });
    recalcAll();
    render(true);
    save();
  };

  const deleteRow = (id) => {
    pushUndo();
    state.tape = state.tape.filter(r => r.id !== id);
    recalcAll();
    render();
    save();
  };

  const updateRow = (id, fields) => {
    const idx = state.tape.findIndex(r => r.id === id);
    if (idx < 0) return;
    pushUndo();
    const row = state.tape[idx];
    const updated = { ...row, ...fields };
    if (updated.type === 'expr') {
      try {
        updated.result = evaluate(updated.expr);
      } catch {
        updated.result = '';
      }
    }
    state.tape[idx] = updated;
    recalcAll();
    render();
    save();
  };

  const recalcAll = () => {
    applyPrecision();
    // Re-evaluate all expressions (in case precision changed or edits)
    for (const row of state.tape) {
      if (row.type === 'expr') {
        try { row.result = evaluate(row.expr); }
        catch { row.result = ''; }
      }
    }
    // Recompute each subtotal's block sum
    let runningGrand = new Decimal(0);
    let runningSinceSub = new Decimal(0);
    for (const row of state.tape) {
      if (row.type === 'expr') {
        if (row.result instanceof Decimal) {
          runningGrand = runningGrand.plus(row.result);
          runningSinceSub = runningSinceSub.plus(row.result);
        }
      } else if (row.type === 'subtotal') {
        row.result = runningSinceSub;
        runningSinceSub = new Decimal(0);
      }
    }
    el.grand.textContent = fmt(runningGrand);
  };

  // ---------- Render ----------
  const render = (scrollToBottom=false) => {
    el.tape.innerHTML = '';
    state.tape.forEach((row, i) => {
      const r = document.createElement('div');
      r.className = 'tape-row';

      const cIdx = document.createElement('div');
      cIdx.className = 'idx';
      cIdx.textContent = i + 1;

      const cExpr = document.createElement('div');
      cExpr.className = 'expr';
      if (row.type === 'expr') {
        cExpr.contentEditable = 'true';
        cExpr.spellcheck = false;
        cExpr.textContent = row.expr;
        cExpr.title = 'Click to edit expression';
        cExpr.addEventListener('blur', () => updateRow(row.id, { expr: cExpr.textContent.trim() }));
        cExpr.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cExpr.blur(); }});
      } else {
        const tag = document.createElement('span');
        tag.className = 'tag sub';
        tag.textContent = 'Subtotal';
        cExpr.appendChild(tag);
      }

      const cRes = document.createElement('div');
      cRes.className = 'res';
      cRes.textContent = row.result instanceof Decimal ? fmt(row.result) : '';

      const cNote = document.createElement('div');
      cNote.className = 'note';
      cNote.contentEditable = 'true';
      cNote.spellcheck = false;
      cNote.textContent = row.note || '';
      cNote.title = 'Click to edit note';
      cNote.addEventListener('blur', () => updateRow(row.id, { note: cNote.textContent.trim() }));
      cNote.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cNote.blur(); }});

      const cDel = document.createElement('div');
      const btnDel = document.createElement('button');
      btnDel.className = 'icon-btn';
      btnDel.innerHTML = '✕';
      btnDel.title = 'Delete row';
      btnDel.addEventListener('click', () => deleteRow(row.id));
      cDel.appendChild(btnDel);

      r.appendChild(cIdx); r.appendChild(cExpr); r.appendChild(cRes); r.appendChild(cNote); r.appendChild(cDel);
      el.tape.appendChild(r);
    });

    if (scrollToBottom) el.tape.scrollTop = el.tape.scrollHeight;
  };

  // ---------- Exports ----------
  const exportText = () => {
    const lines = state.tape.map((r, i) => {
      if (r.type === 'subtotal') return `${i+1}. Subtotal = ${fmt(r.result)}${r.note ? ' // ' + r.note : ''}`;
      return `${i+1}. ${r.expr} = ${fmt(r.result)}${r.note ? ' // ' + r.note : ''}`;
    });
    const total = `Grand Total: ${el.grand.textContent}`;
    const clip = [...lines, ''.padEnd(16, '-'), total].join('\n');
    navigator.clipboard.writeText(clip);
  };

  const exportJSON = () => {
    const obj = {
      entries: state.tape.map(r => ({
        type: r.type,
        expr: r.expr,
        note: r.note,
        result: r.result instanceof Decimal ? r.result.toString() : ''
      })),
      decimals: state.decimals,
      precision: state.precision,
      grandTotal: el.grand.textContent
    };
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  };

  // ---------- Event wiring ----------
  el.btnEnter.addEventListener('click', () => { addExpr(el.exprInput.value, el.noteInput.value); el.exprInput.value=''; el.noteInput.value=''; el.exprInput.focus(); });
  el.btnEquals.addEventListener('click', () => { addExpr(el.exprInput.value, el.noteInput.value); el.exprInput.value=''; el.noteInput.value=''; el.exprInput.focus(); });
  el.btnSubtotal.addEventListener('click', addSubtotal);
  el.btnExportText.addEventListener('click', exportText);
  el.btnExportJson.addEventListener('click', exportJSON);
  el.btnClear.addEventListener('click', () => {
    if (!confirm('Clear the entire tape?')) return;
    pushUndo();
    state.tape = [];
    state.nextId = 1;
    recalcAll(); render(); save();
  });

  el.exprInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.btnEnter.click(); }
    if (e.key === '=' && e.altKey) { e.preventDefault(); addSubtotal(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
  });

  el.keypad.addEventListener('click', (e) => {
    const k = e.target.getAttribute('data-key');
    if (!k) return;
    if (k === 'CE') { el.exprInput.value = ''; el.exprInput.focus(); return; }
    const map = { '÷':'/', '×':'*' };
    const val = map[k] || k;
    const start = el.exprInput.selectionStart ?? el.exprInput.value.length;
    const end = el.exprInput.selectionEnd ?? el.exprInput.value.length;
    el.exprInput.value = el.exprInput.value.slice(0, start) + val + el.exprInput.value.slice(end);
    const pos = start + val.length;
    el.exprInput.setSelectionRange(pos, pos);
    el.exprInput.focus();
  });

  el.fmtDecimals.addEventListener('change', () => {
    const v = Math.max(0, Math.min(12, Number(el.fmtDecimals.value || 2)));
    state.decimals = v;
    recalcAll(); render(); save();
  });

  el.calcPrecision.addEventListener('change', () => {
    const v = Math.max(16, Math.min(80, Number(el.calcPrecision.value || 40)));
    state.precision = v;
    recalcAll(); render(); save();
  });

  el.toggleDark.addEventListener('change', () => {
    state.theme = el.toggleDark.checked ? 'dark' : 'light';
    applyTheme();
    save();
  });

  const applyTheme = () => {
    if (state.theme === 'light') {
      document.body.classList.add('light');
      el.toggleDark.checked = false;
    } else {
      document.body.classList.remove('light');
      el.toggleDark.checked = true;
    }
  };

  // Insert constants helper expression
  el.btnInsertConst.addEventListener('click', () => {
    const m = Number(el.constMarkup.value || 0);
    const w = Number(el.constWaste.value || 0);
    const L = Number(el.constLabor.value || 0);
    // Inserts a pattern the user can quickly adapt:
    const snippet = `x * (1 + ${m}/100) * (1 + ${w}/100) + hours * ${L}`;
    el.exprInput.value = snippet;
    el.exprInput.focus();
    el.exprInput.setSelectionRange(0, 1); // select the 'x'
  });

  // ---------- Init ----------
  const init = () => {
    load();
    applyPrecision();
    applyTheme();
    // Populate UI inputs
    el.fmtDecimals.value = state.decimals;
    el.calcPrecision.value = state.precision;
    recalcAll();
    render();
  };
  init();
})();
