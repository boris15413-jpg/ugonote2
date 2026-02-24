/* ====== Viewer ====== */
'use strict';
let vwPlaying = false, vwRAF = null;

function initViewer() {
  $('vwPlayBtn').onclick = () => vwPlaying ? vwStop() : vwPlay();
  $('vwFirstBtn').onclick = () => { if (S.cf > 0) { S.cf = 0; vwRenderFrame(); } };
  $('vwLastBtn').onclick = () => { if (S.cf < S.frames.length-1) { S.cf = S.frames.length-1; vwRenderFrame(); } };
  $('vwPrevBtn').onclick = () => { if (S.cf > 0) { S.cf--; vwRenderFrame(); } };
  $('vwNextBtn').onclick = () => { if (S.cf < S.frames.length-1) { S.cf++; vwRenderFrame(); } };
  $('vwBackBtn').onclick = () => { vwStop(); showScreen('gallery'); };
}

function initViewerPlayback() {
  vwRenderFrame();
  setTimeout(vwPlay, 300);
}

function vwRenderFrame() {
  const vc = $('viewerCvs');
  vc.width = CW; vc.height = CH;
  const vx = vc.getContext('2d');
  vx.fillStyle = S.pc; vx.fillRect(0, 0, CW, CH);
  const c = S.fc.get(S.frames[S.cf]?.id);
  if (c) {
    const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
    const tx = tmp.getContext('2d');
    layerOrder.forEach(l => {
      if (c[l]) { tx.clearRect(0,0,CW,CH); tx.putImageData(c[l], 0, 0); vx.drawImage(tmp, 0, 0); }
    });
  }
  $('vwFrameNum').textContent = S.cf + 1;
  $('vwFrameTotal').textContent = S.frames.length;
}

async function vwPlay() {
  if (S.frames.length < 2) return;
  for (let i = 0; i < S.frames.length; i++) await ensureCached(S.frames[i].id);
  vwPlaying = true;
  const t0 = performance.now(), f0 = S.cf;
  let lastFi = -1;
  function tick(now) {
    if (!vwPlaying) return;
    const elapsed = (now - t0) / 1000;
    const fi = f0 + Math.floor(elapsed * S.fps);
    if (fi >= S.frames.length) { vwStop(); return; }
    if (fi !== lastFi) { lastFi = fi; S.cf = fi; vwRenderFrame(); }
    vwRAF = requestAnimationFrame(tick);
  }
  vwRAF = requestAnimationFrame(tick);
}

function vwStop() {
  vwPlaying = false;
  if (vwRAF) { cancelAnimationFrame(vwRAF); vwRAF = null; }
}
