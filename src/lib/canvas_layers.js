// Minimal multi-canvas layer manager with DPR handling
export class CanvasLayers {
  constructor(names = ['base']){
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.el = document.createElement('div');
    this.el.className = 'canvas-layers';
    this.layers = new Map();
    names.forEach(n=> this.addLayer(n));
  }
  addLayer(name){
    if(this.layers.has(name)) return this.layers.get(name).canvas;
    const cnv = document.createElement('canvas');
    cnv.className = `layer layer-${name}`;
    this.el.appendChild(cnv);
    const ctx = cnv.getContext('2d');
    this.layers.set(name, { canvas: cnv, ctx });
    return cnv;
  }
  canvas(name){ return this.layers.get(name)?.canvas || null; }
  ctx(name){ return this.layers.get(name)?.ctx || null; }
  mount(parent){ if(parent && this.el.parentElement!==parent){ parent.appendChild(this.el); } }
  setSizeCss(cssW, cssH){
    const dpr = this.dpr;
    this.el.style.width = cssW + 'px';
    this.el.style.height = cssH + 'px';
    for(const {canvas} of this.layers.values()){
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if(canvas.width!==w || canvas.height!==h){
        canvas.width = w; canvas.height = h;
      }
    }
  }
  resizeToElement(host){
    const r = host.getBoundingClientRect();
    this.setSizeCss(Math.max(1, r.width), Math.max(1, r.height));
  }
}
