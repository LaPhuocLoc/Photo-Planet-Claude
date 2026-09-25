// Vật liệu toon (cel-shading) + viền mực kiểu "inverted hull".
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const INK = 0x24383c;

// ── Nhìn xuyên: vật nằm giữa camera và nhân vật tự tan (dither) ──
export const occlusion = {
  uCamPos: { value: new THREE.Vector3() },
  uFocus: { value: new THREE.Vector3() },
  uOcclude: { value: 0 },
};
const OCC_HEAD = /* glsl */ `
  uniform vec3 uCamPos;
  uniform vec3 uFocus;
  uniform float uOcclude;
  varying vec3 vOccWorld;
  float occBayer(vec2 p) {
    ivec2 i = ivec2(mod(p, 4.0));
    int k = i.x + i.y * 4;
    float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    return (m[k] + 0.5) / 16.0;
  }
  void occDiscard() {
    if (uOcclude < 0.01) return;
    vec3 ab = uFocus - uCamPos;
    float L = length(ab);
    vec3 dir = ab / max(L, 1e-4);
    vec3 ap = vOccWorld - uCamPos;
    float t = dot(ap, dir);
    float dperp = length(ap - dir * t);
    float inside = step(0.0, t) * (1.0 - smoothstep(L - 1.6, L - 0.9, t)) * (1.0 - smoothstep(0.9, 2.0, dperp));
    float nearCam = 1.0 - smoothstep(1.4, 3.2, length(ap));
    float fade = max(inside * 0.85, nearCam) * uOcclude;
    if (fade > occBayer(gl_FragCoord.xy)) discard;
  }
`;
const OCC_VERT_HEAD = 'varying vec3 vOccWorld;';
const OCC_VERT = /* glsl */ `
  {
    vec4 ow = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      ow = instanceMatrix * ow;
    #endif
    vOccWorld = (modelMatrix * ow).xyz;
  }
`;
export function withOcclusion(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    prev?.call(mat, shader, r);
    Object.assign(shader.uniforms, occlusion);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${OCC_VERT_HEAD}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${OCC_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${OCC_HEAD}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\noccDiscard();');
  };
  mat.customProgramCacheKey = () => `occ|${prev ? prev.toString().length : 0}`;
  return mat;
}

let gradient;
export function toonGradient() {
  if (gradient) return gradient;
  // 3 dải sáng: bóng – bán sáng – sáng
  const data = new Uint8Array([110, 190, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

// 2 tông (sáng / bóng) cho nhân vật — cảm giác cel-shading vẽ tay hơn
let gradient2;
export function toonGradient2() {
  if (gradient2) return gradient2;
  const data = new Uint8Array([150, 255]);
  gradient2 = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient2.minFilter = gradient2.magFilter = THREE.NearestFilter;
  gradient2.generateMipmaps = false;
  gradient2.needsUpdate = true;
  return gradient2;
}

const cache = new Map();
export function toon(color = 0xffffff, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!cache.has(key)) {
    cache.set(key, withOcclusion(new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts })));
  }
  return cache.get(key);
}
export const vcToon = () => toon(0xffffff, { vertexColors: true });

