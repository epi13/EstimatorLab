export function exportHtmlReport({ pageA, pageB, dpi, regions, canvasA, canvasB, canvasDiff }) {
  const imgA = canvasA.toDataURL("image/png");
  const imgB = canvasB.toDataURL("image/png");
  const imgD = canvasDiff.toDataURL("image/png");

  const rows = regions.map((r, i) => {
    return `<tr>
      <td>${i + 1}</td>
      <td>${r.x}, ${r.y}</td>
      <td>${r.width}×${r.height}</td>
      <td>${r.area}</td>
      <td>${Number.isFinite(r.movedFeet) ? r.movedFeet.toFixed(2) + " ft" : "-"}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PlanDiff Report</title>
  <style>
    body { font-family: system-ui, Arial; margin: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    img { max-width: 100%; border: 1px solid #ccc; border-radius: 10px; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
    th { background: #f3f3f3; text-align: left; }
    .meta { font-size: 12px; color: #333; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>PlanDiff Report</h1>
  <div class="meta">
    <div>Page A: ${pageA} | Page B: ${pageB} | DPI: ${dpi}</div>
    <div>Regions: ${regions.length}</div>
  </div>
  <div class="grid">
    <div><h3>Before (A)</h3><img src="${imgA}"/></div>
    <div><h3>After (B)</h3><img src="${imgB}"/></div>
    <div><h3>Diff</h3><img src="${imgD}"/></div>
  </div>

  <h2>Change Regions</h2>
  <table>
    <thead><tr><th>#</th><th>Top-left</th><th>Size</th><th>Area</th><th>Estimated Move</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plandiff_report_pA${pageA}_pB${pageB}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
