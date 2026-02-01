export function runDoomDemo({ gfx, writeLine }){
  const script = [
    "cls()",
    "bg(\"transparent\")",
    "fill(0,0,64,18,\"muted\")",
    "fill(0,18,64,18,\"text\")",
    "line(0,18,63,18,\"accent-2\")",
    "line(6,6,26,18,\"accent\")",
    "line(58,6,38,18,\"accent\")",
    "line(6,6,10,2,\"accent\")",
    "line(58,6,54,2,\"accent\")",
    "line(26,18,38,18,\"accent\")",
    "rect(14,10,36,12,\"accent-2\")",
    "fill(15,11,34,10,\"muted\")",
    "rect(28 + round(2*sin(frame/6)),20 + round(1*cos(frame/8)),8,8,\"ok\")",
    "fill(29 + round(2*sin(frame/6)),21 + round(1*cos(frame/8)),6,6,\"accent\")",
    "pix(31 + round(2*sin(frame/6)),23 + round(1*cos(frame/8)),\"err\")",
    "pix(34 + round(2*sin(frame/6)),23 + round(1*cos(frame/8)),\"err\")",
    "line(12 + round(6*sin(frame/10)),30,52 - round(6*sin(frame/10)),30,\"warn\")",
    "plot(12 + round(6*sin(frame/10)),30,\"1,0|1,0|1,0|1,0|1,0\",\"warn\")",
  ].join("; ");

  gfx.initBuffer(64, 36, 6);
  gfx.configureLoop(script, 12);
  gfx.playLoop();
  if (typeof writeLine === "function"){
    writeLine(
      "Doom demo running. Focus the canvas and use Space to play/pause, arrows to step, and ↑/↓ to change speed.",
      "ok"
    );
  }
}
