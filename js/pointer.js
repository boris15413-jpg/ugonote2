/* ====== Pointer Events ====== */
'use strict';
const vp_el = document.getElementById('vp');
const ptrs = new Map();
let pinch = null, drawPtrId = null, imgDrag = false;

function getPinchInfo() {
  const vs = [...ptrs.values()]; if (vs.length < 2) return null;
  return {dist: Math.hypot(vs[0].x-vs[1].x, vs[0].y-vs[1].y), mx:(vs[0].x+vs[1].x)/2, my:(vs[0].y+vs[1].y)/2};
}

function cancelDraw() {
  if (S.drawing) { S.drawing = false; S.pts = []; cx.st.clearRect(0,0,CW,CH); cx.dr.clearRect(0,0,CW,CH); S.eSnap = null; _uSnap = null; }
  drawPtrId = null;
}

function initPointer() {
  vp_el.addEventListener('pointerdown', e => {
    if (S.playing) return;
    e.preventDefault();
    vp_el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (ptrs.size >= 2) {
      cancelDraw(); imgDrag = false;
      const pi = getPinchInfo();
      if (S.img) pinch = {mode:'img', dist0:pi.dist, sc0:S.img.sc, mx0:pi.mx, my0:pi.my, ix0:S.img.x, iy0:S.img.y};
      else pinch = {mode:'canvas', dist0:pi.dist, zoom0:S.zoom, px0:S.panX, py0:S.panY, mx0:pi.mx, my0:pi.my};
      return;
    }
    drawPtrId = e.pointerId;
    const pt = s2c(e.clientX, e.clientY);
    if (S.img) { imgDrag = true; S.lx = pt.x; S.ly = pt.y; return; }
    S.lx = pt.x; S.ly = pt.y; S.sx = pt.x; S.sy = pt.y;
    if (e.button === 1 || S.ct === 'hand') { S.panning = true; S.lx = e.clientX; S.ly = e.clientY; return; }
    if (S.ct === 'paste') { pasteAt(pt.x, pt.y); return; }
    if (S.ct === 'fill') { pU(); floodFill(pt.x, pt.y); return; }
    if (S.ct === 'text') { S.txX = pt.x; S.txY = pt.y; $('txMo').classList.add('show'); $('txIn').focus(); return; }
    S.drawing = true;
    if (S.ct === 'pen') { pU(); S.pts = [pt]; drawPen(); cvs.st.style.opacity = S.alpha; }
    else if (S.ct === 'eraser') { pU(); S.eSnap = curX().getImageData(0,0,CW,CH); S.pts = [pt]; applyEraser(); }
    else if (S.ct === 'select') { S.sel = {x:pt.x, y:pt.y, w:0, h:0}; }
    else if (S.ct === 'lasso') { S.lassoPath = [pt]; $('lassoPath').setAttribute('d', `M${pt.x},${pt.y}`); }
    else if (S.ct === 'line' || S.ct === 'rect' || S.ct === 'circle') { pU(); cx.dr.clearRect(0,0,CW,CH); }
  });

  vp_el.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (ptrs.size >= 2 && pinch) {
      e.preventDefault(); const pi = getPinchInfo(); if (!pi) return;
      if (pinch.mode === 'img' && S.img) {
        S.img.sc = Math.max(.05, Math.min(5, pinch.sc0*(pi.dist/pinch.dist0)));
        const r = $('cw').getBoundingClientRect();
        S.img.x = pinch.ix0 + (pi.mx-pinch.mx0)*(CW/r.width);
        S.img.y = pinch.iy0 + (pi.my-pinch.my0)*(CH/r.height);
        drawImgPrev();
      } else if (pinch.mode === 'canvas') {
        S.zoom = Math.max(.1, Math.min(8, pinch.zoom0*(pi.dist/pinch.dist0)));
        S.panX = pinch.px0 + (pi.mx-pinch.mx0); S.panY = pinch.py0 + (pi.my-pinch.my0); updT();
      }
      return;
    }
    if (e.pointerId !== drawPtrId) return;
    if (S.img && imgDrag) { const pt=s2c(e.clientX,e.clientY); S.img.x+=pt.x-S.lx; S.img.y+=pt.y-S.ly; S.lx=pt.x; S.ly=pt.y; drawImgPrev(); return; }
    if (S.panning) { S.panX+=e.clientX-S.lx; S.panY+=e.clientY-S.ly; S.lx=e.clientX; S.ly=e.clientY; updT(); return; }
    const pt = s2c(e.clientX, e.clientY);
    if (S.ct === 'paste' && S.clip) { cx.fl.clearRect(0,0,CW,CH); cx.fl.globalAlpha=.5; cx.fl.drawImage(S.clip, pt.x-S.clip.width/2, pt.y-S.clip.height/2); cx.fl.globalAlpha=1; return; }
    if (!S.drawing) return;
    if (S.ct === 'pen') { S.pts.push(pt); drawPen(); }
    else if (S.ct === 'eraser') { S.pts.push(pt); applyEraser(); }
    else if (S.ct === 'line' || S.ct === 'rect' || S.ct === 'circle') {
      const dc = cx.dr; dc.clearRect(0,0,CW,CH); dc.lineCap='round'; dc.lineJoin='round'; dc.globalAlpha=S.alpha;
      if (S.ct === 'line') {
        if (S.penOut) { dc.strokeStyle=S.penOutC; dc.lineWidth=S.cs+S.penOutW*2; dc.beginPath(); dc.moveTo(S.sx,S.sy); dc.lineTo(pt.x,pt.y); dc.stroke(); }
        dc.strokeStyle=S.cc; dc.lineWidth=S.cs; dc.beginPath(); dc.moveTo(S.sx,S.sy); dc.lineTo(pt.x,pt.y); dc.stroke();
      } else if (S.ct === 'rect') { dc.strokeStyle=S.cc; dc.lineWidth=S.cs; dc.beginPath(); dc.rect(S.sx,S.sy,pt.x-S.sx,pt.y-S.sy); dc.stroke(); }
      else { dc.strokeStyle=S.cc; dc.lineWidth=S.cs; const rx=Math.abs(pt.x-S.sx)/2, ry=Math.abs(pt.y-S.sy)/2; dc.beginPath(); dc.ellipse((S.sx+pt.x)/2,(S.sy+pt.y)/2,Math.max(rx,1),Math.max(ry,1),0,0,Math.PI*2); dc.stroke(); }
      dc.globalAlpha = 1;
    }
    else if (S.ct === 'select' && S.sel) {
      S.sel.w = pt.x-S.sel.x; S.sel.h = pt.y-S.sel.y;
      const sb = $('selBox'); sb.style.display = 'block';
      const x = Math.min(S.sel.x, S.sel.x+S.sel.w), y = Math.min(S.sel.y, S.sel.y+S.sel.h);
      sb.style.left = (x/CW*100)+'%'; sb.style.top = (y/CH*100)+'%';
      sb.style.width = (Math.abs(S.sel.w)/CW*100)+'%'; sb.style.height = (Math.abs(S.sel.h)/CH*100)+'%';
    }
    else if (S.ct === 'lasso') {
      S.lassoPath.push(pt);
      let d = 'M'+S.lassoPath[0].x+','+S.lassoPath[0].y;
      for (let i = 1; i < S.lassoPath.length; i++) d += 'L'+S.lassoPath[i].x+','+S.lassoPath[i].y;
      $('lassoPath').setAttribute('d', d);
    }
  });

  function handlePointerUp(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (e.pointerId !== drawPtrId) return;
    drawPtrId = null;
    if (imgDrag) { imgDrag = false; return; }
    if (S.panning) { S.panning = false; return; }
    if (!S.drawing) return; S.drawing = false;
    if (S.ct === 'pen') { commitPen(); S.pts=[]; commitUndo(); afterEdit(); }
    else if (S.ct === 'eraser') { S.eSnap=null; S.pts=[]; commitUndo(); afterEdit(); }
    else if (S.ct === 'line' || S.ct === 'rect' || S.ct === 'circle') { curX().drawImage(cvs.dr,0,0); cx.dr.clearRect(0,0,CW,CH); commitUndo(); afterEdit(); }
    else if (S.ct === 'select' && S.sel) {
      if (S.sel.w<0) { S.sel.x+=S.sel.w; S.sel.w*=-1; } if (S.sel.h<0) { S.sel.y+=S.sel.h; S.sel.h*=-1; }
      if (S.sel.w>2 && S.sel.h>2) $('selMo').classList.add('show');
      else { S.sel=null; $('selBox').style.display='none'; }
      return;
    }
    else if (S.ct === 'lasso' && S.lassoPath.length > 4) {
      const pts=S.lassoPath;
      const mnx=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.x)))), mny=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.y))));
      const mxx=Math.min(CW,Math.ceil(Math.max(...pts.map(p=>p.x)))), mxy=Math.min(CH,Math.ceil(Math.max(...pts.map(p=>p.y))));
      if (mxx-mnx>2 && mxy-mny>2) { S.sel={x:mnx,y:mny,w:mxx-mnx,h:mxy-mny,lasso:pts}; $('selMo').classList.add('show'); }
      else { $('lassoPath').setAttribute('d',''); S.lassoPath=[]; }
      return;
    }
    curX().globalCompositeOperation = 'source-over'; curX().globalAlpha = 1;
  }
  vp_el.addEventListener('pointerup', handlePointerUp);
  vp_el.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (ptrs.size<2) pinch=null; if (e.pointerId===drawPtrId) cancelDraw(); });
  vp_el.addEventListener('wheel', e => {
    e.preventDefault();
    if (S.img) { S.img.sc = Math.max(.05, Math.min(5, S.img.sc*(e.deltaY>0?.92:1.08))); drawImgPrev(); }
    else { S.zoom *= e.deltaY>0?.9:1.1; S.zoom = Math.max(.1, Math.min(8, S.zoom)); updT(); }
  }, {passive:false});
  vp_el.addEventListener('dblclick', () => { if (S.img) commitImg(); });
  vp_el.addEventListener('contextmenu', e => {
    e.preventDefault();
    const cm = $('ctxMenu');
    cm.style.left = Math.min(e.clientX, innerWidth-150)+'px';
    cm.style.top = Math.min(e.clientY, innerHeight-120)+'px';
    cm.classList.add('show');
  });
}
