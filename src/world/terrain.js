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
  basalt: C(0x4a4642),
  basaltHi: C(0x625b53),
};

export class Terrain {
  constructor(planetCfg, places) {
    this.R = planetCfg.radius;
    this.noise = new SimplexNoise({ random: mulberry32(planetCfg.seed) });
    this.seas = planetCfg.seas.map((s) => ({ dir: dirFromLatLon(s.lat, s.lon), r: s.r * DEG, depth: s.depth }));
    this.hills = planetCfg.hills.map((h) => ({ dir: dirFromLatLon(h.lat, h.lon), r: h.r * DEG, amp: h.amp }));
    this.flats = places.map((p) => ({ dir: dirFromLatLon(p.lat, p.lon), r: p.flat.r / this.R, h: p.flat.h }));
    this.ledges = []; // mỏm đá do landmark thêm vào: { dir, r (rad), h }
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
    // gồ ghề + bậc thềm tự nhiên trên đồi: tạo mặt bằng và vách dốc xen kẽ
    if (h > 0.15) {
      const bump = this.fbm(d.x * 5.3 + 3.1, d.y * 5.3, d.z * 5.3, 3);
      h += bump * 0.42 * smoothstep(0.15, 0.9, h);
      if (h > 0.55) {
        const st = 0.62;
        const t = (h - 0.25) / st;
        const f = t - Math.floor(t);
        const stepped = 0.25 + (Math.floor(t) + smoothstep(0.3, 0.7, f)) * st;
        h += (stepped - h) * 0.6 * smoothstep(0.55, 1.0, h);
      }
    }
    for (const f of this.flats) {
      const a = angleBetween(d, f.dir);
      const w = 1 - smoothstep(0.6, 1.0, a / f.r);
      if (w > 0) h += (f.h - h) * w;
    }
    for (const l of this.ledges) {
      const a = angleBetween(d, l.dir);
      const w = 1 - smoothstep(0.55, 1.0, a / l.r);
      if (w > 0 && l.h > h) h += (l.h + 0.06 * n2 - h) * w;
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

  ledgeWeight(d) {
    let m = 0;
    for (const l of this.ledges) m = Math.max(m, 1 - smoothstep(0.5, 0.95, angleBetween(d, l.dir) / l.r));
    return m;
  }

  colorAt(d, h, out) {
    if (this.ledges.length && h > -0.3) {
      const lw = this.ledgeWeight(d);
      if (lw > 0.35) return out.copy(PAL.basalt).lerp(PAL.basaltHi, (Math.sin(d.x * 900) * Math.sin(d.z * 700) + 1) * 0.3);
    }
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

  buildMesh(detail = 96, uniforms = { uTime: { value: 0 } }) {
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
    geo.computeVertexNormals();
    // vách dốc → đá màu be, có mảng rêu xanh loang lổ
    const nor = geo.attributes.normal;
    const nn = new THREE.Vector3();
    const beA = new THREE.Color(0xdccda7);
    const beB = new THREE.Color(0xcbbb95);
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i);
      const r = d.length();
      d.divideScalar(r);
      const h = r - this.R;
      if (h < 0.18) continue;
      nn.fromBufferAttribute(nor, i);
      const slope = 1 - nn.dot(d);
      const t = smoothstep(0.1, 0.22, slope);
      if (t <= 0 || this.paddyAt(d)) continue;
      const moss = this.fbm(d.x * 16 + 5, d.y * 16, d.z * 16, 2);
      if (moss > 0.12) continue;
      c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
      c.lerp(moss > -0.1 ? beB : beA, t);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    const R = this.R;
    // mảng màu loang kiểu tranh vẽ + bọt sóng vỗ bờ
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uR = { value: R };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTP;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvTP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uTime; uniform float uR; varying vec3 vTP;
          float thash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
          float tnoise(vec3 p) {
            vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(thash(i), thash(i + vec3(1,0,0)), f.x), mix(thash(i + vec3(0,1,0)), thash(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(thash(i + vec3(0,0,1)), thash(i + vec3(1,0,1)), f.x), mix(thash(i + vec3(0,1,1)), thash(i + vec3(1,1,1)), f.x), f.y), f.z);
          }`,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          {
            float h = length(vTP) - uR;
            float n1 = tnoise(vTP * 1.1);
            float n2 = tnoise(vTP * 3.7 + 11.0);
            // mảng đậm nhạt (quét cọ) trên cỏ
            float blotch = smoothstep(0.55, 0.58, n1 * 0.65 + n2 * 0.45);
            float land = step(0.15, h);
            diffuseColor.rgb *= 1.0 - blotch * 0.07 * land;
            float fleck = smoothstep(0.82, 0.84, tnoise(vTP * 9.0));
            diffuseColor.rgb += fleck * 0.05 * land;
            // bọt sóng: dải trắng chạy ra vào ở mép nước
            float wave = sin(uTime * 1.3 + n1 * 9.0) * 0.045;
            float foam = smoothstep(-0.16 + wave, -0.08 + wave, h) * (1.0 - smoothstep(0.0 + wave, 0.06 + wave, h));
            foam *= smoothstep(0.35, 0.5, n2 + 0.25);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.99, 0.95), foam * 0.85);
          }`,
        );
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}
