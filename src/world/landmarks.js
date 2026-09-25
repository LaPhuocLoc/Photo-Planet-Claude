// Landmark 3D cho từng địa điểm. Toạ độ cục bộ: +Z = hướng "facing" (thường là biển).
import * as THREE from 'three';
import { GeoBuilder, inked, toon, vcToon } from './toon.js';
import { Models } from './models.js';
import { SurfaceFrame } from './surface.js';
import { dirFromLatLon } from './terrain.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

const mesh = (b, outline = 0.03) => inked(b.build({ outline: !!outline }), vcToon(), { outline });

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Đảo đá: quả cầu méo, đỉnh xanh cỏ, sườn vách đá nâu.
function rockIsland(rx, ry, rz, seed = 1, { grassAbove = 0.35, cliff = 0x6d5646, cliff2 = 0x85705c } = {}) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  g.deleteAttribute('uv');
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  const gA = new THREE.Color(0x5f9d56);
  const gB = new THREE.Color(0x77b060);
  const cA = new THREE.Color(cliff);
  const cB = new THREE.Color(cliff2);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5.1 + seed) * Math.cos(v.z * 4.3 - seed) * 0.5 + Math.sin(v.y * 7 + v.x * 3 + seed * 2) * 0.5;
    const k = 1 + 0.09 * n;
    v.set(v.x * rx * k, v.y * ry * k, v.z * rz * k);
    if (v.y < 0) v.y *= 0.4;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nor = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const ny = nor.getY(i);
    const y = p.getY(i) / ry;
    const stripe = Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3 + y * 9) > 0.2;
    if (ny > grassAbove && y > -0.1) c.copy(stripe ? gA : gB);
    else c.copy(stripe ? cA : cB);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return inked(g, vcToon(), { outline: 0.05 });
}

// ── Kei truck (xe tải nhỏ Nhật) ─────────────────────────────
function keiTruck() {
  const b = new GeoBuilder();
  const body = 0xd9dcd8;
  b.add(box(0.72, 0.5, 0.55), body, { pos: [0, 0.45, 0.62] });
  b.add(box(0.66, 0.26, 0.04), 0x39505a, { pos: [0, 0.58, 0.9] });
  b.add(box(0.74, 0.14, 1.1), body, { pos: [0, 0.3, -0.2] });
  b.add(box(0.04, 0.16, 1.1), body, { pos: [0.35, 0.44, -0.2] });
  b.add(box(0.04, 0.16, 1.1), body, { pos: [-0.35, 0.44, -0.2] });
  b.add(box(0.74, 0.16, 0.04), body, { pos: [0, 0.44, -0.74] });
  for (const [x, z] of [[0.36, 0.6], [-0.36, 0.6], [0.36, -0.45], [-0.36, -0.45]]) {
    b.add(cyl(0.14, 0.14, 0.1, 12), 0x2d3336, { pos: [x, 0.14, z], rot: [0, 0, Math.PI / 2] });
  }
  b.add(box(0.1, 0.06, 0.02), 0xf2efe0, { pos: [0.24, 0.35, 0.9] });
  b.add(box(0.1, 0.06, 0.02), 0xf2efe0, { pos: [-0.24, 0.35, 0.9] });
  return mesh(b, 0.022);
}

