/* ====== Canvas Management ====== */
'use strict';
function initCvs() {
  cvs.bg = $('bgC'); cvs.C = $('lC'); cvs.B = $('lB'); cvs.A = $('lA');
  cvs.on = $('onC'); cvs.dr = $('drC'); cvs.fl = $('floatC'); cvs.st = $('strokeC');
}

function initCanvas() {
  $('cw').style.width = CW + 'px'; $('cw').style.height = CH + 'px';
  Object.keys(cvs).forEach(k => {
    cvs[k].width = CW; cvs[k].height = CH;
    cx[k] = cvs[k].getContext('2d', {willReadFrequently: k==='A'||k==='B'||k==='C'});
  });
  $('selPath').setAttribute('viewBox', `0 0 ${CW} ${CH}`);
  updZO(); fitView();
}

function updZO() {
  layerOrder.forEach((l, i) => { cvs[l].style.zIndex = 3 + i; });
}

function fitView() {
  const v = $('vp'), aw = v.clientWidth - 16, ah = v.clientHeight - 16;
  S.zoom = Math.min(aw / CW, ah / CH, 2);
  S.panX = 0; S.panY = 0; updT();
}

function updT() {
  $('cw').style.transform = `translate(${S.panX}px,${S.panY}px) scale(${S.zoom})`;
  $('zDisp').textContent = Math.round(S.zoom * 100) + '%';
}

function s2c(ex, ey) {
  const r = $('cw').getBoundingClientRect();
  return { x: (ex - r.left) * (CW / r.width), y: (ey - r.top) * (CH / r.height) };
}

function updPC() {
  cx.bg.fillStyle = S.pc; cx.bg.fillRect(0, 0, CW, CH);
}

function mkFrame() { return { id: uid(), sfx: '', thumbDirty: true }; }
function getCache(fid) {
  if (!S.fc.has(fid)) S.fc.set(fid, {A:null, B:null, C:null});
  return S.fc.get(fid);
}

function snapToCache() {
  const c = getCache(curId());
  ['A','B','C'].forEach(l => { c[l] = cx[l].getImageData(0, 0, CW, CH); });
}

function markDirty(fid, layer) {
  S.dirtyIds.add(fid);
  if (!S.dirtyLayers.has(fid)) S.dirtyLayers.set(fid, new Set());
  S.dirtyLayers.get(fid).add(layer);
  debounceSave();
}
function markAllDirtyForFrame(fid) { ['A','B','C'].forEach(l => markDirty(fid, l)); }

function cacheToCanvas(fid) {
  const c = S.fc.get(fid);
  [['A','A'],['B','B'],['C','C']].forEach(([k, cv]) => {
    cx[cv].clearRect(0, 0, CW, CH);
    if (c && c[k]) cx[cv].putImageData(c[k], 0, 0);
  });
  updOn();
  $('curF').textContent = S.cf + 1;
}

async function ensureCached(fid) {
  if (S.fc.has(fid)) return S.fc.get(fid);
  const c = {A:null, B:null, C:null};
  for (const l of ['A','B','C']) { try { c[l] = await DB.loadLayer(fid, l, CW, CH); } catch(e) {} }
  S.fc.set(fid, c); return c;
}

function evictFar() {
  const keepIds = new Set();
  for (let i = Math.max(0, S.cf-10); i <= Math.min(S.frames.length-1, S.cf+10); i++)
    keepIds.add(S.frames[i].id);
  for (const [fid] of S.fc) {
    if (!keepIds.has(fid) && !S.dirtyIds.has(fid)) S.fc.delete(fid);
  }
}

let _plT = null;
function schedulePreload() { if (_plT) return; _plT = setTimeout(() => { _plT = null; preloadNearby(); }, 80); }
async function preloadNearby() {
  const lo = Math.max(0, S.cf-18), hi = Math.min(S.frames.length-1, S.cf+18);
  for (let i = lo; i <= hi; i++) {
    const fid = S.frames[i].id;
    if (!S.fc.has(fid)) {
      await ensureCached(fid);
      const fm = S.frames[i];
      let tc = thumbs.get(fm.id);
      if (!tc) { tc = document.createElement('canvas'); tc.width = TW; tc.height = TH; thumbs.set(fm.id, tc); }
      if (fm.thumbDirty || !tc._rendered) {
        renderThumb(fm.id, tc, false); fm.thumbDirty = false; tc._rendered = true;
        const el = $('tls');
        if (el && el.children[i]) {
          const dc = el.children[i].querySelector('canvas');
          if (dc) dc.getContext('2d').drawImage(tc, 0, 0);
        }
      }
    }
  }
}

// IDB persistence
let _saveT = null;
function debounceSave() { if (_saveT) return; _saveT = setTimeout(async () => { _saveT = null; await flushIDB(); }, 2500); }
async function flushIDB() {
  if (!DB.db || !S.dirtyIds.size) return;
  const ids = new Set(S.dirtyIds); S.dirtyIds.clear();
  const layers = new Map(S.dirtyLayers); S.dirtyLayers.clear();
  for (const fid of ids) {
    const c = S.fc.get(fid); if (!c) continue;
    const ls = layers.get(fid) || new Set(['A','B','C']);
    for (const l of ls) { try { await DB.saveLayer(fid, l, c[l]); } catch(e) {} }
  }
  try {
    await DB.saveMeta({
      w: CW, h: CH, pc: S.pc, fps: S.fps, ratio: S.ratio, cf: S.cf, lo: layerOrder,
      memoId: S.currentMemoId,
      frames: S.frames.map(f => ({id: f.id, sfx: f.sfx}))
    });
  } catch(e) {}
  const si = $('saveInd'); si.classList.add('show');
  clearTimeout(si._t); si._t = setTimeout(() => si.classList.remove('show'), 1200);
}

function updOn() {
  cx.on.clearRect(0, 0, CW, CH);
  if (!S.onion || S.cf === 0) { cvs.on.style.opacity = '0'; return; }
  cvs.on.style.opacity = '.2';
  const pf = S.frames[S.cf - 1]; if (!pf) return;
  const pc = S.fc.get(pf.id);
  if (pc && pc.A) {
    cx.on.putImageData(pc.A, 0, 0);
    cx.on.globalCompositeOperation = 'source-atop';
    cx.on.fillStyle = 'rgba(255,80,80,.3)';
    cx.on.fillRect(0, 0, CW, CH);
    cx.on.globalCompositeOperation = 'source-over';
  }
}

function renderThumb(fid, tc, isCurrent) {
  const x = tc.getContext('2d');
  if (isCurrent) {
    x.fillStyle = S.pc; x.fillRect(0, 0, TW, TH);
    layerOrder.forEach(l => { if (cvs[l].style.display !== 'none') x.drawImage(cvs[l], 0, 0, TW, TH); });
  } else {
    const c = S.fc.get(fid);
    if (!c) return false;
    x.fillStyle = S.pc; x.fillRect(0, 0, TW, TH);
    const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
    const tx = tmp.getContext('2d');
    layerOrder.forEach(l => {
      if (c[l]) { tx.clearRect(0, 0, CW, CH); tx.putImageData(c[l], 0, 0); x.drawImage(tmp, 0, 0, TW, TH); }
    });
  }
  return true;
}
