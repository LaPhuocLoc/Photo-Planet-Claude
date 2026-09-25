// Mô hình low-poly dựng từ khối cơ bản, màu theo đỉnh.
import * as THREE from 'three';
import { GeoBuilder } from './toon.js';

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

export const Models = {
  tree(v = 0) {
    const b = new GeoBuilder();
    const greens = [
      [0x5fae5c, 0x78c065, 0x4d9a55],
      [0x6fb85e, 0x8fcb6c, 0x5aa65a],
      [0x4f9d5a, 0x66b060, 0x3f8a52],
    ][v % 3];
    b.add(cyl(0.07, 0.11, 1.0, 6), 0x7a5a48, { pos: [0, 0.5, 0] });
    b.add(ico(0.62, 1), greens[0], { pos: [0, 1.25, 0], scale: [1, 0.9, 1] });
    b.add(ico(0.44, 1), greens[1], { pos: [0.34, 1.52, 0.14] });
    b.add(ico(0.4, 1), greens[2], { pos: [-0.3, 1.02, -0.2] });
    b.add(ico(0.34, 1), greens[1], { pos: [-0.12, 1.72, -0.12] });
    return b.build();
  },
  pine() {
    const b = new GeoBuilder();
    b.add(cyl(0.06, 0.1, 1.0, 6), 0x6e5242, { pos: [0, 0.5, 0] });
    b.add(new THREE.ConeGeometry(0.62, 0.9, 7), 0x3f8456, { pos: [0, 1.0, 0] });
    b.add(new THREE.ConeGeometry(0.5, 0.8, 7), 0x4a9460, { pos: [0, 1.45, 0] });
    b.add(new THREE.ConeGeometry(0.34, 0.65, 7), 0x57a166, { pos: [0, 1.9, 0] });
    return b.build();
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
