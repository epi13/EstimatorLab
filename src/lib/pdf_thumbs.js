export async function createPdfThumb(pdfPage, opts = {}) {
  const el = document.createElement('div')
  if (opts.className) el.className = opts.className
  el.setAttribute('tabindex', '0')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const scale = opts.scale || 0.2
  const vp = pdfPage.getViewport({ scale })
  canvas.width = vp.width
  canvas.height = vp.height
  const task = pdfPage.render({ canvasContext: ctx, viewport: vp })
  await task.promise
  el.appendChild(canvas)
  if (typeof opts.onClick === 'function') el.addEventListener('click', opts.onClick)
  return el
}
