// Timos Turbo Run – ein Endlos-Lauf-Spiel mit Timo
'use strict';

// ---------- Speicher (localStorage, abgesichert) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('ttr_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ttr_' + k, JSON.stringify(v)); } catch (e) {} }
};
const save = {
  kk: store.get('kk', 0),
  up: Object.assign({ magnet: 0, shield: 0, turbo: 0, fax: 0 }, store.get('up', {})),
  inv: Object.assign({ startShield: 0, startTurbo: 0 }, store.get('inv', {})),
  best: store.get('best', []),
  name: store.get('name', ''),
  mute: store.get('mute', false),
  tilt: store.get('tilt', true),
  tutDone: store.get('tutDone', false),
};
function persist() { store.set('kk', save.kk); store.set('up', save.up); store.set('inv', save.inv); store.set('best', save.best); store.set('name', save.name); store.set('mute', save.mute); store.set('tilt', save.tilt); store.set('tutDone', save.tutDone); }

// ---------- Konstanten ----------
const HW = 1.8, LANE = 1.2, CAM_BACK = 3.4, CAM_H = 2.5, VIEW = 75, NEAR = 0.12;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // Index +1 = rechts abbiegen

const THEMES = [
  { key: 'park', name: 'Im Stadtpark', sign: 'STADTPARK', signBg: '#3e9a3a', signFg: '#fff',
    outdoor: true, sky: ['#5fb4f0', '#cdeeff'], ground: '#58b046', fog: [205, 232, 250],
    floor: [[216, 182, 120], [204, 168, 104]], edge: [170, 130, 80],
    wall: { h: 0.85, front: [62, 140, 56], top: [96, 182, 84], dark: [44, 108, 40] } },
  { key: 'amt', name: 'Auf dem Bürgeramt', sign: 'BÜRGERAMT', signBg: '#d8d4c0', signFg: '#223',
    outdoor: false, fog: [70, 72, 64], ceil: [214, 214, 204], lamp: [255, 252, 220],
    floor: [[204, 202, 180], [158, 176, 146]], wall: { h: 3, low: [128, 156, 122], high: [232, 224, 196], line: [90, 110, 86] } },
  { key: 'sofa', name: 'Im Sofa-Paradies', sign: 'SOFA-PARADIES', signBg: '#e8572e', signFg: '#fff',
    outdoor: false, fog: [96, 84, 72], ceil: [238, 234, 226], lamp: [255, 246, 200],
    floor: [[214, 176, 128], [198, 160, 112]], wall: { h: 3, low: [112, 72, 44], high: [240, 232, 214], line: [226, 214, 192] } },
];

const PU_INFO = {
  magnet: { name: 'Magnet', base: 6, per: 2 },
  shield: { name: 'Schild', base: 8, per: 2.5 },
  turbo: { name: 'Espresso-Turbo', base: 3, per: 0.8 },
  fax: { name: 'Faxmaschine', base: 6, per: 1.5 },
};
function puDur(k) { return PU_INFO[k].base + PU_INFO[k].per * save.up[k]; }

// ---------- Canvas ----------
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = 320, H = 240, focal = 200, horizon = 90;
function resize() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const short = Math.min(sw, sh), target = 300;
  const k = target / short;
  W = Math.round(sw * k); H = Math.round(sh * k);
  cv.width = W; cv.height = H;
  const portrait = sh > sw;
  horizon = Math.round(H * (portrait ? 0.40 : 0.34));
  focal = Math.min(W * 0.82, (H - horizon) * 1.0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

// ---------- Hilfen ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function rgb(c, fogC, t) {
  if (t > 0) c = [lerp(c[0], fogC[0], t), lerp(c[1], fogC[1], t), lerp(c[2], fogC[2], t)];
  return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
}
function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

// ---------- Ton ----------
let actx = null;
function audioUnlock() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  if (actx) { loadBark(); loadApplause(); }
}
function beep(freq, dur, type, vol, slide) {
  if (save.mute || !actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  coin() { beep(1320, 0.07, 'square', 0.05); setTimeout(() => beep(1760, 0.08, 'square', 0.05), 50); },
  jump() { beep(300, 0.18, 'square', 0.06, 700); },
  slide() { beep(500, 0.18, 'sawtooth', 0.04, 150); },
  turn() { beep(660, 0.06, 'triangle', 0.07); },
  hit() { beep(160, 0.3, 'sawtooth', 0.1, 60); },
  power() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'square', 0.06), i * 70)); },
  fax() { for (let i = 0; i < 8; i++) setTimeout(() => beep(rnd(900, 2400), 0.06, 'square', 0.04), i * 60); },
  over() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'triangle', 0.09), i * 180)); },
  level() { [392, 523, 659, 784, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'square', 0.05), i * 90)); },
};

function noiseBurst(dur, freq, vol) {
  if (save.mute || !actx) return;
  const t = actx.currentTime, n = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  const gn = actx.createGain(); gn.gain.value = vol;
  src.connect(f); f.connect(gn); gn.connect(actx.destination); src.start(t);
}
// Bellen: kurzer, heller Hundebeller (an die Vorlage angelehnt, selbst erzeugt)
function barkOnce(pitch) {
  if (save.mute || !actx) return;
  const t = actx.currentTime, p = pitch || 1;
  const out = actx.createGain(); out.gain.value = 0.9; out.connect(actx.destination);
  // Stimme: Sägezahn mit schnellem Tonhöhen-Abfall durch zwei Formant-Filter
  const o = actx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(380 * p, t); o.frequency.linearRampToValueAtTime(620 * p, t + 0.025); o.frequency.exponentialRampToValueAtTime(240 * p, t + 0.16);
  const f1 = actx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900 * p; f1.Q.value = 3;
  const f2 = actx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2200 * p; f2.Q.value = 4;
  const gv = actx.createGain(); gv.gain.setValueAtTime(0.0001, t); gv.gain.exponentialRampToValueAtTime(0.5, t + 0.012); gv.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(f1); o.connect(f2); f1.connect(gv); f2.connect(gv); gv.connect(out);
  o.start(t); o.stop(t + 0.2);
  // Rauheit: gefiltertes Rauschen
  const n = Math.floor(actx.sampleRate * 0.15), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = actx.createBufferSource(); src.buffer = buf;
  const nf = actx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1500 * p; nf.Q.value = 1.5;
  const gn = actx.createGain(); gn.gain.value = 0.35;
  src.connect(nf); nf.connect(gn); gn.connect(out); src.start(t);
}
// Timos echtes Bellen (Aufnahme vom Besitzer), sonst Ersatz-Beller
let barkBuf = null, barkLoading = false;
function loadBark() {
  if (barkBuf || barkLoading || !actx) return;
  barkLoading = true;
  fetch('assets/bellen.mp3?v=5').then(r => r.arrayBuffer())
    .then(ab => new Promise((res, rej) => actx.decodeAudioData(ab, res, rej)))
    .then(b => { barkBuf = b; }).catch(() => { barkLoading = false; });
}
sfx.bark = function () {
  if (save.mute || !actx) return;
  loadBark();
  if (barkBuf) {
    const src = actx.createBufferSource(); src.buffer = barkBuf;
    src.playbackRate.value = rnd(0.95, 1.08);
    const gn = actx.createGain(); gn.gain.value = 0.9;
    src.connect(gn); gn.connect(actx.destination); src.start();
  } else { barkOnce(1); setTimeout(() => barkOnce(1.08), 230); }
};
// Applaus (gefiltertes Rauschen als viele kleine Klatscher)
let applBuf = null;
function loadApplause() {
  if (applBuf || !actx) return;
  applBuf = 'loading';
  fetch('assets/applaus.mp3?v=6').then(r => r.arrayBuffer()).then(ab => new Promise((res, rej) => actx.decodeAudioData(ab, res, rej)))
    .then(b => { applBuf = b; }).catch(() => { applBuf = null; });
}
sfx.applause = function () {
  if (save.mute || !actx) return;
  if (applBuf && applBuf !== 'loading') {
    const src = actx.createBufferSource(); src.buffer = applBuf; const gn = actx.createGain(); gn.gain.value = 0.9;
    src.connect(gn); gn.connect(actx.destination); src.start(); return;
  }
  const t0 = actx.currentTime, n = Math.floor(actx.sampleRate * 0.02);
  const buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  for (let i = 0; i < 140; i++) {
    const t = t0 + Math.random() * 2.6, src = actx.createBufferSource(); src.buffer = buf;
    const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(900, 2600); f.Q.value = 0.8;
    const gn = actx.createGain(); gn.gain.value = 0.25 * (1 - (t - t0) / 3.2);
    src.connect(f); f.connect(gn); gn.connect(actx.destination); src.start(t);
  }
  [523, 659, 784, 1046, 784, 1046].forEach((fq, i) => setTimeout(() => beep(fq, 0.14, 'square', 0.05), i * 110));
};

// ---------- Musik (selbst komponierte Chiptune-Schleifen) ----------
const SONGS = {
  park: { bpm: 150, root: 60, mel: [0, null, 4, 7, 12, null, 7, 4, 5, null, 9, 12, 9, null, 5, null, 7, null, 11, 14, 12, null, 7, 4, 5, 4, 2, null, 0, null, null, null],
    bass: [0, 0, 5, 5, 7, 7, 0, 0] },
  amt: { bpm: 126, root: 57, mel: [0, null, 3, null, 7, null, 3, null, 5, null, 8, null, 7, 5, 3, null, 2, null, 5, null, 8, null, 7, 5, 3, 2, 0, null, -2, null, 0, null],
    bass: [0, 0, 5, 5, 3, 3, 7, 7] },
  sofa: { bpm: 132, root: 65, mel: [7, null, 4, null, 2, 4, null, 0, 9, null, 7, null, 4, null, null, null, 5, null, 9, null, 12, 11, 9, 7, 4, null, 2, null, 0, null, null, null],
    bass: [0, 0, 9, 9, 5, 5, 7, 7] },
};
const music = {
  song: null, step: 0, next: 0, timer: null,
  start(key) {
    this.song = SONGS[key]; this.step = 0;
    if (!actx) return;
    this.next = actx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 60);
  },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  tick() {
    if (!actx || !this.song) return;
    const s = this.song, dur = 60 / s.bpm / 2;
    while (this.next < actx.currentTime + 0.25) {
      if (!save.mute) {
        const m = s.mel[this.step % 32];
        if (m !== null) this.note(s.root + m + 12, this.next, dur * 0.9, 'square', 0.025);
        const b = s.bass[Math.floor(this.step / 4) % 8];
        this.note(s.root + b - 12 + (this.step % 2 ? 12 : 0), this.next, dur * 0.8, 'triangle', 0.07);
        if (this.step % 2 === 1) this.hat(this.next);
      }
      this.next += dur; this.step++;
    }
  },
  note(midi, t, dur, type, vol) {
    const o = actx.createOscillator(), gn = actx.createGain();
    o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  hat(t) {
    if (!this.hatBuf) { const n = Math.floor(actx.sampleRate * 0.03); this.hatBuf = actx.createBuffer(1, n, actx.sampleRate); const d = this.hatBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); }
    const src = actx.createBufferSource(); src.buffer = this.hatBuf;
    const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const gn = actx.createGain(); gn.gain.value = 0.05;
    src.connect(f); f.connect(gn); gn.connect(actx.destination); src.start(t);
  },
};

// ---------- Strecke ----------
let levelStarts = [0];
function levelAt(dist) {
  while (levelStarts[levelStarts.length - 1] <= dist + 2000) {
    const n = levelStarts.length;
    levelStarts.push(levelStarts[n - 1] + 700 + 100 * n);
  }
  let i = 0; while (levelStarts[i + 1] <= dist) i++;
  return i;
}

// Jede Runde (Park → Amt → Sofa) wird ein Hauch schneller und schwieriger
function roundOf(dist) { return Math.floor(levelAt(dist) / 3); }
function roundMul(dist) { return 1 + Math.min(0.5, 0.07 * roundOf(dist)); }
function segSpeed(d) { return (9 + 12 * (1 - Math.exp(-d / 1800))) * roundMul(d); }
function makeSeg(sx, sz, dirIdx, startDist, opts) {
  opts = opts || {};
  const d = DIRS[dirIdx], r = DIRS[(dirIdx + 1) % 4];
  const level = levelAt(startDist);
  const seg = {
    sx, sz, dirIdx, dx: d[0], dz: d[1], rx: r[0], rz: r[1],
    L: opts.L || Math.round(rint(48, 90) * clamp(segSpeed(startDist) / 15, 1, 2)), startDist, level, theme: THEMES[level % 3],
    exits: opts.exits || pick(['L', 'R', 'L', 'R', 'T']),
    obs: [], coins: [], pus: [], deco: [], gate: false, next: null, y0: opts.y0 || 0, hills: [],
  };
  const prevLevel = opts.prevLevel;
  if (prevLevel !== undefined && prevLevel !== level) seg.gate = true;
  if (opts.tut) tutorialSeg(seg); else populate(seg, opts.first);
  return seg;
}

