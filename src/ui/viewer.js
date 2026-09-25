// Trình xem ảnh toàn màn hình cho điện thoại, kiểu app "Ảnh" của iPhone:
//  - vuốt ngang: sang ảnh trước/sau (ảnh chạy theo ngón tay, hết ảnh thì kéo dây thun)
//  - hàng ảnh nhỏ dưới đáy: chạm để nhảy, kéo để lướt nhanh qua cả album
//  - vuốt lên (hoặc nút ⓘ): bảng thông tin trồi lên, ảnh bị đẩy lên trên
//    (ảnh ngang dạt hẳn lên đỉnh màn hình, bảng lấp phần còn lại)
//  - vuốt xuống: đóng; chạm 1 lần: ẩn/hiện thanh công cụ; chụm / chạm đúp: phóng to
import { cameraName, lensName, fmtLongDate, fmtTime } from './format.js';

const GAP = 18; // khoảng hở giữa 2 ảnh khi vuốt
const TH_W = 30; // hàng ảnh nhỏ: bề ngang mỗi ô
const TH_H = 44;
const TH_GAP = 2;
const TH_M = 7; // ô đang xem nở ra theo đúng tỉ lệ ảnh + lề 2 bên
const MAX_ZOOM = 4;
const ANIM_MS = 340;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
// kéo quá giới hạn → càng kéo càng nặng, như dây thun
const rubber = (over, dim) => Math.sign(over) * (1 - 1 / ((Math.abs(over) * 0.55) / dim + 1)) * dim;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const ICON = {
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.6v.1" /></svg>',
};

export class PhotoViewer {
  // ctx: { thumbUrl, photoUrl, load(id) → Promise<url>, meta(id) → EXIF, onClose() }
  constructor(ctx) {
    this.ctx = ctx;
    this.isOpen = false;
    this.slides = [];
    this.index = 0;
    this.info = 0; // 0 = đóng … 1 = bảng thông tin mở hẳn
    this.dx = 0; // độ lệch ngang khi đang vuốt đổi ảnh
    this.pull = null; // { x, y } khi đang kéo xuống để đóng
    this.zoom = { s: 1, tx: 0, ty: 0 };
    this.pts = new Map();
    this.drag = null;
    this.build();
    this.bind();
  }

