import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0b);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(18, 14, 18);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 15, 8);
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

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  function clearGroup() {
    while (shedGroup.children.length) shedGroup.remove(shedGroup.children[0]);
  }

  function addBox(L, H, W, yCenter, color=0x2e2e2e) {
    const geom = new THREE.BoxGeometry(L, H, W);
    const mat = new THREE.MeshStandardMaterial({ color, metalness:0.05, roughness:0.9 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = yCenter;
    shedGroup.add(mesh);

    const wgeom = new THREE.WireframeGeometry(geom);
    const wmat = new THREE.LineBasicMaterial({ color: 0xbfbfbf });
    const wire = new THREE.LineSegments(wgeom, wmat);
    wire.position.copy(mesh.position);
    shedGroup.add(wire);
  }

  function addRoofGable(L, W, eaveH, ridgeH) {
    // simple triangular prism roof (visual only)
    const shape = new THREE.Shape();
    shape.moveTo(-W/2, 0);
    shape.lineTo(0, ridgeH - eaveH);
    shape.lineTo(W/2, 0);
    shape.lineTo(-W/2, 0);

    const extrudeSettings = { steps: 1, depth: L, bevelEnabled: false };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.rotateY(Math.PI / 2);
    geom.translate(-L / 2, eaveH, 0);

    const mat = new THREE.MeshStandardMaterial({ color:0x242424, metalness:0.05, roughness:0.95 });
    const mesh = new THREE.Mesh(geom, mat);
    shedGroup.add(mesh);
  }

  function addGableEndPanels(L, W, eaveH, ridgeH, color = 0x2e2e2e) {
    const rise = ridgeH - eaveH;
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, eaveH);
    shape.lineTo(0, eaveH + rise);
    shape.lineTo(W / 2, eaveH);
    shape.lineTo(-W / 2, eaveH);

    const geom = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.05,
      roughness: 0.9,
      side: THREE.DoubleSide
    });

    const left = new THREE.Mesh(geom, mat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-L / 2, 0, 0);
    shedGroup.add(left);

    const right = new THREE.Mesh(geom, mat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(L / 2, 0, 0);
    shedGroup.add(right);
  }

  function addShedEndPanels(L, W, eaveH, rise, color = 0x2e2e2e) {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, eaveH);
    shape.lineTo(-W / 2, eaveH + rise);
    shape.lineTo(W / 2, eaveH);
    shape.lineTo(-W / 2, eaveH);

    const geom = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.05,
      roughness: 0.9,
      side: THREE.DoubleSide
    });

    const left = new THREE.Mesh(geom, mat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-L / 2, 0, 0);
    shedGroup.add(left);

    const right = new THREE.Mesh(geom, mat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(L / 2, 0, 0);
    shedGroup.add(right);
  }

  function rebuild(state) {
    clearGroup();

    const L = state.geom.lenFt;
    const W = state.geom.widFt;
    const H = state.geom.htFt;

    // Wall box
    addBox(L, H, W, H/2, 0x2e2e2e);

    // Roof visuals
    const over = state.roof.overhangFt || 0;
    const roofType = state.roof.type;
    const pitch = state.roof.pitchX12 || 0;

    if (roofType === "flat") {
      addBox(L + 2*over, 0.25, W + 2*over, H + 0.125, 0x262626);
    } else if (roofType === "shed") {
      // slope across width: just show a thin box rotated
      const roofW = W + 2*over;
      const roofL = L + 2*over;
      const rise = roofW * (pitch/12);
      const tilt = Math.atan2(rise, roofW);
      const thickness = 0.25;
      const geom = new THREE.BoxGeometry(roofL, thickness, roofW);
      const mat = new THREE.MeshStandardMaterial({ color:0x262626, metalness:0.05, roughness:0.95 });
      const mesh = new THREE.Mesh(geom, mat);
      const yOffset = H + (thickness / 2) * Math.cos(tilt) + (roofW / 2) * Math.sin(tilt);
      mesh.position.set(0, yOffset, 0);
      mesh.rotation.x = tilt;
      shedGroup.add(mesh);

      const wgeom = new THREE.WireframeGeometry(geom);
      const wire = new THREE.LineSegments(wgeom, new THREE.LineBasicMaterial({ color:0xbfbfbf }));
      wire.position.copy(mesh.position);
      wire.rotation.copy(mesh.rotation);
      shedGroup.add(wire);

      addShedEndPanels(L, W, H, rise);
    } else {
      // gable: show triangular prism
      const roofW = W + 2*over;
      const roofL = L + 2*over;
      const half = roofW / 2;
      const rise = half * (pitch/12);
      addRoofGable(roofL, roofW, H, H + rise);
      addGableEndPanels(L, W, H, H + rise);
    }

    const bounds = new THREE.Box3().setFromObject(shedGroup);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const safeDim = Number.isFinite(maxDim) && maxDim > 0 ? maxDim : 10;
    const currentDir = camera.position.clone().sub(controls.target);
    const direction = currentDir.lengthSq() > 0 ? currentDir.normalize() : new THREE.Vector3(1, 1, 1).normalize();
    const distance = safeDim * 1.6 + 6;
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    camera.near = Math.max(0.1, distance / 200);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
    resize();
  }

  function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  tick();

  return { rebuild, resize };
}
