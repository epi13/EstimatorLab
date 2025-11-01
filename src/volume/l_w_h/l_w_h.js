const $ = (id)=>document.getElementById(id);

const lengthToMeters = { mm:0.001, cm:0.01, m:1, in:0.0254, ft:0.3048 };
const m3To = { ft3:35.3146667, yd3:1.30795062, m3:1, L:1000, gal:264.172052 };

function fmt(n){
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined,{maximumFractionDigits:2});
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined,{maximumFractionDigits:3});
  return n.toLocaleString(undefined,{maximumFractionDigits:5});
}

function labelFor(unit){
  switch(unit){
    case 'ft3': return 'ft³';
    case 'yd3': return 'yd³';
    case 'm3': return 'm³';
    case 'L': return 'L';
    case 'gal': return 'US gal';
    default: return unit;
  }
}

function toMeters(value, unit){ return value * lengthToMeters[unit]; }

function compute(){
  const shape = $("shape").value;
  const qty = Math.max(1, parseInt($("qty").value || '1', 10));
  const out = $("outUnit").value;

  const len = parseFloat($("len").value); // x
  const wid = parseFloat($("wid").value); // y (may be hidden)
  const hgt = parseFloat($("hgt").value); // z
  const lu = $("lenUnit").value;
  const wu = $("widUnit").value;
  const hu = $("hgtUnit").value;

  // Validate needed dims per shape
  const needY = shape === 'box' || shape === 'pyramid';
  const needed = [len, hgt];
  if (needY) needed.push(wid);
  if (needed.some(v=>!isFinite(v) || v<=0)){
    $("results").hidden = false;
    $("perItem").textContent = 'Please enter positive numbers for required dimensions.';
    $("total").textContent = '—';
    $("footnote").textContent = '';
    return;
  }

  // Convert to meters
  const xm = toMeters(len, lu);
  const zm = toMeters(hgt, hu);
  const ym = needY ? toMeters(wid, wu) : NaN;

  let v_m3 = 0;
  if (shape === 'box') {
    v_m3 = xm * ym * zm; // L*W*H
  } else if (shape === 'cylinder') {
    const radius_m = xm / 2; // x is Diameter
    v_m3 = Math.PI * radius_m * radius_m * zm; // π r^2 h
  } else if (shape === 'pyramid') {
    v_m3 = (xm * ym * zm) / 3; // (L*W*H)/3
  }

  const conv = m3To[out];
  const per = v_m3 * conv;
  const tot = per * qty;

  $("results").hidden = false;
  $("perItem").textContent = `${fmt(per)} ${labelFor(out)}`;
  $("total").textContent = `${fmt(tot)} ${labelFor(out)}`;
  $("footnote").textContent = `Inputs converted to meters internally. Shape='${shape}'. Quantity multiplies per-item volume.`;
}

function updateShapeUI(){
  const shape = $("shape").value;
  const widWrap = $("widWrap");
  const lenLabel = $("lenLabel");
  const widLabel = $("widLabel");
  const hgtLabel = $("hgtLabel");

  if (shape === 'box'){
    widWrap.style.display = '';
    lenLabel.textContent = 'Length (x)';
    widLabel.textContent = 'Width (y)';
    hgtLabel.textContent = 'Height / Thickness (z)';
    $("diagramNote").textContent = 'Rectangular prism: x × y × z. Volume = x · y · z. Example axes shown.';
  } else if (shape === 'cylinder'){
    widWrap.style.display = 'none';
    lenLabel.textContent = 'Diameter (x)';
    hgtLabel.textContent = 'Height (z)';
    $("diagramNote").textContent = 'Cylinder: diameter x and height z. Volume = π · (x/2)² · z.';
  } else if (shape === 'pyramid'){
    widWrap.style.display = '';
    lenLabel.textContent = 'Base length (x)';
    widLabel.textContent = 'Base width (y)';
    hgtLabel.textContent = 'Height (z)';
    $("diagramNote").textContent = 'Rectangular-base pyramid: x × y base and height z. Volume = (x · y · z)/3.';
  }
  renderDiagram();
}

function renderDiagram(){
  const shape = $("shape").value;
  const el = $("diagramCanvas");
  el.innerHTML = (shape === 'box') ? boxSVG() : (shape === 'cylinder') ? cylinderSVG() : pyramidSVG();
}

// Simple illustrative SVGs with x/y/z arrows and labels
function axesDefs(){
  return `
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#9aa5b1"/>
    </marker>
  </defs>`;
}

