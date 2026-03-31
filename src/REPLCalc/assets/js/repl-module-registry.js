export const MODULE_REGISTRY = Object.freeze({
  latentMuxWalker: Object.freeze({
    id: "latent-mux-walker",
    label: "latent mux walker",
    path: "assets/est/math/latent-mux-walker.est",
    version: 2,
    checksum: "path:v2:assets/est/math/latent-mux-walker.est",
  }),
});

function ensureLoadedModuleRegistry(state){
  if (!state || typeof state !== "object") return null;
  if (!(state.__loadedModuleRegistry instanceof Map)){
    state.__loadedModuleRegistry = new Map();
  }
  return state.__loadedModuleRegistry;
}

export function getModuleIdentityKey(moduleMeta){
  if (!moduleMeta || typeof moduleMeta !== "object") return "";
  const path = String(moduleMeta.path || "").trim();
  const version = String(moduleMeta.version ?? "").trim();
  const checksum = String(moduleMeta.checksum || "").trim();
  return `${path}::${version}::${checksum}`;
}

export function isModuleIdentityLoaded(state, moduleMeta){
  const registry = ensureLoadedModuleRegistry(state);
  if (!registry) return false;
  const existing = registry.get(moduleMeta.id);
  if (!existing) return false;
  return existing.identityKey === getModuleIdentityKey(moduleMeta);
}

export function markModuleIdentityLoaded(state, moduleMeta){
  const registry = ensureLoadedModuleRegistry(state);
  if (!registry) return;
  registry.set(moduleMeta.id, {
    identityKey: getModuleIdentityKey(moduleMeta),
    path: moduleMeta.path,
    version: moduleMeta.version,
    checksum: moduleMeta.checksum,
    loadedAt: Date.now(),
  });
}
