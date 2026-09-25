// Địa hình hành tinh: hàm độ cao giải tích + mesh có màu theo đỉnh.
import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonGradient } from './toon.js';

export const DEG = Math.PI / 180;
export const WALKABLE = 0.08; // cao hơn mực nước bao nhiêu thì đi được

export function dirFromLatLon(lat, lon, out = new THREE.Vector3()) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const angleBetween = (a, b) => Math.acos(Math.min(1, Math.max(-1, a.dot(b))));

// Khung toạ độ tiếp tuyến tại 1 điểm trên cầu.
export function tangentFrame(up, bearingDeg = 0) {
  const ref = Math.abs(up.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(ref, up).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  const b = bearingDeg * DEG;
  const fwd = north.clone().multiplyScalar(Math.cos(b)).addScaledVector(east, Math.sin(b)).normalize();
  const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
  return { up: up.clone(), east, north, fwd, side };
}

const C = (h) => new THREE.Color(h);
const PAL = {
  deep: C(0x2b7b8e),
  mid: C(0x3fa3a6),
  shallow: C(0x8fdcc8),
  foam: C(0xeaf3e4),
  sand: C(0xe8d8a8),
  grassA: C(0xa3d176),
  grassB: C(0x7cbc62),
  grassC: C(0x5aa45b),
  forest: C(0x44905a),
  rock: C(0x98a189),
  rockHi: C(0xbdbc9e),
  gold: C(0xe8c85c),
  goldB: C(0xd8b04a),
  paddyGreen: C(0xb4d46c),
  levee: C(0x6fae5a),
};

export class Terrain {
  constructor(planetCfg, places) {
    this.R = planetCfg.radius;
    this.noise = new SimplexNoise({ random: mulberry32(planetCfg.seed) });
    this.seas = planetCfg.seas.map((s) => ({ dir: dirFromLatLon(s.lat, s.lon), r: s.r * DEG, depth: s.depth }));
    this.hills = planetCfg.hills.map((h) => ({ dir: dirFromLatLon(h.lat, h.lon), r: h.r * DEG, amp: h.amp }));
    this.flats = places.map((p) => ({ dir: dirFromLatLon(p.lat, p.lon), r: p.flat.r / this.R, h: p.flat.h }));
    // ruộng lúa: vùng phẳng của landmark "rice"
    this.paddies = places
      .filter((p) => p.landmark === 'rice')
      .map((p) => {
        const dir = dirFromLatLon(p.lat, p.lon);
        return { dir, r: p.flat.r, frame: tangentFrame(dir, p.facing ?? 0) };
      });
  }

  fbm(x, y, z, oct = 4) {
    let a = 0.5;
    let f = 1;
    let s = 0;
    for (let i = 0; i < oct; i++) {
      s += a * this.noise.noise3d(x * f, y * f, z * f);
      f *= 2.03;
      a *= 0.5;
    }
    return s;
  }

  // Độ cao so với mực nước biển tại hướng d (vector đơn vị).
  height(d) {
    const n = this.fbm(d.x * 1.7, d.y * 1.7, d.z * 1.7);
    const n2 = this.noise.noise3d(d.x * 4.3 + 7.1, d.y * 4.3, d.z * 4.3);
    let h = 0.62 + 0.42 * n;
    for (const s of this.seas) {
      const a = angleBetween(d, s.dir);
      const x = a / (s.r * (1 + 0.14 * n2 + 0.12 * n));
      if (x < 1.2) h -= s.depth * (1 - smoothstep(0.5, 1.0, x));
    }
    for (const m of this.hills) {
      const a = angleBetween(d, m.dir);
      const x = a / m.r;
      if (x < 1) {
        const b = 1 - x * x;
        h += m.amp * b * b * (0.78 + 0.32 * n2 + 0.2 * n);
      }
    }
    for (const f of this.flats) {
      const a = angleBetween(d, f.dir);
      const w = 1 - smoothstep(0.6, 1.0, a / f.r);
      if (w > 0) h += (f.h - h) * w;
    }
    return h;
  }

  radiusAt(d) {
    return this.R + this.height(d);
  }
  walkable(d) {
    return this.height(d) > WALKABLE;
  }

  // Ô ruộng (nếu d nằm trong ruộng): trả về loại ô.
  paddyAt(d) {
    for (const p of this.paddies) {
      const off = d.clone().multiplyScalar(this.R).sub(p.dir.clone().multiplyScalar(this.R));
      const x = off.dot(p.frame.side);
      const z = off.dot(p.frame.fwd);
      const dist = Math.hypot(x, z);
      if (dist > p.r * 0.92) continue;
      const cw = 2.3;
      const ch = 1.7;
      const cx = Math.floor(x / cw);
      const cz = Math.floor(z / ch);
      const fx = x / cw - cx;
      const fz = z / ch - cz;
      const edge = Math.min(fx, 1 - fx) * cw < 0.12 || Math.min(fz, 1 - fz) * ch < 0.12;
      const hash = Math.abs(Math.sin(cx * 127.1 + cz * 311.7) * 43758.5453) % 1;
      // chừa lối đi ở giữa (đường chạy qua)
      if (Math.abs(x) < 1.0) return { type: 'road' };
      return { type: edge ? 'levee' : hash < 0.62 ? 'gold' : hash < 0.8 ? 'harvest' : 'green', hash };
    }
    return null;
  }

  colorAt(d, h, out) {
    const n = this.fbm(d.x * 6 + 3, d.y * 6, d.z * 6, 2);
    if (h < -0.02) {
      const t = Math.min(1, -h / 1.4);
      if (h > -0.14) return out.copy(PAL.foam).lerp(PAL.shallow, smoothstep(-0.05, -0.14, h));
      if (t < 0.45) return out.copy(PAL.shallow).lerp(PAL.mid, t / 0.45);
      return out.copy(PAL.mid).lerp(PAL.deep, (t - 0.45) / 0.55);
    }
    if (h < 0.2) return out.copy(PAL.sand).lerp(PAL.grassA, smoothstep(0.12, 0.2, h));
    const p = this.paddyAt(d);
    if (p) {
      if (p.type === 'gold') return out.copy(PAL.gold).lerp(PAL.goldB, p.hash * 1.4);
      if (p.type === 'harvest') return out.copy(PAL.goldB).lerp(PAL.sand, 0.5);
      if (p.type === 'green') return out.copy(PAL.paddyGreen);
      if (p.type === 'road') return out.copy(PAL.grassA);
      return out.copy(PAL.levee);
    }
    if (n > 0.18) out.copy(PAL.grassA);
    else if (n > -0.12) out.copy(PAL.grassB);
    else out.copy(PAL.grassC);
    const forest = this.forestAt(d);
    if (forest > 0.1) out.lerp(PAL.forest, Math.min(1, forest * 1.6));
    if (h > 2.6) out.lerp(PAL.rock, smoothstep(2.6, 3.3, h));
    if (h > 3.6) out.lerp(PAL.rockHi, smoothstep(3.6, 4.2, h));
    return out;
  }

  forestAt(d) {
    return this.fbm(d.x * 2.6 + 11, d.y * 2.6, d.z * 2.6, 3);
  }

  buildMesh(detail = 96) {
    let geo = new THREE.IcosahedronGeometry(1, detail);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const d = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).normalize();
      const h = this.height(d);
      pos.setXYZ(i, d.x * (this.R + h), d.y * (this.R + h), d.z * (this.R + h));
      this.colorAt(d, h, c);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}