const SOFA_COLS = [[20, 160, 170], [220, 40, 100], [50, 90, 220], [245, 140, 20], [120, 60, 190], [40, 170, 80]];
const SOFA_PRICES = ['199€', '299€', '499€', '99€', '1.299€', '799€'];
const OB = { // Hindernis-Arten pro Thema
  park: {
    low: { name: 'Hecke', h: 0.62, c: [70, 150, 60], top: [110, 190, 90], kind: 'hedge' },
    high: { name: 'Rosenbogen', y0: 0.95, c: [120, 80, 40], top: [200, 90, 120], kind: 'arch' },
    hydrant: { name: 'Hydrant', h: 0.95, c: [210, 40, 30], top: [240, 80, 60], kind: 'hydrant', w: 0.8 },
    block: [{ name: 'Parkbank', h: 0.7, c: [150, 96, 50], top: [180, 120, 66], kind: 'bench' },
            { name: 'Hydrant', h: 0.95, c: [210, 40, 30], top: [240, 80, 60], kind: 'hydrant', w: 0.8 },
            { name: 'Baum', h: 9, c: [110, 70, 36], top: [90, 56, 30], kind: 'tree', w: 0.95 },
            { name: 'Baum', h: 9, c: [110, 70, 36], top: [90, 56, 30], kind: 'tree', w: 0.95 },
            { name: 'Baum', h: 9, c: [110, 70, 36], top: [90, 56, 30], kind: 'tree', w: 0.95 }],
  },
  amt: {
    low: { name: 'Aktenstapel', h: 0.6, c: [230, 220, 190], top: [250, 245, 230], kind: 'files' },
    high: { name: 'Absperrband', y0: 0.95, c: [220, 40, 40], top: [250, 250, 250], kind: 'tape' },
    block: [{ name: 'Kopierer', h: 1.4, c: [180, 184, 190], top: [120, 124, 130], kind: 'copier', w: 1.0 },
            { name: 'Wartestühle', h: 0.75, c: [60, 90, 160], top: [80, 110, 190], kind: 'chairs' }],
  },
  sofa: {
    low: { name: 'Kissenberg', h: 0.6, c: [240, 200, 80], top: [250, 230, 140], kind: 'pillows' },
    high: { name: 'Teppichrolle', y0: 0.95, c: [150, 60, 120], top: [190, 90, 150], kind: 'rug' },
    block: [{ name: 'Sofa', h: 1.05, c: [20, 160, 170], top: [60, 200, 205], kind: 'sofa', w: 1.1 },
            { name: 'Sessel', h: 1.0, c: [220, 40, 100], top: [245, 90, 140], kind: 'sofa', w: 0.95 },
            { name: 'Ledersessel', h: 1.05, c: [150, 70, 30], top: [190, 100, 50], kind: 'armchair', w: 1.0 }],
  },
};

let distSincePU = 0, distSinceFax = 0;
const HANG_AMT = ['BITTE NUMMER ZIEHEN', 'IHRE NR: 4711', 'ZIMMER 3.17', 'RUHE BITTE', 'FORMULAR A38', 'HUNDESTEUER'];
const HANG_SOFA = ['SALE -70%', 'SOFAS SOFAS SOFAS', 'NUR HEUTE!', 'PROBESITZEN ERLAUBT', 'KUSCHELECKE'];
function populate(seg, first) {
  const T = seg.theme, ob = OB[T.key];
  // Nach einer Kurve erst mal Ruhe, damit man reagieren kann (ca. 1,8 s Laufzeit)
  const rnd_ = roundOf(seg.startDist);
  const expSpeed = (9 + 12 * (1 - Math.exp(-seg.startDist / 1800))) * roundMul(seg.startDist);
  const start = first ? 30 : Math.max(seg.gate ? 18 : 14, expSpeed * 1.6);
  const end = seg.L - HW - Math.max(10, expSpeed * 0.9);
  const diff = clamp(seg.startDist / 2500, 0, 1);
  let a = start;
  while (a < end) {
    const r = Math.random();
    const gapAfter = Math.max(expSpeed * Math.max(1.0, 1.2 - 0.05 * rnd_), lerp(16, 10, diff)) + rnd(0, Math.max(2, 6 - rnd_));
    if (!first && r >= 0.42 && r < 0.53 && a + 14 < end) { // Kipp-Abschnitt: Boden nur auf einer Seite
      const s1 = pick([-1, 1]), len = 11;
      seg.obs.push({ type: 'narrow', a0: a, a1: a + len, side: s1 });
      coinLine(seg, a + 1, s1, 8, 0.45);
      if (a + 2 * len + 18 < end && Math.random() < 0.6) { const sp = Math.max(8, expSpeed * 0.8); seg.obs.push({ type: 'narrow', a0: a + len + sp, a1: a + 2 * len + sp, side: -s1 }); coinLine(seg, a + len + sp + 1, -s1, 8, 0.45); a += len + sp; }
      a += len + gapAfter;
      continue;
    }
    if (!first && r >= 0.53 && r < 0.64) { // Loch / Schlucht -> springen
      const len = lerp(1.8, 2.6, diff) + Math.min(0.6, 0.1 * rnd_);
      seg.obs.push({ type: 'gap', a0: a, a1: a + len });
      coinArc(seg, a + len / 2, rint(-1, 1));
      a += gapAfter;
      continue;
    }
    const curY = seg.y0 + seg.hills.reduce((s2, h) => s2 + h.dh, 0);
    if (!first && r >= 0.64 && r < 0.71 && a + 16 < end) { // bergauf / bergab
      const dh = curY < -3 ? 2.5 : curY > 3 ? -2.5 : pick([-2.5, 2.5]);
      seg.hills.push({ a0: a, a1: a + 14, dh });
      coinLine(seg, a + 1, rint(-1, 1), 8, 0.45);
      a += 14 + gapAfter * 0.6;
      continue;
    }
    if (!first && r >= 0.71 && r < 0.79 && a + 26 < end) { // Rutschpartie bergab: rutschen und kippen
      const len = 22;
      seg.hills.push({ a0: a, a1: a + len, dh: -4 });
      seg.obs.push({ type: 'slide', a0: a, a1: a + len });
      const free = rint(-1, 1);
      for (let k = 0; k < 2; k++) {
        const ba = a + 7 + k * 8, lanes = [-1, 0, 1].filter(l => l !== (k ? -free : free) || l === 0 && false);
        const bl = pick([-1, 0, 1].filter(l => l !== (k ? (free === 0 ? 1 : -free) : free)));
        const o = pick(ob.block);
        seg.obs.push({ type: 'block', a0: ba, a1: ba + 0.8, lane: bl, b: bl * LANE, w: o.w || 1.05, h: Math.max(o.h, 1.2), def: o, c: o.kind === 'sofa' ? pick(SOFA_COLS) : null });
      }
      for (let k = 0; k < 14; k++) seg.coins.push({ a: a + 2 + k * 1.4, b: Math.round(Math.sin(k * 0.55)) * LANE, y: 0.3, got: false });
      a += len + gapAfter;
      continue;
    }
    if (r < 0.22) { // tiefes Hindernis über die ganze Breite -> springen
      const o = ob.low;
      seg.obs.push({ type: 'low', a0: a, a1: a + 0.7, h: o.h, def: o });
      coinArc(seg, a + 0.35, rint(-1, 1));
    } else if (r < 0.40) { // hohes Hindernis -> rutschen
      const o = ob.high;
      seg.obs.push({ type: 'high', a0: a, a1: a + 0.5, y0: o.y0, def: o });
      coinLine(seg, a - 3, rint(-1, 1), 4, 0.35);
    } else if (r < 0.82) { // Spur blockiert
      const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
      const n = Math.random() < Math.min(0.55, lerp(0.06, 0.35, diff) + 0.05 * rnd_) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const o = pick(ob.block);
        const w = o.w || 1.05;
        seg.obs.push({ type: 'block', a0: a, a1: a + (o.kind === 'bench' || o.kind === 'chairs' ? 0.7 : 1.0), lane: lanes[i], b: lanes[i] * LANE, w, h: o.h, def: o,
          c: o.kind === 'sofa' ? pick(SOFA_COLS) : null, price: o.kind === 'sofa' ? pick(SOFA_PRICES) : null });
      }
      coinLine(seg, a - 6, lanes[2], 8, 0.45);
    } else { // nur Kroketten
      coinLine(seg, a, rint(-1, 1), rint(6, 10), 0.45);
    }
    a += gapAfter;
  }
  // Power-Ups
  distSincePU += seg.L; distSinceFax += seg.L;
  if (!first && end > start + 6) {
    let kind = null;
    if (distSinceFax > rnd(550, 900)) { kind = 'fax'; distSinceFax = 0; distSincePU = 0; }
    else if (distSincePU > rnd(220, 380)) { kind = pick(['magnet', 'magnet', 'shield', 'turbo']); distSincePU = 0; }
    if (kind) {
      // Stelle suchen, an der kein Loch, keine einseitige Strecke und kein Hindernis ist
      let pa = start - 4, clear = false;
      for (let tries = 0; tries < 12 && !clear; tries++) {
        pa = rnd(start, end);
        clear = seg.obs.every(o => pa < o.a0 - 3 || pa > (o.a1 || o.a0) + 3);
      }
      const lane = rint(-1, 1);
      seg.pus.push({ a: clear ? pa : start - 4, b: lane * LANE, y: 0.55, kind });
    }
  }
  // Kroketten nicht in Hindernisse legen
  seg.coins = seg.coins.filter(c => c.a > 4 && c.a < seg.L - HW - 3 && !seg.obs.some(o => o.type === 'block' && Math.abs(o.b - c.b) < 0.6 && c.a > o.a0 - 0.6 && c.a < o.a1 + 0.6));
  decorate(seg);
}
function tutorialSeg(seg) {
  const ob = OB.park;
  seg.obs.push({ type: 'low', a0: 32, a1: 32.7, h: ob.low.h, def: ob.low });
  seg.obs.push({ type: 'high', a0: 54, a1: 54.5, y0: ob.high.y0, def: ob.high });
  seg.obs.push({ type: 'block', a0: 76, a1: 76.7, lane: 0, b: 0, w: 1.05, h: ob.block[0].h, def: ob.block[0] });
  coinLine(seg, 12, 0, 8, 0.45); coinArc(seg, 32.35, 0); coinLine(seg, 50, 0, 3, 0.35);
  coinLine(seg, 82, 1, 6, 0.45); coinLine(seg, 82, -1, 6, 0.45);
  decorate(seg);
}
const TUT = [
  { need: 'up', a: 32, d: 3.6, ico: '⬆', txt: 'Wisch nach OBEN, um über die Hecke zu springen!', sub: 'Am Computer: Pfeil ↑ oder Leertaste' },
  { need: 'down', a: 54, d: 3.4, ico: '⬇', txt: 'Wisch nach UNTEN, um unter dem Rosenbogen durchzurutschen!', sub: 'Am Computer: Pfeil ↓' },
  { need: 'side', a: 76, d: 5, ico: '⬅ ➡', txt: 'Wisch nach LINKS oder RECHTS, um der Parkbank auszuweichen!', sub: 'Am Computer: Pfeil ← / →' },
  { need: 'turn', ico: '➡', txt: 'Kurve! Wisch nach RECHTS, um abzubiegen!', sub: 'Verpasst du eine Kurve, rennt Timo gegen die Hecke.' },
];
function coinLine(seg, a, lane, n, y) {
  for (let i = 0; i < n; i++) seg.coins.push({ a: a + i * 1.5, b: lane * LANE, y: y, got: false });
}
function coinArc(seg, a, lane) {
  for (let i = -3; i <= 3; i++) seg.coins.push({ a: a + i * 1.1, b: lane * LANE, y: 0.45 + 1.0 * (1 - (i / 3.5) ** 2), got: false });
}
function decorate(seg) {
  const T = seg.theme.key;
  const from = HW + 1, to = seg.L - HW - 1;
  if (T === 'park') {
    for (let s = -1; s <= 1; s += 2) {
      // Bäume nur dort, wo kein Weg verläuft (nicht in Kreuzungen / Nachbarwegen)
      const open = s < 0 ? (seg.exits === 'L' || seg.exits === 'T') : (seg.exits === 'R' || seg.exits === 'T');
      const tEnd = open ? seg.L - HW - 2.5 : seg.L + HW + 4;
      for (let a = HW + 2.5 + rnd(0, 3); a < tEnd; a += rnd(4, 9)) {
        seg.deco.push({ spr: 'tree', a, b: s * rnd(HW + 2, HW + 7), h: rnd(2.3, 3.2) });
      }
      for (let a = from; a < to; a += rnd(9, 15)) seg.deco.push({ spr: 'lamp', a, b: s * (HW + 0.7), h: 2.6 });
      for (let a = HW + 1 + rnd(0, 3); a < seg.L - HW - 1; a += rnd(2, 5)) seg.deco.push({ spr: 'flower', a, b: s * rnd(HW + 0.6, HW + 2), h: 0.35 });
    }
  } else {
    for (let s = -1; s <= 1; s += 2) {
      // Keine Deko mehr auf dem Laufweg (Pflanzen usw. sahen wie Hindernisse aus)
      if (s > 0) for (let a = from + rnd(6, 14); a < to - 4; a += rnd(18, 30)) seg.deco.push({ hang: pick(T === 'amt' ? HANG_AMT : HANG_SOFA), a });
      // Wandschilder / Bilder
      for (let a = from + rnd(1, 4); a < to - 1; a += (T === 'sofa' ? rnd(2.4, 2.9) : rnd(5, 8))) {
        seg.deco.push({ poster: true, side: s, a, w: rnd(0.8, 1.4), kind: T === 'amt' ? pick(['door', 'poster', 'poster', 'board']) : pick(['display', 'display', 'display', 'display', 'shelf', 'sale']), col: pick(T === 'amt' ? [[90, 130, 190], [220, 200, 120], [200, 90, 80], [120, 170, 120]] : [[240, 200, 80], [90, 150, 210], [240, 240, 220], [130, 200, 140]]) });
      }
    }
  }
}

// ---------- Spielzustand ----------
let state = 'menu';
let run = null;
const cam = { x: 0, z: 0, y: CAM_H, ang: 0 };

