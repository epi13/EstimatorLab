export function createUserFunctionUi({
  state,
  inputEl,
  fnNameInput,
  fnParamsInput,
  fnExprInput,
  userFnList,
  userFnEmpty,
  updateHighlight,
  syncEditorHeight,
  scheduleLiveResult,
  writeLine,
}){
  function insertIntoEditor(text){
    const value = inputEl.value;
    const start = inputEl.selectionStart ?? value.length;
    const end = inputEl.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
    inputEl.value = nextValue;
    const cursorPos = start + text.length;
    inputEl.focus();
    inputEl.setSelectionRange(cursorPos, cursorPos);
    updateHighlight();
    syncEditorHeight();
    scheduleLiveResult();
  }

  function renderUserFunctions(){
    const keys = Object.keys(state.userFns).sort();
    userFnList.innerHTML = "";
    userFnEmpty.style.display = keys.length ? "none" : "block";
    for (const name of keys){
      const defn = state.userFns[name];
      const row = document.createElement("div");
      row.className = "fnRow";
      const params = defn.params ? defn.params.join(", ") : "";
      row.innerHTML = `
        <div class="fnTitle">${name}(${params})</div>
        <div class="fnExpr">= ${defn.expr}</div>
        <div class="fnActions"></div>
      `;
      const actions = row.querySelector(".fnActions");
      const insertBtn = document.createElement("button");
      insertBtn.className = "btn mini";
      insertBtn.textContent = "Insert";
      insertBtn.addEventListener("click", () => insertIntoEditor(`${name}(`));
      const editBtn = document.createElement("button");
      editBtn.className = "btn mini";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        fnNameInput.value = name;
        fnParamsInput.value = params;
        fnExprInput.value = defn.expr;
        fnNameInput.focus();
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn mini danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        delete state.userFns[name];
        renderUserFunctions();
        writeLine(`Removed solution ${name}.`, "warn");
      });
      actions.append(insertBtn, editBtn, deleteBtn);
      userFnList.appendChild(row);
    }
  }

  function clearFnForm(){
    fnNameInput.value = "";
    fnParamsInput.value = "";
    fnExprInput.value = "";
  }

  return {
    renderUserFunctions,
    clearFnForm,
  };
}
