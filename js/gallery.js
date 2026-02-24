/* ====== Gallery ====== */
'use strict';
let galSelectedId = null;

function initGallery() {
  $('galNewBtn').onclick = createNewMemo;
  $('galEditBtn').onclick = () => { if (galSelectedId) openEditorForMemo(galSelectedId); else toast('メモを選択してください'); };
  $('galViewBtn').onclick = () => { if (galSelectedId) openViewerForMemo(galSelectedId); else toast('メモを選択してください'); };
  $('galDeleteBtn').onclick = deleteMemo;
  $('galExportBtn').onclick = () => { if (galSelectedId) { openEditorForMemo(galSelectedId); setTimeout(() => showQualMo('gif'), 500); } };
  $('galShareBtn').onclick = () => { if (galSelectedId) $('shareMo').classList.add('show'); else toast('メモを選択してください'); };
  $('galImportBtn').onclick = () => $('importMo').classList.add('show');
  $('galEditTitleBtn').onclick = () => {
    if (!galSelectedId) return;
    $('titleInput').value = $('galInfoTitle').textContent;
    $('titleMo').classList.add('show');
  };
  $('titleSave').onclick = async () => {
    if (!galSelectedId) return;
    const newTitle = $('titleInput').value.trim() || '無題';
    const existing = await DB.getGalleryItem(galSelectedId) || {};
    await DB.saveGalleryItem(galSelectedId, {...existing, title: newTitle});
    $('galInfoTitle').textContent = newTitle;
    $('titleMo').classList.remove('show');
    await refreshGallery();
    toast('タイトル保存');
  };
  $('titleCancel').onclick = () => $('titleMo').classList.remove('show');
  $('galOptionsBtn').onclick = () => toast('オプション');
  $('importFileBtn').onclick = () => $('importFileInput').click();
  $('importFileInput').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    $('importMo').classList.remove('show');
    $('projIn').files = e.target.files;
    loadProject(e);
  };
}

async function createNewMemo() {
  const id = uid();
  const memo = {
    title: '新しいメモ',
    author: 'ユーザー',
    created: Date.now(),
    updated: Date.now(),
    frameCount: 1,
    thumbnail: null,
    w: CW, h: CH, fps: 8, ratio: '4:3'
  };
  await DB.saveGalleryItem(id, memo);
  S.currentMemoId = id;
  galSelectedId = id;
  S.frames = [mkFrame()]; S.cf = 0;
  ['A','B','C'].forEach(k => cx[k].clearRect(0,0,CW,CH));
  S.undoStack = []; S.redoStack = []; S.fc.clear(); thumbs.clear();
  S.dirtyIds.clear(); S.dirtyLayers.clear();
  snapToCache(); markAllDirtyForFrame(curId()); renderTL(); updOn();
  showScreen('editor');
  toast('新しいメモを作成');
}

async function openEditorForMemo(id) {
  S.currentMemoId = id;
  try {
    const meta = await DB.loadMeta();
    if (meta && meta.memoId === id) {
      CW = meta.w; CH = meta.h; S.pc = meta.pc || '#FFFFFF';
      S.fps = meta.fps || 8; S.ratio = meta.ratio || '4:3';
      if (meta.lo) layerOrder = meta.lo;
      $('fpsR').value = S.fps; $('fpsN').textContent = S.fps; $('rBadge').textContent = S.ratio;
      initCanvas(); updPC();
      S.frames = meta.frames.map(f => ({id:f.id, sfx:f.sfx||'', thumbDirty:true}));
      S.cf = Math.min(meta.cf||0, S.frames.length-1);
      await ensureCached(S.frames[S.cf].id);
      cacheToCanvas(curId());
      buildLL(); renderTL();
      preloadNearby();
    }
  } catch(e) {}
  showScreen('editor');
}

async function openViewerForMemo(id) {
  await openEditorForMemo(id);
  showScreen('viewer');
  initViewerPlayback();
}

async function deleteMemo() {
  if (!galSelectedId) return toast('メモを選択してください');
  if (!confirm('このメモを消しますか?')) return;
  await DB.deleteGalleryItem(galSelectedId);
  galSelectedId = null;
  await refreshGallery();
  toast('メモを消しました');
}

async function refreshGallery() {
  const items = await DB.getGalleryList();
  const grid = $('galGrid'); grid.innerHTML = '';

  // New memo card
  const nc = document.createElement('div'); nc.className = 'gal-new-card';
  nc.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><span>新しいメモ</span>';
  nc.onclick = createNewMemo;
  grid.appendChild(nc);

  items.forEach(item => {
    const card = document.createElement('div'); card.className = 'gal-memo-card';
    if (item.id === galSelectedId) card.classList.add('selected');
    const thumb = document.createElement('div'); thumb.className = 'gal-memo-thumb';
    if (item.thumbnail) {
      const img = new Image; img.src = item.thumbnail;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain';
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" class="empty-icon" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
    }
    const info = document.createElement('div'); info.className = 'gal-memo-info';
    info.innerHTML = `<div class="gal-memo-title">${item.title||'無題'}</div><div class="gal-memo-date">${new Date(item.updated).toLocaleDateString('ja-JP')}</div><div class="gal-memo-frames">${item.frameCount||1}F</div>`;
    card.appendChild(thumb); card.appendChild(info);
    card.onclick = () => {
      galSelectedId = item.id;
      document.querySelectorAll('.gal-memo-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      $('galInfoTitle').textContent = item.title || '無題';
      $('galInfoAuthor').textContent = item.author || 'ユーザー';
      $('galInfoDate').textContent = new Date(item.updated).toLocaleString('ja-JP');
      $('galInfoFrames').textContent = (item.frameCount||1) + 'F';
    };
    card.ondblclick = () => openEditorForMemo(item.id);
    grid.appendChild(card);
  });
}

async function saveCurrentMemoToGallery() {
  if (!S.currentMemoId) return;
  snapToCache();
  const tc = document.createElement('canvas'); tc.width = 160; tc.height = 120;
  const tx = tc.getContext('2d');
  tx.fillStyle = S.pc; tx.fillRect(0, 0, 160, 120);
  layerOrder.forEach(l => { if (cvs[l].style.display !== 'none') tx.drawImage(cvs[l], 0, 0, 160, 120); });
  const thumb = tc.toDataURL('image/png', 0.6);
  const existing = await DB.getGalleryItem(S.currentMemoId) || {};
  await DB.saveGalleryItem(S.currentMemoId, {
    ...existing,
    updated: Date.now(),
    frameCount: S.frames.length,
    thumbnail: thumb,
    w: CW, h: CH, fps: S.fps, ratio: S.ratio
  });
}
