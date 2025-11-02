import { CanvasSvgView } from './canvas_view.js'

export class PdfPageView extends CanvasSvgView {
  constructor(index, pdfPage, viewportElm = document.getElementById('viewport')) {
    super()
    this.index = index
    this.pdfPage = pdfPage
    this.scale = 1
    this.viewportElm = viewportElm
    this.el.setAttribute('aria-label', `Page ${index + 1}`)
  }

  async render(zoom) {
    this.scale = zoom
    const dpr = window.devicePixelRatio || 1
    const vp = this.pdfPage.getViewport({ scale: zoom * dpr })
    this.setSize(vp.width, vp.height, dpr)
    const ctx = this.ctx
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); ctx.restore()
    const task = this.pdfPage.render({ canvasContext: ctx, viewport: vp })
    await task.promise.catch(()=>{})
  }
}
