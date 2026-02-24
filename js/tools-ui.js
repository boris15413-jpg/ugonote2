/* ====== Tools UI Bindings ====== */
'use strict';

function initToolsUI() {
  // Tool selection
  document.querySelectorAll('[data-tool]').forEach(b => {
    b.onclick = () => {
      if (S.ct === 'paste') cx.fl.clearRect(0,0,CW,CH);
      document.querySelectorAll('[data-tool]').forEach(t => t.classList.remove('on'));
      b.classList.add('on'); S.ct = b.dataset.tool;
      $('selBox').style.display = 'none';
      $('lassoPath').setAttribute('d', ''); S.sel = null; S.lassoPath = [];
      vp_el.style.cursor = S.ct === 'hand' ? 'grab' : 'crosshair';
    };
  });

  // Color dots
  document.querySelectorAll('.color-dot').forEach(c => {
    c.onclick = () => {
      document.querySelectorAll('.color-dot').forEach(x => x.classList.remove('on'));
      c.classList.add('on'); S.cc = c.dataset.c;
      $('ccPick').value = S.cc;
      updateSVPickerFromColor(S.cc);
      updateLayerTabHighlight();
    };
  });
  $('ccPick').oninput = e => {
    S.cc = e.target.value;
    document.querySelectorAll('.color-dot').forEach(x => x.classList.remove('on'));
    updateSVPickerFromColor(S.cc);
    updateLayerTabHighlight();
  };

  // Pen size
  document.querySelectorAll('.pen-dot').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.pen-dot').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); S.cs = +b.dataset.size;
    };
  });

  // Alpha
  $('alphaRng').oninput = e => { S.alpha = +e.target.value / 100; $('alphaLbl').textContent = e.target.value + '%'; };

  // Outline pen
  $('outlineChk').onchange = e => {
    S.penOut = e.target.checked;
    $('outlineOpts').classList.toggle('show', S.penOut);
  };
  $('outlineCol').oninput = e => { S.penOutC = e.target.value; };
  $('outlineW').oninput = e => { S.penOutW = +e.target.value; };

  // Zoom
  $('zoomInBtn').onclick = () => { S.zoom = Math.min(8, S.zoom * 1.25); updT(); };
  $('zoomOutBtn').onclick = () => { S.zoom = Math.max(.1, S.zoom / 1.25); updT(); };
  $('resetVBtn').onclick = fitView;

  // Undo/Redo
  $('undoBtn').onclick = undo;
  $('redoBtn').onclick = redo;

  // Paper color
  $('paperBtn').onclick = () => $('paperMo').classList.add('show');
  document.querySelectorAll('.paper-opt').forEach(o => {
    o.onclick = () => {
      document.querySelectorAll('.paper-opt').forEach(x => x.classList.remove('on'));
      o.classList.add('on'); S.pc = o.dataset.p; updPC();
    };
  });

  // Onion skin
  $('onionBtn').onclick = () => {
    S.onion = !S.onion;
    $('onionBtn').classList.toggle('on', S.onion);
    updOn(); toast(S.onion ? 'オニオンスキンON' : 'OFF');
  };

  // Ratio
  $('ratioBtn').onclick = () => $('ratioMo').classList.add('show');
  let pendingRatio = null;
  document.querySelectorAll('.ratio-opt').forEach(o => {
    o.onclick = () => {
      const r = o.dataset.r, nw = +o.dataset.w, nh = +o.dataset.h;
      if (r === S.ratio) { $('ratioMo').classList.remove('show'); return; }
      let has = S.frames.length > 1;
      if (!has) for (const l of ['A','B','C']) {
        const d = cx[l].getImageData(0,0,CW,CH).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { has = true; break; }
        if (has) break;
      }
      if (has) { pendingRatio = {r,nw,nh,el:o}; $('ratioMo').classList.remove('show'); $('ratioConfMo').classList.add('show'); return; }
      applyRatio(r, nw, nh, o);
    };
  });

  function applyRatio(r, nw, nh, el) {
    document.querySelectorAll('.ratio-opt').forEach(x => x.classList.remove('on'));
    if (el) el.classList.add('on');
    S.ratio = r; CW = nw; CH = nh; $('rBadge').textContent = r;
    initCanvas(); updPC();
    S.fc.clear(); thumbs.clear(); S.frames = [mkFrame()]; S.cf = 0;
    S.undoStack = []; S.redoStack = [];
    S.dirtyIds.clear(); S.dirtyLayers.clear();
    snapToCache(); markAllDirtyForFrame(curId()); renderTL(); updOn();
    $('ratioMo').classList.remove('show'); toast('比率: ' + r);
  }
  $('ratioConfOk').onclick = () => { $('ratioConfMo').classList.remove('show'); if (pendingRatio) applyRatio(pendingRatio.r, pendingRatio.nw, pendingRatio.nh, pendingRatio.el); pendingRatio = null; };
  $('ratioConfNo').onclick = () => { $('ratioConfMo').classList.remove('show'); pendingRatio = null; };

  // Context menu
  document.addEventListener('click', e => { if (!e.target.closest('.ctx-menu')) $('ctxMenu').classList.remove('show'); });
  document.querySelectorAll('[data-ctx]').forEach(it => {
    it.onclick = () => {
      $('ctxMenu').classList.remove('show');
      const a = it.dataset.ctx;
      if (a === 'undo') undo();
      else if (a === 'redo') redo();
      else if (a === 'paste' && S.clip) {
        S.ct = 'paste'; document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('on'));
        toast('ペーストモード');
      }
      else if (a === 'clear') { pU(); curX().clearRect(0,0,CW,CH); commitUndo(); afterEdit(); toast('クリア'); }
    };
  });

  // Image placement
  $('addPhotoBtn').onclick = () => $('imgIn').click();
  $('imgIn').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image; img.onload = () => startImgPlace(img);
    img.src = URL.createObjectURL(f); $('imgIn').value = '';
  };
  $('imgOk').onclick = commitImg;
  $('imgCn').onclick = cancelImg;

  // Merge
  $('mergeBtn').onclick = () => $('mergeMo').classList.add('show');
  $('mergeDownBtn').onclick = () => {
    const idx = layerOrder.indexOf(S.cl); if (idx <= 0) return toast('下なし');
    pU(); cx[layerOrder[idx-1]].drawImage(cvs[S.cl], 0, 0); cx[S.cl].clearRect(0,0,CW,CH);
    commitUndo(); afterEdit(); $('mergeMo').classList.remove('show'); toast('統合完了');
  };
  $('mergeAllBtn').onclick = () => {
    pU(); const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
    const tc = tmp.getContext('2d');
    layerOrder.forEach(l => tc.drawImage(cvs[l], 0, 0));
    cx.A.clearRect(0,0,CW,CH); cx.A.drawImage(tmp, 0, 0);
    cx.B.clearRect(0,0,CW,CH); cx.C.clearRect(0,0,CW,CH);
    commitUndo(); snapToCache(); markAllDirtyForFrame(curId());
    curFr().thumbDirty = true; renderTLDebounced();
    $('mergeMo').classList.remove('show'); toast('全統合→A');
  };

  // Flip
  $('flipHBtn').onclick = () => {
    pU(); const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
    tmp.getContext('2d').drawImage(curC(), 0, 0);
    curX().clearRect(0,0,CW,CH); curX().save();
    curX().translate(CW, 0); curX().scale(-1, 1);
    curX().drawImage(tmp, 0, 0); curX().restore();
    commitUndo(); afterEdit(); toast('反転');
  };

  // Clear all
  $('clrAllBtn').onclick = async () => {
    if (!confirm('全消し?')) return;
    S.frames = [mkFrame()]; S.cf = 0;
    ['A','B','C'].forEach(k => cx[k].clearRect(0,0,CW,CH));
    S.undoStack = []; S.redoStack = []; S.fc.clear(); thumbs.clear();
    S.dirtyIds.clear(); S.dirtyLayers.clear();
    snapToCache(); markAllDirtyForFrame(curId()); updOn(); renderTL();
    if (DB.db) await DB.clear(DB.SF);
  };
}
