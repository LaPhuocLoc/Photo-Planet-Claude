// (Nhân vật không dùng hiệu ứng nhìn xuyên — luôn hiện rõ.)
// Nhân vật: nhiếp ảnh gia áo sơ mi trắng, quần jean ống rộng, kính tròn, máy ảnh đeo cổ.
// Phong cách cel-shading 2 tông + texture vẽ tay (mặt, nếp áo, vải jean) + viền mực.
import * as THREE from 'three';
import { GeoBuilder, addOutlineNormals, outlineMaterial, toonGradient2 } from '../world/toon.js';
import { paintFace, paintShirt, paintSleeve, paintDenim } from './paint.js';

const LINE = 0.013;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const mats = new Map();
function mat(key, opts) {
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({ gradientMap: toonGradient2(), ...opts }));
  return mats.get(key);
}

function mesh(geo, material, { outline = LINE, pos, rot, scale } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  if (outline) {
    addOutlineNormals(geo);
    const o = new THREE.Mesh(geo, outlineMaterial(outline, undefined, { occlude: false }));
    m.add(o);
  }
  if (pos) m.position.fromArray(pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  return m;
}

function lathe(points, { segments = 28, scaleZ = 1 } = {}) {
  const g = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
    Math.PI,
  );
  if (scaleZ !== 1) g.scale(1, 1, scaleZ);
  g.computeVertexNormals();
  return g;
}

// Đầu hơi thuôn về cằm, UV giữ nguyên để dán texture mặt.
function headGeometry(r) {
  const g = new THREE.SphereGeometry(r, 44, 30);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i) * 1.1;
    let z = p.getZ(i);
    if (y < 0) {
      const t = Math.min(1, -y / (r * 1.1));
      const k = 1 - 0.24 * Math.pow(t, 1.4);
      x *= k;
      z *= k;
    }
    // mặt hơi phẳng phía trước, gò má đầy
    if (z > 0) z *= 0.94;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// ── Tóc: mũ tóc + ~30 lọn nhọn ─────────────────────────────
