// Triangle Area Calculator (ESM)

const methodSel = document.getElementById('method');
const unitsSel = document.getElementById('units');
const resultEl = document.getElementById('result');
const historyEl = document.getElementById('history');

const sections = {
  baseHeight: document.getElementById('baseHeight'),
  heron: document.getElementById('heron'),
  sas: document.getElementById('sas'),
  coordinates: document.getElementById('coordinates')
};

function switchMethod(){
  const methods = Object.keys(sections);
  const selected = methodSel.value;
  methods.forEach(id => sections[id].classList.remove('visible'));
  sections[selected].classList.add('visible');
  calculate();
}

function calculate(){
  const method = methodSel.value;
  const unit = unitsSel.value;
  let area = 0;
  try{
    if(method === 'baseHeight'){
      const b = parseFloat(document.getElementById('base').value);
      const h = parseFloat(document.getElementById('height').value);
      area = 0.5 * b * h;
    }else if(method === 'heron'){
      const a = parseFloat(document.getElementById('a').value);
      const b = parseFloat(document.getElementById('b').value);
      const c = parseFloat(document.getElementById('c').value);
      const s = (a + b + c) / 2;
      area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    }else if(method === 'sas'){
      const s1 = parseFloat(document.getElementById('side1').value);
      const s2 = parseFloat(document.getElementById('side2').value);
      const angle = parseFloat(document.getElementById('angle').value);
      const unitType = document.getElementById('angleUnit').value;
      const theta = unitType === 'deg' ? angle * Math.PI / 180 : angle;
      area = 0.5 * s1 * s2 * Math.sin(theta);
    }else if(method === 'coordinates'){
      const x1 = parseFloat(document.getElementById('x1').value);
      const y1 = parseFloat(document.getElementById('y1').value);
      const x2 = parseFloat(document.getElementById('x2').value);
      const y2 = parseFloat(document.getElementById('y2').value);
      const x3 = parseFloat(document.getElementById('x3').value);
      const y3 = parseFloat(document.getElementById('y3').value);
      area = Math.abs((x1*(y2-y3) + x2*(y3-y1) + x3*(y1-y2)) / 2);
    }

    if(!isFinite(area) || area <= 0) throw new Error('Invalid input');
    resultEl.innerText = `Area: ${area.toFixed(2)} ${unit}`;
    addToHistory(area.toFixed(2), unit);
  }catch(e){
    resultEl.innerText = 'Area: Invalid input';
  }
}

function addToHistory(area, unit){
  const line = document.createElement('div');
  line.textContent = `→ ${area} ${unit}`;
  historyEl.appendChild(line);
}

// Wire events
methodSel.addEventListener('change', switchMethod);
unitsSel.addEventListener('change', calculate);
// Recalculate on input for all inputs in the page
Array.from(document.querySelectorAll('input')).forEach(inp => inp.addEventListener('input', calculate));

// Initial render
switchMethod();
