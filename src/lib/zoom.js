// Zoom helpers shared across tools
export function calcFitWidthScale(pv, wrapEl, pad = 64) {
  if (!pv || !pv.canvas || !wrapEl) return 1;
  const dpr = window.devicePixelRatio || 1;
  const available = Math.max(1, (wrapEl.clientWidth || 1) - pad);
  return (available / pv.canvas.width) * dpr;
}

export function calcFitPageScale(pv, wrapEl, pad = 64) {
  if (!pv || !pv.canvas || !wrapEl) return 1;
  const dpr = window.devicePixelRatio || 1;
  const availW = Math.max(1, (wrapEl.clientWidth || 1) - pad);
  const availH = Math.max(1, (wrapEl.clientHeight || 1) - pad);
  const sx = availW / pv.canvas.width;
  const sy = availH / pv.canvas.height;
  return Math.min(sx, sy) * dpr;
}
