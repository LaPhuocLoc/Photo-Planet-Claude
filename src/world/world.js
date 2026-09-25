// Lắp ráp cả hành tinh: địa hình, biển, đường, cây cối, landmark, mây, chim, phà.
import * as THREE from 'three';
import { Terrain, dirFromLatLon, mulberry32, tangentFrame, DEG } from './terrain.js';
import { createWater, createDust } from './sky.js';
import { Models } from './models.js';
import { inked, inkedInstanced, vcToon, toon, windMaterial } from './toon.js';
import { buildLandmark } from './landmarks.js';
import { orientOnSurface } from './surface.js';

const _o = new THREE.Object3D();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function slerpDir(a, b, t, out) {
  const th = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  if (th < 1e-5) return out.copy(a);
  const s = Math.sin(th);
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * th) / s)
    .addScaledVector(b, Math.sin(t * th) / s)
    .normalize();
}

export class World {
  constructor(trip, uniforms) {
    this.trip = trip;
    this.uniforms = uniforms;
    this.group = new THREE.Group();
    this.colliders = [];
    this.animators = [];
    this.terrain = new Terrain(trip.planet, trip.places);
    this.R = this.terrain.R;
    this.rnd = mulberry32(trip.planet.seed * 7 + 3);
    this.places = trip.places.map((p) => {
      const dir = dirFromLatLon(p.lat, p.lon);
      const facing = p.facing === 'sea' ? this.seaBearing(dir) : p.facing ?? 0;
      return { ...p, facing, dir, frame: tangentFrame(dir, facing) };
    });
    this.roadDirs = [];
  }

  // hướng (độ) nhìn ra vùng nước sâu gần nhất
  seaBearing(dir) {
    let best = 0;
    let bestH = Infinity;
    const d = new THREE.Vector3();
    for (let b = 0; b < 360; b += 5) {
      const { fwd } = tangentFrame(dir, b);
      let h = 0;
      for (const dist of [5, 7, 9]) h += this.terrain.height(d.copy(dir).multiplyScalar(this.R).addScaledVector(fwd, dist).normalize());
      if (h < bestH) [best, bestH] = [b, h];
    }
    return best;
  }

  animate(fn) {
    this.animators.push(fn);
  }

  build() {
    this.terrainMesh = this.terrain.buildMesh(96);
    this.group.add(this.terrainMesh);
    this.water = createWater(this.R, this.uniforms);
    this.group.add(this.water);
    this.buildRoad();
    for (const p of this.places) buildLandmark(this, p);
    this.scatter();
    this.buildClouds();
    this.buildGulls();
    this.buildFerry();
    this.dust = createDust(this.R);
    this.group.add(this.dust);
    return this;
  }

  surfacePoint(dir, lift = 0, out = new THREE.Vector3()) {
    return out.copy(dir).multiplyScalar(this.terrain.radiusAt(dir) + lift);
  }

