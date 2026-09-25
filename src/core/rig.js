// Camera: chế độ "đi dạo" (bám sau nhân vật) ⇄ chế độ "hành tinh" (xoay quanh cả quả cầu).
import * as THREE from 'three';

const ease = (t) => t * t * (3 - 2 * t);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class CameraRig {
  constructor(camera, player, R) {
    this.camera = camera;
    this.player = player;
    this.R = R;
    // đi dạo
    this.heading = new THREE.Vector3(1, 0, 0); // hướng nhìn (tiếp tuyến), vận chuyển theo player
    this.sunT = new THREE.Vector3(1, 0, 0); // tiếp tuyến cố định cho hướng nắng + vệt mây
    player.transported.push(this.heading, this.sunT);
    this.dist = 7;
    this.distTarget = 7;
    this.pitch = 0.4;
    this.autoAlign = 0;
    // hành tinh
    this.orbit = new THREE.Quaternion();
    this.orbitDist = 72;
    this.orbitDistTarget = 72;
    this.spin = 0.04;
    // chuyển cảnh
    this.mode = 'planet';
    this.blend = 1; // 0 = đi dạo, 1 = hành tinh
    this.blendSpeed = 0.7;
    this.smoothUp = new THREE.Vector3(0, 1, 0);
    this.smoothTarget = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.4).normalize();
  }

  syncHeading() {
    const d = this.player.dir;
    this.heading.copy(this.player.facing).addScaledVector(d, -this.player.facing.dot(d)).normalize();
    this.sunT.copy(this.heading).applyAxisAngle(d, 0.9);
  }

  setMode(mode, { speed = 0.7 } = {}) {
    if (mode === this.mode) return;
    if (mode === 'planet') {
      // bắt đầu quỹ đạo ngay phía trên người chơi để chuyển cảnh liền mạch
      const d = this.player.dir;
      const f = this.heading;
      const back = f.clone().negate();
      const zAxis = d.clone().addScaledVector(back, 0.5).normalize();
      const yAxis = f.clone().addScaledVector(zAxis, -f.dot(zAxis)).normalize();
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
      this.orbit.setFromRotationMatrix(_m.makeBasis(xAxis, yAxis, zAxis));
      this.orbitDistTarget = 72;
    }
    this.mode = mode;
    this.blendSpeed = speed;
  }

  // Điều khiển bằng kéo chuột
  drag(dx, dy) {
    if (this.blend < 0.5) {
      this.heading.applyAxisAngle(this.player.dir, -dx * 0.006);
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.08, 1.25);
      this.autoAlign = 0;
    } else {
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * 0.005);
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * 0.005);
      this.orbit.multiply(qx).multiply(qy);
      this.spinPause = 3;
    }
  }

  // Trả về true nếu cần đổi chế độ
  zoom(delta) {
    if (this.mode === 'explore') {
      this.distTarget = THREE.MathUtils.clamp(this.distTarget * (1 + delta * 0.0012), 3.2, 16);
      if (delta > 0 && this.distTarget >= 16) return 'planet';
    } else {
      this.orbitDistTarget = THREE.MathUtils.clamp(this.orbitDistTarget * (1 + delta * 0.0012), 38, 110);
      if (delta < 0 && this.orbitDistTarget <= 38) return 'explore';
    }
    return null;
  }

  // Hướng "tiến" của camera trên mặt phẳng tiếp tuyến (cho WASD)
  forward() {
    return this.heading;
  }

  update(dt, playerMoving) {
    const target = this.mode === 'planet' ? 1 : 0;
    const k = dt * this.blendSpeed;
    this.blend = target > this.blend ? Math.min(1, this.blend + k) : Math.max(0, this.blend - k);
    const b = ease(this.blend);

    // tự xoay camera về sau lưng nhân vật khi click-to-move
    const d = this.player.dir;
    if (playerMoving && this.player.target) {
      this.autoAlign = Math.min(1, this.autoAlign + dt * 0.8);
      const f = this.player.facing;
      this.heading.lerp(f, dt * 1.4 * this.autoAlign);
    }
    this.heading.addScaledVector(d, -this.heading.dot(d)).normalize();
    this.sunT.addScaledVector(d, -this.sunT.dot(d)).normalize();

    this.dist += (this.distTarget - this.dist) * Math.min(1, dt * 6);
    this.orbitDist += (this.orbitDistTarget - this.orbitDist) * Math.min(1, dt * 4);

    // pose đi dạo
    const up = this.smoothUp.lerp(d, Math.min(1, dt * 8)).normalize();
    const pp = this.player.position;
    this.smoothTarget.lerp(pp, this.smoothTarget.lengthSq() === 0 ? 1 : Math.min(1, dt * 12));
    const look = _a.copy(this.smoothTarget).addScaledVector(up, 1.5).addScaledVector(this.heading, 2.4);
    const exPos = _b
      .copy(this.smoothTarget)
      .addScaledVector(up, 0.9 + Math.sin(this.pitch) * this.dist)
      .addScaledVector(this.heading, -Math.cos(this.pitch) * this.dist);

    // pose hành tinh
    if (this.mode === 'planet' && !(this.spinPause > 0)) {
      this.orbit.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * this.spin));
    }
    this.spinPause = Math.max(0, (this.spinPause ?? 0) - dt);
    const plPos = new THREE.Vector3(0, 0, 1).applyQuaternion(this.orbit).multiplyScalar(this.orbitDist);
    const plUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.orbit);

    // trộn: nội suy theo hướng (slerp) + khoảng cách để bay vòng qua bề mặt
    const exLen = exPos.length();
    const plLen = plPos.length();
    const dirA = exPos.clone().normalize();
    const dirB = plPos.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(dirA, dirB);
    const qi = new THREE.Quaternion().slerp(q, b);
    const pos = dirA.applyQuaternion(qi).multiplyScalar(THREE.MathUtils.lerp(exLen, plLen, b) + Math.sin(b * Math.PI) * 10);
    const lookAt = look.clone().lerp(new THREE.Vector3(0, 0, 0), ease(Math.min(1, b * 1.4)));
    this.up.copy(up).lerp(plUp, b).normalize();

    this.camera.position.copy(pos);
    this.camera.up.copy(this.up);
    this.camera.lookAt(lookAt);

    // nắng: luôn "buổi trưa" quanh người chơi, còn ở chế độ hành tinh thì chiếu từ phía camera
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const camBack = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
    const exSun = d.clone().multiplyScalar(1).addScaledVector(this.sunT, 0.55).addScaledVector(this.heading, -0.25).normalize();
    const plSun = camBack.clone().multiplyScalar(0.8).addScaledVector(this.up, 0.6).addScaledVector(camRight, 0.5).normalize();
    this.sunDir.copy(exSun).lerp(plSun, b).normalize();
    return b;
  }
}
