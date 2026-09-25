// Sự sống trên hành tinh: người dân, du khách, xe buýt, xe đạp, mèo, máy gặt, thuyền đánh cá,
// hoa bỉ ngạn, hoa dại, chuồn chuồn đỏ, tượng Jizo, đèn đá.
import * as THREE from 'three';
import { GeoBuilder, addOutlineNormals, outlineMaterial, toonGradient2, withOcclusion, inked, inkedInstanced, vcToon, windMaterial } from './toon.js';
import { SurfaceFrame, orientOnSurface } from './surface.js';
import { mulberry32, tangentFrame } from './terrain.js';

const tfCache = new WeakMap();
function tangentOf(dir) {
  // khung tiếp tuyến (cache theo vector; tính lại nếu anchor đổi)
  let c = tfCache.get(dir);
  if (!c || !c.key.equals(dir)) {
    const f = tangentFrame(dir, 0);
    c = { key: dir.clone(), side: f.side, fwd: f.fwd };
    tfCache.set(dir, c);
  }
  return c;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);

// ── vật liệu 2 tông (giống nhân vật chính) ─────────────────
const mats = new Map();
function m2(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!mats.has(key)) mats.set(key, withOcclusion(new THREE.MeshToonMaterial({ color, gradientMap: toonGradient2(), ...opts })));
  return mats.get(key);
}
function part(geo, material, { outline = 0.012, pos, rot, scale } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  if (outline) {
    addOutlineNormals(geo);
    m.add(new THREE.Mesh(geo, outlineMaterial(outline)));
  }
  if (pos) m.position.fromArray(pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  return m;
}

// mặt vẽ tay đơn giản, dùng chung (nhân với màu da của từng người)
let faceTex;
function simpleFace() {
  if (faceTex) return faceTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 256);
  const cx = 128;
  const cy = 140;
  g.fillStyle = 'rgba(235,140,125,0.35)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * 40, cy + 22, 13, 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#26292d';
  g.strokeStyle = '#26292d';
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * 22, cy, 5.5, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx + s * 13, cy - 16);
    g.quadraticCurveTo(cx + s * 22, cy - 20, cx + s * 31, cy - 16);
    g.stroke();
  }
  g.lineWidth = 3;
  g.strokeStyle = '#8c4c43';
  g.beginPath();
  g.moveTo(cx - 7, cy + 32);
  g.quadraticCurveTo(cx, cy + 35, cx + 7, cy + 31);
  g.stroke();
  faceTex = new THREE.CanvasTexture(c);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}

