// Universal wrapper for Fuse.js (CDN-provided, attaches to window.Fuse)
export function createFuse(list, options){
  const FuseCtor = (typeof window !== 'undefined' ? window.Fuse : undefined);
  if(!FuseCtor) throw new Error('Fuse.js not loaded');
  return new FuseCtor(list, options);
}
