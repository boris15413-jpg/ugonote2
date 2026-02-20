'use strict';
(function(G){
  const U=G.Utils,C=G.Config,S=G.State,E=G.Engine;
  const DB={db:null,NAME:'UgokuDrawV4',VER:2,SF:'frames',SM:'meta',SP:'projects',
    async open(){return new Promise((res,rej)=>{const r=indexedDB.open(this.NAME,this.VER);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains(this.SF))d.createObjectStore(this.SF);if(!d.objectStoreNames.contains(this.SM))d.createObjectStore(this.SM);if(!d.objectStoreNames.contains(this.SP))d.createObjectStore(this.SP);};r.onsuccess=()=>{this.db=r.result;res();};r.onerror=()=>rej(r.error);});},
    async put(s,k,v){if(!this.db)return;return new Promise((res,rej)=>{const t=this.db.transaction(s,'readwrite');t.objectStore(s).put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});},
    async get(s,k){if(!this.db)return null;return new Promise((res,rej)=>{const t=this.db.transaction(s,'readonly');const r=t.objectStore(s).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});},
    async del(s,k){if(!this.db)return;return new Promise((res,rej)=>{const t=this.db.transaction(s,'readwrite');t.objectStore(s).delete(k);t.oncomplete=res;t.onerror=()=>rej(t.error);});},
    async clear(s){if(!this.db)return;return new Promise((res,rej)=>{const t=this.db.transaction(s,'readwrite');t.objectStore(s).clear();t.oncomplete=res;t.onerror=()=>rej(t.error);});}
  };

  async function compressLayer(imgData){
    if(!imgData)return null;
    try{if(typeof OffscreenCanvas!=='undefined'){const oc=new OffscreenCanvas(imgData.width,imgData.height);oc.getContext('2d').putImageData(imgData,0,0);return await oc.convertToBlob({type:'image/png'});}
    const c=document.createElement('canvas');c.width=imgData.width;c.height=imgData.height;c.getContext('2d').putImageData(imgData,0,0);return new Promise(r=>c.toBlob(r,'image/png'));}
    catch(e){return new Blob([imgData.data.buffer]);}
  }

  async function decompressLayer(blob,w,h){
    if(!blob)return null;
    try{const bmp=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(bmp,0,0);if(bmp.close)bmp.close();return x.getImageData(0,0,w,h);}
    catch(e){const ab=await blob.arrayBuffer();return new ImageData(new Uint8ClampedArray(ab),w,h);}
  }

  async function saveLayer(fid,layer,imgData){const blob=await compressLayer(imgData);if(blob)await DB.put(DB.SF,fid+'_'+layer,blob);else await DB.del(DB.SF,fid+'_'+layer);}
  async function loadLayer(fid,layer,w,h){const dpr=C.DPR;const blob=await DB.get(DB.SF,fid+'_'+layer);return blob?decompressLayer(blob,w*dpr,h*dpr):null;}
  async function deleteFrame(fid){for(const l of['A','B','C','P'])await DB.del(DB.SF,fid+'_'+l).catch(()=>{});}

  let saveTimer=null;
  function debounceSave(){if(saveTimer)return;saveTimer=setTimeout(async()=>{saveTimer=null;await flushIDB();},C.AUTOSAVE_DELAY);}

  async function flushIDB(){
    if(!DB.db||!S.dirtyIds.size)return;
    const ids=new Set(S.dirtyIds);S.dirtyIds.clear();
    const layers=new Map(S.dirtyLayers);S.dirtyLayers.clear();
    for(const fid of ids){const c=S.fc.get(fid);if(!c)continue;const ls=layers.get(fid)||new Set(['A','B','C','P']);for(const l of ls){try{await saveLayer(fid,l,c[l]);}catch(e){}}}
    try{await DB.put(DB.SM,'project',{w:S.CW,h:S.CH,pc:S.pc,fps:S.fps,ratio:S.ratio,cf:S.cf,lo:S.layerOrder,pixelMode:S.pixelMode,pixelSize:S.pixelSize,
      frames:S.frames.map(f=>({id:f.id,sfx:f.sfx,holdFrames:f.holdFrames||1}))});}catch(e){}
    showSaveIndicator();
  }

  function showSaveIndicator(){const si=U.$('saveInd');if(!si)return;si.classList.add('show');clearTimeout(si._t);si._t=setTimeout(()=>si.classList.remove('show'),1200);}

  async function saveProjectFile(){
    E.snapToCache();for(let i=0;i<S.frames.length;i++)await E.ensureCached(S.frames[i].id);
    const dpr=C.DPR;
    const data={version:4,w:S.CW,h:S.CH,dpr,pc:S.pc,fps:S.fps,ratio:S.ratio,cf:S.cf,lo:S.layerOrder,pixelMode:S.pixelMode,pixelSize:S.pixelSize,
      frames:S.frames.map(f=>{const c=S.fc.get(f.id)||{};return{id:f.id,sfx:f.sfx,holdFrames:f.holdFrames||1,
        A:c.A?Array.from(c.A.data):null,B:c.B?Array.from(c.B.data):null,C:c.C?Array.from(c.C.data):null,P:c.P?Array.from(c.P.data):null};})};
    const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ugoku_draw_'+Date.now()+'.ugodraw';a.click();E.toast('プロジェクト保存完了');
  }

  async function loadProjectFile(file){
    try{
      const data=JSON.parse(await file.text());const dpr=C.DPR;
      S.CW=data.w;S.CH=data.h;S.pc=data.pc||'#FFFFFF';S.fps=data.fps||8;S.ratio=data.ratio||'4:3';
      if(data.lo)S.layerOrder=data.lo;
      if(data.pixelMode!==undefined)S.pixelMode=data.pixelMode;
      if(data.pixelSize)S.pixelSize=data.pixelSize;
      U.$('fpsRange').value=S.fps;U.$('fpsNum').textContent=S.fps;
      G.Renderer.initCanvases(S.CW,S.CH);E.updateTransform();E.updatePaperColor();E.updateLayerZOrder();
      S.fc.clear();G.Thumbs.clear();S.undoStack=[];S.redoStack=[];S.dirtyIds.clear();S.dirtyLayers.clear();
      const srcDpr=data.dpr||1;
      S.frames=data.frames.map(f=>{
        const nf={id:f.id||U.uid(),sfx:f.sfx||'',holdFrames:f.holdFrames||1,thumbDirty:true};
        const c={A:null,B:null,C:null,P:null};
        ['A','B','C','P'].forEach(k=>{if(f[k])c[k]=new ImageData(new Uint8ClampedArray(f[k]),S.CW*srcDpr,S.CH*srcDpr);});
        S.fc.set(nf.id,c);return nf;
      });
      S.cf=Math.min(data.cf||0,S.frames.length-1);
      E.cacheToCanvas(E.curId());E.fitView();
      if(G.UI){G.UI.buildLayerList();G.UI.updateFrameInfo();}
      if(G.Timeline)G.Timeline.renderTL();
      for(let i=0;i<S.frames.length;i++)E.markAllDirty(S.frames[i].id);
      E.toast('プロジェクト読込完了');return true;
    }catch(e){E.toast('エラー: '+e.message);return false;}
  }

  async function restoreFromIDB(){
    try{await DB.open();}catch(e){return false;}
    try{
      const meta=await DB.get(DB.SM,'project');
      if(!meta||!meta.frames||!meta.frames.length)return false;
      S.CW=meta.w;S.CH=meta.h;S.pc=meta.pc||'#FFFFFF';S.fps=meta.fps||8;S.ratio=meta.ratio||'4:3';
      if(meta.lo)S.layerOrder=meta.lo;
      if(meta.pixelMode!==undefined)S.pixelMode=meta.pixelMode;
      if(meta.pixelSize)S.pixelSize=meta.pixelSize;
      U.$('fpsRange').value=S.fps;U.$('fpsNum').textContent=S.fps;
      G.Renderer.initCanvases(S.CW,S.CH);E.updateTransform();E.updatePaperColor();E.updateLayerZOrder();
      S.frames=meta.frames.map(f=>({id:f.id,sfx:f.sfx||'',holdFrames:f.holdFrames||1,thumbDirty:true}));
      S.cf=Math.min(meta.cf||0,S.frames.length-1);
      await E.ensureCached(S.frames[S.cf].id);E.cacheToCanvas(E.curId());E.toast('復元完了');return true;
    }catch(e){return false;}
  }

  async function clearAll(){
    S.frames=[E.mkFrame()];S.cf=0;
    ['A','B','C'].forEach(l=>E.getLayerCtx(l).clearRect(0,0,S.CW,S.CH));
    E.getLayerCtx('Photo').clearRect(0,0,S.CW,S.CH);
    S.undoStack=[];S.redoStack=[];S.fc.clear();G.Thumbs.clear();S.dirtyIds.clear();S.dirtyLayers.clear();
    E.snapToCache();E.markAllDirty(E.curId());E.updateOnion();
    if(G.Timeline)G.Timeline.renderTL();
    if(G.UI)G.UI.updateFrameInfo();
    if(DB.db)await DB.clear(DB.SF).catch(()=>{});
  }

  G.Storage={DB,loadLayer,saveLayer,deleteFrame,debounceSave,flushIDB,saveProjectFile,loadProjectFile,restoreFromIDB,clearAll};
})(window.UgokuDraw);
