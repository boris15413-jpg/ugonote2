"use strict";
!(function (G) {
  (G.Utils, G.Config);
  const S = G.State,
    E = G.Engine;
  let audioCtx = null,
    bgmBuffer = null,
    bgmSource = null,
    masterGain = null,
    sfxGain = null,
    bgmGain = null,
    analyser = null;
  const SFX_DEFS = {
    click: { freq: 800, dur: 0.05, type: "square", decay: 0.04 },
    pop: { freq: 600, dur: 0.15, type: "sine", decay: 0.12 },
    swoosh: { freq: 1200, dur: 0.2, type: "sawtooth", decay: 0.18 },
    boing: { freq: 200, dur: 0.35, type: "sine", decay: 0.3, vibrato: !0 },
    bell: { freq: 1047, dur: 0.5, type: "sine", decay: 0.45 },
    snap: { freq: 2e3, dur: 0.03, type: "square", decay: 0.02 },
    drum: { freq: 150, dur: 0.2, type: "sine", decay: 0.18 },
    whistle: { freq: 1500, dur: 0.4, type: "sine", decay: 0.35, sweep: 2e3 },
    laser: { freq: 800, dur: 0.3, type: "sawtooth", decay: 0.25, sweep: -600 },
    coin: { freq: 987, dur: 0.15, type: "square", decay: 0.12, second: 1318 },
    jump: { freq: 300, dur: 0.2, type: "sine", decay: 0.18, sweep: 600 },
    hit: { freq: 100, dur: 0.15, type: "sawtooth", decay: 0.12 },
    chime: { freq: 880, dur: 0.6, type: "sine", decay: 0.55, second: 1108 },
    blip: { freq: 440, dur: 0.08, type: "square", decay: 0.06 },
    splash: { freq: 200, dur: 0.5, type: "sawtooth", decay: 0.4, noise: !0 },
    woosh: { freq: 400, dur: 0.25, type: "sine", decay: 0.2, sweep: 100 },
    ding: { freq: 1200, dur: 0.3, type: "sine", decay: 0.25, second: 1800 },
    buzz: { freq: 80, dur: 0.3, type: "sawtooth", decay: 0.25 },
    zip: { freq: 500, dur: 0.15, type: "square", decay: 0.12, sweep: 2e3 },
    thud: { freq: 60, dur: 0.25, type: "sine", decay: 0.2, noise: !0 },
    sparkle: { freq: 2e3, dur: 0.4, type: "sine", decay: 0.35, second: 2500 },
    horn: { freq: 300, dur: 0.5, type: "square", decay: 0.4, second: 450 },
  };
  function getAudioCtx() {
    return (
      audioCtx ||
        ((audioCtx = new (window.AudioContext || window.webkitAudioContext)()),
        (masterGain = audioCtx.createGain()),
        masterGain.connect(audioCtx.destination),
        (sfxGain = audioCtx.createGain()),
        sfxGain.connect(masterGain),
        (bgmGain = audioCtx.createGain()),
        bgmGain.connect(masterGain),
        (analyser = audioCtx.createAnalyser()),
        (analyser.fftSize = 256),
        masterGain.connect(analyser)),
      "suspended" === audioCtx.state && audioCtx.resume(),
      audioCtx
    );
  }
  function playBuiltInSFX(name) {
    const def = SFX_DEFS[name];
    if (!def) return;
    const ac = getAudioCtx(),
      t = ac.currentTime,
      vol = S.sfxVol,
      osc = ac.createOscillator(),
      gain = ac.createGain();
    if (
      (osc.connect(gain),
      gain.connect(sfxGain),
      (osc.type = def.type),
      osc.frequency.setValueAtTime(def.freq, t),
      def.sweep &&
        osc.frequency.linearRampToValueAtTime(
          def.freq + def.sweep,
          t + def.dur,
        ),
      def.vibrato)
    ) {
      const lfo = ac.createOscillator(),
        lg = ac.createGain();
      ((lfo.frequency.value = 12),
        (lg.gain.value = 50),
        lfo.connect(lg),
        lg.connect(osc.frequency),
        lfo.start(t),
        lfo.stop(t + def.dur));
    }
    if (
      (gain.gain.setValueAtTime(0.35 * vol, t),
      gain.gain.exponentialRampToValueAtTime(0.001, t + def.decay),
      osc.start(t),
      osc.stop(t + def.dur),
      def.second)
    ) {
      const o2 = ac.createOscillator(),
        g2 = ac.createGain();
      (o2.connect(g2),
        g2.connect(sfxGain),
        (o2.type = def.type),
        (o2.frequency.value = def.second),
        g2.gain.setValueAtTime(0.3 * vol, t + 0.4 * def.dur),
        g2.gain.exponentialRampToValueAtTime(0.001, t + def.dur),
        o2.start(t + 0.4 * def.dur),
        o2.stop(t + def.dur));
    }
    if (def.noise) {
      const bs = Math.floor(ac.sampleRate * def.dur),
        nb = ac.createBuffer(1, bs, ac.sampleRate),
        data = nb.getChannelData(0);
      for (let i = 0; i < bs; i++) data[i] = 0.3 * (2 * Math.random() - 1);
      const ns = ac.createBufferSource();
      ns.buffer = nb;
      const ng = ac.createGain();
      (ns.connect(ng),
        ng.connect(sfxGain),
        ng.gain.setValueAtTime(0.2 * vol, t),
        ng.gain.exponentialRampToValueAtTime(0.001, t + def.dur),
        ns.start(t),
        ns.stop(t + def.dur));
    }
  }
  async function prepareSEChannel(chIdx) {
    if ((S.seBuffers || (S.seBuffers = []), S.seBuffers[chIdx])) return;
    const ac = getAudioCtx(),
      defaults = ["click", "pop", "swoosh", "bell"],
      def = SFX_DEFS[defaults[chIdx % defaults.length]];
    if (!def) return;
    const sampleRate = ac.sampleRate || 44100,
      duration = Math.max(0.1, 1.5 * def.dur),
      oac = new OfflineAudioContext(
        1,
        Math.floor(sampleRate * duration),
        sampleRate,
      ),
      osc = oac.createOscillator(),
      gain = oac.createGain();
    if (
      (osc.connect(gain),
      gain.connect(oac.destination),
      (osc.type = def.type),
      osc.frequency.setValueAtTime(def.freq, 0),
      def.sweep &&
        osc.frequency.linearRampToValueAtTime(
          def.freq + def.sweep,
          0 + def.dur,
        ),
      def.vibrato)
    ) {
      const lfo = oac.createOscillator(),
        lg = oac.createGain();
      ((lfo.frequency.value = 12),
        (lg.gain.value = 50),
        lfo.connect(lg),
        lg.connect(osc.frequency),
        lfo.start(0),
        lfo.stop(0 + def.dur));
    }
    if (
      (gain.gain.setValueAtTime(0.35, 0),
      gain.gain.exponentialRampToValueAtTime(0.001, 0 + def.decay),
      osc.start(0),
      osc.stop(0 + def.dur),
      def.second)
    ) {
      const o2 = oac.createOscillator(),
        g2 = oac.createGain();
      (o2.connect(g2),
        g2.connect(oac.destination),
        (o2.type = def.type),
        (o2.frequency.value = def.second),
        g2.gain.setValueAtTime(0.3, 0 + 0.4 * def.dur),
        g2.gain.exponentialRampToValueAtTime(0.001, 0 + def.dur),
        o2.start(0 + 0.4 * def.dur),
        o2.stop(0 + def.dur));
    }
    if (def.noise) {
      const bs = Math.floor(sampleRate * def.dur),
        nb = oac.createBuffer(1, bs, sampleRate),
        data = nb.getChannelData(0);
      for (let i = 0; i < bs; i++) data[i] = 0.3 * (2 * Math.random() - 1);
      const ns = oac.createBufferSource(),
        ng = oac.createGain();
      ((ns.buffer = nb),
        ns.connect(ng),
        ng.connect(oac.destination),
        ng.gain.setValueAtTime(0.2, 0),
        ng.gain.exponentialRampToValueAtTime(0.001, 0 + def.dur),
        ns.start(0),
        ns.stop(0 + def.dur));
    }
    S.seBuffers[chIdx] = await oac.startRendering();
  }
  function stopBGM() {
    if (bgmSource)
      try {
        bgmSource.stop();
      } catch (e) {}
    bgmSource = null;
  }
  let recorder = null,
    recChunks = [];
  G.Audio = {
    getAudioCtx: getAudioCtx,
    playBuiltInSFX: playBuiltInSFX,
    playSEChannel: async function (chIdx) {
      await prepareSEChannel(chIdx);
      const buf = S.seBuffers[chIdx];
      if (buf)
        try {
          const ac = getAudioCtx(),
            src = ac.createBufferSource(),
            volGain = ac.createGain();
          ((src.buffer = buf),
            src.connect(volGain),
            volGain.connect(sfxGain),
            (volGain.gain.value = S.sfxVol),
            (src.playbackRate.value = S.fps / (S.baseFps || 8)),
            src.start(0));
        } catch (e) {}
    },
    prepareSEChannel: prepareSEChannel,
    recordToChannel: async function (chIdx) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: !0 }),
          rec = new MediaRecorder(stream),
          chunks = [];
        return new Promise((resolve, reject) => {
          ((rec.ondataavailable = (e) => {
            e.data.size > 0 && chunks.push(e.data);
          }),
            (rec.onstop = async () => {
              if ((stream.getTracks().forEach((t) => t.stop()), !chunks.length))
                return void reject("No data");
              const ac = getAudioCtx();
              try {
                const buf = await ac.decodeAudioData(
                  await new Blob(chunks, { type: "audio/webm" }).arrayBuffer(),
                );
                ((S.seBuffers[chIdx] = buf),
                  (S.seNames[chIdx] = `録音 ${chIdx + 1}`),
                  (S.baseFps = S.fps),
                  E.toast(`SE${chIdx + 1}に録音しました`),
                  resolve(!0));
              } catch (e) {
                (E.toast("録音エラー"), resolve(!1));
              }
            }),
            rec.start(),
            setTimeout(() => {
              "recording" === rec.state && rec.stop();
            }, 2e3));
        });
      } catch (e) {
        return (E.toast("マイク拒否"), !1);
      }
    },
    importToChannel: async function (chIdx, file) {
      try {
        const ac = getAudioCtx();
        return (
          (S.seBuffers[chIdx] = await ac.decodeAudioData(
            await file.arrayBuffer(),
          )),
          (S.seNames[chIdx] = file.name.substring(0, 8) + "..."),
          (S.baseFps = S.fps),
          E.toast(`SE${chIdx + 1}読込完了`),
          !0
        );
      } catch (e) {
        return (E.toast("読込失敗"), !1);
      }
    },
    clearChannel: function (chIdx) {
      ((S.seBuffers[chIdx] = null),
        (S.seNames[chIdx] = `SE${chIdx + 1}`),
        E.toast(`SE${chIdx + 1}クリア`));
    },
    loadBGM: async function (file) {
      try {
        const ac = getAudioCtx();
        return (
          (bgmBuffer = await ac.decodeAudioData(await file.arrayBuffer())),
          E.toast("BGM: " + file.name),
          (S.bgmStartFrame = 0),
          (S.bgmEndFrame = null),
          (S.baseFps = S.fps),
          !0
        );
      } catch (e) {
        return (E.toast("BGM失敗"), !1);
      }
    },
    clearBGM: function () {
      ((bgmBuffer = null), stopBGM());
    },
    playBGM: function (currentFrame, fps) {
      if (bgmBuffer)
        try {
          const ac = getAudioCtx();
          stopBGM();
          const startF = S.bgmStartFrame || 0,
            endF = null !== S.bgmEndFrame ? S.bgmEndFrame : S.frames.length - 1;
          if (currentFrame < startF || currentFrame > endF) return;
          ((bgmSource = ac.createBufferSource()),
            (bgmSource.buffer = bgmBuffer),
            bgmSource.connect(bgmGain),
            (bgmGain.gain.value = S.bgmVol),
            (bgmSource.playbackRate.value = S.fps / (S.baseFps || 8)));
          const offset = Math.max(0, currentFrame - startF) / (S.baseFps || 8),
            duration = (endF - currentFrame + 1) / (S.baseFps || 8);
          bgmSource.start(0, offset, duration);
        } catch (e) {}
    },
    stopBGM: stopBGM,
    startSyncRecord: async function () {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: !0 });
        return (
          (recorder = new MediaRecorder(stream)),
          (recChunks = []),
          (recorder.ondataavailable = (e) => {
            e.data.size > 0 && recChunks.push(e.data);
          }),
          (recorder.onstop = async () => {
            if ((stream.getTracks().forEach((t) => t.stop()), recChunks.length))
              try {
                const ac = getAudioCtx();
                ((bgmBuffer = await ac.decodeAudioData(
                  await new Blob(recChunks, {
                    type: "audio/webm",
                  }).arrayBuffer(),
                )),
                  (S.baseFps = S.fps),
                  E.toast("録音完了"));
              } catch (e) {
                E.toast("録音失敗");
              }
          }),
          recorder.start(),
          E.toast("録音開始"),
          !0
        );
      } catch (e) {
        return (E.toast("マイク拒否"), !1);
      }
    },
    stopRecord: function () {
      recorder && "recording" === recorder.state && recorder.stop();
    },
    setSFXVolume: function (v) {
      ((S.sfxVol = v), sfxGain && (sfxGain.gain.value = v));
    },
    setBGMVolume: function (v) {
      ((S.bgmVol = v), bgmGain && (bgmGain.gain.value = v));
    },
    getSFXList: function () {
      return Object.keys(SFX_DEFS);
    },
    playSFX: function (name) {
      playBuiltInSFX(name);
    },
    get bgmBuffer() {
      return bgmBuffer;
    },
    get analyser() {
      return analyser;
    },
  };
})(window.UgokuDraw);
