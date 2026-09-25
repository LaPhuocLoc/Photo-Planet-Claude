// Texture "vẽ tay" bằng canvas: mặt, áo, quần. Nét hơi run, có hạt giấy.
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// PRNG cố định để lần nào vẽ cũng giống nhau
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grain(ctx, w, h, r, { n = 2500, light = 'rgba(255,255,255,0.05)', dark = 'rgba(0,0,0,0.045)', len = 6, vertical = false } = {}) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = vertical ? Math.PI / 2 + (r() - 0.5) * 0.3 : r() * Math.PI;
    const l = len * (0.4 + r());
    ctx.strokeStyle = r() < 0.5 ? light : dark;
    ctx.lineWidth = 1 + r() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

// Nét bút mềm, hơi run tay: đi qua các điểm bằng đường cong.
function line(ctx, pts, width, color, r, jitter = 0.8) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.lineWidth = width * (pass ? 0.6 : 1);
    ctx.globalAlpha = pass ? 0.55 : 1;
    const p = pts.map(([x, y]) => [x + (r() - 0.5) * jitter * 2, y + (r() - 0.5) * jitter * 2]);
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      const my = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
    }
    const l = p[p.length - 1];
    ctx.lineTo(l[0], l[1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function ring(ctx, cx, cy, rx, ry, width, color, r) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  line(ctx, pts, width, color, r, 0.6);
}

// ── Mặt ──────────────────────────────────────────────────────
// UV của SphereGeometry: chính diện (+Z) ở u = 0.25, xích đạo ở v = 0.5.
export const FACE = { W: 1024, H: 512, cx: 256, cy: 256 };
const SKIN = '#f3d8c3';
const HAIR = '#262c33';
const INK = '#23272c';

export function paintFace({ blink = false } = {}) {
  const { W, H, cx, cy } = FACE;
  const [c, ctx] = makeCanvas(W, H);
  const r = rng(7);
  ctx.fillStyle = SKIN;
  ctx.fillRect(0, 0, W, H);
  // vùng tóc dự phòng (đỉnh + sau gáy) để không lộ da qua kẽ tóc
  ctx.fillStyle = HAIR;
  ctx.fillRect(0, 0, W, 150);
  ctx.fillRect(W * 0.45, 0, W * 0.6, 330);
  grain(ctx, W, H, r, { n: 1800, light: 'rgba(255,240,230,0.06)', dark: 'rgba(120,70,50,0.035)' });

  // má hồng
  for (const s of [-1, 1]) {
    const g = ctx.createRadialGradient(cx + s * 74, cy + 52, 2, cx + s * 74, cy + 52, 30);
    g.addColorStop(0, 'rgba(236,142,128,0.42)');
    g.addColorStop(1, 'rgba(236,142,128,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx + s * 74 - 32, cy + 20, 64, 64);
  }

  const ey = cy + 26;
  for (const s of [-1, 1]) {
    const ex = cx + s * 46;
    // lông mày: đậm, hơi xếch
    line(ctx, [[ex - s * 18, ey - 34], [ex - s * 2, ey - 40], [ex + s * 19, ey - 35]], 7.5, INK, r);
    if (blink) {
      line(ctx, [[ex - 14, ey + 2], [ex, ey + 7], [ex + 14, ey + 2]], 4.5, INK, r, 0.4);
    } else {
      // tròng mắt hình hạt hạnh nhân
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(ex + s * 1, ey + 3, 13, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // mí trên dày, kéo dài ra đuôi mắt
      line(ctx, [[ex - s * 16, ey - 7], [ex, ey - 14], [ex + s * 19, ey - 8]], 6, INK, r, 0.4);
      // điểm sáng
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(ex - 3, ey - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // kính tròn gọng mảnh
    ring(ctx, ex, ey + 2, 29, 27, 3.6, '#3b3530', r);
    // gọng tai
    line(ctx, [[ex + s * 27, ey - 6], [ex + s * 60, ey - 10], [ex + s * 95, ey - 8]], 3, '#3b3530', r, 0.4);
  }
  // cầu kính
  line(ctx, [[cx - 20, ey - 5], [cx, ey - 11], [cx + 20, ey - 5]], 3, '#3b3530', r, 0.3);
  // mũi: 1 nét nhỏ
  line(ctx, [[cx + 3, ey + 18], [cx + 7, ey + 36], [cx, ey + 40]], 3, '#c38e78', r, 0.3);
  // miệng
  line(ctx, [[cx - 13, ey + 60], [cx, ey + 62], [cx + 12, ey + 59]], 3.6, '#8c4c43', r, 0.3);
  return toTexture(c);
}

// ── Vải ─────────────────────────────────────────────────────
// Áo (LatheGeometry, phiStart = π → chính diện ở u = 0.5; v = 0 ở gấu áo).
export function paintShirt() {
  const [c, ctx] = makeCanvas(512, 512);
  const r = rng(3);
  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, 512, 512);
  grain(ctx, 512, 512, r, { n: 1400, dark: 'rgba(90,80,60,0.04)' });
  // nẹp áo + cúc
  line(ctx, [[256, 0], [255, 120], [257, 250]], 3, '#d6cebf', r);
  for (const y of [70, 140, 210]) {
    ctx.fillStyle = '#cfc5b3';
    ctx.beginPath();
    ctx.arc(262, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // túi ngực trái
  line(ctx, [[282, 96], [284, 136], [318, 137], [316, 95]], 2.6, '#d6cebf', r);
  line(ctx, [[280, 96], [318, 94]], 3, '#d6cebf', r);
  // nếp gấp
  const folds = [
    [[150, 330], [175, 380], [168, 440]],
    [[362, 330], [338, 385], [345, 445]],
    [[200, 470], [230, 440], [262, 468]],
    [[292, 472], [320, 442], [350, 470]],
    [[120, 160], [150, 200]],
    [[392, 160], [362, 200]],
  ];
  for (const f of folds) line(ctx, f, 3, 'rgba(160,148,125,0.4)', r, 1.2);
  // gấu áo
  line(ctx, [[0, 498], [512, 498]], 3, '#ddd5c6', r, 0.6);
  return toTexture(c);
}

export function paintSleeve() {
  const [c, ctx] = makeCanvas(256, 256);
  const r = rng(5);
  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, 256, 256);
  grain(ctx, 256, 256, r, { n: 500, dark: 'rgba(90,80,60,0.04)' });
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 50 + r() * 10;
    line(ctx, [[x, 90 + r() * 20], [x + 16, 120], [x + 4, 150 + r() * 20]], 2.6, 'rgba(160,148,125,0.38)', r, 1);
  }
  return toTexture(c);
}

export function paintDenim() {
  const [c, ctx] = makeCanvas(512, 512);
  const r = rng(9);
  ctx.fillStyle = '#2f3a50';
  ctx.fillRect(0, 0, 512, 512);
  grain(ctx, 512, 512, r, { n: 4000, light: 'rgba(120,140,175,0.09)', dark: 'rgba(0,0,0,0.08)', len: 9, vertical: true });
  // nếp nhăn ở gối và ống quần
  for (let i = 0; i < 7; i++) {
    const x = r() * 512;
    const y = 300 + r() * 140;
    line(ctx, [[x - 30, y], [x, y + 10 + r() * 8], [x + 30, y + 2]], 3, 'rgba(18,24,36,0.5)', r, 1.5);
  }
  for (let i = 0; i < 5; i++) {
    const x = r() * 512;
    const y = 150 + r() * 60;
    line(ctx, [[x - 20, y], [x, y + 8], [x + 22, y]], 2.6, 'rgba(18,24,36,0.4)', r, 1.5);
  }
  // đường chỉ hai bên
  for (const x of [128, 384]) line(ctx, [[x, 0], [x + 2, 256], [x, 512]], 2, 'rgba(160,175,200,0.35)', r, 0.8);
  // ống gấp (cuff)
  ctx.fillStyle = 'rgba(95,112,140,0.35)';
  ctx.fillRect(0, 488, 512, 24);
  line(ctx, [[0, 488], [512, 488]], 2.5, 'rgba(18,24,36,0.5)', r, 0.6);
  return toTexture(c);
}