// ── Người ──────────────────────────────────────────────────
// hat: 'kasa' (nón lá) | 'cap' | 'towel' (khăn trùm) | 'bucket' | null
export function villager({
  shirt = 0x6f8fb0,
  pants = 0x3a3f4a,
  skin = 0xf1d3bb,
  hair = 0x2b2b2e,
  hat = null,
  hatColor = 0xe1c98f,
  scale = 1,
  bag = null,
  camera = false,
  grey = false,
} = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.scale.setScalar(scale);
  // gộp các bộ phận cứng thành ít mesh (màu theo đỉnh) để giảm draw call
  const VC = m2(0xffffff, { vertexColors: true });
  const merged = (build, outline = 0.012) => {
    const b = new GeoBuilder();
    build(b);
    return part(b.build({ outline: false }), VC, { outline });
  };
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(0.075 * s, 0.5, 0);
    p.add(
      merged((b) => {
        b.add(cyl(0.072, 0.082, 0.48, 10), pants, { pos: [0, -0.24, 0] });
        b.add(sph(0.06, 10, 8), 0x2e2e30, { pos: [0, -0.49, 0.035], scale: [0.95, 0.6, 1.5] });
      }),
    );
    body.add(p);
    return p;
  });
  const torso = new THREE.Group();
  torso.position.y = 0.5;
  body.add(torso);
  torso.add(
    merged((b) => {
      b.add(cyl(0.15, 0.165, 0.12, 12), pants, { pos: [0, 0.03, 0], scale: [1, 1, 0.78] });
      b.add(cyl(0.14, 0.165, 0.42, 14), shirt, { pos: [0, 0.27, 0], scale: [1, 1, 0.76] });
      b.add(cyl(0.04, 0.045, 0.08, 8), skin, { pos: [0, 0.5, 0] });
      if (bag === 'backpack') b.add(box(0.24, 0.3, 0.14), 0xd6793f, { pos: [0, 0.3, -0.17] });
      if (bag === 'basket') b.add(cyl(0.13, 0.1, 0.22, 12), 0xb99462, { pos: [0, 0.3, -0.19] });
    }),
  );
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(0.175 * s, 0.44, 0);
    const a = merged((b) => {
      b.add(cyl(0.045, 0.04, 0.4, 8), shirt, { pos: [0, -0.2, 0] });
      b.add(sph(0.038, 8, 6), skin, { pos: [0, -0.43, 0] });
    }, 0.01);
    a.castShadow = false;
    p.add(a);
    torso.add(p);
    return { p, s };
  });
  const head = new THREE.Group();
  head.position.y = 0.68;
  torso.add(head);
  head.add(part(sph(0.155, 22, 16), m2(skin, { map: simpleFace() })));
  const hc = grey ? 0xbfbcb6 : hair;
  head.add(
    merged((b) => {
      b.add(new THREE.SphereGeometry(0.163, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hc, { pos: [0, 0.01, 0] });
      b.add(new THREE.SphereGeometry(0.165, 16, 10, Math.PI, Math.PI, Math.PI * 0.25, Math.PI * 0.45), hc, { pos: [0, 0, -0.005] });
      if (hat === 'kasa') b.add(new THREE.ConeGeometry(0.34, 0.16, 18), hatColor, { pos: [0, 0.2, 0] });
      if (hat === 'cap') {
        b.add(new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), hatColor, { pos: [0, 0.02, 0] });
        b.add(box(0.2, 0.02, 0.14), hatColor, { pos: [0, 0.07, 0.17] });
      }
      if (hat === 'bucket') b.add(cyl(0.15, 0.22, 0.13, 16), hatColor, { pos: [0, 0.14, 0] });
      if (hat === 'towel') b.add(new THREE.SphereGeometry(0.172, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xf4f1ea, { pos: [0, 0.0, -0.01] });
    }),
  );
  let cam = null;
  if (camera) {
    cam = part(box(0.11, 0.07, 0.05), m2(0x2b2d31), { pos: [0, 0.62, 0.2] });
    torso.add(cam);
  }

  // ── tư thế / hoạt ảnh ──
  let phase = Math.random() * 10;
  function update(dt, t, mode = 'idle', speed = 1) {
    const L = legs;
    const A = arms;
    body.position.y = 0;
    torso.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    for (const l of L) l.rotation.set(0, 0, 0);
    for (const a of A) a.p.rotation.set(0, 0, a.s * 0.1);
    if (mode === 'walk') {
      phase += dt * (3.5 + speed * 2.4);
      const sw = Math.sin(phase);
      L[0].rotation.x = sw * 0.5;
      L[1].rotation.x = -sw * 0.5;
      for (const a of A) a.p.rotation.x = -a.s * sw * 0.4;
      body.position.y = Math.abs(sw) * 0.035;
    } else if (mode === 'bend') {
      // nông dân cúi gặt lúa
      const k = 0.75 + Math.sin(t * 0.9 + phase) * 0.15;
      torso.rotation.x = k;
      body.position.y = -0.03;
      L[0].rotation.x = -0.15;
      L[1].rotation.x = 0.2;
      for (const a of A) a.p.rotation.x = -0.6 - Math.sin(t * 2.2 + phase + a.s) * 0.35;
      head.rotation.x = -0.4;
    } else if (mode === 'sit') {
      body.position.y = -0.03;
      for (const l of L) l.rotation.x = -1.45;
      for (const a of A) a.p.rotation.x = -0.5;
      head.rotation.y = Math.sin(t * 0.3 + phase) * 0.3;
      head.rotation.x = 0.05 + Math.sin(t * 0.5) * 0.04;
    } else if (mode === 'photo') {
      for (const a of A) {
        a.p.rotation.x = -1.9;
        a.p.rotation.z = -a.s * 0.35;
      }
      if (cam) cam.position.set(0, 0.72, 0.26);
      head.rotation.x = 0.05;
    } else if (mode === 'pedal') {
      phase += dt * 6;
      body.position.y = 0.1;
      torso.rotation.x = 0.35;
      L[0].rotation.x = -1.0 + Math.sin(phase) * 0.45;
      L[1].rotation.x = -1.0 - Math.sin(phase) * 0.45;
      for (const a of A) a.p.rotation.x = -1.1;
    } else {
      // đứng ngắm cảnh
      torso.scale.y = 1 + Math.sin(t * 2 + phase) * 0.01;
      head.rotation.y = Math.sin(t * 0.35 + phase) * 0.35;
      head.rotation.x = -0.12;
      if (cam && mode === 'idle') cam.position.set(0, 0.26, 0.17);
    }
  }
  update(0, 0, 'idle');
  return { root, update };
}

