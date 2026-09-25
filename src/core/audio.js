// Âm thanh nền tự sinh bằng WebAudio (không cần file): sóng biển + chuông gió ngũ cung.
export class Ambience {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // sóng biển: brown noise → lowpass, âm lượng dâng hạ chậm
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.22;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.16;
    lfo.connect(lfoGain).connect(waveGain.gain);
    noise.connect(lp).connect(waveGain).connect(this.master);
    noise.start();
    lfo.start();

    // delay "phòng" cho chuông
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.master);

    this.scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const loop = () => {
      if (this.on) this.chime();
      this.timer = setTimeout(loop, 1800 + Math.random() * 3200);
    };
    loop();
    // pad trầm nhẹ
    this.pad();
  }

  pad() {
    const ctx = this.ctx;
    const notes = [130.81, 196.0, 246.94];
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    g.connect(f).connect(this.master);
    for (const n of notes) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = n;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(g);
      o.start();
    }
  }

  chime(freq) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = freq ?? this.scale[Math.floor(Math.random() * this.scale.length)];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.master);
    g.connect(this.delay);
    o.start(t);
    o2.start(t);
    o.stop(t + 3);
    o2.stop(t + 3);
  }

  shutter() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [dt, dur, fq] of [[0, 0.03, 3200], [0.07, 0.04, 2200]]) {
      const len = Math.floor(ctx.sampleRate * dur);
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const s = ctx.createBufferSource();
      s.buffer = b;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      s.connect(bp).connect(g).connect(this.master);
      s.start(t + dt);
    }
  }

  discover() {
    if (!this.ctx || !this.on) return;
    [659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.chime(f), i * 140));
  }

  setOn(on) {
    this.on = on;
    if (!this.ctx) this.start();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, t, 0.6);
  }
}