function tractor() {
  const b = new GeoBuilder();
  const o = 0xe8622f;
  b.add(box(0.6, 0.4, 0.9), o, { pos: [0, 0.55, 0.35] });
  b.add(box(0.5, 0.22, 0.2), 0x2c3134, { pos: [0, 0.5, 0.82] });
  b.add(box(0.62, 0.05, 0.62), o, { pos: [0, 1.32, -0.25] });
  for (const [x, z] of [[0.28, 0.03], [-0.28, 0.03], [0.28, -0.53], [-0.28, -0.53]]) {
    b.add(box(0.04, 0.6, 0.04), 0x2c3134, { pos: [x, 1.0, z] });
  }
  b.add(box(0.5, 0.5, 0.5), 0xa8d8dc, { pos: [0, 0.98, -0.25] });
  b.add(cyl(0.34, 0.34, 0.18, 14), 0x2d3336, { pos: [0.4, 0.34, -0.35], rot: [0, 0, Math.PI / 2] });
  b.add(cyl(0.34, 0.34, 0.18, 14), 0x2d3336, { pos: [-0.4, 0.34, -0.35], rot: [0, 0, Math.PI / 2] });
  b.add(cyl(0.18, 0.18, 0.12, 12), 0x2d3336, { pos: [0.34, 0.18, 0.62], rot: [0, 0, Math.PI / 2] });
  b.add(cyl(0.18, 0.18, 0.12, 12), 0x2d3336, { pos: [-0.34, 0.18, 0.62], rot: [0, 0, Math.PI / 2] });
  b.add(cyl(0.2, 0.2, 0.2, 12), 0xe9e2cf, { pos: [0.41, 0.34, -0.35], rot: [0, 0, Math.PI / 2] });
  b.add(cyl(0.2, 0.2, 0.2, 12), 0xe9e2cf, { pos: [-0.41, 0.34, -0.35], rot: [0, 0, Math.PI / 2] });
  // xe kéo phía sau
  b.add(box(0.9, 0.08, 1.5), 0x6a5a4e, { pos: [0, 0.4, -1.55] });
  b.add(box(0.9, 0.35, 0.04), 0x5a4c42, { pos: [0, 0.6, -2.28] });
  b.add(cyl(0.14, 0.14, 0.08, 10), 0x2d3336, { pos: [0.4, 0.16, -1.6], rot: [0, 0, Math.PI / 2] });
  b.add(cyl(0.14, 0.14, 0.08, 10), 0x2d3336, { pos: [-0.4, 0.16, -1.6], rot: [0, 0, Math.PI / 2] });
  return mesh(b, 0.022);
}

function hasagi(len = 3) {
  // giàn phơi lúa
  const b = new GeoBuilder();
  const n = Math.round(len / 0.9) + 1;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i * len) / (n - 1);
    b.add(cyl(0.035, 0.04, 1.3, 5), 0x7a6450, { pos: [x, 0.65, 0] });
  }
  b.add(box(len + 0.2, 0.03, 0.03), 0x7a6450, { pos: [0, 1.15, 0] });
  b.add(box(len, 0.62, 0.22), 0xd6bb6c, { pos: [0, 0.78, 0] });
  for (let i = 0; i < len * 4; i++) {
    b.add(box(0.2, 0.2, 0.26), i % 2 ? 0xcaa956 : 0xe0c77d, { pos: [-len / 2 + 0.12 + i * 0.25, 0.42, 0] });
  }
  return mesh(b, 0.02);
}

function barn() {
  const b = new GeoBuilder();
  b.add(box(2.6, 1.1, 1.5), 0x7c5d48, { pos: [0, 0.55, 0] });
  const s = new THREE.Shape();
  s.moveTo(-0.9, 0);
  s.lineTo(0.9, 0);
  s.lineTo(0, 0.5);
  s.closePath();
  const roof = new THREE.ExtrudeGeometry(s, { depth: 2.9, bevelEnabled: false });
  roof.translate(0, 0, -1.45);
  roof.rotateY(Math.PI / 2);
  b.add(roof, 0xa95b43, { pos: [0, 1.1, 0] });
  for (let i = 0; i < 6; i++) b.add(box(0.03, 1.05, 0.02), 0x6a4c3a, { pos: [-1.1 + i * 0.44, 0.55, 0.76] });
  b.add(box(1.0, 0.8, 0.9), 0xeeebe2, { pos: [1.8, 0.4, 0.1] });
  b.add(box(1.1, 0.08, 1.0), 0x5c7f82, { pos: [1.8, 0.84, 0.1] });
  return mesh(b, 0.028);
}

function scarecrow() {
  const b = new GeoBuilder();
  b.add(cyl(0.03, 0.03, 1.3, 5), 0x7a6450, { pos: [0, 0.65, 0] });
  b.add(box(0.9, 0.04, 0.04), 0x7a6450, { pos: [0, 1.0, 0] });
  b.add(box(0.5, 0.45, 0.2), 0x5b7fa6, { pos: [0, 0.9, 0] });
  b.add(ico(0.16, 1), 0xf0e6d0, { pos: [0, 1.3, 0] });
  b.add(new THREE.ConeGeometry(0.32, 0.14, 12), 0xdcc288, { pos: [0, 1.44, 0] });
  return mesh(b, 0.02);
}

function vending() {
  const b = new GeoBuilder();
  b.add(box(0.55, 1.05, 0.45), 0xd8483c, { pos: [0, 0.52, 0] });
  b.add(box(0.44, 0.45, 0.02), 0xf6f2e4, { pos: [0, 0.72, 0.23] });
  for (let i = 0; i < 4; i++) b.add(box(0.07, 0.12, 0.02), [0x4a8bc4, 0xf2c14e, 0x6bbf7a, 0xe8784e][i], { pos: [-0.15 + i * 0.1, 0.8, 0.24] });
  b.add(box(0.3, 0.1, 0.02), 0x2c3134, { pos: [0, 0.25, 0.23] });
  return mesh(b, 0.02);
}