// ── Mèo ────────────────────────────────────────────────────
function cat(color = 0xe39b52, { sleeping = false } = {}) {
  const root = new THREE.Group();
  const M = m2(color);
  const W = m2(0xf5f1ea);
  if (sleeping) {
    root.add(part(sph(0.11, 14, 10), M, { pos: [0, 0.07, 0], scale: [1.3, 0.7, 1] }));
    root.add(part(sph(0.07, 12, 10), M, { pos: [0.11, 0.07, 0.06] }));
    for (const s of [-1, 1]) root.add(part(new THREE.ConeGeometry(0.025, 0.05, 4), M, { pos: [0.12 + s * 0.035, 0.13, 0.06], outline: 0.006 }));
  } else {
    root.add(part(sph(0.09, 14, 10), M, { pos: [0, 0.12, 0], scale: [0.9, 1.25, 1] }));
    root.add(part(sph(0.05, 10, 8), W, { pos: [0, 0.1, 0.06], scale: [1, 1.2, 0.6], outline: 0 }));
    root.add(part(sph(0.07, 12, 10), M, { pos: [0, 0.27, 0.02] }));
    for (const s of [-1, 1]) root.add(part(new THREE.ConeGeometry(0.025, 0.055, 4), M, { pos: [s * 0.04, 0.34, 0.02], outline: 0.006 }));
  }
  const tail = new THREE.Group();
  tail.position.set(sleeping ? -0.12 : 0, 0.05, sleeping ? 0 : -0.08);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0.06, -0.08), V(0.05, 0.15, -0.12), V(0.08, 0.22, -0.08)]);
  tail.add(part(new THREE.TubeGeometry(curve, 10, 0.018, 5), M, { outline: 0.006 }));
  if (sleeping) tail.rotation.set(-1.4, 0, 0.3);
  root.add(tail);
  const ph = Math.random() * 10;
  return {
    root,
    update: (dt, t) => {
      tail.rotation.y = Math.sin(t * (sleeping ? 0.6 : 1.6) + ph) * 0.5;
      if (sleeping) root.scale.y = 1 + Math.sin(t * 1.5 + ph) * 0.04;
    },
  };
}

