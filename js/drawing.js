/* ====== Drawing Engine ====== */
'use strict';

function drawPen() {
  const c = cx.st; c.clearRect(0, 0, CW, CH);
  const p = S.pts; if (!p.length) return;
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (S.penOut) {
    c.strokeStyle = S.penOutC; c.lineWidth = S.cs + S.penOutW * 2;
    c.beginPath(); c.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) c.lineTo(p[i].x, p[i].y);
    if (p.length === 1) c.lineTo(p[0].x + .1, p[0].y);
    c.stroke();
  }
  c.strokeStyle = S.cc; c.lineWidth = S.cs;
  c.beginPath(); c.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) c.lineTo(p[i].x, p[i].y);
  if (p.length === 1) c.lineTo(p[0].x + .1, p[0].y);
  c.stroke();
}

function commitPen() {
  curX().globalAlpha = S.alpha;
  curX().drawImage(cvs.st, 0, 0);
  curX().globalAlpha = 1;
  cx.st.clearRect(0, 0, CW, CH);
  cvs.st.style.opacity = 1;
}

function applyEraser() {
  const c = curX(), p = S.pts;
  if (!p.length || !S.eSnap) return;
  c.putImageData(S.eSnap, 0, 0);
  c.globalCompositeOperation = 'destination-out';
  c.globalAlpha = S.alpha;
  c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = S.cs * 2;
  c.beginPath(); c.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) c.lineTo(p[i].x, p[i].y);
  if (p.length === 1) c.lineTo(p[0].x + .1, p[0].y);
  c.stroke();
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}

function floodFill(sx, sy) {
  const c = curX(), id = c.getImageData(0, 0, CW, CH);
  const tc2 = document.createElement('canvas').getContext('2d');
  tc2.fillStyle = S.cc; tc2.fillRect(0, 0, 1, 1);
  const fc = tc2.getImageData(0, 0, 1, 1).data;
  if (W) {
    wCall({type:'floodFill', w:CW, h:CH, data:id.data.buffer, sx, sy, fillR:fc[0], fillG:fc[1], fillB:fc[2], tol:30}, [id.data.buffer])
    .then(d => {
      c.putImageData(new ImageData(new Uint8ClampedArray(d.data), CW, CH), 0, 0);
      commitUndo(); afterEdit();
    });
  } else {
    // Fallback sync fill
    const d = id.data, x0 = Math.floor(sx), y0 = Math.floor(sy);
    if (x0 < 0 || x0 >= CW || y0 < 0 || y0 >= CH) return;
    const i0 = (y0*CW+x0)*4, tr=d[i0], tg=d[i0+1], tb=d[i0+2], ta=d[i0+3];
    if (tr===fc[0] && tg===fc[1] && tb===fc[2] && ta===255) { commitUndo(); return; }
    const tol=30, m=i=>Math.abs(d[i]-tr)<=tol&&Math.abs(d[i+1]-tg)<=tol&&Math.abs(d[i+2]-tb)<=tol&&Math.abs(d[i+3]-ta)<=tol;
    const vis = new Uint8Array(CW*CH), q = [y0*CW+x0]; vis[y0*CW+x0]=1;
    while(q.length) {
      const pi=q.pop(), px=pi%CW, py=(pi/CW)|0;
      let lx=px; while(lx>0 && !vis[py*CW+lx-1] && m((py*CW+lx-1)*4)){lx--;vis[py*CW+lx]=1}
      let rx=px; while(rx<CW-1 && !vis[py*CW+rx+1] && m((py*CW+rx+1)*4)){rx++;vis[py*CW+rx]=1}
      for(let x=lx;x<=rx;x++) {
        const i=(py*CW+x)*4; d[i]=fc[0];d[i+1]=fc[1];d[i+2]=fc[2];d[i+3]=255;
        for(const ny of[py-1,py+1]) if(ny>=0&&ny<CH){const ni=ny*CW+x;if(!vis[ni]&&m(ni*4)){vis[ni]=1;q.push(ni)}}
      }
    }
    c.putImageData(id, 0, 0); commitUndo(); afterEdit();
  }
}

// Undo/Redo (diff-based from ugonote2)
let _uSnap = null;
function pU() { _uSnap = curX().getImageData(0, 0, CW, CH); }

function commitUndo() {
  if (!_uSnap) return;
  const after = curX().getImageData(0, 0, CW, CH);
  let minX = CW, minY = CH, maxX = -1, maxY = -1;
  const od = _uSnap.data, nd = after.data;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = (y * CW + x) * 4;
    if (od[i]!==nd[i] || od[i+1]!==nd[i+1] || od[i+2]!==nd[i+2] || od[i+3]!==nd[i+3]) {
      if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y;
    }
  }
  _uSnap = null; if (maxX < 0) return;
  const dw = maxX-minX+1, dh = maxY-minY+1;
  const op = new Uint8ClampedArray(dw*dh*4), np = new Uint8ClampedArray(dw*dh*4);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const si = ((minY+y)*CW+(minX+x))*4, di = (y*dw+x)*4;
    op[di]=od[si]; op[di+1]=od[si+1]; op[di+2]=od[si+2]; op[di+3]=od[si+3];
    np[di]=nd[si]; np[di+1]=nd[si+1]; np[di+2]=nd[si+2]; np[di+3]=nd[si+3];
  }
  S.undoStack.push({fid:curId(), l:S.cl, x:minX, y:minY, w:dw, h:dh, op, np});
  if (S.undoStack.length > S.maxUndo) S.undoStack.shift();
  S.redoStack = [];
}

function applyPatch(entry, patch) {
  const c = cx[entry.l];
  if (entry.fid !== curId()) return;
  const cur = c.getImageData(0, 0, CW, CH), cd = cur.data;
  for (let y = 0; y < entry.h; y++) for (let x = 0; x < entry.w; x++) {
    const si = (y*entry.w+x)*4, di = ((entry.y+y)*CW+(entry.x+x))*4;
    cd[di]=patch[si]; cd[di+1]=patch[si+1]; cd[di+2]=patch[si+2]; cd[di+3]=patch[si+3];
  }
  c.putImageData(cur, 0, 0);
}

function undo() {
  if (!S.undoStack.length) return;
  const e = S.undoStack.pop();
  S.redoStack.push({...e, op:e.np, np:e.op});
  applyPatch(e, e.op); snapToCache(); markDirty(e.fid, e.l);
  curFr().thumbDirty = true; renderTLDebounced();
}

function redo() {
  if (!S.redoStack.length) return;
  const e = S.redoStack.pop();
  S.undoStack.push({...e, op:e.np, np:e.op});
  applyPatch(e, e.op); snapToCache(); markDirty(e.fid, e.l);
  curFr().thumbDirty = true; renderTLDebounced();
}

function afterEdit(layer) {
  snapToCache(); markDirty(curId(), layer || S.cl);
  curFr().thumbDirty = true; renderTLDebounced();
}
