import { tokenize } from "./repl-expression.js";
import { isUnitToken } from "./repl-units.js";

export function createSession({ state, setTheme, writeLine, setStatus, renderUserFunctions, defineUserFn }){
  const PROFILE_STORAGE_KEY = "replcalc_profiles_v2";
  const RECENT_USAGE_LIMIT = 50;

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

  function defaultStore(){
    return { version: 2, profiles: Object.create(null) };
  }

  function loadProfileStore(){
    try{
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return defaultStore();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object"){
        if (parsed.version === 2 && parsed.profiles && typeof parsed.profiles === "object"){
          return parsed;
        }
        return migrateLegacyStore(parsed);
      }
      return defaultStore();
    }catch{
      return defaultStore();
    }
  }

  function migrateLegacyStore(parsed){
    const store = defaultStore();
    if (!parsed || typeof parsed !== "object") return store;
    for (const [name, payload] of Object.entries(parsed)){
      if (!payload || typeof payload !== "object") continue;
      const migrated = migrateLegacyProfile(name, payload);
      if (migrated) store.profiles[name] = migrated;
    }
    return store;
  }

  function migrateLegacyProfile(name, payload){
    if (payload.version !== 1) return null;
    const profileId = payload.profile_name || name;
    const savedAt = payload.saved_at || payload.exported_at || new Date().toISOString();
    const profileVersion = 1;
    const symbols = Object.create(null);
    const index = Object.create(null);
    const vars = payload.vars && typeof payload.vars === "object" ? payload.vars : {};
    for (const [varName, value] of Object.entries(vars)){
      const versionMeta = buildVersionMeta({
        name: varName,
        kind: "var",
        originProfile: profileId,
        symbolVersion: 1,
        profileVersion,
        savedAt,
        content: { value },
      });
      symbols[varName] = {
        name: varName,
        kind: "var",
        value,
        deps: [],
        versionMeta,
      };
      index[varName] = {
        name: varName,
        kind: "var",
        deps: [],
        versionMeta,
      };
    }
    if (Array.isArray(payload.methods)){
      for (const defn of payload.methods){
        if (!defn || typeof defn.name !== "string" || typeof defn.expr !== "string") continue;
        const params = Array.isArray(defn.params) ? defn.params : [];
        const versionMeta = buildVersionMeta({
          name: defn.name,
          kind: "fn",
          originProfile: profileId,
          symbolVersion: 1,
          profileVersion,
          savedAt,
          content: { expr: defn.expr, params },
        });
        symbols[defn.name] = {
          name: defn.name,
          kind: "fn",
          params,
          ast: defn.expr,
          deps: [],
          versionMeta,
        };
        index[defn.name] = {
          name: defn.name,
          kind: "fn",
          deps: [],
          versionMeta,
        };
      }
    }

    return {
      version: 2,
      profileId,
      savedAt,
      profileVersion,
      pinned: [],
      symbols,
      index,
    };
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

  function normalizeSymbolName(value, label){
    const name = (value || "").trim();
    if (!name) throw new Error(`${label} expects a symbol name`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid symbol name: ${name}`);
    return name;
  }

  function hashContent(content){
    const serialized = typeof content === "string" ? content : safeStringify(content);
    let hash = 2166136261;
    for (let i = 0; i < serialized.length; i++){
      hash ^= serialized.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `sha256:${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function safeStringify(value){
    try{
      return JSON.stringify(value);
    }catch{
      return String(value);
    }
  }

  function buildVersionMeta({ name, kind, originProfile, symbolVersion, profileVersion, savedAt, content }){
    return {
      name,
      kind,
      definedInProfile: originProfile,
      symbolVersion,
      profileVersion,
      savedAt,
      contentHash: hashContent(content),
    };
  }

  function nextSymbolVersion(name){
    const current = state.symbolVersions.get(name) || 0;
    const existing = state.shadowTable.get(name) || [];
    let max = current;
    for (const def of existing){
      const version = def?.versionMeta?.symbolVersion || 0;
      if (version > max) max = version;
    }
    const next = max + 1;
    state.symbolVersions.set(name, next);
    return next;
  }

  function compareSymbols(a, b){
    if (a.versionMeta.symbolVersion !== b.versionMeta.symbolVersion){
      return a.versionMeta.symbolVersion > b.versionMeta.symbolVersion ? 1 : -1;
    }
    if (a.versionMeta.profileVersion !== b.versionMeta.profileVersion){
      return a.versionMeta.profileVersion > b.versionMeta.profileVersion ? 1 : -1;
    }
    if (a.versionMeta.savedAt !== b.versionMeta.savedAt){
      return a.versionMeta.savedAt > b.versionMeta.savedAt ? 1 : -1;
    }
    if (a.originProfile !== b.originProfile){
      return a.originProfile > b.originProfile ? 1 : -1;
    }
    return 0;
  }

  function pickWinner(defs){
    if (!defs.length) return null;
    const sorted = defs.slice().sort((a, b) => -compareSymbols(a, b));
    return sorted[0];
  }

  function resolveSymbol(name){
    const list = state.shadowTable.get(name) || [];
    let winner = null;
    if (state.forcedSymbols.has(name)){
      winner = state.forcedSymbols.get(name);
    }else{
      winner = pickWinner(list);
    }
    if (!winner){
      state.symbolTable.delete(name);
      delete state.vars[name];
      delete state.userFns[name];
      return;
    }
    state.symbolTable.set(name, winner);
    applyResolvedSymbol(name, winner);
  }

  function applyResolvedSymbol(name, def){
    if (def.kind === "fn"){
      if (def.bodyLoaded){
        const existing = state.userFns[name];
        const expr = (def.ast || "").trim();
        if (!existing || existing.expr !== expr){
          state.loadingProfileSymbol = true;
          try{
            defineUserFn(name, def.params || [], expr);
          }finally{
            state.loadingProfileSymbol = false;
          }
        }
      }else if (Object.prototype.hasOwnProperty.call(state.userFns, name)){
        delete state.userFns[name];
        renderUserFunctions();
      }
      return;
    }
    if (def.bodyLoaded){
      state.vars[name] = def.value;
    }else if (Object.prototype.hasOwnProperty.call(state.vars, name)){
      delete state.vars[name];
    }
  }

  function addToShadow(def){
    const list = state.shadowTable.get(def.name) || [];
    const filtered = list.filter((item) => item.originProfile !== def.originProfile);
    filtered.push(def);
    state.shadowTable.set(def.name, filtered);
    resolveSymbol(def.name);
  }

  function collectDependencies(expr, exclude = new Set()){
    if (!expr) return [];
    try{
      const tokens = tokenize(expr);
      const deps = new Set();
      for (let i = 0; i < tokens.length; i++){
        const t = tokens[i];
        if (t.type !== "id") continue;
        const name = t.value;
        if (exclude.has(name)) continue;
        if (name === "pi" || name === "e") continue;
        if (isUnitToken(name)) continue;
        deps.add(name);
      }
      return Array.from(deps);
    }catch{
      return [];
    }
  }

  function collectAssemblyDeps(fields){
    const deps = new Set();
    for (const entry of Object.values(fields || {})){
      const raw = entry?.raw || "";
      const fieldDeps = collectDependencies(raw);
      for (const dep of fieldDeps) deps.add(dep);
    }
    return Array.from(deps);
  }

  function recordSymbolDefinition({ name, kind, expr = "", params = [], fields = null, value = null }){
    const symbolName = normalizeSymbolName(name, "define");
    const originProfile = "session";
    const deps = kind === "assy" ? collectAssemblyDeps(fields) : collectDependencies(expr, new Set(params));
    const symbolVersion = nextSymbolVersion(symbolName);
    const savedAt = new Date().toISOString();
    const content = kind === "fn" ? { expr, params } : kind === "assy" ? { fields } : { expr, value };
    const versionMeta = buildVersionMeta({
      name: symbolName,
      kind,
      originProfile,
      symbolVersion,
      profileVersion: 0,
      savedAt,
      content,
    });
    const symbolDef = {
      name: symbolName,
      kind,
      ast: expr,
      params: params.slice(),
      fields,
      value,
      originProfile,
      versionMeta,
      deps,
      bodyLoaded: true,
    };
    state.depGraph.set(symbolName, new Set(deps));
    addToShadow(symbolDef);
    markTouched(symbolName, state.currentUsage?.entry?.sequence || state.usageSeq);
    return symbolDef;
  }

  function markTouched(name, sequence){
    const seq = sequence || state.usageSeq;
    state.touchedSymbols.set(name, seq);
  }

  function beginUsage(parsed, raw){
    const namesReferenced = collectReferences(parsed, raw);
    const entry = {
      namesReferenced,
      namesResolved: [],
      functionsCalled: [],
      sequence: ++state.usageSeq,
      timestamp: new Date().toISOString(),
    };
    state.currentUsage = {
      entry,
      namesResolved: new Set(),
      functionsCalled: new Set(),
    };
    return entry;
  }

  function endUsage(entry){
    if (!entry || !state.currentUsage) return;
    const current = state.currentUsage;
    entry.namesResolved = Array.from(current.namesResolved).sort();
    entry.functionsCalled = Array.from(current.functionsCalled).sort();
    state.usageLog.push(entry);
    for (const name of entry.namesResolved){
      markTouched(name, entry.sequence);
    }
    for (const name of entry.functionsCalled){
      markTouched(name, entry.sequence);
    }
    state.currentUsage = null;
  }

  const usageTracker = {
    getHooks(){
      if (!state.currentUsage) return {};
      return {
        onResolve: (name, resolvedName) => {
          if (!state.currentUsage) return;
          if (name) state.currentUsage.namesResolved.add(name);
          if (resolvedName) state.currentUsage.namesResolved.add(resolvedName);
        },
        onCall: (name) => {
          if (!state.currentUsage) return;
          if (name) state.currentUsage.functionsCalled.add(name);
        },
      };
    },
  };

  function collectReferences(parsed, raw){
    if (!parsed) return [];
    const refs = new Set();
    const addExprRefs = (expr, exclude = new Set()) => {
      const deps = collectDependencies(expr, exclude);
      for (const dep of deps) refs.add(dep);
    };
    if (parsed.type === "assign"){
      addExprRefs(parsed.expr);
    }else if (parsed.type === "def"){
      addExprRefs(parsed.expr, new Set(parsed.params));
    }else if (parsed.type === "expr"){
      addExprRefs(parsed.expr);
    }else if (parsed.type === "equation"){
      addExprRefs(parsed.left);
      addExprRefs(parsed.right);
    }else if (parsed.type === "if"){
      addExprRefs(parsed.condition);
    }else if (parsed.type === "for"){
      addExprRefs(parsed.startExpr);
      addExprRefs(parsed.endExpr);
      if (parsed.stepExpr) addExprRefs(parsed.stepExpr);
    }else if (parsed.type === "repeat"){
      addExprRefs(parsed.countExpr);
    }else if (parsed.type === "assy"){
      const deps = collectAssemblyDeps(parsed.fields);
      for (const dep of deps) refs.add(dep);
    }
    return Array.from(refs).sort();
  }

  function ensureSymbolsLoaded(names){
    if (!names || !names.size) return;
    const store = loadProfileStore();
    for (const name of names){
      const def = state.symbolTable.get(name);
      if (!def || def.originProfile === "session" || def.bodyLoaded) continue;
      const profile = store.profiles[def.originProfile];
      if (!profile) continue;
      const body = profile.symbols?.[name];
      if (!body) continue;
      def.ast = body.ast || "";
      def.params = body.params || [];
      def.value = body.value ?? null;
      def.fields = body.fields || null;
      def.bodyLoaded = true;
      if (def.kind === "fn"){
        state.loadingProfileSymbol = true;
        try{
          defineUserFn(name, def.params || [], def.ast || "");
        }finally{
          state.loadingProfileSymbol = false;
        }
      }else{
        state.vars[name] = def.value;
      }
    }
  }

  function parseSaveArgs(arg){
    const raw = (arg || "").trim();
    if (!raw) return { name: "", opts: {} };
    const optIdx = raw.indexOf(" --");
    const name = optIdx >= 0 ? raw.slice(0, optIdx).trim() : raw;
    const optsText = optIdx >= 0 ? raw.slice(optIdx).trim() : "";
    const opts = {
      mode: "touched",
      includeGlobals: false,
      roots: [],
    };
    if (!optsText) return { name, opts };
    const parts = optsText.split(/\s+/).filter(Boolean);
    for (let i = 0; i < parts.length; i++){
      const part = parts[i];
      if (part === "--include-globals"){
        opts.includeGlobals = true;
      }else if (part === "--recent" || part === "--last"){
        opts.mode = "recent";
      }else if (part.startsWith("--roots=")){
        opts.mode = "roots";
        opts.roots = part.slice("--roots=".length).split(",").map((r) => r.trim()).filter(Boolean);
      }else if (part === "--roots"){
        opts.mode = "roots";
        const next = parts[i + 1] || "";
        i += 1;
        opts.roots = next.split(",").map((r) => r.trim()).filter(Boolean);
      }
    }
    return { name, opts };
  }

  function computeRoots({ mode, roots }){
    const result = new Set();
    if (mode === "recent"){
      const entries = state.usageLog.slice(-RECENT_USAGE_LIMIT);
      for (const entry of entries){
        for (const name of entry.namesReferenced || []) result.add(name);
        for (const name of entry.namesResolved || []) result.add(name);
        for (const name of entry.functionsCalled || []) result.add(name);
      }
    }else if (mode === "roots" && roots.length){
      for (const name of roots) result.add(name);
    }else{
      for (const [name, seq] of state.touchedSymbols.entries()){
        if (seq > state.lastSaveSeq) result.add(name);
      }
    }
    for (const pinned of state.pinnedSymbols.values()) result.add(pinned);
    return result;
  }

  function computeClosure(rootNames){
    const closure = new Set();
    const stack = Array.from(rootNames);
    while (stack.length){
      const name = stack.pop();
      if (!name || closure.has(name)) continue;
      closure.add(name);
      const deps = state.depGraph.get(name);
      if (!deps) continue;
      for (const dep of deps){
        if (!closure.has(dep)) stack.push(dep);
      }
    }
    return closure;
  }

  function buildProfilePayload(profileName, opts){
    const roots = computeRoots(opts);
    if (opts.includeGlobals){
      for (const [name, def] of state.symbolTable.entries()){
        if (def.originProfile === "session") roots.add(name);
      }
    }
    const closure = computeClosure(roots);
    const store = loadProfileStore();
    const existing = store.profiles[profileName];
    const profileVersion = (existing?.profileVersion || 0) + 1;
    const savedAt = new Date().toISOString();
    const symbols = Object.create(null);
    const index = Object.create(null);

    for (const name of closure){
      const def = state.symbolTable.get(name);
      if (!def) continue;
      if (!def.bodyLoaded && def.originProfile !== "session"){
        ensureSymbolsLoaded(new Set([name]));
      }
      const versionMeta = buildVersionMeta({
        name: def.name,
        kind: def.kind,
        originProfile: profileName,
        symbolVersion: def.versionMeta.symbolVersion || 1,
        profileVersion,
        savedAt,
        content: def.kind === "fn" ? { expr: def.ast, params: def.params } : def.kind === "assy" ? { fields: def.fields } : { expr: def.ast, value: def.value },
      });
      const payloadDef = {
        name: def.name,
        kind: def.kind,
        ast: def.ast || "",
        params: def.params || [],
        fields: def.fields || null,
        value: def.value ?? null,
        deps: Array.from(state.depGraph.get(name) || []),
        versionMeta,
      };
      symbols[name] = payloadDef;
      index[name] = {
        name: def.name,
        kind: def.kind,
        deps: payloadDef.deps,
        versionMeta,
      };
    }

    return {
      version: 2,
      profileId: profileName,
      savedAt,
      profileVersion,
      pinned: Array.from(state.pinnedSymbols.values()).sort(),
      symbols,
      index,
    };
  }

  function saveProfile(arg){
    const { name, opts } = parseSaveArgs(arg);
    const profileName = normalizeProfileName(name);
    const payload = buildProfilePayload(profileName, opts);
    const store = loadProfileStore();
    store.profiles[profileName] = payload;
    saveProfileStore(store);
    state.lastSaveSeq = state.usageSeq;
    writeLine(`Saved profile "${profileName}" (${Object.keys(payload.index).length} symbols).`, "ok");
  }

  function muxProfile(arg){
    saveProfile(arg);
  }

  function loadProfile(arg){
    const profileName = normalizeProfileName(arg);
    const store = loadProfileStore();
    const payload = store.profiles[profileName];
    if (!payload) throw new Error(`No saved profile named "${profileName}".`);
    for (const pinned of payload.pinned || []){
      state.pinnedSymbols.add(pinned);
    }
    state.loadedProfiles.set(profileName, {
      profileId: profileName,
      savedAt: payload.savedAt,
      profileVersion: payload.profileVersion,
      index: payload.index || {},
    });
    for (const [name, entry] of Object.entries(payload.index || {})){
      const def = {
        name,
        kind: entry.kind,
        ast: "",
        params: [],
        fields: null,
        value: null,
        originProfile: profileName,
        versionMeta: entry.versionMeta,
        deps: entry.deps || [],
        bodyLoaded: false,
      };
      state.depGraph.set(name, new Set(entry.deps || []));
      addToShadow(def);
    }
    writeLine(`Loaded profile "${profileName}".`, "ok");
  }

  function listProfiles(){
    const store = loadProfileStore();
    const names = Object.keys(store.profiles || {}).sort();
    if (!names.length){
      writeLine("No saved profiles yet.", "muted");
      return;
    }
    writeLine("Saved profiles:", "ok");
    for (const name of names){
      const payload = store.profiles[name];
      const stamp = payload?.savedAt ? ` (saved ${payload.savedAt})` : "";
      const loaded = state.loadedProfiles.has(name) ? " [loaded]" : "";
      writeLine(`  ${name}${stamp}${loaded}`, "muted");
    }
  }

  function exportSession(){
    const payload = buildProfilePayload("exported", { mode: "touched", includeGlobals: false, roots: [] });
    return JSON.stringify(payload, null, 2);
  }

  function importSession(jsonText){
    const obj = JSON.parse(jsonText);
    if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
    if (obj.version !== 2) throw new Error("Unsupported profile version");
    const profileName = normalizeProfileName(obj.profileId || `imported-${Date.now()}`);
    const store = loadProfileStore();
    store.profiles[profileName] = obj;
    saveProfileStore(store);
    loadProfile(profileName);
  }

  function pinSymbol(arg){
    const name = normalizeSymbolName(arg, "pin");
    state.pinnedSymbols.add(name);
    writeLine(`Pinned symbol ${name}.`, "ok");
  }

  function unpinSymbol(arg){
    const name = normalizeSymbolName(arg, "unpin");
    state.pinnedSymbols.delete(name);
    writeLine(`Unpinned symbol ${name}.`, "ok");
  }

  function whichSymbol(arg){
    const name = normalizeSymbolName(arg, "which");
    const def = state.symbolTable.get(name);
    if (!def){
      writeLine(`No symbol named ${name}.`, "warn");
      return;
    }
    writeLine(`${name} resolved from ${def.originProfile}.`, "ok");
    writeLine(`  symbolVersion=${def.versionMeta.symbolVersion}, profileVersion=${def.versionMeta.profileVersion}`, "muted");
    writeLine(`  savedAt=${def.versionMeta.savedAt}, hash=${def.versionMeta.contentHash}`, "muted");
    const shadows = state.shadowTable.get(name) || [];
    if (shadows.length > 1){
      writeLine("  candidates:", "muted");
      for (const entry of shadows){
        writeLine(`    ${entry.originProfile} (v${entry.versionMeta.symbolVersion}/p${entry.versionMeta.profileVersion})`, "muted");
      }
    }
  }

  function useSymbolFromProfile(arg){
    const raw = (arg || "").trim();
    const match = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)@([\s\S]+)$/);
    if (!match) throw new Error("use expects name@profileId");
    const name = normalizeSymbolName(match[1], "use");
    const profileId = match[2].trim();
    const list = state.shadowTable.get(name) || [];
    const candidate = list.find((entry) => entry.originProfile === profileId);
    if (!candidate) throw new Error(`No symbol ${name} from profile ${profileId}.`);
    state.forcedSymbols.set(name, candidate);
    resolveSymbol(name);
    writeLine(`Using ${name} from ${profileId}.`, "ok");
  }

  function diffSymbol(arg){
    const name = normalizeSymbolName(arg, "diff");
    const list = state.shadowTable.get(name) || [];
    if (!list.length){
      writeLine(`No symbol named ${name}.`, "warn");
      return;
    }
    writeLine(`Versions for ${name}:`, "ok");
    for (const entry of list){
      writeLine(`  ${entry.originProfile} v${entry.versionMeta.symbolVersion} p${entry.versionMeta.profileVersion}`, "muted");
      writeLine(`    savedAt=${entry.versionMeta.savedAt} hash=${entry.versionMeta.contentHash}`, "muted");
    }
  }

  function resetAll(){
    state.vars = Object.create(null);
    state.history = [];
    state.histIdx = -1;
    state.userFns = Object.create(null);
    state.gfx = null;
    state.gfxDirty = false;
    state.usageLog = [];
    state.touchedSymbols = new Map();
    state.currentUsage = null;
    state.lastSaveSeq = 0;
    state.symbolVersions = new Map();
    state.forcedSymbols = new Map();
    for (const [name, defs] of state.shadowTable.entries()){
      const filtered = defs.filter((def) => def.originProfile !== "session");
      if (filtered.length){
        state.shadowTable.set(name, filtered);
      }else{
        state.shadowTable.delete(name);
      }
      resolveSymbol(name);
    }
    renderUserFunctions();
    setStatus("Reset", "ok");
    writeLine("Session reset.", "warn");
  }

  state.onUserFnDefined = (info) => {
    if (state.loadingProfileSymbol) return;
    recordSymbolDefinition({
      name: info.name,
      kind: "fn",
      expr: info.expr,
      params: info.params,
    });
  };

  state.onVarDefined = (info) => {
    if (state.loadingProfileSymbol) return;
    recordSymbolDefinition({
      name: info.name,
      kind: "var",
      expr: info.expr || "",
      value: info.value,
    });
  };

  state.onVarRemoved = (name) => {
    const list = state.shadowTable.get(name) || [];
    const filtered = list.filter((item) => item.originProfile !== "session");
    if (filtered.length){
      state.shadowTable.set(name, filtered);
    }else{
      state.shadowTable.delete(name);
    }
    state.depGraph.delete(name);
    resolveSymbol(name);
  };

  state.onFnRemoved = (name) => {
    const list = state.shadowTable.get(name) || [];
    const filtered = list.filter((item) => item.originProfile !== "session");
    if (filtered.length){
      state.shadowTable.set(name, filtered);
    }else{
      state.shadowTable.delete(name);
    }
    state.depGraph.delete(name);
    resolveSymbol(name);
  };

  return {
    copyText,
    readClipboard,
    exportSession,
    importSession,
    saveProfile,
    muxProfile,
    loadProfile,
    listProfiles,
    resetAll,
    beginUsage,
    endUsage,
    pinSymbol,
    unpinSymbol,
    whichSymbol,
    useSymbolFromProfile,
    diffSymbol,
    ensureSymbolsLoaded,
    usageTracker,
    recordSymbolDefinition,
  };
}
