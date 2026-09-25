// Mô hình low-poly dựng từ khối cơ bản, màu theo đỉnh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuilder, addOutlineNormals } from './toon.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

// mái nhà kiểu Nhật (hình lăng trụ tam giác), nằm dọc trục X
function gableRoof(w, d, h) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

// Cành/thân: hình trụ thuôn từ A → B
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _Y = new THREE.Vector3(0, 1, 0);
function limb(b, a, c, r0, r1, color) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...c);
  const dir = B.clone().sub(A);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 6);
  g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(_Y, dir.normalize());
  _m.compose(A, _q, new THREE.Vector3(1, 1, 1));
  b.add(g, color, { matrix: _m });
}
// Tán lá lổn nhổn (méo ngẫu nhiên để viền mực trông như vẽ tay)
function blob(b, r, color, pos, seed = 0, scale = [1, 0.86, 1]) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + 0.12 * Math.sin((x * 7.1 + seed) / r) * Math.sin((z * 6.3 - seed) / r) + 0.07 * Math.sin((y * 9.7 + seed * 3) / r);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  b.add(g, color, { pos, scale });
}

export const Models = {
  // Cây lá rộng có chạc nhánh. v: 0 = trung bình, 1 = cao mảnh, 2 = thấp tròn
  tree(v = 0) {
    const b = new GeoBuilder();
    const G = [
      [0x5aa65a, 0x76bd64, 0x4a9555, 0x86c96d],
      [0x4f9c58, 0x68b25f, 0x3f8a50, 0x7cbf66],
      [0x6cb65e, 0x8acb6c, 0x5aa65a, 0x9ad374],
    ][v % 3];
    const BARK = 0x6e5445;
    if (v === 0) {
      limb(b, [0, 0, 0], [0.06, 1.1, 0], 0.14, 0.095, BARK);
      limb(b, [0.06, 1.1, 0], [-0.04, 1.95, 0.05], 0.095, 0.06, BARK);
      limb(b, [0.06, 1.05, 0], [0.7, 1.8, 0.2], 0.065, 0.03, BARK);
      limb(b, [0.02, 1.4, 0], [-0.62, 2.05, -0.25], 0.06, 0.03, BARK);
      limb(b, [-0.04, 1.9, 0.05], [0.28, 2.5, -0.1], 0.05, 0.025, BARK);
      blob(b, 0.56, G[0], [0.74, 1.98, 0.22], 1);
      blob(b, 0.6, G[1], [-0.66, 2.2, -0.25], 2);
      blob(b, 0.72, G[0], [0.08, 2.66, 0], 3);
      blob(b, 0.46, G[3], [0.28, 2.34, 0.42], 4);
      blob(b, 0.42, G[2], [-0.25, 2.02, 0.38], 5);
      blob(b, 0.38, G[1], [0.3, 3.05, -0.15], 6);
    } else if (v === 1) {
      limb(b, [0, 0, 0], [0.1, 1.6, 0], 0.12, 0.085, BARK);
      limb(b, [0.1, 1.6, 0], [-0.05, 3.1, 0.05], 0.085, 0.05, BARK);
      limb(b, [0.08, 1.5, 0], [0.45, 1.85, 0.1], 0.035, 0.015, BARK);
      limb(b, [0.02, 2.2, 0], [-0.5, 2.55, -0.1], 0.04, 0.018, BARK);
      limb(b, [0.0, 2.6, 0], [0.55, 2.95, 0.1], 0.04, 0.018, BARK);
      blob(b, 0.4, G[2], [-0.52, 2.6, -0.1], 7);
      blob(b, 0.8, G[0], [0, 3.45, 0], 8);
      blob(b, 0.55, G[1], [0.55, 3.05, 0.12], 9);
      blob(b, 0.5, G[3], [-0.42, 3.2, -0.12], 10);
      blob(b, 0.48, G[0], [0.15, 3.95, 0.05], 11);
      blob(b, 0.3, G[1], [0.48, 1.9, 0.1], 12);
    } else {
      limb(b, [0, 0, 0], [0.02, 0.7, 0], 0.1, 0.07, BARK);
      limb(b, [0.02, 0.65, 0], [0.4, 1.1, 0.1], 0.05, 0.025, BARK);
      limb(b, [0.02, 0.7, 0], [-0.35, 1.15, -0.1], 0.05, 0.025, BARK);
      blob(b, 0.5, G[0], [0.35, 1.25, 0.1], 13);
      blob(b, 0.52, G[1], [-0.32, 1.3, -0.1], 14);
      blob(b, 0.56, G[3], [0, 1.6, 0], 15);
      blob(b, 0.34, G[2], [0.05, 1.15, 0.35], 16);
    }
    return b.build();
  },
  // Thông Nhật (matsu): thân nghiêng uốn lượn, các tầng tán dẹt
  matsu() {
    const b = new GeoBuilder();
    const BARK = 0x5d4a3e;
    limb(b, [0, 0, 0], [0.32, 1.0, 0], 0.12, 0.09, BARK);
    limb(b, [0.32, 1.0, 0], [0.18, 1.85, 0.1], 0.09, 0.065, BARK);
    limb(b, [0.18, 1.85, 0.1], [-0.22, 2.45, 0], 0.065, 0.04, BARK);
    limb(b, [0.3, 1.2, 0], [1.0, 1.55, 0.1], 0.05, 0.025, BARK);
    limb(b, [0.2, 1.7, 0.1], [-0.65, 2.0, 0.25], 0.045, 0.022, BARK);
    limb(b, [0.18, 1.9, 0.1], [0.55, 2.2, -0.5], 0.04, 0.02, BARK);
    const pad = (r, c, pos, seed) => blob(b, r, c, pos, seed, [1.25, 0.42, 1.0]);
    pad(0.55, 0x3f7d52, [1.05, 1.68, 0.1], 21);
    pad(0.5, 0x4a8a5b, [-0.7, 2.1, 0.25], 22);
    pad(0.55, 0x3a7650, [-0.2, 2.62, 0], 23);
    pad(0.42, 0x4a8a5b, [0.6, 2.32, -0.5], 24);
    pad(0.32, 0x55966a, [-0.1, 2.9, 0.05], 25);
    return b.build();
  },
  // Tuyết tùng / thông nón (cao, dùng ở landmark)
  pine() {
    const b = new GeoBuilder();
    limb(b, [0, 0, 0], [0, 1.2, 0], 0.1, 0.06, 0x6e5242);
    b.add(new THREE.ConeGeometry(0.66, 0.95, 8), 0x3f8456, { pos: [0, 1.05, 0] });
    b.add(new THREE.ConeGeometry(0.54, 0.85, 8), 0x4a9460, { pos: [0, 1.5, 0], rot: [0, 0.4, 0] });
    b.add(new THREE.ConeGeometry(0.4, 0.75, 8), 0x57a166, { pos: [0, 1.95, 0], rot: [0, 0.8, 0] });
    b.add(new THREE.ConeGeometry(0.24, 0.55, 8), 0x5fa96c, { pos: [0, 2.35, 0] });
    return b.build();
  },
  // Tảng đá lớn màu be, phủ rêu xanh ở mặt trên (giống vách đá trong tranh).
  // kind 0: phiến dẹt, 1: khối đứng, 2: cụm nhiều tảng
  boulder(seed = 1, kind = 0) {
    const chunk = (sx, sy, sz, off, sd) => {
      let g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const k = 1 + 0.26 * Math.sin(v.x * 2.3 + sd) * Math.cos(v.z * 2.9 - sd * 1.3) + 0.16 * Math.sin(v.y * 3.7 + v.x * 2 + sd * 2);
        v.multiplyScalar(k);
        if (v.y > 0.45) v.y = 0.45 + (v.y - 0.45) * 0.35; // mặt trên phẳng như bậc đá
        if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15;
        p.setXYZ(i, v.x * sx + off[0], v.y * sy + off[1], v.z * sz + off[2]);
      }
      g.deleteAttribute('uv');
      g.deleteAttribute('normal');
      return g;
    };
    const parts =
      kind === 0
        ? [chunk(1.5, 0.55, 1.1, [0, 0, 0], seed)]
        : kind === 1
          ? [chunk(0.8, 1.15, 0.85, [0, 0.35, 0], seed)]
          : [chunk(0.9, 0.8, 0.8, [-0.4, 0.15, 0], seed), chunk(0.7, 0.55, 0.7, [0.65, 0, 0.3], seed + 3), chunk(0.5, 0.4, 0.5, [0.2, -0.05, -0.7], seed + 7)];
    let g = parts.length > 1 ? mergeGeometries(parts) : parts[0];
    g = g.index ? g.toNonIndexed() : g;
    g.computeVertexNormals();
    const n = g.attributes.normal;
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const BE = [new THREE.Color(0xdccda8), new THREE.Color(0xcfbe97), new THREE.Color(0xe6d9b8), new THREE.Color(0xc4b38c)];
    const MOSS = [new THREE.Color(0x6aa65a), new THREE.Color(0x5a9a52), new THREE.Color(0x7cb466)];
    for (let f = 0; f < pos.count; f += 3) {
      const ny = (n.getY(f) + n.getY(f + 1) + n.getY(f + 2)) / 3;
      const cx = pos.getX(f) * 1.3 + pos.getZ(f) * 1.7;
      const mossy = (ny > 0.55 && Math.sin(cx * 3.1 + seed) > -0.5) || (ny > 0.2 && Math.sin(cx * 5.3 + seed * 2) > 0.75);
      c.copy(mossy ? MOSS[(f / 3) % 3] : BE[(f / 3 + seed) % 4]);
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    addOutlineNormals(g);
    g.computeBoundingSphere();
    return g;
  },
  bush() {
    const b = new GeoBuilder();
    b.add(ico(0.36, 1), 0x6bb35e, { pos: [0, 0.22, 0] });
    b.add(ico(0.26, 1), 0x82c268, { pos: [0.26, 0.2, 0.08] });
    b.add(ico(0.24, 1), 0x5aa257, { pos: [-0.22, 0.16, -0.1] });
    return b.build();
  },
  rock() {
    const g = new THREE.DodecahedronGeometry(0.5, 0);
    const b = new GeoBuilder();
    b.add(g, 0x9aa28f, { scale: [1, 0.6, 0.85] });
    return b.build();
  },
  house(v = 0) {
    const b = new GeoBuilder();
    const walls = [0xefe6d2, 0x8d6e58, 0xe4dccb, 0x9b7a62][v % 4];
    const roof = [0x4f6f78, 0x5d6468, 0xa65a45, 0x3f5d66][v % 4];
    b.add(box(1.6, 0.9, 1.1), walls, { pos: [0, 0.45, 0] });
    b.add(gableRoof(1.85, 1.35, 0.55), roof, { pos: [0, 0.9, 0] });
    b.add(box(0.36, 0.5, 0.04), 0x3b4a50, { pos: [-0.35, 0.3, 0.56] });
    b.add(box(0.4, 0.22, 0.04), 0xcfe8e6, { pos: [0.38, 0.55, 0.56] });
    if (v % 2 === 0) b.add(box(0.35, 0.3, 0.3), 0xe9e4d8, { pos: [0.75, 0.2, -0.3] }); // cục nóng điều hoà
    return b.build();
  },
  pole() {
    const b = new GeoBuilder();
    b.add(cyl(0.05, 0.07, 3.2, 6), 0x8b8f86, { pos: [0, 1.6, 0] });
    b.add(box(0.9, 0.06, 0.06), 0x6d726c, { pos: [0, 2.95, 0] });
    b.add(box(0.6, 0.05, 0.05), 0x6d726c, { pos: [0, 2.65, 0] });
    b.add(cyl(0.12, 0.12, 0.35, 8), 0x9aa09a, { pos: [0.16, 2.3, 0] });
    return b.build();
  },
  grass() {
    const b = new GeoBuilder();
    const c = new THREE.ConeGeometry(0.035, 0.34, 3);
    b.add(c, 0x7fbe63, { pos: [0, 0.17, 0] });
    b.add(c, 0x94cc6c, { pos: [0.06, 0.14, 0.03], rot: [0.25, 0, -0.3], scale: 0.8 });
    b.add(c, 0x6aae5c, { pos: [-0.05, 0.14, -0.02], rot: [-0.2, 0, 0.35], scale: 0.85 });
    return b.build({ outline: false });
  },
  rice() {
    const b = new GeoBuilder();
    const c = new THREE.ConeGeometry(0.05, 0.5, 3);
    b.add(c, 0xe7c75a, { pos: [0, 0.25, 0] });
    b.add(c, 0xd9b54a, { pos: [0.08, 0.22, 0.05], rot: [0.2, 0, -0.25] });
    b.add(c, 0xf0d470, { pos: [-0.07, 0.22, -0.04], rot: [-0.25, 0, 0.3] });
    b.add(c, 0xdcbc52, { pos: [0.02, 0.2, -0.09], rot: [-0.3, 0, -0.1] });
    return b.build({ outline: false });
  },
  cloud(seed = 0) {
    const b = new GeoBuilder();
    const r = (i) => Math.abs(Math.sin(seed * 91.7 + i * 13.3));
    b.add(ico(1.4, 2), 0xfdfdf8, { pos: [0, 0, 0], scale: [1.3, 0.85, 1] });
    b.add(ico(1.1, 2), 0xffffff, { pos: [1.4, -0.15, 0.2 * r(1)], scale: [1, 0.8, 0.9] });
    b.add(ico(1.0, 2), 0xf6f7f1, { pos: [-1.35, -0.25, -0.1] , scale: [1, 0.75, 0.9] });
    b.add(ico(0.9 + 0.4 * r(2), 2), 0xffffff, { pos: [0.4, 0.8, 0], scale: [1, 0.85, 1] });
    if (r(3) > 0.4) b.add(ico(0.8, 2), 0xfbfbf5, { pos: [2.3, -0.3, -0.2], scale: [1, 0.7, 0.9] });
    return b.build();
  },
  gull() {
    const b = new GeoBuilder();
    b.add(box(0.12, 0.08, 0.34), 0xffffff, { pos: [0, 0, 0] });
    return b.build();
  },
  gullWing() {
    const b = new GeoBuilder();
    b.add(box(0.55, 0.02, 0.16), 0xf4f4ee, { pos: [0.29, 0, 0] });
    b.add(box(0.14, 0.021, 0.1), 0x3d4a52, { pos: [0.5, 0, 0.02] });
    return b.build();
  },
  ferry() {
    const b = new GeoBuilder();
    b.add(box(1.5, 0.55, 4.2), 0xf5f4ee, { pos: [0, 0.2, 0] });
    b.add(new THREE.ConeGeometry(0.75, 1.2, 4, 1), 0xf5f4ee, { pos: [0, 0.2, 2.6], rot: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.52] });
    b.add(box(1.52, 0.22, 4.22), 0x3a9bd0, { pos: [0, -0.05, 0] });
    b.add(box(1.2, 0.5, 2.2), 0xfafaf6, { pos: [0, 0.72, -0.3] });
    b.add(box(1.22, 0.14, 2.22), 0x3f5a66, { pos: [0, 0.8, -0.3] });
    b.add(box(0.9, 0.4, 1.0), 0xf5f4ee, { pos: [0, 1.15, -0.6] });
    b.add(cyl(0.16, 0.2, 0.55, 8), 0xd65a45, { pos: [0, 1.5, -1.0] });
    return b.build();
  },
};