function newRun(tut) {
  levelStarts = [0];
  distSincePU = 0; distSinceFax = 300;
  const s0 = tut ? makeSeg(0, 0, 0, 0, { L: 112, first: true, tut: true, exits: 'R' }) : makeSeg(0, 0, 0, 0, { L: 70, first: true });
  run = {
    prev: null, cur: s0,
    pa: 2, pb: 0, lane: 0, py: 0, vy: 0, slideT: 0, fastFall: false,
    dist: 0, coins: 0, time: 0, speed: 9,
    stumbleT: 99, slowT: 0, vetGap: 1.6, vetB: 1.2, vetSay: 'Timo! Impftermin!', vetSayT: 3.5,
    turnQ: null, eff: { magnet: 0, shield: 0, turbo: 0, fax: 0 },
    level: 0, shake: 0, dying: 0, deathCause: null, deathObs: null, lastObs: null,
    parts: [], frame: 0, animT: 0,
    tut: !!tut, tutStep: 0, tutWait: false, vetIntro: tut ? 0 : 3,
  };
  if (tut) { run.vetGap = 9; run.vetSayT = 0; }
  tilt.base = null;
  genExits(run.cur, 2);
  const ang = Math.atan2(s0.dx, s0.dz);
  cam.ang = ang; cam.x = -s0.dx * CAM_BACK; cam.z = -s0.dz * CAM_BACK; cam.ey = 0;
  if (save.inv.startShield > 0) { save.inv.startShield--; run.eff.shield = puDur('shield'); }
  if (save.inv.startTurbo > 0) { save.inv.startTurbo--; run.eff.turbo = 6; }
  persist();
}
function genExits(seg, a0) {
  if (seg.next) return;
  const cx = seg.sx + seg.dx * seg.L, cz = seg.sz + seg.dz * seg.L;
  const sd = (run ? run.dist : 0) + (seg.L - a0);
  seg.next = {};
  if (seg.exits === 'R' || seg.exits === 'T') seg.next.R = makeSeg(cx, cz, (seg.dirIdx + 1) % 4, sd, { prevLevel: seg.level, y0: segEndY(seg) });
  if (seg.exits === 'L' || seg.exits === 'T') seg.next.L = makeSeg(cx, cz, (seg.dirIdx + 3) % 4, sd, { prevLevel: seg.level, y0: segEndY(seg) });
}
function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function elev(seg, a) {
  let y = seg.y0;
  for (const h of seg.hills) y += h.dh * smooth((a - h.a0) / (h.a1 - h.a0));
  return y;
}
function segEndY(seg) { let y = seg.y0; for (const h of seg.hills) y += h.dh; return y; }
function segWorld(seg, a, b) { return [seg.sx + seg.dx * a + seg.rx * b, seg.sz + seg.dz * a + seg.rz * b]; }

