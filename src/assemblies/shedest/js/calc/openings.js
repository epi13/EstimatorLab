export function openingsTakeoff({
  wallHtFt,
  studSpacingIn,
  studType,
  doorCount, doorWft, doorHft,
  winCount, winWft, winHft,
  trimKey
}) {
  // Framing assumptions:
  // - Each opening: 2 king + 2 jack
  // - Header length = opening width + 1 ft bearing (0.5 each side) (budgetary)
  // - Cripples above header: based on spacing across opening width
  // - Doors assumed header at top of door (no cripples above unless wall taller than door)
  const spacingFt = studSpacingIn / 12;

  const items = [];
  const notes = [];

  function openingUnit(w, h, count, type) {
    if (count <= 0) return { areaSF:0, trimLF:0, studDelta:0, headerLF:0, crippleCount:0, king:0, jack:0 };

    const areaSF = w * h * count;
    const trimLF = (trimKey !== "none") ? (2*(w+h) * count) : 0;

    const king = 2 * count;
    const jack = 2 * count;

    // crudely remove "one stud position" per opening width from base stud run
    // this is a simplification: base wall stud count comes from perimeter; we reduce by studs displaced.
    const displaced = Math.floor(w / spacingFt) * count;

    // header LF (budgetary): width + 1ft bearing
    const headerLF = (w + 1.0) * count;

    // approximate header height:
    // windows: assume head at 6.5' (typical) unless wall smaller
    // doors: head at door height
    const headHt = (type === "window") ? Math.min(6.5, wallHtFt - 0.5) : Math.min(h, wallHtFt);
    const crippleHt = Math.max(0, wallHtFt - headHt);

    // number of cripple studs above header across opening width
    const studsAcross = Math.max(0, Math.floor(w / spacingFt) - 1);
    const crippleCount = Math.ceil(studsAcross * count * (crippleHt > 0 ? 1 : 0));

    return {
      areaSF, trimLF,
      studDelta: displaced, // studs to subtract from base
      headerLF,
      crippleCount,
      king, jack
    };
  }

  const door = openingUnit(doorWft, doorHft, doorCount, "door");
  const win  = openingUnit(winWft,  winHft,  winCount,  "window");

  const openingAreaSF = door.areaSF + win.areaSF;
  const trimLF = door.trimLF + win.trimLF;

  const studsToSubtract = door.studDelta + win.studDelta;
  const kingStuds = door.king + win.king;
  const jackStuds = door.jack + win.jack;
  const crippleStuds = door.crippleCount + win.crippleCount;

  const totalAddedStuds = kingStuds + jackStuds + crippleStuds;

  // Header material: treat as same studType "sticks" in v1 (you can swap to LVL/glulam later)
  // Convert header LF to 8' sticks
  const headerLF = door.headerLF + win.headerLF;

  notes.push(`Openings area subtracted from wall sheathing: ${openingAreaSF.toFixed(2)} SF`);
  notes.push(`Studs displaced (subtracted from wall baseline): ${studsToSubtract}`);
  notes.push(`Added framing: king ${kingStuds}, jack ${jackStuds}, cripples ${crippleStuds} (EA)`);
  notes.push(`Headers (budgetary): ${headerLF.toFixed(1)} LF total`);

  return {
    openingAreaSF,
    trimLF,
    studsToSubtract,
    addedStudsEA: totalAddedStuds,
    headerLF,
    notes
  };
}
