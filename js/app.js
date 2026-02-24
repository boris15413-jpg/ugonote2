/* ====== Main App ====== */
'use strict';

/* --- Hash-based SPA routing ---
   Screens: #splash, #gallery, #editor, #viewer
   On refresh the app restores whichever screen was last shown,
   so the user never falls back to the splash unexpectedly. */

const SCREENS = ['splash','gallery','editor','viewer'];
let _firstShow = true;
let _transitioning = false;

function showScreen(name) {
  if (!SCREENS.includes(name)) name = 'splash';
  if (_transitioning) return;

  /* Update hash silently. */
  if (location.hash !== '#' + name) {
    history.replaceState(null, '', '#' + name);
  }
  /* Persist to sessionStorage immediately for refresh recovery. */
  try { sessionStorage.setItem('ugokuLastScreen', name); } catch(e) {}

  /* On first call, remove the inline <style> that kept splash visible during load. */
  if (_firstShow) {
    _firstShow = false;
    const bs = document.getElementById('bootStyle');
    if (bs) bs.remove();
  }

  _transitioning = true;

  /* Collect old active screens */
  const oldScreens = document.querySelectorAll('.screen.active');
  const newScreen = $(name + 'Screen');
  if (!newScreen) { _transitioning = false; return; }

  /* If nothing visible yet (first show), just activate immediately */
  if (!oldScreens.length) {
    newScreen.classList.remove('screen-exit');
    newScreen.classList.add('active');
    _transitioning = false;
    afterScreenSwitch(name);
    return;
  }

  /* If the new screen is already active, skip */
  if (newScreen.classList.contains('active')) { _transitioning = false; return; }

  /* Fade out old screens */
  oldScreens.forEach(s => {
    if (s !== newScreen) {
      s.classList.add('screen-exit');
      s.classList.remove('active');
    }
  });

  /* After transition duration, show new screen */
  const dur = 180; /* matches --screen-transition */
  setTimeout(() => {
    oldScreens.forEach(s => {
      s.classList.remove('screen-exit');
    });
    newScreen.classList.add('active');
    _transitioning = false;
    afterScreenSwitch(name);
  }, dur);
}

function afterScreenSwitch(name) {
  if (name === 'gallery') refreshGallery();
  if (name === 'editor')  setTimeout(fitView, 50);
}

/* Listen for browser back/forward */
window.addEventListener('popstate', () => {
  const h = (location.hash || '').replace('#','');
  if (SCREENS.includes(h)) showScreen(h);
});

