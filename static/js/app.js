'use strict';
(function(){
  const G=window.UgokuDraw,U=G.Utils,C=G.Config,S=G.State,E=G.Engine,R=G.Renderer,T=G.Tools,TL=G.Timeline,A=G.Audio,EX=G.Export,ST=G.Storage,UI=G.UI,VP=G.VectorPaths;

  UI.buildHTML();

  U.$$('.nav-item').forEach(b=>{b.onclick=()=>{
    if(S.playing) TL.stop();
    UI.showPage(b.dataset.page);
  };});

  const ptrs=new Map();
  let pinch=null,drawPtrId=null,imgDrag=false,lastPixelX=-1,lastPixelY=-1;
  let tfDrag=false, tfStartX=0, tfStartY=0, tfHandle=null;
  const getPinch=()=>{const vs=[...ptrs.values()];if(vs.length<2)return null;return{dist:Math.hypot(vs[0].x-vs[1].x,vs[0].y-vs[1].y),mx:(vs[0].x+vs[1].x)/2,my:(vs[0].y+vs[1].y)/2};};
  const cancelDraw=()=>{if(S.drawing){S.drawing=false;S.pts=[];const dpr=C.DPR;R.contexts.strokeC.save();R.contexts.strokeC.setTransform(1,0,0,1,0,0);R.contexts.strokeC.clearRect(0,0,S.CW*dpr,S.CH*dpr);R.contexts.strokeC.restore();R.contexts.strokeC.setTransform(dpr,0,0,dpr,0,0);R.contexts.drC.clearRect(0,0,S.CW,S.CH);S.eSnap=null;}drawPtrId=null;};

  const vp=U.$('viewport');
  vp.addEventListener('pointerdown',e=>{
    if(e.target.closest('.img-hud') || e.target.closest('.zoom-cluster') || e.target.closest('.sel-zoom-btn') || e.target.closest('.hud-badge')) return;
    if(S.playing)return;e.preventDefault();
    vp.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size>=2){
      cancelDraw();imgDrag=false;
      const pi=getPinch();
      if(S.img) pinch={mode:'img',dist0:pi.dist,sc0:S.img.sc,mx0:pi.mx,my0:pi.my,ix0:S.img.x,iy0:S.img.y};
      else if(S.transformMode && S.transformData) pinch={mode:'transform',dist0:pi.dist,sx0:S.transformData.scaleX,sy0:S.transformData.scaleY,mx0:pi.mx,my0:pi.my,tx0:S.transformData.x,ty0:S.transformData.y};
      else pinch={mode:'canvas',dist0:pi.dist,zoom0:S.zoom,px0:S.panX,py0:S.panY,mx0:pi.mx,my0:pi.my};
      return;
    }
    drawPtrId=e.pointerId;
    const pt=R.screenToCanvas(e.clientX,e.clientY,S);pt.p=e.pressure||0.5;

    if(S.transformMode && S.transformData){
      tfDrag=true;
      tfStartX=pt.x;
      tfStartY=pt.y;
      const td=S.transformData;
      const dw=td.w*td.scaleX, dh=td.h*td.scaleY;
      const dx=pt.x-td.x, dy=pt.y-td.y;
      const hr=10/S.zoom;
      const handles = [
        {name:'tl',hx:-dw/2,hy:-dh/2},{name:'tr',hx:dw/2,hy:-dh/2},
        {name:'bl',hx:-dw/2,hy:dh/2},{name:'br',hx:dw/2,hy:dh/2},
        {name:'t',hx:0,hy:-dh/2},{name:'b',hx:0,hy:dh/2},
        {name:'l',hx:-dw/2,hy:0},{name:'r',hx:dw/2,hy:0},
      ];
      tfHandle = null;
      for(const h of handles){
        if(Math.abs(dx-h.hx)<hr && Math.abs(dy-h.hy)<hr){ tfHandle=h.name; break; }
      }
      return;
    }

    if(S.img){imgDrag=true;S.lx=pt.x;S.ly=pt.y;return;}
    S.lx=pt.x;S.ly=pt.y;S.sx=pt.x;S.sy=pt.y;
    if(e.button===1||S.ct==='hand'){S.panning=true;S.lx=e.clientX;S.ly=e.clientY;return;}

    if(S.cpMode && VP){
      const hit=VP.hitTestCP(E.curId(),S.cl,pt.x,pt.y,S.zoom);
      if(hit){
        S.cpSelectedPath=hit.pathId;
        S.cpSelectedPoint=hit.ptIdx;
        S.cpDragging=true;
        T.drawControlPointOverlay();
      } else {
        S.cpSelectedPath=null;
        S.cpSelectedPoint=-1;
        T.drawControlPointOverlay();
      }
      return;
    }

    if(S.ct==='eyedrop'){
      const hex=T.eyedrop(pt.x,pt.y);
      if(hex){S.cc=hex;U.$('customColor').value=hex;U.$$('.color-swatch').forEach(c=>c.classList.remove('on'));U.$$('.qc').forEach(c=>c.classList.remove('on'));T.drawEyedropPreview(pt.x,pt.y,hex);E.toast('色: '+hex);}
      return;
    }
    if(S.ct==='paste'){T.pasteAt(pt.x,pt.y);return;}
    if(S.ct==='fill'){E.pushUndo();T.floodFill(pt.x,pt.y);return;}
    if(S.ct==='text'){
      S.txX=pt.x;S.txY=pt.y;
      U.$('textModal').classList.add('show');
      U.$('textInput').focus();
      ptrs.delete(e.pointerId);
      vp.releasePointerCapture(e.pointerId);
      return;
    }
    if(S.ct==='pixel'){
      E.pushUndo();T.drawPixel(pt.x,pt.y);lastPixelX=pt.x;lastPixelY=pt.y;
      S.drawing=true;return;
    }

    S.drawing=true;
    if(S.ct==='pen'){E.pushUndo();S.pts=[pt];T.drawPenStroke();R.canvases.strokeC.style.opacity=S.alpha;}
    else if(S.ct==='eraser'){S.pts=[pt];T.drawEraserPreview();}
    else if(S.ct==='select'){S.sel={x:pt.x,y:pt.y,w:0,h:0};}
    else if(S.ct==='lasso'){S.lassoPath=[pt];U.$('lassoPath').setAttribute('d',`M${pt.x},${pt.y}`);}
    else if(['line','rect','circle','star','heart'].includes(S.ct)){
      E.pushUndo();R.contexts.drC.clearRect(0,0,S.CW,S.CH);
    }
  });

  vp.addEventListener('pointermove',e=>{
    if(!ptrs.has(e.pointerId))return;
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1&&!S.drawing&&!tfDrag){
      const pt=R.screenToCanvas(e.clientX,e.clientY,S);
      if(S.cpMode){
        T.drawCursor(pt.x,pt.y);
      } else if(S.ct==='eyedrop'){
        const hex=T.eyedrop(pt.x,pt.y);T.drawEyedropPreview(pt.x,pt.y,hex);
      } else T.drawCursor(pt.x,pt.y);
    }
    if(ptrs.size>=2&&pinch){
      e.preventDefault();const pi=getPinch();if(!pi)return;
      if(pinch.mode==='img'&&S.img){
        S.img.sc=U.clamp(pinch.sc0*(pi.dist/pinch.dist0),0.05,5);
        const r=U.$('cw').getBoundingClientRect();
        S.img.x=pinch.ix0+(pi.mx-pinch.mx0)*(S.CW/r.width);S.img.y=pinch.iy0+(pi.my-pinch.my0)*(S.CH/r.height);
        T.drawImagePreview();
      } else if(pinch.mode==='transform'&&S.transformData){
        const td=S.transformData;
        td.scaleX=U.clamp(pinch.sx0*(pi.dist/pinch.dist0),0.1,10);
        td.scaleY=U.clamp(pinch.sy0*(pi.dist/pinch.dist0),0.1,10);
        const r=U.$('cw').getBoundingClientRect();
        td.x=pinch.tx0+(pi.mx-pinch.mx0)*(S.CW/r.width);
        td.y=pinch.ty0+(pi.my-pinch.my0)*(S.CH/r.height);
        T.drawTransformPreview();
      } else if(pinch.mode==='canvas'){
        S.zoom=U.clamp(pinch.zoom0*(pi.dist/pinch.dist0),C.MIN_ZOOM,C.MAX_ZOOM);
        S.panX=pinch.px0+(pi.mx-pinch.mx0);S.panY=pinch.py0+(pi.my-pinch.my0);E.updateTransform();
      }
      return;
    }
    if(e.pointerId!==drawPtrId)return;

    if(S.transformMode && tfDrag && S.transformData){
      const pt=R.screenToCanvas(e.clientX,e.clientY,S);
      const td=S.transformData;
      if(tfHandle){
        const dx=pt.x-tfStartX, dy=pt.y-tfStartY;
        if(tfHandle==='br'||tfHandle==='tr'||tfHandle==='r'){td.scaleX=U.clamp(td.scaleX+dx/td.w,0.1,10);}
        if(tfHandle==='bl'||tfHandle==='tl'||tfHandle==='l'){td.scaleX=U.clamp(td.scaleX-dx/td.w,0.1,10);}
        if(tfHandle==='br'||tfHandle==='bl'||tfHandle==='b'){td.scaleY=U.clamp(td.scaleY+dy/td.h,0.1,10);}
        if(tfHandle==='tr'||tfHandle==='tl'||tfHandle==='t'){td.scaleY=U.clamp(td.scaleY-dy/td.h,0.1,10);}
        tfStartX=pt.x; tfStartY=pt.y;
      } else {
        td.x += pt.x - tfStartX;
        td.y += pt.y - tfStartY;
        tfStartX=pt.x; tfStartY=pt.y;
      }
      T.drawTransformPreview();
      return;
    }

    if(S.cpMode && S.cpDragging && VP){
      const pt=R.screenToCanvas(e.clientX,e.clientY,S);
      VP.moveCP(E.curId(),S.cl,S.cpSelectedPath,S.cpSelectedPoint,pt.x,pt.y);
      E.redrawSingleVectorLayer(E.curId(), S.cl);
      T.drawControlPointOverlay();
      return;
    }

    if(S.img&&imgDrag){const pt=R.screenToCanvas(e.clientX,e.clientY,S);S.img.x+=pt.x-S.lx;S.img.y+=pt.y-S.ly;S.lx=pt.x;S.ly=pt.y;T.drawImagePreview();return;}
    if(S.panning){S.panX+=e.clientX-S.lx;S.panY+=e.clientY-S.ly;S.lx=e.clientX;S.ly=e.clientY;E.updateTransform();return;}
    const pt=R.screenToCanvas(e.clientX,e.clientY,S);pt.p=e.pressure||0.5;
    if(S.ct==='paste'&&S.clip){R.contexts.floatC.clearRect(0,0,S.CW,S.CH);R.contexts.floatC.globalAlpha=0.5;R.contexts.floatC.drawImage(S.clip,pt.x-S.clip.width/2,pt.y-S.clip.height/2);R.contexts.floatC.globalAlpha=1;return;}
    if(!S.drawing)return;

    if(S.ct==='pixel'){
      T.drawPixelLine(lastPixelX,lastPixelY,pt.x,pt.y,false);
      lastPixelX=pt.x;lastPixelY=pt.y;T.drawCursor(pt.x,pt.y);return;
    }
    if(S.ct==='pen'){S.pts.push(pt);T.drawPenStroke();}
    else if(S.ct==='eraser'){S.pts.push(pt);T.drawEraserPreview();}
    else if(['line','rect','circle','star','heart'].includes(S.ct)){T.drawShapePreview(pt);}
    else if(S.ct==='select'&&S.sel){
      S.sel.w=pt.x-S.sel.x;S.sel.h=pt.y-S.sel.y;
      const sb=U.$('selBox');sb.style.display='block';
      const x=Math.min(S.sel.x,S.sel.x+S.sel.w),y=Math.min(S.sel.y,S.sel.y+S.sel.h);
      sb.style.left=(x/S.CW*100)+'%';sb.style.top=(y/S.CH*100)+'%';
      sb.style.width=(Math.abs(S.sel.w)/S.CW*100)+'%';sb.style.height=(Math.abs(S.sel.h)/S.CH*100)+'%';
    }
    else if(S.ct==='lasso'){
      S.lassoPath.push(pt);let d='M'+S.lassoPath[0].x+','+S.lassoPath[0].y;
      for(let i=1;i<S.lassoPath.length;i++)d+='L'+S.lassoPath[i].x+','+S.lassoPath[i].y;
      U.$('lassoPath').setAttribute('d',d);
    }
  });

  function handlePointerUp(e){
    ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
    if(e.pointerId!==drawPtrId)return;drawPtrId=null;

    if(S.transformMode && tfDrag){
      tfDrag=false;
      tfHandle=null;
      return;
    }

    if(S.cpMode && S.cpDragging){
      S.cpDragging=false;
      E.snapToCache();E.markDirty(E.curId(),S.cl);E.curFr().thumbDirty=true;
      E.afterEdit();
      return;
    }

    if(imgDrag){imgDrag=false;return;}
    if(S.panning){S.panning=false;return;}
    if(S.ct==='eyedrop'){R.contexts.cursorC.clearRect(0,0,S.CW,S.CH);return;}
    if(!S.drawing)return;S.drawing=false;

    if(S.ct==='pixel'){lastPixelX=-1;lastPixelY=-1;E.commitUndo();E.afterEdit();return;}
    if(S.ct==='pen'){T.commitPenStroke();S.pts=[];E.commitUndo();E.afterEdit();}
    else if(S.ct==='eraser'){
      T.commitEraser();
      S.pts=[];
      E.snapToCache();E.markDirty(E.curId(),S.cl);E.curFr().thumbDirty=true;
      if(G.Timeline) G.Timeline.renderDebounced();
      if(G.Storage) G.Storage.debounceSave();
    }
    else if(['line','rect','circle','star','heart'].includes(S.ct)){
      const pt=R.screenToCanvas(e.clientX,e.clientY,S);
      const dpr=C.DPR;
      R.contexts.drC.clearRect(0,0,S.CW,S.CH);
      T.commitShape(pt);
      E.commitUndo();E.afterEdit();
    }
    else if(S.ct==='select'&&S.sel){
      if(S.sel.w<0){S.sel.x+=S.sel.w;S.sel.w*=-1;}
      if(S.sel.h<0){S.sel.y+=S.sel.h;S.sel.h*=-1;}
      if(S.sel.w>2&&S.sel.h>2){U.$('selModal').classList.add('show');if(UI.showSelZoomBtn)UI.showSelZoomBtn(true);}
      else{S.sel=null;U.$('selBox').style.display='none';if(UI.showSelZoomBtn)UI.showSelZoomBtn(false);}return;
    }
    else if(S.ct==='lasso'&&S.lassoPath.length>4){
      const pts=S.lassoPath;
      const mnx=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.x)))),mny=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.y))));
      const mxx=Math.min(S.CW,Math.ceil(Math.max(...pts.map(p=>p.x)))),mxy=Math.min(S.CH,Math.ceil(Math.max(...pts.map(p=>p.y))));
      if(mxx-mnx>2&&mxy-mny>2){S.sel={x:mnx,y:mny,w:mxx-mnx,h:mxy-mny,lasso:pts};U.$('selModal').classList.add('show');if(UI.showSelZoomBtn)UI.showSelZoomBtn(true);}
      else{U.$('lassoPath').setAttribute('d','');S.lassoPath=[];}return;
    }
    E.curX().globalCompositeOperation='source-over';E.curX().globalAlpha=1;
  }

  vp.addEventListener('pointerup',handlePointerUp);
  vp.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(e.pointerId===drawPtrId)cancelDraw();});

  vp.addEventListener('wheel',e=>{
    e.preventDefault();
    if(S.img){
      S.img.sc=U.clamp(S.img.sc*(e.deltaY>0?0.92:1.08),0.05,5);
      T.drawImagePreview();
    } else if(S.transformMode && S.transformData){
      const td=S.transformData;
      const angle = e.deltaY > 0 ? 5 : -5;
      td.rotation += angle;
      T.drawTransformPreview();
    } else {
      const factor=e.deltaY>0?0.9:1.1;
      E.zoomAtPoint(factor,e.clientX,e.clientY);
    }
  },{passive:false});