function boxSVG(){
  return `
  <svg viewBox="0 0 320 200" role="img" aria-label="Rectangular prism with x, y, z">
    ${axesDefs()}
    <rect x="70" y="50" width="140" height="90" fill="#1a2028" stroke="#2a3340" />
    <polygon points="210,50 250,70 250,160 210,140" fill="#141a20" stroke="#2a3340"/>
    <polygon points="70,50 110,70 250,70 210,50" fill="#12171d" stroke="#2a3340"/>
    <!-- x dimension -->
    <line x1="70" y1="170" x2="210" y2="170" stroke="#9aa5b1" marker-end="url(#arrow)" marker-start="url(#arrow)"/>
    <text x="160" y="185" fill="#cbd5df" font-size="12" text-anchor="middle">x (length)</text>
    <!-- y dimension (depth) -->
    <line x1="210" y1="50" x2="250" y2="70" stroke="#9aa5b1" marker-end="url(#arrow)"/>
    <text x="245" y="64" fill="#cbd5df" font-size="12">y (width)</text>
    <!-- z dimension -->
    <line x1="55" y1="140" x2="55" y2="50" stroke="#9aa5b1" marker-end="url(#arrow)"/>
    <text x="40" y="50" fill="#cbd5df" font-size="12" transform="rotate(-90 40,50)">z (height)</text>
  </svg>`;
}

function cylinderSVG(){
  return `
  <svg viewBox="0 0 320 200" role="img" aria-label="Cylinder with diameter x and height z">
    ${axesDefs()}
    <!-- top ellipse -->
    <ellipse cx="160" cy="70" rx="70" ry="20" fill="#12171d" stroke="#2a3340"/>
    <!-- body -->
    <rect x="90" y="70" width="140" height="80" fill="#151a21" stroke="#2a3340"/>
    <!-- bottom ellipse (hidden style) -->
    <ellipse cx="160" cy="150" rx="70" ry="20" fill="#151a21" stroke="#2a3340"/>
    <!-- diameter x -->
    <line x1="90" y1="40" x2="230" y2="40" stroke="#9aa5b1" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="160" y="30" fill="#cbd5df" font-size="12" text-anchor="middle">x (diameter)</text>
    <!-- height z -->
    <line x1="260" y1="70" x2="260" y2="150" stroke="#9aa5b1" marker-end="url(#arrow)"/>
    <text x="270" y="110" fill="#cbd5df" font-size="12" transform="rotate(90 270,110)">z (height)</text>
  </svg>`;
}

function pyramidSVG(){
  return `
  <svg viewBox="0 0 320 200" role="img" aria-label="Rectangular-base pyramid with base x,y and height z">
    ${axesDefs()}
    <!-- base rectangle -->
    <polygon points="80,140 220,140 250,160 110,160" fill="#11161c" stroke="#2a3340"/>
    <!-- sides -->
    <line x1="80" y1="140" x2="165" y2="70" stroke="#2a3340"/>
    <line x1="220" y1="140" x2="165" y2="70" stroke="#2a3340"/>
    <line x1="110" y1="160" x2="165" y2="70" stroke="#2a3340"/>
    <line x1="250" y1="160" x2="165" y2="70" stroke="#2a3340"/>
    <!-- x dimension -->
    <line x1="80" y1="175" x2="220" y2="175" stroke="#9aa5b1" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="150" y="190" fill="#cbd5df" font-size="12" text-anchor="middle">x (base length)</text>
    <!-- y dimension (depth) -->
    <line x1="220" y1="140" x2="250" y2="160" stroke="#9aa5b1" marker-end="url(#arrow)"/>
    <text x="248" y="156" fill="#cbd5df" font-size="12">y (base width)</text>
    <!-- height z -->
    <line x1="270" y1="160" x2="270" y2="70" stroke="#9aa5b1" marker-end="url(#arrow)"/>
    <text x="284" y="70" fill="#cbd5df" font-size="12" transform="rotate(-90 284,70)">z (height)</text>
  </svg>`;
}

function resetAll(){
  $("shape").value = 'box';
  $("len").value = '';
  $("wid").value = '';
  $("hgt").value = '';
  $("qty").value = 1;
  $("lenUnit").value = 'ft';
  $("widUnit").value = 'ft';
  $("hgtUnit").value = 'in';
  $("outUnit").value = 'ft3';
  $("results").hidden = true;
  updateShapeUI();
}

// Wire up
$("calcBtn").addEventListener('click', compute);
$("resetBtn").addEventListener('click', resetAll);
$("shape").addEventListener('change', updateShapeUI);

for (const id of ['len','wid','hgt','qty','lenUnit','widUnit','hgtUnit','outUnit']){
  $(id).addEventListener('input', ()=>{
    const shape = $("shape").value;
    const dimsPresent = shape === 'cylinder' ?
      [$("len").value !== '', $("hgt").value !== ''].every(Boolean) :
      [$("len").value !== '', $("wid").value !== '', $("hgt").value !== ''].every(Boolean);
    if (dimsPresent) compute();
  });
  $(id).addEventListener('change', compute);
}

// Init
resetAll();