async function init() {
  console.log('[UgokuNote] Initializing...');

  // Open DB
  try { await DB.open(); } catch(e) { console.warn('IDB:', e); }
  console.log('[UgokuNote] DB ready');

  // Init canvas refs
  initCvs();

  // Splash button
  $('startBtn').addEventListener('click', () => showScreen('gallery'));

  // Init all modules
  initToolsUI();
  initSelection();
  initText();
  initTransform();
  initPlayback();
  initAudio();
  initExport();
  initGallery();
  initViewer();
  initShare();
  initColorPicker();
  initShortcuts();
  initPointer();

  // Panel tabs
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('on'));
      document.querySelectorAll('.ptab-content').forEach(c => c.classList.remove('on'));
      tab.classList.add('on');
      const target = $('ptab' + tab.dataset.ptab.charAt(0).toUpperCase() + tab.dataset.ptab.slice(1));
      if (target) target.classList.add('on');
    };
  });

  // Layer tabs (A/B/C on left edge)
  document.querySelectorAll('.layer-tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.layer-tab').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      S.cl = t.dataset.layer;
      buildLL();
    };
  });

  // Frame menu toggle
  $('frameMenuToggle').onclick = () => {
    const m = $('frameMenu');
    m.style.display = m.style.display === 'none' ? 'flex' : 'none';
  };
  // Frame menu actions
  $('fmInsert').onclick = () => { addF(); $('frameMenu').style.display = 'none'; };
  $('fmDelete').onclick = () => { delF(); $('frameMenu').style.display = 'none'; };
  $('fmCopy').onclick = () => {
    snapToCache(); const c = S.fc.get(curId()); const cl = {};
    ['A','B','C'].forEach(k => { cl[k] = c && c[k] ? new ImageData(new Uint8ClampedArray(c[k].data), CW, CH) : null; });
    S.frClip = {cache:cl, sfx:curFr().sfx}; toast('コピー完了');
    $('frameMenu').style.display = 'none';
  };
  $('fmPaste').onclick = () => {
    if (!S.frClip) { toast('コピーなし'); return; }
    const nf = mkFrame(); nf.sfx = S.frClip.sfx;
    const nc = {}; ['A','B','C'].forEach(k => { nc[k] = S.frClip.cache[k] ? new ImageData(new Uint8ClampedArray(S.frClip.cache[k].data), CW, CH) : null; });
    S.frames.splice(S.cf+1, 0, nf); S.fc.set(nf.id, nc); S.cf++;
    cacheToCanvas(curId()); markAllDirtyForFrame(nf.id); renderTL(); toast('貼付完了');
    $('frameMenu').style.display = 'none';
  };

  // Camera / photo button
  $('camBtn').onclick = () => $('imgIn').click();

  // Back to gallery from editor
  $('backToGalBtn').onclick = async () => {
    if (S.playing) stop();
    await saveCurrentMemoToGallery();
    showScreen('gallery');
  };

  // Window resize
  window.addEventListener('resize', () => {
    if ($('editorScreen').classList.contains('active')) setTimeout(fitView, 100);
  });

  // Beforeunload - persist state
  window.addEventListener('beforeunload', () => {
    snapToCache(); markAllDirtyForFrame(curId());
    if (_saveT) { clearTimeout(_saveT); _saveT = null; }
    flushIDB();
    saveCurrentMemoToGallery();
    try { sessionStorage.setItem('ugokuLastScreen', (location.hash || '').replace('#','')); } catch(e) {}
  });

  // Close frame menu on click outside
  document.addEventListener('click', e => {
    if (!e.target.closest('#frameMenu') && !e.target.closest('#frameMenuToggle')) {
      $('frameMenu').style.display = 'none';
    }
  });

  // Try restore
  let restored = false;
  try {
    const meta = await DB.loadMeta();
    if (meta && meta.frames && meta.frames.length > 0) {
      CW = meta.w; CH = meta.h; S.pc = meta.pc || '#FFFFFF';
      S.fps = meta.fps || 8; S.ratio = meta.ratio || '4:3';
      S.currentMemoId = meta.memoId || null;
      if (meta.lo) layerOrder = meta.lo;
      $('fpsR').value = S.fps; $('fpsN').textContent = S.fps; $('rBadge').textContent = S.ratio;
      initCanvas(); updPC();
      S.frames = meta.frames.map(f => ({id:f.id, sfx:f.sfx||'', thumbDirty:true}));
      S.cf = Math.min(meta.cf||0, S.frames.length-1);
      await ensureCached(S.frames[S.cf].id);
      cacheToCanvas(curId()); restored = true;
      preloadNearby();
    }
  } catch(e) { console.warn('Restore:', e); }

  if (!restored) { initCanvas(); updPC(); S.frames = [mkFrame()]; snapToCache(); }
  buildLL(); renderTL(); updateLayerTabHighlight();

  /* --- Determine start screen ---
     Priority: 1) current hash  2) sessionStorage  3) splash (only if no data)
     If the user had data, skip splash and go to gallery/editor. */
  let startScreen = 'splash';
  const hashScreen = (location.hash || '').replace('#','');
  const savedScreen = (() => { try { return sessionStorage.getItem('ugokuLastScreen'); } catch(e) { return null; } })();

  if (SCREENS.includes(hashScreen) && hashScreen !== 'splash') {
    startScreen = hashScreen;
  } else if (savedScreen && SCREENS.includes(savedScreen) && savedScreen !== 'splash') {
    startScreen = savedScreen;
  } else if (restored) {
    // Had data but no hash -> go to gallery (not splash)
    startScreen = 'gallery';
  }

  showScreen(startScreen);

  console.log('[UgokuNote] App ready!');
}

function updateLayerTabHighlight() {
  document.querySelectorAll('.layer-tab').forEach(t => {
    t.classList.toggle('on', t.dataset.layer === S.cl);
  });
  const ind = $('mainColorInd');
  if (ind) ind.style.background = S.cc;
}

// Bootstrap
init().catch(e => { console.error('[UgokuNote] Init failed:', e); });
