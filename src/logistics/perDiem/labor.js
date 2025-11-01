const els = {
  // Manpower inputs
  labor_total: q('labor_total'), days: q('days'), hours_day: q('hours_day'),
  blended_rate: q('blended_rate'), util: q('util'), subs_pct: q('subs_pct'),
  crew: q('crew'), subs: q('subs'), rooms: q('rooms'), nights: q('nights'),
  crew_override: q('crew_override'), subs_override: q('subs_override'),
  rooms_override: q('rooms_override'), nights_override: q('nights_override'),
  headcount: q('headcount'), man_days: q('man_days'), man_hours: q('man_hours'),

  // Per-diem
  file_input: q('file_input'), file_status: q('file_status'), perdiem_section: q('perdiem_section'),
  locality_search: q('locality_search'), season: q('season'), effective: q('effective'),
  mie: q('mie'), lodging_cap: q('lodging_cap'), lodging_rate: q('lodging_rate'),
  proportional_meals: q('proportional_meals'),
  mie_total: q('mie_total'), lodging_total: q('lodging_total'), perdiem_total: q('perdiem_total')
};
function q(id){return document.getElementById(id);}
function currency(n){return isNaN(n)?'—':n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});}
function num(n,dec=0){return isNaN(n)?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:dec});}

let RATES=[], localityIndex={};

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}

// === Auto crew/subs/rooms/nights logic with overrides ===
function recalcManpower(){
  const labor = +els.labor_total.value||0;
  const days = clamp(+els.days.value||0, 0, 10000);
  const hpd = clamp(+els.hours_day.value||0, 0, 24);
  const rate = Math.max(1, +els.blended_rate.value||0);
  const util = clamp(+els.util.value||100, 1, 100) / 100;
  const subsPct = clamp(+els.subs_pct.value||0, 0, 100) / 100;

  // Headcount from totals
  const denom = rate * hpd * Math.max(1, days) * util;
  let head = denom>0 ? Math.ceil(labor / denom) : 0;
  head = Math.max(0, head);

  // Split into crew/subs unless overridden
  let crew = Math.round(head * (1 - subsPct));
  let subs = head - crew;

  if(els.crew_override.checked){
    crew = Math.max(0, +els.crew.value||0);
  } else {
    els.crew.value = crew;
  }

  if(els.subs_override.checked){
    subs = Math.max(0, +els.subs.value||0);
  } else {
    els.subs.value = subs;
  }

  // Rooms auto = crew + subs (unless override)
  const autoRooms = crew + subs;
  if(els.rooms_override.checked){
    // keep user value
  } else {
    els.rooms.value = autoRooms;
  }

  // Nights auto = days (unless override)
  if(els.nights_override.checked){
    // keep user value
  } else {
    els.nights.value = days;
  }

  const crewUsed = +els.crew.value||0;
  const subsUsed = +els.subs.value||0;
  const headUsed = crewUsed + subsUsed;

  const manDays = headUsed * days;
  const manHours = manDays * hpd;

  els.headcount.textContent = num(headUsed);
  els.man_days.textContent = num(manDays);
  els.man_hours.textContent = num(manHours);

  // Update per-diem if autos moved
  recalcPerDiem();
}

function toggleOverride(checkbox, inputEl){
  const on = checkbox.checked;
  inputEl.disabled = !on;
  if(!on){ recalcManpower(); } // refresh autos if turning override off
}

// === Per-diem loading & selection ===
function loadFile(e){
  const file=e.target.files[0];
  if(!file){els.file_status.textContent="No file loaded";return;}
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      RATES=JSON.parse(ev.target.result);
      localityIndex={};
      for(const r of RATES){
        const key=(r.Locality||'').toUpperCase().trim();
        if(!localityIndex[key]) localityIndex[key]=[];
        localityIndex[key].push(r);
      }
      els.file_status.textContent=`Loaded ${RATES.length} records`;
      els.perdiem_section.classList.remove('hidden');
    }catch(err){
      els.file_status.textContent="Invalid JSON";
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function onLocality(){
  const val=els.locality_search.value.toUpperCase().trim();
  if(!val){updateSeasons('');return;}
  if(localityIndex[val]){updateSeasons(val);return;}
  const hit=Object.keys(localityIndex).find(k=>k.includes(val));
  if(hit) updateSeasons(hit);
}

function updateSeasons(loc){
  const key=(loc||'').toUpperCase().trim();
  const entries=localityIndex[key]||[];
  els.season.innerHTML='';
  entries.forEach((r,i)=>{
    const opt=document.createElement('option');
    opt.value=i; opt.textContent=r.Seasons||'All Year';
    els.season.appendChild(opt);
  });
  if(entries.length){els.season.value='0';fillRates(entries[0]);}
  else fillRates(null);
}

function pickSeason(){ 
  const val=els.locality_search.value.toUpperCase().trim();
  const entries=localityIndex[val]||[];
  const rec=entries[+els.season.value||0]; fillRates(rec);
}

function fillRates(r){
  if(!r){els.mie.value='';els.lodging_cap.value='';els.proportional_meals.value='';els.effective.value='';recalcPerDiem();return;}
  const meals=+r.Local_Meals||0,incid=+r.Local_Incidental||0;
  els.mie.value=(meals+incid).toFixed(0);
  els.lodging_cap.value=(+r.Max_Lodging||0).toFixed(0);
  els.proportional_meals.value=(+r.Proportional_Meals||0).toFixed(0);
  els.effective.value=r.Effective_Date||'';
  recalcPerDiem();
}

// === Per-diem calcs (uses crew/subs/rooms/nights current values) ===
function recalcPerDiem(){
  const mie=+els.mie.value||0,cap=+els.lodging_cap.value||0,rate=+els.lodging_rate.value||cap;
  const crew=+els.crew.value||0,subs=+els.subs.value||0,rooms=+els.rooms.value||0,nights=+els.nights.value||0;
  const head=crew+subs;
  const mieTot=mie*head*nights, lodgTot=rate*rooms*nights, grand=mieTot+lodgTot;
  els.mie_total.textContent=currency(mieTot);
  els.lodging_total.textContent=currency(lodgTot);
  els.perdiem_total.textContent=currency(grand);
}

// === Wire events ===
['labor_total','days','hours_day','blended_rate','util','subs_pct'].forEach(id=>q(id).addEventListener('input',recalcManpower));

// Override toggles
els.crew_override.addEventListener('change',()=>toggleOverride(els.crew_override, els.crew));
els.subs_override.addEventListener('change',()=>toggleOverride(els.subs_override, els.subs));
els.rooms_override.addEventListener('change',()=>toggleOverride(els.rooms_override, els.rooms));
els.nights_override.addEventListener('change',()=>toggleOverride(els.nights_override, els.nights));

// Manual edits when overridden
['crew','subs','rooms','nights','lodging_rate'].forEach(id=>q(id).addEventListener('input',()=>{recalcManpower();recalcPerDiem();}));

// Per-diem file + locality
els.file_input.addEventListener('change',loadFile);
els.locality_search.addEventListener('input',onLocality);
els.season.addEventListener('change',pickSeason);

// Init
// Start with all override inputs disabled (auto mode)
els.crew.disabled = true; els.subs.disabled = true; els.rooms.disabled = true; els.nights.disabled = true;
recalcManpower();