// ── Người chèo thuyền thúng ─────────────────────────────────
function tubBoat(withRower = true) {
  const g = new THREE.Group();
  const b = new GeoBuilder();
  b.add(cyl(0.55, 0.46, 0.32, 16, true), 0x9a6c45, { pos: [0, 0.1, 0] });
  b.add(cyl(0.46, 0.46, 0.02, 16), 0x7e5638, { pos: [0, -0.05, 0] });
  b.add(new THREE.TorusGeometry(0.55, 0.035, 5, 18), 0x5d402c, { pos: [0, 0.24, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(new THREE.TorusGeometry(0.5, 0.03, 5, 18), 0x5d402c, { pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0] });
  const tubMesh = inked(b.build(), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }), { outline: 0.025 });
  g.add(tubMesh);
  if (withRower) {
    const p = new GeoBuilder();
    p.add(cyl(0.12, 0.2, 0.62, 8), 0x33456a, { pos: [0.15, 0.36, 0.05] });
    p.add(ico(0.12, 1), 0xf1d9c1, { pos: [0.15, 0.78, 0.05] });
    p.add(new THREE.ConeGeometry(0.3, 0.14, 14), 0xe3cc8e, { pos: [0.15, 0.93, 0.05] });
    p.add(cyl(0.02, 0.02, 1.4, 5), 0x8a6a4a, { pos: [0.34, 0.45, 0.2], rot: [0.35, 0, -0.2] });
    p.add(ico(0.1, 1), 0xf5f1e8, { pos: [-0.2, 0.2, -0.12] });
    p.add(box(0.26, 0.24, 0.2), 0xf0e8de, { pos: [-0.2, 0.05, -0.12] });
    g.add(inked(p.build(), vcToon(), { outline: 0.02 }));
  }
  return g;
}

function boathouse(v = 0) {
  const b = new GeoBuilder();
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    b.add(cyl(0.05, 0.05, 1.2, 5), 0x6a5040, { pos: [x, -0.3, z] });
  }
  b.add(box(1.5, 0.08, 1.5), 0x7d6049, { pos: [0, 0.3, 0] });
  b.add(box(1.35, 0.8, 1.3), v ? 0x8f6d52 : 0x7b5d47, { pos: [0, 0.72, 0] });
  b.add(box(0.8, 0.5, 0.03), 0x3a3a36, { pos: [0, 0.6, 0.66] });
  const s = new THREE.Shape();
  s.moveTo(-0.85, 0);
  s.lineTo(0.85, 0);
  s.lineTo(0, 0.55);
  s.closePath();
  const roof = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false });
  roof.translate(0, 0, -0.8);
  b.add(roof, v ? 0x6f7673 : 0x9aa19a, { pos: [0, 1.12, 0] });
  return mesh(b, 0.025);
}

