import * as THREE from 'three';
import './style.css';
import { TRIPS } from './data/trips.js';
import { World } from './world/world.js';
import { createSky } from './world/sky.js';
import { VIEWS } from './world/landmarks.js';
import { occlusion } from './world/toon.js';
import { Player } from './player/player.js';
import { CameraRig } from './core/rig.js';
import { Ambience } from './core/audio.js';
import { UI } from './ui/ui.js';

const trip = TRIPS[0];
const canvas = document.getElementById('scene');
const isTouch = matchMedia('(hover: none)').matches;

// ── Renderer / scene ─────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(isTouch ? 62 : 55, window.innerWidth / window.innerHeight, 0.1, 1200);
const uniforms = { uTime: { value: 0 } };

const hemi = new THREE.HemisphereLight(0xe4f7f0, 0x86b69a, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun, sun.target);

const sky = createSky(uniforms);
scene.add(sky);

const ui = new UI(trip, {
  onStart: start,
  onToggleMap: () => setMap(rig.mode !== 'planet'),
  onToggleMusic: () => {
    musicOn = !musicOn;
    audio.setOn(musicOn);
    ui.setMusic(musicOn);
  },
  onTravel: (id) => travelTo(id),
  onInteract: () => interact(),
  onDiscover: (place, n, total) => {
    audio.discover();
    setTimeout(() => ui.toast(n === total ? `Đã khám phá trọn ${trip.title}! 🎉` : `Khám phá ${n}/${total}: ${place.name}`), 900);
  },
  onGalleryClose: () => player.char.setSnap(false),
});

const audio = new Ambience();
let musicOn = true;

let world;
let player;
let rig;
let started = false;
const pickers = [];

// ── Dựng hành tinh (sau 1 frame để loader kịp hiện) ──────────
requestAnimationFrame(() =>
  setTimeout(() => {
    world = new World(trip, uniforms).build();
    scene.add(world.group);
    player = new Player(world);
    scene.add(player.object);
    rig = new CameraRig(camera, player, world.R);

    for (const p of world.places) {
      const v = VIEWS[p.landmark] ?? VIEWS.default;
      p.view = v;
      p.focus = world.surfacePoint(dirAtLocal(p, v.focus[0], v.focus[1]), 2.2);
      const s = new THREE.Mesh(new THREE.SphereGeometry(v.pick, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
      s.position.copy(p.focus);
      s.userData.placeId = p.id;
      scene.add(s);
      pickers.push(s);
    }

    const hashId = decodeURIComponent(location.hash.slice(1));
    const spawn = world.places.find((p) => p.id === hashId) ?? world.places.find((p) => p.id === trip.spawn) ?? world.places[0];
    placeAtView(spawn);
    rig.syncHeading();
    // hành tinh nhìn từ phía người chơi, hơi nghiêng
    rig.mode = 'explore';
    rig.setMode('planet');
    rig.blend = 1;
    rig.orbitDist = 90;
    rig.orbitDistTarget = 72;
    ui.ready();
    if (hashId === spawn.id) pendingOpen = spawn.id;
  }, 30),
);
let pendingOpen = null;

function dirAtLocal(p, x, z) {
  return p.dir.clone().multiplyScalar(world.R).addScaledVector(p.frame.side, x).addScaledVector(p.frame.fwd, z).normalize();
}

function placeAtView(p) {
  const v = p.view ?? VIEWS[p.landmark] ?? VIEWS.default;
  const at = dirAtLocal(p, v.at[0], v.at[1]);
  const look = dirAtLocal(p, v.focus[0], v.focus[1]);
  const facing = look.clone().sub(at);
  player.placeAt(at, facing);
  rig.syncHeading();
  rig.smoothTarget.set(0, 0, 0);
  rig.smoothUp.copy(at);
}

function start() {
  if (started || !world) return;
  started = true;
  ui.hideIntro();
  audio.setOn(musicOn);
  ui.setMusic(musicOn);
  rig.setMode('explore', { speed: 0.45 });
  ui.setMapActive(false);
  ui.showHint(
    isTouch
      ? 'Chạm mặt đất để đi · Kéo để xoay · Chụm để thu phóng · Tới gần địa điểm để xem ảnh'
      : 'WASD / click để đi · Kéo chuột để xoay · Cuộn để thu phóng · Shift chạy · M bản đồ · E xem ảnh',
    11000,
  );
  if (pendingOpen) setTimeout(() => ui.openGallery(pendingOpen), 2600);
}

function setMap(on) {
  if (!started) return;
  rig.setMode(on ? 'planet' : 'explore', { speed: on ? 0.8 : 0.6 });
  ui.setMapActive(on);
  ui.setPlaceTitle(null);
}

function travelTo(id) {
  const p = world.places.find((q) => q.id === id);
  if (!p) return;
  if (!started) start();
  const wasPlanet = rig.mode === 'planet';
  if (!wasPlanet) {
    // bay lên toàn cảnh rồi đáp xuống
    rig.setMode('planet', { speed: 1.4 });
    setTimeout(() => {
      placeAtView(p);
      rig.setMode('explore', { speed: 0.6 });
      ui.setMapActive(false);
    }, 900);
  } else {
    placeAtView(p);
    rig.setMode('explore', { speed: 0.55 });
    ui.setMapActive(false);
  }
  history.replaceState(null, '', `#${p.id}`);
}

let nearPlace = null;
function interact() {
  if (!nearPlace || ui.gallery.open) return;
  openPlace(nearPlace);
}
function openPlace(p) {
  player.char.setSnap(true);
  audio.shutter();
  ui.flash();
  setTimeout(() => ui.openGallery(p.id), 260);
  history.replaceState(null, '', `#${p.id}`);
}

// ── Input ───────────────────────────────────────────────────
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (ui.gallery.open) ui.closeGallery();
    else if (ui.journalOpen) ui.toggleJournal(false);
    else if (rig?.mode === 'planet' && started) setMap(false);
    return;
  }
  if (ui.gallery.open) return;
  if (!started && (k === 'enter' || k === ' ')) {
    start();
    return;
  }
  if (k === 'e' || k === 'enter' || k === ' ') {
    e.preventDefault();
    interact();
  } else if (k === 'm') setMap(rig.mode !== 'planet');
  else if (k === 'j') ui.toggleJournal();
  keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const pointers = new Map();
let dragMoved = 0;
let pinchDist = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !rig) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    handleZoom((pinchDist - d) * 4);
    pinchDist = d;
    dragMoved = 99;
    return;
  }
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (dragMoved > 6) {
    canvas.classList.add('dragging');
    rig.drag(dx, dy);
  }
});
const endPointer = (e) => {
  const had = pointers.delete(e.pointerId);
  canvas.classList.remove('dragging');
  if (had && pointers.size === 0 && dragMoved <= 6 && e.type === 'pointerup') handleClick(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  handleZoom(e.deltaY);
}, { passive: false });

