// Bầu trời vẽ tay (gradient + vệt mây quét cọ), nước biển toon, bụi lơ lửng.
import * as THREE from 'three';
import { toonGradient } from './toon.js';

const NOISE_GLSL = /* glsl */ `
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export function createSky(uniforms) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uT: { value: new THREE.Vector3(1, 0, 0) },
      uPlanet: { value: 1 },
      cZenith: { value: new THREE.Color(0x4fb9b3) },
      cHorizon: { value: new THREE.Color(0xa9e6d9) },
      cWisp: { value: new THREE.Color(0xd4f3ea) },
      cWispDark: { value: new THREE.Color(0x3fa9a6) },
      cSpace: { value: new THREE.Color(0x62c2bc) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uUp; uniform vec3 uT; uniform float uPlanet;
      uniform vec3 cZenith, cHorizon, cWisp, cWispDark, cSpace;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 U = normalize(uUp);
        vec3 T = normalize(uT - U * dot(uT, U));
        vec3 B = cross(U, T);
        vec3 c = vec3(dot(d, T), dot(d, U), dot(d, B));
        float t = c.y;
        vec3 sky = mix(cHorizon, cZenith, smoothstep(-0.05, 0.7, t));
        // vệt mây quét cọ, xiên chéo
        vec3 q = vec3(c.x * 1.3 + c.y * 1.8, c.y * 7.0, c.z * 1.3 - c.y * 0.8);
        float n = fbm3(q * 1.4 + vec3(uTime * 0.012, 0.0, uTime * 0.006));
        float band = smoothstep(0.02, 0.3, t) * (1.0 - smoothstep(0.55, 0.9, t));
        float w = smoothstep(0.56, 0.585, n) * band;
        float wd = smoothstep(0.5, 0.52, n) * (1.0 - smoothstep(0.56, 0.585, n)) * band;
        sky = mix(sky, cWispDark, wd * 0.25);
        sky = mix(sky, cWisp, w * 0.75);
        // không gian quanh hành tinh (chế độ bản đồ)
        float sn = vnoise(d * 40.0);
        vec3 space = cSpace * (0.97 + 0.05 * sn);
        gl_FragColor = vec4(mix(sky, space, uPlanet), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}

export function createWater(R, uniforms) {
  const mat = new THREE.MeshToonMaterial({
    color: 0x5cc7c2,
    gradientMap: toonGradient(),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 wp = vWPos * 0.55;
        float n1 = vnoise(wp + vec3(uTime * 0.22, uTime * 0.05, uTime * 0.17));
        float n2 = vnoise(wp * 2.1 - vec3(uTime * 0.3, 0.0, uTime * 0.21));
        float glint = smoothstep(0.72, 0.75, n1 * 0.6 + n2 * 0.5);
        float streak = smoothstep(0.64, 0.66, n2) * (1.0 - smoothstep(0.7, 0.72, n2));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 1.0, 0.97), glint * 0.85 + streak * 0.25);
        diffuseColor.a = max(diffuseColor.a, glint * 0.9);`,
      );
  };
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 40), mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  mesh.name = 'water';
  return mesh;
}

export function createDust(R, count = 700) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(R + 1.5 + Math.pow(Math.random(), 1.6) * 60);
    pos.set([v.x, v.y, v.z], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime; uniform float uPixel; varying float vA;
      void main() {
        vec3 p = position;
        p += vec3(sin(uTime * 0.3 + seed * 40.0), cos(uTime * 0.23 + seed * 17.0), sin(uTime * 0.27 + seed * 9.0)) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (1.5 + seed * 3.5) * (40.0 / max(4.0, -mv.z));
        gl_PointSize = clamp(gl_PointSize, 1.0, 9.0 * uPixel);
        vA = 0.35 + 0.45 * fract(seed * 7.13);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.93, 1.0, 0.96), vA * smoothstep(0.5, 0.2, d));
      }`,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