// ── Xe cộ / máy móc ────────────────────────────────────────
function busGeo() {
  const b = new GeoBuilder();
  b.add(box(0.92, 0.55, 2.3), 0x5aa9a4, { pos: [0, 0.42, 0] });
  b.add(box(0.94, 0.45, 2.32), 0xf2ead6, { pos: [0, 0.9, 0] });
  b.add(box(0.95, 0.24, 2.0), 0x3b4f58, { pos: [0, 0.92, -0.05] });
  b.add(box(0.8, 0.26, 0.04), 0x3b4f58, { pos: [0, 0.92, 1.16] });
  b.add(box(0.9, 0.08, 2.26), 0xe8e0cc, { pos: [0, 1.16, 0] });
  b.add(box(0.5, 0.1, 0.03), 0xf6d45a, { pos: [0, 1.1, 1.17] });
  b.add(box(0.94, 0.06, 2.32), 0xd9573d, { pos: [0, 0.66, 0] });
  for (const [x, z] of [[0.44, 0.75], [-0.44, 0.75], [0.44, -0.75], [-0.44, -0.75]]) {
    b.add(cyl(0.15, 0.15, 0.1, 12), 0x2d3336, { pos: [x, 0.15, z], rot: [0, 0, Math.PI / 2] });
  }
  b.add(box(0.12, 0.07, 0.02), 0xfff3cc, { pos: [0.3, 0.4, 1.16] });
  b.add(box(0.12, 0.07, 0.02), 0xfff3cc, { pos: [-0.3, 0.4, 1.16] });
  return b.build();
}
function bikeGeo() {
  const b = new GeoBuilder();
  for (const z of [0.32, -0.32]) b.add(new THREE.TorusGeometry(0.2, 0.025, 6, 18), 0x2d3336, { pos: [0, 0.2, z], rot: [0, Math.PI / 2, 0] });
  b.add(box(0.03, 0.03, 0.62), 0xd65a45, { pos: [0, 0.34, 0], rot: [0.2, 0, 0] });
  b.add(box(0.03, 0.34, 0.03), 0xd65a45, { pos: [0, 0.4, -0.08] });
  b.add(box(0.03, 0.34, 0.03), 0xd65a45, { pos: [0, 0.42, 0.3] });
  b.add(box(0.3, 0.03, 0.03), 0x2d3336, { pos: [0, 0.6, 0.3] });
  b.add(box(0.1, 0.03, 0.16), 0x2d3336, { pos: [0, 0.58, -0.08] });
  b.add(box(0.22, 0.12, 0.16), 0xc9a36a, { pos: [0, 0.6, 0.42] });
  return b.build();
}
function combineGeo() {
  const b = new GeoBuilder();
  b.add(box(1.0, 0.55, 1.5), 0xd9483a, { pos: [0, 0.55, -0.1] });
  b.add(box(0.5, 0.5, 0.5), 0xf2efe6, { pos: [0.22, 1.05, 0.35] });
  b.add(box(0.44, 0.3, 0.02), 0xa8d8dc, { pos: [0.22, 1.1, 0.61] });
  b.add(box(0.56, 0.05, 0.56), 0xd9483a, { pos: [0.22, 1.32, 0.35] });
  b.add(box(1.1, 0.3, 0.5), 0x3a3f44, { pos: [0, 0.2, 0.9] });
  b.add(cyl(0.12, 0.12, 1.1, 10), 0xe8c85c, { pos: [0, 0.3, 1.1], rot: [0, 0, Math.PI / 2] });
  b.add(box(0.28, 0.3, 1.6), 0x2d3134, { pos: [0.42, 0.15, -0.1] });
  b.add(box(0.28, 0.3, 1.6), 0x2d3134, { pos: [-0.42, 0.15, -0.1] });
  b.add(cyl(0.06, 0.06, 0.9, 8), 0xd9483a, { pos: [-0.35, 1.1, -0.4], rot: [0.9, 0, 0] });
  return b.build();
}
function fishingBoatGeo(v = 0) {
  const b = new GeoBuilder();
  b.add(box(0.7, 0.32, 1.6), 0xf5f4ee, { pos: [0, 0.1, 0] });
  b.add(new THREE.ConeGeometry(0.36, 0.6, 4), 0xf5f4ee, { pos: [0, 0.1, 1.05], rot: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.45] });
  b.add(box(0.72, 0.08, 1.62), v ? 0xd65a45 : 0x3a8fc4, { pos: [0, -0.02, 0] });
  b.add(box(0.46, 0.36, 0.5), 0xf7f6f0, { pos: [0, 0.45, -0.3] });
  b.add(box(0.48, 0.1, 0.52), 0x3f5a66, { pos: [0, 0.66, -0.3] });
  b.add(cyl(0.02, 0.02, 0.9, 5), 0x8a8f8a, { pos: [0, 0.8, 0.25] });
  b.add(box(0.1, 0.08, 0.02), 0xf2c14e, { pos: [0, 1.2, 0.25] });
  return b.build();
}
function jizoGeo() {
  const b = new GeoBuilder();
  b.add(box(0.3, 0.1, 0.26), 0x8f948e, { pos: [0, 0.05, 0] });
  b.add(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), 0xa4a8a0, { pos: [0, 0.28, 0] });
  b.add(sph(0.085, 12, 10), 0xaeb2aa, { pos: [0, 0.47, 0] });
  b.add(new THREE.ConeGeometry(0.12, 0.14, 12), 0xd4432f, { pos: [0, 0.34, 0.02], rot: [Math.PI, 0, 0], scale: [1, 1, 0.7] });
  b.add(new THREE.SphereGeometry(0.092, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xd4432f, { pos: [0, 0.49, 0] });
  b.add(box(0.08, 0.04, 0.06), 0xf2e6c8, { pos: [0.12, 0.12, 0.08] });
  return b.build();
}
function lanternGeo() {
  const b = new GeoBuilder();
  const s = 0xa3a79f;
  b.add(box(0.36, 0.1, 0.36), s, { pos: [0, 0.05, 0] });
  b.add(cyl(0.07, 0.08, 0.5, 8), s, { pos: [0, 0.35, 0] });
  b.add(box(0.3, 0.06, 0.3), s, { pos: [0, 0.63, 0] });
  b.add(box(0.2, 0.2, 0.2), 0xf3e2b0, { pos: [0, 0.76, 0] });
  b.add(new THREE.ConeGeometry(0.3, 0.2, 4), s, { pos: [0, 0.96, 0], rot: [0, Math.PI / 4, 0] });
  b.add(sph(0.05, 8, 6), s, { pos: [0, 1.08, 0] });
  return b.build();
}
function flowerGeo(kind) {
  const b = new GeoBuilder();
  if (kind === 'higanbana') {
    b.add(cyl(0.008, 0.01, 0.4, 4), 0x5d9a4a, { pos: [0, 0.2, 0] });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.add(new THREE.ConeGeometry(0.012, 0.13, 3), i % 2 ? 0xd8322a : 0xe8453a, {
        pos: [Math.cos(a) * 0.04, 0.43, Math.sin(a) * 0.04],
        rot: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1],
      });
    }
  } else {
    const c = kind === 'white' ? 0xf7f5ee : 0xf2c94c;
    b.add(cyl(0.006, 0.008, 0.18, 3), 0x6aa856, { pos: [0, 0.09, 0] });
    for (const [x, z] of [[0, 0], [0.04, 0.02], [-0.03, 0.03]]) b.add(sph(0.025, 6, 4), c, { pos: [x, 0.19 - Math.abs(x), z] });
  }
  return b.build({ outline: false });
}