// ---------- Eingabe ----------
function onInput(dir, fromTilt) {
  if (state !== 'play' || !run || run.dying) return;
  const r = run, s = r.cur;
  if (r.tutWait) {
    const need = TUT[r.tutStep].need;
    const ok = need === dir || (need === 'side' && (dir === 'left' || dir === 'right')) || (need === 'turn' && dir === 'right' && !fromTilt);
    if (!ok) return;
    r.tutWait = false; r.tutStep++; $('tut').classList.add('hidden');
    if (r.tutStep >= TUT.length) finishTutorial();
  }
  if (dir === 'up') {
    if (r.py <= 0.001) { r.vy = 7.6; r.slideT = 0; sfx.jump(); }
  } else if (dir === 'down') {
    if (r.py > 0.001) { r.fastFall = true; r.vy = Math.min(r.vy, -9); }
    r.slideT = 0.75; sfx.slide();
  } else {
    const want = dir === 'left' ? 'L' : 'R';
    const window_ = 7 + r.speed * 0.3;
    const canTurn = !fromTilt && (s.exits === want || s.exits === 'T') && r.pa > s.L - HW - window_;
    if (canTurn) { r.turnQ = want; }
    else { r.lane = clamp(r.lane + (dir === 'left' ? -1 : 1), -1, 1); }
  }
}
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
window.addEventListener('keydown', e => {
  audioUnlock();
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame(); e.preventDefault(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && state === 'menu' && !$('scrMenu').classList.contains('hidden')) { startGame(); e.preventDefault(); return; }
  const d = KEYMAP[e.code];
  if (d && state === 'play') { onInput(d); e.preventDefault(); }
});
const gameEl = document.getElementById('game');
let touch = null;
function tStart(x, y) { touch = { x, y, done: false }; }
function tMove(x, y) {
  if (!touch || touch.done) return;
  const dx = x - touch.x, dy = y - touch.y;
  if (Math.hypot(dx, dy) > 26) {
    touch.done = true;
    if (Math.abs(dx) > Math.abs(dy)) onInput(dx > 0 ? 'right' : 'left');
    else onInput(dy > 0 ? 'down' : 'up');
  }
}
cv.addEventListener('touchstart', e => { audioUnlock(); const t = e.changedTouches[0]; tStart(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
cv.addEventListener('touchmove', e => { const t = e.changedTouches[0]; tMove(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
cv.addEventListener('touchend', e => { touch = null; e.preventDefault(); }, { passive: false });
cv.addEventListener('mousedown', e => { audioUnlock(); tStart(e.clientX, e.clientY); });
window.addEventListener('mousemove', e => { if (e.buttons) tMove(e.clientX, e.clientY); });
window.addEventListener('mouseup', () => { touch = null; });
document.addEventListener('touchstart', audioUnlock, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); });

// ---------- Update ----------
function update(dt) {
  const r = run;
  r.time += dt; r.animT += dt;
  for (const k in r.eff) if (r.eff[k] > 0) r.eff[k] = Math.max(0, r.eff[k] - dt);
  if (r.vetSayT > 0) r.vetSayT -= dt;
  r.shake = Math.max(0, r.shake - dt * 3);

  if (r.dying) { updateDying(dt); updateParts(dt); updateCam(dt); return; }

  // Tutorial: kurz anhalten, bis die richtige Geste kommt
  if (r.tut && r.tutStep < TUT.length && !r.tutWait && r.cur === r.firstSeg0) {
    const st = TUT[r.tutStep];
    const trig = st.need === 'turn' ? r.cur.L - HW - 5 : st.a - st.d;
    if (r.pa >= trig) {
      r.tutWait = true;
      $('tutIco').textContent = st.ico; $('tutIco').className = 'tut-ico ' + (st.need === 'turn' ? 'right' : st.need);
      $('tutTxt').textContent = st.txt;
      $('tutSub').textContent = st.sub + (st.need === 'side' && tiltOn() ? ' Oder kipp dein Handy zur Seite!' : '');
      $('tut').classList.remove('hidden');
    }
  }
  if (r.tutWait) { updateCam(dt); updateHUD(); return; }

  // Rutschpartie?
  r.onSlide = false;
  for (const o of r.cur.obs) if (o.type === 'slide' && r.pa > o.a0 && r.pa < o.a1) { r.onSlide = true; break; }
  if (r.onSlide && r.py <= 0.02) r.slideT = Math.max(r.slideT, 0.12);

  // Tempo
  const base = (r.tut && r.tutStep < TUT.length) ? 8 : (9 + 12 * (1 - Math.exp(-r.dist / 1800))) * roundMul(r.dist);
  r.speed = base * (r.eff.turbo > 0 ? 1.75 : 1) * (r.slowT > 0 ? 0.7 : 1) * (r.onSlide ? 1.2 : 1);
  if (r.slowT > 0) r.slowT -= dt;
  const step = r.speed * dt;
  const prevA = r.pa;
  r.pa += step; r.dist += step;

  // Seitlich
  const tb = r.lane * LANE;
  r.pb += clamp(tb - r.pb, -dt * 13, dt * 13);
  // Springen / Rutschen
  if (r.py > 0 || r.vy > 0) {
    r.vy -= (r.fastFall ? 60 : 24) * dt; r.py += r.vy * dt;
    if (r.py <= 0) { r.py = 0; r.vy = 0; r.fastFall = false; }
  }
  if (r.slideT > 0) r.slideT -= dt;

  // Abbiegen
  const s = r.cur;
  if (r.eff.turbo > 0 && !r.turnQ && r.pa > s.L - HW - 4) r.turnQ = s.exits === 'T' ? pick(['L', 'R']) : s.exits;
  if (r.eff.turbo > 0) for (const o of s.obs) if (o.type === 'narrow' && o.a0 - r.pa < 6 && o.a1 > r.pa) { r.lane = o.side; break; }
  if (r.turnQ && r.pa >= s.L - 0.25) doTurn();
  else if (r.pa > s.L + HW - 0.55) { die('wall'); return; }

  collide(prevA);
  if (r.dying) return;

  // Tierarzt
  r.stumbleT += dt;
  if (r.vetIntro > 0) r.vetIntro -= dt;
  const inTut = r.tut && r.tutStep < TUT.length;
  const close = !inTut && (r.stumbleT < 7 || r.vetIntro > 0);
  const tg = close ? (r.vetIntro > 0 ? 2.2 - r.vetIntro * 0.2 : 1.5) : (inTut ? 9 : 6);
  if (r.eff.fax > 0 || r.eff.turbo > 0) { r.vetGap = lerp(r.vetGap, 12, dt * 1.5); r.stumbleT = 99; r.vetIntro = 0; }
  else r.vetGap = lerp(r.vetGap, tg, dt * (close ? 3 : 0.8));
  let vb = r.pb > 0.3 ? r.pb - 1.3 : r.pb + 1.3;
  const va = r.pa - r.vetGap;
  for (const o of r.cur.obs) if (o.type === 'narrow' && va > o.a0 - 3 && va < o.a1 + 1) vb = o.side * LANE;
  vb = clamp(vb, -HW + 0.3, HW - 0.3);
  r.vetB = lerp(r.vetB, vb, dt * 4);

  // Level
  const lvl = levelAt(r.dist);
  if (r.cur.level !== r.level && r.pa > HW) {
    r.level = r.cur.level;
    if (r.level > 0 && r.level % 3 === 0) {
      const round = r.level / 3, bonus = 50 * round;
      r.coins += bonus;
      showBanner('RUNDE ' + round + ' GESCHAFFT!', 'Level ' + (r.level + 1) + ': ' + r.cur.theme.name + ' · +' + bonus + ' Kroketten · jetzt schneller!');
      sfx.applause();
      spawnConfetti();
      const [x, z] = segWorld(r.cur, r.pa + 3, 0);
      for (let i = 0; i < 30; i++) r.parts.push({ x: x + rnd(-2, 2), z: z + rnd(-1, 3), y: rnd(0.5, 2.5), vx: rnd(-2, 2), vz: rnd(-1, 2), vy: rnd(2, 5), t: 2, spr: 'star', s: 0.25 });
    } else {
      showBanner('Level ' + (r.level + 1) + ': ' + r.cur.theme.name, '');
      sfx.level();
    }
    music.start(r.cur.theme.key);
  }

  updateParts(dt);
  updateCam(dt);
  updateHUD();
}

function doTurn() {
  const r = run, s = r.cur, dir = r.turnQ;
  const ns = s.next[dir];
  const [wx, wz] = segWorld(s, r.pa, r.pb);
  const relx = wx - ns.sx, relz = wz - ns.sz;
  r.pa = relx * ns.dx + relz * ns.dz;
  r.pb = relx * ns.rx + relz * ns.rz;
  r.lane = clamp(Math.round(r.pb / LANE), -1, 1);
  r.prev = s; r.cur = ns; r.turnQ = null;
  genExits(ns, r.pa);
  sfx.turn();
}

function hitBy(o) {
  const r = run;
  if (r.tut && r.tutStep < TUT.length) { o.hit = true; return; }
  if (r.eff.fax > 0 || r.eff.turbo > 0) { smash(o, r.eff.fax > 0); return; }
  if (r.eff.shield > 0) { r.eff.shield = 0; smash(o, false); sfx.hit(); r.shake = 0.6; return; }
  o.hit = true; r.lastObs = o;
  sfx.hit(); r.shake = 1;
  if (r.stumbleT < 7) { die('caught', o); return; }
  r.stumbleT = 0; r.slowT = 0.9;
  r.vetSay = pick(['Hab ich dich gleich!', 'Stillhalten, Timo!', 'Nur ein kleiner Piks!', 'Impfpass, bitte!']);
  r.vetSayT = 3.2;
}
function smash(o, paper) {
  o.gone = true;
  const r = run;
  const b = o.type === 'block' ? o.b : r.pb;
  for (let i = 0; i < 14; i++) {
    const [x, z] = segWorld(r.cur, o.a0, b + rnd(-0.6, 0.6));
    r.parts.push({ x, z, y: rnd(0.2, 1), vx: rnd(-3, 3), vz: rnd(-1, 4), vy: rnd(2, 6), t: 1.2, spr: paper ? 'paper' : 'star', s: 0.25 });
  }
}
function collide(prevA) {
  const r = run, s = r.cur;
  const pa0 = prevA - 0.3, pa1 = r.pa + 0.3;
  for (const o of s.obs) {
    if (o.hit || o.gone || o.a1 < pa0 || o.a0 > pa1) continue;
    if (o.type === 'slide') continue;
    if (o.type === 'gap' || o.type === 'narrow') {
      const inside = r.pa > o.a0 + 0.3 && r.pa < o.a1 - 0.3;
      const overHole = o.type === 'gap' || Math.abs(r.pb - o.side * LANE) > 0.75;
      if (inside && overHole && r.py <= 0.02) {
        if (r.tut && r.tutStep < TUT.length) continue;
        if (r.eff.fax > 0 || r.eff.turbo > 0) { if (o.type === 'gap') { r.vy = 6; r.py = 0.03; } else { r.lane = o.side; r.pb = o.side * LANE; } }
        else if (r.eff.shield > 0) { r.eff.shield = 0; sfx.hit(); if (o.type === 'gap') { r.vy = 8; r.py = 0.03; } else { r.lane = o.side; r.pb = o.side * LANE; } }
        else { die('fall', o); return; }
      }
      continue;
    }
    if (o.type === 'low') { if (r.py < o.h - 0.05) hitBy(o); }
    else if (o.type === 'high') { if (!(r.slideT > 0 && r.py < 0.3)) hitBy(o); }
    else if (o.type === 'block') { if (Math.abs(r.pb - o.b) < (o.w * 0.5 + 0.3) && r.py < o.h - 0.05) hitBy(o); }
    if (r.dying) return;
  }
  // Kroketten
  for (const c of s.coins) {
    if (c.got) continue;
    if (r.eff.magnet > 0 && !c.mag && c.a > r.pa - 1 && c.a < r.pa + 10) c.mag = true;
    if (c.mag) {
      const k = Math.min(1, run.lastDt * 9);
      c.a = lerp(c.a, r.pa + 0.3, k); c.b = lerp(c.b, r.pb, k); c.y = lerp(c.y, r.py + 0.4, k);
    }
    if (Math.abs(c.a - r.pa) < 0.7 && Math.abs(c.b - r.pb) < 0.7 && Math.abs(c.y - (r.py + 0.45)) < 0.9) {
      c.got = true; r.coins += r.eff.fax > 0 ? 2 : 1; sfx.coin();
    }
  }
  for (const p of s.pus) {
    if (p.got) continue;
    if (Math.abs(p.a - r.pa) < 0.8 && Math.abs(p.b - r.pb) < 0.85 && Math.abs(p.y - (r.py + 0.45)) < 1) {
      p.got = true; activate(p.kind);
    }
  }
}
function activate(k) {
  const r = run;
  r.eff[k] = puDur(k);
  if (k === 'fax') {
    sfx.fax();
    r.vetSay = pick(['Was?! Ein Fax?!', 'Eine Beschwerde? 12 Seiten?!', 'Moment, ich muss das lesen…']);
    r.vetSayT = 3.5; r.stumbleT = 99;
    showBanner('FAX GESENDET!', 'Dr. Spritz liest die Beschwerde');
    const [x, z] = segWorld(r.cur, r.pa, r.pb);
    for (let i = 0; i < 24; i++) r.parts.push({ x: x + rnd(-2, 2), z: z + rnd(-2, 2), y: rnd(0.5, 2.5), vx: rnd(-2, 2), vz: rnd(-2, 2), vy: rnd(1, 4), t: 2, spr: 'paper', s: 0.3 });
  } else {
    sfx.power();
    showBanner(PU_INFO[k].name + '!', '');
  }
}
function die(cause, o) {
  const r = run;
  r.dying = 1.6; r.deathCause = cause; r.deathObs = o || r.lastObs;
  r.shake = 1.2;
  if (cause === 'fall') { r.vy = 0; r.shake = 0.4; beep(700, 0.9, 'triangle', 0.08, 90); } else sfx.hit();
  r.inject = cause !== 'fall';
  if (r.inject) { r.dying = 3.0; r.pikst = false; r.vetSide = undefined; r.vetSay = cause === 'caught' ? 'Erwischt!' : 'Hab ich dich!'; r.vetSayT = 1.2; }
}
function updateDying(dt) {
  const r = run;
  r.dying -= dt;
  if (r.inject) {
    // Tierarzt holt Timo ein und verpasst ihm die Spritze
    const t = 3.0 - r.dying;
    if (r.vetSide === undefined) r.vetSide = r.pb > 0.3 ? -1 : 1;
    r.vetGap = lerp(r.vetGap, 0.15, dt * 5); r.vetB = lerp(r.vetB, r.pb + r.vetSide * 1.05, dt * 5);
    if (t > 1.05 && !r.pikst) {
      r.pikst = true; r.vy = 5; r.shake = 0.5;
      r.vetSay = 'Piks!'; r.vetSayT = 1.6;
      beep(1400, 0.08, 'square', 0.06, 2400); setTimeout(() => beep(520, 0.35, 'triangle', 0.07, 260), 90);
      const [x, z] = segWorld(r.cur, r.pa, r.pb);
      for (let i = 0; i < 10; i++) r.parts.push({ x: x + rnd(-0.4, 0.4), z: z + rnd(-0.3, 0.3), y: rnd(0.8, 1.4), vx: rnd(-1.5, 1.5), vz: rnd(-0.5, 0.5), vy: rnd(2, 4), t: 1, spr: 'star', s: 0.2 });
    }
    if (r.py > 0 || r.vy > 0) { r.vy -= 22 * dt; r.py = Math.max(0, r.py + r.vy * dt); }
  }
  else if (r.deathCause === 'fall') { r.vy -= 18 * dt; r.py += r.vy * dt; r.pa += dt * 2; r.vetGap = lerp(r.vetGap, 1.4, dt * 2); }
  else { r.vetGap = lerp(r.vetGap, 1.4, dt * 2); if (r.py > 0 || r.vy > 0) { r.vy -= 24 * dt; r.py = Math.max(0, r.py + r.vy * dt); } }
  if (r.dying <= 0) gameOver();
}
function updateParts(dt) {
  const r = run;
  for (const p of r.parts) { if (p.gy === undefined) p.gy = elev(r.cur, r.pa); p.t -= dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vy -= 9 * dt; p.y = Math.max(0, p.y + p.vy * dt); }
  r.parts = r.parts.filter(p => p.t > 0);
}
function updateCam(dt) {
  const r = run, s = r.cur;
  const target = Math.atan2(s.dx, s.dz);
  let d = target - cam.ang;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  cam.ang += d * Math.min(1, dt * 9);
  const [px, pz] = segWorld(s, r.pa, r.pb * 0.7);
  const fx = Math.sin(cam.ang), fz = Math.cos(cam.ang);
  const tx = px - fx * CAM_BACK, tz = pz - fz * CAM_BACK;
  const k = Math.min(1, dt * 14);
  cam.x = lerp(cam.x, tx, k); cam.z = lerp(cam.z, tz, k);
  const ey = elev(s, r.pa);
  cam.ey = cam.ey === undefined || Math.abs(cam.ey - ey) > 5 ? ey : lerp(cam.ey, ey, Math.min(1, dt * 10));
  cam.y = CAM_H + Math.max(0, r.py) * 0.35 + cam.ey;
}

// ---------- Rendern ----------
let C = null; // Kamera-Basis für diesen Frame
function camBasis() {
  const fx = Math.sin(cam.ang), fz = Math.cos(cam.ang);
  let sx = 0, sy = 0;
  if (run && run.shake > 0) { sx = rnd(-1, 1) * run.shake * 3; sy = rnd(-1, 1) * run.shake * 3; }
  C = { x: cam.x, z: cam.z, y: cam.y, fx, fz, rx: fz, rz: -fx, ox: W / 2 + sx, oy: horizon + sy };
}
function toCam(x, y, z) { // -> [r, y, f]
  const dx = x - C.x, dz = z - C.z;
  return [dx * C.rx + dz * C.rz, y - C.y, dx * C.fx + dz * C.fz];
}
function proj(p) { return [C.ox + p[0] / p[2] * focal, C.oy - p[1] / p[2] * focal]; }
function clipNear(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
  }
  return out;
}

let floorQ = [], objQ = [], pitQ = [];
function fogT(f, theme) { return clamp((f - 18) / (VIEW - 18), 0, 1); }
// Viereck in Segment-Koordinaten: Punkte [a,b,y]
function quad(seg, pts, color, list, depthBias) {
  const cp = pts.map(p => { const w = segWorld(seg, p[0], p[1]); return toCam(w[0], p[2] + elev(seg, p[0]), w[1]); });
  let fmin = Infinity, fmax = -Infinity, fs = 0, rs = 0;
  for (const p of cp) { fmin = Math.min(fmin, p[2]); fmax = Math.max(fmax, p[2]); fs += p[2]; rs += p[0]; }
  if (fmax < NEAR || fmin > VIEW) return;
  const fc = fs / cp.length, rc = rs / cp.length;
  const yc = cp.reduce((s, p) => s + p[1], 0) / cp.length;
  const clipped = fmin < NEAR ? clipNear(cp) : cp;
  if (clipped.length < 3) return;
  const sp = clipped.map(proj);
  // grobe Sichtprüfung
  let minx = Infinity, maxx = -Infinity;
  for (const p of sp) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); }
  if (maxx < -20 || minx > W + 20) return;
  const fog = seg.theme.fog;
  list.push({ d: Math.hypot(fc, rc, yc) + (depthBias || 0), sp, col: rgb(color, fog, fogT(Math.max(fc, 0))) });
}
function drawPoly(q) {
  ctx.fillStyle = q.col;
  ctx.beginPath();
  ctx.moveTo(q.sp[0][0], q.sp[0][1]);
  for (let i = 1; i < q.sp.length; i++) ctx.lineTo(q.sp[i][0], q.sp[i][1]);
  ctx.closePath(); ctx.fill();
}
function box(seg, a0, a1, b0, b1, y0, y1, col, top, list) {
  const cl = camLocal(seg);
  const side = shade(col, 0.78);
  if (cl.a < a0) quad(seg, [[a0, b0, y0], [a0, b1, y0], [a0, b1, y1], [a0, b0, y1]], col, list);
  if (cl.a > a1) quad(seg, [[a1, b0, y0], [a1, b1, y0], [a1, b1, y1], [a1, b0, y1]], shade(col, 0.9), list);
  if (cl.b < b0) quad(seg, [[a0, b0, y0], [a1, b0, y0], [a1, b0, y1], [a0, b0, y1]], side, list);
  if (cl.b > b1) quad(seg, [[a0, b1, y0], [a1, b1, y0], [a1, b1, y1], [a0, b1, y1]], side, list);
  if (cl.y > y1) quad(seg, [[a0, b0, y1], [a1, b0, y1], [a1, b1, y1], [a0, b1, y1]], top || col, list, -0.05);
  if (cl.y < y0) quad(seg, [[a0, b0, y0], [a1, b0, y0], [a1, b1, y0], [a0, b1, y0]], shade(col, 0.6), list);
}
function camLocal(seg) {
  const rx = C.x - seg.sx, rz = C.z - seg.sz;
  return { a: rx * seg.dx + rz * seg.dz, b: rx * seg.rx + rz * seg.rz, y: C.y };
}
function sprite(seg, a, b, y, h, img, list, opts) {
  const w = segWorld(seg, a, b);
  spriteW(w[0], w[1], y + elev(seg, a), h, img, list, opts, seg.theme.fog);
}
function spriteW(x, z, y, h, img, list, opts, fog) {
  const p = toCam(x, y, z);
  if (p[2] < ((opts && opts.minF) || NEAR + 0.2) || p[2] > VIEW) return;
  const sc = focal / p[2];
  const sh = h * sc, sw = sh * img.width / img.height * ((opts && opts.sx) || 1);
  const sx = C.ox + p[0] * sc - sw / 2, sy = C.oy - p[1] * sc - sh;
  if (sx > W || sx + sw < 0) return;
  list.push({ d: Math.hypot(p[0], p[1], p[2]) + ((opts && opts.bias) || 0), img, x: sx, y: sy, w: sw, h: sh, fog: fog ? fogT(p[2]) : 0, fogC: fog, flip: opts && opts.flip, alpha: opts && opts.alpha });
}
function drawSprite(s) {
  ctx.save();
  if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
  if (s.img.smooth) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
  if (s.flip) { ctx.translate(Math.round(s.x + s.w), Math.round(s.y)); ctx.scale(-1, 1); ctx.drawImage(s.img, 0, 0, Math.round(s.w), Math.round(s.h)); }
  else ctx.drawImage(s.img, Math.round(s.x), Math.round(s.y), Math.max(1, Math.round(s.w)), Math.max(1, Math.round(s.h)));
  ctx.restore();
  if (s.fog > 0.05 && s.fogC) { // Nebel über das Sprite legen
    ctx.save(); ctx.globalAlpha = s.fog * 0.85;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
  }
}

function renderSeg(seg, isPrev, isExit) {
  const T = seg.theme, cl = camLocal(seg);
  // Sichtbarer a-Bereich grob begrenzen
  const aFrom = seg.prevStub ? -HW : (seg === run.firstSeg ? -12 : HW);
  const aJ0 = seg.L - HW, aJ1 = seg.L + HW;
  const step = 2;
  // Boden
  let k = 0;
  const fl = T.floor;
  for (let a = Math.floor(aFrom / step) * step; a < aJ1; a += step) {
    const a0 = Math.max(a, aFrom), a1 = Math.min(a + step, aJ1);
    if (a1 <= a0) continue;
    if (Math.abs(a0 - cl.a) > VIEW + 10 && Math.abs(a1 - cl.a) > VIEW + 10) continue;
    const idx = Math.floor((a + seg.startDist) / step);
    if (T.key === 'park') {
      quad(seg, [[a0, -HW, 0], [a1, -HW, 0], [a1, HW, 0], [a0, HW, 0]], fl[idx & 1], floorQ);
    } else if (T.key === 'amt') {
      for (let j = 0; j < 3; j++) {
        const b0 = -HW + j * LANE, b1 = b0 + LANE;
        quad(seg, [[a0, b0, 0], [a1, b0, 0], [a1, b1, 0], [a0, b1, 0]], fl[(idx + j) & 1], floorQ);
      }
    } else {
      for (let j = 0; j < 6; j++) {
        const b0 = -HW + j * 0.6, b1 = b0 + 0.6;
        const c = ((idx + (j % 2 ? 1 : 0) + j * 3) % 3 === 0) ? shade(fl[1], 0.9) : fl[j & 1];
        quad(seg, [[a0, b0, 0], [a1, b0, 0], [a1, b1, 0], [a0, b1, 0]], c, floorQ);
      }
    }
    if (!T.outdoor) {
      const lampOn = (idx % 3 === 0);
      quad(seg, [[a0, -HW, 3], [a1, -HW, 3], [a1, HW, 3], [a0, HW, 3]], T.ceil, floorQ, 50);
      if (lampOn) quad(seg, [[a0 + 0.4, -0.5, 2.99], [a1 - 0.4, -0.5, 2.99], [a1 - 0.4, 0.5, 2.99], [a0 + 0.4, 0.5, 2.99]], T.lamp, floorQ, 49);
    }
  }
  // Löcher und Kipp-Abschnitte
  for (const o of seg.obs) {
    if (o.type !== 'gap' && o.type !== 'narrow') continue;
    // Was hinter Timo liegt, wird nicht mehr gezeichnet (sonst große braune Flächen vor der Kamera)
    if (isPrev) continue;
    const cutA = seg === run.cur ? run.pa - 0.6 : -Infinity;
    if (o.a1 <= cutA) continue;
    const A0 = Math.max(o.a0, cutA), A1 = o.a1;
    const segsB = o.type === 'gap' ? [[-HW, HW]] : (o.side < 0 ? [[-HW + LANE + 0.05, HW]] : [[-HW, HW - LANE - 0.05]]);
    for (const [b0, b1] of segsB) {
      // dunkle Tiefe + sichtbare Rückwand (nur so tief, dass sie im Loch bleibt)
      const cl2 = camLocal(seg), len = o.a1 - o.a0;
      const showWall = o.type === 'gap' && A0 === o.a0 && cl2.a < o.a0 - 0.5 && Math.abs(cl2.b) < HW + 1;
      const D = showWall ? Math.min(1.2, (C.y - elev(seg, o.a0)) * len / Math.max(0.5, o.a0 - cl2.a)) * 0.9 : 0;
      // Erdloch: dunkle Tiefe, Erdwand mit Schichten, unregelmäßiger Erdrand
      const seed = Math.floor(o.a0 * 13.7);
      const jag = k => 0.12 + 0.12 * (((seed + k * 37) % 7) / 6);
      quad(seg, [[A0, b0, 0.002], [A1, b0, 0.002], [A1, b1, 0.002], [A0, b1, 0.002]], [84, 52, 26], pitQ);
      if (A1 - A0 > 0.6) quad(seg, [[A0 + 0.25, b0 + 0.2, 0.0025], [A1 - 0.25, b0 + 0.2, 0.0025], [A1 - 0.25, b1 - 0.2, 0.0025], [A0 + 0.25, b1 - 0.2, 0.0025]], [62, 38, 18], pitQ);
      if (showWall && D > 0.05) {
        quad(seg, [[o.a1, b0, 0.003], [o.a1, b1, 0.003], [o.a1, b1, -D], [o.a1, b0, -D]], [124, 82, 44], pitQ, -0.5);
        quad(seg, [[o.a1 - 0.001, b0, -D * 0.35], [o.a1 - 0.001, b1, -D * 0.35], [o.a1 - 0.001, b1, -D * 0.55], [o.a1 - 0.001, b0, -D * 0.55]], [100, 64, 32], pitQ, -0.6);
        quad(seg, [[o.a1 - 0.001, b0, -D * 0.75], [o.a1 - 0.001, b1, -D * 0.75], [o.a1 - 0.001, b1, -D], [o.a1 - 0.001, b0, -D]], [80, 50, 24], pitQ, -0.6);
      }
      const n = Math.max(3, Math.round((b1 - b0) / 0.35));
      for (let k = 0; k < n; k++) {
        const x0 = b0 + k * (b1 - b0) / n, x1 = x0 + (b1 - b0) / n;
        if (A0 === o.a0) quad(seg, [[o.a0 - jag(k), x0, 0.004], [o.a0 + 0.06, x0, 0.004], [o.a0 + 0.06, x1, 0.004], [o.a0 - jag(k + 3), x1, 0.004]], k & 1 ? [120, 78, 40] : [140, 94, 52], pitQ, -1);
        quad(seg, [[o.a1 - 0.06, x0, 0.004], [o.a1 + jag(k + 1), x0, 0.004], [o.a1 + jag(k + 5), x1, 0.004], [o.a1 - 0.06, x1, 0.004]], k & 1 ? [140, 94, 52] : [120, 78, 40], pitQ, -1);
      }
      if (o.type === 'narrow') { // Erdkante zur begehbaren Seite
        const eb = o.side < 0 ? b0 : b1, sgn = o.side < 0 ? 1 : -1;
        for (let a = A0; a < o.a1; a += 0.8) {
          const j = jag(Math.floor(a * 3));
          quad(seg, [[a, eb - 0.05 * sgn, 0.004], [Math.min(o.a1, a + 0.8), eb - 0.05 * sgn, 0.004], [Math.min(o.a1, a + 0.8), eb + j * sgn, 0.004], [a, eb + j * sgn, 0.004]], (Math.floor(a) & 1) ? [120, 78, 40] : [140, 94, 52], pitQ, -1);
        }
      }
      // Erdhaufen neben dem Loch
      if (false) {
        box(seg, o.a0 - 0.6, o.a0 - 0.25, HW - 0.45, HW - 0.1, 0, 0.22, [124, 82, 44], [146, 98, 56], objQ);
        box(seg, o.a1 + 0.2, o.a1 + 0.5, -HW + 0.1, -HW + 0.4, 0, 0.18, [124, 82, 44], [146, 98, 56], objQ);
      }
    }
  }
  // Wände
  const hasL = seg.exits === 'L' || seg.exits === 'T', hasR = seg.exits === 'R' || seg.exits === 'T';
  const wallFrom = aFrom;
  for (let s = -1; s <= 1; s += 2) {
    const open = s < 0 ? hasL : hasR;
    const endA = open ? aJ0 : aJ1;
    for (let a = Math.floor(wallFrom / step) * step; a < endA; a += step) {
      const a0 = Math.max(a, wallFrom), a1 = Math.min(a + step, endA);
      if (a1 <= a0) continue;
      wallPiece(seg, s, a0, a1, cl);
    }
  }
  // Endwand
  endWall(seg, cl);
  // Wanddeko
  for (const d of seg.deco) {
    if (d.poster) poster(seg, d);
    else if (d.hang) {
      const key = seg.theme.key + d.hang;
      if (!signCache[key]) signCache[key] = seg.theme.key === 'amt' ? makeSign(d.hang, '#2c5aa0', '#fff') : makeSign(d.hang, '#ffe23a', '#c02020');
      sprite(seg, d.a, 0, 2.25, 0.4, signCache[key], objQ, { minF: 2 });
    }
    else sprite(seg, d.a, d.b, 0, d.h, SPR[d.spr], objQ, { bias: d.wall ? 0.2 : 0, minF: 1.6 });
  }
  if (seg.gate) gate(seg);
  // Hindernisse
  for (const o of seg.obs) if (!o.gone && o.type !== 'gap' && o.type !== 'narrow' && o.type !== 'slide') obstacle(seg, o);
  // Kroketten
  const spin = Math.abs(Math.cos(run.time * 5));
  for (const c of seg.coins) if (!c.got) sprite(seg, c.a, c.b, c.y - 0.15, 0.32, SPR.kk, objQ, { sx: 0.35 + 0.65 * spin, minF: 1.4 });
  for (const p of seg.pus) if (!p.got) {
    const bob = Math.sin(run.time * 4) * 0.12;
    sprite(seg, p.a, p.b, p.y + bob - 0.2, 0.6, SPR[p.kind], objQ);
  }
}
function wallPiece(seg, s, a0, a1, cl) {
  const T = seg.theme, b = s * HW;
  if (T.outdoor) {
    const h = T.wall.h, b2 = s * (HW + 0.45);
    const bi = Math.min(b, b2), bo = Math.max(b, b2);
    const inner = s < 0 ? bo : bi;
    // Innenseite, Oberseite, Außenseite (wenn sichtbar)
    const vis = s < 0 ? cl.b > -HW : cl.b < HW;
    if (vis) quad(seg, [[a0, inner, 0], [a1, inner, 0], [a1, inner, h], [a0, inner, h]], ((Math.floor(a0 / 2) & 1) ? T.wall.front : shade(T.wall.front, 0.92)), objQ);
    else quad(seg, [[a0, s < 0 ? bi : bo, 0], [a1, s < 0 ? bi : bo, 0], [a1, s < 0 ? bi : bo, h], [a0, s < 0 ? bi : bo, h]], T.wall.dark, objQ);
    quad(seg, [[a0, bi, h], [a1, bi, h], [a1, bo, h], [a0, bo, h]], T.wall.top, objQ, -0.05);
  } else {
    quad(seg, [[a0, b, 0], [a1, b, 0], [a1, b, 1], [a0, b, 1]], T.wall.low, objQ, 0.3);
    quad(seg, [[a0, b, 1], [a1, b, 1], [a1, b, 3], [a0, b, 3]], (T.key === 'sofa' && (Math.floor(a0 / 2) & 1)) ? T.wall.line : T.wall.high, objQ, 0.3);
    if (T.key === 'sofa') quad(seg, [[a0, b, 2.45], [a1, b, 2.45], [a1, b, 2.75], [a0, b, 2.75]], [214, 40, 52], objQ, 0.25);
  }
}
function endWall(seg, cl) {
  const T = seg.theme, a = seg.L + HW;
  if (T.outdoor) {
    const h = T.wall.h;
    box(seg, a, a + 0.45, -HW - 0.45, HW + 0.45, 0, h, T.wall.front, T.wall.top, objQ);
    sprite(seg, a + 2.5, -1.2, 0, 3.0, SPR.tree, objQ);
    sprite(seg, a + 3.5, 1.4, 0, 2.8, SPR.tree, objQ);
  } else {
    for (let j = 0; j < 3; j++) {
      const b0 = -HW + j * LANE, b1 = b0 + LANE;
      quad(seg, [[a, b0, 0], [a, b1, 0], [a, b1, 1], [a, b0, 1]], T.wall.low, objQ, 0.3);
      quad(seg, [[a, b0, 1], [a, b1, 1], [a, b1, 3], [a, b0, 3]], T.wall.high, objQ, 0.3);
    }
    // Schild "Bitte abbiegen" / Pfeil
    const pc = T.key === 'amt' ? [60, 110, 200] : [240, 200, 80];
    quad(seg, [[a - 0.02, -0.7, 1.3], [a - 0.02, 0.7, 1.3], [a - 0.02, 0.7, 2.2], [a - 0.02, -0.7, 2.2]], pc, objQ, 0.1);
  }
}
function poster(seg, d) {
  const b = d.side * (HW - 0.02), a0 = d.a, a1 = d.a + d.w;
  let y0 = 1.3, y1 = 2.2, col = d.col;
  if (d.kind === 'door') { y0 = 0; y1 = 2.2; col = [150, 110, 70]; }
  if (d.kind === 'board') { y0 = 1.2; y1 = 2.0; col = [60, 70, 60]; }
  if (d.kind === 'frame') { quad(seg, [[a0 - 0.08, b, y0 - 0.08], [a1 + 0.08, b, y0 - 0.08], [a1 + 0.08, b, y1 + 0.08], [a0 - 0.08, b, y1 + 0.08]], [200, 160, 60], objQ, 0.2); }
  if (d.kind === 'sale') { col = [255, 230, 60]; y0 = 1.5; y1 = 2.3; }
  if (d.kind === 'display') { // Schaufenster mit Ausstellungs-Sofa
    const w2 = 2.2, sc = SOFA_COLS[Math.floor(d.a * 7) % SOFA_COLS.length];
    quad(seg, [[a0 - 0.1, b, 0.2], [a0 + w2 + 0.1, b, 0.2], [a0 + w2 + 0.1, b, 2.4], [a0 - 0.1, b, 2.4]], [60, 60, 70], objQ, 0.17);
    quad(seg, [[a0, b, 0.3], [a0 + w2, b, 0.3], [a0 + w2, b, 2.3], [a0, b, 2.3]], [214, 236, 246], objQ, 0.15);
    quad(seg, [[a0 + 0.1, b, 1.95], [a0 + 0.6, b, 2.25], [a0 + 0.75, b, 2.25], [a0 + 0.25, b, 1.95]], [250, 255, 255], objQ, 0.02);
    quad(seg, [[a0 + 0.3, b, 0.45], [a0 + w2 - 0.3, b, 0.45], [a0 + w2 - 0.3, b, 0.85], [a0 + 0.3, b, 0.85]], sc, objQ, 0.05);
    quad(seg, [[a0 + 0.3, b, 0.85], [a0 + w2 - 0.3, b, 0.85], [a0 + w2 - 0.3, b, 1.35], [a0 + 0.3, b, 1.35]], shade(sc, 0.8), objQ, 0.06);
    quad(seg, [[a0 + 0.15, b, 0.45], [a0 + 0.35, b, 0.45], [a0 + 0.35, b, 1.05], [a0 + 0.15, b, 1.05]], shade(sc, 0.7), objQ, 0.04);
    quad(seg, [[a0 + w2 - 0.35, b, 0.45], [a0 + w2 - 0.15, b, 0.45], [a0 + w2 - 0.15, b, 1.05], [a0 + w2 - 0.35, b, 1.05]], shade(sc, 0.7), objQ, 0.04);
    quad(seg, [[a0 + w2 - 0.7, b, 1.6], [a0 + w2 - 0.2, b, 1.6], [a0 + w2 - 0.2, b, 1.9], [a0 + w2 - 0.7, b, 1.9]], [255, 226, 58], objQ, 0.04);
    quad(seg, [[a0 + w2 - 0.62, b, 1.68], [a0 + w2 - 0.28, b, 1.68], [a0 + w2 - 0.28, b, 1.8], [a0 + w2 - 0.62, b, 1.8]], [200, 30, 30], objQ, 0.03);
    return;
  }
  if (d.kind === 'shelf') {
    const w2 = 2.2;
    quad(seg, [[a0, b, 0.2], [a0 + w2, b, 0.2], [a0 + w2, b, 2.4], [a0, b, 2.4]], [130, 86, 50], objQ, 0.15);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 3; k++) {
      const c = SOFA_COLS[(row * 3 + k + Math.floor(d.a)) % SOFA_COLS.length];
      const x0 = a0 + 0.08 + k * (w2 - 0.16) / 3, x1 = x0 + (w2 - 0.16) / 3 - 0.06, yy = 0.35 + row * 0.7;
      quad(seg, [[x0, b, yy], [x1, b, yy], [x1, b, yy + 0.45], [x0, b, yy + 0.45]], c, objQ, 0.05);
    }
    return;
  }
  quad(seg, [[a0, b, y0], [a1, b, y0], [a1, b, y1], [a0, b, y1]], col, objQ, 0.1);
  if (d.kind === 'door') quad(seg, [[a0 + 0.1, b, 1.5], [a1 - 0.1, b, 1.5], [a1 - 0.1, b, 2.0], [a0 + 0.1, b, 2.0]], [200, 230, 255], objQ, 0.05);
  if (d.kind === 'sale') quad(seg, [[a0 + 0.1, b, 1.75], [a1 - 0.1, b, 1.75], [a1 - 0.1, b, 2.0], [a0 + 0.1, b, 2.0]], [230, 40, 40], objQ, 0.05);
}
const signCache = {};
function gate(seg) {
  const T = seg.theme, a = HW + 4;
  const pc = T.outdoor ? [120, 80, 40] : [90, 90, 100];
  box(seg, a, a + 0.3, -HW, -HW + 0.25, 0, 2.9, pc, null, objQ);
  box(seg, a, a + 0.3, HW - 0.25, HW, 0, 2.9, pc, null, objQ);
  box(seg, a, a + 0.3, -HW, HW, 2.5, 2.9, pc, null, objQ);
  if (!signCache[T.key]) signCache[T.key] = makeSign(T.sign, T.signBg, T.signFg);
  sprite(seg, a - 0.05, 0, 2.15, 0.5, signCache[T.key], objQ, { bias: -0.2 });
}
function obstacle(seg, o) {
  const d = o.def;
  if (o.type === 'low') {
    box(seg, o.a0, o.a1, -HW, HW, 0, o.h, d.c, d.top, objQ);
    if (d.kind === 'files') for (let j = -1; j <= 1; j++) box(seg, o.a0 + 0.1, o.a0 + 0.5, j * LANE - 0.3, j * LANE + 0.3, o.h, o.h + 0.25, [240, 236, 220], [255, 255, 250], objQ);
    if (d.kind === 'pillows') for (let j = -1; j <= 1; j++) box(seg, o.a0 + 0.1, o.a0 + 0.5, j * LANE - 0.35, j * LANE + 0.35, o.h, o.h + 0.2, [230, 100, 120], [250, 140, 160], objQ);
    if (d.kind === 'hedge') for (let j = -2; j <= 2; j++) sprite(seg, o.a0 - 0.02, j * 0.75, o.h - 0.15, 0.25, SPR.flower, objQ, { bias: -0.3 });
  } else if (o.type === 'high') {
    const y0 = o.y0, y1 = y0 + 0.5;
    box(seg, o.a0, o.a1, -HW, -HW + 0.2, 0, y1, d.c, null, objQ);
    box(seg, o.a0, o.a1, HW - 0.2, HW, 0, y1, d.c, null, objQ);
    if (d.kind === 'tape') {
      for (let j = 0; j < 6; j++) box(seg, o.a0, o.a0 + 0.08, -HW + j * 0.6, -HW + (j + 1) * 0.6, y0 + 0.1, y0 + 0.35, j & 1 ? [250, 250, 250] : [220, 40, 40], null, objQ);
    } else if (d.kind === 'arch') {
      box(seg, o.a0, o.a1, -HW, HW, y0, y1, [70, 140, 60], [100, 170, 80], objQ);
      for (let j = -2; j <= 2; j++) box(seg, o.a0 - 0.05, o.a0, j * 0.7 - 0.12, j * 0.7 + 0.12, y0 + 0.15, y0 + 0.35, [230, 80, 110], null, objQ);
    } else box(seg, o.a0, o.a1, -HW, HW, y0, y1, d.c, d.top, objQ);
  } else {
    const b0 = o.b - o.w / 2, b1 = o.b + o.w / 2;
    if (d.kind === 'bench') {
      box(seg, o.a0, o.a1, b0, b1, 0.35, 0.45, d.c, d.top, objQ);
      box(seg, o.a1 - 0.12, o.a1, b0, b1, 0.45, o.h, d.c, d.top, objQ);
      box(seg, o.a0 + 0.1, o.a0 + 0.2, b0 + 0.05, b0 + 0.15, 0, 0.35, [50, 50, 50], null, objQ);
      box(seg, o.a0 + 0.1, o.a0 + 0.2, b1 - 0.15, b1 - 0.05, 0, 0.35, [50, 50, 50], null, objQ);
    } else if (d.kind === 'sofa') {
      const sc = o.c || d.c, st = [Math.min(255, sc[0] + 50), Math.min(255, sc[1] + 50), Math.min(255, sc[2] + 50)];
      box(seg, o.a0 + 0.1, o.a0 + 0.2, b0 + 0.1, b0 + 0.2, 0, 0.12, [40, 30, 20], null, objQ);
      box(seg, o.a0 + 0.1, o.a0 + 0.2, b1 - 0.2, b1 - 0.1, 0, 0.12, [40, 30, 20], null, objQ);
      box(seg, o.a0, o.a1, b0, b1, 0.12, 0.5, sc, st, objQ);
      box(seg, o.a1 - 0.3, o.a1, b0, b1, 0.5, o.h, shade(sc, 0.85), st, objQ);
      box(seg, o.a0, o.a1 - 0.3, b0, b0 + 0.18, 0.5, 0.75, shade(sc, 0.8), st, objQ);
      box(seg, o.a0, o.a1 - 0.3, b1 - 0.18, b1, 0.5, 0.75, shade(sc, 0.8), st, objQ);
      box(seg, o.a1 - 0.45, o.a1 - 0.3, o.b - 0.25, o.b + 0.05, 0.5, 0.8, [250, 230, 120], [255, 245, 170], objQ);
      if (o.price) {
        const key = 'price' + o.price;
        if (!signCache[key]) signCache[key] = makeSign(o.price, '#ffe23a', '#c02020');
        sprite(seg, o.a0, o.b, o.h + 0.05, 0.28, signCache[key], objQ, { bias: -0.3 });
      }
    } else if (d.kind === 'chairs') {
      box(seg, o.a0, o.a1, b0, b1, 0.38, 0.48, d.c, d.top, objQ);
      box(seg, o.a1 - 0.1, o.a1, b0, b1, 0.48, o.h, d.c, d.top, objQ);
      box(seg, o.a0 + 0.2, o.a0 + 0.3, o.b - 0.05, o.b + 0.05, 0, 0.38, [80, 80, 80], null, objQ);
    } else if (d.kind === 'copier') {
      box(seg, o.a0, o.a1, b0, b1, 0, 1.0, d.c, d.top, objQ);
      box(seg, o.a0 + 0.1, o.a1, b0 + 0.05, b1 - 0.05, 1.0, o.h, [210, 214, 220], [120, 200, 120], objQ);
      box(seg, o.a0 - 0.01, o.a0, b0 + 0.15, b1 - 0.15, 0.55, 0.65, [60, 60, 70], null, objQ);
    } else if (d.kind === 'tree') {
      box(seg, o.a0 + 0.3, o.a0 + 0.55, o.b - 0.13, o.b + 0.13, 0, 0.9, d.c, d.top, objQ);
      sprite(seg, o.a0 + 0.42, o.b, 0, 2.5, SPR.tree, objQ, { bias: -0.1 });
    } else if (d.kind === 'armchair') {
      if (SPR.sessel) sprite(seg, o.a0 + 0.4, o.b, 0, 1.3, SPR.sessel, objQ, { bias: -0.1 });
      else box(seg, o.a0, o.a1, o.b - 0.5, o.b + 0.5, 0, o.h, d.c, d.top, objQ);
    } else if (d.kind === 'hydrant') {
      if (SPR.hydrant) sprite(seg, o.a0 + 0.4, o.b, 0, 1.1, SPR.hydrant, objQ, { bias: -0.1 });
      else box(seg, o.a0 + 0.2, o.a1 - 0.2, o.b - 0.3, o.b + 0.3, 0, o.h, d.c, d.top, objQ);
    } else if (d.kind === 'bin') {
      box(seg, o.a0 + 0.15, o.a1 - 0.15, b0 + 0.1, b1 - 0.1, 0, o.h, d.c, d.top, objQ);
      box(seg, o.a0 + 0.1, o.a1 - 0.1, b0 + 0.05, b1 - 0.05, o.h - 0.15, o.h, [80, 160, 90], [40, 70, 45], objQ);
    } else box(seg, o.a0, o.a1, b0, b1, 0, o.h, d.c, d.top, objQ);
  }
}

