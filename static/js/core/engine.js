'use strict';
(function(G){
  const U=G.Utils,C=G.Config,R=G.Renderer,S=G.State;
  const E={};

  const layerMap={A:'lA',B:'lB',C:'lC',Photo:'lPhoto'};
  const layerNames={A:'A (top)',B:'B (mid)',C:'C (btm)'};
  E.getLayerCanvas=l=>R.canvases[layerMap[l]];
  E.getLayerCtx=l=>R.contexts[layerMap[l]];
  E.layerMap=layerMap; E.layerNames=layerNames;
  E.curFr=()=>S.frames[S.cf];
  E.curId=()=>S.frames[S.cf]?.id;
  E.curC=()=>E.getLayerCanvas(S.cl);
  E.curX=()=>E.getLayerCtx(S.cl);
  
  E.mkFrame=()=>({id:U.uid(),sfx:'',seFlags:[0,0,0,0],sfxVol:1,holdFrames:1,thumbDirty:true});

  E.getCache=fid=>{
    if(!S.fc.has(fid)) S.fc.set(fid,{A:null,B:null,C:null,P:null});
    return S.fc.get(fid);
  };

  E.snapToCache=()=>{
    const dpr=C.DPR;
    const c=E.getCache(E.curId());
    ['A','B','C'].forEach(l=>{c[l]=E.getLayerCtx(l).getImageData(0,0,S.CW*dpr,S.CH*dpr);});
    c.P=E.getLayerCtx('Photo').getImageData(0,0,S.CW*dpr,S.CH*dpr);
  };

  E.markDirty=(fid,layer)=>{
    S.dirtyIds.add(fid);
    if(!S.dirtyLayers.has(fid)) S.dirtyLayers.set(fid,new Set());
    S.dirtyLayers.get(fid).add(layer);
    S.modified=true;
  };
  E.markAllDirty=fid=>{['A','B','C','P'].forEach(l=>E.markDirty(fid,l));};

  E.cacheToCanvas=fid=>{
    const c=S.fc.get(fid); const dpr=C.DPR;
    [['A','A'],['B','B'],['C','C'],['P','Photo']].forEach(([k,l])=>{
      const ctx=E.getLayerCtx(l);
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,S.CW*dpr,S.CH*dpr);
      if(c&&c[k]) ctx.putImageData(c[k],0,0);
      ctx.restore(); ctx.setTransform(dpr,0,0,dpr,0,0);
    });
    E.updateOnion();
    const cf=U.$('curF');if(cf) cf.textContent=S.cf+1;
  };

  E.ensureCached=async fid=>{
    if(S.fc.has(fid)) return S.fc.get(fid);
    const c={A:null,B:null,C:null,P:null};
    if(G.Storage){
      for(const l of ['A','B','C','P']){
        try{c[l]=await G.Storage.loadLayer(fid,l,S.CW,S.CH);}catch(e){}
      }
    }
    S.fc.set(fid,c); return c;
  };

  E.evictFar=()=>{
    const keep=new Set();
    const lo=Math.max(0,S.cf-C.EVICT_RANGE),hi=Math.min(S.frames.length-1,S.cf+C.EVICT_RANGE);
    for(let i=lo;i<=hi;i++) keep.add(S.frames[i].id);
    for(const [fid] of S.fc){
      if(!keep.has(fid)&&!S.dirtyIds.has(fid)) S.fc.delete(fid);
    }
  };

  E.fitView=()=>{
    const v=U.$('viewport'); if(!v) return;
    const aw=v.clientWidth-24,ah=v.clientHeight-24;
    S.zoom=Math.min(aw/S.CW,ah/S.CH,2);
    S.panX=0; S.panY=0;
    E.updateTransform();
  };

  E.updateTransform=()=>{
    const cw=U.$('cw'); if(!cw) return;
    cw.style.width=S.CW+'px';
    cw.style.height=S.CH+'px';
    cw.style.transform=`translate(${S.panX}px,${S.panY}px) scale(${S.zoom})`;
    const smooth=S.zoom<C.PIXEL_GRID_MAX_ZOOM||!S.pixelMode;
    cw.style.imageRendering=smooth?'auto':'pixelated';
    const zd=U.$('zoomDisp');
    if(zd) zd.textContent=Math.round(S.zoom*100)+'%';
  };

  E.zoomAtPoint=(factor,screenX,screenY)=>{
    const v=U.$('viewport');if(!v)return;
    const vr=v.getBoundingClientRect();
    const cx=screenX-vr.left-vr.width/2;
    const cy=screenY-vr.top-vr.height/2;
    const oldZoom=S.zoom;
    S.zoom=U.clamp(oldZoom*factor,C.MIN_ZOOM,C.MAX_ZOOM);
    const scale=S.zoom/oldZoom;
    S.panX=cx-(cx-S.panX)*scale;
    S.panY=cy-(cy-S.panY)*scale;
    E.updateTransform();
  };

  E.updatePaperColor=()=>{
    const ctx=R.contexts.bgC; if(!ctx) return;
    const dpr=C.DPR;
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle=S.pc;
    ctx.fillRect(0,0,S.CW*dpr,S.CH*dpr);
    ctx.restore(); ctx.setTransform(dpr,0,0,dpr,0,0);
  };

  E.updateLayerZOrder=()=>{
    const photo=R.canvases.lPhoto;
    if(photo) photo.style.zIndex=2;
    S.layerOrder.forEach((l,i)=>{
      const cv=E.getLayerCanvas(l);
      if(cv) cv.style.zIndex=3+i;
    });
  };

  E.updateOnion=()=>{
    const ctx=R.contexts.onC; if(!ctx) return;
    const dpr=C.DPR;
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,S.CW*dpr,S.CH*dpr);
    ctx.restore(); ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!S.onion||S.cf===0){R.canvases.onC.style.opacity='0';return;}
    R.canvases.onC.style.opacity=String(S.onionOpacity);
    for(let off=1;off<=S.onionCount;off++){
      const idx=S.cf-off;if(idx<0) break;
      const pc=S.fc.get(S.frames[idx].id);if(!pc) continue;
      const alpha=1-(off-1)*0.3;
      ctx.globalAlpha=Math.max(0.1,alpha);
      const tmp=document.createElement('canvas');
      tmp.width=S.CW*dpr;tmp.height=S.CH*dpr;
      const tx=tmp.getContext('2d');
      S.layerOrder.forEach(l=>{
        if(pc[l]){tx.putImageData(pc[l],0,0);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(tmp,0,0);ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0);tx.clearRect(0,0,S.CW*dpr,S.CH*dpr);}
      });
      ctx.globalCompositeOperation='source-atop';
      const r=off===1?255:80,g2=off===1?80:80,b=off===1?80:255;
      ctx.fillStyle=`rgba(${r},${g2},${b},.25)`;
      ctx.fillRect(0,0,S.CW,S.CH);
      ctx.globalCompositeOperation='source-over';
    }
    ctx.globalAlpha=1;
  };

  E.updateGrid=()=>{
    const ctx=R.contexts.gridC; if(!ctx) return;
    ctx.clearRect(0,0,S.CW,S.CH);
    if(!S.grid) return;
    const gs=S.pixelMode?S.pixelSize:S.gridSize;
    ctx.strokeStyle='rgba(0,0,0,.1)'; ctx.lineWidth=0.5;
    for(let x=gs;x<S.CW;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,S.CH);ctx.stroke();}
    for(let y=gs;y<S.CH;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(S.CW,y);ctx.stroke();}
    ctx.strokeStyle='rgba(255,0,0,.12)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(S.CW/2,0);ctx.lineTo(S.CW/2,S.CH);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,S.CH/2);ctx.lineTo(S.CW,S.CH/2);ctx.stroke();
  };

  let undoSnap=null;
  E.pushUndo=()=>{
    const dpr=C.DPR;
    undoSnap=E.curX().getImageData(0,0,S.CW*dpr,S.CH*dpr);
  };
  E.commitUndo=()=>{
    if(!undoSnap) return;
    const dpr=C.DPR;
    const after=E.curX().getImageData(0,0,S.CW*dpr,S.CH*dpr);
    const w=S.CW*dpr,h=S.CH*dpr;
    const od=undoSnap.data,nd=after.data;
    let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      if(od[i]!==nd[i]||od[i+1]!==nd[i+1]||od[i+2]!==nd[i+2]||od[i+3]!==nd[i+3]){
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      }
    }
    undoSnap=null; if(maxX<0) return;
    const dw=maxX-minX+1,dh=maxY-minY+1;
    const op=new Uint8ClampedArray(dw*dh*4),np=new Uint8ClampedArray(dw*dh*4);
    for(let y=0;y<dh;y++) for(let x=0;x<dw;x++){
      const si=((minY+y)*w+(minX+x))*4,di=(y*dw+x)*4;
      op[di]=od[si];op[di+1]=od[si+1];op[di+2]=od[si+2];op[di+3]=od[si+3];
      np[di]=nd[si];np[di+1]=nd[si+1];np[di+2]=nd[si+2];np[di+3]=nd[si+3];
    }
    S.undoStack.push({fid:E.curId(),l:S.cl,x:minX,y:minY,w:dw,h:dh,op,np});
    if(S.undoStack.length>S.maxUndo) S.undoStack.shift();
    S.redoStack=[];
  };

  const applyPatch=(entry,patch)=>{
    const ctx=entry.l==='Photo'?E.getLayerCtx('Photo'):E.getLayerCtx(entry.l);
    if(entry.fid!==E.curId()) return;
    const dpr=C.DPR;
    const cur=ctx.getImageData(0,0,S.CW*dpr,S.CH*dpr),cd=cur.data;
    for(let y=0;y<entry.h;y++) for(let x=0;x<entry.w;x++){
      const si=(y*entry.w+x)*4,di=((entry.y+y)*(S.CW*dpr)+(entry.x+x))*4;
      cd[di]=patch[si];cd[di+1]=patch[si+1];cd[di+2]=patch[si+2];cd[di+3]=patch[si+3];
    }
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.putImageData(cur,0,0);
    ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0);
  };

  E.undo=()=>{
    if(!S.undoStack.length) return;
    const e=S.undoStack.pop();
    S.redoStack.push({...e,op:e.np,np:e.op});
    applyPatch(e,e.op);
    E.afterEdit(e.l);
  };
  E.redo=()=>{
    if(!S.redoStack.length) return;
    const e=S.redoStack.pop();
    S.undoStack.push({...e,op:e.np,np:e.op});
    applyPatch(e,e.op);
    E.afterEdit(e.l);
  };

  E.afterEdit=layer=>{
    E.snapToCache();
    E.markDirty(E.curId(),layer||S.cl);
    E.curFr().thumbDirty=true;
    if(G.Timeline) G.Timeline.renderDebounced();
    if(G.Storage) G.Storage.debounceSave();
  };

  E.toast=msg=>{
    const t=U.$('toast'); if(!t) return;
    t.textContent=msg; t.classList.add('show');
    clearTimeout(t._t);
    t._t=setTimeout(()=>t.classList.remove('show'),1800);
  };

  let worker=null; const workerCbs=new Map(); let workerReqId=0;
  E.initWorker=()=>{
    try{
      const url=(document.querySelector('script[data-worker-url]')||{}).dataset?.workerUrl||'/static/js/workers/compute.js';
      worker=new Worker(url);
      worker.onmessage=e=>{
        const d=e.data,cb=workerCbs.get(d.reqId);
        if(!cb) return;
        if(d.type==='progress'){if(cb.onProgress) cb.onProgress(d);}
        else {workerCbs.delete(d.reqId);cb.resolve(d);}
      };
    }catch(e){worker=null;}
  };
  E.workerCall=(msg,transfers,onProgress)=>{
    return new Promise(resolve=>{
      const r=++workerReqId;
      workerCbs.set(r,{resolve,onProgress});
      msg.reqId=r;
      worker.postMessage(msg,transfers||[]);
    });
  };
  Object.defineProperty(E,'W',{get:()=>worker});

  E.initEngine=()=>{
    E.initWorker();
    R.initCanvases(S.CW,S.CH);
    E.updateTransform();
    E.updatePaperColor();
    E.updateLayerZOrder();
    E.fitView();
  };

  G.Engine=E;
})(window.UgokuDraw);