// ── Lắp ráp ────────────────────────────────────────────────
export function buildLife(world) {
  const rnd = mulberry32(99);
  const T = world.terrain;
  const R = world.R;
  const actors = [];
  const byId = Object.fromEntries(world.places.map((p) => [p.id, p]));
  const byLm = Object.fromEntries(world.places.map((p) => [p.landmark, p]));
  const frameOf = (p) => new SurfaceFrame(world, p.dir, p.facing ?? 0);

  const add = (obj, updater) => {
    world.group.add(obj);
    if (updater) actors.push(updater);
  };

  // người đứng/ngồi/cúi tại landmark: [landmark, x, z, rotY, mode, opts, y]
  const people = [
    ['rice', 2.4, -0.6, 0.4, 'bend', { shirt: 0x7a9bb8, pants: 0x4a4f5a, hat: 'kasa' }],
    ['rice', -2.8, 2.8, 2.0, 'bend', { shirt: 0xe6ddc8, pants: 0x5a6b5a, hat: 'towel', grey: true }],
    ['rice', 3.2, 2.2, -1.2, 'bend', { shirt: 0xc86b4a, pants: 0x3f4550, hat: 'kasa' }],
    ['rice', -4.0, -1.6, 2.4, 'idle', { shirt: 0x5c7a93, pants: 0x3a3f4a, hat: 'cap', hatColor: 0xf2efe6 }],
    ['ruins', 1.2, 1.4, Math.PI, 'photo', { shirt: 0xf2d16b, pants: 0x3b4252, hat: 'bucket', hatColor: 0xe9e2cf, camera: true, bag: 'backpack' }],
    ['ruins', 2.0, 1.7, Math.PI + 0.3, 'idle', { shirt: 0xe7a5a0, pants: 0xe8e2d3, hair: 0x4a3426 }],
    ['shelter', -0.45, 1.62, Math.PI, 'sit', { shirt: 0x9a7bb0, pants: 0x4d4a55, grey: true, scale: 0.94 }, 0.02],
    ['futatsugame', -0.9, 4.0, 0.3, 'photo', { shirt: 0x5aa0c9, pants: 0xe8e2d3, camera: true, hat: 'cap', hatColor: 0xd65a45 }, 0.12],
    ['futatsugame', -1.4, 5.3, 2.8, 'idle', { shirt: 0xf4f1ea, pants: 0x6b7f5a, hair: 0x3a2a20, scale: 0.9 }, 0.12],
    ['onogame', 0.4, 3.4, 0.1, 'idle', { shirt: 0x6c9a6a, pants: 0x3a3f4a, bag: 'backpack', hat: 'bucket', hatColor: 0x8f7a5a }],
    ['taraibune', 5.0, -0.6, -0.8, 'idle', { shirt: 0x4b5c7a, pants: 0x3a3f4a, hat: 'kasa' }],
  ];
  for (const [lm, x, z, rotY, mode, opts, y = 0] of people) {
    const p = byLm[lm];
    if (!p) continue;
    const f = frameOf(p);
    const v = villager(opts);
    f.put(v.root, x, z, { rotY, y, water: true });
    if (mode !== 'sit' && y === 0) f.collide(x, z, 0.28);
    actors.push((dt, t) => v.update(dt, t, mode));
  }

  // mèo
  const cats = [
    ['shelter', 0.45, 1.66, 2.6, 0xf2efe8, true, 0.48],
    ['rice', -4.2, 3.1, 0.6, 0xe39b52, false, 0],
    ['futatsugame', -2.1, -1.4, 1.2, 0x2b2b2e, true, 0],
    ['taraibune', -1.6, -0.4, 0.4, 0xe39b52, false, 0],
  ];
  for (const [lm, x, z, rotY, color, sleeping, y] of cats) {
    const p = byLm[lm];
    if (!p) continue;
    const c = cat(color, { sleeping });
    frameOf(p).put(c.root, x, z, { rotY, y });
    actors.push(c.update);
  }

  // tượng Jizo + đèn đá
  const jizo = jizoGeo();
  const lantern = lanternGeo();
  const statics = [];
  if (byLm.onogame) {
    const f = frameOf(byLm.onogame);
    for (const s of [-1, 1]) statics.push([f, lantern, s * 1.3, -1.6, 0]);
    statics.push([f, jizo, -1.9, -0.4, 0.4], [f, jizo, -2.2, -0.2, 0.2]);
  }
  if (byLm.ruins) {
    const f = frameOf(byLm.ruins);
    statics.push([f, lantern, -2.4, 1.6, 0]);
  }
  for (const [f, geo, x, z, rotY] of statics) {
    f.put(inked(geo, vcToon(), { outline: 0.012 }), x, z, { rotY });
    f.collide(x, z, 0.25);
  }
  // Jizo rải dọc đường làng
  const road = world.roadDirs;
  const along = (i) => {
    const a = road[Math.max(0, i - 1)];
    const b = road[Math.min(road.length - 1, i + 1)];
    return b.clone().sub(a).normalize();
  };
  const roadSide = (i, off) => {
    const d = road[i];
    const side = V(0, 0, 0).crossVectors(d, along(i)).normalize();
    return d.clone().multiplyScalar(R).addScaledVector(side, off).normalize();
  };
  for (let k = 0; k < 6 && road.length; k++) {
    const i = Math.floor(((k + 0.5) / 6) * road.length);
    const d = roadSide(i, 0.95 * (k % 2 ? 1 : -1));
    if (T.height(d) < 0.2 || world.nearPlace(d, 0.5)) continue;
    for (let j = 0; j < 2; j++) {
      const o = inked(jizo, vcToon(), { outline: 0.012 });
      const dd = d.clone().multiplyScalar(R).addScaledVector(along(i), j * 0.32).normalize();
      o.position.copy(dd).multiplyScalar(world.heightAt(dd) + R - 0.02);
      orientOnSurface(o, dd, dd.clone().multiplyScalar(-1).add(road[i]).normalize());
      world.group.add(o);
      world.colliders.push({ dir: dd, r: 0.18 });
    }
  }

  // ── hoa bỉ ngạn dọc đường + bờ ruộng, hoa dại trong cỏ ──
  const sets = { higanbana: [], white: [], yellow: [] };
  const d = new THREE.Vector3();
  for (let i = 0; i < road.length; i++) {
    if (rnd() > 0.35) continue;
    const off = (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.5);
    const base = roadSide(i, off);
    const n = 2 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      d.copy(base).multiplyScalar(R).addScaledVector(along(i), (rnd() - 0.5) * 0.5).normalize();
      if (T.height(d) < 0.15 || T.ledgeWeight(d) > 0.2) continue;
      sets.higanbana.push({ d: d.clone(), s: 0.8 + rnd() * 0.5 });
    }
  }
  for (const p of world.places.filter((q) => q.landmark === 'rice')) {
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * p.flat.r;
      d.copy(p.dir).multiplyScalar(R).addScaledVector(p.frame.side, Math.cos(a) * r).addScaledVector(p.frame.fwd, Math.sin(a) * r).normalize();
      if (T.paddyAt(d)?.type === 'levee') sets.higanbana.push({ d: d.clone(), s: 0.7 + rnd() * 0.5 });
    }
  }
  for (let i = 0; i < 5000; i++) {
    world.randDir(d);
    const h = T.height(d);
    if (h < 0.2 || h > 2.4 || T.paddyAt(d) || T.ledgeWeight(d) > 0.2 || world.nearRoad(d, 0.7)) continue;
    const kind = rnd() < 0.6 ? 'white' : 'yellow';
    const c = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < c; k++) {
      const dd = d.clone().multiplyScalar(R).addScaledVector(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), 0.5).normalize();
      sets[kind].push({ d: dd, s: 0.8 + rnd() * 0.6 });
    }
    if (sets.white.length + sets.yellow.length > 1600) break;
  }
  const flowerMat = windMaterial(0xffffff, world.uniforms, { strength: 0.14, vertexColors: true });
  for (const k of Object.keys(sets)) world.instances(flowerGeo(k), sets[k], { outline: 0, mat: flowerMat, cast: false });

  // ── xe buýt chạy vòng + người đạp xe + người đi bộ trên đường ──
  if (road.length > 10) {
    const cum = [0];
    for (let i = 1; i < road.length; i++) cum.push(cum[i - 1] + Math.acos(Math.min(1, road[i - 1].dot(road[i]))) * R);
    const total = cum[cum.length - 1];
    const hint = { i: 0 };
    const at = (s, off, out, tan) => {
      s = ((s % total) + total) % total;
      let i = hint.i;
      if (cum[i] > s) i = 0;
      while (i < cum.length - 2 && cum[i + 1] < s) i++;
      hint.i = i;
      const t = (s - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]);
      out.copy(road[i]).lerp(road[i + 1], t).normalize();
      tan.copy(road[i + 1]).sub(road[i]).normalize();
      const side = V(0, 0, 0).crossVectors(out, tan).normalize();
      out.multiplyScalar(R).addScaledVector(side, off).normalize();
      return out;
    };
    const mover = (obj, { speed, off, start, lift = 0.05, pingpong = 0, onPose, yieldToPlayer = false }) => {
      let s = start;
      let dirSign = speed >= 0 ? 1 : -1;
      const origin = start;
      const pos = new THREE.Vector3();
      const tan = new THREE.Vector3();
      world.group.add(obj);
      actors.push((dt, t) => {
        let v = Math.abs(speed);
        if (yieldToPlayer && world.playerPos.lengthSq() > 0 && obj.position.distanceTo(world.playerPos) < 2.2) v = 0;
        s += dirSign * v * dt;
        if (pingpong && Math.abs(s - origin) > pingpong) {
          dirSign *= -1;
          s = origin + Math.sign(s - origin) * pingpong;
        }
        at(s, off * dirSign, pos, tan);
        obj.position.copy(pos).multiplyScalar(R + Math.max(world.heightAt(pos), 0.12) + lift);
        orientOnSurface(obj, pos, tan.multiplyScalar(dirSign));
        onPose?.(dt, t, v);
      });
    };
    const bus = inked(busGeo(), vcToon(), { outline: 0.022 });
    mover(bus, { speed: 3.2, off: 0, start: total * 0.3, lift: 0.02, yieldToPlayer: true });

    const bikeGroup = new THREE.Group();
    bikeGroup.add(inked(bikeGeo(), vcToon(), { outline: 0.01 }));
    const rider = villager({ shirt: 0xf2efe6, pants: 0x3b4a6b, hat: 'cap', hatColor: 0x3a6f9a, scale: 0.92 });
    rider.root.position.set(0, 0.08, -0.05);
    bikeGroup.add(rider.root);
    mover(bikeGroup, { speed: -1.9, off: 0.3, start: total * 0.62, onPose: (dt, t) => rider.update(dt, t, 'pedal') });

    const walkers = [
      { shirt: 0xe8e2d3, pants: 0x4d5566, hat: 'kasa', bag: 'basket', grey: true },
      { shirt: 0xd9786a, pants: 0x3a3f4a, hair: 0x3a2a20 },
      { shirt: 0x7fa8c9, pants: 0x2f3645, scale: 0.72, hat: 'cap', hatColor: 0xf2c14e },
      { shirt: 0x9fbf7a, pants: 0x4a4f5a, bag: 'backpack' },
      { shirt: 0xf4f1ea, pants: 0x2f3645, hat: 'bucket', hatColor: 0xe9e2cf, camera: true },
    ];
    walkers.forEach((o, k) => {
      const v = villager(o);
      const sp = 0.8 + rnd() * 0.5;
      mover(v.root, {
        speed: sp * (k % 2 ? 1 : -1),
        off: 0.42 * (k % 2 ? 1 : -1),
        start: total * ((k + 0.15) / walkers.length),
        lift: 0,
        pingpong: 10 + rnd() * 12,
        onPose: (dt, t, vv) => v.update(dt, t, vv > 0.01 ? 'walk' : 'idle', sp),
      });
    });
  }

  // ── máy gặt chạy qua lại trong ruộng ──
  if (byLm.rice) {
    const p = byLm.rice;
    const f = frameOf(p);
    const comb = inked(combineGeo(), vcToon(), { outline: 0.02 });
    comb.scale.setScalar(0.85);
    world.group.add(comb);
    const dd = new THREE.Vector3();
    const nx = new THREE.Vector3();
    actors.push((dt, t) => {
      const u = Math.sin(t * 0.12);
      const x = 3.4 + u * 2.2;
      const z = 4.6;
      f.dirAt(x, z, dd);
      f.dirAt(x + Math.cos(t * 0.12) * 0.1, z, nx);
      comb.position.copy(dd).multiplyScalar(R + T.height(dd) + Math.sin(t * 9) * 0.01);
      orientOnSurface(comb, dd, nx.sub(dd));
    });
  }

  // ── thuyền đánh cá + phao ──
  const boatSpots = [
    ['shelter', 2.5, 6.5],
    ['shelter', -3.2, 8.0],
    ['futatsugame', 5.5, 5.0],
    ['taraibune', 4.8, 7.2],
    ['onogame', -5.5, 6.5],
  ];
  const boats = [fishingBoatGeo(0), fishingBoatGeo(1)];
  const buoy = new THREE.SphereGeometry(0.1, 10, 8);
  boatSpots.forEach(([lm, x, z], k) => {
    const p = byLm[lm];
    if (!p) return;
    const f = frameOf(p);
    if (T.height(f.dirAt(x, z)) > -0.3) return;
    const boat = inked(boats[k % 2], vcToon(), { outline: 0.02 });
    f.put(boat, x, z, { water: true, rotY: rnd() * 6 });
    const base = boat.position.clone();
    const up = base.clone().normalize();
    const q0 = boat.quaternion.clone();
    const ph = rnd() * 10;
    actors.push((dt, t) => {
      boat.position.copy(base).addScaledVector(up, Math.sin(t * 1.1 + ph) * 0.05);
      boat.quaternion.copy(q0);
      boat.rotateZ(Math.sin(t * 0.9 + ph) * 0.06);
      boat.rotateX(Math.sin(t * 0.7 + ph) * 0.04);
    });
    for (let j = 0; j < 3; j++) {
      const b = inked(buoy, m2(j % 2 ? 0xf2efe6 : 0xe8622f), { outline: 0.01 });
      f.put(b, x + (rnd() - 0.5) * 3, z + (rnd() - 0.5) * 3, { water: true });
      const bb = b.position.clone();
      const bu = bb.clone().normalize();
      const bp = rnd() * 10;
      actors.push((dt, t) => b.position.copy(bb).addScaledVector(bu, Math.sin(t * 1.4 + bp) * 0.04));
    }
  });

  // ── chuồn chuồn đỏ (akatombo) ──
  const flyBody = new GeoBuilder()
    .add(box(0.018, 0.018, 0.2), 0xd8372b, { pos: [0, 0, 0] })
    .add(sph(0.022, 6, 4), 0xb82a22, { pos: [0, 0, 0.1] })
    .build({ outline: false });
  const wingGeo = new THREE.PlaneGeometry(0.2, 0.04);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const flySpots = [];
  if (byLm.rice) for (let i = 0; i < 10; i++) flySpots.push([byLm.rice, (rnd() - 0.5) * 11, (rnd() - 0.5) * 11]);
  for (const lm of ['onogame', 'ruins', 'shelter']) if (byLm[lm]) for (let i = 0; i < 3; i++) flySpots.push([byLm[lm], (rnd() - 0.5) * 6, (rnd() - 0.5) * 6 - 2]);
  for (const [p, cx, cz] of flySpots) {
    const f = frameOf(p);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(flyBody, m2(0xffffff, { vertexColors: true })));
    const wings = [0.06, 0.02].map((z) => {
      const w = new THREE.Mesh(wingGeo, wingMat);
      w.rotation.x = -Math.PI / 2;
      w.position.z = z;
      g.add(w);
      return w;
    });
    world.group.add(g);
    const ph = rnd() * 100;
    const sp = 0.3 + rnd() * 0.3;
    const dd = new THREE.Vector3();
    const nx = new THREE.Vector3();
    actors.push((dt, t) => {
      const a = t * sp + ph;
      // bay lượn rồi dừng lại lơ lửng
      const x = cx + Math.sin(a) * 1.6 + Math.sin(a * 2.3) * 0.4;
      const z = cz + Math.cos(a * 0.8) * 1.4;
      f.dirAt(x, z, dd);
      f.dirAt(x + Math.cos(a) * 0.1, z - Math.sin(a * 0.8) * 0.1, nx);
      g.position.copy(dd).multiplyScalar(R + T.height(dd) + 0.9 + Math.sin(a * 3.1) * 0.25);
      orientOnSurface(g, dd, nx.sub(dd));
      for (const w of wings) w.rotation.z = Math.sin(t * 38 + ph) * 0.25;
    });
  }

  // ── bướm: rải quanh các địa điểm + 1 đàn nhỏ luôn bay quanh người chơi ──
  const wingTex = (color, edge) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.strokeStyle = edge;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(4, 64);
    g.bezierCurveTo(10, 4, 110, -6, 122, 34);
    g.bezierCurveTo(126, 58, 90, 66, 72, 66);
    g.bezierCurveTo(104, 76, 116, 116, 84, 124);
    g.bezierCurveTo(50, 128, 20, 100, 4, 64);
    g.fill();
    g.stroke();
    g.fillStyle = edge;
    g.beginPath();
    g.arc(92, 34, 9, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const BFLY = [
    ['#f7f5ec', '#3a3f44'],
    ['#f6d65a', '#5a4a2a'],
    ['#9ecfe8', '#2f5a78'],
    ['#f09a4a', '#4a2a1a'],
  ].map(([a, b]) => new THREE.MeshBasicMaterial({ map: wingTex(a, b), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  const wingG = new THREE.PlaneGeometry(0.16, 0.16);
  wingG.translate(0.08, 0, 0);
  wingG.rotateX(-Math.PI / 2);
  const bodyG = new THREE.CylinderGeometry(0.008, 0.01, 0.1, 5);
  bodyG.rotateX(Math.PI / 2);
  const bodyM = new THREE.MeshBasicMaterial({ color: 0x2d2a26 });
  const flyers = [];
  const spawnButterfly = (anchor, radius) => {
    const g = new THREE.Group();
    const mat = BFLY[Math.floor(rnd() * BFLY.length)];
    const wl = new THREE.Mesh(wingG, mat);
    const wr = new THREE.Mesh(wingG, mat);
    wr.scale.x = -1;
    g.add(wl, wr, new THREE.Mesh(bodyG, bodyM));
    g.scale.setScalar(0.9 + rnd() * 0.6);
    world.group.add(g);
    const b = { g, wl, wr, anchor: anchor.clone(), radius, ph: rnd() * 100, sp: 0.5 + rnd() * 0.5, pos: new THREE.Vector3(), prev: new THREE.Vector3() };
    flyers.push(b);
    return b;
  };
  for (const p of world.places) for (let i = 0; i < 4; i++) spawnButterfly(p.dir, p.flat.r + 2);
  const escort = [];
  for (let i = 0; i < 7; i++) escort.push(spawnButterfly(V(0, 0, 1), 4.5));
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  actors.push((dt, t) => {
    const pp = world.playerPos;
    if (pp.lengthSq() > 0) {
      const pd = tmpA.copy(pp).normalize();
      for (const e of escort) if (e.anchor.dot(pd) < Math.cos(6 / R)) e.anchor.copy(pd).multiplyScalar(R).addScaledVector(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), 4).normalize();
    }
    for (const b of flyers) {
      const a = t * b.sp + b.ph;
      const { side, fwd } = tangentOf(b.anchor);
      const x = Math.sin(a * 0.7) * b.radius * 0.6 + Math.sin(a * 1.9) * 0.6;
      const z = Math.cos(a * 0.53) * b.radius * 0.6 + Math.cos(a * 2.3) * 0.5;
      tmpB.copy(b.anchor).multiplyScalar(R).addScaledVector(side, x).addScaledVector(fwd, z).normalize();
      const hgt = Math.max(world.heightAt(tmpB), 0.1) + 0.55 + Math.abs(Math.sin(a * 1.3)) * 0.9 + Math.sin(t * 7 + b.ph) * 0.05;
      b.prev.copy(b.g.position);
      b.g.position.copy(tmpB).multiplyScalar(R + hgt);
      const dirv = tmpA.copy(b.g.position).sub(b.prev);
      if (dirv.lengthSq() > 1e-8) orientOnSurface(b.g, tmpB, dirv);
      const flap = Math.sin(t * 16 + b.ph) * 0.9 + 0.3;
      b.wl.rotation.z = flap;
      b.wr.rotation.z = -flap;
    }
  });

  world.animate((t, dt) => {
    for (const a of actors) a(dt, t);
  });
  return { actors };
}
