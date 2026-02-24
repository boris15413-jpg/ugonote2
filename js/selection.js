/* ====== Selection ====== */
'use strict';
function initSelection() {
  $('selCpBtn').onclick = () => selAction('copy');
  $('selCtBtn').onclick = () => selAction('cut');
  $('selOutBtn').onclick = () => selAction('outline');
  $('selOW').oninput = e => { $('selOWL').textContent = e.target.value; };
  $('selCnBtn').onclick = () => {
    $('selMo').classList.remove('show'); S.sel = null;
    $('selBox').style.display = 'none';
    $('lassoPath').setAttribute('d', ''); S.lassoPath = [];
  };
}

function selAction(mode) {
  $('selMo').classList.remove('show');
  $('selBox').style.display = 'none';
  $('lassoPath').setAttribute('d', '');
  if (!S.sel) return;
  const c = curX(), hl = S.sel.lasso;
  if (mode === 'copy') {
    const tmp = document.createElement('canvas');
    tmp.width = S.sel.w; tmp.height = S.sel.h;
    const tc = tmp.getContext('2d');
    if (hl) { tc.beginPath(); hl.forEach((p,i) => i ? tc.lineTo(p.x-S.sel.x, p.y-S.sel.y) : tc.moveTo(p.x-S.sel.x, p.y-S.sel.y)); tc.closePath(); tc.clip(); }
    tc.drawImage(curC(), -S.sel.x, -S.sel.y);
    S.clip = tmp; S.sel = null; S.lassoPath = [];
    S.ct = 'paste'; document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('on'));
    toast('コピー完了'); return;
  }
  if (mode === 'cut') {
    pU();
    if (hl) { c.save(); c.beginPath(); hl.forEach((p,i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.clip(); c.clearRect(S.sel.x, S.sel.y, S.sel.w, S.sel.h); c.restore(); }
    else c.clearRect(S.sel.x, S.sel.y, S.sel.w, S.sel.h);
    commitUndo(); afterEdit(); S.sel = null; S.lassoPath = []; toast('カット完了'); return;
  }
  if (mode === 'outline') {
    pU(); const oC = $('selOC').value, oW = +$('selOW').value;
    const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
    const tc = tmp.getContext('2d');
    if (hl) { tc.beginPath(); hl.forEach((p,i) => i ? tc.lineTo(p.x, p.y) : tc.moveTo(p.x, p.y)); tc.closePath(); tc.clip(); }
    tc.drawImage(curC(), 0, 0);
    const oc2 = document.createElement('canvas'); oc2.width = CW; oc2.height = CH;
    const oc = oc2.getContext('2d');
    const steps = Math.max(16, oW * 4);
    for (let i = 0; i < steps; i++) { const a = (i/steps)*Math.PI*2; oc.drawImage(tmp, Math.cos(a)*oW, Math.sin(a)*oW); }
    oc.globalCompositeOperation = 'source-in'; oc.fillStyle = oC; oc.fillRect(0,0,CW,CH);
    oc.globalCompositeOperation = 'source-over';
    if (hl) { c.save(); c.beginPath(); hl.forEach((p,i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.clip(); }
    c.clearRect(Math.max(0,S.sel.x-oW-1), Math.max(0,S.sel.y-oW-1), S.sel.w+oW*2+2, S.sel.h+oW*2+2);
    c.drawImage(oc2, 0, 0); c.drawImage(tmp, 0, 0);
    if (hl) c.restore();
    commitUndo(); afterEdit(); S.sel = null; S.lassoPath = []; toast('縁取り完了');
  }
}

function pasteAt(px, py) {
  if (!S.clip) return;
  pU(); curX().drawImage(S.clip, px-S.clip.width/2, py-S.clip.height/2);
  cx.fl.clearRect(0,0,CW,CH); commitUndo(); afterEdit(); toast('配置完了');
}