function drawBackground(T) {
  if (T.outdoor) {
    const g = ctx.createLinearGradient(0, 0, 0, C.oy);
    g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, C.oy + 1);
    // Wolken (parallax nach Kamerawinkel)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const base = ((i * 97 - cam.ang * 120) % (W + 80) + W + 80) % (W + 80) - 40;
      const y = C.oy * (0.15 + (i * 37 % 50) / 100);
      ctx.fillRect(Math.round(base), Math.round(y), 26, 6);
      ctx.fillRect(Math.round(base + 6), Math.round(y - 4), 14, 4);
    }
    // Ferne Hügel
    ctx.fillStyle = '#86c96e';
    for (let x = 0; x < W; x += 4) {
      const hh = 6 + 5 * Math.sin((x + cam.ang * 200) * 0.03) + 3 * Math.sin((x + cam.ang * 200) * 0.081);
      ctx.fillRect(x, C.oy - hh, 4, hh + 1);
    }
    ctx.fillStyle = T.ground; ctx.fillRect(0, C.oy, W, H - C.oy);
  } else {
    ctx.fillStyle = rgb(T.fog); ctx.fillRect(0, 0, W, H);
  }
}

function render() {
  camBasis();
  const r = run;
  const T = r.cur.theme;
  drawBackground(r.prev && r.pa < HW + 2 ? r.prev.theme : T);
  floorQ = []; objQ = []; pitQ = [];
  r.firstSeg = r.firstSeg || r.cur;
  if (r.prev) renderSeg(r.prev, true, false);
  renderSeg(r.cur, false, false);
  if (r.cur.next) for (const k in r.cur.next) {
    const n = r.cur.next[k];
    renderSeg(n, false, true);
    if (n.next) for (const k2 in n.next) renderSeg(n.next[k2], false, true);
  }
  floorQ.sort((a, b) => b.d - a.d);
  for (const q of floorQ) drawPoly(q);
  pitQ.sort((a, b) => b.d - a.d);
  for (const q of pitQ) drawPoly(q);
  // Schatten
  const sp = toCamSeg(r.cur, r.pa, r.pb, 0);
  if (sp[2] > NEAR && r.deathCause !== 'fall') {
    const [sx, sy] = proj(sp);
    const sc = focal / sp[2];
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 0.42 * sc * (1 - r.py * 0.2), 0.12 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Timo
  const sliding = r.slideT > 0 && r.py < 0.3;
  let img = r.py > 0.05 ? SPR.timoJ : (Math.floor(r.animT * (r.speed * 0.9)) & 1 ? SPR.timoA : SPR.timoB);
  let dh = SPR.timoReal ? (sliding ? 0.85 : 1.55) : (sliding ? 0.75 : 1.3), tsx = sliding ? (SPR.timoReal ? 1.5 : 1.7) : 1;
  if (sliding && r.onSlide && SPR.timoSlide) { img = SPR.timoSlide; dh = 0.78; tsx = 1; }
  else if (sliding && SPR.timoDuck) { img = SPR.timoDuck; dh = 0.95; tsx = 1; }
  const [tx, tz] = segWorld(r.cur, r.pa, r.pb);
  spriteW(tx, tz, r.py + elev(r.cur, r.pa), dh, img, objQ, { sx: tsx, bias: -0.8, alpha: r.deathCause === 'fall' ? clamp(1 + r.py * 0.6, 0, 1) : undefined });
  // Tierarzt
  const p = run;
  if (p.vetGap < 5) {
    const [vx, vz] = segWorld(r.cur, r.pa - p.vetGap, p.vetB);
    const vimg = (Math.floor(r.animT * 8) & 1) ? SPR.vetA : SPR.vetB;
    let vj = 0;
    const va = r.pa - p.vetGap;
    for (const o of r.cur.obs) if (o.type === 'gap' && va > o.a0 - 1 && va < o.a1 + 1) vj = Math.max(vj, 1.0 * Math.sin(Math.PI * (va - o.a0 + 1) / (o.a1 - o.a0 + 2)));
    spriteW(vx, vz, Math.abs(Math.sin(r.animT * 8)) * 0.08 + vj + elev(r.cur, r.pa - p.vetGap), SPR.vetReal ? 1.85 : 1.75, vimg, objQ, { bias: -0.8 });
  }
  // Partikel
  for (const q of r.parts) spriteW(q.x, q.z, q.y + (q.gy || 0), q.s, SPR[q.spr], objQ, { alpha: clamp(q.t, 0, 1) });

  objQ.sort((a, b) => b.d - a.d);
  for (const q of objQ) { if (q.img) drawSprite(q); else drawPoly(q); }

  // Effekte um Timo
  const tp = toCamSeg(r.cur, r.pa, r.pb, r.py + 0.5);
  if (tp[2] > NEAR) {
    const [ex, ey] = proj(tp), sc = focal / tp[2];
    if (r.eff.shield > 0 && (r.eff.shield > 2 || Math.floor(r.time * 8) & 1)) {
      ctx.strokeStyle = 'rgba(120,180,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, 0.75 * sc + Math.sin(r.time * 6) * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    if (r.eff.fax > 0 || r.eff.turbo > 0) {
      ctx.fillStyle = r.eff.fax > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,200,40,0.9)';
      for (let i = 0; i < 6; i++) {
        const ang = r.time * 6 + i * 1.047;
        ctx.fillRect(Math.round(ex + Math.cos(ang) * 0.7 * sc), Math.round(ey + Math.sin(ang) * 0.5 * sc), 2, 2);
      }
    }
  }
  if (r.dying && r.inject) drawInjection(r);
  // Sprechblase Tierarzt
  if (r.vetSayT > 0 && r.vetGap < 5) {
    const vp = toCamSeg(r.cur, r.pa - r.vetGap, r.vetB, 1.9);
    if (vp[2] > NEAR) { const [bx, by] = proj(vp); bubble(r.vetSay, bx, by); }
  }
  // Kipp-Hinweis vor Abschnitten mit nur einer Bodenseite
  if (!r.dying) for (const o of r.cur.obs) {
    if (o.type !== 'narrow') continue;
    const d = o.a0 - r.pa;
    if (d > -2 && d < 16 && Math.abs(r.pb - o.side * LANE) > 0.4) {
      if (Math.floor(r.time * 5) & 1) bigHint((o.side < 0 ? '⬅ ' : '') + (tiltOn() ? 'KIPPEN!' : 'WISCHEN!') + (o.side > 0 ? ' ➡' : ''));
      break;
    }
  }
  if (!r.dying) for (const o of r.cur.obs) {
    if (o.type !== 'slide') continue;
    const d = o.a0 - r.pa;
    if (d > -1 && d < 12 && (Math.floor(r.time * 4) & 1)) { bigHint('RUTSCHPARTIE! ' + (tiltOn() ? '⬅ KIPPEN ➡' : '⬅ WISCHEN ➡')); break; }
  }
  // Abbiege-Hinweis
  const s = r.cur;
  if (!r.dying && r.pa > s.L - HW - (7 + r.speed * 0.3) && !r.turnQ) arrowHint(s.exits);
  // Turbo-Effekt
  if (r.eff.turbo > 0) {
    // Speed-Lines: strahlen vom Fluchtpunkt nach außen, nur am Bildrand
    const fade = clamp(r.eff.turbo, 0, 1);
    ctx.strokeStyle = 'rgba(255,240,210,' + (0.45 * fade) + ')'; ctx.lineWidth = 1;
    const R = Math.hypot(W, H) * 0.6;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const ang = i * 2.399 + Math.floor(r.time * 12 + i) * 0.37;
      const ph = (r.time * 2.2 + i * 0.137) % 1;
      const r0 = R * (0.55 + ph * 0.45), r1 = r0 + R * 0.18;
      ctx.moveTo(Math.round(C.ox + Math.cos(ang) * r0), Math.round(C.oy + Math.sin(ang) * r0 * 0.75));
      ctx.lineTo(Math.round(C.ox + Math.cos(ang) * r1), Math.round(C.oy + Math.sin(ang) * r1 * 0.75));
    }
    ctx.stroke();
  }
}
function drawInjection(r) {
  const t = 3.0 - r.dying;
  if (t < 0.45 || t > 2.1) return;
  const side = r.vetSide || 1;
  const tp = toCamSeg(r.cur, r.pa, r.pb + side * 0.18, r.py + 0.8);
  if (tp[2] <= NEAR) return;
  const [ex, ey] = proj(tp), sc = focal / tp[2];
  // Anflug (0.45–1.05), Drücken (1.05–1.6), Rausziehen (1.6–2.3)
  const inn = t < 1.05 ? (t - 0.45) / 0.6 : t < 1.6 ? 1 : 1 - (t - 1.6) / 0.7;
  const push = t < 1.05 ? 0 : clamp((t - 1.05) / 0.4, 0, 1);
  const L = 0.62 * sc, th = Math.max(3, 0.1 * sc);
  const ang = side > 0 ? -0.4 : Math.PI + 0.4; // Spritze kommt von der Seite des Tierarztes
  const dist = (1 - inn) * 0.5 * sc;
  ctx.save();
  ctx.translate(Math.round(ex + Math.cos(ang) * dist), Math.round(ey + Math.sin(ang) * dist));
  ctx.rotate(ang); if (side < 0) ctx.scale(1, -1);
  const P = v => Math.round(v);
  // Nadel
  ctx.fillStyle = '#d0d4dc'; ctx.fillRect(0, P(-0.5), P(L * 0.28), Math.max(1, P(th * 0.18)));
  // Zylinder mit Flüssigkeit
  const bx = P(L * 0.28), bw = P(L * 0.5);
  ctx.fillStyle = '#1e1e28'; ctx.fillRect(bx - 1, P(-th / 2) - 1, bw + 2, P(th) + 2);
  ctx.fillStyle = '#eef6ff'; ctx.fillRect(bx, P(-th / 2), bw, P(th));
  ctx.fillStyle = '#5ac8ff'; ctx.fillRect(bx, P(-th / 2), P(bw * (1 - push * 0.85)), P(th));
  // Kolben
  const kx = bx + bw - P(bw * push * 0.85);
  ctx.fillStyle = '#1e1e28'; ctx.fillRect(kx, P(-th * 0.22), P(L * 0.3) + 2, Math.max(2, P(th * 0.44)));
  ctx.fillRect(kx + P(L * 0.3), P(-th * 0.6), Math.max(2, P(th * 0.3)), P(th * 1.2));
  ctx.fillStyle = '#d84040'; ctx.fillRect(bx + bw, P(-th * 0.75), Math.max(2, P(th * 0.25)), P(th * 1.5));
  ctx.restore();
  if (r.pikst && t < 1.9) {
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textBaseline = 'middle';
    const tx = Math.round(ex - side * 0.6 * sc - 16), ty = Math.round(ey - 0.25 * sc);
    ctx.fillStyle = '#000'; ctx.fillText('AUA!', tx + 1, ty + 1);
    ctx.fillStyle = (Math.floor(t * 10) & 1) ? '#ffd83a' : '#ff8a1f'; ctx.fillText('AUA!', tx, ty);
  }
}
function toCamSeg(seg, a, b, y) { const w = segWorld(seg, a, b); return toCam(w[0], y + elev(seg, a), w[1]); }
function bubble(text, x, y) {
  ctx.font = '8px "Press Start 2P", monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 8, h = 14;
  let bx = Math.round(clamp(x - w / 2, 2, W - w - 2)), by = Math.round(clamp(y - h - 6, 2, H - h - 2));
  ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, w, h);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'top'; ctx.fillText(text, bx + 4, by + 3);
}
let confetti = [];
function spawnConfetti() {
  const cols = ['#ff8a1f', '#2f80ed', '#ffd83a', '#e8357a', '#5fc855', '#ffffff'];
  for (let i = 0; i < 160; i++) confetti.push({ x: rnd(0, W), y: rnd(-H * 0.5, H * 0.25), vx: rnd(-15, 15), vy: rnd(35, 75), c: pick(cols), w: rint(3, 5), h: rint(4, 7), ph: rnd(0, 6), t: rnd(3, 4.5) });
}
function drawConfetti(dt) {
  if (!confetti.length) return;
  for (const p of confetti) {
    p.t -= dt; p.ph += dt * 8; p.x += (p.vx + Math.sin(p.ph) * 12) * dt; p.y += p.vy * dt;
    ctx.fillStyle = p.c;
    const hh = Math.max(1, Math.round(p.h * Math.abs(Math.cos(p.ph))));
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w, hh);
  }
  confetti = confetti.filter(p => p.t > 0 && p.y < H + 5);
}
function bigHint(text) {
  ctx.font = '8px "Press Start 2P", monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 12, h = 16;
  const x = Math.round(W / 2 - w / 2), y = Math.round(C.oy + (H - C.oy) * 0.12);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#ff8a1f'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'; ctx.fillText(text, x + 6, y + 4);
}
function arrowHint(ex) {
  const blink = Math.floor(run.time * 6) & 1;
  if (!blink) return;
  ctx.fillStyle = '#ffd83a'; ctx.strokeStyle = '#000';
  const y = Math.round(C.oy - 26);
  const draw = (dir) => {
    const cx = W / 2 + dir * 30;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 10, y); ctx.lineTo(cx - dir * 2, y - 9); ctx.lineTo(cx - dir * 2, y - 4); ctx.lineTo(cx - dir * 10, y - 4);
    ctx.lineTo(cx - dir * 10, y + 4); ctx.lineTo(cx - dir * 2, y + 4); ctx.lineTo(cx - dir * 2, y + 9); ctx.closePath();
    ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
  };
  if (ex === 'L' || ex === 'T') draw(-1);
  if (ex === 'R' || ex === 'T') draw(1);
}