  // ── Đường làng nối các địa điểm ─────────────────────────────
  buildRoad() {
    const byId = Object.fromEntries(this.places.map((p) => [p.id, p]));
    const route = (this.trip.route || []).map((id) => byId[id]).filter(Boolean);
    const pts = [];
    const step = 0.42;
    for (let s = 0; s < route.length - 1; s++) {
      const a = route[s].dir;
      const b = route[s + 1].dir;
      const th = Math.acos(Math.min(1, a.dot(b)));
      const n = Math.max(2, Math.ceil((th * this.R) / step));
      const tan = new THREE.Vector3();
      for (let i = s === 0 ? 0 : 1; i <= n; i++) {
        const t = i / n;
        const d = slerpDir(a, b, t, new THREE.Vector3());
        tan.copy(b).sub(a).addScaledVector(d, -b.clone().sub(a).dot(d)).normalize();
        const side = _v.crossVectors(d, tan).normalize();
        const wig = Math.sin(t * Math.PI * (2 + (s % 2)) + s * 1.7) * Math.sin(t * Math.PI) * 1.7;
        d.multiplyScalar(this.R).addScaledVector(side, wig).normalize();
        pts.push(d);
      }
    }
    if (pts.length < 2) return;
    this.roadDirs = pts;

    const W = 1.05;
    const pos = [];
    const dash = [];
    const idx = [];
    const didx = [];
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const lift = (d) => Math.max(this.terrain.height(d), 0.12) + 0.05;
    const P = (d, w) => {
      _v2.copy(d).multiplyScalar(this.R).addScaledVector(side, w).normalize();
      return _v2.clone().multiplyScalar(this.R + lift(_v2));
    };
    const poles = [];
    for (let i = 0; i < pts.length; i++) {
      const d = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      tangent.copy(b).sub(a).addScaledVector(d, -b.clone().sub(a).dot(d)).normalize();
      side.crossVectors(d, tangent).normalize();
      const l = P(d, -W / 2);
      const r = P(d, W / 2);
      pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
      const dl = P(d, -0.05).addScaledVector(d, 0.012);
      const dr = P(d, 0.05).addScaledVector(d, 0.012);
      dash.push(dl.x, dl.y, dl.z, dr.x, dr.y, dr.z);
      if (i > 0) {
        const k = i * 2;
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        if (i % 4 < 2) didx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
      if (i % 11 === 5 && this.terrain.height(d) > 0.15 && !this.nearPlace(d, 1.5)) {
        const sgn = Math.floor(i / 11) % 2 ? 1 : -1;
        poles.push({ dir: _v2.copy(d).multiplyScalar(this.R).addScaledVector(side, sgn * 1.05).normalize().clone(), tan: tangent.clone() });
      }
    }
    const mk = (arr, ind, color, off) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.setIndex(ind);
      g.computeVertexNormals();
      const m = new THREE.MeshToonMaterial({
        color,
        gradientMap: toon().gradientMap,
        polygonOffset: true,
        polygonOffsetFactor: off,
        polygonOffsetUnits: off,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      return mesh;
    };
    this.group.add(mk(pos, idx, 0xb3c2b6, -2));
    this.group.add(mk(dash, didx, 0xf4f1e6, -4));
    this.buildPoles(poles);
  }

  buildPoles(poles) {
    if (!poles.length) return;
    const geo = Models.pole();
    const { mesh, line } = inkedInstanced(geo, vcToon(), poles.length, { outline: 0.02 });
    const wire = [];
    const tops = [];
    poles.forEach((p, i) => {
      _o.position.copy(p.dir).multiplyScalar(this.terrain.radiusAt(p.dir) - 0.05);
      orientOnSurface(_o, p.dir, p.tan);
      _o.scale.setScalar(1);
      _o.updateMatrix();
      mesh.setMatrixAt(i, _o.matrix);
      const x = new THREE.Vector3(1, 0, 0).applyQuaternion(_o.quaternion);
      const top = _o.position.clone().addScaledVector(p.dir, 2.95);
      tops.push([top.clone().addScaledVector(x, 0.4), top.clone().addScaledVector(x, -0.4), top.clone().addScaledVector(p.dir, -0.3)]);
      this.colliders.push({ dir: p.dir, r: 0.2 });
    });
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i];
      const b = tops[i + 1];
      if (a[0].distanceTo(b[0]) > 8) continue;
      for (let k = 0; k < 3; k++) {
        const up = a[k].clone().add(b[k]).normalize();
        const N = 10;
        for (let s = 0; s < N; s++) {
          const f = (t) => {
            const p = a[k].clone().lerp(b[k], t);
            return p.addScaledVector(up, -Math.sin(Math.PI * t) * 0.32);
          };
          const p0 = f(s / N);
          const p1 = f((s + 1) / N);
          wire.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        }
      }
    }
    this.group.add(mesh, line);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    this.group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x33474b, transparent: true, opacity: 0.75 })));
  }

  nearRoad(d, dist) {
    const c = Math.cos(dist / this.R);
    for (const r of this.roadDirs) if (r.dot(d) > c) return true;
    return false;
  }
  nearPlace(d, pad = 0) {
    for (const p of this.places) {
      const a = Math.acos(Math.min(1, p.dir.dot(d))) * this.R;
      if (a < p.flat.r + pad) return true;
    }
    return false;
  }

  randDir(out = new THREE.Vector3()) {
    const z = this.rnd() * 2 - 1;
    const ph = this.rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    return out.set(s * Math.cos(ph), z, s * Math.sin(ph));
  }

  // ── Rải cây, nhà, đá, cỏ ───────────────────────────────────
  scatter() {
    const T = this.terrain;
    const rnd = this.rnd;
    const sets = { tree0: [], tree1: [], tree2: [], pine: [], bush: [], rock: [], grass: [], rice: [] };
    const houses = [[], [], [], []];
    const d = new THREE.Vector3();
    for (let i = 0; i < 14000; i++) {
      this.randDir(d);
      const h = T.height(d);
      if (h < 0.16) {
        if (h > -0.35 && h < 0.1 && rnd() < 0.05 && !this.nearPlace(d, 0.5)) sets.rock.push({ d: d.clone(), s: 0.5 + rnd() * 1.1, sink: 0.12 });
        continue;
      }
      if (T.paddyAt(d)) continue;
      const roadNear = this.nearRoad(d, 1.2);
      if (!roadNear && rnd() < 0.45) sets.grass.push({ d: d.clone(), s: 0.8 + rnd() * 0.8 });
      if (roadNear || this.nearPlace(d, 3.5) || this.nearRoad(d, 1.8)) continue;
      const forest = T.forestAt(d);
      if (forest > 0.12 && rnd() < 0.42) {
        if (h > 2.0 || rnd() < 0.25) sets.pine.push({ d: d.clone(), s: 0.8 + rnd() * 0.6, r: 0.25 });
        else sets[`tree${Math.floor(rnd() * 3)}`].push({ d: d.clone(), s: 0.75 + rnd() * 0.65, r: 0.3 });
      } else if (rnd() < 0.025) sets[`tree${Math.floor(rnd() * 3)}`].push({ d: d.clone(), s: 0.7 + rnd() * 0.5, r: 0.3 });
      else if (rnd() < 0.06) sets.bush.push({ d: d.clone(), s: 0.7 + rnd() * 0.8 });
      else if (h > 1.6 && rnd() < 0.03) sets.rock.push({ d: d.clone(), s: 0.6 + rnd() * 0.8, sink: 0.1 });
    }
    // cỏ quanh landmark (không đè lên đường)
    for (const p of this.places) {
      for (let i = 0; i < 260; i++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * (p.flat.r + 1);
        d.copy(p.dir).multiplyScalar(this.R).addScaledVector(p.frame.side, Math.cos(a) * r).addScaledVector(p.frame.fwd, Math.sin(a) * r).normalize();
        if (T.height(d) < 0.16 || T.paddyAt(d) || this.nearRoad(d, 0.7)) continue;
        sets.grass.push({ d: d.clone(), s: 0.8 + rnd() * 0.7 });
      }
    }
    // nhà dọc đường làng
    for (let i = 0; i < this.roadDirs.length; i += 1) {
      if (rnd() > 0.07) continue;
      const rd = this.roadDirs[i];
      const nx = this.roadDirs[Math.min(i + 1, this.roadDirs.length - 1)];
      const tan = nx.clone().sub(rd).normalize();
      const side = new THREE.Vector3().crossVectors(rd, tan).normalize();
      const sgn = rnd() < 0.5 ? 1 : -1;
      const hd = rd.clone().multiplyScalar(this.R).addScaledVector(side, sgn * (2.1 + rnd() * 0.6)).normalize();
      const h = T.height(hd);
      if (h < 0.25 || h > 2.2 || this.nearPlace(hd, 4.0) || this.nearRoad(hd, 1.5) || T.paddyAt(hd)) continue;
      houses[Math.floor(rnd() * 4)].push({ d: hd, face: side.clone().multiplyScalar(-sgn), s: 0.9 + rnd() * 0.3 });
      this.colliders.push({ dir: hd, r: 1.0 });
    }

    const geos = {
      tree0: Models.tree(0),
      tree1: Models.tree(1),
      tree2: Models.tree(2),
      pine: Models.pine(),
      bush: Models.bush(),
      rock: Models.rock(),
    };
    for (const k of Object.keys(geos)) this.instances(geos[k], sets[k], { outline: k === 'rock' ? 0.025 : 0.03 });
    houses.forEach((list, v) => this.instances(Models.house(v), list, { outline: 0.025, faceKey: true }));
    for (const k of ['tree0', 'tree1', 'tree2', 'pine']) for (const it of sets[k]) this.colliders.push({ dir: it.d, r: it.r * it.s });

    // cỏ + lúa lay theo gió
    const grassMat = windMaterial(0xffffff, this.uniforms, { strength: 0.1, vertexColors: true });
    this.instances(Models.grass(), sets.grass, { outline: 0, mat: grassMat, cast: false });
    const riceSet = [];
    for (const p of this.places.filter((q) => q.landmark === 'rice')) {
      const R0 = p.flat.r;
      for (let x = -R0; x <= R0; x += 0.24) {
        for (let z = -R0; z <= R0; z += 0.24) {
          const jx = x + (rnd() - 0.5) * 0.2;
          const jz = z + (rnd() - 0.5) * 0.2;
          d.copy(p.dir).multiplyScalar(this.R).addScaledVector(p.frame.side, jx).addScaledVector(p.frame.fwd, jz).normalize();
          const cell = T.paddyAt(d);
          if (cell?.type === 'gold') riceSet.push({ d: d.clone(), s: 0.85 + rnd() * 0.4, sink: 0.02 });
        }
      }
    }
    const riceMat = windMaterial(0xffffff, this.uniforms, { strength: 0.13, vertexColors: true });
    this.instances(Models.rice(), riceSet, { outline: 0, mat: riceMat, cast: false });
  }

  instances(geo, list, { outline = 0.03, mat = vcToon(), cast = true, faceKey = false } = {}) {
    if (!list.length) return;
    const { mesh, line } = inkedInstanced(geo, mat, list.length, { outline, cast });
    const rnd = this.rnd;
    list.forEach((it, i) => {
      const h = this.terrain.radiusAt(it.d);
      _o.position.copy(it.d).multiplyScalar(h - (it.sink ?? 0.04));
      if (faceKey && it.face) orientOnSurface(_o, it.d, it.face);
      else {
        orientOnSurface(_o, it.d, _v.set(0, 1, 0).cross(it.d).lengthSq() > 1e-4 ? _v.set(0, 1, 0).cross(it.d) : _v.set(1, 0, 0));
        _o.rotateY(rnd() * Math.PI * 2);
      }
      _o.scale.setScalar(it.s ?? 1);
      _o.updateMatrix();
      mesh.setMatrixAt(i, _o.matrix);
      if (!faceKey) {
        const tint = 0.9 + rnd() * 0.2;
        mesh.setColorAt?.(i, new THREE.Color(tint, tint * (0.97 + rnd() * 0.06), tint));
      }
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    if (line) this.group.add(line);
    return mesh;
  }

  // ── Mây trôi quanh hành tinh ───────────────────────────────
  buildClouds() {
    this.clouds = new THREE.Group();
    const mat = toon(0xffffff, { vertexColors: true });
    const geos = [0, 1, 2, 3].map((i) => Models.cloud(i + 1));
    const d = new THREE.Vector3();
    for (let i = 0; i < 18; i++) {
      this.randDir(d);
      const c = inked(geos[i % 4], mat, { outline: 0.05, cast: false, receive: false });
      c.position.copy(d).multiplyScalar(this.R + 11 + this.rnd() * 6);
      orientOnSurface(c, d.clone(), _v.set(0, 1, 0).cross(d).normalize());
      c.rotateY(this.rnd() * 6);
      c.scale.setScalar(0.7 + this.rnd() * 0.8);
      this.clouds.add(c);
    }
    this.group.add(this.clouds);
    this.animate((t, dt) => {
      this.clouds.rotation.y += dt * 0.006;
      this.clouds.rotation.x = Math.sin(t * 0.01) * 0.05;
    });
  }

  // ── Mòng biển ──────────────────────────────────────────────
  buildGulls() {
    const body = Models.gull();
    const wing = Models.gullWing();
    const mat = vcToon();
    const spots = this.places.filter((p) => ['futatsugame', 'taraibune', 'shelter', 'onogame'].includes(p.landmark));
    for (const p of spots) {
      const f = p.frame;
      const center = p.dir.clone().multiplyScalar(this.R).addScaledVector(f.fwd, 5).normalize();
      for (let k = 0; k < 3; k++) {
        const g = new THREE.Group();
        g.add(inked(body, mat, { outline: 0.015, cast: false }));
        const wl = new THREE.Group();
        const wr = new THREE.Group();
        wl.add(inked(wing, mat, { outline: 0.012, cast: false }));
        const wrm = inked(wing, mat, { outline: 0.012, cast: false });
        wrm.scale.x = -1;
        wr.add(wrm);
        g.add(wl, wr);
        this.group.add(g);
        const ph = k * 2.1 + this.rnd() * 3;
        const rad = 2.5 + k * 0.8;
        const alt = 4.5 + k * 0.7;
        const spd = 0.35 + this.rnd() * 0.15;
        const { side, fwd } = tangentFrame(center, 0);
        const pos = new THREE.Vector3();
        const next = new THREE.Vector3();
        this.animate((t) => {
          const a = t * spd + ph;
          const at = (ang, out) =>
            out
              .copy(center)
              .multiplyScalar(this.R)
              .addScaledVector(side, Math.cos(ang) * rad)
              .addScaledVector(fwd, Math.sin(ang) * rad)
              .normalize();
          at(a, pos);
          at(a + 0.05, next);
          g.position.copy(pos).multiplyScalar(this.R + alt + Math.sin(t * 0.8 + ph) * 0.4);
          orientOnSurface(g, pos, next.sub(pos));
          const flap = Math.sin(t * 7 + ph) * 0.5;
          wl.rotation.z = flap;
          wr.rotation.z = -flap;
          g.rotateZ(-0.25);
        });
      }
    }
  }

  // ── Phà chạy vòng ngoài khơi ───────────────────────────────
  buildFerry() {
    const big = this.trip.planet.seas.reduce((a, b) => (b.r > a.r ? b : a));
    const c = dirFromLatLon(big.lat, big.lon);
    const { side, fwd } = tangentFrame(c, 0);
    let radius = null;
    for (const deg of [26, 22, 30, 18, 34]) {
      let ok = true;
      for (let i = 0; i < 64 && ok; i++) {
        const a = (i / 64) * Math.PI * 2;
        const d = c.clone().multiplyScalar(Math.cos(deg * DEG)).addScaledVector(side, Math.sin(deg * DEG) * Math.cos(a)).addScaledVector(fwd, Math.sin(deg * DEG) * Math.sin(a)).normalize();
        if (this.terrain.height(d) > -0.5) ok = false;
      }
      if (ok) {
        radius = deg * DEG;
        break;
      }
    }
    if (radius == null) return;
    const ferry = inked(Models.ferry(), vcToon(), { outline: 0.03 });
    ferry.scale.setScalar(0.9);
    this.group.add(ferry);
    this.ferry = ferry;
    const pos = new THREE.Vector3();
    const nxt = new THREE.Vector3();
    const at = (a, out) =>
      out
        .copy(c)
        .multiplyScalar(Math.cos(radius))
        .addScaledVector(side, Math.sin(radius) * Math.cos(a))
        .addScaledVector(fwd, Math.sin(radius) * Math.sin(a))
        .normalize();
    this.animate((t) => {
      const a = t * 0.02;
      at(a, pos);
      at(a + 0.01, nxt);
      ferry.position.copy(pos).multiplyScalar(this.R + 0.05 + Math.sin(t * 1.1) * 0.03);
      orientOnSurface(ferry, pos, nxt.sub(pos));
    });
  }

  update(t, dt) {
    for (const f of this.animators) f(t, dt);
  }
}
