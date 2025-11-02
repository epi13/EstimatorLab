(function(){
  const els = {
    mode: document.getElementById('mode'),
    lwRow: document.getElementById('lwRow'),
    sfRow: document.getElementById('sfRow'),
    len: document.getElementById('len'),
    wid: document.getElementById('wid'),
    sf: document.getElementById('sf'),
    profile: document.getElementById('profile'),
    customRow: document.getElementById('customRow'),
    depth: document.getElementById('depth'),
    pitch: document.getElementById('pitch'),
    topFlange: document.getElementById('topFlange'),
    botFlange: document.getElementById('botFlange'),
    thick: document.getElementById('thick'),
    fromLow: document.getElementById('fromLow'),
    waste: document.getElementById('waste'),
    calc: document.getElementById('calc'),
    vNet: document.getElementById('vNet'),
    vGross: document.getElementById('vGross'),
    loads: document.getElementById('loads'),
    svgHost: document.getElementById('svgHost'),
    geomNote: document.getElementById('geomNote'),
    assumps: document.getElementById('assumps'),
  };

  // Helpers
  const clampPos = v => Math.max(0, isFinite(v) ? v : 0);
  const ft3_to_cy = v => v / 27.0;

  // Switch area input mode
  els.mode.addEventListener('change', ()=>{
    const byLW = els.mode.value === 'lw';
    els.lwRow.style.display = byLW ? '' : 'none';
    els.sfRow.style.display = byLW ? 'none' : '';
  });

  // Profile chooser
  function readProfile(){
    let H, P, Wt, Wb;
    if (els.profile.value === 'custom'){
      H  = parseFloat(els.depth.value)||0;
      P  = parseFloat(els.pitch.value)||0;
      Wt = parseFloat(els.topFlange.value)||0;
      Wb = parseFloat(els.botFlange.value)||0;
      els.customRow.style.display = '';
    } else {
      const [h,p,wt,wb] = els.profile.value.split('|').map(parseFloat);
      H=h; P=p; Wt=wt; Wb=wb;
      els.depth.value = H;
      els.pitch.value = P;
      els.topFlange.value = Wt;
      els.botFlange.value = Wb;
      els.customRow.style.display = 'none';
    }
    return {H,P,Wt,Wb};
  }
  els.profile.addEventListener('change', ()=>{ drawProfile(); });

  // Draw SVG profile
  function drawProfile(){
    const {H,P,Wt,Wb} = readProfile();
    const t = parseFloat(els.thick.value)||0;
    // Scales
    const pxPerIn = 8; // 1 in = 8 px
    const margin = 20;
    const pitches = 2;
    const viewW = Math.min(560, Math.max(360, (P*pitches)*pxPerIn + margin*2));
    const viewH = 180;

    // Build profile (number of pitches limited for compact view)
    const crestTop = (P - Wt)/2;
    const troughTop = crestTop + Wt;
    const crestBottom = (P - Wb)/2;
    const troughBottom = crestBottom + Wb;

    // Functions to create one pitch path at x offset
    function pitchPath(x0, y0){
      const up = y0;           // high flute (deck top peak)
      const down = y0 + H*pxPerIn; // low flute (valley)
      const x = x0;

      // simple trapezoidal rib: crest (top flange), slope to bottom flange, valley, slope up, crest
      const Xs = [
        x + 0,                         // start at valley left edge
        x + crestTop*pxPerIn,
        x + troughTop*pxPerIn,
        x + P*pxPerIn
      ];
      const Xb = [
        x + 0,
        x + crestBottom*pxPerIn,
        x + troughBottom*pxPerIn,
        x + P*pxPerIn
      ];

      // Path: start valley (down), up slope to crest (up), across crest, down slope to valley, across valley
      // We'll approximate with straight segments
      let d = `M ${Xb[0]} ${down}
               L ${Xb[1]} ${up}
               L ${Xs[1]} ${up}
               L ${Xs[2]} ${up}
               L ${Xb[2]} ${down}
               L ${Xb[3]} ${down}`;
      return d;
    }

    // Prepare SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox", `0 0 ${viewW} ${viewH}`);
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "auto";

    // Clean frame only (no grid)
    const frame = document.createElementNS(svg.namespaceURI, "rect");
    frame.setAttribute("x", margin);
    frame.setAttribute("y", margin);
    frame.setAttribute("width", viewW - margin*2);
    frame.setAttribute("height", viewH - margin*2);
    frame.setAttribute("rx", "10"); frame.setAttribute("ry", "10");
    frame.setAttribute("fill", "none"); frame.setAttribute("stroke", "rgba(15,23,42,0.35)");
    frame.setAttribute("stroke-width", "1.2");
    svg.appendChild(frame);

    // Origin for profile
    const baseY = viewH - margin - 60; // place deck compactly
    const startX = margin + 20;

    // Deck polyline
    const deck = document.createElementNS(svg.namespaceURI,"path");
    let dAll = "";
    for (let i=0;i<pitches;i++){
      dAll += pitchPath(startX + i*P*pxPerIn, baseY) + " ";
    }
    deck.setAttribute("d", dAll);
    deck.setAttribute("fill","none");
    deck.setAttribute("stroke","#5b8efb");
    deck.setAttribute("stroke-width","2");
    svg.appendChild(deck);

    // Slab top line (above high flute)
    const t_in = t + (document.getElementById('fromLow').checked ? 0.5*H : 0); // rule-of-thumb overage if from low flute
    const slabY = baseY - t_in*pxPerIn;
    const slab = document.createElementNS(svg.namespaceURI,"line");
    slab.setAttribute("x1", startX);
    slab.setAttribute("y1", slabY);
    slab.setAttribute("x2", startX + pitches*P*pxPerIn);
    slab.setAttribute("y2", slabY);
    slab.setAttribute("stroke","#34d399");
    slab.setAttribute("stroke-width","3");
    svg.appendChild(slab);

    // Dimension arrows helper
    function dimArrow(x1,y1,x2,y2, txt){
      const g = document.createElementNS(svg.namespaceURI,"g");
      const line = document.createElementNS(svg.namespaceURI,"line");
      line.setAttribute("x1",x1); line.setAttribute("y1",y1);
      line.setAttribute("x2",x2); line.setAttribute("y2",y2);
      line.setAttribute("stroke","#9da7b3"); line.setAttribute("stroke-width","1.5");
      line.setAttribute("marker-start","url(#a)"); line.setAttribute("marker-end","url(#a)");
      g.appendChild(line);
      const t = document.createElementNS(svg.namespaceURI,"text");
      t.setAttribute("x",(x1+x2)/2);
      t.setAttribute("y",(y1+y2)/2 - 6);
      t.setAttribute("fill","#c9d1d9");
      t.setAttribute("font-size","12");
      t.setAttribute("text-anchor","middle");
      t.textContent = txt;
      g.appendChild(t);
      return g;
    }

    // Markers (arrow heads)
    const defs = document.createElementNS(svg.namespaceURI,"defs");
    const marker = document.createElementNS(svg.namespaceURI,"marker");
    marker.setAttribute("id","a");
    marker.setAttribute("viewBox","0 0 10 10");
    marker.setAttribute("refX","5"); marker.setAttribute("refY","5");
    marker.setAttribute("markerWidth","6"); marker.setAttribute("markerHeight","6");
    marker.setAttribute("orient","auto-start-reverse");
    const path = document.createElementNS(svg.namespaceURI,"path");
    path.setAttribute("d","M 0 0 L 10 5 L 0 10 z");
    path.setAttribute("fill","#9da7b3");
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Dimensions: H (deck depth)
    svg.appendChild(dimArrow(startX - 14, baseY, startX - 14, baseY + H*pxPerIn, `H = ${H}"`));

    // Dimensions: P (pitch) for one wave
    svg.appendChild(dimArrow(startX, baseY + H*pxPerIn + 30, startX + P*pxPerIn, baseY + H*pxPerIn + 30, `P = ${P}"`));

    // Dimensions: t (effective slab)
    svg.appendChild(dimArrow(startX + pitches*P*pxPerIn + 14, slabY, startX + pitches*P*pxPerIn + 14, baseY, `t = ${t_in.toFixed(2)}"`));

    // Skip verbose labels to keep the diagram clear (dimension arrows remain)

    els.svgHost.innerHTML = "";
    els.svgHost.appendChild(svg);

    els.geomNote.textContent =
      `Deck depth H=${H.toFixed(2)}", pitch P=${P.toFixed(2)}", top flange Wt=${Wt.toFixed(2)}", bottom flange Wb=${Wb.toFixed(2)}". ` +
      (els.fromLow.checked ? "Thickness interpreted from low flute (adds 0.5×H overage)." : "Thickness interpreted above high flute.");
  }

  // Calculation
  function compute(){
    // Area
    let areaSF = 0;
    if (els.mode.value === 'lw'){
      const L = clampPos(parseFloat(els.len.value));
      const W = clampPos(parseFloat(els.wid.value));
      areaSF = L * W;
    } else {
      areaSF = clampPos(parseFloat(els.sf.value));
    }

    const {H} = readProfile();
    const t = clampPos(parseFloat(els.thick.value)); // in
    const overage = els.fromLow.checked ? 0.5 * H : 0; // rule-of-thumb
    const t_eff_in = t + overage;

    // Volume = Area (sf) × thickness (in) / 12 => ft³
    const ft3 = areaSF * (t_eff_in / 12.0);
    const cy = ft3_to_cy(ft3);

    // Waste
    const w = Math.max(0, parseFloat(els.waste.value)||0) / 100.0;
    const ft3_g = ft3 * (1 + w);
    const cy_g = ft3_to_cy(ft3_g);

    // Outputs
    els.vNet.textContent = `${cy.toFixed(3)} CY  (${ft3.toFixed(1)} ft³)`;
    els.vGross.textContent = `${cy_g.toFixed(3)} CY  (${ft3_g.toFixed(1)} ft³)`;
    els.loads.textContent = (cy_g/9).toFixed(2);

    // Update assumptions text
    const a = [];
    a.push("Volume calculated from area × effective thickness.");
    if (els.fromLow.checked){
      a.push("Effective thickness adds 0.5×H to approximate corrugation relief (field-verify if specs provide a different factor).");
    } else {
      a.push("Thickness measured above the deck high flute (typical for form deck slabs).");
    }
    a.push(`Waste add-on: ${(w*100).toFixed(1)}%.`);
    document.getElementById('assumps').textContent = "Assumptions: " + a.join(" ");
  }

  // Wire up
  ['len','wid','sf','thick','waste','depth','pitch','topFlange','botFlange','fromLow','mode'].forEach(id=>{
    document.getElementById(id).addEventListener('input', ()=>{ drawProfile(); compute(); });
    document.getElementById(id).addEventListener('change', ()=>{ drawProfile(); compute(); });
  });
  els.calc.addEventListener('click', ()=>{ compute(); });

  // Initial render
  drawProfile();
  compute();
})();
