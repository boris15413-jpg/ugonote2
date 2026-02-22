'use strict';
(function(G){
  const U=G.Utils,C=G.Config,R=G.Renderer,S=G.State,E=G.Engine;
  let tlRAF=null,preloadTimer=null;
  const TL={};

  TL.switchFrame=async i=>{
    if(S.playing||i<0||i>=S.frames.length)return;
    E.snapToCache();
    TL.renderThumbForId(E.curId(),true);E.curFr().thumbDirty=false;
    S.cf=i;
    if (E.autoFlattenDistantFrames) E.autoFlattenDistantFrames(i);
    await E.ensureCached(E.curId());
    E.cacheToCanvas(E.curId());E.evictFar();
    TL.renderTL();
    if(G.UI) G.UI.updateFrameInfo();
    if(S.cpMode && G.Tools) G.Tools.drawControlPointOverlay();
  };

  TL.addFrame=()=>{E.snapToCache();TL.renderThumbForId(E.curId(),true);E.curFr().thumbDirty=false;const nf=E.mkFrame();const nc={A:null,B:null,C:null,P:null};const oc=S.fc.get(E.curId());if(oc&&oc.P){const dpr=C.DPR;nc.P=new ImageData(new Uint8ClampedArray(oc.P.data),S.CW*dpr,S.CH*dpr);}S.frames.splice(S.cf+1,0,nf);S.fc.set(nf.id,nc);S.cf++;['A','B','C'].forEach(l=>{E.getLayerCtx(l).clearRect(0,0,S.CW,S.CH);const vc=R.getVectorCtx(l);if(vc)vc.clearRect(0,0,S.CW,S.CH);});if(nc.P){const dpr=C.DPR;E.getLayerCtx('Photo').save();E.getLayerCtx('Photo').setTransform(1,0,0,1,0,0);E.getLayerCtx('Photo').putImageData(nc.P,0,0);E.getLayerCtx('Photo').restore();E.getLayerCtx('Photo').setTransform(dpr,0,0,dpr,0,0);}else E.getLayerCtx('Photo').clearRect(0,0,S.CW,S.CH);E.updateOnion();E.markAllDirty(nf.id);TL.renderTL();if(G.UI)G.UI.updateFrameInfo();E.toast('コマを追加しました');};

  TL.duplicateFrame=()=>{E.snapToCache();const oc=S.fc.get(E.curId());const dpr=C.DPR;const cl={};['A','B','C','P'].forEach(k=>{cl[k]=oc&&oc[k]?new ImageData(new Uint8ClampedArray(oc[k].data),S.CW*dpr,S.CH*dpr):null;});const nf=E.mkFrame();nf.sfx=E.curFr().sfx;nf.seFlags=E.curFr().seFlags?[...E.curFr().seFlags]:[0,0,0,0];S.frames.splice(S.cf+1,0,nf);S.fc.set(nf.id,cl);if(G.VectorPaths){const cloned=G.VectorPaths.cloneFramePaths(E.curId());S.vectorPaths.set(nf.id,cloned);}S.cf++;E.cacheToCanvas(E.curId());E.markAllDirty(nf.id);TL.renderTL();if(G.UI)G.UI.updateFrameInfo();E.toast('コマを複製しました');};

  TL.deleteFrame=()=>{if(S.frames.length<=1){['A','B','C'].forEach(l=>{E.getLayerCtx(l).clearRect(0,0,S.CW,S.CH);const vc=R.getVectorCtx(l);if(vc)vc.clearRect(0,0,S.CW,S.CH);});E.getLayerCtx('Photo').clearRect(0,0,S.CW,S.CH);const fid=E.curId();S.fc.set(fid,{A:null,B:null,C:null,P:null});S.vectorPaths.delete(fid);E.snapToCache();E.markAllDirty(fid);TL.renderTL();return;}const old=E.curFr();if(G.Storage)G.Storage.deleteFrame(old.id);S.fc.delete(old.id);G.Thumbs.delete(old.id);S.vectorPaths.delete(old.id);S.frames.splice(S.cf,1);if(S.cf>=S.frames.length)S.cf--;E.ensureCached(E.curId()).then(()=>E.cacheToCanvas(E.curId()));TL.renderTL();if(G.UI)G.UI.updateFrameInfo();};

  TL.moveFrame=(from,to)=>{if(from<0||from>=S.frames.length||to<0||to>=S.frames.length)return;const [item]=S.frames.splice(from,1);S.frames.splice(to,0,item);S.cf=to;TL.renderTL();};

  let playT0, playF0;
  TL.play = async () => {
    if (S.frames.length < 2) return E.toast('2コマ以上必要です');
    E.snapToCache();
    for (let i = 0; i < S.frames.length; i++) await E.ensureCached(S.frames[i].id);
    S.playing = true;

    const playBtn = U.$('playBtn'), stopBtn = U.$('stopBtn');
    if (playBtn) playBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'flex';
    const tlPlay = U.$('tlPlayBtn'), tlStop = U.$('tlStopBtn');
    if (tlPlay) tlPlay.style.display = 'none';
    if (tlStop) tlStop.style.display = '';

    if (G.Audio && G.Audio.bgmBuffer) {
      G.Audio.playBGM(S.cf, S.fps);
    }

    playT0 = performance.now();
    playF0 = S.cf;
    let lastFi = -1;

    function tick(now) {
      if (!S.playing) return;
      const elapsed = (now - playT0) / 1000;
      let fi = playF0 + Math.floor(elapsed * S.fps);

      if (fi >= S.frames.length) {
        if (S.loopPlay) {
          playT0 = now;
          playF0 = 0;
          fi = 0;
          if (G.Audio && G.Audio.bgmBuffer) G.Audio.playBGM(0, S.fps);
        } else {
          TL.stop();
          return;
        }
      }

      if (fi !== lastFi) {
        lastFi = fi;
        const fid = S.frames[fi].id;
        const cache = S.fc.get(fid);
        if (cache) {
          const dpr = C.DPR;
          [['A', 'A'], ['B', 'B'], ['C', 'C'], ['P', 'Photo']].forEach(([k, l]) => {
            const ctx = E.getLayerCtx(l);
            ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, S.CW * dpr, S.CH * dpr);
            if (cache[k]) ctx.putImageData(cache[k], 0, 0);
            ctx.restore(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          });
          E.redrawVectorLayers(fid);
        }
        S.cf = fi;
        if (G.UI) G.UI.updateFrameInfo();
        TL.highlightFrame(fi);

        const fr = S.frames[fi];
        if (G.Audio && fr.seFlags) {
          fr.seFlags.forEach((flag, chIdx) => {
            if (flag) G.Audio.playSEChannel(chIdx);
          });
        } else if (fr.sfx && G.Audio) {
          G.Audio.playSFX(fr.sfx);
        }
      }
      tlRAF = requestAnimationFrame(tick);
    }
    tlRAF = requestAnimationFrame(tick);
  };

  TL.stop = () => {
    S.playing = false;
    if (tlRAF) { cancelAnimationFrame(tlRAF); tlRAF = null; }
    const playBtn = U.$('playBtn'), stopBtn = U.$('stopBtn');
    if (playBtn) playBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';
    const tlPlay = U.$('tlPlayBtn'), tlStop = U.$('tlStopBtn');
    if (tlPlay) tlPlay.style.display = '';
    if (tlStop) tlStop.style.display = 'none';

    if (G.Audio) { G.Audio.stopBGM(); G.Audio.stopRecord(); }
    const recBtn = U.$('recSyncBtn2');
    if (recBtn) recBtn.classList.remove('on');
    S.recWhilePlaying = false;
    E.cacheToCanvas(E.curId());
    TL.renderTL();
  };

  TL.renderThumbForId=(fid,isCurrent)=>{let tc=G.Thumbs.get(fid);if(!tc){tc=document.createElement('canvas');tc.width=C.THUMB_W;tc.height=C.THUMB_H;G.Thumbs.set(fid,tc);}TL.renderThumb(fid,tc,isCurrent);tc._rendered=true;return tc;};

  TL.renderThumb=(fid,tc,isCurrent)=>{const x=tc.getContext('2d');const dpr=C.DPR;if(isCurrent){x.fillStyle=S.pc;x.fillRect(0,0,C.THUMB_W,C.THUMB_H);x.drawImage(R.canvases.lPhoto,0,0,C.THUMB_W,C.THUMB_H);S.layerOrder.forEach(l=>{const rc=R.getRasterCanvas(l);const vc=R.getVectorCanvas(l);if(rc&&rc.style.display!=='none')x.drawImage(rc,0,0,C.THUMB_W,C.THUMB_H);if(vc&&vc.style.display!=='none')x.drawImage(vc,0,0,C.THUMB_W,C.THUMB_H);});}else{const c=S.fc.get(fid);if(!c)return false;x.fillStyle=S.pc;x.fillRect(0,0,C.THUMB_W,C.THUMB_H);const tmp=document.createElement('canvas');tmp.width=S.CW*dpr;tmp.height=S.CH*dpr;const tx=tmp.getContext('2d');if(c.P){tx.putImageData(c.P,0,0);x.drawImage(tmp,0,0,C.THUMB_W,C.THUMB_H);tx.clearRect(0,0,S.CW*dpr,S.CH*dpr);}S.layerOrder.forEach(l=>{if(c[l]){tx.clearRect(0,0,S.CW*dpr,S.CH*dpr);tx.putImageData(c[l],0,0);x.drawImage(tmp,0,0,C.THUMB_W,C.THUMB_H);}});}};

  TL.highlightFrame=fi=>{const items=U.$('tls');if(!items)return;const frames=items.querySelectorAll('.ft');frames.forEach((el,j)=>{el.classList.toggle('on',false);el.classList.toggle('playing',j===fi);});if(frames[fi])frames[fi].scrollIntoView({behavior:'auto',inline:'center',block:'nearest'});};
  TL.renderDebounced=()=>{if(renderTimer)return;renderTimer=requestAnimationFrame(()=>{renderTimer=null;TL.renderTL();});};let renderTimer=null;

  TL.renderTL=()=>{
    const el=U.$('tls');if(!el)return;el.innerHTML='';const frag=document.createDocumentFragment();
    S.frames.forEach((fm,i)=>{
      const d=document.createElement('div');d.className='ft'+(i===S.cf?' on':'');d.draggable=true;d.dataset.idx=i;
      let tc=G.Thumbs.get(fm.id);if(!tc){tc=document.createElement('canvas');tc.width=C.THUMB_W;tc.height=C.THUMB_H;G.Thumbs.set(fm.id,tc);fm.thumbDirty=true;}
      if(i===S.cf){TL.renderThumb(fm.id,tc,true);fm.thumbDirty=false;tc._rendered=true;}else if(fm.thumbDirty&&S.fc.has(fm.id)){TL.renderThumb(fm.id,tc,false);fm.thumbDirty=false;tc._rendered=true;}
      const dc=document.createElement('canvas');dc.width=C.THUMB_W;dc.height=C.THUMB_H;dc.getContext('2d').drawImage(tc,0,0);
      const n=document.createElement('div');n.className='fn';n.textContent=i+1;d.appendChild(dc);d.appendChild(n);
      if(fm.seFlags&&fm.seFlags.some(f=>f)){const sf=document.createElement('div');sf.className='fsfx';sf.textContent='♪';d.appendChild(sf);}else if(fm.sfx){const sf=document.createElement('div');sf.className='fsfx';sf.textContent='SFX';d.appendChild(sf);}
      d.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';d.style.opacity='0.4';});
      d.addEventListener('dragend',()=>{d.style.opacity='1';});
      d.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';d.style.borderColor='var(--acc)';});
      d.addEventListener('dragleave',()=>{d.style.borderColor='';});
      d.addEventListener('drop',e=>{e.preventDefault();d.style.borderColor='';const f=parseInt(e.dataTransfer.getData('text/plain')),t=parseInt(d.dataset.idx);if(!isNaN(f)&&!isNaN(t)&&f!==t)TL.moveFrame(f,t);});
      d.onclick=()=>TL.switchFrame(i);frag.appendChild(d);
    });
    const dropZone=document.createElement('div');dropZone.className='ft-drop-zone';dropZone.textContent='+';
    dropZone.onclick=()=>TL.addFrame();
    dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.style.background='rgba(255,102,0,0.1)';});
    dropZone.addEventListener('dragleave',()=>{dropZone.style.background='';});
    dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.style.background='';const f=parseInt(e.dataTransfer.getData('text/plain'));if(!isNaN(f))TL.moveFrame(f,S.frames.length-1);});
    frag.appendChild(dropZone);
    el.appendChild(frag);if(G.UI)G.UI.updateFrameInfo();schedulePreload();
    const curEl=el.querySelector('.ft.on');if(curEl)curEl.scrollIntoView({behavior:'auto',inline:'center',block:'nearest'});
  };
  function schedulePreload(){if(preloadTimer)return;preloadTimer=setTimeout(()=>{preloadTimer=null;preloadNearby();},100);}
  async function preloadNearby(){const lo=Math.max(0,S.cf-C.PRELOAD_RANGE),hi=Math.min(S.frames.length-1,S.cf+C.PRELOAD_RANGE);for(let i=lo;i<=hi;i++){const fid=S.frames[i].id;if(!S.fc.has(fid)){await E.ensureCached(fid);const fm=S.frames[i];let tc=G.Thumbs.get(fm.id);if(!tc){tc=document.createElement('canvas');tc.width=C.THUMB_W;tc.height=C.THUMB_H;G.Thumbs.set(fm.id,tc);}if(fm.thumbDirty||!tc._rendered){TL.renderThumb(fm.id,tc,false);fm.thumbDirty=false;tc._rendered=true;}}}}

  G.Timeline=TL;
})(window.UgokuDraw);