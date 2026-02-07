// Universal Units Catalog and conversion helpers

const deg = Math.PI/180;
function u(sym, name, toBase, fromBase, affine=false){ return {sym, name, toBase, fromBase, affine}; }

export const Units = {
  Length: {
    base: 'm',
    units: [
      u('mm','Millimeter', v=>v/1000, v=>v*1000),
      u('cm','Centimeter', v=>v/100, v=>v*100),
      u('m','Meter', v=>v, v=>v),
      u('km','Kilometer', v=>v*1000, v=>v/1000),
      u('in','Inch', v=>v*0.0254, v=>v/0.0254),
      u('ft','Foot', v=>v*0.3048, v=>v/0.3048),
      u('yd','Yard', v=>v*0.9144, v=>v/0.9144),
      u('mi','Mile', v=>v*1609.344, v=>v/1609.344)
    ]
  },
  Area: {
    base: 'm²',
    units: [
      u('mm²','Square Millimeter', v=>v/1e6, v=>v*1e6),
      u('cm²','Square Centimeter', v=>v/1e4, v=>v*1e4),
      u('m²','Square Meter', v=>v, v=>v),
      u('ha','Hectare', v=>v*1e4, v=>v/1e4),
      u('km²','Square Kilometer', v=>v*1e6, v=>v/1e6),
      u('in²','Square Inch', v=>v*0.00064516, v=>v/0.00064516),
      u('ft²','Square Foot', v=>v*0.09290304, v=>v/0.09290304),
      u('yd²','Square Yard', v=>v*0.83612736, v=>v/0.83612736),
      u('ac','Acre', v=>v*4046.8564224, v=>v/4046.8564224)
    ]
  },
  Volume: {
    base: 'm³',
    units: [
      u('mL','Milliliter', v=>v/1e6, v=>v*1e6),
      u('L','Liter', v=>v/1000, v=>v*1000),
      u('m³','Cubic Meter', v=>v, v=>v),
      u('in³','Cubic Inch', v=>v*1.6387064e-5, v=>v/1.6387064e-5),
      u('ft³','Cubic Foot', v=>v*0.028316846592, v=>v/0.028316846592),
      u('yd³','Cubic Yard', v=>v*0.764554857984, v=>v/0.764554857984),
      u('gal','US Gallon', v=>v*0.003785411784, v=>v/0.003785411784),
      u('qt','US Quart', v=>v*0.000946352946, v=>v/0.000946352946),
      u('pt','US Pint', v=>v*0.000473176473, v=>v/0.000473176473),
      { sym:'bf', name:'Board Foot', toBase:v=> v * (144 * 1.6387064e-5), fromBase:v=> v / (144 * 1.6387064e-5) }
    ]
  },
  Mass: {
    base: 'kg',
    units: [
      u('g','Gram', v=>v/1000, v=>v*1000),
      u('kg','Kilogram', v=>v, v=>v),
      u('t','Metric Tonne', v=>v*1000, v=>v/1000),
      u('oz','Ounce (avdp)', v=>v*0.028349523125, v=>v/0.028349523125),
      u('lb','Pound (lbm)', v=>v*0.45359237, v=>v/0.45359237),
      u('ton (US)','Short Ton (US)', v=>v*907.18474, v=>v/907.18474),
      u('ton (UK)','Long Ton (UK)', v=>v*1016.0469088, v=>v/1016.0469088)
    ]
  },
  Force: {
    base: 'N',
    units: [
      u('N','Newton', v=>v, v=>v),
      u('kN','Kilonewton', v=>v*1000, v=>v/1000),
      u('lbf','Pound-force', v=>v*4.4482216152605, v=>v/4.4482216152605),
      u('kip','Kip', v=>v*4448.2216152605, v=>v/4448.2216152605)
    ]
  },
  Pressure: {
    base: 'Pa',
    units: [
      u('Pa','Pascal', v=>v, v=>v),
      u('kPa','Kilopascal', v=>v*1000, v=>v/1000),
      u('MPa','Megapascal', v=>v*1e6, v=>v/1e6),
      u('bar','Bar', v=>v*1e5, v=>v/1e5),
      u('atm','Atmosphere', v=>v*101325, v=>v/101325),
      u('torr','Torr (mmHg)', v=>v*133.322368, v=>v/133.322368),
      u('psi','Pound per sq in', v=>v*6894.757293168, v=>v/6894.757293168),
      u('psf','Pound per sq ft', v=>v*47.88025898033584, v=>v/47.88025898033584),
      u('inH2O','inches of water (4°C)', v=>v*249.08891, v=>v/249.08891),
      u('inHg','inches of mercury (0°C)', v=>v*3386.389, v=>v/3386.389)
    ]
  },
  Temperature: {
    base: 'K',
    units: [
      { sym:'°C', name:'Celsius', toBase:v=>v+273.15, fromBase:v=>v-273.15, affine:true },
      { sym:'K', name:'Kelvin', toBase:v=>v, fromBase:v=>v, affine:true },
      { sym:'°F', name:'Fahrenheit', toBase:v=>(v-32)*5/9+273.15, fromBase:v=> (v-273.15)*9/5+32, affine:true }
    ]
  },
  Energy: {
    base: 'J',
    units: [
      u('J','Joule', v=>v, v=>v),
      u('kJ','Kilojoule', v=>v*1000, v=>v/1000),
      u('MJ','Megajoule', v=>v*1e6, v=>v/1e6),
      u('Wh','Watt-hour', v=>v*3600, v=>v/3600),
      u('kWh','Kilowatt-hour', v=>v*3.6e6, v=>v/3.6e6),
      u('BTU','BTU (IT)', v=>v*1055.056, v=>v/1055.056),
      u('therm','Therm (US)', v=>v*105505585.257348, v=>v/105505585.257348)
    ]
  },
  Power: {
    base: 'W',
    units: [
      u('W','Watt', v=>v, v=>v),
      u('kW','Kilowatt', v=>v*1000, v=>v/1000),
      u('MW','Megawatt', v=>v*1e6, v=>v/1e6),
      u('hp','Horsepower (mech)', v=>v*745.6998715822702, v=>v/745.6998715822702),
      u('tonR','Ton Refrigeration', v=>v*3516.8528420667, v=>v/3516.8528420667),
      u('BTU/h','BTU per hour', v=>v*1055.056/3600, v=>v/(1055.056/3600)),
      { sym:'MBH', name:'MBH (1k BTU/h)', toBase:v=> (v*1000)*1055.056/3600, fromBase:v=> (v/(1055.056/3600))/1000 }
    ]
  },
  'Apparent Power': {
    base: 'VA',
    units: [
      u('VA','Volt-ampere', v=>v, v=>v),
      u('kVA','Kilovolt-ampere', v=>v*1000, v=>v/1000),
      u('MVA','Megavolt-ampere', v=>v*1e6, v=>v/1e6)
    ]
  },
  'Volumetric Flow': {
    base: 'm³/s',
    units: [
      u('m³/s','Cubic meter/sec', v=>v, v=>v),
      u('L/s','Liter/sec', v=>v/1000, v=>v*1000),
      u('m³/h','Cubic meter/hour', v=>v/3600, v=>v*3600),
      u('cfm','Cubic foot/min', v=>v*0.000471947443, v=>v/0.000471947443),
      u('gpm','US gallon/min', v=>v*6.30901964e-5, v=>v/6.30901964e-5),
      u('scfm','Std cubic ft/min', v=>v*0.000471947443, v=>v/0.000471947443)
    ]
  },
  Velocity: {
    base: 'm/s',
    units: [
      u('m/s','Meters/sec', v=>v, v=>v),
      u('km/h','Kilometers/hour', v=>v/3.6, v=>v*3.6),
      u('ft/s','Feet/sec', v=>v*0.3048, v=>v/0.3048),
      u('fpm','Feet/min', v=>v*0.00508, v=>v/0.00508),
      u('mph','Miles/hour', v=>v*0.44704, v=>v/0.44704),
      u('kn','Knots', v=>v*0.514444, v=>v/0.514444)
    ]
  },
  Density: {
    base: 'kg/m³',
    units: [
      u('kg/m³','Kilogram/m³', v=>v, v=>v),
      u('g/cm³','Gram/cm³', v=>v*1000, v=>v/1000),
      u('lb/ft³','Pound/ft³ (pcf)', v=>v*16.01846337396, v=>v/16.01846337396),
      u('lb/in³','Pound/in³', v=>v*27679.904710191, v=>v/27679.904710191),
      u('lb/gal','Pound/US gallon', v=>v*119.826427316, v=>v/119.826427316)
    ]
  },
  'Linear Density': {
    base: 'kg/m',
    units: [
      u('kg/m','Kilogram per meter', v=>v, v=>v),
      u('lb/ft','Pound per foot', v=>v*1.48816394357, v=>v/1.48816394357),
      u('lb/in','Pound per inch', v=>v*17.8579673228, v=>v/17.8579673228)
    ]
  },
  Torque: {
    base: 'N·m',
    units: [
      u('N·m','Newton·meter', v=>v, v=>v),
      u('kN·m','Kilonewton·meter', v=>v*1000, v=>v/1000),
      u('ft·lbf','Foot·pound', v=>v*1.3558179483314, v=>v/1.3558179483314),
      u('in·lbf','Inch·pound', v=>v*0.1129848290276167, v=>v/0.1129848290276167)
    ]
  },
  'Angle / Slope': {
    base: 'rad',
    units: [
      u('rad','Radian', v=>v, v=>v, true),
      u('°','Degree', v=>v*deg, v=>v/deg, true),
      { sym:'% grade', name:'Percent Grade', affine:true, toBase:(v)=>Math.atan(v/100), fromBase:(r)=>Math.tan(r)*100 },
      { sym:'in/ft', name:'Inches per foot', affine:true, toBase:(v)=>Math.atan((v)/12), fromBase:(r)=>Math.tan(r)*12 }
    ]
  },
  'Thermal Resistance (R/RSI)': {
    base: 'm²·K/W',
    units: [
      u('RSI','m²·K/W (SI R)', v=>v, v=>v),
      { sym:'R', name:'hr·ft²·°F/BTU', toBase:v=>v*0.1761101838, fromBase:v=>v/0.1761101838 }
    ]
  },
  'Thermal Transmittance (U)': {
    base: 'W/m²·K',
    units: [
      u('W/m²·K','SI U-factor', v=>v, v=>v),
      { sym:'BTU/(h·ft²·°F)', name:'IP U-factor', toBase:v=>v*5.678263, fromBase:v=>v/5.678263 }
    ]
  }
};

export function getUnit(category, symbol){
  const cat = Units[category]; if(!cat) return undefined;
  return cat.units.find(u => u.sym === symbol);
}

export function convert(value, category, from, to){
  const f = getUnit(category, from); const t = getUnit(category, to);
  if(!f || !t) throw new Error('Unit not found');
  const baseVal = f.toBase(value);
  return t.fromBase(baseVal);
}

export function formatSig(x, sigFigs=4){
  if(!isFinite(x)) return '—';
  const digits = Math.max(2, Math.min(12, sigFigs|0));
  const formatter = new Intl.NumberFormat('en-US', {
    maximumSignificantDigits: digits,
    useGrouping: true
  });
  return formatter.format(x === 0 ? 0 : x);
}