vp.addEventListener('dblclick', e => {
    if(e.target.closest('.img-hud') || e.target.closest('.zoom-cluster') || e.target.closest('.sel-zoom-btn') || e.target.closest('.hud-badge')) return;
    if(S.img)T.commitImage();
    if(S.transformMode)T.commitTransform();
  });

  vp.addEventListener('contextmenu',e=>{e.preventDefault();const cm=U.$('ctxMenu');cm.style.left=Math.min(e.clientX,innerWidth-180)+'px';cm.style.top=Math.min(e.clientY,innerHeight-150)+'px';cm.classList.add('show');});

  document.addEventListener('click',e=>{if(!e.target.closest('.ctx-menu'))U.$('ctxMenu').classList.remove('show');});
  U.$$('[data-ctx]').forEach(it=>{it.onclick=()=>{U.$('ctxMenu').classList.remove('show');const a=it.dataset.ctx;if(a==='undo')E.undo();else if(a==='redo')E.redo();else if(a==='paste'&&S.clip){S.ct='paste';U.$$('[data-tool]').forEach(b=>b.classList.remove('on'));E.toast('貼り付けモード');}else if(a==='clear'){E.pushUndo();E.curX().clearRect(0,0,S.CW,S.CH);E.commitUndo();E.afterEdit();E.toast('レイヤー消去');}else if(a==='eyedrop'){S.ct='eyedrop';U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='eyedrop'));E.toast('スポイト');}};});

  U.$$('[data-tool]').forEach(b=>{b.onclick=()=>{
    if(S.ct==='paste')R.contexts.floatC.clearRect(0,0,S.CW,S.CH);
    U.$$('.dock-tool').forEach(t=>t.classList.remove('on'));b.classList.add('on');

    const tool=b.dataset.tool;

    if(tool==='cpEdit'){
      S.cpMode=!S.cpMode;
      b.classList.toggle('on',S.cpMode);
      if(S.cpMode){
        E.toast('制御点モード');
        T.drawControlPointOverlay();
      } else {
        S.cpSelectedPath=null;S.cpSelectedPoint=-1;
        R.contexts.cursorC.clearRect(0,0,S.CW,S.CH);
        E.toast('制御点モード OFF');
      }
      return;
    }

    S.cpMode=false;
    S.ct=tool;
    U.$('selBox').style.display='none';U.$('lassoPath').setAttribute('d','');S.sel=null;S.lassoPath=[];
    vp.style.cursor=S.ct==='hand'?'grab':S.ct==='eyedrop'?'crosshair':'crosshair';
    if(S.ct==='pixel'&&!S.pixelMode){S.pixelMode=true;S.grid=true;E.updateGrid();E.updateTransform();}
    R.contexts.cursorC.clearRect(0,0,S.CW,S.CH);
  };});

  U.$('selCopyBtn').onclick=()=>T.selectionAction('copy');
  U.$('selCutBtn').onclick=()=>T.selectionAction('cut');
  U.$('selTransformBtn').onclick=()=>T.selectionAction('transform');
  U.$('selCancelBtn').onclick=()=>{U.$('selModal').classList.remove('show');S.sel=null;U.$('selBox').style.display='none';U.$('lassoPath').setAttribute('d','');S.lassoPath=[];if(UI.showSelZoomBtn)UI.showSelZoomBtn(false);};

  U.$('tfOk').onclick=()=>T.commitTransform();
  U.$('tfCn').onclick=()=>T.cancelTransform();
