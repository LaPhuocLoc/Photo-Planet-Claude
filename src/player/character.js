// Nhân vật chibi: nhiếp ảnh gia áo trắng, quần ống rộng, đeo máy ảnh.
import * as THREE from 'three';
import { inked, toon } from '../world/toon.js';

const OUT = 0.022;
const part = (geo, color, pos = [0, 0, 0], opts = {}) => {
  const m = inked(geo, toon(color), { outline: opts.outline ?? OUT });
  m.position.fromArray(pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  return m;
};

export function createCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // nhún khi đi
  root.add(body);

  const SKIN = 0xf3d9c4;
  const HAIR = 0x2a2e36;
  const SHIRT = 0xf4f1ea;
  const PANTS = 0x2e3648;
  const SHOE = 0x2a2a2c;

  // chân (pivot ở hông)
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.1 * s, 0.5, 0);
    pivot.add(part(new THREE.CylinderGeometry(0.085, 0.115, 0.44, 10), PANTS, [0, -0.22, 0]));
    pivot.add(part(new THREE.BoxGeometry(0.14, 0.08, 0.22), SHOE, [0, -0.46, 0.035]));
    body.add(pivot);
    return pivot;
  });

  // thân
  body.add(part(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 12), PANTS, [0, 0.54, 0]));
  body.add(part(new THREE.CapsuleGeometry(0.19, 0.2, 4, 12), SHIRT, [0, 0.76, 0]));
  body.add(part(new THREE.BoxGeometry(0.17, 0.04, 0.02), 0xe2ddd2, [0, 0.93, 0.18], { outline: 0 }));

  // tay (pivot ở vai)
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.24 * s, 0.9, 0);
    pivot.add(part(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), SHIRT, [0.02 * s, -0.14, 0]));
    pivot.add(part(new THREE.SphereGeometry(0.055, 10, 8), SKIN, [0.02 * s, -0.32, 0]));
    body.add(pivot);
    return pivot;
  });

  // đầu
  const head = new THREE.Group();
  head.position.set(0, 1.2, 0);
  head.add(part(new THREE.SphereGeometry(0.27, 20, 16), SKIN, [0, 0, 0]));
  const hair = part(new THREE.SphereGeometry(0.29, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), HAIR, [0, 0.04, -0.02]);
  head.add(hair);
  head.add(part(new THREE.SphereGeometry(0.16, 12, 10), HAIR, [0, -0.02, -0.16], { scale: [1.4, 1.1, 1] }));
  head.add(part(new THREE.SphereGeometry(0.1, 10, 8), HAIR, [0.12, 0.14, 0.18], { scale: [1.5, 0.6, 0.8], rot: [0, 0, -0.4] }));
  // kính tròn
  for (const s of [-1, 1]) {
    const g = part(new THREE.TorusGeometry(0.065, 0.012, 6, 16), 0x2b2b2b, [0.095 * s, -0.02, 0.255], { outline: 0 });
    head.add(g);
    head.add(part(new THREE.SphereGeometry(0.022, 8, 6), 0x23262b, [0.095 * s, -0.02, 0.25], { outline: 0 }));
  }
  head.add(part(new THREE.BoxGeometry(0.06, 0.012, 0.012), 0x2b2b2b, [0, -0.01, 0.262], { outline: 0 }));
  head.add(part(new THREE.SphereGeometry(0.04, 8, 6), 0xf0b9a8, [0.17, -0.1, 0.21], { outline: 0, scale: [1, 0.6, 0.4] }));
  head.add(part(new THREE.SphereGeometry(0.04, 8, 6), 0xf0b9a8, [-0.17, -0.1, 0.21], { outline: 0, scale: [1, 0.6, 0.4] }));
  body.add(head);

  // máy ảnh + dây đeo chéo
  const cam = new THREE.Group();
  cam.add(part(new THREE.BoxGeometry(0.2, 0.13, 0.08), 0x2b2d31, [0, 0, 0]));
  cam.add(part(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 12), 0x1f2124, [0, -0.005, 0.07], { rot: [Math.PI / 2, 0, 0] }));
  cam.add(part(new THREE.BoxGeometry(0.05, 0.03, 0.02), 0xc9ccd0, [0.06, 0.07, 0], { outline: 0 }));
  cam.position.set(0.02, 0.72, 0.21);
  body.add(cam);
  const strap = part(new THREE.TorusGeometry(0.22, 0.012, 5, 24, Math.PI * 1.25), 0x6a4a3a, [0, 0.86, 0.02], {
    outline: 0,
    rot: [0.2, 0, 2.1],
  });
  body.add(strap);

  // bóng tròn dưới chân (tiếp đất rõ hơn)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 20),
    new THREE.MeshBasicMaterial({ color: 0x1d3a3a, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  root.traverse((o) => {
    if (o.isMesh && o !== shadow && o.material.type !== 'ShaderMaterial') o.castShadow = true;
  });

  // ── hoạt ảnh ───────────────────────────────────────────────
  let phase = 0;
  let snap = 0; // 0..1 tư thế giơ máy lên chụp
  let snapTarget = 0;
  const camRest = cam.position.clone();
  const camUp = new THREE.Vector3(0, 1.2, 0.3);

  function update(dt, speed, t) {
    const moving = Math.min(1, speed / 3.5);
    phase += dt * (4 + speed * 2.2);
    const sw = Math.sin(phase) * 0.7 * moving;
    legs[0].rotation.x = sw;
    legs[1].rotation.x = -sw;
    snap += (snapTarget - snap) * Math.min(1, dt * 8);
    const armSwing = sw * 0.8 * (1 - snap);
    arms[0].rotation.x = -armSwing - snap * 1.9;
    arms[1].rotation.x = armSwing - snap * 1.9;
    arms[0].rotation.z = -0.08 - snap * 0.35 * -1;
    arms[1].rotation.z = 0.08 - snap * 0.35;
    body.position.y = Math.abs(Math.sin(phase)) * 0.06 * moving + Math.sin(t * 2) * 0.008 * (1 - moving);
    body.rotation.z = Math.sin(phase) * 0.04 * moving;
    head.rotation.x = snap * 0.1 - 0.04 * moving;
    head.rotation.y = Math.sin(t * 0.5) * 0.15 * (1 - moving) * (1 - snap);
    cam.position.lerpVectors(camRest, camUp, snap);
  }

  return {
    root,
    update,
    setSnap(v) {
      snapTarget = v ? 1 : 0;
    },
  };
}
