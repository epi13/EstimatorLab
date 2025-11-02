// Base canvas + SVG overlay view
export class CanvasSvgView {
  constructor() {
    this.scale = 1;
    this.el = document.createElement('div');
    this.el.className = 'page';
    this.el.setAttribute('role', 'group');

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.overlay.appendChild(this.svg);

    this.el.appendChild(this.canvas);
    this.el.appendChild(this.overlay);
  }

  setSize(pixelWidth, pixelHeight, dpr = (window.devicePixelRatio || 1)) {
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    const cssW = pixelWidth / dpr;
    const cssH = pixelHeight / dpr;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.el.style.width = this.canvas.style.width;
    this.el.style.height = this.canvas.style.height;
    this.svg.setAttribute('viewBox', `0 0 ${pixelWidth} ${pixelHeight}`);
    this.svg.setAttribute('width', String(pixelWidth));
    this.svg.setAttribute('height', String(pixelHeight));
    this.svg.style.width = this.canvas.style.width;
    this.svg.style.height = this.canvas.style.height;
  }
}
