/* ====== Audio (Tab-based, no separate screen) ====== */
'use strict';
let syncRec = null, syncChunks = [];

function initAudio() {
  // BGM file load
  $('bgmFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      S.bgmBuf = await SFX.ctx().decodeAudioData(await f.arrayBuffer());
      toast('BGM: ' + f.name);
      updateWaveform();
    } catch(er) { toast('読込失敗'); }
  };

  $('bgmClearBtn').onclick = () => { S.bgmBuf = null; toast('BGMクリア'); updateWaveform(); };
  $('bgmVol').oninput = e => { S.bgmVol = +e.target.value/100; $('bgmVolLbl').textContent = e.target.value+'%'; };

  // Record sync
  $('recSyncBtn').onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      syncRec = new MediaRecorder(stream); syncChunks = [];
      syncRec.ondataavailable = e => { if (e.data.size > 0) syncChunks.push(e.data); };
      syncRec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (!syncChunks.length) return;
        try {
          S.bgmBuf = await SFX.ctx().decodeAudioData(await new Blob(syncChunks, {type:'audio/webm'}).arrayBuffer());
          toast('録音完了'); updateWaveform();
        } catch(e) { toast('失敗'); }
      };
      syncRec.start(); toast('録音+再生中');
      if (!S.playing) play();
    } catch(e) { toast('マイク拒否'); }
  };
  $('recClearBtn').onclick = () => { S.bgmBuf = null; toast('録音クリア'); updateWaveform(); };

  // SFX
  $('asSfxBtn').onclick = () => {
    const v = $('sfxSel').value;
    if (curFr()) { curFr().sfx = v; if (v) SFX.play(v); renderTL(); toast(v ? '割当' : '解除'); }
  };
  $('asSfxPreview').onclick = () => {
    const v = $('sfxSel').value;
    if (v) SFX.play(v);
  };

  // Preview
  $('asPreviewBtn').onclick = () => {
    if (S.bgmBuf) {
      const ac = SFX.ctx(), src = ac.createBufferSource();
      src.buffer = S.bgmBuf;
      const g = ac.createGain(); g.gain.value = S.bgmVol;
      src.connect(g); g.connect(ac.destination);
      src.start(); setTimeout(() => { try { src.stop(); } catch(e) {} }, 3000);
      toast('3秒プレビュー');
    }
  };
  $('asFullPreviewBtn').onclick = () => {
    if (S.bgmBuf) {
      const ac = SFX.ctx(), src = ac.createBufferSource();
      src.buffer = S.bgmBuf;
      const g = ac.createGain(); g.gain.value = S.bgmVol;
      src.connect(g); g.connect(ac.destination);
      src.start(); toast('全体再生');
    }
  };
}

function updateWaveform() {
  const cvs = $('asWaveCvs');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  if (!S.bgmBuf) {
    $('asDuration').textContent = '0.0s';
    return;
  }
  $('asDuration').textContent = S.bgmBuf.duration.toFixed(1) + 's';
  // Draw waveform with warm colors (matching Flipnote style)
  const data = S.bgmBuf.getChannelData(0);
  const step = Math.ceil(data.length / cvs.width);
  const amp = cvs.height / 2;
  ctx.fillStyle = '#FFF8E7';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.strokeStyle = '#F5841F';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < cvs.width; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const d = data[(i*step)+j];
      if (d < min) min = d;
      if (d > max) max = d;
    }
    ctx.moveTo(i, (1+min)*amp);
    ctx.lineTo(i, (1+max)*amp);
  }
  ctx.stroke();
  // Center line
  ctx.strokeStyle = 'rgba(0,0,0,.08)';
  ctx.beginPath(); ctx.moveTo(0, amp); ctx.lineTo(cvs.width, amp); ctx.stroke();
  // Draw frame markers
  if (S.frames.length > 1) {
    const totalDur = S.frames.length / S.fps;
    const pxPerSec = cvs.width / Math.max(totalDur, S.bgmBuf.duration);
    ctx.strokeStyle = 'rgba(200,100,0,.25)';
    ctx.setLineDash([2,2]);
    for (let i = 0; i < S.frames.length; i++) {
      const x = (i / S.fps) * pxPerSec;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}