function handleZoom(delta) {
  if (!rig || !started || ui.gallery.open) return;
  const sw = rig.zoom(delta);
  if (sw) setMap(sw === 'planet');
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let marker;
function handleClick(x, y) {
  if (!started || !world || ui.gallery.open) return;
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const tHit = raycaster.intersectObject(world.terrainMesh, false)[0];
  if (rig.mode === 'planet') {
    if (!tHit) return;
    const d = tHit.point.clone().normalize();
    // gần địa điểm nào thì bay tới đó, không thì đáp xuống chỗ vừa chạm (nếu là đất)
    let best = null;
    let bestD = 7;
    for (const p of world.places) {
      const dist = Math.acos(Math.min(1, p.dir.dot(d))) * world.R;
      if (dist < bestD) [best, bestD] = [p, dist];
    }
    if (best) travelTo(best.id);
    else if (world.terrain.walkable(d)) {
      player.placeAt(d, player.facing);
      rig.syncHeading();
      rig.smoothTarget.set(0, 0, 0);
      setMap(false);
    }
    return;
  }
  const pHit = raycaster.intersectObjects(pickers, false)[0];
  if (pHit && (!tHit || pHit.distance < tHit.distance + 2)) {
    const p = world.places.find((q) => q.id === pHit.object.userData.placeId);
    if (p === nearPlace) return openPlace(p);
    const v = p.view;
    player.walkTo(dirAtLocal(p, v.at[0], v.at[1]), { stopDist: 1.2, onArrive: () => openPlace(p) });
    showMarker(world.surfacePoint(dirAtLocal(p, v.at[0], v.at[1]), 0.08), dirAtLocal(p, v.at[0], v.at[1]));
    return;
  }
  if (tHit) {
    const d = tHit.point.clone().normalize();
    player.walkTo(d);
    showMarker(tHit.point, d);
  }
}

function showMarker(pos, up) {
  if (!marker) {
    marker = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.34, 28),
      new THREE.MeshBasicMaterial({ color: 0xfffaf0, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    marker.renderOrder = 5;
    scene.add(marker);
  }
  marker.position.copy(pos).addScaledVector(up, 0.08);
  marker.lookAt(pos.clone().add(up));
  marker.userData.t = 0;
  marker.visible = true;
}

// ── Vòng lặp ────────────────────────────────────────────────
const clock = new THREE.Clock();
const _v = new THREE.Vector3();
const _move = new THREE.Vector3();
const _right = new THREE.Vector3();

function keyMove() {
  let f = 0;
  let s = 0;
  if (keys.has('w') || keys.has('arrowup')) f += 1;
  if (keys.has('s') || keys.has('arrowdown')) f -= 1;
  if (keys.has('d') || keys.has('arrowright')) s += 1;
  if (keys.has('a') || keys.has('arrowleft')) s -= 1;
  if (!f && !s) return null;
  const fwd = rig.forward();
  _right.crossVectors(fwd, player.dir).normalize();
  _move.copy(fwd).multiplyScalar(f).addScaledVector(_right, s);
  if (_move.lengthSq() > 1) _move.normalize();
  return _move;
}

function project(p, out = {}) {
  _v.copy(p).project(camera);
  out.x = (_v.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
  out.behind = _v.z > 1;
  return out;
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  uniforms.uTime.value = t;
  if (!world) return;

  const canMove = started && rig.blend < 0.3 && !ui.gallery.open;
  const mv = canMove ? keyMove() : null;
  if (!canMove && player.target && rig.mode === 'planet') player.target = null;
  player.update(canMove ? dt : 0, mv, keys.has('shift'), t);
  const b = rig.update(dt, player.speed > 0.2);
  world.update(t, dt);

  occlusion.uCamPos.value.copy(camera.position);
  occlusion.uFocus.value.copy(player.position).addScaledVector(player.dir, 0.9);
  occlusion.uOcclude.value = 1 - b;

  // bầu trời + nắng
  sky.position.copy(camera.position);
  sky.material.uniforms.uUp.value.copy(rig.up);
  sky.material.uniforms.uT.value.copy(rig.sunT);
  sky.material.uniforms.uPlanet.value = b;
  const focus = _v.copy(player.position).multiplyScalar(1 - b);
  const ext = THREE.MathUtils.lerp(15, 34, b);
  const sc = sun.shadow.camera;
  if (sc.right !== ext) {
    sc.left = sc.bottom = -ext;
    sc.right = sc.top = ext;
    sc.updateProjectionMatrix();
  }
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(rig.sunDir, 50);
  world.dust.material.uniforms.uTime.value = t;
  world.dust.material.uniforms.uPixel.value = renderer.getPixelRatio();

  // địa điểm gần nhất
  let near = null;
  let nearD = Infinity;
  if (b < 0.2) {
    for (const p of world.places) {
      const dd = Math.acos(Math.min(1, p.dir.dot(player.dir))) * world.R;
      const r = Math.max(4.5, p.flat.r * 0.9);
      if (dd < r && dd < nearD) [near, nearD] = [p, dd];
    }
  }
  if (near !== nearPlace) {
    nearPlace = near;
    ui.setPlaceTitle(started ? near : null);
  }
  if (nearPlace && started && !ui.gallery.open) {
    const s = project(nearPlace.focus.clone().addScaledVector(nearPlace.dir, 1.2));
    ui.setPrompt(s.behind ? null : s);
  } else ui.setPrompt(null);

  // pin toàn cảnh
  if (started) {
    const camDir = camera.position.clone().normalize();
    ui.updatePins(
      world.places.map((p) => {
        const s = project(p.focus.clone().addScaledVector(p.dir, 2.5));
        return { id: p.id, x: s.x, y: s.y, visible: !s.behind && p.dir.dot(camDir) > 0.25 };
      }),
      Math.max(0, (b - 0.6) / 0.4),
    );
  }

  if (marker?.visible) {
    marker.userData.t += dt;
    const k = marker.userData.t;
    marker.scale.setScalar(1 + k * 0.8);
    marker.material.opacity = Math.max(0, 1 - k * 1.4);
    if (k > 0.8 || !player.target) marker.visible = k < 0.8 && !!player.target;
  }

  renderer.render(scene, camera);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// debug nhanh trong console
window.__planet = {
  get world() { return world; },
  get player() { return player; },
  get rig() { return rig; },
  travelTo,
  setMap,
  start,
  ui,
  goto(id) {
    const p = world.places.find((q) => q.id === id);
    placeAtView(p);
    rig.mode = 'explore';
    rig.blend = 0;
  },
};
