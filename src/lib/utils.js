export function debounce(fn, ms){
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
}

export function htmlEscape(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&#34;',
    "'": '&#39;'
  }[m]));
}

export function parseJSONL(text){
  const out = [];
  const lines = text.split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
    const line = lines[i].trim();
    if(!line) continue;
    try { out.push(JSON.parse(line)); }
    catch(e){ /* ignore bad line */ }
  }
  return out;
}

export function detectFields(objs){
  const set = new Set();
  for(const o of objs){
    Object.keys(o).forEach(k => set.add(k));
  }
  return Array.from(set);
}