U.$('tfRotL').onclick=()=>{ if(S.transformData){ S.transformData.rotation -= 15; T.drawTransformPreview(); } };
  U.$('tfRotR').onclick=()=>{ if(S.transformData){ S.transformData.rotation += 15; T.drawTransformPreview(); } };

  const selZoomBtn=U.$('selZoomBtn');
  if(selZoomBtn) selZoomBtn.onclick=()=>UI.zoomToSelection();
  const selZoomModalBtn=U.$('selZoomModalBtn');
  if(selZoomModalBtn) selZoomModalBtn.onclick=()=>UI.zoomToSelection();

  U.$('textOk').onclick=()=>{
    const t=U.$('textInput').value;
    if(t){E.pushUndo();const ctx=E.curX();const bold=U.$('textBold').checked?'bold ':'';
    ctx.font=`${bold}${S.txFs}px 'M PLUS Rounded 1c',sans-serif`;ctx.globalAlpha=S.alpha;ctx.textBaseline='top';
    if(U.$('textOutline').checked){ctx.strokeStyle=U.$('textOutColor').value;ctx.lineWidth=+U.$('textOutWidth').value;ctx.lineJoin='round';ctx.miterLimit=2;ctx.strokeText(t,S.txX,S.txY);}
    ctx.fillStyle=S.cc;ctx.fillText(t,S.txX,S.txY);ctx.globalAlpha=1;E.commitUndo();E.afterEdit();}
    U.$('textModal').classList.remove('show');U.$('textInput').value='';
  };
  U.$('textCancel').onclick=()=>U.$('textModal').classList.remove('show');
  U.$('textSize').oninput=e=>{S.txFs=+e.target.value;U.$('textSizeLabel').textContent=e.target.value+'px';};
  U.$('textOutline').onchange=e=>{U.$('textOutlineOpts').style.display=e.target.checked?'flex':'none';};
  U.$('textOutWidth').oninput=e=>{U.$('textOutWidthLabel').textContent=e.target.value+'px';};

  U.$('imgOk').onclick=()=>T.commitImage();
  U.$('imgCn').onclick=()=>T.cancelImage();
  U.$('addPhotoBtn').onclick=()=>U.$('imgInput').click();
  U.$('imgInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>T.startImagePlace(img);img.src=URL.createObjectURL(f);U.$('imgInput').value='';};

  U.$$('.color-swatch').forEach(c=>{c.onclick=()=>{U.$$('.color-swatch').forEach(x=>x.classList.remove('on'));c.classList.add('on');S.cc=c.dataset.c;U.$$('.qc').forEach(q=>q.classList.remove('on'));U.$$('.qc').forEach(q=>{if(q.dataset.c===S.cc)q.classList.add('on');});};});
  U.$$('.qc').forEach(c=>{c.onclick=()=>{U.$$('.qc').forEach(x=>x.classList.remove('on'));c.classList.add('on');S.cc=c.dataset.c;U.$$('.color-swatch').forEach(x=>x.classList.remove('on'));U.$$('.color-swatch').forEach(x=>{if(x.dataset.c===S.cc)x.classList.add('on');});};});
  U.$('customColor').oninput=e=>{S.cc=e.target.value;U.$$('.color-swatch').forEach(x=>x.classList.remove('on'));U.$$('.qc').forEach(x=>x.classList.remove('on'));};

  U.$$('.size-dot').forEach(b=>{b.onclick=()=>{U.$$('.size-dot').forEach(x=>x.classList.remove('on'));b.classList.add('on');S.cs=+b.dataset.size;U.$$('.qs').forEach(x=>x.classList.toggle('on',+x.dataset.size===S.cs));};});
  U.$$('.qs').forEach(b=>{b.onclick=()=>{U.$$('.qs').forEach(x=>x.classList.remove('on'));b.classList.add('on');S.cs=+b.dataset.size;U.$$('.size-dot').forEach(x=>x.classList.toggle('on',+x.dataset.size===S.cs));};});
  U.$('alphaRange').oninput=e=>{S.alpha=+e.target.value/100;U.$('alphaLabel').textContent=e.target.value+'%';};
  U.$('smoothRange').oninput=e=>{S.penSmooth=+e.target.value;U.$('smoothLabel').textContent=e.target.value;};
  U.$('outlineCheck').onchange=e=>{S.penOut=e.target.checked;U.$('outlineOpts').classList.toggle('hide',!S.penOut);U.$('outlineToggle').classList.toggle('on',S.penOut);};
  U.$('outlineColor').oninput=e=>{S.penOutC=e.target.value;};
  U.$('outlineWidth').oninput=e=>{S.penOutW=+e.target.value;};
  U.$('fillCheck').onchange=e=>{S.shapeFill=e.target.checked;U.$('fillToggle').classList.toggle('on',e.target.checked);};
  U.$('pressureCheck').onchange=e=>{S.pressure=e.target.checked;U.$('pressureToggle').classList.toggle('on',e.target.checked);};

  U.$('pixelModeCheck').onchange=e=>{S.pixelMode=e.target.checked;U.$('pixelModeToggle').classList.toggle('on',e.target.checked);E.updateGrid();E.updateTransform();};
  U.$('pixelSizeRange').oninput=e=>{S.pixelSize=+e.target.value;U.$('pixelSizeLabel').textContent=e.target.value+'px';if(S.grid)E.updateGrid();};

  U.$$('[data-sym]').forEach(b=>{b.onclick=()=>{U.$$('[data-sym]').forEach(x=>x.classList.remove('on'));b.classList.add('on');S.symmetry=b.dataset.sym;E.toast('対称: '+b.textContent);};});

  U.$('onionBtn').onclick=()=>{S.onion=!S.onion;U.$('onionBtn').classList.toggle('on',S.onion);E.updateOnion();E.toast(S.onion?'オニオンスキン ON':'オニオンスキン OFF');};
  U.$('gridBtn').onclick=()=>{S.grid=!S.grid;U.$('gridBtn').classList.toggle('on',S.grid);E.updateGrid();E.toast(S.grid?'グリッド ON':'グリッド OFF');};
  U.$('paperBtn').onclick=()=>U.$('paperModal').classList.add('show');
  U.$('ratioBtn').onclick=()=>U.$('ratioModal').classList.add('show');
  U.$$('.paper-opt').forEach(o=>{o.onclick=()=>{U.$$('.paper-opt').forEach(x=>x.classList.remove('on'));o.classList.add('on');S.pc=o.dataset.p;E.updatePaperColor();};});

  U.$('rotateBtn').onclick=()=>U.$('rotateModal').classList.add('show');
  U.$$('[data-rot]').forEach(b=>{b.onclick=()=>{T.rotateLayer(+b.dataset.rot);U.$('rotateModal').classList.remove('show');};});
  U.$('rotCustomBtn').onclick=()=>{T.rotateLayer(+U.$('rotAngle').value);U.$('rotateModal').classList.remove('show');};
  U.$('flipHBtn').onclick=()=>T.flipLayer('h');
  U.$('flipVBtn').onclick=()=>T.flipLayer('v');

  U.$('mergeBtn').onclick=()=>U.$('mergeModal').classList.add('show');
  U.$('mergeDownBtn').onclick=()=>{
    if(S.cl==='Photo')return E.toast('写真レイヤーは結合できません');
    const idx=S.layerOrder.indexOf(S.cl);if(idx<=0)return E.toast('下にレイヤーがありません');
    E.pushUndo();
    E.flattenLayerToRaster(E.curId(), S.cl);
    E.getLayerCtx(S.layerOrder[idx-1]).drawImage(E.curC(),0,0);E.curX().clearRect(0,0,S.CW,S.CH);
    E.commitUndo();E.afterEdit();U.$('mergeModal').classList.remove('show');E.toast('下に結合しました');
  };
  U.$('mergeAllBtn').onclick=()=>{
    E.pushUndo();
    ['A','B','C'].forEach(l => E.flattenLayerToRaster(E.curId(), l));
    const tmp=document.createElement('canvas');tmp.width=S.CW;tmp.height=S.CH;const tc=tmp.getContext('2d');
    S.layerOrder.forEach(l=>tc.drawImage(E.getLayerCanvas(l),0,0));
    E.getLayerCtx('A').clearRect(0,0,S.CW,S.CH);E.getLayerCtx('A').drawImage(tmp,0,0);
    E.getLayerCtx('B').clearRect(0,0,S.CW,S.CH);E.getLayerCtx('C').clearRect(0,0,S.CW,S.CH);
    E.commitUndo();E.snapToCache();E.markAllDirty(E.curId());
    E.curFr().thumbDirty=true;TL.renderDebounced();U.$('mergeModal').classList.remove('show');E.toast('すべてAに結合しました');
  };
  U.$('flattenVecBtn').onclick=()=>{
    E.flattenLayerToRaster(E.curId(), S.cl);
    E.snapToCache();E.markDirty(E.curId(),S.cl);E.curFr().thumbDirty=true;
    TL.renderDebounced();U.$('mergeModal').classList.remove('show');E.toast('ベクターを焼き付けました');
  };

  U.$('zoomInBtn').onclick=()=>{S.zoom=Math.min(C.MAX_ZOOM,S.zoom*1.25);E.updateTransform();};
  U.$('zoomOutBtn').onclick=()=>{S.zoom=Math.max(C.MIN_ZOOM,S.zoom/1.25);E.updateTransform();};
  U.$('fitViewBtn').onclick=E.fitView;

  U.$('playBtn').onclick=()=>TL.play();
  U.$('stopBtn').onclick=()=>TL.stop();
  const tlPlayBtn=U.$('tlPlayBtn');if(tlPlayBtn) tlPlayBtn.onclick=()=>TL.play();
  const tlStopBtn=U.$('tlStopBtn');if(tlStopBtn) tlStopBtn.onclick=()=>TL.stop();

  U.$('prevFrBtn').onclick=()=>{if(S.cf>0)TL.switchFrame(S.cf-1);};
  U.$('nextFrBtn').onclick=()=>{if(S.cf<S.frames.length-1)TL.switchFrame(S.cf+1);};

  U.$('firstFBtn').onclick=()=>{if(S.cf>0)TL.switchFrame(0);};
  U.$('lastFBtn').onclick=()=>{if(S.cf<S.frames.length-1)TL.switchFrame(S.frames.length-1);};
  U.$('prevFBtn').onclick=()=>{if(S.cf>0)TL.switchFrame(S.cf-1);};
  U.$('nextFBtn').onclick=()=>{if(S.cf<S.frames.length-1)TL.switchFrame(S.cf+1);};
  U.$('fpsRange').oninput=e=>{S.fps=+e.target.value;U.$('fpsNum').textContent=S.fps;if(S.playing){TL.stop();TL.play();}};
  U.$('frameCounter').onclick=()=>{U.$('gotoNum').value=S.cf+1;U.$('gotoMax').textContent=S.frames.length;U.$('gotoModal').classList.add('show');U.$('gotoNum').focus();};
  U.$('gotoOk').onclick=()=>{const n=U.clamp(+U.$('gotoNum').value,1,S.frames.length)-1;U.$('gotoModal').classList.remove('show');if(n!==S.cf)TL.switchFrame(n);};

  if(UI.initLoopToggle) UI.initLoopToggle();
  if(UI.initScrubber) UI.initScrubber();

  U.$('addFrameBtn').onclick=()=>TL.addFrame();
  U.$('dupFrameBtn').onclick=()=>TL.duplicateFrame();
  U.$('delFrameBtn').onclick=()=>TL.deleteFrame();
  const tlAddBtn=U.$('tlAddBtn');if(tlAddBtn) tlAddBtn.onclick=()=>TL.addFrame();
  const tlDupBtn=U.$('tlDupBtn');if(tlDupBtn) tlDupBtn.onclick=()=>TL.duplicateFrame();
  const tlDelBtn=U.$('tlDelBtn');if(tlDelBtn) tlDelBtn.onclick=()=>TL.deleteFrame();
  U.$('cpFrameBtn').onclick=()=>{E.snapToCache();const c=S.fc.get(E.curId());const dpr=C.DPR;const cl={};['A','B','C','P'].forEach(k=>{cl[k]=c&&c[k]?new ImageData(new Uint8ClampedArray(c[k].data),S.CW*dpr,S.CH*dpr):null;});S.frClip={cache:cl,sfx:E.curFr().sfx};E.toast('コマをコピーしました');};
  U.$('psFrameBtn').onclick=()=>{
    if(!S.frClip)return E.toast('コピーされたコマがありません');
    const dpr=C.DPR;const nf=E.mkFrame();nf.sfx=S.frClip.sfx;const nc={};
    ['A','B','C','P'].forEach(k=>{nc[k]=S.frClip.cache[k]?new ImageData(new Uint8ClampedArray(S.frClip.cache[k].data),S.CW*dpr,S.CH*dpr):null;});
    S.frames.splice(S.cf+1,0,nf);S.fc.set(nf.id,nc);S.cf++;E.cacheToCanvas(E.curId());E.markAllDirty(nf.id);TL.renderTL();E.toast('コマを貼り付けました');
  };
  U.$('addManyBtn').onclick=()=>U.$('addManyModal').classList.add('show');
  U.$('addManyOk').onclick=()=>{
    const n=U.clamp(+U.$('addManyNum').value,1,200);U.$('addManyModal').classList.remove('show');
    E.snapToCache();const dpr=C.DPR;
    for(let i=0;i<n;i++){const nf=E.mkFrame();const nc={A:null,B:null,C:null,P:null};const oc=S.fc.get(E.curId());if(oc&&oc.P)nc.P=new ImageData(new Uint8ClampedArray(oc.P.data),S.CW*dpr,S.CH*dpr);S.frames.splice(S.cf+1+i,0,nf);S.fc.set(nf.id,nc);E.markAllDirty(nf.id);}
    S.cf+=n;E.ensureCached(E.curId()).then(()=>E.cacheToCanvas(E.curId()));TL.renderTL();E.toast(n+'コマ追加しました');
  };

  U.$('undoBtn').onclick=()=>E.undo();
  U.$('redoBtn').onclick=()=>E.redo();

  U.$('audioBtn').onclick=()=>U.$('audioModal').classList.add('show');
  U.$('bgmFile').onchange=async e=>{const f=e.target.files[0];if(f&&await A.loadBGM(f))U.$('prevAudioBtn').disabled=false;};
  U.$('prevAudioBtn').onclick=()=>{};
  U.$('clearAudioBtn').onclick=()=>{A.clearBGM();U.$('prevAudioBtn').disabled=true;};

  const startRecWhilePlaying=async()=>{
    if(await A.startSyncRecord()){
      S.recWhilePlaying=true;
      if(!S.playing) TL.play();
    }
  };
  U.$('recSyncBtn').onclick=startRecWhilePlaying;
  const recBtn2=U.$('recSyncBtn2');
  if(recBtn2) recBtn2.onclick=()=>{
    if(S.recWhilePlaying||S.playing){
      recBtn2.classList.remove('on');
      if(A.stopRecord) A.stopRecord();
      S.recWhilePlaying=false;
    } else {
      recBtn2.classList.add('on');
      startRecWhilePlaying();
    }
  };

  U.$('bgmVolRange').oninput=e=>{A.setBGMVolume(+e.target.value/100);U.$('bgmVolLabel').textContent=e.target.value+'%';};
  U.$('sfxVolRange').oninput=e=>{A.setSFXVolume(+e.target.value/100);U.$('sfxVolLabel').textContent=e.target.value+'%';};
  U.$('sfxPreviewBtn').onclick=()=>{const v=U.$('sfxSelect').value;if(v)A.playSFX(v);};
  U.$('sfxAssignBtn').onclick=()=>{const v=U.$('sfxSelect').value;E.curFr().sfx=v;if(v)A.playSFX(v);TL.renderTL();E.toast(v?'効果音を設定しました':'効果音を解除しました');};

  let pendingRatio=null;
  U.$$('.ratio-opt').forEach(o=>{o.onclick=()=>{
    const r=o.dataset.r,nw=+o.dataset.w,nh=+o.dataset.h;
    if(r===S.ratio){U.$('ratioModal').classList.remove('show');return;}
    let hasData=S.frames.length>1;
    if(!hasData)for(const l of['A','B','C']){const dpr=C.DPR;const d=E.getLayerCtx(l).getImageData(0,0,S.CW*dpr,S.CH*dpr).data;for(let i=3;i<d.length;i+=4)if(d[i]>0){hasData=true;break;}if(hasData)break;}
    if(hasData){pendingRatio={r,nw,nh,el:o};U.$('ratioModal').classList.remove('show');U.$('ratioConfirmModal').classList.add('show');return;}
    applyRatio(r,nw,nh,o);
  };});
  function applyRatio(r,nw,nh,el){
    U.$$('.ratio-opt').forEach(x=>x.classList.remove('on'));if(el)el.classList.add('on');
    S.ratio=r;S.CW=nw;S.CH=nh;U.$('ratioBadge').textContent=r;
    R.initCanvases(S.CW,S.CH);E.updateTransform();E.updatePaperColor();E.updateLayerZOrder();
    S.fc.clear();G.Thumbs.clear();S.frames=[E.mkFrame()];S.cf=0;S.undoStack=[];S.redoStack=[];S.dirtyIds.clear();S.dirtyLayers.clear();
    S.vectorPaths.clear();S.lruOrder=[];
    E.snapToCache();E.markAllDirty(E.curId());TL.renderTL();E.updateOnion();E.fitView();U.$('ratioModal').classList.remove('show');E.toast('比率: '+r);
  }
  U.$('ratioConfOk').onclick=()=>{U.$('ratioConfirmModal').classList.remove('show');if(pendingRatio)applyRatio(pendingRatio.r,pendingRatio.nw,pendingRatio.nh,pendingRatio.el);pendingRatio=null;};
  U.$('ratioConfNo').onclick=()=>{U.$('ratioConfirmModal').classList.remove('show');pendingRatio=null;};

  U.$('saveBtn').onclick=()=>ST.saveProjectFile();
  U.$('loadBtn').onclick=()=>U.$('projInput').click();
  U.$('projInput').onchange=async e=>{const f=e.target.files[0];if(f){await ST.loadProjectFile(f);UI.buildLayerList();}U.$('projInput').value='';};
  U.$('clearAllBtn').onclick=async()=>{if(!confirm('すべてのデータを消しますか?'))return;await ST.clearAll();UI.buildLayerList();};

  let pendingExp='';
  function showQualModal(t){
    pendingExp=t;U.$('qualLabel').textContent=t==='gif'?'GIF':t==='mp4'?'WebM':'PNG連番';
    U.$('qualDur').textContent=(S.frames.length/S.fps).toFixed(1);U.$('qualFrames').textContent=S.frames.length;
    U.$('qualityModal').classList.add('show');
    U.$$('.qual-sel .chip').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked));
  }
  U.$$('.qual-sel input').forEach(r=>{r.onchange=()=>U.$$('.qual-sel .chip').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked));});
  U.$('qualOk').onclick=()=>{U.$('qualityModal').classList.remove('show');const q=document.querySelector('.qual-sel input:checked').value;if(pendingExp==='gif')EX.exportGIF(q);else if(pendingExp==='mp4')EX.exportVideo(q);else if(pendingExp==='png')EX.exportPNGSequence(q);};
  U.$('expGifBtn').onclick=()=>showQualModal('gif');
  U.$('expMp4Btn').onclick=()=>showQualModal('mp4');
  U.$('expPngBtn').onclick=()=>showQualModal('png');
  U.$('expFrameBtn').onclick=()=>EX.exportCurrentFrame();
  U.$('expSvgBtn').onclick=()=>EX.exportSVG();

  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;
    if(e.ctrlKey||e.metaKey){
      if(e.key==='z'){e.preventDefault();E.undo();}
      if(e.key==='y'){e.preventDefault();E.redo();}
      if(e.key==='c'&&S.sel){e.preventDefault();T.selectionAction('copy');}
      if(e.key==='v'&&S.clip){e.preventDefault();S.ct='paste';U.$$('[data-tool]').forEach(b=>b.classList.remove('on'));E.toast('貼り付けモード');}
      if(e.key==='s'){e.preventDefault();ST.saveProjectFile();}
    }
    if(e.key===' '){e.preventDefault();S.playing?TL.stop():TL.play();}
    if(e.key==='ArrowRight'&&!S.playing&&S.cf<S.frames.length-1)TL.switchFrame(S.cf+1);
    if(e.key==='ArrowLeft'&&!S.playing&&S.cf>0)TL.switchFrame(S.cf-1);
    if(e.key==='Home')TL.switchFrame(0);if(e.key==='End')TL.switchFrame(S.frames.length-1);
    if(e.key==='Enter'){if(S.img)T.commitImage();if(S.transformMode)T.commitTransform();}
    if(e.key==='Escape'){
      if(S.transformMode){T.cancelTransform();return;}
      if(S.img)T.cancelImage();if(S.cpMode){S.cpMode=false;S.cpSelectedPath=null;R.contexts.cursorC.clearRect(0,0,S.CW,S.CH);U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='pen'));S.ct='pen';}if(S.ct==='paste'){R.contexts.floatC.clearRect(0,0,S.CW,S.CH);S.ct='pen';U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='pen'));}}
    if(e.key==='b'||e.key==='B'){S.ct='pen';S.cpMode=false;U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='pen'));}
    if(e.key==='e'||e.key==='E'){S.ct='eraser';S.cpMode=false;U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='eraser'));}
    if(e.key==='g'||e.key==='G'){S.ct='fill';S.cpMode=false;U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='fill'));}
    if(e.key==='h'||e.key==='H'){S.ct='hand';S.cpMode=false;U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='hand'));}
    if(e.key==='i'||e.key==='I'){S.ct='eyedrop';S.cpMode=false;U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='eyedrop'));E.toast('スポイト');}
    if(e.key==='d'||e.key==='D'){S.ct='pixel';S.cpMode=false;U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='pixel'));E.toast('ドット絵');}
    if(e.key==='p'||e.key==='P'){S.cpMode=!S.cpMode;U.$$('.dock-tool').forEach(b=>b.classList.toggle('on',b.dataset.tool==='cpEdit'&&S.cpMode));if(S.cpMode){T.drawControlPointOverlay();E.toast('制御点モード');}else{R.contexts.cursorC.clearRect(0,0,S.CW,S.CH);E.toast('制御点 OFF');}}
    if(e.key==='['){S.cs=Math.max(1,S.cs-1);U.$$('.size-dot').forEach(b=>b.classList.toggle('on',+b.dataset.size===S.cs));}
    if(e.key===']'){S.cs=Math.min(64,S.cs+1);U.$$('.size-dot').forEach(b=>b.classList.toggle('on',+b.dataset.size===S.cs));}
    if(e.key==='l'||e.key==='L'){S.loopPlay=!S.loopPlay;const lb=U.$('loopToggle');if(lb)lb.classList.toggle('on',S.loopPlay);E.toast(S.loopPlay?'ループ ON':'ループ OFF');}
    if(e.key==='1')UI.showPage('canvas');
    if(e.key==='2')UI.showPage('menu');
    if(e.key==='3')UI.showPage('timeline');
  });

  window.addEventListener('resize',()=>{if(S.currentPage==='canvas')E.fitView();});
  window.addEventListener('beforeunload',e=>{E.snapToCache();E.markAllDirty(E.curId());ST.flushIDB();if(S.modified){e.preventDefault();e.returnValue='';}});

  if('serviceWorker' in navigator){navigator.serviceWorker.register('/static/js/sw.js').catch(()=>{});}

  async function init(){
    E.initEngine();
    const restored=await ST.restoreFromIDB();
    if(!restored){S.frames=[E.mkFrame()];E.snapToCache();}
    UI.buildLayerList();TL.renderTL();E.fitView();
    UI.updateFrameInfo();
  }
  init();
})();