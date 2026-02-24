/* ====== Timeline ====== */
'use strict';
let _tlT = null;
function renderTLDebounced() { if (_tlT) return; _tlT = requestAnimationFrame(() => { _tlT = null; renderTL(); }); }

function renderTL() {
  const el = $('tls'); el.innerHTML = '';
  const frag = document.createDocumentFragment();
  S.frames.forEach((fm, i) => {
    const d = document.createElement('div');
    d.className = 'tl-frame' + (i === S.cf ? ' on' : '');
    let tc = thumbs.get(fm.id);
    if (!tc) { tc = document.createElement('canvas'); tc.width = TW; tc.height = TH; thumbs.set(fm.id, tc); fm.thumbDirty = true; }
    if (i === S.cf) {
      renderThumb(fm.id, tc, true); fm.thumbDirty = false; tc._rendered = true;
    } else if (fm.thumbDirty) {
      const cached = S.fc.has(fm.id) && S.fc.get(fm.id);
      if (cached) { renderThumb(fm.id, tc, false); fm.thumbDirty = false; tc._rendered = true; }
    }
    const dc = document.createElement('canvas'); dc.width = TW; dc.height = TH;
    dc.getContext('2d').drawImage(tc, 0, 0);
    const n = document.createElement('div'); n.className = 'tl-frame-num'; n.textContent = i + 1;
    d.appendChild(dc); d.appendChild(n);
    if (fm.sfx) {
      const s = document.createElement('div'); s.className = 'tl-frame-sfx';
      s.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>';
      d.appendChild(s);
    }
    d.onclick = () => swF(i);
    frag.appendChild(d);
  });
  el.appendChild(frag);
  $('curF').textContent = S.cf + 1;
  $('totF').textContent = S.frames.length;
  const ac = el.querySelector('.tl-frame.on');
  if (ac) ac.scrollIntoView({behavior:'smooth', inline:'center'});
  schedulePreload();
}