// Menü-Hintergrund: Timo läuft durch den Park
function renderMenuBg(dt) {
  if (!run) newRun();
  run.time += dt; run.animT += dt;
  run.pa += dt * 5; run.dist += dt * 5;
  if (run.pa > run.cur.L - HW - 1) { run.turnQ = run.cur.exits === 'T' ? 'R' : run.cur.exits; doTurn(); }
  run.vetGap = 9;
  updateCam(dt);
  render();
}

// ---------- HUD & Bildschirme ----------
const $ = id => document.getElementById(id);
const screens = ['scrMenu', 'scrHelp', 'scrShop', 'scrBest', 'scrPause', 'scrOver'];
let screenStack = [];
function show(id) { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); }
function hideAll() { screens.forEach(s => $(s).classList.add('hidden')); }
let bannerT = 0;
function showBanner(t, sub) { const b = $('banner'); b.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); b.classList.remove('hidden'); bannerT = 4.2; }
function score() { return Math.floor(run.dist) + run.coins * 10; }
let lastEffKey = '';
function updateHUD() {
  $('hScore').textContent = score();
  $('hMeter').textContent = Math.floor(run.dist) + ' m · Level ' + (run.level + 1);
  $('hKKn').textContent = run.coins;
  const act = Object.keys(run.eff).filter(k => run.eff[k] > 0);
  const key = act.join(',');
  if (key !== lastEffKey) {
    lastEffKey = key;
    $('hEffects').innerHTML = act.map(k => '<div class="eff" data-k="' + k + '"><canvas width="' + SPR[k].width + '" height="' + SPR[k].height + '"></canvas><div class="bar"><i></i></div></div>').join('');
    $('hEffects').querySelectorAll('.eff').forEach(el => { const k = el.dataset.k; el.querySelector('canvas').getContext('2d').drawImage(SPR[k], 0, 0); });
  }
  $('hEffects').querySelectorAll('.eff').forEach(el => { const k = el.dataset.k; el.querySelector('i').style.width = Math.min(100, 100 * run.eff[k] / puDur(k)) + '%'; });
}

