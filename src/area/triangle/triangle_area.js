// Triangle Area Calculator (ESM)

const methodSel = document.getElementById('method');
const unitsSel = document.getElementById('units');
const resultEl = document.getElementById('result');
const detailsEl = document.getElementById('outputDetails');
const historyEl = document.getElementById('history');

const sections = {
  baseHeight: document.getElementById('baseHeight'),
  heron: document.getElementById('heron'),
  sas: document.getElementById('sas'),
  coordinates: document.getElementById('coordinates')
};

const methodLabels = {
  baseHeight: 'Base & Height',
  heron: "Three Sides (Heron's Formula)",
  sas: 'Two Sides & Included Angle',
  coordinates: 'Coordinates'
};

function switchMethod(){
  const methods = Object.keys(sections);
  const selected = methodSel.value;
  methods.forEach(id => sections[id].classList.remove('visible'));
  sections[selected].classList.add('visible');
  calculate();
}

function formatNumber(value){
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function readNumericInput(id, label){
  const raw = document.getElementById(id).value;
  const value = parseFloat(raw);
  if(!raw || !isFinite(value)){
    throw new Error(`Enter a valid number for ${label}.`);
  }
  return value;
}

const methodHandlers = {
  baseHeight(){
    const base = readNumericInput('base', 'base');
    const height = readNumericInput('height', 'height');
    if(base <= 0 || height <= 0){
      throw new Error('Base and height must be greater than zero.');
    }
    const area = 0.5 * base * height;
    return {
      area,
      breakdown: `½ × base (${formatNumber(base)}) × height (${formatNumber(height)})`,
      summary: `base=${formatNumber(base)}, height=${formatNumber(height)}`
    };
  },
  heron(){
    const a = readNumericInput('a', 'side a');
    const b = readNumericInput('b', 'side b');
    const c = readNumericInput('c', 'side c');
    if(a <= 0 || b <= 0 || c <= 0){
      throw new Error('All sides must be greater than zero.');
    }
    if(a + b <= c || a + c <= b || b + c <= a){
      throw new Error('The side lengths must satisfy the triangle inequality.');
    }
    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    return {
      area,
      breakdown: `√(s(s − a)(s − b)(s − c)), where s = (${formatNumber(a)} + ${formatNumber(b)} + ${formatNumber(c)}) ÷ 2 = ${formatNumber(s)}`,
      summary: `a=${formatNumber(a)}, b=${formatNumber(b)}, c=${formatNumber(c)}`
    };
  },
  sas(){
    const side1 = readNumericInput('side1', 'side 1');
    const side2 = readNumericInput('side2', 'side 2');
    const angle = readNumericInput('angle', 'included angle');
    if(side1 <= 0 || side2 <= 0){
      throw new Error('Sides must be greater than zero.');
    }
    const unitType = document.getElementById('angleUnit').value;
    const theta = unitType === 'deg' ? angle * Math.PI / 180 : angle;
    if(theta <= 0 || theta >= Math.PI){
      throw new Error('The included angle must be between 0 and 180 degrees (0 and π radians).');
    }
    const area = 0.5 * side1 * side2 * Math.sin(theta);
    const angleLabel = unitType === 'deg' ? `${formatNumber(angle)}°` : `${formatNumber(angle)} rad`;
    return {
      area,
      breakdown: `½ × side₁ (${formatNumber(side1)}) × side₂ (${formatNumber(side2)}) × sin(${angleLabel})`,
      summary: `side₁=${formatNumber(side1)}, side₂=${formatNumber(side2)}, θ=${angleLabel}`
    };
  },
  coordinates(){
    const x1 = readNumericInput('x1', 'x₁');
    const y1 = readNumericInput('y1', 'y₁');
    const x2 = readNumericInput('x2', 'x₂');
    const y2 = readNumericInput('y2', 'y₂');
    const x3 = readNumericInput('x3', 'x₃');
    const y3 = readNumericInput('y3', 'y₃');
    const determinant = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
    const area = Math.abs(determinant / 2);
    if(area === 0){
      throw new Error('The provided points are collinear; they do not form a triangle.');
    }
    return {
      area,
      breakdown: `½ × |x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)| = ½ × |${formatNumber(determinant)}|`,
      summary: `P₁(${formatNumber(x1)}, ${formatNumber(y1)}), P₂(${formatNumber(x2)}, ${formatNumber(y2)}), P₃(${formatNumber(x3)}, ${formatNumber(y3)})`
    };
  }
};

function calculate(){
  const method = methodSel.value;
  const unit = unitsSel.value;
  const handler = methodHandlers[method];
  try{
    if(!handler){
      throw new Error('Unknown method selected.');
    }
    const { area, breakdown, summary } = handler();
    if(!isFinite(area) || area <= 0){
      throw new Error('Invalid input');
    }
    const formattedArea = formatNumber(area);
    resultEl.innerText = `Area: ${formattedArea} ${unit}`;
    detailsEl.innerText = `${breakdown} = ${formattedArea} ${unit}`;
    addToHistory(methodLabels[method], formattedArea, unit, summary);
  }catch(e){
    resultEl.innerText = 'Area: Invalid input';
    detailsEl.innerText = e.message || 'Please review your entries and try again.';
  }
}

function addToHistory(methodLabel, area, unit, summary){
  const line = document.createElement('div');
  line.className = 'history-entry';
  line.innerHTML = `<strong>${area} ${unit}</strong> · ${methodLabel}<br><span style="font-weight:500; color: rgba(15,23,42,0.72)">${summary}</span>`;
  historyEl.appendChild(line);
}

// Wire events
methodSel.addEventListener('change', switchMethod);
unitsSel.addEventListener('change', calculate);
// Recalculate on input for all inputs in the page
Array.from(document.querySelectorAll('input')).forEach(inp => inp.addEventListener('input', calculate));

// Initial render
switchMethod();
