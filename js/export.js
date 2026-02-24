/* ====== Export ====== */
'use strict';
let pendingExp = '';

function initExport() {
  $('expGifBtn').onclick = () => showQualMo('gif');
  $('expMp4Btn').onclick = () => showQualMo('mp4');
  document.querySelectorAll('.qual-opt input').forEach(r => {
    r.onchange = () => document.querySelectorAll('.qual-opt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
  });
  $('qualOk').onclick = () => {
    $('qualMo').classList.remove('show');
    const q = document.querySelector('.qual-opt input:checked').value;
    pendingExp === 'gif' ? doExpGIF(q) : doExpMP4(q);
  };

  // Save/Load
  $('saveBtn').onclick = saveProject;
  $('loadBtn').onclick = () => $('projIn').click();
  $('projIn').onchange = loadProject;
}

function showQualMo(t) {
  pendingExp = t;
  $('qualLabel').textContent = t === 'gif' ? 'GIF' : 'WebM';
  $('qualDur').textContent = (S.frames.length / S.fps).toFixed(1);
  $('qualFr').textContent = S.frames.length;
  $('qualMo').classList.add('show');
  document.querySelectorAll('.qual-opt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
}

function renderFrameEx(tc, fid, ow, oh) {
  tc.fillStyle = S.pc; tc.fillRect(0, 0, ow, oh);
  const c = S.fc.get(fid); if (!c) return;
  const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
  const tx = tmp.getContext('2d');
  const mk = k => { if (!c[k]) return; tx.clearRect(0,0,CW,CH); tx.putImageData(c[k],0,0); tc.drawImage(tmp,0,0,ow,oh); };
  layerOrder.forEach(l => mk(l));
}

async function doExpGIF(q) {
  snapToCache();
  for (let i = 0; i < S.frames.length; i++) await ensureCached(S.frames[i].id);
  $('expMo').classList.add('show'); $('expTi').textContent = 'GIF生成中...';
  const sc = q==='low'?.5:1, ow = Math.round(CW*sc), oh = Math.round(CH*sc), delay = Math.round(1000/S.fps);
  const tmp = document.createElement('canvas'); tmp.width = ow; tmp.height = oh;
  const tc = tmp.getContext('2d');
  const framesData = [];
  for (let i = 0; i < S.frames.length; i++) {
    renderFrameEx(tc, S.frames[i].id, ow, oh);
    framesData.push(tc.getImageData(0,0,ow,oh).data.buffer);
    $('expBar').style.width = ((i+1)/S.frames.length*40)+'%';
    $('expMsg').textContent = `レンダリング ${i+1}/${S.frames.length}`;
    await new Promise(r => setTimeout(r, 2));
  }
  if (W) {
    const res = await wCall({type:'gifEncode', w:ow, h:oh, framesData, delay}, framesData, d => {
      $('expBar').style.width = (40 + d.frame/d.total*55) + '%';
      $('expMsg').textContent = `エンコード ${d.frame}/${d.total}`;
    });
    $('expBar').style.width = '100%';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([new Uint8Array(res.data)], {type:'image/gif'}));
    a.download = 'ugonote_' + Date.now() + '.gif'; a.click();
    $('expMo').classList.remove('show'); toast('GIF保存完了');
    return new Blob([new Uint8Array(res.data)], {type:'image/gif'});
  } else { $('expMo').classList.remove('show'); toast('Worker非対応'); return null; }
}

async function doExpMP4(q) {
  snapToCache();
  for (let i = 0; i < S.frames.length; i++) await ensureCached(S.frames[i].id);
  $('expMo').classList.add('show'); $('expTi').textContent = '動画生成中...'; $('expBar').style.width = '0%';
  const sc = q==='low'?.5:q==='mid'?1:1.5, bps = q==='low'?2e6:q==='mid'?4e6:8e6;
  const ow = Math.round(CW*sc), oh = Math.round(CH*sc);
  const ew = ow%2===0?ow:ow+1, eh = oh%2===0?oh:oh+1;
  const ec = document.createElement('canvas'); ec.width = ew; ec.height = eh;
  const ex = ec.getContext('2d');
  const mimes = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  let mime = mimes.find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { $('expMo').classList.remove('show'); return toast('非対応'); }
  const stream = ec.captureStream(S.fps);
  if (S.bgmBuf) {
    try {
      const ac = SFX.ctx(), ad = ac.createMediaStreamDestination();
      const src = ac.createBufferSource(); src.buffer = S.bgmBuf;
      const g = ac.createGain(); g.gain.value = S.bgmVol;
      src.connect(g); g.connect(ad);
      ad.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      src.start(0, 0, S.frames.length/S.fps);
    } catch(e) {}
  }
  const rec = new MediaRecorder(stream, {mimeType:mime, videoBitsPerSecond:bps}), chunks = [];
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  return new Promise(res => {
    rec.onstop = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, {type:mime}));
      a.download = `ugonote_${Date.now()}.webm`; a.click();
      $('expMo').classList.remove('show'); toast('WebM保存完了'); res();
    };
    rec.start(); let fi = 0; const fd = 1000/S.fps;
    const render = () => {
      renderFrameEx(ex, S.frames[fi].id, ew, eh);
      $('expBar').style.width = ((fi+1)/S.frames.length*100)+'%';
      $('expMsg').textContent = `${fi+1}/${S.frames.length}`;
      fi++; fi < S.frames.length ? setTimeout(render, fd) : setTimeout(() => rec.stop(), fd+100);
    };
    render();
  });
}

async function saveProject() {
  snapToCache();
  for (let i = 0; i < S.frames.length; i++) await ensureCached(S.frames[i].id);
  const data = {
    w:CW, h:CH, pc:S.pc, fps:S.fps, ratio:S.ratio, cf:S.cf, lo:layerOrder,
    frames: S.frames.map(f => {
      const c = S.fc.get(f.id) || {};
      return {id:f.id, sfx:f.sfx,
        A: c.A ? Array.from(c.A.data) : null,
        B: c.B ? Array.from(c.B.data) : null,
        C: c.C ? Array.from(c.C.data) : null
      };
    })
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
  a.download = 'ugonote_' + Date.now() + '.ugomemo'; a.click();
  toast('保存完了');
}

async function loadProject(e) {
  const file = e?.target?.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    CW = data.w; CH = data.h; S.pc = data.pc || '#FFFFFF'; S.fps = data.fps || 8;
    S.ratio = data.ratio || '4:3';
    if (data.lo) layerOrder = data.lo;
    $('fpsR').value = S.fps; $('fpsN').textContent = S.fps;
    $('rBadge').textContent = S.ratio;
    initCanvas(); updPC(); S.fc.clear(); thumbs.clear();
    S.undoStack = []; S.redoStack = []; S.dirtyIds.clear(); S.dirtyLayers.clear();
    S.frames = data.frames.map(f => {
      const nf = {id: f.id || uid(), sfx: f.sfx || '', thumbDirty: true};
      const c = {A:null, B:null, C:null};
      ['A','B','C'].forEach(k => { if (f[k]) c[k] = new ImageData(new Uint8ClampedArray(f[k]), CW, CH); });
      S.fc.set(nf.id, c); return nf;
    });
    S.cf = Math.min(data.cf || 0, S.frames.length - 1);
    cacheToCanvas(curId()); buildLL(); renderTL();
    for (let i = 0; i < S.frames.length; i++) markAllDirtyForFrame(S.frames[i].id);
    toast('読込完了');
  } catch(er) { toast('エラー: ' + er.message); }
  if ($('projIn')) $('projIn').value = '';
}