// Cầu vòm đỏ kiểu Yajima–Kyōjima: bắc theo trục X, bậc thang răng cưa, dầm vòm bên dưới,
// lan can 3 thanh. y(x) đã trừ độ cong hành tinh để 2 đầu chạm đúng mặt đất.
export function bridgeY(x, span, rise, base, R) {
  const t = x / span + 0.5;
  return base + Math.sin(Math.PI * t) * rise - (x * x) / (2 * R);
}
function redBridge(span, rise, base, R) {
  const b = new GeoBuilder();
  const RED = 0xd9482c;
  const RED_D = 0xb53a24;
  const W = 0.82;
  const n = 22;
  const y = (x) => bridgeY(x, span, rise, base, R);
  for (let i = 0; i < n; i++) {
    const x0 = -span / 2 + (i / n) * span;
    const x1 = -span / 2 + ((i + 1) / n) * span;
    const xm = (x0 + x1) / 2;
    const ym = y(xm);
    // bậc thang (mặt phẳng) + má bậc
    b.add(box(x1 - x0 + 0.01, 0.07, W), RED, { pos: [xm, ym, 0] });
    b.add(box(0.03, 0.16, W), RED_D, { pos: [x0, ym - 0.07, 0] });
    // dầm vòm hai bên (nghiêng theo độ dốc)
    const ya = y(x0) - 0.16;
    const yb = y(x1) - 0.16;
    const pitch = Math.atan2(yb - ya, x1 - x0);
    for (const z of [W / 2 - 0.04, -W / 2 + 0.04]) {
      b.add(box(Math.hypot(x1 - x0, yb - ya) + 0.02, 0.2, 0.08), RED_D, { pos: [xm, (ya + yb) / 2, z], rot: [0, 0, pitch] });
    }
    // lan can
    const ra = y(x0);
    const rb = y(x1);
    const rp = Math.atan2(rb - ra, x1 - x0);
    const len = Math.hypot(x1 - x0, rb - ra) + 0.02;
    for (const z of [W / 2, -W / 2]) {
      for (const hh of [0.2, 0.4, 0.6]) b.add(box(len, 0.045, 0.045), RED, { pos: [xm, (ra + rb) / 2 + hh, z], rot: [0, 0, rp] });
      if (i % 3 === 0) b.add(box(0.06, 0.62, 0.06), RED, { pos: [x0, ra + 0.31, z] });
    }
  }
  for (const z of [W / 2, -W / 2]) b.add(box(0.06, 0.62, 0.06), RED, { pos: [span / 2, y(span / 2) + 0.31, z] });
  // trụ bê tông ở 2 đầu
  for (const s of [-1, 1]) {
    b.add(box(0.9, 1.3, 1.05), 0x8f928d, { pos: [s * (span / 2 - 0.2), y(s * span / 2) - 0.78, 0] });
    b.add(box(0.96, 0.08, 1.1), 0x9fa29c, { pos: [s * (span / 2 - 0.2), y(s * span / 2) - 0.12, 0] });
  }
  return mesh(b, 0.018);
}

function torii() {
  const b = new GeoBuilder();
  const wood = 0x8b7c6a;
  b.add(cyl(0.1, 0.12, 2.3, 10), wood, { pos: [-0.85, 1.15, 0], rot: [0, 0, -0.03] });
  b.add(cyl(0.1, 0.12, 2.3, 10), wood, { pos: [0.85, 1.15, 0], rot: [0, 0, 0.03] });
  b.add(cyl(0.12, 0.12, 2.6, 10), 0x7d6f5e, { pos: [0, 2.32, 0], rot: [0, 0, Math.PI / 2 + 0.03] });
  b.add(box(2.05, 0.1, 0.12), wood, { pos: [0, 1.85, 0] });
  b.add(box(0.14, 0.42, 0.06), 0x6e6152, { pos: [0, 2.08, 0.02] });
  // dây shimenawa võng xuống
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, 1.78, 0.05),
    new THREE.Vector3(-0.4, 1.45, 0.08),
    new THREE.Vector3(0, 1.38, 0.08),
    new THREE.Vector3(0.4, 1.45, 0.08),
    new THREE.Vector3(0.85, 1.78, 0.05),
  ]);
  b.add(new THREE.TubeGeometry(curve, 24, 0.045, 6), 0xcdb98a);
  for (const x of [-0.42, 0, 0.42]) {
    const y = x === 0 ? 1.38 : 1.45;
    b.add(new THREE.ConeGeometry(0.06, 0.34, 6), 0xd9c690, { pos: [x, y - 0.2, 0.08], rot: [Math.PI, 0, 0] });
  }
  return mesh(b, 0.022);
}

function shelter() {
  // Mở phía -Z (hướng vào đường), lưng quay ra biển (+Z)
  const b = new GeoBuilder();
  const w = 0xf1eee6;
  const W = 2.5;
  const H = 1.35;
  b.add(box(W, 0.5, 0.12), w, { pos: [0, 0.25, 0.6] });
  b.add(box(W, 0.3, 0.12), w, { pos: [0, H - 0.15, 0.6] });
  b.add(box(0.95, 0.55, 0.12), w, { pos: [-0.78, 0.775, 0.6] });
  b.add(box(0.65, 0.55, 0.12), w, { pos: [0.93, 0.775, 0.6] });
  b.add(box(0.12, H, 1.3), w, { pos: [-W / 2 + 0.06, H / 2, 0] });
  b.add(box(0.12, H, 1.3), w, { pos: [W / 2 - 0.06, H / 2, 0] });
  b.add(box(0.45, H, 0.12), w, { pos: [-W / 2 + 0.22, H / 2, -0.6] });
  b.add(box(0.45, H, 0.12), w, { pos: [W / 2 - 0.22, H / 2, -0.6] });
  b.add(box(W + 0.2, 0.1, 1.5), 0x6e4a3a, { pos: [0, H + 0.05, 0] });
  b.add(box(2.1, 0.06, 0.32), 0xbfb6a4, { pos: [0, 0.42, 0.36] });
  b.add(box(0.6, 0.4, 0.02), 0xd8d2c0, { pos: [-0.75, 0.9, 0.53] });
  b.add(box(2.4, 0.03, 1.2), 0xa9aaa2, { pos: [0, 0.02, 0] });
  return mesh(b, 0.025);
}

