'use strict';
(function(G){
  const U=G.Utils,C=G.Config,S=G.State,E=G.Engine;
  let audioCtx=null,bgmBuffer=null,bgmSource=null,masterGain=null,sfxGain=null,bgmGain=null,analyser=null;

  const SFX_DEFS={
    click:{freq:800,dur:0.05,type:'square',decay:0.04},
    pop:{freq:600,dur:0.15,type:'sine',decay:0.12},
    swoosh:{freq:1200,dur:0.2,type:'sawtooth',decay:0.18},
    boing:{freq:200,dur:0.35,type:'sine',decay:0.3,vibrato:true},
    bell:{freq:1047,dur:0.5,type:'sine',decay:0.45},
    snap:{freq:2000,dur:0.03,type:'square',decay:0.02},
    drum:{freq:150,dur:0.2,type:'sine',decay:0.18},
    whistle:{freq:1500,dur:0.4,type:'sine',decay:0.35,sweep:2000},
    laser:{freq:800,dur:0.3,type:'sawtooth',decay:0.25,sweep:-600},
    coin:{freq:987,dur:0.15,type:'square',decay:0.12,second:1318},
    jump:{freq:300,dur:0.2,type:'sine',decay:0.18,sweep:600},
    hit:{freq:100,dur:0.15,type:'sawtooth',decay:0.12},
    chime:{freq:880,dur:0.6,type:'sine',decay:0.55,second:1108},
    blip:{freq:440,dur:0.08,type:'square',decay:0.06},
    splash:{freq:200,dur:0.5,type:'sawtooth',decay:0.4,noise:true},
    woosh:{freq:400,dur:0.25,type:'sine',decay:0.2,sweep:100},
    ding:{freq:1200,dur:0.3,type:'sine',decay:0.25,second:1800},
    buzz:{freq:80,dur:0.3,type:'sawtooth',decay:0.25},
    zip:{freq:500,dur:0.15,type:'square',decay:0.12,sweep:2000},
    thud:{freq:60,dur:0.25,type:'sine',decay:0.2,noise:true},
    sparkle:{freq:2000,dur:0.4,type:'sine',decay:0.35,second:2500},
    horn:{freq:300,dur:0.5,type:'square',decay:0.4,second:450}
  };

  function getAudioCtx(){
    if(!audioCtx){
      audioCtx=new(window.AudioContext||window.webkitAudioContext)();
      masterGain=audioCtx.createGain();masterGain.connect(audioCtx.destination);
      sfxGain=audioCtx.createGain();sfxGain.connect(masterGain);
      bgmGain=audioCtx.createGain();bgmGain.connect(masterGain);
      analyser=audioCtx.createAnalyser();analyser.fftSize=256;masterGain.connect(analyser);
    }
    if(audioCtx.state==='suspended')audioCtx.resume();
    return audioCtx;
  }

  function playBuiltInSFX(name){
    const def=SFX_DEFS[name];if(!def)return;
    const ac=getAudioCtx(),t=ac.currentTime,vol=S.sfxVol;
    const osc=ac.createOscillator(),gain=ac.createGain();
    osc.connect(gain);gain.connect(sfxGain);
    osc.type=def.type;osc.frequency.setValueAtTime(def.freq,t);
    if(def.sweep)osc.frequency.linearRampToValueAtTime(def.freq+def.sweep,t+def.dur);
    if(def.vibrato){const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=12;lg.gain.value=50;lfo.connect(lg);lg.connect(osc.frequency);lfo.start(t);lfo.stop(t+def.dur);}
    gain.gain.setValueAtTime(0.35*vol,t);gain.gain.exponentialRampToValueAtTime(0.001,t+def.decay);
    osc.start(t);osc.stop(t+def.dur);
    if(def.second){const o2=ac.createOscillator(),g2=ac.createGain();o2.connect(g2);g2.connect(sfxGain);o2.type=def.type;o2.frequency.value=def.second;g2.gain.setValueAtTime(0.3*vol,t+def.dur*0.4);g2.gain.exponentialRampToValueAtTime(0.001,t+def.dur);o2.start(t+def.dur*0.4);o2.stop(t+def.dur);}
    if(def.noise){const bs=Math.floor(ac.sampleRate*def.dur),nb=ac.createBuffer(1,bs,ac.sampleRate),data=nb.getChannelData(0);for(let i=0;i<bs;i++)data[i]=(Math.random()*2-1)*0.3;const ns=ac.createBufferSource();ns.buffer=nb;const ng=ac.createGain();ns.connect(ng);ng.connect(sfxGain);ng.gain.setValueAtTime(0.2*vol,t);ng.gain.exponentialRampToValueAtTime(0.001,t+def.dur);ns.start(t);ns.stop(t+def.dur);}
  }

  async function prepareSEChannel(chIdx) {
    if (!S.seBuffers) S.seBuffers = [];
    if (S.seBuffers[chIdx]) return;
    const ac = getAudioCtx();
    const defaults = ['click', 'pop', 'swoosh', 'bell'];
    const name = defaults[chIdx % defaults.length];
    const def = SFX_DEFS[name];
    if (!def) return;
    const sampleRate = ac.sampleRate || 44100;
    const duration = Math.max(0.1, def.dur * 1.5);
    const oac = new OfflineAudioContext(1, Math.floor(sampleRate * duration), sampleRate);
    const t = 0; const vol = 1.0;
    const osc = oac.createOscillator(); const gain = oac.createGain();
    osc.connect(gain); gain.connect(oac.destination);
    osc.type = def.type; osc.frequency.setValueAtTime(def.freq, t);
    if(def.sweep) osc.frequency.linearRampToValueAtTime(def.freq+def.sweep, t+def.dur);
    if(def.vibrato){
      const lfo = oac.createOscillator(), lg = oac.createGain();
      lfo.frequency.value = 12; lg.gain.value = 50; lfo.connect(lg);
      lg.connect(osc.frequency); lfo.start(t); lfo.stop(t+def.dur);
    }
    gain.gain.setValueAtTime(0.35*vol, t); gain.gain.exponentialRampToValueAtTime(0.001, t+def.decay);
    osc.start(t); osc.stop(t+def.dur);
    if(def.second){
      const o2 = oac.createOscillator(), g2 = oac.createGain();
      o2.connect(g2); g2.connect(oac.destination); o2.type = def.type; o2.frequency.value = def.second;
      g2.gain.setValueAtTime(0.3*vol, t+def.dur*0.4); g2.gain.exponentialRampToValueAtTime(0.001, t+def.dur);
      o2.start(t+def.dur*0.4); o2.stop(t+def.dur);
    }
    if(def.noise){
      const bs = Math.floor(sampleRate * def.dur), nb = oac.createBuffer(1, bs, sampleRate), data = nb.getChannelData(0);
      for(let i=0; i<bs; i++) data[i] = (Math.random()*2-1)*0.3;
      const ns = oac.createBufferSource(), ng = oac.createGain();
      ns.buffer = nb; ns.connect(ng); ng.connect(oac.destination);
      ng.gain.setValueAtTime(0.2*vol, t); ng.gain.exponentialRampToValueAtTime(0.001, t+def.dur);
      ns.start(t); ns.stop(t+def.dur);
    }
    S.seBuffers[chIdx] = await oac.startRendering();
  }

  async function playSEChannel(chIdx){
    await prepareSEChannel(chIdx);
    const buf = S.seBuffers[chIdx];
    if (!buf) return;
    try {
      const ac = getAudioCtx();
      const src = ac.createBufferSource();
      const volGain = ac.createGain();
      src.buffer = buf;
      src.connect(volGain);
      volGain.connect(sfxGain);
      volGain.gain.value = S.sfxVol;
      src.start(0);
    } catch(e) {}
  }

  async function recordToChannel(chIdx){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const rec=new MediaRecorder(stream);
      const chunks=[];
      return new Promise((resolve, reject)=>{
        rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
        rec.onstop=async()=>{
          stream.getTracks().forEach(t=>t.stop());
          if(!chunks.length){reject('No data');return;}
          const ac=getAudioCtx();
          try {
            const buf=await ac.decodeAudioData(await new Blob(chunks,{type:'audio/webm'}).arrayBuffer());
            S.seBuffers[chIdx]=buf;
            S.seNames[chIdx]=`録音 ${chIdx+1}`;
            E.toast(`SE${chIdx+1}に録音しました`);
            resolve(true);
          } catch(e){ E.toast('録音エラー'); resolve(false); }
        };
        rec.start();
        setTimeout(()=>{if(rec.state==='recording')rec.stop();}, 2000);
      });
    }catch(e){E.toast('マイク拒否');return false;}
  }

  async function importToChannel(chIdx, file){
    try{
      const ac=getAudioCtx();
      S.seBuffers[chIdx]=await ac.decodeAudioData(await file.arrayBuffer());
      S.seNames[chIdx]=file.name.substring(0,8)+'...';
      E.toast(`SE${chIdx+1}読込完了`);
      return true;
    }catch(e){E.toast('読込失敗');return false;}
  }

  function clearChannel(chIdx){
    S.seBuffers[chIdx]=null;
    S.seNames[chIdx]=`SE${chIdx+1}`;
    E.toast(`SE${chIdx+1}クリア`);
  }

  async function loadBGM(file){
    try{
      const ac=getAudioCtx();
      bgmBuffer=await ac.decodeAudioData(await file.arrayBuffer());
      E.toast('BGM: '+file.name);
      S.bgmStartFrame = 0;
      S.bgmEndFrame = null;
      return true;
    }catch(e){E.toast('BGM失敗');return false;}
  }

  function clearBGM(){ bgmBuffer=null; stopBGM(); }

  function playBGM(currentFrame, fps){
    if(!bgmBuffer) return;
    try{
      const ac = getAudioCtx();
      stopBGM();
      const startF = S.bgmStartFrame || 0;
      const endF = S.bgmEndFrame !== null ? S.bgmEndFrame : S.frames.length - 1;
      if (currentFrame < startF || currentFrame > endF) return;
      bgmSource = ac.createBufferSource();
      bgmSource.buffer = bgmBuffer;
      bgmSource.connect(bgmGain);
      bgmGain.gain.value = S.bgmVol;
      const offset = (currentFrame - startF) / fps;
      const duration = (endF - currentFrame + 1) / fps;
      bgmSource.start(0, offset, duration);
    } catch(e){}
  }

  function stopBGM(){if(bgmSource)try{bgmSource.stop();}catch(e){}bgmSource=null;}

  let recorder=null, recChunks=[];
  async function startSyncRecord(){try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(stream);recChunks=[];recorder.ondataavailable=e=>{if(e.data.size>0)recChunks.push(e.data);};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());if(!recChunks.length)return;try{const ac=getAudioCtx();bgmBuffer=await ac.decodeAudioData(await new Blob(recChunks,{type:'audio/webm'}).arrayBuffer());E.toast('録音完了');}catch(e){E.toast('録音失敗');}};recorder.start();E.toast('録音開始');return true;}catch(e){E.toast('マイク拒否');return false;}}
  function stopRecord(){if(recorder&&recorder.state==='recording')recorder.stop();}

  function setSFXVolume(v){S.sfxVol=v;if(sfxGain)sfxGain.gain.value=v;}
  function setBGMVolume(v){S.bgmVol=v;if(bgmGain)bgmGain.gain.value=v;}
  function getSFXList(){return Object.keys(SFX_DEFS);}
  function playSFX(name){ playBuiltInSFX(name); }

  G.Audio={
    getAudioCtx, playBuiltInSFX, playSEChannel, prepareSEChannel,
    recordToChannel, importToChannel, clearChannel,
    loadBGM, clearBGM, playBGM, stopBGM,
    startSyncRecord, stopRecord, setSFXVolume, setBGMVolume,
    getSFXList, playSFX,
    get bgmBuffer(){return bgmBuffer;},get analyser(){return analyser;}
  };
})(window.UgokuDraw);