function startGame(forceTut) {
  audioUnlock();
  requestTilt();
  const tut = forceTut === true || !save.tutDone;
  newRun(tut);
  run.firstSeg0 = run.cur;
  music.start('park');
  state = 'play';
  hideAll();
  $('hud').classList.remove('hidden');
  lastEffKey = '#';
  if (tut) showBanner('Kurzes Tutorial', 'So steuerst du Timo'); else showBanner('Level 1: ' + THEMES[0].name, 'Lauf, Timo, lauf!');
  $('tut').classList.add('hidden');
}
function finishTutorial() {
  save.tutDone = true; persist();
  run.vetIntro = 3.5; run.vetSay = 'Timo! Impftermin!'; run.vetSayT = 3.5;
  showBanner('Super gemacht!', 'Jetzt geht es richtig los. Dr. Spritz ist hinter dir her!' + (tiltOn() ? ' Tipp: Kipp das Handy, um die Spur zu wechseln.' : ''));
}
function pauseGame() { if (state !== 'play') return; state = 'paused'; music.stop(); show('scrPause'); }
function resumeGame() { state = 'play'; hideAll(); last = performance.now(); if (run) music.start(run.cur.theme.key); tilt.base = null; }
function quitGame() { music.stop(); $('tut').classList.add('hidden'); state = 'menu'; $('hud').classList.add('hidden'); run = null; openMenu(); }

const PLACES = { park: 'Stadtpark', amt: 'Bürgeramt, Wartebereich', sofa: 'Sofa-Paradies, Abteilung Polster' };
function anzeigeText() {
  const r = run, c = r.deathCause, o = r.deathObs, place = PLACES[r.cur.theme.key];
  if (c === 'fall') {
    const t = r.cur.theme.key;
    return { gegen: t === 'park' ? 'Stadtverwaltung, Tiefbauamt' : t === 'amt' ? 'Bürgeramt (Hausmeister)' : 'Sofa-Paradies GmbH',
      ort: place, grund: pick(['Loch im Boden nicht abgesichert! Timo ist reingeplumpst.', 'Fehlendes Warnschild vor der Grube.', 'Boden einfach weg. So geht das nicht!']) };
  }
  if (c === 'wall') {
    const t = r.cur.theme.key;
    return { gegen: t === 'park' ? 'Stadtgärtnerei' : t === 'amt' ? 'Bürgeramt (Hausmeister)' : 'Sofa-Paradies GmbH',
      ort: place, grund: pick(['Kurve nicht ausgeschildert. Timo hat sich die Nase gestoßen.', 'Wand mitten im Fluchtweg. Unerhört!', 'Fehlende Abbiegespur für Hunde.']) };
  }
  const what = o ? o.def.name : 'Hindernis';
  return { gegen: 'Dr. Spritz (Tierarzt)', ort: place,
    grund: pick(['Verfolgung mit einer riesigen Spritze', 'Unerlaubtes Impfen ohne Termin', 'Hinterhältiges Auflauern hinter dem Hindernis "' + what + '"', 'Grober Missbrauch von Leckerli als Köder']) + '. Außerdem: "' + what + '" stand im Weg.' };
}
// ---------- Bestenliste: online (Supabase, wie bei der Shake-Bar), sonst auf dem Gerät ----------
const SB_URL = 'https://ebhtxhjyzdhpmumcdnhs.supabase.co';
const SB_KEY = 'sb_publishable_1O5YzhrAcz8TDItiZvhYjg_mQIRjJuh';
let online = null, markId = null;
function sbFetch(path, opts) {
  opts = opts || {};
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 7000);
  return fetch(SB_URL + '/rest/v1/' + path, Object.assign({}, opts, { signal: ctrl.signal,
    headers: Object.assign({ apikey: SB_KEY, 'Content-Type': 'application/json' }, opts.headers || {}) }))
    .then(r => { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 ? null : r.json(); })
    .catch(e => { clearTimeout(t); throw e; });
}
function loadOnline() {
  return sbFetch('ttr_scores?select=id,name,score&order=score.desc,created_at.asc&limit=10')
    .then(rows => { online = Array.isArray(rows) ? rows : []; return online; })
    .catch(() => { online = null; return null; });
}
const activeList = () => online || save.best;
const qualifiesFor = sc => { const l = activeList(); return sc > 0 && (l.length < 10 || sc > l[l.length - 1].score); };

