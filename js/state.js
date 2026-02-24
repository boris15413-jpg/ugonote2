/* ====== State Management ====== */
'use strict';
const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'f'+Date.now()+Math.random().toString(36).slice(2,8);
const $ = id => document.getElementById(id);

// SFX definitions
const SFX = {
  _c: null,
  ctx() { if (!this._c) this._c = new(window.AudioContext || window.webkitAudioContext)(); return this._c; },
  play(t) {
    const c = this.ctx(), n = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    const D = {click:[800,.05,'square'], pop:[600,.15,'sine'], swoosh:[1200,.2,'sawtooth'], boing:[200,.3,'sine'], bell:[1047,.5,'sine']};
    if (!D[t]) return;
    o.type = D[t][2]; o.frequency.value = D[t][0];
    g.gain.setValueAtTime(.3, n); g.gain.exponentialRampToValueAtTime(.001, n + D[t][1]);
    o.start(n); o.stop(n + D[t][1]);
  }
};

// Canvas dimensions
let CW = 512, CH = 384, layerOrder = ['C','B','A'];
const TW = 112, TH = 84;

// Main state
const S = {
  frames: [],
  fc: new Map(),         // frame cache: uuid -> {A,B,C}
  dirtyIds: new Set(),
  dirtyLayers: new Map(),
  cf: 0, cl: 'A', ct: 'pen', cc: '#111111', cs: 4, alpha: 1, pc: '#FFFFFF',
  zoom: 1, panX: 0, panY: 0,
  drawing: false, panning: false, playing: false, onion: false, fps: 8,
  lx: 0, ly: 0, sx: 0, sy: 0,
  sel: null, clip: null, frClip: null,
  txX: 0, txY: 0, txFs: 28,
  undoStack: [], redoStack: [], maxUndo: 50,
  bgmBuf: null, bgmVol: 0.8, ratio: '4:3', lassoPath: [],
  penOut: false, penOutC: '#FFFFFF', penOutW: 3,
  pts: [], eSnap: null, img: null,
  // Gallery
  currentMemoId: null, galleryList: [],
  // Hue for SV picker
  hue: 0, sat: 0, val: 0
};

const thumbs = new Map();
const cvs = {};
const cx = {};

function curFr() { return S.frames[S.cf]; }
function curId() { return S.frames[S.cf]?.id; }
function curC() { return cvs[S.cl]; }
function curX() { return cx[S.cl]; }

function toast(m) {
  const t = $('toast');
  t.textContent = m; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2000);
}
