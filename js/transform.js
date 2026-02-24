/* ====== Transform (Rotate, Image Placement) ====== */
'use strict';
function initTransform() {
  $('rotateBtn').onclick = () => $('rotMo').classList.add('show');
  document.querySelectorAll('[data-rot]').forEach(b => {
    b.onclick = () => { rotL(+b.dataset.rot); $('rotMo').classList.remove('show'); };
  });
  $('rotCBtn').onclick = () => { rotL(+$('rotAng').value); $('rotMo').classList.remove('show'); };
}

function rotL(deg) {
  pU(); const c = curX();
  const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH;
  tmp.getContext('2d').drawImage(curC(), 0, 0);
  c.clearRect(0,0,CW,CH); c.save();
  c.translate(CW/2, CH/2); c.rotate(deg * Math.PI / 180);
  c.drawImage(tmp, -CW/2, -CH/2); c.restore();
  commitUndo(); afterEdit(); toast(deg + ' deg');
}

function startImgPlace(imgEl) {
  const a = imgEl.width / imgEl.height, ca = CW / CH;
  let bw, bh;
  if (a > ca) { bw = CW; bh = CW / a; } else { bh = CH; bw = CH * a; }
  S.img = {el:imgEl, x:CW/2, y:CH/2, bw, bh, sc:1};
  $('imgHud').classList.add('show'); drawImgPrev();
}

function drawImgPrev() {
  if (!S.img) return;
  cx.fl.clearRect(0,0,CW,CH);
  const {el,x,y,bw,bh,sc} = S.img; const dw = bw*sc, dh = bh*sc;
  cx.fl.globalAlpha = .85;
  cx.fl.drawImage(el, x-dw/2, y-dh/2, dw, dh);
  cx.fl.globalAlpha = 1;
  cx.fl.strokeStyle = '#FF6600'; cx.fl.lineWidth = 2;
  cx.fl.setLineDash([6,4]);
  cx.fl.strokeRect(x-dw/2, y-dh/2, dw, dh);
  cx.fl.setLineDash([]);
}

function commitImg() {
  if (!S.img) return;
  pU(); const {el,x,y,bw,bh,sc} = S.img;
  curX().drawImage(el, x-bw*sc/2, y-bh*sc/2, bw*sc, bh*sc);
  cx.fl.clearRect(0,0,CW,CH); S.img = null;
  $('imgHud').classList.remove('show');
  commitUndo(); afterEdit(); toast('画像配置完了');
}

function cancelImg() {
  cx.fl.clearRect(0,0,CW,CH); S.img = null;
  $('imgHud').classList.remove('show');
}
