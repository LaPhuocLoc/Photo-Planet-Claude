// Tiện ích đặt vật thể lên bề mặt hành tinh theo khung toạ độ cục bộ.
import * as THREE from 'three';
import { tangentFrame } from './terrain.js';

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _f = new THREE.Vector3();

// Xoay obj sao cho trục Y = up, trục Z ≈ fwd.
export function orientOnSurface(obj, up, fwd) {
  _f.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize();
  _x.crossVectors(up, _f).normalize();
  _m.makeBasis(_x, up, _f);
  obj.quaternion.setFromRotationMatrix(_m);
}

export class SurfaceFrame {
  constructor(world, centerDir, bearingDeg = 0) {
    this.world = world;
    this.terrain = world.terrain;
    this.R = world.terrain.R;
    this.frame = tangentFrame(centerDir, bearingDeg);
  }
  // hướng (vector đơn vị) tại toạ độ cục bộ (x: ngang, z: phía trước)
  dirAt(x, z, out = new THREE.Vector3()) {
    const { up, side, fwd } = this.frame;
    return out
      .copy(up)
      .multiplyScalar(this.R)
      .addScaledVector(side, x)
      .addScaledVector(fwd, z)
      .normalize();
  }
  groundAt(x, z, water = false) {
    const d = this.dirAt(x, z);
    const r = this.terrain.radiusAt(d);
    return water ? Math.max(this.R, r) : r;
  }
  // Đặt obj tại (x, z), cao thêm y, xoay thêm rotY quanh trục đứng.
  put(obj, x, z, { rotY = 0, y = 0, water = false, seabed = false, parent = this.world.group } = {}) {
    const d = this.dirAt(x, z);
    const tr = this.terrain.radiusAt(d);
    const r = seabed ? tr : water ? Math.max(this.R, tr) : tr;
    obj.position.copy(d).multiplyScalar(r + y);
    orientOnSurface(obj, d, this.frame.fwd);
    if (rotY) obj.rotateY(rotY);
    parent.add(obj);
    return obj;
  }
  collide(x, z, r) {
    this.world.colliders.push({ dir: this.dirAt(x, z), r });
  }
}