  build() {
    const el = document.createElement('section');
    el.className = 'viewer';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="v-bg"></div>
      <div class="v-stage"><div class="v-track"></div></div>
      <header class="v-top">
        <button class="v-btn v-close" aria-label="Đóng">${ICON.close}</button>
        <div class="v-head"><div class="v-title"></div><div class="v-sub"></div></div>
        <button class="v-btn v-info-btn" aria-label="Thông tin ảnh">${ICON.info}</button>
      </header>
      <footer class="v-bottom">
        <button class="v-cap"></button>
        <div class="v-strip"><div class="v-strip-in"></div></div>
      </footer>
      <div class="v-sheet">
        <div class="v-grab"></div>
        <div class="v-sheet-in"><div class="v-body"></div></div>
      </div>
      <div class="v-hint">Vuốt lên để xem chi tiết</div>`;
    document.body.appendChild(el);
    const q = (s) => el.querySelector(s);
    this.el = el;
    this.bg = q('.v-bg');
    this.stage = q('.v-stage');
    this.track = q('.v-track');
    this.top = q('.v-top');
    this.titleEl = q('.v-title');
    this.subEl = q('.v-sub');
    this.infoBtn = q('.v-info-btn');
    this.capEl = q('.v-cap');
    this.strip = q('.v-strip');
    this.stripIn = q('.v-strip-in');
    this.sheet = q('.v-sheet');
    this.sheetIn = q('.v-sheet-in');
    this.body = q('.v-body');
    this.hint = q('.v-hint');
  }

  bind() {
    this.el.querySelector('.v-close').addEventListener('click', () => this.ctx.onClose());
    this.infoBtn.addEventListener('click', () => this.setInfo(this.info < 0.5));
    this.capEl.addEventListener('click', () => this.setInfo(true));

    const s = this.stage;
    s.addEventListener('pointerdown', (e) => this.onDown(e));
    s.addEventListener('pointermove', (e) => this.onMove(e));
    s.addEventListener('pointerup', (e) => this.onUp(e));
    s.addEventListener('pointercancel', (e) => this.onUp(e));

    // hàng ảnh nhỏ: kéo để lướt (ảnh lớn đổi theo), thả ra thì hít vào ô gần nhất
    this.scrub = false;
    this.stripTouch = false;
    this.strip.addEventListener('touchstart', () => (this.stripTouch = true), { passive: true });
    const touchEnd = () => {
      this.stripTouch = false;
      if (this.scrub) this.endScrubSoon();
    };
    this.strip.addEventListener('touchend', touchEnd, { passive: true });
    this.strip.addEventListener('touchcancel', touchEnd, { passive: true });
    this.strip.addEventListener('scroll', () => {
      if (!this.scrub) {
        // chỉ tính là "lướt" khi chính ngón tay kéo (bỏ qua lúc tự cuộn về ô đang xem)
        if (!this.stripTouch) return;
        this.scrub = true;
        this.strip.classList.add('scrub');
      }
      const k = clamp(Math.round((this.strip.scrollLeft - TH_W / 2) / (TH_W + TH_GAP)), 0, this.slides.length - 1);
      if (k !== this.index) this.setIndex(k, { fromStrip: true });
      this.endScrubSoon();
    }, { passive: true });

    // bảng thông tin: đang ở đầu trang mà kéo xuống → kéo cả bảng xuống để đóng
    let sd = null;
    this.sheet.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      sd = e.touches.length === 1 ? { y: t.clientY, y0: 0, on: false, lastY: t.clientY, lastT: e.timeStamp, vy: 0 } : null;
    }, { passive: true });
    this.sheet.addEventListener('touchmove', (e) => {
      if (!sd) return;
      const y = e.touches[0].clientY;
      if (!sd.on) {
        if (this.sheetIn.scrollTop <= 0 && y - sd.y > 6) {
          sd.on = true;
          sd.y0 = y;
          this.setAnim(false);
        } else return;
      }
      e.preventDefault();
      const dt = e.timeStamp - sd.lastT;
      if (dt > 0) sd.vy = lerp(sd.vy, (y - sd.lastY) / dt, 0.6);
      sd.lastY = y;
      sd.lastT = e.timeStamp;
      this.info = clamp(1 - (y - sd.y0) / this.travel(), 0, 1);
      this.apply();
    }, { passive: false });
    const sheetEnd = () => {
      if (sd?.on) this.setInfo(!(sd.vy > 0.3 || this.info < 0.6));
      sd = null;
    };
    this.sheet.addEventListener('touchend', sheetEnd);
    this.sheet.addEventListener('touchcancel', sheetEnd);
    this.el.querySelector('.v-grab').addEventListener('click', () => this.setInfo(false));

    window.addEventListener('resize', () => {
      if (!this.isOpen) return;
      this.zoom = { s: 1, tx: 0, ty: 0 };
      this.layout();
      this.apply();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'ArrowUp') this.setInfo(true);
      else if (e.key === 'ArrowDown') this.setInfo(false);
    });
    // nút Back của điện thoại → đóng ảnh thay vì rời trang
    window.addEventListener('popstate', () => {
      if (this.expectPop) {
        this.expectPop = false;
        return;
      }
      if (this.isOpen) {
        this.pushed = false;
        this.ctx.onClose();
      }
    });
  }

  // ── mở / đóng ──────────────────────────────────────────────
  open(place, index = 0, chapter = '') {
    this.place = place;
    this.chapter = chapter;
    this.isOpen = true;
    this.el.hidden = false;
    this.el.classList.remove('closing', 'bare', 'pulling', 'info-open');
    this.bg.style.opacity = '';
    this.info = 0;
    this.dx = 0;
    this.pull = null;
    this.zoom = { s: 1, tx: 0, ty: 0 };
    this.titleEl.textContent = place.name;
    this.buildSlides();
    this.buildStrip();
    this.index = clamp(index, 0, this.slides.length - 1);
    this.layout();
    this.setIndex(this.index, { jump: true });
    this.setAnim(false);
    this.apply();
    if (!history.state?.ppViewer) {
      history.pushState({ ppViewer: true }, '');
      this.pushed = true;
    }
    this.showHint();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    clearTimeout(this.tapT);
    this.pts.clear();
    this.drag = null;
    this.el.classList.add('closing');
    clearTimeout(this.closeT);
    this.closeT = setTimeout(() => {
      this.el.hidden = true;
      this.el.classList.remove('closing');
      this.track.innerHTML = '';
      this.slides = [];
    }, 260);
    if (this.pushed) {
      this.pushed = false;
      this.expectPop = true;
      history.back();
    }
  }

  showHint() {
    let seen = false;
    try {
      seen = localStorage.getItem('photo-planet:viewer-hint') === '1';
      localStorage.setItem('photo-planet:viewer-hint', '1');
    } catch {
      /* private mode: vẫn hiện gợi ý */
    }
    this.hint.classList.remove('show');
    if (seen) return;
    void this.hint.offsetWidth;
    this.hint.classList.add('show');
  }

  // ── dựng ảnh + hàng ảnh nhỏ ────────────────────────────────
  buildSlides() {
    this.track.innerHTML = '';
    this.slides = this.place.photos.map((ph) => {
      const el = document.createElement('div');
      el.className = 'v-slide';
      el.innerHTML = '<div class="v-photo"><img class="v-img v-lo" alt="" /><img class="v-img v-hi" alt="" /></div>';
      this.track.appendChild(el);
      const m = this.ctx.meta(ph.id);
      return {
        el,
        photo: el.firstElementChild,
        lo: el.querySelector('.v-lo'),
        hi: el.querySelector('.v-hi'),
        ph,
        ratio: m.w && m.h ? m.w / m.h : 1.5,
        loaded: false,
        hiRes: false,
        fit: null,
        lift: 0,
      };
    });
  }

  buildStrip() {
    const n = this.slides.length;
    this.stripIn.innerHTML = '';
    this.strip.hidden = n < 2;
    this.slides.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'v-th';
      b.setAttribute('aria-label', `Ảnh ${i + 1}`);
      b.style.setProperty('--w', `${Math.round(clamp(TH_H * s.ratio, 24, 78))}px`);
      b.innerHTML = `<img src="${this.ctx.thumbUrl(s.ph.id)}" alt="" />`;
      b.addEventListener('click', () => {
        this.endScrub();
        this.setIndex(i, { jump: true });
        this.apply();
      });
      this.stripIn.appendChild(b);
      s.th = b;
    });
  }

  ensure(i) {
    const s = this.slides[i];
    if (!s || s.loaded) return;
    s.loaded = true;
    s.lo.src = this.ctx.thumbUrl(s.ph.id);
    s.hi.alt = s.ph.caption || this.place.name;
    this.ctx.load(s.ph.id).then((url) => {
      if (!s.hi.isConnected) return;
      const ready = () => s.photo.classList.add('ready');
      s.hi.onload = ready;
      s.hi.src = url;
      if (s.hi.complete && s.hi.naturalWidth) ready();
    });
  }

  // phóng to → đổi sang bản 2000px cho nét
  upgrade(s) {
    if (s.hiRes) return;
    s.hiRes = true;
    const url = this.ctx.photoUrl(s.ph.id);
    if (s.hi.currentSrc?.endsWith(url)) return;
    const img = new Image();
    img.src = url;
    (img.decode ? img.decode() : Promise.resolve())
      .then(() => s.hi.isConnected && (s.hi.src = url))
      .catch(() => (s.hiRes = false));
  }

  // ── bố cục ─────────────────────────────────────────────────
  layout() {
    const vw = (this.vw = this.el.clientWidth);
    const vh = (this.vh = this.el.clientHeight);
    this.slides.forEach((s, i) => {
      s.el.style.left = `${i * (vw + GAP)}px`;
      let fw = Math.min(vw, vh * s.ratio);
      let fh = fw / s.ratio;
      const fit = (s.fit = { w: fw, h: fh, x: (vw - fw) / 2, y: (vh - fh) / 2 });
      Object.assign(s.photo.style, { left: `${fit.x}px`, top: `${fit.y}px`, width: `${fw}px`, height: `${fh}px` });
    });
    this.layoutInfo();
  }

  // bảng thông tin cao bao nhiêu + mỗi ảnh bị đẩy lên bao nhiêu khi mở bảng
  layoutInfo() {
    const { vh } = this;
    const cur = this.slides[this.index];
    if (!cur) return;
    const padB = parseFloat(getComputedStyle(this.sheetIn).paddingBottom) || 0;
    const contentH = 24 + this.body.offsetHeight + padB;
    const topY = this.top.offsetHeight + 4; // mép dưới thanh trên cùng
    const minSheet = Math.min(contentH, vh * 0.36);
    const plan = (s) => {
      // ảnh ngang (thấp): dạt hẳn lên đỉnh, bảng lấp phần dưới
      if (vh - (topY + s.fit.h) >= minSheet) return { lift: topY - s.fit.y, top: topY + s.fit.h };
      // ảnh dọc / màn ngang: bảng cao vừa nội dung, ảnh trồi lên bằng đó (tràn khỏi mép trên cũng được)
      const top = Math.max(vh - contentH, vh * 0.38, topY);
      return { lift: Math.min(0, top - (s.fit.y + s.fit.h)), top };
    };
    for (const s of this.slides) s.lift = plan(s).lift;
    this.sheetTop = plan(cur).top;
    this.sheet.style.height = `${vh - this.sheetTop + 80}px`;
  }
  travel() {
    return Math.max(120, this.vh - this.sheetTop);
  }

  apply() {
    const { vw, vh } = this;
    this.track.style.transform = `translate3d(${-this.index * (vw + GAP) + this.dx}px,0,0)`;
    for (const s of this.slides) s.el.style.transform = `translate3d(0,${(s.lift * this.info).toFixed(1)}px,0)`;
    this.sheet.style.transform = `translate3d(0,${lerp(vh + 2, this.sheetTop, this.info).toFixed(1)}px,0)`;
    this.el.style.setProperty('--info', this.info.toFixed(3));
    this.el.classList.toggle('info-open', this.info > 0.02);
    this.infoBtn.classList.toggle('on', this.info > 0.5);
    const cur = this.slides[this.index];
    if (!cur) return;
    if (this.pull) {
      // kéo xuống để đóng: ảnh nhỏ lại theo ngón tay, nền đen nhạt dần
      const { x, y } = this.pull;
      const k = 1 - clamp(y / vh, 0, 1) * 0.4;
      const tx = x + ((1 - k) * cur.fit.w) / 2;
      const ty = y + ((1 - k) * cur.fit.h) / 2;
      cur.photo.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${k})`;
      this.bg.style.opacity = 1 - clamp(y / (vh * 0.45), 0, 1) * 0.85;
    } else {
      const z = this.zoom;
      cur.photo.style.transform = z.s === 1 && !z.tx && !z.ty ? '' : `translate3d(${z.tx}px,${z.ty}px,0) scale(${z.s})`;
      this.bg.style.opacity = '';
    }
  }

  setAnim(on) {
    clearTimeout(this.animT);
    this.el.classList.toggle('anim', on);
    if (on) this.animT = setTimeout(() => this.el.classList.remove('anim'), ANIM_MS + 40);
  }

  setInfo(open) {
    if (open && this.zoom.s > 1) this.zoom = { s: 1, tx: 0, ty: 0 };
    this.hint.classList.remove('show');
    this.setAnim(true);
    this.info = open ? 1 : 0;
    this.apply();
  }

  // ── đổi ảnh ────────────────────────────────────────────────
  go(k) {
    if (!this.isOpen) return;
    this.setAnim(true);
    this.setIndex(k);
    this.apply();
  }

  setIndex(k, { jump = false, fromStrip = false } = {}) {
    const n = this.slides.length;
    k = clamp(k, 0, n - 1);
    const prev = this.slides[this.index];
    if (prev && k !== this.index) prev.photo.style.transform = '';
    this.index = k;
    this.zoom = { s: 1, tx: 0, ty: 0 };
    const s = this.slides[k];
    const m = this.ctx.meta(s.ph.id);
    const time = fmtTime(m.date);
    this.subEl.textContent = [n > 1 ? `${k + 1} / ${n}` : null, time].filter(Boolean).join(' · ');
    this.capEl.textContent = s.ph.caption || '';
    this.capEl.hidden = !s.ph.caption;
    this.renderInfo(s, m);
    this.slides.forEach((t, i) => t.th?.classList.toggle('on', i === k));
    this.ensure(k);
    this.ensure(k + 1);
    this.ensure(k - 1);
    this.layoutInfo();
    if (!fromStrip) this.centerStrip(jump);
    this.ctx.onIndex?.(k);
  }

  renderInfo(s, m) {
    const p = this.place;
    const specs = [m.iso && `ISO ${m.iso}`, m.focal && `${m.focal} mm`, m.f && `ƒ/${m.f}`, m.shutter].filter(Boolean);
    const cam = cameraName(m.camera);
    const lens = lensName(m.lens);
    const date = fmtLongDate(m.date);
    const time = fmtTime(m.date);
    this.body.innerHTML = `
      ${date ? `<div class="v-when">${esc(date)}${time ? ` · ${esc(time)}` : ''}</div>` : ''}
      ${s.ph.caption ? `<p class="v-caption">${esc(s.ph.caption)}</p>` : ''}
      <div class="v-place">
        ${this.chapter ? `<div class="v-chap">${esc(this.chapter)}</div>` : ''}
        <div class="v-pname">${esc(p.name)}</div>
        ${p.nameJp ? `<div class="v-pjp">${esc(p.nameJp)}</div>` : ''}
        ${p.blurb ? `<p class="v-blurb">${esc(p.blurb)}</p>` : ''}
      </div>
      ${
        cam || specs.length
          ? `<div class="v-cam">
        <div class="v-cam-h"><b>${esc(cam || 'Máy ảnh')}</b>${m.w ? `<span>${m.w} × ${m.h}</span>` : ''}</div>
        ${lens ? `<div class="v-lens">${esc(lens)}</div>` : ''}
        ${specs.length ? `<div class="v-specs">${specs.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      </div>`
          : ''
      }`;
    this.sheetIn.scrollTop = 0;
  }

  // ô đang xem nằm giữa hàng ảnh nhỏ (tính theo bố cục cuối, không đo DOM đang chuyển động)
  centerStrip(jump) {
    if (this.strip.hidden) return;
    const pad = this.strip.clientWidth / 2;
    this.stripIn.style.padding = `0 ${pad}px`;
    const s = this.slides[this.index];
    const wc = parseFloat(s.th.style.getPropertyValue('--w'));
    const left = this.index * (TH_W + TH_GAP) + TH_M + wc / 2;
    this.strip.scrollTo({ left, behavior: jump ? 'auto' : 'smooth' });
  }

  endScrubSoon() {
    clearTimeout(this.scrubT);
    this.scrubT = setTimeout(() => !this.stripTouch && this.endScrub(), 140);
  }
  endScrub() {
    clearTimeout(this.scrubT);
    if (!this.scrub) return;
    this.scrub = false;
    this.strip.classList.remove('scrub');
    this.centerStrip(false);
  }

  // ── cử chỉ trên ảnh ────────────────────────────────────────
  onDown(e) {
    if (!this.isOpen) return;
    this.stage.setPointerCapture?.(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.setAnim(false);
    if (this.pts.size === 2) {
      // chụm 2 ngón: phóng to/thu nhỏ quanh điểm giữa 2 ngón
      if (this.info > 0.02 || this.pull) return;
      this.dx = 0;
      const [a, b] = [...this.pts.values()];
      const cur = this.slides[this.index];
      const z = this.zoom;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.drag = {
        mode: 'pinch',
        moved: true,
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        s0: z.s,
        lx: (mx - cur.fit.x - z.tx) / z.s,
        ly: (my - cur.fit.y - z.ty) / z.s,
      };
      this.upgrade(cur);
      this.apply();
      return;
    }
    if (this.pts.size > 2) return;
    this.startDrag(e.clientX, e.clientY, e.timeStamp);
  }

  startDrag(x, y, t, moved = false) {
    this.drag = { mode: moved ? 'pan' : null, moved, x0: x, y0: y, lastX: x, lastY: y, lastT: t, vx: 0, vy: 0, info0: this.info, tx0: this.zoom.tx, ty0: this.zoom.ty };
  }

  onMove(e) {
    const pt = this.pts.get(e.pointerId);
    if (!pt) return;
    pt.x = e.clientX;
    pt.y = e.clientY;
    const d = this.drag;
    if (!d) return;
    const cur = this.slides[this.index];
    if (d.mode === 'pinch') {
      if (this.pts.size < 2) return;
      const [a, b] = [...this.pts.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const s = clamp((d.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / d.d0, 0.6, MAX_ZOOM * 1.4);
      this.zoom = { s, tx: mx - cur.fit.x - s * d.lx, ty: my - cur.fit.y - s * d.ly };
      this.apply();
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      d.vx = lerp(d.vx, (x - d.lastX) / dt, 0.6);
      d.vy = lerp(d.vy, (y - d.lastY) / dt, 0.6);
    }
    d.lastX = x;
    d.lastY = y;
    d.lastT = e.timeStamp;
    const dx = x - d.x0;
    const dy = y - d.y0;
    if (!d.mode) {
      if (Math.hypot(dx, dy) < 8) return;
      d.moved = true;
      const horiz = Math.abs(dx) > Math.abs(dy);
      if (this.zoom.s > 1.01) {
        // đang phóng to: kéo để xem các góc; chạm mép ảnh rồi kéo tiếp theo chiều ngang → sang ảnh khác
        const b = this.bounds(cur, this.zoom.s);
        const atEdge = horiz && ((dx > 0 && this.zoom.tx >= b.x1 - 1) || (dx < 0 && this.zoom.tx <= b.x0 + 1));
        d.mode = atEdge ? 'page' : 'pan';
      } else if (horiz) d.mode = 'page';
      else if (dy < 0 || this.info > 0.02) d.mode = 'info';
      else {
        d.mode = 'pull';
        this.el.classList.add('pulling');
        this.hint.classList.remove('show');
      }
    }
    if (d.mode === 'page') {
      const n = this.slides.length;
      const edge = (this.index === 0 && dx > 0) || (this.index === n - 1 && dx < 0);
      this.dx = edge ? rubber(dx, this.vw) : dx;
    } else if (d.mode === 'info') {
      const tr = this.travel();
      let p = d.info0 - dy / tr;
      if (p > 1) p = 1 + rubber((p - 1) * tr, this.vh) / tr;
      this.info = Math.max(0, p);
      this.hint.classList.remove('show');
    } else if (d.mode === 'pull') {
      this.pull = { x: dx, y: dy > 0 ? dy : rubber(dy, this.vh) * 0.4 };
    } else if (d.mode === 'pan') {
      const b = this.bounds(cur, this.zoom.s);
      const band = (v, lo, hi, dim) => (v < lo ? lo + rubber(v - lo, dim) : v > hi ? hi + rubber(v - hi, dim) : v);
      this.zoom.tx = band(d.tx0 + dx, b.x0, b.x1, this.vw);
      this.zoom.ty = band(d.ty0 + dy, b.y0, b.y1, this.vh);
    }
    this.apply();
  }

  onUp(e) {
    if (!this.pts.has(e.pointerId)) return;
    this.pts.delete(e.pointerId);
    const d = this.drag;
    if (d?.mode === 'pinch') {
      if (this.pts.size === 1) {
        // nhấc 1 ngón: ngón còn lại tiếp tục kéo ảnh
        const [p] = [...this.pts.values()];
        this.startDrag(p.x, p.y, e.timeStamp, true);
      } else if (this.pts.size === 0) {
        this.drag = null;
        this.settleZoom();
      }
      return;
    }
    if (this.pts.size > 0 || !d) return;
    this.drag = null;
    if (!d.moved) {
      this.tap(e.clientX, e.clientY, e.timeStamp);
      return;
    }
    this.setAnim(true);
    if (d.mode === 'page') {
      const th = this.vw * 0.22;
      let k = this.index;
      if (this.dx < -th || d.vx < -0.35) k++;
      else if (this.dx > th || d.vx > 0.35) k--;
      this.dx = 0;
      if (k !== this.index && k >= 0 && k < this.slides.length) this.setIndex(k);
    } else if (d.mode === 'info') {
      this.info = Math.abs(d.vy) > 0.3 ? (d.vy < 0 ? 1 : 0) : this.info > 0.4 ? 1 : 0;
    } else if (d.mode === 'pull') {
      this.el.classList.remove('pulling');
      if (this.pull.y > 110 || d.vy > 0.5) {
        this.ctx.onClose();
        return;
      }
      this.pull = null;
    } else if (d.mode === 'pan') {
      this.settleZoom(); // cũng thu lại mức phóng nếu vừa chụm quá tay
      return;
    }
    this.apply();
  }

  tap(x, y, t) {
    const last = this.lastTap;
    if (last && t - last.t < 300 && Math.hypot(x - last.x, y - last.y) < 30) {
      clearTimeout(this.tapT);
      this.lastTap = null;
      this.doubleTap(x, y);
      return;
    }
    this.lastTap = { t, x, y };
    clearTimeout(this.tapT);
    this.tapT = setTimeout(() => {
      this.lastTap = null;
      if (this.info > 0.5) this.setInfo(false);
      else this.el.classList.toggle('bare');
    }, 260);
  }

  doubleTap(x, y) {
    if (this.info > 0.02) return;
    const cur = this.slides[this.index];
    this.setAnim(true);
    if (this.zoom.s > 1.01) this.zoom = { s: 1, tx: 0, ty: 0 };
    else {
      const s = 2.5;
      this.zoom = this.clampZoom({ s, tx: (x - cur.fit.x) * (1 - s), ty: (y - cur.fit.y) * (1 - s) });
      this.upgrade(cur);
    }
    this.apply();
  }

  // khoảng dịch hợp lệ khi phóng to: ảnh nhỏ hơn màn → căn giữa, lớn hơn → không hở mép
  bounds(cur, s) {
    const W = cur.fit.w * s;
    const H = cur.fit.h * s;
    const ax = W <= this.vw ? [(this.vw - W) / 2 - cur.fit.x] : [this.vw - W - cur.fit.x, -cur.fit.x];
    const ay = H <= this.vh ? [(this.vh - H) / 2 - cur.fit.y] : [this.vh - H - cur.fit.y, -cur.fit.y];
    return { x0: ax[0], x1: ax[1] ?? ax[0], y0: ay[0], y1: ay[1] ?? ay[0] };
  }
  clampZoom(z) {
    if (z.s <= 1.01) return { s: 1, tx: 0, ty: 0 };
    const b = this.bounds(this.slides[this.index], z.s);
    return { s: z.s, tx: clamp(z.tx, b.x0, b.x1), ty: clamp(z.ty, b.y0, b.y1) };
  }
  settleZoom() {
    const cur = this.slides[this.index];
    let { s, tx, ty } = this.zoom;
    if (s > MAX_ZOOM) {
      // thu về mức tối đa quanh tâm màn hình
      const cx = this.vw / 2 - cur.fit.x;
      const cy = this.vh / 2 - cur.fit.y;
      tx = cx - (MAX_ZOOM * (cx - tx)) / s;
      ty = cy - (MAX_ZOOM * (cy - ty)) / s;
      s = MAX_ZOOM;
    }
    this.setAnim(true);
    this.zoom = this.clampZoom({ s, tx, ty });
    this.apply();
  }
}
