/* ====== Playback ====== */
'use strict';
let playRAF, bgmSrc, playT0, playF0;

async function play() {
  if (S.frames.length < 2) return toast('2F以上必要');
  snapToCache();
  for (let i = 0; i < S.frames.length; i++) await ensureCached(S.frames[i].id);
  S.playing = true;
  $('playBtn').querySelector('.ico-play').style.display = 'none';
  $('playBtn').querySelector('.ico-stop').style.display = '';
  if (S.bgmBuf) {
    try {
      const ac = SFX.ctx(); bgmSrc = ac.createBufferSource();
      bgmSrc.buffer = S.bgmBuf;
      const gainNode = ac.createGain(); gainNode.gain.value = S.bgmVol;
      bgmSrc.connect(gainNode); gainNode.connect(ac.destination);
      bgmSrc.start(0, (S.cf / S.frames.length) * (S.frames.length / S.fps));
    } catch(e) {}
  }
  playT0 = performance.now(); playF0 = S.cf;
  let lastFi = -1;
  function tick(now) {
    if (!S.playing) return;
    const elapsed = (now - playT0) / 1000;
    const fi = playF0 + Math.floor(elapsed * S.fps);
    if (fi >= S.frames.length) { stop(); return; }
    if (fi !== lastFi) {
      lastFi = fi;
      const fid = S.frames[fi].id;
      const c = S.fc.get(fid);
      if (c) {
        [['A','A'],['B','B'],['C','C']].forEach(([k,cv]) => {
          cx[cv].clearRect(0,0,CW,CH);
          if (c[k]) cx[cv].putImageData(c[k], 0, 0);
        });
      }
      S.cf = fi; $('curF').textContent = fi + 1;
      const items = $('tls').children;
      for (let j = 0; j < items.length; j++) items[j].classList.toggle('on', j === fi);
      if (items[fi]) items[fi].scrollIntoView({behavior:'auto', inline:'center', block:'nearest'});
      if (S.frames[fi].sfx) SFX.play(S.frames[fi].sfx);
    }
    playRAF = requestAnimationFrame(tick);
  }
  playRAF = requestAnimationFrame(tick);
}

function stop() {
  S.playing = false;
  if (playRAF) { cancelAnimationFrame(playRAF); playRAF = null; }
  $('playBtn').querySelector('.ico-play').style.display = '';
  $('playBtn').querySelector('.ico-stop').style.display = 'none';
  if (bgmSrc) try { bgmSrc.stop(); } catch(e) {}
  cacheToCanvas(curId()); renderTL();
  if (syncRec && syncRec.state === 'recording') syncRec.stop();
}

function initPlayback() {
  $('playBtn').onclick = () => S.playing ? stop() : play();
  $('firstFBtn').onclick = () => { if (S.cf > 0) swF(0); };
  $('lastFBtn').onclick = () => { if (S.cf < S.frames.length-1) swF(S.frames.length-1); };
  $('prevFBtn').onclick = () => { if (S.cf > 0) swF(S.cf - 1); };
  $('nextFBtn').onclick = () => { if (S.cf < S.frames.length-1) swF(S.cf + 1); };
  $('fpsR').oninput = e => { S.fps = +e.target.value; $('fpsN').textContent = S.fps; if (S.playing) { stop(); play(); } };

  // Frame operations (from timeline controls)
  $('addFBtn').onclick = addF;
  $('delFBtn').onclick = delF;
  $('cpFBtn').onclick = () => {
    snapToCache(); const c = S.fc.get(curId()); const cl = {};
    ['A','B','C'].forEach(k => { cl[k] = c && c[k] ? new ImageData(new Uint8ClampedArray(c[k].data), CW, CH) : null; });
    S.frClip = {cache:cl, sfx:curFr().sfx}; toast('F複写');
  };
  $('psFBtn').onclick = () => {
    if (!S.frClip) return toast('コピーなし');
    const nf = mkFrame(); nf.sfx = S.frClip.sfx;
    const nc = {}; ['A','B','C'].forEach(k => { nc[k] = S.frClip.cache[k] ? new ImageData(new Uint8ClampedArray(S.frClip.cache[k].data), CW, CH) : null; });
    S.frames.splice(S.cf+1, 0, nf); S.fc.set(nf.id, nc); S.cf++;
    cacheToCanvas(curId()); markAllDirtyForFrame(nf.id); renderTL(); toast('F貼付');
  };

  // Goto frame
  $('frameCounterClick').onclick = () => {
    $('gotoNum').value = S.cf + 1; $('gotoMax').textContent = S.frames.length;
    $('gotoMo').classList.add('show'); $('gotoNum').focus();
  };
  $('gotoOk').onclick = () => {
    const n = Math.max(1, Math.min(S.frames.length, +$('gotoNum').value)) - 1;
    $('gotoMo').classList.remove('show'); if (n !== S.cf) swF(n);
  };

  // Bulk add
  $('addMFBtn').onclick = () => $('addMMo').classList.add('show');
  $('addMOk').onclick = () => {
    const n = Math.max(1, Math.min(200, +$('addMNum').value));
    $('addMMo').classList.remove('show'); snapToCache();
    for (let i = 0; i < n; i++) {
      const nf = mkFrame();
      const nc = {A:null, B:null, C:null};
      S.frames.splice(S.cf+1+i, 0, nf); S.fc.set(nf.id, nc); markAllDirtyForFrame(nf.id);
    }
    S.cf += n; ensureCached(curId()).then(() => cacheToCanvas(curId())); renderTL(); toast(n+'F追加');
  };

  // Timeline toggle
  $('tlToggle').onclick = () => {
    $('tls').classList.toggle('collapsed');
    $('tlToggle').classList.toggle('flipped');
    setTimeout(fitView, 250);
  };
}
