// ✅ PDF.js UMD (3.x) so window.pdfjsLib exists
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
} else {
  console.error("PDF.js failed to load — pdfjsLib is undefined.");
}

// ✅ Tesseract.js (OCR fallback) - loaded via script tag

(function(){
  // ---------- Constants ----------
  const GAUGE_LB_SF = { "26":0.903, "24":1.219, "22":1.500, "20":1.875, "18":2.344, "16":2.969 };

  // Material factors (multiplier on base galvanized lb/sf)
  const MATERIALS = {
    "Galvanized": { factor: 1.00, priceKey: "priceGalv" },
    "Stainless":  { factor: 1.02, priceKey: "priceSS" },
    "Aluminum":   { factor: 0.35, priceKey: "priceAl" },
    "Black":      { factor: 1.00, priceKey: "priceBlk" }
  };

  // Liner presets (lb/sf)
  const LINER_LB_SF = { "none":0.0, '1"':0.15, '1.5"':0.19, '2"':0.25 };

  // Pressure-class-based labor (hr/LF) — baseline budgetary
  const LABOR_HR_PER_LF_PC = { "+2":0.18, "-2":0.18, "+3":0.20, "+4":0.22, "+6":0.26 };
  const SIZE_BUMP_PER_IN = 0.0006; // add to hr/LF: bump * (perimeter in)

  // Flange systems: per joint material & labor adders
  const FLANGE = {
    "none": { lb_per_joint:0.0, hr_per_joint:0.00 },
    "S&D":  { lb_per_joint:1.5, hr_per_joint:0.05 },
    "TDC":  { lb_per_joint:2.5, hr_per_joint:0.08 },
    "TDF":  { lb_per_joint:3.0, hr_per_joint:0.10 }
  };

  // Perimeter-based auto-gauge (fallback)
  function autoGaugePerimeter(perimIn){
    if (perimIn <= 60) return "26";
    if (perimIn <= 90) return "24";
    if (perimIn <= 130) return "22";
    if (perimIn <= 170) return "20";
    if (perimIn <= 210) return "18";
    return "16";
  }

  // Simplified SMACNA-style gauge by pressure class and short side (in)
  function smacnaGauge(pressClass, shortSideIn){
    const pc = String(pressClass);
    let g;
    if (pc === "+2" || pc === "-2") {
      if (shortSideIn <= 20) g = "26";
      else if (shortSideIn <= 30) g = "24";
      else if (shortSideIn <= 40) g = "22";
      else if (shortSideIn <= 60) g = "20";
      else g = "18";
    } else if (pc === "+3" || pc === "+4") {
      if (shortSideIn <= 20) g = "24";
      else if (shortSideIn <= 30) g = "22";
      else if (shortSideIn <= 40) g = "20";
      else if (shortSideIn <= 60) g = "18";
      else g = "16";
    } else { // +6 and higher
      if (shortSideIn <= 20) g = "22";
      else if (shortSideIn <= 30) g = "20";
      else if (shortSideIn <= 40) g = "18";
      else g = "16";
    }
    return g;
  }

  // ---------- Helpers ----------
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  function currency(x){ return isFinite(x) ? x.toLocaleString(undefined,{style:'currency',currency:'USD'}) : ""; }
  function fixed(x,d=2){ return isFinite(x) ? x.toLocaleString(undefined,{maximumFractionDigits:d}) : ""; }

  function parseSize(str, type){
    const s = (str||"").trim();
    if(!s) return null;
    if(type === "round"){
      const m = s.match(/(\d+(\.\d+)?)/);
      if(!m) return null;
      return { type:"round", d: parseFloat(m[1]) };
    }
    const m = s.match(/(\d+(\.\d+)?)\s*(?:[xX\/])\s*(\d+(\.\d+)?)/);
    if(!m) return null;
    return { type:"rect", w: parseFloat(m[1]), h: parseFloat(m[3]) };
  }
  function perimeterIn(parsed){
    if(!parsed) return 0;
    if(parsed.type==="rect") return 2*((parsed.w||0)+(parsed.h||0));
    if(parsed.type==="round") return Math.PI*(parsed.d||0);
    return 0;
  }
  function shortSideIn(parsed){
    if(!parsed) return 0;
    if(parsed.type==="rect") return Math.min(parsed.w||0, parsed.h||0);
    if(parsed.type==="round") return parsed.d||0;
    return 0;
  }

  function readGlobals(){
    return {
      autoMode: $("#autoMode").value,
      pressClass: $("#pressClass").value,
      wastePct: (parseFloat($("#wastePct").value)||0)/100,
      shipPct: (parseFloat($("#shipPct").value)||0)/100,
      handPct: (parseFloat($("#handPct").value)||0)/100,
      remotePct: (parseFloat($("#remotePct").value)||0)/100,
      laborRate: parseFloat($("#laborRate").value)||0,
      laborUnitDefault: parseFloat($("#laborUnit").value)||0,
      applyRemote: $("#applyRemote").checked,
      demoMode: $("#demoMode").checked,
      dispPerLb: parseFloat($("#dispPerLb").value)||0,
      priceGalv: parseFloat($("#priceGalv").value)||0,
      priceSS:   parseFloat($("#priceSS").value)||0,
      priceAl:   parseFloat($("#priceAl").value)||0,
      priceBlk:  parseFloat($("#priceBlk").value)||0
    };
  }

  function pricePerLbFor(material, G){
    const key = MATERIALS[material]?.priceKey || "priceGalv";
    return G[key] ?? G.priceGalv;
  }
  function materialFactor(material){
    return MATERIALS[material]?.factor ?? 1.0;
  }

  // ---------- Row UI ----------
  const body = $("#body");
  function rowTemplate(){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <select class="type compact">
          <option value="rect">Rect</option>
          <option value="round">Round</option>
        </select>
      </td>
      <td><input class="size size" placeholder="24/18 or 18 (Ø)" /></td>
      <td><input class="lf num" type="number" min="0" step="0.01" value="0"></td>

      <td>
        <select class="material compact">
          <option>Galvanized</option>
          <option>Stainless</option>
          <option>Aluminum</option>
          <option>Black</option>
        </select>
      </td>

      <td>
        <select class="gauge compact">
          <option value="26">26</option><option value="24">24</option>
          <option value="22">22</option><option value="20">20</option>
          <option value="18">18</option><option value="16">16</option>
        </select>
      </td>
      <td><label class="mini"><input type="checkbox" class="autoG" checked> Auto</label></td>

      <td><input class="laborUnit num" type="number" step="0.01"></td>
      <td><label class="mini"><input type="checkbox" class="autoLabor" checked> Auto</label></td>

      <td>
        <select class="liner compact">
          <option value="none">None</option>
          <option value='1"'>1"</option>
          <option value='1.5"'>1.5"</option>
          <option value='2"'>2"</option>
        </select>
      </td>
      <td><input class="addLbSf num" type="number" step="0.01" value="0"></td>
      <td><input class="addLbLf num" type="number" step="0.01" value="0"></td>

      <td>
        <select class="flange compact">
          <option value="none">None</option>
          <option value="S&D">S&amp;D</option>
          <option value="TDC">TDC</option>
          <option value="TDF">TDF</option>
        </select>
      </td>
      <td><input class="jointFt num" type="number" step="0.1" value="5"></td>

      <td class="perim mono"></td>
      <td class="area mono"></td>
      <td class="weight mono"></td>
      <td class="mat mono cost-col"></td>
      <td class="ship mono cost-col"></td>
      <td class="labor mono cost-col"></td>
      <td class="disp mono demo-col hidden"></td>
      <td class="total mono"></td>
      <td class="btn-cell"><button class="ghost del">✕</button></td>
    `;
    return tr;
  }

  function addRow(prefill){
    const tr = rowTemplate();
    body.appendChild(tr);

    const G = readGlobals();
    tr.querySelector(".laborUnit").value = G.laborUnitDefault;

    if(prefill){
      tr.querySelector(".type").value = prefill.type || "rect";
      tr.querySelector(".size").value = prefill.size || "";
      if(prefill.lf != null) tr.querySelector(".lf").value = prefill.lf;
      if(prefill.material) tr.querySelector(".material").value = prefill.material;
      if(prefill.gauge) tr.querySelector(".gauge").value = prefill.gauge;
    }

    bindRow(tr);
    recalc();
  }

  function bindRow(tr){
    tr.addEventListener("input", recalc);
    tr.querySelector(".del").addEventListener("click", ()=>{ tr.remove(); recalc(); });
    tr.querySelector(".type").addEventListener("change", ()=>{
      tr.querySelector(".size").placeholder =
        (tr.querySelector(".type").value === "round") ? "Diameter (e.g., 18)" : "24/18 or 24x18";
      recalc();
    });
  }

  // ---------- Totals + Recalc ----------
  const totals = {
    perim: $("#tPerim"), area: $("#tArea"), weight: $("#tWeight"),
    mat: $("#tMat"), ship: $("#tShip"), labor: $("#tLabor"), disp: $("#tDisp"), total: $("#tTotal")
  };

  function recalc(){
    const G = readGlobals();

    // toggle demo vs cost columns
    $$(".cost-col").forEach(el=> el.classList.toggle("hidden", G.demoMode));
    $$(".demo-col").forEach(el=> el.classList.toggle("hidden", !G.demoMode));
    $("#demoInputs").classList.toggle("hidden", !G.demoMode);

    let tPerim=0, tArea=0, tWeight=0, tMat=0, tShip=0, tLabor=0, tDisp=0, tTotal=0;

    $$("#body tr").forEach(tr=>{
      const type = tr.querySelector(".type").value;
      const sizeStr = tr.querySelector(".size").value;
      const lf = parseFloat(tr.querySelector(".lf").value)||0;

      const material = tr.querySelector(".material").value;
      const matFactor = materialFactor(material);

      const autoG = tr.querySelector(".autoG").checked;
      const gSel = tr.querySelector(".gauge").value;

      const autoLabor = tr.querySelector(".autoLabor").checked;
      let unitHr = parseFloat(tr.querySelector(".laborUnit").value)||0;

      const linerKey = tr.querySelector(".liner").value;
      const addLbSf = parseFloat(tr.querySelector(".addLbSf").value)||0;
      const addLbLf = parseFloat(tr.querySelector(".addLbLf").value)||0;

      const flangeKey = tr.querySelector(".flange").value;
      const jointFt = Math.max(0.1, parseFloat(tr.querySelector(".jointFt").value)||5);
      const joints = lf>0 ? (lf / jointFt) : 0;

      let perimIn=0, areaSf=0, weightLb=0, matCost=0, shipCost=0, laborCost=0, dispCost=0, total=0;

      const parsed = parseSize(sizeStr, type);
      if(parsed && lf>0){
        perimIn = perimeterIn(parsed);
        const waste = 1 + (G.wastePct||0);
        areaSf = (perimIn/12) * lf * waste;

        // Gauge
        let gUse = gSel;
        if(autoG){
          if(G.autoMode === "smacna") gUse = smacnaGauge(G.pressClass, shortSideIn(parsed));
          else gUse = autoGaugePerimeter(perimIn);
          tr.querySelector(".gauge").title = `Auto → ${gUse}ga`;
        } else {
          tr.querySelector(".gauge").title = '';
        }

        // Auto Labor by pressure class (+ size bump)
        if(autoLabor){
          unitHr = (LABOR_HR_PER_LF_PC[G.pressClass] ?? G.laborUnitDefault) + (SIZE_BUMP_PER_IN * perimIn);
          tr.querySelector(".laborUnit").value = unitHr.toFixed(3);
          tr.querySelector(".laborUnit").title = `Auto from ${G.pressClass} + size bump`;
        } else {
          tr.querySelector(".laborUnit").title = '';
        }

        // Weight calc
        const lbPerSfMetalBase = GAUGE_LB_SF[gUse] || 0;       // galvanized base
        const lbPerSfMetal = lbPerSfMetalBase * matFactor;     // adjust for material
        const lbPerSfLiner = LINER_LB_SF[linerKey] ?? 0;
        const lbPerSfTotal = lbPerSfMetal + lbPerSfLiner + addLbSf;

        const flange = FLANGE[flangeKey] || FLANGE.none;
        const flangeLb = joints * flange.lb_per_joint;
        const flangeHr = joints * flange.hr_per_joint;

        weightLb = areaSf * lbPerSfTotal + (lf * addLbLf) + flangeLb;

        if(!G.demoMode){
          const priceLb = pricePerLbFor(material, G);
          matCost = weightLb * priceLb;
          shipCost = matCost * (G.shipPct + G.handPct);
          if(G.applyRemote) shipCost += (matCost + shipCost) * G.remotePct;

          laborCost = (lf * unitHr + flangeHr) * G.laborRate;
          total = matCost + shipCost + laborCost;
        } else {
          dispCost = weightLb * G.dispPerLb;
          total = dispCost;
        }
      }

      tr.querySelector(".perim").textContent = perimIn ? fixed(perimIn) : "";
      tr.querySelector(".area").textContent  = areaSf ? fixed(areaSf)  : "";
      tr.querySelector(".weight").textContent= weightLb ? fixed(weightLb):"";

      if(!G.demoMode){
        tr.querySelector(".mat").textContent   = matCost ? currency(matCost):"";
        tr.querySelector(".ship").textContent  = shipCost? currency(shipCost):"";
        tr.querySelector(".labor").textContent = laborCost?currency(laborCost):"";
        tr.querySelector(".disp").textContent  = "";
      } else {
        tr.querySelector(".mat").textContent   = "";
        tr.querySelector(".ship").textContent  = "";
        tr.querySelector(".labor").textContent = "";
        tr.querySelector(".disp").textContent  = dispCost?currency(dispCost):"";
      }
      tr.querySelector(".total").textContent = total?currency(total):"";

      tPerim += perimIn||0;
      tArea  += areaSf||0;
      tWeight+= weightLb||0;
      if(!G.demoMode){
        tMat   += matCost||0;
        tShip  += shipCost||0;
        tLabor += laborCost||0;
      } else {
        tDisp  += (dispCost||0);
      }
      tTotal += total||0;
    });

    totals.perim.textContent = fixed(tPerim);
    totals.area.textContent  = fixed(tArea);
    totals.weight.textContent= fixed(tWeight);
    if(!readGlobals().demoMode){
      totals.mat.textContent   = currency(tMat);
      totals.ship.textContent  = currency(tShip);
      totals.labor.textContent = currency(tLabor);
      totals.disp.textContent  = "";
    } else {
      totals.mat.textContent   = "";
      totals.ship.textContent  = "";
      totals.labor.textContent = "";
      totals.disp.textContent  = currency(tDisp);
    }
    totals.total.textContent = currency(tTotal);
  }

  // ---------- Extract from pasted text ----------
  $("#extract").addEventListener("click", ()=>{
    const text = $("#paste").value||"";
    const found = extractDuctTokens(text);
    if(found.length===0){ alert("No sizes detected. Try patterns like 24/18, 24x18, Ø18."); return; }
    found.forEach(it => addRow({ type: it.type, size: it.size, lf: 0 }));
  });

  function extractDuctTokens(text){
    const found = [];
    const uniq = new Set();

    // Rectangular: 24/18, 24x18
    const rectRe = /(\d+(?:\.\d+)?)\s*(?:[xX\/])\s*(\d+(?:\.\d+)?)/g;
    let m;
    while((m = rectRe.exec(text))!==null){
      const key = `${m[1]}/${m[2]}`;
      const tag = JSON.stringify({type:"rect", size:key});
      if(!uniq.has(tag)){ uniq.add(tag); found.push({type:"rect", size:key}); }
    }

    // Round: Ø18, DIA 18
    for (const mm of text.matchAll(/Ø\s*(\d+(?:\.\d+)?)/g)){
      const tag = JSON.stringify({type:"round", size:mm[1]});
      if(!uniq.has(tag)){ uniq.add(tag); found.push({type:"round", size:mm[1]}); }
    }
    for (const mm of text.matchAll(/(?:\bDIA\.?\s*|\bDIAM\.?\s)(\d+(?:\.\d+)?)/gi)){
      const tag = JSON.stringify({type:"round", size:mm[1]});
      if(!uniq.has(tag)){ uniq.add(tag); found.push({type:"round", size:mm[1]}); }
    }
    return found;
  }

  // ---------- PDF: parse page list ----------
  function parsePageSpec(spec, total){
    if(!spec) return [...Array(total).keys()].map(i=>i+1);
    const parts = spec.split(/[,\s]+/).filter(Boolean);
    const pages = new Set();
    for(const p of parts){
      const m = p.match(/^(\d+)-(\d+)$/);
      if(m){
        let a = parseInt(m[1],10), b = parseInt(m[2],10);
        if(a>b) [a,b]=[b,a];
        for(let i=a;i<=b;i++){ if(i>=1 && i<=total) pages.add(i); }
      }else{
        const k = parseInt(p,10);
        if(k>=1 && k<=total) pages.add(k);
      }
    }
    return [...pages];
  }

  // ---------- PDF: extract text & OCR fallback ----------
  $("#runPdf").addEventListener("click", async ()=>{
    const file = $("#pdfFile").files?.[0];
    if(!file){ alert("Choose a PDF first."); return; }
    if(!window.pdfjsLib){ alert("PDF.js failed to load. Check your connection or script includes."); return; }

    const maxPages = Math.max(1, parseInt($("#pdfMax").value||"5",10));
    const dpi = Math.max(72, parseInt($("#pdfDpi").value||"160",10));

    $("#pdfStatus").textContent = "Loading PDF…";
    $("#pdfProg").style.width = "0%";

    try{
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: buf}).promise;
      const pageNums = parsePageSpec($("#pdfPages").value, pdf.numPages).slice(0, maxPages);
      if(pageNums.length===0){ pageNums.push(1); }

      let totalFound = 0, processed = 0;
      for (const pn of pageNums){
        processed++;
        $("#pdfStatus").textContent = `Processing page ${pn} of ${pdf.numPages}…`;
        $("#pdfProg").style.width = `${Math.round((processed/pageNums.length)*100)}%`;

        const page = await pdf.getPage(pn);
        let text = "";
        try{
          const tc = await page.getTextContent({normalizeWhitespace:true, disableCombineTextItems:false});
          text = tc.items.map(it=>it.str).join(" ");
        }catch(e){ /* ignore */ }

        let hits = extractDuctTokens(text);
        if(hits.length===0){
          // OCR fallback
          const scale = dpi/72;
          const viewport = page.getViewport({scale});
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          const renderTask = page.render({canvasContext: ctx, viewport});
          await renderTask.promise;

          const { data:{ text: ocrText } } = await Tesseract.recognize(canvas, 'eng', { logger:()=>{} });
          hits = extractDuctTokens(ocrText);
        }

        hits.forEach(it=>{
          addRow({ type: it.type, size: it.size, lf: 0 });
          totalFound++;
        });
      }

      $("#pdfStatus").textContent = totalFound>0
        ? `Done. Added ${totalFound} line items from PDF.`
        : `No duct tags found in selected pages. Try raising DPI or expanding page range.`;
      $("#pdfProg").style.width = "100%";
    }catch(err){
      console.error(err);
      $("#pdfStatus").textContent = "PDF processing failed (see console).";
    }
  });

  // ---------- Round → Rect ----------
  function equalAreaRect(diam, aspectStr){
    const area = Math.PI * (diam*diam) / 4; // in^2
    const m = (aspectStr||"1:1").match(/^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/);
    let a=1,b=1; if(m){ a=parseFloat(m[1]); b=parseFloat(m[2]); }
    const ratio = a/b;
    const H = Math.sqrt(area/ratio), W = ratio*H;
    return {W,H};
  }
  $("#rr_calc").addEventListener("click", ()=>{
    const d = parseFloat($("#rr_diam").value)||0;
    const ar = $("#rr_aspect").value||"1:1";
    if(d<=0){ $("#rr_out").textContent = "Enter a valid diameter."; return; }
    const {W,H} = equalAreaRect(d, ar);
    $("#rr_out").textContent = `Equal-area rectangle ≈ ${W.toFixed(1)} / ${H.toFixed(1)} in (to match Ø${d})`;
  });
  $("#rr_add").addEventListener("click", ()=>{
    const d = parseFloat($("#rr_diam").value)||0;
    const ar = $("#rr_aspect").value||"1:1";
    if(d<=0) return;
    const {W,H} = equalAreaRect(d, ar);
    addRow({ type:"rect", size: `${W.toFixed(1)}/${H.toFixed(1)}`, lf: 0 });
  });

  // ---------- CSV ----------
  $("#exportCsv").addEventListener("click", ()=>{
    const headers = [
      "Type","Size(in)","LF","Material","Gauge","AutoG","UnitHr/LF","AutoLabor",
      "Liner","Add_lb_sf","Add_lb_LF","Flange","JointFt",
      "Perimeter(in)","Area(sf)","Weight(lb)","Material($)","Ship/Hand($)","Labor($)","Disposal($)","Total($)"
    ];
    const lines = $$("#body tr").map(tr=>{
      const txt = sel => (tr.querySelector(sel)?.textContent||"").trim();
      const val = sel => (tr.querySelector(sel)?.value ?? "").toString().trim();
      const cost = s => txt(s).replace(/[$,]/g,"");
      return [
        val(".type"), val(".size"), val(".lf"), val(".material"), val(".gauge"),
        tr.querySelector(".autoG").checked ? "Y":"N",
        val(".laborUnit"), tr.querySelector(".autoLabor").checked ? "Y":"N",
        val(".liner"), val(".addLbSf"), val(".addLbLf"), val(".flange"), val(".jointFt"),
        txt(".perim"), txt(".area"), txt(".weight"),
        cost(".mat"), cost(".ship"), cost(".labor"), cost(".disp"), cost(".total")
      ].join(",");
    });
    const csv = headers.join(",")+"\n"+lines.join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="duct_takeoff_materials_ocr.csv"; a.click();
    URL.revokeObjectURL(url);
  });

  // ---------- Add / Clear / Globals ----------
  $("#addRow").addEventListener("click", ()=>addRow());
  $("#reset").addEventListener("click", ()=>{ $("#body").innerHTML=""; recalc(); });
  ["#autoMode","#pressClass","#wastePct","#shipPct","#handPct","#remotePct","#laborRate","#laborUnit","#applyRemote","#demoMode","#dispPerLb",
   "#priceGalv","#priceSS","#priceAl","#priceBlk"]
    .forEach(id => $(id).addEventListener("input", recalc));

  // Seed one row and initial calc
  addRow();
})();