// ── Viền mực ───────────────────────────────────────────────
const outlineCache = new Map();
export function outlineMaterial(thickness = 0.035, color = INK, { occlude = true } = {}) {
  const key = `${thickness}|${color}|${occlude}`;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
      ...occlusion,
      ...(occlude ? {} : { uOcclude: { value: 0 } }),
    },
    vertexShader: /* glsl */ `
      attribute vec3 outlineNormal;
      uniform float uThickness;
      varying vec3 vOccWorld;
      void main() {
        vec4 p = vec4(position + outlineNormal * uThickness, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vOccWorld = (modelMatrix * p).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      ${OCC_HEAD}
      void main() {
        occDiscard();
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
  outlineCache.set(key, mat);
  return mat;
}

// Pháp tuyến "mượt" (gộp theo vị trí) để viền không bị hở ở góc cạnh.
export function addOutlineNormals(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const n = pos.count;
  // khoá số (không dùng chuỗi): toạ độ làm tròn 1/500 → gộp 3 số nguyên vào 1 double (không trùng)
  const map = new Map();
  const slot = new Int32Array(n);
  const acc = [];
  const K = 262144;
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 500) + 131072 + K * (Math.round(pos.getY(i) * 500) + 131072 + K * (Math.round(pos.getZ(i) * 500) + 131072));
    let a = map.get(k);
    if (a === undefined) {
      a = acc.length;
      acc.push(0, 0, 0);
      map.set(k, a);
    }
    slot[i] = a;
    acc[a] += nor.getX(i);
    acc[a + 1] += nor.getY(i);
    acc[a + 2] += nor.getZ(i);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = slot[i];
    const l = Math.hypot(acc[a], acc[a + 1], acc[a + 2]) || 1;
    out[i * 3] = acc[a] / l;
    out[i * 3 + 1] = acc[a + 1] / l;
    out[i * 3 + 2] = acc[a + 2] / l;
  }
  geo.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
  return geo;
}

// Mesh toon kèm viền.
export function inked(geo, mat, { outline = 0.035, cast = true, receive = true } = {}) {
  if (outline && !geo.attributes.outlineNormal) addOutlineNormals(geo);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (outline) {
    const o = new THREE.Mesh(geo, outlineMaterial(outline));
    o.castShadow = false;
    o.receiveShadow = false;
    mesh.add(o);
  }
  return mesh;
}

// InstancedMesh toon kèm viền (viền dùng chung instanceMatrix).
export function inkedInstanced(geo, mat, count, { outline = 0.035, cast = true, receive = true } = {}) {
  if (outline && !geo.attributes.outlineNormal) addOutlineNormals(geo);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.frustumCulled = false;
  let line = null;
  if (outline) {
    line = new THREE.InstancedMesh(geo, outlineMaterial(outline), count);
    line.instanceMatrix = mesh.instanceMatrix;
    line.frustumCulled = false;
  }
  return { mesh, line };
}

// ── Gộp nhiều khối thành 1 geometry có màu theo đỉnh ─────────
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

export class GeoBuilder {
  constructor() {
    this.parts = [];
  }
  add(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, matrix = null } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) _m.copy(matrix);
    else {
      _p.fromArray(pos);
      _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
      if (Array.isArray(scale)) _s.fromArray(scale);
      else _s.setScalar(scale);
      _m.compose(_p, _q, _s);
    }
    g.applyMatrix4(_m);
    _c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }
  build({ outline = true } = {}) {
    const g = mergeGeometries(this.parts);
    if (outline) addOutlineNormals(g);
    g.computeBoundingSphere();
    this.parts = [];
    return g;
  }
}

// Lắc lư theo gió cho cỏ / lúa (gắn vào MeshToonMaterial).
const LEAF_GLSL = /* glsl */ `
  varying vec3 vLeafP;
  float lhash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float lnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(lhash(i), lhash(i + vec3(1,0,0)), f.x), mix(lhash(i + vec3(0,1,0)), lhash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(lhash(i + vec3(0,0,1)), lhash(i + vec3(1,0,1)), f.x), mix(lhash(i + vec3(0,1,1)), lhash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;
// leaf: vẽ thêm vân chùm lá (mảng tối + đốm sáng) lên phần màu xanh — giống tán cây vẽ tay
export function windMaterial(color, uniforms, { strength = 0.12, vertexColors = false, leaf = false } = {}) {
  const mat = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), vertexColors });
  withOcclusion(mat);
  const occ = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    occ(shader, r);
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float ph = uTime * 1.7 + ip.x * 0.35 + ip.y * 0.27 + ip.z * 0.31;
        float sway = (sin(ph) * 0.7 + sin(ph * 2.3 + 1.3) * 0.3) * ${strength.toFixed(3)} * max(position.y, 0.0) * 3.0;
        transformed.x += sway;
        transformed.z += sway * 0.6;${leaf ? '\n        vLeafP = position;' : ''}`,
      );
    if (leaf) {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLeafP;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${LEAF_GLSL}`)
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          {
            float foliage = step(diffuseColor.r * 1.12, diffuseColor.g) * step(0.25, diffuseColor.g);
            vec3 q = vLeafP * 5.5;
            float n1 = lnoise(q);
            float n2 = lnoise(q * 2.4 + 17.0);
            float clump = smoothstep(0.6, 0.63, n1 * 0.7 + n2 * 0.4);
            float fleck = smoothstep(0.78, 0.8, n2);
            diffuseColor.rgb *= 1.0 - clump * 0.2 * foliage;
            diffuseColor.rgb += fleck * 0.08 * foliage;
          }`,
        );
    }
  };
  mat.customProgramCacheKey = () => `wind${strength}${leaf}`;
  return mat;
}