function railing(len) {
  const b = new GeoBuilder();
  const n = Math.max(2, Math.round(len / 0.9) + 1);
  for (let i = 0; i < n; i++) b.add(cyl(0.03, 0.03, 0.75, 5), 0x9ba39f, { pos: [-len / 2 + (i * len) / (n - 1), 0.37, 0] });
  for (const y of [0.3, 0.55, 0.74]) b.add(cyl(0.022, 0.022, len, 5), 0xa8aea9, { pos: [0, y, 0], rot: [0, 0, Math.PI / 2] });
  return mesh(b, 0.014);
}

function busSign() {
  const b = new GeoBuilder();
  b.add(cyl(0.035, 0.035, 1.7, 6), 0x9aa09a, { pos: [0, 0.85, 0] });
  b.add(cyl(0.26, 0.26, 0.04, 16), 0xf5f2e8, { pos: [0, 1.75, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(cyl(0.2, 0.2, 0.045, 16), 0x3a8a5c, { pos: [0, 1.75, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(cyl(0.2, 0.2, 0.08, 10), 0x6b6f6a, { pos: [0, 0.04, 0] });
  return mesh(b, 0.018);
}

// ── Các landmark ───────────────────────────────────────────
const BUILDERS = {
  rice(f, world) {
    f.put(keiTruck(), 0.1, 1.4, { rotY: 0.15 });
    f.collide(0.1, 1.4, 0.7);
    f.put(tractor(), -4.4, -0.2, { rotY: 0.9 });
    f.collide(-4.4, -0.2, 0.8);
    f.collide(-3.4, -1.3, 0.7);
    f.put(hasagi(3), 3.6, -2.4, { rotY: 0.2 });
    f.put(hasagi(2.4), 3.8, -4.0, { rotY: 0.25 });
    f.collide(3.6, -2.4, 1.0);
    f.collide(3.8, -4.0, 0.9);
    f.put(barn(), -5.6, 4.2, { rotY: 2.6 });
    f.collide(-5.6, 4.2, 1.6);
    f.put(scarecrow(), 2.8, 3.6, { rotY: -0.6 });
    f.collide(2.8, 3.6, 0.3);
  },

  ruins(f) {
    const r = rand(7);
    for (let i = 0; i < 4; i++) {
      const b = new GeoBuilder();
      const w = 8.5 - i * 0.7;
      const hgt = (i + 1) * 1.05;
      const z = -2.4 - i * 1.3;
      b.add(box(w, hgt, 1.35), 0xb7b09d, { pos: [0, hgt / 2, z] });
      // ô vòm tối phía trước
      const n = Math.floor(w / 0.85);
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + 0.45 + k * 0.85;
        b.add(box(0.55, 0.62, 0.06), 0x2e3a34, { pos: [x, hgt - 0.5, z + 0.68] });
        b.add(box(0.12, 0.72, 0.08), 0xa39c8a, { pos: [x + 0.4, hgt - 0.45, z + 0.69] });
      }
      // dây leo phủ đỉnh + rủ xuống
      b.add(box(w + 0.06, 0.16, 1.42), 0x4f9a4b, { pos: [0, hgt + 0.02, z] });
      for (let k = 0; k < w * 2.2; k++) {
        const x = -w / 2 + r() * w;
        const len = 0.2 + r() * 0.8;
        b.add(box(0.22 + r() * 0.3, len, 0.08), r() > 0.5 ? 0x5aa652 : 0x3f8a48, { pos: [x, hgt - len / 2, z + 0.7] });
      }
      for (let k = 0; k < 5; k++) b.add(ico(0.3 + r() * 0.25, 1), 0x5aa652, { pos: [-w / 2 + r() * w, hgt + 0.15, z - 0.2 + r() * 0.3] });
      f.put(mesh(b, 0.028), 0, 0, { y: -0.05 });
      for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2) f.collide(x, z, 0.85);
    }
    // cầu thang bê tông chạy dọc bên hông các tầng
    const st = new GeoBuilder();
    for (let k = 0; k < 13; k++) {
      const z = -1.7 - k * 0.37;
      const yy = k * 0.33;
      st.add(box(0.9, yy + 0.33, 0.37), k % 2 ? 0xbdb6a3 : 0xb3ac99, { pos: [4.75, (yy + 0.33) / 2, z] });
    }
    for (let k = 0; k < 13; k += 3) st.add(box(0.05, 0.6, 0.05), 0x8a8f8a, { pos: [5.2, k * 0.33 + 0.63, -1.7 - k * 0.37] });
    st.add(box(0.04, 0.04, 4.9), 0x8a8f8a, { pos: [5.2, 2.6, -3.9], rot: [0.73, 0, 0] });
    f.put(mesh(st, 0.02), 0, 0, { y: -0.05 });
    // cột trơ trọi trên tầng cao nhất
    const top = new GeoBuilder();
    for (let k = 0; k < 6; k++) {
      top.add(box(0.14, 1.0, 0.14), 0xc2bba8, { pos: [-2.4 + k * 0.95, 4.7, -6.3] });
      top.add(box(0.8, 0.1, 0.14), 0xc2bba8, { pos: [-2.0 + k * 0.95, 4.9, -6.3] });
    }
    f.put(mesh(top, 0.02), 0, 0, { y: -0.05 });

    // bể lắng tròn (thickener)
    const t = new GeoBuilder();
    const ring = new THREE.LatheGeometry(
      [new THREE.Vector2(1.55, 0), new THREE.Vector2(2.05, 0), new THREE.Vector2(2.12, 0.4), new THREE.Vector2(1.5, 0.36)],
      28,
    );
    t.add(ring, 0xc9c1ab, { pos: [0, 1.3, 0] });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      t.add(cyl(0.12, 0.14, 1.32, 8), 0xbdb59f, { pos: [Math.cos(a) * 1.8, 0.66, Math.sin(a) * 1.8] });
      if (k % 3 === 0) t.add(cyl(0.16, 0.16, 0.9, 8), 0x4f9a4b, { pos: [Math.cos(a) * 1.8, 0.5, Math.sin(a) * 1.8] });
    }
    for (let k = 0; k < 7; k++) {
      const a = r() * Math.PI * 2;
      t.add(ico(0.32, 1), 0x5aa652, { pos: [Math.cos(a) * 1.85, 1.62, Math.sin(a) * 1.85], scale: [1.3, 0.6, 1] });
    }
    t.add(cyl(0.9, 1.2, 0.6, 16), 0x7c8a70, { pos: [0, 0.3, 0] });
    f.put(mesh(t, 0.025), 5.8, 1.4);
    f.collide(5.8, 1.4, 2.3);
  },

  shelter(f) {
    f.put(shelter(), 0, 1.3, { rotY: 0 });
    f.collide(0, 1.3, 1.3);
    f.collide(-0.9, 1.4, 0.8);
    f.collide(0.9, 1.4, 0.8);
    f.put(railing(3.6), -3.4, 2.1);
    f.put(railing(3.6), 3.4, 2.1);
    for (let x = -5; x <= 5; x += 1) f.collide(x, 2.5, 0.5);
    const walk = new GeoBuilder();
    walk.add(box(10, 0.14, 2.6), 0xc9c6bb, { pos: [0, -0.04, 0] });
    walk.add(box(10, 0.5, 0.3), 0xb3b0a5, { pos: [0, -0.2, 1.4] });
    f.put(mesh(walk, 0.02), 0, 1.1, { water: true });
    f.put(busSign(), -2.1, -0.4);
    f.put(vending(), 2.2, -0.2, { rotY: Math.PI });
    f.collide(2.2, -0.2, 0.4);
  },

  taraibune(f, world) {
    const r = rand(3);
    for (const [x, z, v] of [[-5.8, 1.0, 0], [5.6, 0.9, 1], [7.4, 0.4, 0]]) {
      f.put(boathouse(v), x, z, { water: true, rotY: Math.PI });
      f.collide(x, z, 0.9);
    }
    const tubs = [
      [0.2, 6.4, true],
      [2.6, 7.6, true],
      [-2.2, 8.2, true],
      [-1.0, 5.6, false],
    ];
    for (const [x, z, rower] of tubs) {
      const tub = tubBoat(rower);
      f.put(tub, x, z, { water: true, rotY: r() * 6 });
      const base = tub.position.clone();
      const up = base.clone().normalize();
      const ph = r() * 10;
      world.animate((t) => {
        tub.position.copy(base).addScaledVector(up, Math.sin(t * 1.3 + ph) * 0.05 - 0.02);
        tub.rotateOnAxis(new THREE.Vector3(0, 1, 0), 0.0015);
      });
    }
    // cầu đỏ bắc ngang giữa 2 mỏm đá, mặt nhìn thẳng ra biển (đi lên được)
    const B = TARAI_BRIDGE;
    const bridge = redBridge(B.span, B.rise, B.base, f.R);
    f.put(bridge, 0, B.z, { water: true });
    world.walkMeshes.push(bridge);
    world.decks.push({
      center: f.dirAt(0, B.z),
      axis: f.frame.side.clone(),
      across: f.frame.fwd.clone(),
      half: B.span / 2 + 0.25,
      width: 0.34,
      height: (x) => bridgeY(Math.max(-B.span / 2, Math.min(B.span / 2, x)), B.span, B.rise, B.base, 1e9) + 0.04,
    });
    // đá bazan đen rải quanh chân mỏm
    for (let i = 0; i < 12; i++) {
      const rk = inked(Models.rock(), toon(0xffffff, { vertexColors: true, color: 0x6a625a }), { outline: 0.025 });
      rk.scale.set(0.6 + r() * 0.9, 0.5 + r() * 0.6, 0.6 + r() * 0.8);
      const sx = r() < 0.5 ? -1 : 1;
      f.put(rk, sx * (3.4 + r() * 1.8), 2.4 + r() * 3.4, { water: true, y: -0.15, rotY: r() * 6 });
    }
    const islet = rockIsland(1.8, 1.3, 1.6, 4, { grassAbove: 0.2 });
    f.put(islet, -7.4, 7.0, { water: true, y: -0.35 });
    f.collide(-7.4, 7.0, 1.8);
    const pine = inked(Models.pine(), vcToon(), { outline: 0.03 });
    f.put(pine, -7.2, 7.1, { water: true, y: 0.6 });
    const pine2 = inked(Models.pine(), vcToon(), { outline: 0.03 });
    pine2.scale.setScalar(0.8);
    f.put(pine2, -8.0, 6.5, { water: true, y: 0.3 });
    // thông mọc trên 2 mỏm đá
    for (const [x, z, sc] of [[-3.8, 2.3, 0.85], [3.7, 2.1, 0.95]]) {
      const p = inked(Models.matsu(), vcToon(), { outline: 0.03 });
      p.scale.setScalar(sc);
      f.put(p, x, z);
      f.collide(x, z, 0.3);
    }
  },

  futatsugame(f) {
    const big = rockIsland(3.2, 3.6, 2.8, 1);
    f.put(big, -1.6, 8.2, { water: true, y: -0.6, rotY: 0.4 });
    f.collide(-1.6, 8.2, 3.0);
    const small = rockIsland(2.3, 2.6, 2.1, 2);
    f.put(small, 2.8, 10.2, { water: true, y: -0.6, rotY: -0.3 });
    f.collide(2.8, 10.2, 2.2);
    // dải cát nối (tombolo)
    const sand = new GeoBuilder();
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      sand.add(ico(1, 2), i % 2 ? 0xbdb5a2 : 0xc9c1ad, {
        pos: [Math.sin(t * 2.6) * 0.6 - t * 1.2, 0, t * 4.6],
        scale: [0.75 + Math.sin(t * Math.PI) * 0.35, 0.09, 0.9],
      });
    }
    f.put(mesh(sand, 0.015), -0.2, 1.6, { water: true, y: 0.02 });
    // đá lởm chởm ngoài khơi
    const rr = rand(11);
    for (let i = 0; i < 9; i++) {
      const rk = inked(Models.rock(), vcToon(), { outline: 0.025 });
      rk.scale.set(0.6 + rr() * 1.2, 0.5 + rr() * 0.8, 0.6 + rr() * 1.0);
      f.put(rk, 3 + rr() * 6, 4 + rr() * 5, { water: true, y: -0.12, rotY: rr() * 6 });
    }
    // chòi mái đỏ trên đồi
    const hut = new GeoBuilder();
    hut.add(box(1.3, 0.8, 1.1), 0xece5d4, { pos: [0, 0.4, 0] });
    hut.add(new THREE.ConeGeometry(1.15, 0.55, 4), 0xc4493c, { pos: [0, 1.07, 0], rot: [0, Math.PI / 4, 0] });
    hut.add(box(0.8, 0.6, 0.9), 0xe3dac6, { pos: [0.95, 0.3, 0.1] });
    hut.add(new THREE.ConeGeometry(0.7, 0.4, 4), 0xa98968, { pos: [0.95, 0.8, 0.1], rot: [0, Math.PI / 4, 0] });
    hut.add(box(0.3, 0.45, 0.03), 0x3b4a50, { pos: [-0.2, 0.3, 0.56] });
    f.put(mesh(hut, 0.025), -3.8, -2.2, { rotY: 0.5 });
    f.collide(-3.8, -2.2, 1.1);
    f.collide(-2.9, -2.0, 0.7);
    const bench = new GeoBuilder();
    bench.add(box(1.2, 0.06, 0.34), 0x8a6a4a, { pos: [0, 0.42, 0] });
    bench.add(box(0.06, 0.42, 0.3), 0x6b6f6a, { pos: [-0.5, 0.21, 0] });
    bench.add(box(0.06, 0.42, 0.3), 0x6b6f6a, { pos: [0.5, 0.21, 0] });
    f.put(mesh(bench, 0.018), 1.6, 0.2, { rotY: Math.PI });
  },

  onogame(f) {
    // khối đá hình rùa (thực ra giống kim tự tháp khi nhìn từ torii)
    const g = new THREE.ConeGeometry(5.6, 11, 11, 10);
    g.deleteAttribute('uv');
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 1 + 0.12 * Math.sin(v.y * 2.3 + v.x * 1.7) * Math.cos(v.z * 1.9);
      p.setXYZ(i, v.x * k, v.y, v.z * k * 0.85);
    }
    g.computeVertexNormals();
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const cliffSide = x > 0.3 + Math.sin(y * 2) * 0.6;
      const stripe = Math.sin(y * 5 + x * 1.5) > 0;
      c.set(cliffSide ? (stripe ? 0x6a5a4c : 0x7f6d5b) : stripe ? 0x4f9150 : 0x62a258);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const rock = inked(g, vcToon(), { outline: 0.05 });
    f.put(rock, 0.8, 8.6, { water: true, y: 4.2, rotY: -0.3 });
    f.collide(0.8, 8.6, 5.2);
    f.put(torii(), 0, 1.4, { rotY: Math.PI });
    f.collide(-0.85, 1.4, 0.25);
    f.collide(0.85, 1.4, 0.25);
    // lối đá lát
    const path = new GeoBuilder();
    const rr = rand(5);
    for (let i = 0; i < 16; i++) {
      const z = -3.2 + i * 0.55;
      path.add(box(0.45 + rr() * 0.3, 0.05, 0.4 + rr() * 0.15), rr() > 0.5 ? 0x93a0a1 : 0x7f8d90, {
        pos: [Math.sin(i * 0.5) * 0.35 + (rr() - 0.5) * 0.15, 0.02, z],
        rot: [0, rr() - 0.5, 0],
      });
    }
    f.put(mesh(path, 0.012), 0, 0);
  },
};

// Cầu Taraibune: nhịp, độ vồng, độ cao 2 đầu, vị trí z (cục bộ)
export const TARAI_BRIDGE = { span: 5.6, rise: 1.25, base: 0.78, z: 4.0 };

// Mỏm đá (địa hình) mà landmark cần: [x, z, bán kính, độ cao]
export const LEDGES = {
  taraibune: [
    ...[1.6, 2.4, 3.2, 4.0, 4.6].map((z) => [-3.3, z, 1.05, TARAI_BRIDGE.base]),
    ...[1.6, 2.4, 3.2, 4.0, 4.6].map((z) => [3.3, z, 1.05, TARAI_BRIDGE.base]),
  ],
};

// Góc đứng xem (at) + điểm nhìn (focus) + bán kính vùng click, theo toạ độ cục bộ.
export const VIEWS = {
  default: { at: [0, -3.5], focus: [0, 2.5], pick: 3 },
  rice: { at: [-1.0, -3.4], focus: [0.3, 1.6], pick: 2.6 },
  ruins: { at: [1.8, 4.6], focus: [0, -3.2], pick: 4.5 },
  shelter: { at: [0, -2.6], focus: [0, 1.3], pick: 2.2 },
  taraibune: { at: [0.3, -0.4], focus: [0, 4.0], pick: 2.4 },
  futatsugame: { at: [0.2, 0.2], focus: [-0.4, 7.6], pick: 3.8 },
  onogame: { at: [0, -3.0], focus: [0.4, 6.0], pick: 4.5 },
};

export function buildLandmark(world, place) {
  const dir = dirFromLatLon(place.lat, place.lon);
  const f = new SurfaceFrame(world, dir, place.facing ?? 0);
  BUILDERS[place.landmark]?.(f, world);
  return f;
}
