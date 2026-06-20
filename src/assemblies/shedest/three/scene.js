import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const WALL_COLORS = { cedar:0xb98755, barnred:0x8f2f24, sage:0x7d8f68, charcoal:0x34373b };
const TRIM_COLORS = { white:0xf2efe6, black:0x151515, cedar:0xb98755, charcoal:0x34373b };
const ROOF_COLORS = { galvalume:0x9ba3a7, red:0x8d2722, green:0x385a42, charcoal:0x25282c };

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0b);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(18, 14, 18);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 18, 8);
  dir.castShadow = true;
  scene.add(dir);

  const grid = new THREE.GridHelper(100, 100, 0x333333, 0x222222);
  scene.add(grid);

  const shedGroup = new THREE.Group();
  scene.add(shedGroup);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.minDistance = 4;
  controls.maxDistance = 200;

  function mat(color, opts={}) { return new THREE.MeshStandardMaterial({ color, metalness:0.04, roughness:0.82, ...opts }); }
  function lineMat(color) { return new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.75 }); }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  function clearGroup() { while (shedGroup.children.length) shedGroup.remove(shedGroup.children[0]); }

  function addBox(L, H, W, position, color=0x2e2e2e, materialOpts={}) {
    const geom = new THREE.BoxGeometry(L, H, W);
    const mesh = new THREE.Mesh(geom, mat(color, materialOpts));
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
    return mesh;
  }

  function addEdges(mesh, color=0xd7d7d7) {
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), lineMat(color));
    wire.position.copy(mesh.position);
    wire.rotation.copy(mesh.rotation);
    wire.scale.copy(mesh.scale);
    shedGroup.add(wire);
  }

  function addPanel(x, y, z, w, h, face, color, depth=0.05) {
    const L = face === "front" || face === "back" ? w : depth;
    const W = face === "front" || face === "back" ? depth : w;
    return addBox(L, h, W, new THREE.Vector3(x, y, z), color);
  }

  function addTrimAround(x, y, z, w, h, face, color) {
    const t = 0.12;
    addPanel(x, y + h/2 + t/2, z, w + 2*t, t, face, color, 0.075);
    addPanel(x, y - h/2 - t/2, z, w + 2*t, t, face, color, 0.075);
    const sideOffset = face === "front" || face === "back" ? w/2 + t/2 : w/2 + t/2;
    if (face === "front" || face === "back") {
      addPanel(x - sideOffset, y, z, t, h, face, color, 0.075);
      addPanel(x + sideOffset, y, z, t, h, face, color, 0.075);
    } else {
      addPanel(x, y, z - sideOffset, t, h, face, color, 0.075);
      addPanel(x, y, z + sideOffset, t, h, face, color, 0.075);
    }
  }

  function addSidingLines(L, W, H, profile) {
    const group = new THREE.Group();
    const color = profile === "boardbatten" ? 0x1b1b1b : 0x5b4a3b;
    if (profile === "lap") {
      for (let y = 0.75; y < H; y += 0.5) {
        [[0, W/2+0.031, L, "z"], [0, -W/2-0.031, L, "z"], [L/2+0.031, 0, W, "x"], [-L/2-0.031, 0, W, "x"]].forEach(([a,b,len,axis]) => {
          const g = new THREE.BufferGeometry().setFromPoints(axis === "z" ? [new THREE.Vector3(-len/2,y,b), new THREE.Vector3(len/2,y,b)] : [new THREE.Vector3(a,y,-len/2), new THREE.Vector3(a,y,len/2)]);
          group.add(new THREE.Line(g, lineMat(color)));
        });
      }
    } else if (profile === "boardbatten") {
      for (let x = -L/2; x <= L/2; x += 1.25) {
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,0,W/2+0.032), new THREE.Vector3(x,H,W/2+0.032)]), lineMat(color)));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,0,-W/2-0.032), new THREE.Vector3(x,H,-W/2-0.032)]), lineMat(color)));
      }
      for (let z = -W/2; z <= W/2; z += 1.25) {
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(L/2+0.032,0,z), new THREE.Vector3(L/2+0.032,H,z)]), lineMat(color)));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-L/2-0.032,0,z), new THREE.Vector3(-L/2-0.032,H,z)]), lineMat(color)));
      }
    }
    shedGroup.add(group);
  }

  function addOpenings(state, L, W, H) {
    const trim = TRIM_COLORS[state.walls.trimColor] ?? TRIM_COLORS.white;
    const doorW = state.openings.doorWft, doorH = state.openings.doorHft;
    const doorColor = state.openings.doorStyle === "rollup" ? 0xb8bdc1 : 0x5a371f;
    const doorCount = Math.max(0, Math.floor(state.openings.doorCount));
    for (let i = 0; i < doorCount; i++) {
      const x = doorCount === 1 ? 0 : (i - (doorCount - 1) / 2) * (doorW + 0.5);
      addPanel(x, doorH/2, W/2 + 0.055, doorW, doorH, "front", doorColor, 0.09);
      addTrimAround(x, doorH/2, W/2 + 0.105, doorW, doorH, "front", trim);
    }
    const winCount = Math.max(0, Math.floor(state.openings.winCount));
    for (let i = 0; i < winCount; i++) {
      const face = state.openings.windowLayout === "right" ? "right" : (state.openings.windowLayout === "front" ? "front" : (i % 2 ? "right" : "left"));
      const w = state.openings.winWft, h = state.openings.winHft, y = Math.min(H - h/2 - 0.8, 4.5);
      if (face === "front") {
        const x = -L/3 + i * Math.min(w + 0.75, L/3);
        addPanel(x, y, W/2 + 0.06, w, h, "front", 0x8fc5e8, 0.08); addTrimAround(x, y, W/2 + 0.11, w, h, "front", trim);
      } else {
        const z = face === "right" ? W/2 + 0.06 : -W/2 - 0.06;
        const x = ((i % 3) - 1) * Math.min(L/4, w + 0.75);
        addPanel(x, y, z, w, h, "front", 0x8fc5e8, 0.08); addTrimAround(x, y, z + (face === "right" ? 0.05 : -0.05), w, h, "front", trim);
      }
    }
  }

  function addRoofRibs(mesh, finish, color=0x1d1d1d) {
    if (finish === "shingle") return;
    const box = new THREE.Box3().setFromObject(mesh);
    for (let x = box.min.x; x <= box.max.x; x += 1.1) {
      const rib = addBox(0.04, 0.035, box.max.z - box.min.z, new THREE.Vector3(x, box.max.y + 0.025, (box.min.z + box.max.z)/2), color);
      rib.rotation.copy(mesh.rotation);
    }
  }

  function addFoundation(state, L, W) {
    if (state.foundation.type === "slab") {
      addBox(L + 1, 0.35, W + 1, new THREE.Vector3(0, -0.18, 0), 0x777777);
    } else if (state.foundation.type === "piers") {
      const spacing = Math.max(4, state.foundation.pierSpacingFt || 6);
      for (let x = -L/2; x <= L/2 + 0.01; x += spacing) for (const z of [-W/2 + 0.7, W/2 - 0.7]) addBox(0.8, 1, 0.8, new THREE.Vector3(x, -0.5, z), 0x686868);
    } else {
      for (const z of [-W/3, W/3]) addBox(L + 1, 0.35, 0.35, new THREE.Vector3(0, -0.18, z), 0x5f4630);
      addBox(L + 1.5, 0.08, W + 1.5, new THREE.Vector3(0, -0.42, 0), 0x4a4a4a);
    }
  }

  function addStudGhosts(L, W, H, spacingFt) {
    const material = mat(0xf2d39b, { transparent:true, opacity:0.28 });
    for (let x = -L/2; x <= L/2; x += spacingFt) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), material); a.position.set(x, H/2, W/2+0.09); shedGroup.add(a);
      const b = a.clone(); b.position.z = -W/2-0.09; shedGroup.add(b);
    }
    for (let z = -W/2; z <= W/2; z += spacingFt) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), material); a.position.set(L/2+0.09, H/2, z); shedGroup.add(a);
      const b = a.clone(); b.position.x = -L/2-0.09; shedGroup.add(b);
    }
  }

  function rebuild(state) {
    clearGroup();
    const L = state.geom.lenFt, W = state.geom.widFt, H = state.geom.htFt;
    addFoundation(state, L, W);

    const wall = addBox(L, H, W, new THREE.Vector3(0, H/2, 0), WALL_COLORS[state.walls.wallColor] ?? WALL_COLORS.cedar);
    addEdges(wall, 0x222222);
    addSidingLines(L, W, H, state.walls.sidingProfile);
    if (state.walls.showStuds) addStudGhosts(L, W, H, state.walls.studSpacingIn / 12);
    addOpenings(state, L, W, H);

    const over = state.roof.overhangFt || 0, pitch = state.roof.pitchX12 || 0;
    const roofColor = ROOF_COLORS[state.roof.roofColor] ?? ROOF_COLORS.galvalume;
    let roofMesh;
    if (state.roof.type === "flat") {
      roofMesh = addBox(L + 2*over, 0.25, W + 2*over, new THREE.Vector3(0, H + 0.125, 0), roofColor, { metalness: state.roof.roofFinish === "metal" ? 0.35 : 0.05 });
    } else if (state.roof.type === "shed") {
      const roofW = W + 2*over, roofL = L + 2*over, rise = roofW * (pitch/12), tilt = Math.atan2(rise, roofW);
      roofMesh = addBox(roofL, 0.25, roofW, new THREE.Vector3(0, H + 0.125 + rise/2, 0), roofColor, { metalness: state.roof.roofFinish === "metal" ? 0.35 : 0.05 });
      roofMesh.rotation.x = tilt;
    } else {
      const roofW = W + 2*over, roofL = L + 2*over, rise = (roofW/2) * (pitch/12);
      const shape = new THREE.Shape(); shape.moveTo(-roofW/2,0); shape.lineTo(0,rise); shape.lineTo(roofW/2,0); shape.lineTo(-roofW/2,0);
      const geom = new THREE.ExtrudeGeometry(shape, { steps:1, depth:roofL, bevelEnabled:false }); geom.rotateY(Math.PI/2); geom.translate(-roofL/2,H,0);
      roofMesh = new THREE.Mesh(geom, mat(roofColor, { metalness: state.roof.roofFinish === "metal" ? 0.35 : 0.05 })); shedGroup.add(roofMesh);
    }
    addEdges(roofMesh, 0x202020); addRoofRibs(roofMesh, state.roof.roofFinish);

    const bounds = new THREE.Box3().setFromObject(shedGroup);
    const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
    const safeDim = Math.max(size.x, size.y, size.z) || 10;
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(safeDim * 1.6 + 6));
    camera.near = 0.1; camera.far = (safeDim * 1.6 + 6) * 20; camera.updateProjectionMatrix();
    controls.target.copy(center); controls.update(); resize();
  }

  function tick() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); }
  tick();
  return { rebuild, resize };
}
