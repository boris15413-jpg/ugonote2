'use strict';
(function(G){
  const U=G.Utils,C=G.Config,R=G.Renderer,S=G.State,E=G.Engine,VP=G.VectorPaths;
  const EX={};

  function renderFrameToCtx(tc,fid,ow,oh){
    tc.fillStyle=S.pc; tc.fillRect(0,0,ow,oh);
    const scale = ow / S.CW; tc.save(); tc.scale(scale, scale);
    const c=S.fc.get(fid);
    if(c && c.P) {
      const tmp = document.createElement('canvas'); tmp.width = S.CW * C.DPR; tmp.height = S.CH * C.DPR;
      const tx = tmp.getContext('2d'); tx.putImageData(c.P, 0, 0); tc.drawImage(tmp, 0, 0, S.CW, S.CH);
    }
    S.layerOrder.forEach(layer => {
      if(c && c[layer]){
        const tmp = document.createElement('canvas'); tmp.width = S.CW * C.DPR; tmp.height = S.CH * C.DPR;
        const tx = tmp.getContext('2d'); tx.putImageData(c[layer], 0, 0); tc.drawImage(tmp, 0, 0, S.CW, S.CH);
      }
      if(VP) VP.renderAllPaths(tc, fid, layer, S.CW, S.CH);
    });
    tc.restore();
  }

  function getRasterDataUrl(fid){
    const dpr = C.DPR;
    const tmp = document.createElement('canvas');
    tmp.width = S.CW; tmp.height = S.CH;
    const tc = tmp.getContext('2d');
    tc.fillStyle = S.pc; tc.fillRect(0,0,S.CW,S.CH);
    const c = S.fc.get(fid);
    if(c && c.P){
      const t2 = document.createElement('canvas'); t2.width = S.CW*dpr; t2.height = S.CH*dpr;
      t2.getContext('2d').putImageData(c.P,0,0); tc.drawImage(t2,0,0,S.CW,S.CH);
    }
    S.layerOrder.forEach(l => {
      if(c && c[l]){
        const t2 = document.createElement('canvas'); t2.width = S.CW*dpr; t2.height = S.CH*dpr;
        t2.getContext('2d').putImageData(c[l],0,0); tc.drawImage(t2,0,0,S.CW,S.CH);
      }
    });
    return tmp.toDataURL('image/png');
  }

  EX.exportSVG = async () => {
    const w = S.CW, h = S.CH;
    E.snapToCache();
    await E.ensureCached(E.curId());
    const fid = E.curId();

    const rasterUrl = getRasterDataUrl(fid);

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n  <title>UgokuDraw Frame ${S.cf+1}</title>\n`;
    svgContent += `  <image href="${rasterUrl}" width="${w}" height="${h}" />\n`;

    S.layerOrder.forEach(layer => {
      const paths = VP.getFramePaths(fid, layer);
      if(!paths || paths.length === 0) return;

      svgContent += `  <g id="layer-${layer}">\n`;
      paths.forEach(p => {
        const pts = (p.smooth > 0 && p.pts.length >= 3) ? U.stabilize(p.pts, p.smooth) : p.pts;
        if(pts.length === 0) return;
        const color = p.color; const opacity = p.alpha; const strokeWidth = p.size;
        const lineCap = 'round'; const lineJoin = 'round'; let d = ''; let fill = 'none';

        if(p.type === 'pen') {
          if(pts.length === 1) { d = `M ${pts[0].x} ${pts[0].y} L ${pts[0].x+0.1} ${pts[0].y}`; }
          else {
            d = `M ${pts[0].x} ${pts[0].y}`;
            for(let i=1; i<pts.length-1; i++){
              const mx = (pts[i].x + pts[i+1].x) / 2; const my = (pts[i].y + pts[i+1].y) / 2;
              d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
            }
            d += ` L ${pts[pts.length-1].x} ${pts[pts.length-1].y}`;
          }
        } else if (p.type === 'line') {
          d = `M ${pts[0].x} ${pts[0].y} L ${pts[pts.length-1].x} ${pts[pts.length-1].y}`;
        } else if (p.type === 'rect') {
          const rw = pts[1].x - pts[0].x; const rh = pts[1].y - pts[0].y;
          d = `M ${pts[0].x} ${pts[0].y} h ${rw} v ${rh} h ${-rw} z`;
          if(p.fill) fill = color;
        } else if (p.type === 'circle') {
          const rx = Math.abs(pts[1].x - pts[0].x)/2; const ry = Math.abs(pts[1].y - pts[0].y)/2;
          const cx = (pts[0].x + pts[1].x)/2; const cy = (pts[0].y + pts[1].y)/2;
          d = `M ${cx+rx} ${cy} a ${rx} ${ry} 0 1 0 ${-2*rx} 0 a ${rx} ${ry} 0 1 0 ${2*rx} 0`;
          if(p.fill) fill = color;
        } else {
          d = `M ${pts[0].x} ${pts[0].y}`;
          for(let i=1; i<pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
          d+=' Z';
          if(p.fill) fill = color;
        }

        if(p.outline) {
          const outWidth = strokeWidth + p.outlineWidth * 2;
          svgContent += `    <path d="${d}" stroke="${p.outlineColor}" stroke-width="${outWidth}" fill="${fill}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}" opacity="${opacity}" />\n`;
        }
        svgContent += `    <path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}" opacity="${opacity}" />\n`;
      });
      svgContent += `  </g>\n`;
    });

    svgContent += `</svg>`;
    downloadBlob(new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'}), `ugoku_frame_${S.cf+1}.svg`);
    E.toast('SVG保存完了');
  };

  EX.exportGIF=async quality=>{
    E.snapToCache();
    const mo=U.$('exportModal');mo.classList.add('show');
    U.$('expTitle').textContent='GIF生成中...';
    const sc=quality==='low'?0.5:quality==='mid'?0.75:1;
    const ow=Math.round(S.CW*sc),oh=Math.round(S.CH*sc);
    const delay=Math.round(1000/S.fps);
    const tmp=document.createElement('canvas');tmp.width=ow;tmp.height=oh;const tc=tmp.getContext('2d');
    const framesData=[];
    
    for(let i=0;i<S.frames.length;i++){
      await E.ensureCached(S.frames[i].id);
      renderFrameToCtx(tc,S.frames[i].id,ow,oh);
      framesData.push(tc.getImageData(0,0,ow,oh).data.buffer);
      
      if (i !== S.cf) S.fc.delete(S.frames[i].id);

      U.$('expBar').style.width=((i+1)/S.frames.length*40)+'%';
      U.$('expMsg').textContent=`レンダリング ${i+1}/${S.frames.length}`;
      await new Promise(r=>setTimeout(r,2));
    }
    
    if(E.W){
      const res=await E.workerCall({type:'gifEncode',w:ow,h:oh,framesData,delay},framesData,d=>{
        U.$('expBar').style.width=(40+d.frame/d.total*55)+'%';
        U.$('expMsg').textContent=`エンコード ${d.frame}/${d.total}`;
      });
      U.$('expBar').style.width='100%';
      downloadBlob(new Blob([new Uint8Array(res.data)],{type:'image/gif'}),'ugoku_draw_'+Date.now()+'.gif');
      mo.classList.remove('show');
      E.toast('GIF保存完了');
    }else{
      mo.classList.remove('show');
      E.toast('Worker非対応');
    }
  };

  EX.exportPNGSequence=async quality=>{
    if(typeof JSZip === 'undefined') return E.toast('JSZip not loaded');
    E.snapToCache();
    
    const sc=quality==='low'?0.5:quality==='mid'?1:2;
    const ow=Math.round(S.CW*sc),oh=Math.round(S.CH*sc);
    const tmp=document.createElement('canvas');tmp.width=ow;tmp.height=oh;const tc=tmp.getContext('2d');
    
    const mo=U.$('exportModal');mo.classList.add('show');
    U.$('expTitle').textContent='PNG連番(ZIP)出力中...';
    const zip = new JSZip();

    for(let i=0;i<S.frames.length;i++){
      await E.ensureCached(S.frames[i].id);
      renderFrameToCtx(tc,S.frames[i].id,ow,oh);
      
      const blob=await new Promise(r=>tmp.toBlob(r,'image/png'));
      zip.file(`frame_${String(i+1).padStart(4,'0')}.png`, blob);
      
      if (i !== S.cf) S.fc.delete(S.frames[i].id);

      U.$('expBar').style.width=((i+1)/S.frames.length*50)+'%';
      U.$('expMsg').textContent=`画像生成: ${i+1}/${S.frames.length}`;
      await new Promise(r=>setTimeout(r,1));
    }
    
    U.$('expMsg').textContent='ZIPファイル構築中...';
    const content = await zip.generateAsync({type:'blob', compression:'STORE'}, meta => {
        U.$('expBar').style.width=(50 + meta.percent*0.5)+'%';
    });
    
    downloadBlob(content, `ugoku_png_sequence_${Date.now()}.zip`);
    mo.classList.remove('show');
    E.toast('PNG連番出力完了');
  };

  EX.exportCurrentFrame=async()=>{
    const tmp=document.createElement('canvas');tmp.width=S.CW;tmp.height=S.CH;const tc=tmp.getContext('2d');
    E.snapToCache();
    await E.ensureCached(E.curId());
    renderFrameToCtx(tc,E.curId(),S.CW,S.CH);
    tmp.toBlob(blob=>{downloadBlob(blob,`ugoku_frame_${S.cf+1}.png`);E.toast('フレーム画像保存');},'image/png');
  };

 async function renderPerfectAudioBuffer() {
    const duration = Math.max(0.1, S.frames.length / S.fps);
    const sampleRate = 44100;
    const oac = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);
    let hasAudio = false;
    if (G.Audio && G.Audio.bgmBuffer) {
      const bgmNode = oac.createBufferSource(); bgmNode.buffer = G.Audio.bgmBuffer;
      bgmNode.connect(oac.destination); bgmNode.start(0); hasAudio = true;
    }
    S.frames.forEach((fr, i) => {
      const time = i / S.fps;
      if (fr.seFlags) {
        fr.seFlags.forEach((flag, chIdx) => {
          if (flag && S.seBuffers && S.seBuffers[chIdx]) {
            const seNode = oac.createBufferSource(); seNode.buffer = S.seBuffers[chIdx];
            seNode.connect(oac.destination); seNode.start(time); hasAudio = true;
          }
        });
      }
    });
    if (!hasAudio) return null;
    return await oac.startRendering();
  }


  function getInterleavedData(buffer, offset, actualFrames, targetFrames = 1024) {
    const data = new Float32Array(2 * targetFrames);
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    for (let i = 0; i < actualFrames; i++) {
      data[i * 2] = left[offset + i];
      data[i * 2 + 1] = right[offset + i];
    }
    return data;
  }

  EX.exportVideo = async quality => {
    // UniMuxer（Mp4Muxer改） と Mp4Muxer のどちらでも動くように自動判別
    const MuxerClass = window.UniMuxer || window.Mp4Muxer;
    if (typeof window.VideoEncoder === 'undefined' || !MuxerClass) {
      return E.toast('このブラウザはMP4出力機能に非対応です');
    }

    E.snapToCache();
    const mo = U.$('exportModal'); mo.classList.add('show');
    U.$('expTitle').textContent = 'MP4動画をエンコード中...';
    U.$('expBar').style.width = '0%';
    U.$('expMsg').textContent = 'ファイルシステムの準備中...';

    try {
      const audioBuffer = await renderPerfectAudioBuffer();

      const sc = quality==='low' ? 0.5 : quality==='mid' ? 1 : 1.5;
      const bps = quality==='low' ? 2e6 : quality==='mid' ? 5e6 : 10e6;

      const baseW = Number(S.CW) || 800;
      const baseH = Number(S.CH) || 800;
      let ew = Math.floor(baseW * sc);
      let eh = Math.floor(baseH * sc);
      ew = (ew % 2 === 0) ? ew : ew + 1;
      eh = (eh % 2 === 0) ? eh : eh + 1;
      if (ew < 2) ew = 2;
      if (eh < 2) eh = 2;

      const ec = document.createElement('canvas'); ec.width = ew; ec.height = eh;
      const ex = ec.getContext('2d');

      let muxerTarget;
      let opfsFileHandle = null;
      let opfsWritable = null;
      
      try {
          const root = await navigator.storage.getDirectory();
          opfsFileHandle = await root.getFileHandle(`ugoku_video_${Date.now()}.mp4`, { create: true });
          
          if (opfsFileHandle.createWritable) {
              opfsWritable = await opfsFileHandle.createWritable();
              muxerTarget = new MuxerClass.FileSystemWritableFileStreamTarget(opfsWritable);
          } else {
              throw new Error("ストリーミング書き込み非対応");
          }
      } catch (e) {
          muxerTarget = new MuxerClass.ArrayBufferTarget();
      }

      const muxer = new MuxerClass.Muxer({
        target: muxerTarget,
        video: { codec: 'avc', width: ew, height: eh },
        audio: audioBuffer ? { codec: 'aac', sampleRate: 44100, numberOfChannels: 2 } : undefined,
        fastStart: 'in-memory'
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => { console.error('VideoEncoder error:', e); }
      });

      videoEncoder.configure({
        codec: 'avc1.4D0028',
        width: ew,
        height: eh,
        bitrate: bps,
        framerate: S.fps,
        avc: { format: 'avc' }
      });

      let audioEncoder = null;
      if (audioBuffer) {
        if (typeof window.AudioEncoder === 'undefined') {
          E.toast('お使いの環境は音声出力非対応のため無音になります');
        } else {
          try {
            audioEncoder = new AudioEncoder({
              output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
              error: e => { console.error('AudioEncoder Error:', e); }
            });
            audioEncoder.configure({
              codec: 'mp4a.40.2',
              sampleRate: 44100,
              numberOfChannels: 2,
              bitrate: 128000
            });
          } catch (e) {
            console.error('AudioEncoder設定エラー:', e);
            audioEncoder = null;
          }
        }
      }

      for (let i = 0; i < S.frames.length; i++) {
        await E.ensureCached(S.frames[i].id);
        EX.renderFrameToCtx(ex, S.frames[i].id, ew, eh);

        const timestamp = (i / S.fps) * 1000000;
        const frame = new VideoFrame(ec, { timestamp, alpha: 'discard' });

        const keyFrame = (i % (S.fps * 2)) === 0;
        videoEncoder.encode(frame, { keyFrame });
        frame.close();
        
        if (i !== S.cf) S.fc.delete(S.frames[i].id);

        U.$('expBar').style.width = ((i+1) / S.frames.length * 50) + '%';
        U.$('expMsg').textContent = `映像エンコード: ${i+1}/${S.frames.length}`;
        await new Promise(r => setTimeout(r, 0));
      }

      if (audioBuffer && audioEncoder) {
        const totalFrames = audioBuffer.length;
        const framesPerChunk = 1024; 

        for (let offset = 0; offset < totalFrames; offset += framesPerChunk) {
          const frameCount = Math.min(framesPerChunk, totalFrames - offset);
          try {
            const audioData = new AudioData({
              format: 'f32', // ★ iOS Safari地雷対策: planarをやめてf32(インターリーブ)にする
              sampleRate: 44100,
              numberOfChannels: 2,
              numberOfFrames: framesPerChunk,
              timestamp: Math.round((offset / 44100) * 1000000), // ★ タイムスタンプの整数化
              data: getInterleavedData(audioBuffer, offset, frameCount, framesPerChunk)
            });
            audioEncoder.encode(audioData);
            audioData.close();
          } catch (e) {
            console.error("AudioData Error:", e);
          }

          U.$('expBar').style.width = (50 + (offset / totalFrames * 50)) + '%';
          U.$('expMsg').textContent = '音声エンコード中...';
          if (offset % (framesPerChunk * 10) === 0) await new Promise(r => setTimeout(r, 0));
        }
      }

      U.$('expMsg').textContent = '最終処理中...';

      await videoEncoder.flush();
      if (audioEncoder) await audioEncoder.flush();

      muxer.finalize();
      
      if (opfsWritable) {
          await opfsWritable.close();
          const file = await opfsFileHandle.getFile();
          downloadBlob(file, `ugoku_draw_${Date.now()}.mp4`);
      } else {
          const { buffer } = muxer.target;
          const blob = new Blob([buffer], { type: 'video/mp4' });
          downloadBlob(blob, `ugoku_draw_${Date.now()}.mp4`);
      }

      E.toast('MP4出力完了');
      mo.classList.remove('show');

    } catch (err) {
      console.error(err);
      E.toast('エンコード中にエラーが発生しました');
      mo.classList.remove('show');
    }
  };

  function downloadBlob(blob,fn){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
  EX.renderFrameToCtx=renderFrameToCtx; EX.downloadBlob=downloadBlob;
  G.Export=EX;
})(window.UgokuDraw);