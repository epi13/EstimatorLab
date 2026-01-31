export function createSession({ state, setTheme, writeLine, setStatus, renderUserFunctions, defineUserFn }){
  const PROFILE_STORAGE_KEY = "replcalc_profiles_v1";

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      setStatus("Copied", "ok");
      writeLine("Copied to clipboard.", "ok");
    }catch{
      setStatus("Clipboard blocked", "warn");
      writeLine("Clipboard access blocked by browser. (Try HTTPS or allow clipboard.)", "warn");
      writeLine(text, "muted");
    }
  }

  async function readClipboard(){
    try{
      return await navigator.clipboard.readText();
    }catch{
      throw new Error("Clipboard read blocked by browser.");
    }
  }

  function loadProfileStore(){
    try{
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return Object.create(null);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return Object.create(null);
      return parsed;
    }catch{
      return Object.create(null);
    }
  }

  function saveProfileStore(store){
    try{
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
    }catch{
      throw new Error("Local storage blocked by browser.");
    }
  }

  function normalizeProfileName(name){
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Profile name required. Use :save name.");
    if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)){
      throw new Error("Profile name can only use letters, numbers, spaces, _ or -.");
    }
    return trimmed;
  }

  function exportSession(){
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      vars: state.vars,
      history: state.history.slice(-250),
      theme: state.theme,
      methods: Object.values(state.userFns).map((defn) => ({
        name: defn.name,
        params: defn.params,
        expr: defn.expr,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  function importSession(jsonText){
    const obj = JSON.parse(jsonText);
    if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
    if (obj.version !== 1) throw new Error("Unsupported session version");
    state.vars = obj.vars && typeof obj.vars === "object" ? obj.vars : Object.create(null);
    state.history = Array.isArray(obj.history) ? obj.history : [];
    if (obj.theme) setTheme(obj.theme);
    state.userFns = Object.create(null);
    if (Array.isArray(obj.methods)){
      for (const defn of obj.methods){
        if (defn && typeof defn.name === "string" && typeof defn.expr === "string"){
          const params = Array.isArray(defn.params) ? defn.params : [];
          try{
            defineUserFn(defn.name, params, defn.expr);
          }catch{
            // ignore invalid imported methods
          }
        }
      }
    }
    renderUserFunctions();
  }

  function saveProfile(name){
    const profileName = normalizeProfileName(name);
    const store = loadProfileStore();
    const payload = JSON.parse(exportSession());
    payload.profile_name = profileName;
    payload.saved_at = new Date().toISOString();
    store[profileName] = payload;
    saveProfileStore(store);
    writeLine(`Saved profile "${profileName}".`, "ok");
  }

  function loadProfile(name){
    const profileName = normalizeProfileName(name);
    const store = loadProfileStore();
    const payload = store[profileName];
    if (!payload) throw new Error(`No saved profile named "${profileName}".`);
    importSession(JSON.stringify(payload));
    writeLine(`Loaded profile "${profileName}".`, "ok");
  }

  function listProfiles(){
    const store = loadProfileStore();
    const names = Object.keys(store).sort();
    if (!names.length){
      writeLine("No saved profiles yet.", "muted");
      return;
    }
    writeLine("Saved profiles:", "ok");
    for (const name of names){
      const stamp = store[name]?.saved_at ? ` (saved ${store[name].saved_at})` : "";
      writeLine(`  ${name}${stamp}`, "muted");
    }
  }

  function resetAll(){
    state.vars = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    state.userFns = Object.create(null);
    state.gfx = null;
    state.gfxDirty = false;
    renderUserFunctions();
    setStatus("Reset", "ok");
    writeLine("Session reset.", "warn");
  }

  return {
    copyText,
    readClipboard,
    exportSession,
    importSession,
    saveProfile,
    loadProfile,
    listProfiles,
    resetAll,
  };
}
