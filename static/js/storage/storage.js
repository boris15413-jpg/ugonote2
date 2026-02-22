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
    
    const vectorData = {};
    S.frames.forEach(f => {
      if(G.VectorPaths){
        const vd = G.VectorPaths.serializePaths(f.id);
        if(Object.keys(vd).length > 0) vectorData[f.id] = vd;
      }
    });

    try{await DB.put(DB.SM,'project',{w:S.CW,h:S.CH,pc:S.pc,fps:S.fps,ratio:S.ratio,cf:S.cf,lo:S.layerOrder,pixelMode:S.pixelMode,pixelSize:S.pixelSize,
      frames:S.frames.map(f=>({id:f.id,sfx:f.sfx,seFlags:f.seFlags,holdFrames:f.holdFrames||1})),
      vectors: vectorData
    });}catch(e){}
    showSaveIndicator();
  }

  function showSaveIndicator(){const si=U.$('saveInd');if(!si)return;si.classList.add('show');clearTimeout(si._t);si._t=setTimeout(()=>si.classList.remove('show'),1200);}

  async function imgDataToPngBlob(imgData){
    if(!imgData) return null;
    if(typeof OffscreenCanvas !== 'undefined'){
      const oc = new OffscreenCanvas(imgData.width, imgData.height);
      oc.getContext('2d').putImageData(imgData,0,0);
      return await oc.convertToBlob({type:'image/png'});
    }
    const c = document.createElement('canvas');
    c.width = imgData.width; c.height = imgData.height;
    c.getContext('2d').putImageData(imgData,0,0);
    return new Promise(r => c.toBlob(r,'image/png'));
  }

  async function pngBlobToImgData(blob, w, h){
    if(!blob) return null;
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(bmp,0,0);
    if(bmp.close) bmp.close();
    return x.getImageData(0,0,w,h);
  }


  async function saveProjectFile(){
    if(typeof JSZip === 'undefined') return E.toast('JSZip not loaded');
    E.snapToCache();
    
    const mo = U.$('exportModal');
    mo.classList.add('show');
    U.$('expTitle').textContent = 'プロジェクト保存中...';
    U.$('expBar').style.width = '0%';
    U.$('expMsg').textContent = '準備中';

    try {
      const zip = new JSZip();
      const dpr = C.DPR;

      const vectorData = {};
      S.frames.forEach(f => {
        if(G.VectorPaths){
          const vd = G.VectorPaths.serializePaths(f.id);
          if(Object.keys(vd).length > 0) vectorData[f.id] = vd;
        }
      });

      const projectMeta = {
        version: 6,
        w: S.CW,
        h: S.CH,
        dpr: dpr,
        pc: S.pc,
        fps: S.fps,
        ratio: S.ratio,
        cf: S.cf,
        lo: S.layerOrder,
        pixelMode: S.pixelMode,
        pixelSize: S.pixelSize,
        frames: S.frames.map(f => ({
          id: f.id,
          sfx: f.sfx,
          seFlags: f.seFlags,
          holdFrames: f.holdFrames || 1
        })),
        vectors: vectorData
      };

      zip.file('project.json', JSON.stringify(projectMeta));

      const total = S.frames.length;
      for(let i = 0; i < total; i++){
        const f = S.frames[i];
        
        const c = await E.ensureCached(f.id);
        
        if(c) {
          for(const l of ['A','B','C','P']){
            if(c[l]){
              const blob = await imgDataToPngBlob(c[l]);
              if(blob){
                zip.file(`frames/${f.id}_${l}.png`, blob);
              }
            }
          }
        }
        
        if (i !== S.cf) {
            S.fc.delete(f.id);
        }

        U.$('expBar').style.width = ((i+1)/total*80)+'%';
        U.$('expMsg').textContent = `ファイル準備中: ${i+1}/${total}`;
        await new Promise(r => setTimeout(r, 1));
      }

      U.$('expMsg').textContent = 'ファイル結合中... (ブラウザを閉じないでください)';
      
      const content = await zip.generateAsync({
          type: 'blob', 
          compression: 'STORE' 
      }, meta => {
        U.$('expBar').style.width = (80 + meta.percent * 0.2) + '%';
      });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'ugoku_draw_' + Date.now() + '.ugodraw';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);

      mo.classList.remove('show');
      E.toast('プロジェクトの保存が完了しました');
      
    } catch (e) {
      mo.classList.remove('show');
      E.toast('保存エラー: ' + e.message);
    }
  }

  async function loadProjectFile(file){
    try {
      if(typeof JSZip === 'undefined') return E.toast('JSZip not loaded');

      const mo = U.$('exportModal');
      mo.classList.add('show');
      U.$('expTitle').textContent = 'プロジェクト読込中...';
      U.$('expBar').style.width = '0%';
      U.$('expMsg').textContent = '解凍・最適化中...';

      const zip = await JSZip.loadAsync(file);
      const projJson = await zip.file('project.json').async('string');
      const data = JSON.parse(projJson);

      const dpr = C.DPR;
      const srcDpr = data.dpr || 1;
      S.CW = data.w; S.CH = data.h;
      S.pc = data.pc || '#FFFFFF';
      S.fps = data.fps || 8;
      S.ratio = data.ratio || '4:3';
      if(data.lo) S.layerOrder = data.lo;
      if(data.pixelMode !== undefined) S.pixelMode = data.pixelMode;
      if(data.pixelSize) S.pixelSize = data.pixelSize;

      const fpsRange = U.$('fpsRange');
      if(fpsRange) fpsRange.value = S.fps;
      const fpsNum = U.$('fpsNum');
      if(fpsNum) fpsNum.textContent = S.fps;

      G.Renderer.initCanvases(S.CW, S.CH);
      E.updateTransform(); E.updatePaperColor(); E.updateLayerZOrder();
      
      S.fc.clear(); G.Thumbs.clear();
      S.undoStack = []; S.redoStack = [];
      S.dirtyIds.clear(); S.dirtyLayers.clear();
      S.vectorPaths.clear();
      S.lruOrder = [];

      const total = data.frames.length;
      S.frames = [];
      
      for(let i = 0; i < total; i++){
        const fd = data.frames[i];
        const nf = {id: fd.id || U.uid(), sfx: fd.sfx || '', seFlags: fd.seFlags || [0,0,0,0], holdFrames: fd.holdFrames || 1, thumbDirty: true};
        
        const shouldLoadToMemory = (i < C.EVICT_RANGE);
        const c = {A:null, B:null, C:null, P:null};

        for(const l of ['A','B','C','P']){
          const fn = `frames/${nf.id}_${l}.png`;
          const entry = zip.file(fn);
          if(entry){
            const blob = await entry.async('blob');
            if (shouldLoadToMemory) {
               c[l] = await pngBlobToImgData(blob, S.CW * srcDpr, S.CH * srcDpr);
            } else {
               await DB.put(DB.SF, nf.id + '_' + l, blob);
            }
          }
        }
        
        if (shouldLoadToMemory) {
          S.fc.set(nf.id, c);
          S.lruOrder.push(nf.id);
        } else {
          S.fc.set(nf.id, {A:null, B:null, C:null, P:null});
        }
        
        S.frames.push(nf);

        U.$('expBar').style.width = ((i+1)/total*100)+'%';
        U.$('expMsg').textContent = `フレーム構築中: ${i+1}/${total}`;
        
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 1)); // 画面のフリーズを防ぐ
      }

      if(data.vectors){
        for(const [fid, vd] of Object.entries(data.vectors)){
          if(G.VectorPaths) G.VectorPaths.deserializePaths(fid, vd);
        }
      }

      S.cf = Math.min(data.cf || 0, S.frames.length - 1);
      
      await E.ensureCached(E.curId());
      E.cacheToCanvas(E.curId());
      E.fitView();
      
      if(G.UI){ G.UI.buildLayerList(); G.UI.updateFrameInfo(); }
      if(G.Timeline) G.Timeline.renderTL();
      for(let i=0;i<S.frames.length;i++) E.markAllDirty(S.frames[i].id);

      mo.classList.remove('show');
      E.toast('プロジェクト読込完了');
      return true;
      
    } catch(e){
      U.$('exportModal').classList.remove('show');
      E.toast('エラー: ' + e.message);
      return false;
    }
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
      const fr=U.$('fpsRange');if(fr)fr.value=S.fps;
      const fn=U.$('fpsNum');if(fn)fn.textContent=S.fps;
      G.Renderer.initCanvases(S.CW,S.CH);E.updateTransform();E.updatePaperColor();E.updateLayerZOrder();
      S.frames=meta.frames.map(f=>({id:f.id,sfx:f.sfx||'',seFlags:f.seFlags||[0,0,0,0],holdFrames:f.holdFrames||1,thumbDirty:true}));
      S.cf=Math.min(meta.cf||0,S.frames.length-1);
      S.lruOrder=[];
      if(meta.vectors && G.VectorPaths){
        for(const [fid, vd] of Object.entries(meta.vectors)){
          G.VectorPaths.deserializePaths(fid, vd);
        }
      }
      await E.ensureCached(S.frames[S.cf].id);E.cacheToCanvas(E.curId());E.toast('復元完了');return true;
    }catch(e){return false;}
  }

  async function clearAll(){
    S.frames=[E.mkFrame()];S.cf=0;
    ['A','B','C'].forEach(l=>{
      E.getLayerCtx(l).clearRect(0,0,S.CW,S.CH);
      const vc = G.Renderer.getVectorCtx(l);
      if(vc) vc.clearRect(0,0,S.CW,S.CH);
    });
    E.getLayerCtx('Photo').clearRect(0,0,S.CW,S.CH);
    S.undoStack=[];S.redoStack=[];S.fc.clear();G.Thumbs.clear();S.dirtyIds.clear();S.dirtyLayers.clear();
    S.vectorPaths.clear();S.lruOrder=[];
    E.snapToCache();E.markAllDirty(E.curId());E.updateOnion();
    if(G.Timeline)G.Timeline.renderTL();
    if(G.UI)G.UI.updateFrameInfo();
    if(DB.db)await DB.clear(DB.SF).catch(()=>{});
  }

  G.Storage={DB,loadLayer,saveLayer,deleteFrame,debounceSave,flushIDB,saveProjectFile,loadProjectFile,restoreFromIDB,clearAll};
})(window.UgokuDraw);