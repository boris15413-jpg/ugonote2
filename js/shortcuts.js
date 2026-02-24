/* ====== Keyboard Shortcuts ====== */
'use strict';
function initShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'c' && S.sel) { e.preventDefault(); selAction('copy'); }
      if (e.key === 'v' && S.clip) {
        e.preventDefault(); S.ct = 'paste';
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('on'));
        toast('ペーストモード');
      }
      if (e.key === 's') { e.preventDefault(); snapToCache(); flushIDB(); toast('保存中...'); }
    }
    if (e.key === ' ') { e.preventDefault(); S.playing ? stop() : play(); }
    if (e.key === 'ArrowRight' && !S.playing && S.cf < S.frames.length-1) swF(S.cf+1);
    if (e.key === 'ArrowLeft' && !S.playing && S.cf > 0) swF(S.cf-1);
    if (e.key === 'Home') swF(0);
    if (e.key === 'End') swF(S.frames.length-1);
    if (e.key === 'Enter' && S.img) commitImg();
    if (e.key === 'Escape') {
      if (S.img) cancelImg();
      document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    }
    // Tool shortcuts
    if (e.key === 'p' || e.key === 'P') selectTool('pen');
    if (e.key === 'e' || e.key === 'E') selectTool('eraser');
    if (e.key === 'g' || e.key === 'G') selectTool('fill');
    if (e.key === 'l' || e.key === 'L') selectTool('line');
    if (e.key === 'r' || e.key === 'R') selectTool('rect');
    if (e.key === 'o' || e.key === 'O') selectTool('circle');
    if (e.key === 't' || e.key === 'T') selectTool('text');
    if (e.key === 's' && !e.ctrlKey && !e.metaKey) selectTool('select');
    if (e.key === 'h' || e.key === 'H') selectTool('hand');
    // Layer shortcuts
    if (e.key === '1') { S.cl = 'A'; buildLL(); }
    if (e.key === '2') { S.cl = 'B'; buildLL(); }
    if (e.key === '3') { S.cl = 'C'; buildLL(); }
    // Brush size
    if (e.key === '[') { S.cs = Math.max(1, S.cs - 1); updatePenDotUI(); }
    if (e.key === ']') { S.cs = Math.min(40, S.cs + 1); updatePenDotUI(); }
  });
}

function selectTool(tool) {
  if (S.ct === 'paste') cx.fl.clearRect(0,0,CW,CH);
  document.querySelectorAll('[data-tool]').forEach(t => t.classList.remove('on'));
  const el = document.querySelector(`[data-tool="${tool}"]`);
  if (el) el.classList.add('on');
  S.ct = tool;
  $('selBox').style.display = 'none';
  $('lassoPath').setAttribute('d', ''); S.sel = null; S.lassoPath = [];
  vp_el.style.cursor = S.ct === 'hand' ? 'grab' : 'crosshair';
}

function updatePenDotUI() {
  document.querySelectorAll('.pen-dot').forEach(b => {
    b.classList.toggle('on', +b.dataset.size === S.cs);
  });
}
