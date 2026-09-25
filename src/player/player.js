// Di chuyển trên bề mặt cầu + va chạm đơn giản.
import * as THREE from 'three';
import { createCharacter } from './character.js';
import { orientOnSurface } from '../world/surface.js';
import { tangentFrame } from '../world/terrain.js';

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _t = new THREE.Vector3();

export class Player {
  constructor(world) {
    this.world = world;
    this.terrain = world.terrain;
    this.R = world.terrain.R;
    this.dir = new THREE.Vector3(0, 0, 1);
    this.facing = new THREE.Vector3(0, 1, 0);
    this.transported = []; // các vector tiếp tuyến cần "vận chuyển song song" theo người chơi
    this.speed = 0;
    this.target = null; // hướng đích khi click-to-move
    this.onArrive = null;
    this.char = createCharacter();
    this.object = this.char.root;
    this.height = 0;
    this.position = new THREE.Vector3();
  }

  placeAt(dir, facing) {
    this.dir.copy(dir).normalize();
    const f = facing ?? tangentFrame(this.dir).north;
    this.facing.copy(f).addScaledVector(this.dir, -f.dot(this.dir)).normalize();
    this.height = this.terrain.height(this.dir);
    this.target = null;
    this.sync(0);
  }

  // moveInput: vector tiếp tuyến (độ dài 0..1), run: chạy nhanh
  update(dt, moveInput, run, t) {
    let wish = _t.set(0, 0, 0);
    if (moveInput && moveInput.lengthSq() > 1e-4) {
      wish.copy(moveInput);
      this.target = null;
      this.onArrive = null;
    } else if (this.target) {
      const dist = Math.acos(Math.min(1, this.dir.dot(this.target))) * this.R;
      if (dist < (this.target.stopDist ?? 0.35)) {
        const cb = this.onArrive;
        this.target = null;
        this.onArrive = null;
        cb?.();
      } else {
        wish.copy(this.target).addScaledVector(this.dir, -this.target.dot(this.dir)).normalize();
        if (dist < 1.2) wish.multiplyScalar(Math.max(0.35, dist / 1.2));
      }
    }
    const maxSpeed = run ? 6.2 : 3.6;
    const wishSpeed = wish.length() * maxSpeed;
    this.speed += (wishSpeed - this.speed) * Math.min(1, dt * 10);

    if (this.speed > 0.01 && wish.lengthSq() > 1e-6) {
      const w = wish.clone().normalize();
      // xoay mặt nhân vật dần về hướng đi
      this.facing.lerp(w, Math.min(1, dt * 12)).addScaledVector(this.dir, -this.facing.dot(this.dir)).normalize();
      const stepLen = this.speed * dt;
      const moved = this.tryMove(w, stepLen) || this.tryMove(rot(w, this.dir, 0.6), stepLen * 0.8) || this.tryMove(rot(w, this.dir, -0.6), stepLen * 0.8) || this.tryMove(rot(w, this.dir, 1.2), stepLen * 0.5) || this.tryMove(rot(w, this.dir, -1.2), stepLen * 0.5);
      if (!moved) {
        this.speed *= 0.5;
        if (this.target && !moveInput) {
          this.blocked = (this.blocked ?? 0) + dt;
          if (this.blocked > 0.4) {
            this.target = null;
            this.onArrive = null;
          }
        }
      } else this.blocked = 0;
    }
    this.sync(dt, t);
  }

  tryMove(wdir, len) {
    const next = _v.copy(this.dir).multiplyScalar(this.R).addScaledVector(wdir, len).normalize();
    if (!this.terrain.walkable(next)) return false;
    // va chạm: đẩy ra khỏi các vật cản
    const pr = 0.28;
    for (const c of this.world.colliders) {
      const cd = c.dir.dot(next);
      if (cd < 0.98) continue;
      const dist = Math.acos(Math.min(1, cd)) * this.R;
      const min = c.r + pr;
      if (dist < min) {
        const away = next.clone().sub(c.dir).addScaledVector(next, -next.clone().sub(c.dir).dot(next));
        if (away.lengthSq() < 1e-10) return false;
        away.normalize();
        next.multiplyScalar(this.R).addScaledVector(away, min - dist + 0.001).normalize();
        if (!this.terrain.walkable(next)) return false;
      }
    }
    const old = this.dir.clone();
    _q.setFromUnitVectors(old, next);
    this.dir.copy(next);
    this.facing.applyQuaternion(_q);
    for (const v of this.transported) v.applyQuaternion(_q);
    return true;
  }

  walkTo(dir, { stopDist = 0.35, onArrive = null } = {}) {
    this.target = dir.clone().normalize();
    this.target.stopDist = stopDist;
    this.onArrive = onArrive;
    this.blocked = 0;
  }

  sync(dt, t = 0) {
    const h = this.terrain.height(this.dir);
    this.height = dt ? this.height + (h - this.height) * Math.min(1, dt * 14) : h;
    this.position.copy(this.dir).multiplyScalar(this.R + this.height);
    this.object.position.copy(this.position);
    orientOnSurface(this.object, this.dir, this.facing);
    this.char.update(dt, this.speed, t);
  }
}

function rot(v, axis, a) {
  return v.clone().applyAxisAngle(axis, a);
}
