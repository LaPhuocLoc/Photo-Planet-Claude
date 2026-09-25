// Giao diện DOM: intro, HUD, album ảnh, nhật ký, pin bản đồ, toast.
import META from '../data/photo-meta.json';

const $ = (id) => document.getElementById(id);
const photoUrl = (id) => `photos/${id}.webp`;
const midUrl = (id) => `photos/${id}-1200.webp`;
const thumbUrl = (id) => `photos/${id}-thumb.webp`;
const SRCSET = (id) => `${midUrl(id)} 1200w, ${photoUrl(id)} 2000w`;
const SIZES = '(max-width: 860px) 100vw, 75vw';

// Tải + giải mã ảnh trước; trả về Promise<url thực sự đã chọn>. Có cache để không tải lại.
const photoCache = new Map();
export function preloadPhoto(id) {
  if (photoCache.has(id)) return photoCache.get(id);
  const img = new Image();
  img.decoding = 'async';
  img.sizes = SIZES;
  img.srcset = SRCSET(id);
  img.src = photoUrl(id);
  const p = (img.decode ? img.decode() : new Promise((res, rej) => ((img.onload = res), (img.onerror = rej))))
    .then(() => img.currentSrc || img.src)
    .catch(() => {
      photoCache.delete(id); // lỗi mạng: lần sau thử lại
      return photoUrl(id);
    });
  photoCache.set(id, p);
  return p;
}

const CAMERA_NAMES = { 'ILCE-7M5': 'Sony α7 V', 'ILCE-7M4': 'Sony α7 IV', 'ILCE-7CM2': 'Sony α7C II' };
const lensName = (l) => (l ? l.replace(/\s*\d{3}$/, '').replace('Contemporary', 'C') : null);
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Tokyo', day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

export class UI {
  constructor(trip, handlers) {
    this.trip = trip;
    this.h = handlers;
    this.places = trip.places;
    this.discovered = new Set(this.load());
    this.gallery = { open: false, place: null, index: 0 };
    this.pinEls = new Map();
    this.currentTitle = null;

    $('intro-name').textContent = trip.title;
    $('intro-jp').textContent = trip.titleJp;
    $('intro-meta').textContent = `${trip.region} · ${trip.dates}`;
    $('intro-text').textContent = trip.intro;
    $('trip-name').textContent = trip.title;
    $('trip-jp').textContent = trip.titleJp;
    $('j-title').textContent = `${trip.title} · ${trip.titleJp}`;
    document.body.classList.add('intro-on');

    this.buildPins();
    this.buildJournal();
    this.updateProgress();
    this.bind();
  }