let lastEntry = null;
function gameOver() {
  state = 'over';
  music.stop(); $('tut').classList.add('hidden');
  setTimeout(() => timoBark('over'), 900);
  sfx.over();
  $('hud').classList.add('hidden');
  const sc = score();
  save.kk += run.coins; persist();
  const az = anzeigeText();
  $('azGegen').textContent = az.gegen; $('azOrt').textContent = az.ort; $('azGrund').textContent = az.grund;
  $('oScore').textContent = sc; $('oMeter').textContent = Math.floor(run.dist); $('oKK').textContent = run.coins;
  const best = save.best[0] ? save.best[0].score : 0;
  $('newBest').classList.toggle('hidden', !(sc > best));
  $('nameIn').value = save.name || '';
  lastEntry = { score: sc, meter: Math.floor(run.dist), kk: run.coins, date: Date.now() };
  markId = null;
  const decide = () => {
    const q = qualifiesFor(sc);
    $('nameForm').classList.toggle('hidden', !q);
    $('overBest').classList.toggle('hidden', q);
    if (!q) fillBest($('overBest'));
  };
  decide();
  loadOnline().then(() => { if (state === 'over' && !$('nameForm').dataset.sent) decide(); });
  delete $('nameForm').dataset.sent;
  show('scrOver');
}
$('nameForm').addEventListener('submit', e => {
  e.preventDefault();
  if ($('nameForm').dataset.sent) return;
  $('nameForm').dataset.sent = '1';
  const name = ($('nameIn').value || '').trim().slice(0, 12) || 'Timo-Fan';
  save.name = name;
  const entry = Object.assign({ name }, lastEntry);
  save.best.push(entry);
  save.best.sort((a, b) => b.score - a.score);
  save.best = save.best.slice(0, 10);
  persist();
  markId = entry;
  $('nameIn').blur();
  $('nameForm').classList.add('hidden');
  $('overBest').classList.remove('hidden');
  fillBest($('overBest'));
  sbFetch('ttr_scores?select=id', { method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: entry.name, score: entry.score, meter: entry.meter, kroketten: entry.kk }) })
    .then(rows => { markId = rows && rows[0] ? rows[0].id : entry; return loadOnline(); })
    .catch(() => {})
    .then(() => fillBest($('overBest')));
});
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fillBest(el) {
  const l = activeList();
  const head = '<li class="head">' + (online ? 'Online-Bestenliste (alle Spieler)' : 'Bestenliste (dieses Gerät)') + '</li>';
  if (!l.length) { el.innerHTML = head + '<li class="empty">Noch keine Einträge. Lauf los!</li>'; return; }
  el.innerHTML = head + l.map((b, i) => '<li class="' + ((markId !== null && (b === markId || b.id === markId)) ? 'me' : '') + '"><span>' + (i + 1) + '.</span><span class="n">' + esc(b.name) + '</span><span class="s">' + b.score + '</span></li>').join('');
}

const SHOP = [
  { id: 'magnet', type: 'up', title: 'Magnet', desc: k => 'Dauer: ' + puDur(k) + ' s' },
  { id: 'shield', type: 'up', title: 'Schild', desc: k => 'Dauer: ' + puDur(k) + ' s' },
  { id: 'turbo', type: 'up', title: 'Espresso-Turbo', desc: k => 'Dauer: ' + puDur(k).toFixed(1) + ' s' },
  { id: 'fax', type: 'up', title: 'Faxmaschine', desc: k => 'Dauer: ' + puDur(k) + ' s' },
  { id: 'startShield', spr: 'shield', type: 'inv', title: 'Start-Schild', price: 60, desc: () => 'Nächster Lauf startet mit Schild' },
  { id: 'startTurbo', spr: 'turbo', type: 'inv', title: 'Turbo-Start', price: 120, desc: () => 'Nächster Lauf startet mit 6 s Turbo' },
];
const UP_PRICES = [100, 250, 500, 900, 1500];
function renderShop() {
  $('sKK').textContent = save.kk;
  $('shopList').innerHTML = SHOP.map(it => {
    let price, lvl = '', can;
    if (it.type === 'up') { const l = save.up[it.id]; price = l < 5 ? UP_PRICES[l] : null; lvl = '<span class="lvl">' + '■'.repeat(l) + '□'.repeat(5 - l) + '</span>'; }
    else { price = it.price; lvl = '<span class="lvl">Vorrat: ' + save.inv[it.id] + '</span>'; }
    can = price != null && save.kk >= price;
    return '<div class="shop-item"><canvas data-spr="' + (it.spr || it.id) + '"></canvas><div class="info"><b>' + it.title + '</b><small>' + it.desc(it.id) + '</small>' + lvl + '</div>' +
      '<button class="btn" data-buy="' + it.id + '"' + (can ? '' : ' disabled') + '>' + (price == null ? 'MAX' : price + ' <span class="kk-ico"></span>') + '</button></div>';
  }).join('');
  paintCanvases($('shopList'));
}
$('shopList').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]'); if (!b || b.disabled) return;
  const it = SHOP.find(s => s.id === b.dataset.buy);
  if (it.type === 'up') { const l = save.up[it.id]; if (l >= 5 || save.kk < UP_PRICES[l]) return; save.kk -= UP_PRICES[l]; save.up[it.id]++; }
  else { if (save.kk < it.price) return; save.kk -= it.price; save.inv[it.id]++; }
  persist(); audioUnlock(); sfx.power(); renderShop();
});
function paintCanvases(root) {
  root.querySelectorAll('canvas[data-spr]').forEach(c => {
    const s = SPR[c.dataset.spr]; c.width = s.width; c.height = s.height;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0);
  });
}
function openMenu() { music.stop(); $('mKK').textContent = save.kk; $('btnSound').textContent = 'Ton: ' + (save.mute ? 'aus' : 'an'); $('btnTilt').textContent = 'Kippen: ' + (save.tilt ? 'an' : 'aus'); $('btnTilt').classList.toggle('hidden', !isTouch); show('scrMenu'); }

$('btnStart').onclick = () => startGame();
$('btnAgain').onclick = () => startGame();
$('btnTut').onclick = () => startGame(true);
$('btnTilt').onclick = () => { save.tilt = !save.tilt; persist(); if (save.tilt) requestTilt(); openMenu(); };
$('heroWrap').onclick = () => { audioUnlock(); timoBark('menu'); };
setInterval(() => { if (!$('scrMenu').classList.contains('hidden')) $('heroWrap').classList.toggle('front'); }, 3500);
$('overTimo').onclick = () => { audioUnlock(); timoBark('over'); };
$('btnMenu').onclick = () => { state = 'menu'; run = null; openMenu(); };
$('btnShop').onclick = () => { renderShop(); show('scrShop'); };
$('btnBest').onclick = () => { markId = null; fillBest($('bestList')); show('scrBest'); loadOnline().then(() => fillBest($('bestList'))); };
$('btnHelp').onclick = () => { show('scrHelp'); };
$('btnSound').onclick = () => { save.mute = !save.mute; persist(); audioUnlock(); openMenu(); };
$('btnPause').onclick = e => { e.stopPropagation(); pauseGame(); };
$('btnResume').onclick = resumeGame;
$('btnQuit').onclick = quitGame;
document.querySelectorAll('[data-back]').forEach(b => b.onclick = openMenu);

// ---------- Hauptschleife ----------
let last = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.add('hidden'); }
  if (state === 'play') {
    // feinere Schritte bei hohem Tempo
    const n = Math.ceil(dt / 0.017);
    for (let i = 0; i < n && state === 'play'; i++) { run.lastDt = dt / n; update(dt / n); }
    if (run) { render(); drawConfetti(dt); }
  } else if (state === 'menu') {
    renderMenuBg(dt);
  } else if (run) {
    render();
  }
  requestAnimationFrame(frame);
}

// ---------- Neigungssteuerung (wie beim Kippen des Handys) ----------
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const tilt = { base: null, armed: true, perm: null, seen: false };
function tiltOn() { return isTouch && save.tilt && tilt.perm !== false; }
function requestTilt() {
  if (!isTouch || !save.tilt || tilt.perm === true) return;
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => { tilt.perm = r === 'granted'; }).catch(() => { tilt.perm = false; });
  } else tilt.perm = true;
}
window.addEventListener('deviceorientation', e => {
  if (!tiltOn() || state !== 'play' || !run || run.dying) return;
  const ang = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
  let v = (ang === 90) ? e.beta : (ang === 270 || ang === -90) ? -e.beta : e.gamma;
  if (v == null) return;
  tilt.seen = true;
  if (tilt.base === null) { tilt.base = v; tilt.ds = 0; tilt.steps = 0; tilt.dir = 0; return; }
  // geglättet, damit kleines Zittern nichts auslöst
  tilt.ds = lerp(tilt.ds || 0, v - tilt.base, 0.4);
  const d = tilt.ds, ad = Math.abs(d), dir = d > 0 ? 1 : -1, now = performance.now();
  if (ad < 6) { // zurück in der Mitte: wieder bereit, langsam nachkalibrieren
    tilt.steps = 0; tilt.dir = 0;
    tilt.base = lerp(tilt.base, v, 0.03);
    return;
  }
  if (tilt.dir !== 0 && dir !== tilt.dir) { tilt.steps = 0; tilt.dir = 0; } // direkt auf die andere Seite gekippt
  // 1. Schritt ab 11°, 2. Schritt ab 22° oder wenn man gekippt hält
  const want = ad > 22 ? 2 : ad > 11 ? 1 : 0;
  const hold = tilt.steps === 1 && ad > 11 && now - tilt.t > 380;
  if (want > tilt.steps || hold) {
    if (tilt.steps < 2 && (tilt.steps === 0 || now - tilt.t > 120)) {
      tilt.steps++; tilt.dir = dir; tilt.t = now;
      onInput(dir > 0 ? 'right' : 'left', true);
    }
  }
});

// ---------- Timo bellt ----------
function timoBark(where) {
  if (where === 'menu') $('heroWrap').classList.add('front');
  const img = $(where === 'menu' ? 'menuTimoFront' : 'overTimo'), w = $(where === 'menu' ? 'menuWuff' : 'overWuff');
  if (!img || img.offsetParent === null) return;
  img.classList.remove('bark'); void img.offsetWidth; img.classList.add('bark');
  w.textContent = pick(['WUFF!', 'WUFF WUFF!', 'WAU!', 'GRRR… WUFF!']);
  w.classList.remove('hidden');
  sfx.bark();
  clearTimeout(w._t); w._t = setTimeout(() => { w.classList.add('hidden'); img.classList.remove('bark'); }, 1100);
}
setInterval(() => {
  if (state === 'over' && Math.random() < 0.3) timoBark('over');
  if (state === 'menu' && !$('scrMenu').classList.contains('hidden') && Math.random() < 0.15) timoBark('menu');
}, 6000);

// Timo von hinten aus dem Bild des Besitzers: Lauf-Animation durch Beine anheben
function buildTimoFrames(img) {
  const w = img.width, h = img.height, legY = Math.round(h * 0.79), mid = Math.round(w / 2);
  const mk = (lo, ro, bob) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h + 4;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, legY, mid, h - legY, 0, legY + 4 - bob - lo, mid, h - legY);
    g.drawImage(img, mid, legY, w - mid, h - legY, mid, legY + 4 - bob - ro, w - mid, h - legY);
    g.drawImage(img, 0, 0, w, legY, 0, 4 - bob, w, legY);
    return c;
  };
  SPR.timoA = mk(4, 0, 1); SPR.timoB = mk(0, 4, 1); SPR.timoJ = mk(5, 5, 0);
  SPR.timoReal = true;
}
function buildVetFrames(img) {
  const w = img.width, h = img.height, legY = Math.round(h * 0.74), mid = Math.round(w * 0.45), k = h / 84, pad = Math.round(4 * k);
  const mk = (lo, ro) => {
    lo = Math.round(lo * k); ro = Math.round(ro * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h + pad;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, legY, mid, h - legY, 0, legY + pad - lo, mid, h - legY);
    g.drawImage(img, mid, legY, w - mid, h - legY, mid, legY + pad - ro, w - mid, h - legY);
    g.drawImage(img, 0, 0, w, legY, 0, pad, w, legY);
    c.smooth = true;
    return c;
  };
  SPR.vetA = mk(5, 0); SPR.vetB = mk(0, 5); SPR.vetReal = true;
}

function init() {
  buildSprites();
  const ti = new Image(); ti.onload = () => buildTimoFrames(ti); ti.src = 'assets/timo-hinten.png?v=7';
  const li = new Image(); li.onload = () => { SPR.lamp = li; }; li.src = 'assets/laterne.png?v=1';
  const se = new Image(); se.onload = () => { SPR.sessel = se; }; se.src = 'assets/sessel.png?v=1';
  const hy = new Image(); hy.onload = () => { SPR.hydrant = hy; }; hy.src = 'assets/hydrant.png?v=1';
  const di = new Image(); di.onload = () => { SPR.timoDuck = di; }; di.src = 'assets/timo-ducken.png?v=8';
  const si = new Image(); si.onload = () => { SPR.timoSlide = si; }; si.src = 'assets/timo-slide.png?v=8';
  const vi = new Image(); vi.onload = () => buildVetFrames(vi); vi.src = 'assets/tierarzt-hinten.png?v=10';
  const icoURL = (() => { const c = document.createElement('canvas'); c.width = SPR.kk.width * 2; c.height = SPR.kk.height * 2; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(SPR.kk, 0, 0, c.width, c.height); return c.toDataURL(); })();
  const st = document.createElement('style'); st.textContent = '.kk-ico{background-image:url(' + icoURL + ')!important}'; document.head.appendChild(st);
  paintCanvases(document);
  openMenu();
  requestAnimationFrame(frame);
}
if (document.fonts && document.fonts.load) {
  Promise.race([document.fonts.load('8px "Press Start 2P"'), new Promise(r => setTimeout(r, 1500))]).then(init, init);
} else init();
