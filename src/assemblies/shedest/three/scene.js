import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const WALL_COLORS = { cedar:0xb98755, barnred:0x8f2f24, sage:0x7d8f68, charcoal:0x34373b };
const TRIM_COLORS = { white:0xf2efe6, black:0x151515, cedar:0xb98755, charcoal:0x34373b };
const ROOF_COLORS = { galvalume:0x9ba3a7, red:0x8d2722, green:0x385a42, charcoal:0x25282c };
const SELECT_COLOR = 0x60a5fa;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x09111f);
  scene.fog = new THREE.Fog(0x09111f, 36, 135);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(18, 14, 18);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x182033, 0.82));
  const rim = new THREE.DirectionalLight(0x38d5ff, 0.55);
  rim.position.set(-16, 10, -12);
  scene.add(rim);
  const dir = new THREE.DirectionalLight(0xffffff, 1.35);
  dir.position.set(10, 18, 8);
  dir.castShadow = true;
  scene.add(dir);

  const grid = new THREE.GridHelper(120, 120, 0x35506d, 0x182033);
  scene.add(grid);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color:0x0d1726, roughness:0.9, metalness:0.02 }));
  floor.rotation.x = -Math.PI/2; floor.position.y = -0.48; floor.receiveShadow = true; scene.add(floor);

  const shedGroup = new THREE.Group();
  scene.add(shedGroup);
  const selectable = [];
  const zoomDetailGroups = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selectedMesh = null;
  let hoveredMesh = null;

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

  canvas.addEventListener("pointermove", updateHover);
  canvas.addEventListener("pointerdown", (event) => {
    const hit = pick(event);
    if (hit) announceSelection(hit.object);
  });

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(selectable, false)[0];
  }

  function updateHover(event) {
    const hit = pick(event);
    const next = hit?.object ?? null;
    if (hoveredMesh && hoveredMesh !== selectedMesh && hoveredMesh.material?.emissive) hoveredMesh.material.emissive.setHex(hoveredMesh.userData.oldHoverEmissive ?? 0x000000);
    hoveredMesh = next;
    canvas.style.cursor = hoveredMesh ? "pointer" : "default";
    if (hoveredMesh && hoveredMesh !== selectedMesh && hoveredMesh.material?.emissive) {
      hoveredMesh.userData.oldHoverEmissive = hoveredMesh.material.emissive.getHex();
      hoveredMesh.material.emissive.setHex(0x1d4ed8);
      canvas.dispatchEvent(new CustomEvent("shed-element-hovered", { detail: hoveredMesh.userData }));
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  function clearGroup() {
    selectable.length = 0;
    zoomDetailGroups.length = 0;
    selectedMesh = null;
    while (shedGroup.children.length) shedGroup.remove(shedGroup.children[0]);
  }

  function makeSelectable(mesh, label, detail, metadata={}) {
    const assemblyId = metadata.assemblyId ?? inferAssembly(label);
    mesh.userData = {
      ...mesh.userData,
      objectId: metadata.objectId ?? `${assemblyId}-assembly`,
      assemblyId,
      assemblyType: metadata.assemblyType ?? assemblyId,
      phase: metadata.phase ?? inferPhase(label),
      estimateItemIds: metadata.estimateItemIds ?? [`${assemblyId}-estimate`],
      label,
      selectLabel: label,
      selectDetail: detail
    };
    selectable.push(mesh);
    return mesh;
  }

  function announceSelection(mesh) {
    if (selectedMesh?.material?.emissive) selectedMesh.material.emissive.setHex(selectedMesh.userData.oldEmissive ?? 0x000000);
    selectedMesh = mesh;
    if (mesh?.material?.emissive) {
      mesh.userData.oldEmissive = mesh.material.emissive.getHex();
      mesh.material.emissive.setHex(SELECT_COLOR);
    }
    canvas.dispatchEvent(new CustomEvent("shed-element-selected", { detail:{
      label: mesh?.userData.selectLabel ?? "Shed",
      text: mesh?.userData.selectDetail ?? "Selectable 3D shed element.",
      assemblyId: mesh?.userData.assemblyId ?? mesh?.userData.assembly ?? "shed",
      objectId: mesh?.userData.objectId
    }}));
  }

  function addBox(L, H, W, position, color=0x2e2e2e, materialOpts={}) {
    const geom = new THREE.BoxGeometry(L, H, W);
    const mesh = new THREE.Mesh(geom, mat(color, materialOpts));
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shedGroup.add(mesh);
    return mesh;
  }

  function addDetailGroup(name, maxDistance) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.maxDistance = maxDistance;
    shedGroup.add(group);
    zoomDetailGroups.push(group);
    return group;
  }

  function addBoxToGroup(group, L, H, W, position, color=0x2e2e2e, materialOpts={}) {
    const geom = new THREE.BoxGeometry(L, H, W);
    const mesh = new THREE.Mesh(geom, mat(color, materialOpts));
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function updateZoomDetailVisibility() {
    const distance = camera.position.distanceTo(controls.target);
    for (const group of zoomDetailGroups) group.visible = distance <= group.userData.maxDistance;
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
      makeSelectable(addPanel(x, doorH/2, W/2 + 0.055, doorW, doorH, "front", doorColor, 0.09), "Door opening", "Door package with rough opening, trim, hardware allowance, and shed access clearance.");
      addTrimAround(x, doorH/2, W/2 + 0.105, doorW, doorH, "front", trim);
    }
    const winCount = Math.max(0, Math.floor(state.openings.winCount));
    for (let i = 0; i < winCount; i++) {
      const face = state.openings.windowLayout === "right" ? "right" : (state.openings.windowLayout === "front" ? "front" : (i % 2 ? "right" : "left"));
      const w = state.openings.winWft, h = state.openings.winHft, y = Math.min(H - h/2 - 0.8, 4.5);
      if (face === "front") {
        const x = -L/3 + i * Math.min(w + 0.75, L/3);
        makeSelectable(addPanel(x, y, W/2 + 0.06, w, h, "front", 0x8fc5e8, 0.08), "Window opening", "Window unit with framed rough opening, casing/trim, and transparent glass area."); addTrimAround(x, y, W/2 + 0.11, w, h, "front", trim);
      } else {
        const z = face === "right" ? W/2 + 0.06 : -W/2 - 0.06;
        const x = ((i % 3) - 1) * Math.min(L/4, w + 0.75);
        makeSelectable(addPanel(x, y, z, w, h, "front", 0x8fc5e8, 0.08), "Window opening", "Window unit with framed rough opening, casing/trim, and transparent glass area."); addTrimAround(x, y, z + (face === "right" ? 0.05 : -0.05), w, h, "front", trim);
      }
    }
  }

  function addDimensionLine(label, a, b, offset=new THREE.Vector3()) {
    const group = new THREE.Group();
    const geom = new THREE.BufferGeometry().setFromPoints([a.clone().add(offset), b.clone().add(offset)]);
    group.add(new THREE.Line(geom, lineMat(0x93c5fd)));
    addLabel(label, a.clone().add(b).multiplyScalar(0.5).add(offset).add(new THREE.Vector3(0, .45, 0)));
    shedGroup.add(group);
  }

  function addRoofRibs(mesh, finish, color=0x1d1d1d) {
    if (finish === "shingle") return;
    const box = new THREE.Box3().setFromObject(mesh);
    for (let x = box.min.x; x <= box.max.x; x += 1.1) {
      const rib = addBox(0.04, 0.035, box.max.z - box.min.z, new THREE.Vector3(x, box.max.y + 0.025, (box.min.z + box.max.z)/2), color);
      rib.rotation.copy(mesh.rotation);
    }
  }

  function addLabel(text, position) {
    const canvas2 = document.createElement("canvas"); canvas2.width = 384; canvas2.height = 96;
    const ctx = canvas2.getContext("2d"); ctx.fillStyle = "rgba(15,23,42,.78)"; ctx.fillRect(0,0,384,96);
    ctx.strokeStyle = "rgba(147,197,253,.9)"; ctx.strokeRect(2,2,380,92);
    ctx.fillStyle = "#e0f2fe"; ctx.font = "22px system-ui"; ctx.fillText(text, 16, 58);
    const tex = new THREE.CanvasTexture(canvas2);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true }));
    sprite.position.copy(position); sprite.scale.set(4.8, 1.2, 1); shedGroup.add(sprite);
  }

  function addFoundation(state, L, W) {
    if (state.foundation.type === "none") return;
    if (state.foundation.type === "slab") {
      makeSelectable(addBox(L + 1, 0.35, W + 1, new THREE.Vector3(0, -0.18, 0), 0x777777), "Slab foundation", "Concrete slab-on-grade: flat bearing surface below shed walls/floor.");
    } else if (state.foundation.type === "piers") {
      const spacing = Math.max(4, state.foundation.pierSpacingFt || 6);
      for (let x = -L/2; x <= L/2 + 0.01; x += spacing) for (const z of [-W/2 + 0.7, W/2 - 0.7]) makeSelectable(addBox(0.8, 1, 0.8, new THREE.Vector3(x, -0.5, z), 0x686868), "Pier foundation", "Pier support transferring floor beam loads to discrete concrete/post bearing points.");
    } else if (state.foundation.type === "ground_screws") {
      const spacing = Math.max(4, state.foundation.pierSpacingFt || 6);
      for (let x = -L/2; x <= L/2 + 0.01; x += spacing) for (const z of [-W/2 + 0.7, W/2 - 0.7]) {
        const screw = makeSelectable(addBox(0.38, 1.25, 0.38, new THREE.Vector3(x, -0.62, z), 0x5f7182, { metalness:0.45, roughness:0.36 }), "Ground screw foundation", "Helical ground screw support for remote sites where concrete logistics may be reduced.");
        screw.rotation.y = Math.PI / 4;
      }
    } else {
      for (const z of [-W/3, W/3]) makeSelectable(addBox(L + 1, 0.35, 0.35, new THREE.Vector3(0, -0.18, z), 0x5f4630), "PT skid", "Pressure-treated skid supporting floor joists over gravel.");
      addBox(L + 1.5, 0.08, W + 1.5, new THREE.Vector3(0, -0.42, 0), 0x4a4a4a);
    }
  }

  function addFloorFraming(L, W, spacingFt) {
    const group = addDetailGroup("zoom-floor-framing", Math.max(L, W) * 2.4 + 10);
    const memberMat = { transparent:true, opacity:0.78 };
    for (let x = -L/2; x <= L/2 + 0.01; x += spacingFt) {
      const joist = addBoxToGroup(group, 0.13, 0.24, W, new THREE.Vector3(x, 0.14, 0), 0xc49a6c, memberMat);
      makeSelectable(joist, "Floor joist", `Internal floor framing at ${Math.round(spacingFt*12)} in. o.c.; visible as you zoom inside the shed.`);
    }
    for (const z of [-W/2, W/2]) {
      const rim = addBoxToGroup(group, L, 0.28, 0.16, new THREE.Vector3(0, 0.16, z), 0xd6ad7c, memberMat);
      makeSelectable(rim, "Rim joist", "Perimeter floor framing tying the joist ends together at the platform edge.");
    }
  }

  function addWallPlatesAndBlocking(L, W, H, topPlateCount, opacity=0.78) {
    const group = addDetailGroup("zoom-wall-members", Math.max(L, W) * 2.0 + 8);
    const opts = { transparent:true, opacity };
    for (const y of [0.16, H - 0.16]) {
      for (const z of [-W/2, W/2]) makeSelectable(addBoxToGroup(group, L, 0.14, 0.14, new THREE.Vector3(0, y, z), 0xe0ba82, opts), y < 1 ? "Bottom plate" : "Top plate", "Continuous wall plate framing tying studs together around the shed perimeter.");
      for (const x of [-L/2, L/2]) makeSelectable(addBoxToGroup(group, 0.14, 0.14, W, new THREE.Vector3(x, y, 0), 0xe0ba82, opts), y < 1 ? "Bottom plate" : "Top plate", "Continuous wall plate framing tying studs together around the shed perimeter.");
    }
    if (topPlateCount === "double") {
      for (const z of [-W/2, W/2]) makeSelectable(addBoxToGroup(group, L, 0.12, 0.14, new THREE.Vector3(0, H + 0.02, z), 0xf0c98c, opts), "Double top plate", "Second top plate layer for wall tie and roof-load transfer.");
      for (const x of [-L/2, L/2]) makeSelectable(addBoxToGroup(group, 0.14, 0.12, W, new THREE.Vector3(x, H + 0.02, 0), 0xf0c98c, opts), "Double top plate", "Second top plate layer for wall tie and roof-load transfer.");
    }
    for (let y = 2; y < H - 1; y += 2) {
      for (const z of [-W/2, W/2]) makeSelectable(addBoxToGroup(group, L, 0.08, 0.1, new THREE.Vector3(0, y, z), 0xb98d5b, { transparent:true, opacity:0.45 }), "Wall blocking", "Horizontal blocking/nailer rows revealed at close zoom inside the wall skeleton.");
    }
  }

  function addStudGhosts(L, W, H, spacingFt, opacity=0.28) {
    const material = mat(0xf2d39b, { transparent:true, opacity });
    for (let x = -L/2; x <= L/2; x += spacingFt) {
      const a = makeSelectable(new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), material), "Wall stud", `Vertical wall framing at ${Math.round(spacingFt*12)} in. o.c.; carries sheathing and roof load to foundation.`); a.position.set(x, H/2, W/2+0.09); shedGroup.add(a);
      const b = a.clone(); b.position.z = -W/2-0.09; shedGroup.add(b);
    }
    for (let z = -W/2; z <= W/2; z += spacingFt) {
      const a = makeSelectable(new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), material), "Wall stud", `Vertical wall framing at ${Math.round(spacingFt*12)} in. o.c.; carries sheathing and roof load to foundation.`); a.position.set(L/2+0.09, H/2, z); shedGroup.add(a);
      const b = a.clone(); b.position.x = -L/2-0.09; shedGroup.add(b);
    }
  }


  function addShedWallInfill(L, W, H, rise, color, xray=false) {
    if (rise <= 0.05) return null;
    const verts = new Float32Array([
      -L/2, H, -W/2,   L/2, H, -W/2,   L/2, H, W/2,   -L/2, H, W/2,
      -L/2, H + rise, -W/2,   L/2, H + rise, -W/2,   L/2, H, W/2,   -L/2, H, W/2
    ]);
    const idx = [
      0,1,2, 0,2,3,
      4,7,6, 4,6,5,
      0,4,5, 0,5,1,
      1,5,6, 1,6,2,
      3,7,4, 3,4,0
    ];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, mat(color, xray ? { transparent:true, opacity:0.38 } : {}));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.assembly = "walls";
    shedGroup.add(mesh);
    makeSelectable(mesh, "Shed roof wall infill", "Triangular/clerestory wall infill framed above the standard wall height to close the space under the shed roof plane.");
    addEdges(mesh, 0x222222);
    return mesh;
  }

  function addShedInfillFraming(L, W, H, rise, spacingFt, opacity=0.76) {
    if (rise <= 0.05) return;
    const group = addDetailGroup("zoom-shed-infill-framing", Math.max(L, W) * 2.2 + 10);
    const opts = { transparent:true, opacity };
    const highZ = -W/2;
    const lowZ = W/2;
    for (let x = -L/2; x <= L/2 + 0.01; x += spacingFt) {
      const stud = addBoxToGroup(group, 0.12, rise, 0.12, new THREE.Vector3(x, H + rise/2, highZ), 0xf0c98c, opts);
      makeSelectable(stud, "High-wall infill stud", "Cripple stud framing that raises the high side wall to meet the shed roof plane.");
    }
    for (const x of [-L/2, L/2]) {
      for (let z = -W/2; z <= W/2 + 0.01; z += spacingFt) {
        const localRise = rise * ((W/2 - z) / W);
        if (localRise <= 0.08) continue;
        const stud = addBoxToGroup(group, 0.12, localRise, 0.12, new THREE.Vector3(x, H + localRise/2, z), 0xe8c48a, opts);
        makeSelectable(stud, "Sloped end-wall infill stud", "Graduated end-wall cripple stud cut to the shed roof slope.");
      }
      const slopeLen = Math.hypot(W, rise);
      const plate = addBoxToGroup(group, 0.14, 0.14, slopeLen, new THREE.Vector3(x, H + rise/2, 0), 0xf8d698, opts);
      plate.rotation.x = Math.atan2(rise, W);
      makeSelectable(plate, "Sloped end-wall top plate", "Sloped top plate closes the rake-shaped wall extension under the shed roof.");
    }
    makeSelectable(addBoxToGroup(group, L, 0.14, 0.14, new THREE.Vector3(0, H + rise, highZ), 0xf8d698, opts), "High-wall top plate", "Continuous raised top plate for the high side of the shed roof wall infill.");
    makeSelectable(addBoxToGroup(group, L, 0.12, 0.12, new THREE.Vector3(0, H + 0.06, lowZ), 0xd6ad7c, opts), "Low-wall roof bearing plate", "Low side roof bearing line where the shed roof plane starts at standard wall height.");
  }

  function addGableEndStackedFraming(L, roofL, roofW, H, rise) {
    if (rise <= 0.05) return;
    const group = addDetailGroup("zoom-gable-stacked-framing", Math.max(L, roofW) * 2.2 + 10);
    const opts = { transparent:true, opacity:0.82 };
    for (const x of [-roofL/2, roofL/2]) {
      for (let y = H + 0.35; y < H + rise; y += 0.42) {
        const normalized = (y - H) / rise;
        const stackWidth = Math.max(0.28, roofW * (1 - normalized));
        const block = addBoxToGroup(group, 0.14, 0.12, stackWidth, new THREE.Vector3(x, y, 0), 0xf0c98c, opts);
        makeSelectable(block, "Stacked gable framing", "Sloped roof void is shown as stacked framing members rather than a filled solid mass.");
      }
      const king = addBoxToGroup(group, 0.14, rise, 0.12, new THREE.Vector3(x, H + rise/2, 0), 0xe8c48a, opts);
      makeSelectable(king, "Gable end stud", "Vertical gable-end framing supporting the stacked look under the sloped roof planes.");
    }
  }

  function addRoofFraming(state, L, W, H) {
    const over = state.roof.overhangFt || 0, pitch = state.roof.pitchX12 || 0;
    const spacing = state.walls.studSpacingIn / 12;
    const roofW = W + 2*over, roofL = L + 2*over;
    const rise = state.roof.type === "gable" ? (roofW/2)*(pitch/12) : roofW*(pitch/12);
    const yBase = H + 0.12;
    for (let x = -roofL/2; x <= roofL/2 + .01; x += spacing) {
      if (state.roof.type === "gable") {
        const slopeLen = Math.hypot(roofW/2, rise);
        const tilt = Math.atan2(rise, roofW/2);
        const left = addBox(0.12, 0.16, slopeLen, new THREE.Vector3(x, yBase + rise/2, -roofW/4), 0xe8c48a, { transparent:true, opacity:0.72 });
        left.rotation.x = -tilt;
        makeSelectable(left, "Roof rafter", "Sloped gable rafter: one half of the roof frame, leaving the roof volume open and skeletonized.");
        const right = addBox(0.12, 0.16, slopeLen, new THREE.Vector3(x, yBase + rise/2, roofW/4), 0xe8c48a, { transparent:true, opacity:0.72 });
        right.rotation.x = tilt;
        makeSelectable(right, "Roof rafter", "Sloped gable rafter: one half of the roof frame, leaving the roof volume open and skeletonized.");
      } else {
        const rafter = addBox(0.12, 0.16, roofW, new THREE.Vector3(x, yBase + Math.max(rise, .1)/2, 0), 0xe8c48a, { transparent:true, opacity:0.72 });
        if (state.roof.type === "shed") rafter.rotation.x = Math.atan2(rise, roofW);
        makeSelectable(rafter, "Roof rafter", "Typical roof framing member: sloped 2x lumber at wall spacing, supports roof sheathing and finish.");
      }
    }
    if (state.roof.type === "gable") makeSelectable(addBox(roofL, 0.18, 0.16, new THREE.Vector3(0, H + rise + 0.12, 0), 0xf8d698, { transparent:true, opacity:0.82 }), "Ridge board", "Gable ridge board ties opposing rafters together at the roof peak.");
    addLabel("Roof build-up: rafters → sheathing → underlayment/finish → fascia/soffit", new THREE.Vector3(0, H + rise + 2.2, 0));
  }

  function rebuild(state) {
    clearGroup();
    const L = state.geom.lenFt, W = state.geom.widFt, H = state.geom.htFt;
    addFoundation(state, L, W);
    addDimensionLine(`${L}' length`, new THREE.Vector3(-L/2, .05, -W/2-1.2), new THREE.Vector3(L/2, .05, -W/2-1.2));
    addDimensionLine(`${W}' width`, new THREE.Vector3(L/2+1.2, .05, -W/2), new THREE.Vector3(L/2+1.2, .05, W/2));
    addDimensionLine(`${H}' wall`, new THREE.Vector3(-L/2-1.0, 0, W/2), new THREE.Vector3(-L/2-1.0, H, W/2));

    const mode = state.walls.visualMode ?? "finished";
    const framingMode = mode === "framing" || mode === "skeleton";
    const blueprintMode = mode === "blueprint";
    const explodedMode = mode === "exploded";
    const impactMode = mode === "impact";
    const xray = mode === "xray" || framingMode || mode === "roof" || mode === "foundation" || explodedMode || impactMode || blueprintMode;
    const wall = makeSelectable(addBox(L, H, W, new THREE.Vector3(0, H/2 + (explodedMode ? 0.25 : 0), explodedMode ? -0.55 : 0), blueprintMode ? 0x15365a : (WALL_COLORS[state.walls.wallColor] ?? WALL_COLORS.cedar), xray ? { transparent:true, opacity: framingMode ? 0.12 : (blueprintMode ? 0.18 : 0.38), wireframe: blueprintMode } : {}), "Wall shell", "Exterior wall assembly: studs, plates, sheathing, siding, and trim around openings." );
    wall.userData.assembly = "walls";
    addEdges(wall, 0x222222);
    addSidingLines(L, W, H, state.walls.sidingProfile);
    if (mode === "xray") addLabel("Cutaway layers: siding → sheathing → studs → interior finish", new THREE.Vector3(0, H + 1.4, W/2 + 1.2));
    if (state.walls.showStuds || xray) addStudGhosts(L, W, H, state.walls.studSpacingIn / 12, mode === "skeleton" ? 0.8 : 0.32);
    addFloorFraming(L, W, state.walls.studSpacingIn / 12);
    addWallPlatesAndBlocking(L, W, H, state.walls.topPlate, mode === "skeleton" ? 0.86 : 0.68);
    addOpenings(state, L, W, H);

    const over = state.roof.overhangFt || 0, pitch = state.roof.pitchX12 || 0;
    if (state.roof.type === "shed") {
      const wallRise = W * (pitch / 12);
      addShedWallInfill(L, W, H, wallRise, WALL_COLORS[state.walls.wallColor] ?? WALL_COLORS.cedar, xray);
      addShedInfillFraming(L, W, H, wallRise, state.walls.studSpacingIn / 12, mode === "skeleton" ? 0.86 : 0.68);
    }
    const roofColor = ROOF_COLORS[state.roof.roofColor] ?? ROOF_COLORS.galvalume;
    let roofMesh;
    if (state.roof.type === "flat") {
      roofMesh = addBox(L + 2*over, 0.25, W + 2*over, new THREE.Vector3(0, H + 0.125, 0), roofColor, { metalness: state.roof.roofFinish === "metal" ? 0.35 : 0.05, transparent:xray, opacity:xray ? 0.42 : 1 });
    } else if (state.roof.type === "shed") {
      const roofW = W + 2*over, roofL = L + 2*over, rise = roofW * (pitch/12), tilt = Math.atan2(rise, roofW);
      roofMesh = addBox(roofL, 0.25, roofW, new THREE.Vector3(0, H + 0.125 + rise/2, 0), roofColor, { metalness: state.roof.roofFinish === "metal" ? 0.35 : 0.05, transparent:xray, opacity:xray ? 0.42 : 1 });
      roofMesh.rotation.x = tilt;
    } else {
      const roofW = W + 2*over, roofL = L + 2*over, rise = (roofW/2) * (pitch/12);
      const slopeLen = Math.hypot(roofW/2, rise);
      const tilt = Math.atan2(rise, roofW/2);
      const left = addBox(roofL, 0.25, slopeLen, new THREE.Vector3(0, H + rise/2, -roofW/4), roofColor, { metalness: state.roof.roofFinish === "metal" ? 0.35 : 0.05, transparent:xray, opacity:xray ? 0.42 : 1 });
      left.rotation.x = -tilt;
      const right = addBox(roofL, 0.25, slopeLen, new THREE.Vector3(0, H + rise/2, roofW/4), roofColor, { metalness: state.roof.roofFinish === "metal" ? 0.35 : 0.05, transparent:xray, opacity:xray ? 0.42 : 1 });
      right.rotation.x = tilt;
      left.position.y += explodedMode ? 0.9 : 0; left.position.z -= explodedMode ? 0.45 : 0; left.userData.assembly = "roof";
      makeSelectable(left, "Left roof plane", `Sloped roof plane: ${state.roof.roofFinish} finish over ${state.roof.roofSheathKey.replaceAll("_", " ")} sheathing, ${state.roof.pitchX12}:12 pitch.`);
      right.position.y += explodedMode ? 0.9 : 0; right.position.z += explodedMode ? 0.45 : 0; right.userData.assembly = "roof";
      makeSelectable(right, "Right roof plane", `Sloped roof plane: ${state.roof.roofFinish} finish over ${state.roof.roofSheathKey.replaceAll("_", " ")} sheathing, ${state.roof.pitchX12}:12 pitch.`);
      addEdges(left, 0x202020); addEdges(right, 0x202020);
      addRoofRibs(left, state.roof.roofFinish); addRoofRibs(right, state.roof.roofFinish);
      addGableEndStackedFraming(L, roofL, roofW, H, rise);
      roofMesh = new THREE.Group(); shedGroup.add(roofMesh); roofMesh.add(left, right);
    }
    if (roofMesh instanceof THREE.Mesh) {
      roofMesh.position.y += explodedMode ? 0.9 : 0; roofMesh.userData.assembly = "roof";
      makeSelectable(roofMesh, "Roof finish / sheathing", `Roof assembly: ${state.roof.roofFinish} finish over ${state.roof.roofSheathKey.replaceAll("_", " ")} sheathing, ${state.roof.pitchX12}:12 pitch, ${state.roof.overhangFt} ft overhang.`);
      addEdges(roofMesh, 0x202020); addRoofRibs(roofMesh, state.roof.roofFinish);
    }
    if (framingMode || mode === "roof" || explodedMode || blueprintMode) addRoofFraming(state, L, W, H);

    if (blueprintMode) addLabel("BLUEPRINT MODE · wireframe takeoff overlay", new THREE.Vector3(0, H + 2.4, 0));
    if (impactMode) addLabel("ESTIMATE IMPACT · select line items to pulse linked assemblies", new THREE.Vector3(0, H + 2.4, 0));

    const bounds = new THREE.Box3().setFromObject(shedGroup);
    const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
    const safeDim = Math.max(size.x, size.y, size.z) || 10;
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(safeDim * 1.6 + 6));
    camera.near = 0.1; camera.far = (safeDim * 1.6 + 6) * 20; camera.updateProjectionMatrix();
    controls.target.copy(center); controls.update(); updateZoomDetailVisibility(); resize();
  }

  function highlightAssembly(assembly) {
    for (const obj of selectable) {
      const inferred = obj.userData.assemblyId || obj.userData.assembly || inferAssembly(obj.userData.selectLabel);
      if (obj.material?.emissive) obj.material.emissive.setHex(inferred === assembly ? SELECT_COLOR : 0x000000);
    }
  }

  function inferAssembly(label="") {
    const lower = `${label}`.toLowerCase();
    if (lower.includes("roof") || lower.includes("rafter") || lower.includes("ridge")) return "roof";
    if (lower.includes("foundation") || lower.includes("skid") || lower.includes("pier") || lower.includes("screw") || lower.includes("slab")) return "foundation";
    if (lower.includes("door")) return "doors";
    if (lower.includes("window")) return "windows";
    if (lower.includes("floor") || lower.includes("joist") || lower.includes("rim")) return "floor";
    return "walls";
  }

  function inferPhase(label="") {
    const lower = `${label}`.toLowerCase();
    if (lower.includes("stud") || lower.includes("plate") || lower.includes("rafter") || lower.includes("joist")) return "framing";
    if (lower.includes("foundation") || lower.includes("slab") || lower.includes("pier") || lower.includes("skid")) return "foundation";
    if (lower.includes("roof")) return "roof";
    return "finish";
  }

  function setCameraPreset(preset) {
    const box = new THREE.Box3().setFromObject(shedGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z, 10) * 1.75;
    const positions = {
      front:[0, size.y * .55, d], left:[-d, size.y * .55, 0], right:[d, size.y * .55, 0], back:[0, size.y * .55, -d], side:[d, size.y * .55, 0], plan:[0, d, .01], isometric:[d*.7, d*.52, d*.7], framing:[d*.85, d*.55, d*.85], roof:[d*.55, d*.85, d*.25], foundation:[d*.75, d*.25, d*.75], orbit:[d*.7, d*.52, d*.7]
    };
    const pos = positions[preset] || positions.orbit;
    camera.position.set(center.x + pos[0], center.y + pos[1], center.z + pos[2]);
    controls.target.copy(center);
    controls.update();
  }

  function tick() { controls.update(); updateZoomDetailVisibility(); renderer.render(scene, camera); requestAnimationFrame(tick); }
  tick();
  return { rebuild, resize, highlightAssembly, setCameraPreset };
}
