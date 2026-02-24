/* ====== Frame Management ====== */
'use strict';

async function swF(i) {
  if (S.playing || i < 0 || i >= S.frames.length) return;
  snapToCache();
  const oldId = curId();
  let otc = thumbs.get(oldId);
  if (!otc) { otc = document.createElement('canvas'); otc.width = TW; otc.height = TH; thumbs.set(oldId, otc); }
  renderThumb(oldId, otc, true); curFr().thumbDirty = false; otc._rendered = true;
  S.cf = i;
  await ensureCached(curId());
  cacheToCanvas(curId());
  evictFar(); renderTL();
}

function addF() {
  snapToCache();
  const oldId = curId();
  let otc = thumbs.get(oldId);
  if (!otc) { otc = document.createElement('canvas'); otc.width = TW; otc.height = TH; thumbs.set(oldId, otc); }
  renderThumb(oldId, otc, true); curFr().thumbDirty = false; otc._rendered = true;
  const nf = mkFrame();
  const nc = {A:null, B:null, C:null};
  S.frames.splice(S.cf + 1, 0, nf);
  S.fc.set(nf.id, nc); S.cf++;
  ['A','B','C'].forEach(l => cx[l].clearRect(0, 0, CW, CH));
  updOn(); markAllDirtyForFrame(nf.id); renderTL(); toast('フレーム追加');
}

function delF() {
  if (S.frames.length <= 1) {
    ['A','B','C'].forEach(k => cx[k].clearRect(0, 0, CW, CH));
    const fid = curId();
    S.fc.set(fid, {A:null, B:null, C:null}); snapToCache();
    markAllDirtyForFrame(fid); renderTL(); return;
  }
  const old = curFr();
  DB.deleteFrame(old.id).catch(() => {});
  S.fc.delete(old.id); thumbs.delete(old.id);
  S.frames.splice(S.cf, 1);
  if (S.cf >= S.frames.length) S.cf--;
  ensureCached(curId()).then(() => cacheToCanvas(curId()));
  renderTL();
}
