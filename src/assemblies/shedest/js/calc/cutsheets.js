export function buildCutSheets(state, takeoff, db) {
  const sheets = [];
  const spacing = state.walls.studSpacingIn;
  const studLabel = state.walls.studType.toUpperCase();
  const lumberKey = state.walls.studType === "2x6" ? "2x6x8" : "2x4x8";
  const lumberDesc = db.desc(lumberKey);

  const wallRuns = [
    { name:"Front wall", length:state.geom.lenFt, note:"contains primary door rough openings" },
    { name:"Back wall", length:state.geom.lenFt, note:"full-height wall frame" },
    { name:"Left wall", length:state.geom.widFt, note:state.openings.windowLayout === "balanced" ? "balanced window elevation" : "side elevation" },
    { name:"Right wall", length:state.geom.widFt, note:state.openings.windowLayout === "right" ? "window elevation" : "side elevation" }
  ];

  for (const wall of wallRuns) {
    const commonStuds = Math.ceil((wall.length * 12) / spacing) + 1;
    const plates = state.walls.topPlate === "double" ? 3 : 2;
    sheets.push({
      assembly: wall.name,
      cut: `${studLabel} studs @ ${state.geom.htFt}'`,
      qty: commonStuds,
      stock: lumberDesc,
      layout: `${spacing}" o.c. layout across ${wall.length}' run`,
      notes: wall.note
    });
    sheets.push({
      assembly: wall.name,
      cut: `${studLabel} plates @ 8' stock`,
      qty: Math.ceil((wall.length * plates) / 8 * 1.08),
      stock: lumberDesc,
      layout: `${plates} plate rows incl. bottom/top${state.walls.topPlate === "double" ? "/cap" : ""}`,
      notes: "stagger plate splices and lap corners"
    });
  }

  if (state.openings.doorCount > 0) {
    sheets.push({ assembly:"Openings", cut:`Door RO package ${state.openings.doorWft}'×${state.openings.doorHft}'`, qty:state.openings.doorCount, stock:lumberDesc, layout:"king studs, jack studs, cripple studs, header", notes:"field-verify door unit and threshold before cutting" });
  }
  if (state.openings.winCount > 0) {
    sheets.push({ assembly:"Openings", cut:`Window RO package ${state.openings.winWft}'×${state.openings.winHft}'`, qty:state.openings.winCount, stock:lumberDesc, layout:"king studs, jack studs, sill, header, cripples", notes:"center on selected elevation layout" });
  }

  const roofRun = state.roof.type === "gable" ? Math.hypot((state.geom.widFt + 2*state.roof.overhangFt)/2, ((state.geom.widFt + 2*state.roof.overhangFt)/2) * state.roof.pitchX12 / 12) : Math.hypot(state.geom.widFt + 2*state.roof.overhangFt, (state.geom.widFt + 2*state.roof.overhangFt) * state.roof.pitchX12 / 12);
  sheets.push({ assembly:"Roof framing", cut:`Rafters @ ${roofRun.toFixed(2)}' slope length`, qty:takeoff.roofInfo.rafterSticksEA, stock:lumberDesc, layout:`${spacing}" o.c. with ${state.roof.pitchX12}:12 ${state.roof.type} roof`, notes:"cut birdsmouths and tails consistently; include overhang" });
  if (takeoff.roofInfo.ridgeSticksEA > 0) sheets.push({ assembly:"Roof framing", cut:"Ridge board @ 8' stock", qty:takeoff.roofInfo.ridgeSticksEA, stock:lumberDesc, layout:"continuous at gable peak", notes:"splice over rafter pair where possible" });

  sheets.push({ assembly:"Sheet goods", cut:"Wall sheathing/siding panels", qty:takeoff.items.filter(i => /Wall sheathing|Exterior finish/.test(i.name)).reduce((n,i)=>n+Number(i.qty||0),0), stock:"4×8 sheet / SF finish", layout:`net wall area ${takeoff.netWallSheathAreaSF.toFixed(1)} SF`, notes:"break joints on studs; hold panels off wet surfaces" });
  sheets.push({ assembly:"Sheet goods", cut:"Roof deck / finish coverage", qty:takeoff.items.filter(i => /Roof sheathing|Roof finish/.test(i.name)).reduce((n,i)=>n+Number(i.qty||0),0), stock:"roof deck + finish system", layout:`roof area ${takeoff.roofAreaSF.toFixed(1)} SF`, notes:"sequence deck, underlayment, edge metal, finish" });

  return sheets;
}