  // ── lưu trạng thái đã khám phá (per-browser) ──────────────
  key() {
    return `photo-planet:${this.trip.id}:discovered`;
  }
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.key()) || '[]');
    } catch {
      return [];
    }
  }
  save() {
    try {
      localStorage.setItem(this.key(), JSON.stringify([...this.discovered]));
    } catch {
      /* private mode: bỏ qua */
    }
  }

  bind() {
    $('start').addEventListener('click', () => this.h.onStart());
    $('btn-map').addEventListener('click', () => this.h.onToggleMap());
    $('btn-journal').addEventListener('click', () => this.toggleJournal());
    $('trip-chip').addEventListener('click', () => this.toggleJournal());
    $('j-close').addEventListener('click', () => this.toggleJournal(false));
    $('btn-music').addEventListener('click', () => this.h.onToggleMusic());
    $('btn-full').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    $('prompt').addEventListener('click', () => this.h.onInteract());
    $('g-close').addEventListener('click', () => this.closeGallery());
    $('g-prev').addEventListener('click', () => this.step(-1));
    $('g-next').addEventListener('click', () => this.step(1));
    $('gallery').addEventListener('click', (e) => {
      if (e.target === $('gallery')) this.closeGallery();
    });
    // vuốt trái/phải trong album
    let sx = null;
    const stage = $('g-stage');
    stage.addEventListener('pointerdown', (e) => (sx = e.clientX));
    stage.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 50) this.step(dx < 0 ? 1 : -1);
      sx = null;
    });
    window.addEventListener('resize', () => this.gallery.open && this.fitPhoto());
    window.addEventListener('keydown', (e) => {
      if (!this.gallery.open) return;
      if (e.key === 'ArrowRight') this.step(1);
      else if (e.key === 'ArrowLeft') this.step(-1);
    });
  }

  ready() {
    const b = $('start');
    b.disabled = false;
    b.querySelector('.label').textContent = 'Bắt đầu khám phá';
  }
  hideIntro() {
    $('intro').classList.add('gone');
    document.body.classList.remove('intro-on');
    setTimeout(() => $('intro').remove(), 1000);
  }

  setMusic(on) {
    $('btn-music').classList.toggle('off', !on);
  }
  setMapActive(on) {
    $('btn-map').classList.toggle('on', on);
  }

  showHint(text, ms = 9000) {
    const el = $('hint');
    el.textContent = text;
    el.classList.remove('fade');
    clearTimeout(this.hintT);
    this.hintT = setTimeout(() => el.classList.add('fade'), ms);
  }

  toast(text, ms = 2600) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => el.classList.remove('show'), ms);
  }

  flash() {
    const el = $('flash');
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  // ── tên địa điểm góc dưới trái ─────────────────────────────
  setPlaceTitle(place) {
    const id = place?.id ?? null;
    if (id === this.currentTitle) return;
    this.currentTitle = id;
    const el = $('place-title');
    if (!place) {
      el.classList.remove('show');
      return;
    }
    el.classList.remove('show');
    clearTimeout(this.titleT);
    this.titleT = setTimeout(() => {
      $('pt-name').textContent = place.name;
      $('pt-jp').textContent = place.nameJp;
      el.classList.add('show');
    }, 250);
  }

  setPrompt(screen) {
    const el = $('prompt');
    if (!screen || this.gallery.open) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.classList.toggle('dock', !!screen.dock);
    el.style.transform = screen.dock ? '' : `translate(${screen.x}px, ${screen.y}px)`;
  }

  // ── pin trên bản đồ hành tinh ─────────────────────────────
  buildPins() {
    const wrap = $('pins');
    this.places.forEach((p, i) => {
      const el = document.createElement('button');
      el.className = 'pin';
      el.innerHTML = `<span class="n">${i + 1}</span><span>${p.name.split(' · ')[0]}</span>`;
      el.addEventListener('click', () => this.h.onTravel(p.id));
      wrap.appendChild(el);
      this.pinEls.set(p.id, el);
    });
  }
  updatePins(list, alpha) {
    for (const { id, x, y, visible } of list) {
      const el = this.pinEls.get(id);
      const a = visible ? alpha : 0;
      el.style.opacity = a;
      el.style.pointerEvents = a > 0.5 ? 'auto' : 'none';
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.classList.toggle('done', this.discovered.has(id));
    }
  }

  // ── nhật ký ────────────────────────────────────────────────
  buildJournal() {
    const list = $('j-list');
    list.innerHTML = '';
    this.places.forEach((p, i) => {
      const li = document.createElement('li');
      const done = this.discovered.has(p.id);
      const date = fmtDate(META[p.photos[0]?.id]?.date);
      li.innerHTML = `
        <button class="j-item ${done ? 'done' : 'locked'}">
          <img src="${thumbUrl(p.photos[0].id)}" alt="" loading="lazy" />
          <span>
            <div class="c">CHẶNG ${i + 1}${date ? ` · ${date}` : ''}</div>
            <div class="t">${p.name}</div>
            <div class="s">${p.nameJp} · ${p.photos.length} ảnh</div>
          </span>
          <span class="ok">${done ? '✓' : '?'}</span>
        </button>`;
      li.querySelector('button').addEventListener('click', () => {
        this.toggleJournal(false);
        this.h.onTravel(p.id);
      });
      list.appendChild(li);
    });
  }
  toggleJournal(force) {
    const el = $('journal');
    const open = force ?? el.hidden;
    el.hidden = !open;
    if (open) this.buildJournal();
  }
  get journalOpen() {
    return !$('journal').hidden;
  }

  updateProgress() {
    const n = this.discovered.size;
    const total = this.places.length;
    $('trip-progress').textContent = `${n}/${total}`;
    $('j-bar').style.width = `${(n / total) * 100}%`;
  }

  // ── album ảnh ──────────────────────────────────────────────
  openGallery(placeId, index = 0) {
    const place = this.places.find((p) => p.id === placeId);
    if (!place) return;
    const i = this.places.indexOf(place);
    this.gallery = { open: true, place, index };
    $('gallery').hidden = false;
    $('g-chapter').textContent = `Chặng ${i + 1} / ${this.places.length}`;
    $('g-title').textContent = place.name;
    $('g-jp').textContent = place.nameJp;
    $('g-blurb').textContent = place.blurb;
    const strip = $('g-strip');
    strip.innerHTML = '';
    strip.hidden = place.photos.length < 2;
    place.photos.forEach((ph, k) => {
      const b = document.createElement('button');
      b.innerHTML = `<img src="${thumbUrl(ph.id)}" alt="" />`;
      b.addEventListener('click', () => this.show(k));
      strip.appendChild(b);
    });
    this.show(index, true);
    this.setPrompt(null);

    if (!this.discovered.has(place.id)) {
      this.discovered.add(place.id);
      this.save();
      this.updateProgress();
      const st = $('stamp');
      st.classList.remove('go');
      void st.offsetWidth;
      st.classList.add('go');
      this.h.onDiscover?.(place, this.discovered.size, this.places.length);
    }
  }

  show(k, first = false) {
    const { place } = this.gallery;
    const n = place.photos.length;
    k = (k + n) % n;
    this.gallery.index = k;
    const ph = place.photos[k];
    const meta = META[ph.id] || {};
    const full = $('g-full');
    const thumb = $('g-thumb');
    const frame = $('g-frame');
    const token = (this.loadToken = (this.loadToken ?? 0) + 1);
    const loading = preloadPhoto(ph.id);
    const load = () => {
      if (token !== this.loadToken) return;
      full.classList.remove('ready');
      frame.classList.remove('has-full');
      full.removeAttribute('src');
      thumb.src = thumbUrl(ph.id);
      thumb.classList.remove('swap');
      full.classList.remove('swap');
      frame.classList.add('loading');
      loading.then((url) => {
        if (token !== this.loadToken) return; // người dùng đã chuyển ảnh khác
        full.src = url;
        full.alt = ph.caption || place.name;
        const done = () => {
          if (token !== this.loadToken) return;
          full.classList.add('ready');
          frame.classList.remove('loading');
          // chỉ ẩn thumbnail khi ảnh nét đã hiện hẳn (hết transition), có dự phòng timeout
          const hideThumb = () => token === this.loadToken && full.classList.contains('ready') && frame.classList.add('has-full');
          full.addEventListener('transitionend', hideThumb, { once: true });
          setTimeout(hideThumb, 900);
        };
        if (full.complete && full.naturalWidth) done();
        else {
          full.onload = done;
          full.onerror = done;
        }
      });
    };
    if (first) load();
    else {
      thumb.classList.add('swap');
      full.classList.add('swap');
      setTimeout(load, 160);
    }
    this.ratio = meta.w && meta.h ? meta.w / meta.h : 1.5;
    this.fitPhoto();
    $('g-caption').textContent = ph.caption || '';
    const rows = [
      ['Máy', CAMERA_NAMES[meta.camera] || meta.camera, true],
      ['Ống kính', lensName(meta.lens), true],
      ['Tiêu cự', meta.focal && `${meta.focal}mm`],
      ['Khẩu', meta.f && `ƒ/${meta.f}`],
      ['Tốc', meta.shutter],
      ['ISO', meta.iso],
      ['Ngày', fmtDate(meta.date), true],
    ].filter((r) => r[1]);
    $('g-exif').innerHTML = rows.map(([k2, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${k2}</dt><dd>${v}</dd></div>`).join('');
    [...$('g-strip').children].forEach((b, i) => b.classList.toggle('on', i === k));
    $('g-prev').disabled = $('g-next').disabled = n < 2;
    // tải trước ảnh kế
    if (n > 1) preloadPhoto(place.photos[(k + 1) % n].id);
  }

  // khung ảnh đúng tỉ lệ ảnh gốc, vừa khít vùng hiển thị
  fitPhoto() {
    const st = $('g-stage');
    const cs = getComputedStyle(st);
    const aw = st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 24;
    const ah = st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 24;
    let w = aw;
    let h = aw / this.ratio;
    if (h > ah) {
      h = ah;
      w = ah * this.ratio;
    }
    const fr = $('g-frame');
    fr.style.width = `${Math.max(0, Math.floor(w))}px`;
    fr.style.height = `${Math.max(0, Math.floor(h))}px`;
  }

  // gọi khi người chơi tới gần 1 địa điểm: tải sẵn ảnh để bấm E là thấy nét ngay
  preloadPlace(id) {
    const p = this.places.find((q) => q.id === id);
    p?.photos.forEach((ph, i) => setTimeout(() => preloadPhoto(ph.id), i * 150));
  }

  step(d) {
    if (!this.gallery.open) return;
    this.show(this.gallery.index + d);
  }

  closeGallery() {
    if (!this.gallery.open) return;
    this.gallery.open = false;
    $('gallery').hidden = true;
    this.h.onGalleryClose?.();
  }
}