function sph(thDeg, elDeg, rad, yScale = 1.1) {
  const th = (thDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return V(Math.sin(th) * Math.cos(el) * rad, Math.sin(el) * rad * yScale, Math.cos(th) * Math.cos(el) * rad);
}

function hairGeometry(r) {
  const b = new GeoBuilder();
  const C = [0x252b32, 0x2d343c, 0x222830, 0x37414b];
  b.add(new THREE.SphereGeometry(r * 1.06, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), C[0], { scale: [1, 1.1, 1] });
  b.add(new THREE.SphereGeometry(r * 1.09, 28, 14, Math.PI * 0.95, Math.PI * 1.1, Math.PI * 0.2, Math.PI * 0.56), C[0], {
    scale: [1, 1.1, 1.04],
  });
  const up = V(0, 1, 0);
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const clump = (a, bb, width, color) => {
    const dir = bb.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    const g = new THREE.ConeGeometry(width, len * 1.25, 5, 1);
    g.translate(0, (len * 1.25) / 2, 0);
    g.scale(1, 1, 0.5);
    q.setFromUnitVectors(up, dir);
    m.compose(a.clone().addScaledVector(dir, -len * 0.25), q, V(1, 1, 1));
    b.add(g, color, { matrix: m });
  };
  // mái trước: rủ xuống trán, so le
  const bangs = [-58, -42, -27, -12, 3, 18, 33, 48, 62];
  bangs.forEach((th, i) => {
    const lift = i % 2 ? 0 : 5;
    clump(sph(th, 48, r * 1.02), sph(th + (i % 3) * 4 - 4, 14 + lift, r * 1.1), r * 0.26, C[i % 3]);
  });
  // hai bên: phủ nửa tai
  for (const s of [-1, 1]) {
    [70, 84, 98].forEach((th, i) => clump(sph(s * th, 30, r * 1.03), sph(s * (th + 6), -20 + i * 4, r * 1.14), r * 0.24, C[(i + 1) % 3]));
  }
  // sau gáy: lởm chởm chĩa ra ngoài
  for (let i = 0; i < 9; i++) {
    const th = 115 + i * 16;
    clump(sph(th, 18, r * 1.06), sph(th + 5, -34 - (i % 2) * 8, r * 1.24), r * 0.3, C[i % 3]);
    clump(sph(th + 8, 42, r * 1.06), sph(th + 12, 8, r * 1.26), r * 0.28, C[(i + 1) % 3]);
  }
  // đỉnh đầu: vài lọn dựng lên, rối nhẹ
  for (let i = 0; i < 8; i++) {
    const th = -60 + i * 40;
    clump(sph(th, 64, r * 1.04), sph(th + 20, 40, r * 1.24), r * 0.24, C[(i + 2) % 4]);
  }
  clump(sph(170, 78, r * 1.02), sph(185, 70, r * 1.38), r * 0.16, C[3]);
  clump(sph(150, 80, r * 1.02), sph(125, 76, r * 1.32), r * 0.14, C[1]);
  return b.build();
}

export function createCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = mat('skin', { color: 0xf3d8c3 });
  const shirt = mat('shirt', { map: paintShirt() });
  const sleeve = mat('sleeve', { map: paintSleeve() });
  const denim = mat('denim', { map: paintDenim(), side: THREE.DoubleSide });
  const shoe = mat('shoe', { color: 0x27282c });
  const hairM = mat('hair', { vertexColors: true });
  const dark = mat('dark', { color: 0x2b2d31 });
  const strapM = mat('strap', { color: 0x7a5a3c });
  const faceOpen = paintFace();
  const faceBlink = paintFace({ blink: true });
  const face = mat('face', { map: faceOpen });

  // ── chân: quần ống rộng + giày ──────────────────────────
  const hips = mesh(lathe([[0.19, 0.5], [0.205, 0.56], [0.195, 0.66]], { scaleZ: 0.74 }), denim, { outline: 0 });
  body.add(hips);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.088 * s, 0.57, 0);
    const leg = lathe([[0.118, -0.53], [0.112, -0.42], [0.1, -0.22], [0.098, -0.05], [0.094, 0.03]], { segments: 20 });
    pivot.add(mesh(leg, denim));
    pivot.add(mesh(new THREE.SphereGeometry(0.07, 16, 10), shoe, { pos: [0, -0.54, 0.045], scale: [0.95, 0.55, 1.65] }));
    body.add(pivot);
    return pivot;
  });

  // ── thân áo ────────────────────────────────────────────
  const torso = new THREE.Group();
  body.add(torso);
  torso.add(
    mesh(
      lathe(
        [
          [0.2, 0.58],
          [0.214, 0.63],
          [0.2, 0.74],
          [0.197, 0.84],
          [0.214, 0.94],
          [0.2, 1.0],
          [0.15, 1.05],
          [0.085, 1.085],
          [0.062, 1.095],
        ],
        { scaleZ: 0.72 },
      ),
      shirt,
    ),
  );
  // cổ áo polo
  for (const s of [-1, 1]) {
    torso.add(mesh(new THREE.BoxGeometry(0.085, 0.055, 0.012), shirt, { pos: [0.042 * s, 1.07, 0.085], rot: [-0.5, 0, 0.55 * s] }));
  }
  torso.add(mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.1, 14), skin, { pos: [0, 1.12, 0] }));

  // ── tay: vai → khuỷu → bàn tay ────────────────────────
  const arms = [-1, 1].map((s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.212 * s, 0.985, 0);
    const up = new THREE.CylinderGeometry(0.052, 0.047, 0.28, 14);
    up.translate(0, -0.13, 0);
    shoulder.add(mesh(up, sleeve));
    shoulder.add(mesh(new THREE.SphereGeometry(0.056, 14, 10), sleeve, { pos: [0, 0, 0], outline: 0 }));
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.26, 0);
    const fore = new THREE.CylinderGeometry(0.047, 0.043, 0.24, 14);
    fore.translate(0, -0.11, 0);
    elbow.add(mesh(fore, sleeve));
    elbow.add(mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.035, 14), shirt, { pos: [0, -0.215, 0] }));
    elbow.add(mesh(new THREE.SphereGeometry(0.04, 12, 10), skin, { pos: [0, -0.27, 0.005], scale: [0.72, 1.18, 0.62] }));
    shoulder.add(elbow);
    torso.add(shoulder);
    return { shoulder, elbow, s };
  });

  // ── đầu ────────────────────────────────────────────────
  const R = 0.2;
  const head = new THREE.Group();
  head.position.set(0, 1.335, 0);
  head.add(mesh(headGeometry(R), face));
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.042, 12, 10), skin, { pos: [0.197 * s, -0.01, -0.005], scale: [0.45, 1, 0.75] }));
  }
  head.add(mesh(hairGeometry(R), hairM, { outline: 0.012 }));
  torso.add(head);

  // ── máy ảnh + dây đeo cổ ──────────────────────────────
  const cam = new THREE.Group();
  cam.add(mesh(new THREE.BoxGeometry(0.135, 0.085, 0.06), dark));
  cam.add(mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.07, 16), mat('lens', { color: 0x1d1f22 }), { pos: [0, -0.004, 0.058], rot: [Math.PI / 2, 0, 0] }));
  cam.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), mat('glass', { color: 0x5d8ea0 }), { pos: [0, -0.004, 0.095], rot: [Math.PI / 2, 0, 0], outline: 0 }));
  cam.add(mesh(new THREE.BoxGeometry(0.035, 0.018, 0.03), mat('silver', { color: 0xc9ccd0 }), { pos: [0.04, 0.05, 0], outline: 0.008 }));
  cam.position.set(0, 0.83, 0.19);
  torso.add(cam);
  const straps = [];
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([V(0.068 * s, 1.095, -0.02), V(0.1 * s, 1.03, 0.11), V(0.085 * s, 0.93, 0.165), V(0.06 * s, 0.855, 0.19)]);
    const strap = mesh(new THREE.TubeGeometry(curve, 16, 0.011, 6), strapM, { outline: 0.006 });
    torso.add(strap);
    straps.push(strap);
  }

  // bóng tròn dưới chân
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 20),
    new THREE.MeshBasicMaterial({ color: 0x1d3a3a, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);
  root.traverse((o) => {
    if (o.isMesh && (o.material.type === 'ShaderMaterial' || o === shadow)) o.castShadow = false;
  });

  // ── hoạt ảnh ─────────────────────────────────────────
  let phase = 0;
  let snap = 0;
  let snapTarget = 0;
  let blinkT = 2 + Math.random() * 3;
  const camRest = cam.position.clone();
  const camFace = V(0, 1.22, 0.33);

  function update(dt, speed, t) {
    const moving = Math.min(1, speed / 3.5);
    phase += dt * (3.6 + speed * 2.1);
    const sw = Math.sin(phase);
    snap += (snapTarget - snap) * Math.min(1, dt * 7);

    legs[0].rotation.x = sw * 0.55 * moving;
    legs[1].rotation.x = -sw * 0.55 * moving;
    for (const a of arms) {
      const swing = -a.s * sw * 0.45 * moving * (1 - snap);
      a.shoulder.rotation.x = swing - snap * 1.52;
      a.shoulder.rotation.z = a.s * (0.09 + 0.03 * Math.sin(t * 1.6)) * (1 - snap) - a.s * snap * 0.3;
      a.elbow.rotation.x = -(0.18 + Math.max(0, -swing) * 0.5) * (1 - snap) - snap * 1.5;
    }
    // nhún, lắc hông, xoay vai ngược chiều bước
    body.position.y = Math.abs(sw) * 0.045 * moving + Math.sin(t * 2.1) * 0.006 * (1 - moving);
    torso.rotation.y = sw * 0.07 * moving;
    torso.rotation.x = 0.05 * moving;
    torso.scale.y = 1 + Math.sin(t * 2.1) * 0.008 * (1 - moving);
    head.rotation.y = -sw * 0.05 * moving + Math.sin(t * 0.45) * 0.22 * (1 - moving) * (1 - snap);
    head.rotation.x = -0.05 * moving + snap * 0.08 + Math.sin(t * 0.7) * 0.03 * (1 - moving);
    cam.position.lerpVectors(camRest, camFace, snap);
    cam.rotation.x = -snap * 0.08;
    for (const st of straps) st.visible = snap < 0.5;

    // chớp mắt
    blinkT -= dt;
    if (blinkT < 0) {
      face.map = faceBlink;
      if (blinkT < -0.12) {
        face.map = faceOpen;
        blinkT = 2.2 + Math.random() * 3.5;
      }
    }
  }

  return {
    root,
    update,
    setSnap(v) {
      snapTarget = v ? 1 : 0;
    },
  };
}
