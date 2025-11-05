(function(){

    const areaInput = document.getElementById('areaSqFt');
    const ocInput = document.getElementById('ocInches');
    const wasteInput = document.getElementById('wastePct');
    const coilInput = document.getElementById('coilLen');
    const runModeInput = document.getElementById('runMode');
    const wallHeightField = document.getElementById('wallHeightField');
    const wallHeightInput = document.getElementById('wallHeight');

    const totalLFEl = document.getElementById('totalLF');
    const totalWithWasteEl = document.getElementById('totalWithWaste');
    const lfPerSfEl = document.getElementById('lfPerSf');
    const coilsNeededEl = document.getElementById('coilsNeeded');
    const wasteUsedPctEl = document.getElementById('wasteUsedPct');
    const coilLenEchoEl = document.getElementById('coilLenEcho');
    const runCountEl = document.getElementById('runCount');
    const runLengthEl = document.getElementById('runLength');
    const totalLFNoteEl = document.getElementById('totalLFNote');
    const runCountNoteEl = document.getElementById('runCountNote');
    const runLengthNoteEl = document.getElementById('runLengthNote');

    const layoutSVG = document.getElementById('layoutSVG');
    const legendOCEl = document.getElementById('legendOC');
    const legendDimsEl = document.getElementById('legendDims');
    const legendLayoutEl = document.getElementById('legendLayout');
    const previewDimsEl = document.getElementById('previewDims');
    const diagramHintEl = document.getElementById('diagramHint');

    function calcAndRender(){
        const areaSqFt = parseFloat(areaInput.value) || 0;
        const ocIn = parseFloat(ocInput.value) || 0;
        const wastePct = parseFloat(wasteInput.value) || 0;
        const coilLen = parseFloat(coilInput.value) || 0;
        const runMode = runModeInput.value;
        const wallHeightFt = parseFloat(wallHeightInput.value) || 0;

        // core math:
        // oc in inches -> feet
        // lf/ft² = 1 / (oc_ft)
        // totalLF = areaSqFt * lf/ft²
        let ocFt = ocIn / 12.0;
        let lfPerSf = 0;
        let totalLF = 0;
        let runCount = 0;
        let runLength = 0;
        let width_ft = 0;
        let height_ft = 0;
        let totalLFNote = '';
        let runCountNote = '';
        let runLengthNote = '';
        let orientation = 'vertical';

        if(runMode === 'parallel'){
            // Treat as wall/ceiling rows. Area and wall height define run length.
            height_ft = wallHeightFt;
            let wallLengthFt = (wallHeightFt > 0) ? (areaSqFt / wallHeightFt) : 0;
            width_ft = wallLengthFt;

            if(ocFt > 0 && wallHeightFt > 0){
                runCount = Math.max(1, Math.ceil(wallHeightFt / ocFt));
            }

            runLength = wallLengthFt;
            totalLF = wallLengthFt * runCount;
            lfPerSf = (areaSqFt > 0) ? (totalLF / areaSqFt) : 0;

            totalLFNote = 'Without waste. Parallel rows sized from area and wall height.';
            runCountNote = 'Horizontal rows spaced on-center up the wall.';
            runLengthNote = 'Length of each row along the wall span.';
            orientation = 'horizontal';

            diagramHintEl.innerHTML = 'Rows step up the wall height at your selected on-center spacing. Total LF ≈ <span class="accent">(Wall length × Rows)</span>.';
            legendLayoutEl.textContent = 'Rows run horizontally';
        } else {
            // Continuous / serpentine layout across an area.
            width_ft = Math.sqrt(areaSqFt * 1.5);
            height_ft = (width_ft > 0) ? (areaSqFt / width_ft) : 0;

            lfPerSf = ocFt > 0 ? (1 / ocFt) : 0;
            totalLF = areaSqFt * lfPerSf;

            if(ocFt > 0 && width_ft > 0){
                runCount = Math.max(1, Math.floor(width_ft / ocFt) + 1);
            }
            runLength = height_ft;

            totalLFNote = 'Without waste. Continuous serpentined run coverage.';
            runCountNote = 'Approx parallel passes across the layout footprint.';
            runLengthNote = 'Length of each pass across the layout.';
            orientation = 'vertical';

            diagramHintEl.innerHTML = 'Parallel runs at fixed on-center spacing. Total LF ≈ <span class="accent">(Area ÷ spacing_ft)</span> for broad coverage.';
            legendLayoutEl.textContent = 'Runs span the length';
        }

        // waste/extra
        let totalWithWaste = totalLF * (1 + (wastePct/100));

        // coils
        let coilsNeeded = (coilLen > 0) ? (totalWithWaste / coilLen) : 0;

        // round for display
        function nice(x){
            return isFinite(x) ? x.toLocaleString(undefined,{maximumFractionDigits:2}) : "–";
        }

        totalLFEl.textContent = nice(totalLF);
        totalWithWasteEl.textContent = nice(totalWithWaste);
        lfPerSfEl.textContent = nice(lfPerSf);
        coilsNeededEl.textContent = nice(coilsNeeded);
        runCountEl.textContent = runCount ? nice(runCount) : '–';
        runLengthEl.textContent = runLength ? nice(runLength) : '–';

        wasteUsedPctEl.textContent = nice(wastePct) + "%";
        coilLenEchoEl.textContent = nice(coilLen);
        totalLFNoteEl.textContent = totalLFNote || 'Without waste. Continuous run length assumed.';
        runCountNoteEl.textContent = runCountNote || 'Approx parallel passes across the layout.';
        runLengthNoteEl.textContent = runLengthNote || 'Length of each pass along the layout.';

        // update legend text
        legendOCEl.textContent = ocIn ? ocIn + " in" : "–";

        // For diagram:
        // We'll make a pretend rectangle of areaSqFt with an aspect ratio bias ~1.5:1
        // width_ft * height_ft = areaSqFt
        // pick width_ft = sqrt(area * 1.5), height_ft = area/width
        // echo dims
        function dimStr(w,h){
            if(!isFinite(w) || !isFinite(h)) return "–";
            return w.toFixed(1) + "ft x " + h.toFixed(1) + "ft";
        }
        legendDimsEl.textContent = dimStr(width_ft,height_ft);
        previewDimsEl.textContent = dimStr(width_ft,height_ft);

        drawRectAndLines(width_ft, height_ft, ocFt, orientation);
    }

    function drawRectAndLines(width_ft, height_ft, oc_ft, orientation){
        // Clear SVG
        while(layoutSVG.firstChild){
            layoutSVG.removeChild(layoutSVG.firstChild);
        }

        // guard
        if(!(isFinite(width_ft) && isFinite(height_ft) && width_ft>0 && height_ft>0)){
            return;
        }

        // We'll fit rectangle into 180x120 inside the 200x140 viewBox
        const padX = 10;
        const padY = 10;
        const maxW = 180;
        const maxH = 120;

        // scale to fit
        let scale = Math.min(maxW/width_ft, maxH/height_ft);
        let drawW = width_ft * scale;
        let drawH = height_ft * scale;

        // offset so it's centered-ish
        let offX = (200 - drawW)/2;
        let offY = (140 - drawH)/2;

        // RECT
        const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
        rect.setAttribute("x", offX.toFixed(2));
        rect.setAttribute("y", offY.toFixed(2));
        rect.setAttribute("width", drawW.toFixed(2));
        rect.setAttribute("height", drawH.toFixed(2));
        rect.setAttribute("fill", "rgba(15,23,42,0.4)");
        rect.setAttribute("stroke", "rgba(56,189,248,0.6)");
        rect.setAttribute("stroke-width", "1.5");
        layoutSVG.appendChild(rect);

        // draw parallel runs across the short dimension
        // we'll assume the runs go "vertically" (top to bottom),
        // spaced along width, every oc_ft.
        if(oc_ft > 0){
            if(orientation === 'horizontal'){
                let runCount = Math.floor(height_ft / oc_ft) + 1;
                for(let i=0; i<runCount; i++){
                    let y_ft = i * oc_ft;
                    if(y_ft > height_ft) break;
                    let y_px = offY + y_ft * scale;

                    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
                    line.setAttribute("x1", offX.toFixed(2));
                    line.setAttribute("y1", y_px.toFixed(2));
                    line.setAttribute("x2", (offX+drawW).toFixed(2));
                    line.setAttribute("y2", y_px.toFixed(2));
                    line.setAttribute("stroke", "rgba(56,189,248,0.9)");
                    line.setAttribute("stroke-width", "1.2");
                    layoutSVG.appendChild(line);
                }
            } else {
                let runCount = Math.floor(width_ft / oc_ft) + 1;
                for(let i=0; i<runCount; i++){
                    let x_ft = i * oc_ft;
                    if(x_ft > width_ft) break;
                    let x_px = offX + x_ft * scale;

                    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
                    line.setAttribute("x1", x_px.toFixed(2));
                    line.setAttribute("y1", offY.toFixed(2));
                    line.setAttribute("x2", x_px.toFixed(2));
                    line.setAttribute("y2", (offY+drawH).toFixed(2));
                    line.setAttribute("stroke", "rgba(56,189,248,0.9)");
                    line.setAttribute("stroke-width", "1.2");
                    layoutSVG.appendChild(line);
                }
            }
        }

        // dimension labels (simple)
        // width arrow
        const wLine = document.createElementNS("http://www.w3.org/2000/svg","line");
        wLine.setAttribute("x1", offX.toFixed(2));
        wLine.setAttribute("y1", (offY+drawH+8).toFixed(2));
        wLine.setAttribute("x2", (offX+drawW).toFixed(2));
        wLine.setAttribute("y2", (offY+drawH+8).toFixed(2));
        wLine.setAttribute("stroke", "rgba(148,163,184,0.8)");
        wLine.setAttribute("stroke-width", "1");
        layoutSVG.appendChild(wLine);

        // width text
        const wText = document.createElementNS("http://www.w3.org/2000/svg","text");
        wText.setAttribute("x", (offX+drawW/2).toFixed(2));
        wText.setAttribute("y", (offY+drawH+16).toFixed(2));
        wText.setAttribute("fill", "rgba(148,163,184,0.9)");
        wText.setAttribute("font-size", "8");
        wText.setAttribute("text-anchor", "middle");
        wText.textContent = width_ft.toFixed(1) + " ft";
        layoutSVG.appendChild(wText);

        // height arrow
        const hLine = document.createElementNS("http://www.w3.org/2000/svg","line");
        hLine.setAttribute("x1", (offX+drawW+8).toFixed(2));
        hLine.setAttribute("y1", offY.toFixed(2));
        hLine.setAttribute("x2", (offX+drawW+8).toFixed(2));
        hLine.setAttribute("y2", (offY+drawH).toFixed(2));
        hLine.setAttribute("stroke", "rgba(148,163,184,0.8)");
        hLine.setAttribute("stroke-width", "1");
        layoutSVG.appendChild(hLine);

        // height text
        const hText = document.createElementNS("http://www.w3.org/2000/svg","text");
        hText.setAttribute("x", (offX+drawW+14).toFixed(2));
        hText.setAttribute("y", (offY+drawH/2).toFixed(2));
        hText.setAttribute("fill", "rgba(148,163,184,0.9)");
        hText.setAttribute("font-size", "8");
        hText.setAttribute("dominant-baseline", "middle");
        hText.textContent = height_ft.toFixed(1) + " ft";
        layoutSVG.appendChild(hText);
    }

    // hook inputs
    function updateModeUI(){
        if(runModeInput.value === 'parallel'){
            wallHeightField.style.display = '';
        } else {
            wallHeightField.style.display = 'none';
        }
    }

    [areaInput, ocInput, wasteInput, coilInput, runModeInput, wallHeightInput].forEach(el=>{
        el.addEventListener('input', calcAndRender);
    });
    runModeInput.addEventListener('change', ()=>{
        updateModeUI();
        calcAndRender();
    });

    // initial
    updateModeUI();
    calcAndRender();

})();
