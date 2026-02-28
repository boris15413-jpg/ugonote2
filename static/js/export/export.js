"use strict";
!(function (G) {
  const U = G.Utils,
    C = G.Config,
    S = (G.Renderer, G.State),
    E = G.Engine,
    VP = G.VectorPaths,
    EX = {};
  function renderFrameToCtx(tc, fid, ow, oh) {
    ((tc.fillStyle = S.pc), tc.fillRect(0, 0, ow, oh));
    const scale = ow / S.CW;
    (tc.save(), tc.scale(scale, scale));
    const c = S.fc.get(fid);
    if (c && c.P) {
      const tmp = document.createElement("canvas");
      ((tmp.width = S.CW * C.DPR), (tmp.height = S.CH * C.DPR));
      (tmp.getContext("2d").putImageData(c.P, 0, 0),
        tc.drawImage(tmp, 0, 0, S.CW, S.CH));
    }
    (S.layerOrder.forEach((layer) => {
      if (c && c[layer]) {
        const tmp = document.createElement("canvas");
        ((tmp.width = S.CW * C.DPR), (tmp.height = S.CH * C.DPR));
        (tmp.getContext("2d").putImageData(c[layer], 0, 0),
          tc.drawImage(tmp, 0, 0, S.CW, S.CH));
      }
      VP && VP.renderAllPaths(tc, fid, layer, S.CW, S.CH);
    }),
      tc.restore());
  }
  function getInterleavedData(
    buffer,
    offset,
    actualFrames,
    targetFrames = 1024,
  ) {
    const data = new Float32Array(2 * targetFrames),
      left = buffer.getChannelData(0),
      right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    for (let i = 0; i < actualFrames; i++)
      ((data[2 * i] = left[offset + i]), (data[2 * i + 1] = right[offset + i]));
    return data;
  }
  function downloadBlob(blob, fn) {
    const a = document.createElement("a");
    ((a.href = URL.createObjectURL(blob)),
      (a.download = fn),
      a.click(),
      setTimeout(() => URL.revokeObjectURL(a.href), 5e3));
  }
  ((EX.exportSVG = async () => {
    const w = S.CW,
      h = S.CH;
    (E.snapToCache(), await E.ensureCached(E.curId()));
    const fid = E.curId(),
      rasterUrl = (function (fid) {
        const dpr = C.DPR,
          tmp = document.createElement("canvas");
        ((tmp.width = S.CW), (tmp.height = S.CH));
        const tc = tmp.getContext("2d");
        ((tc.fillStyle = S.pc), tc.fillRect(0, 0, S.CW, S.CH));
        const c = S.fc.get(fid);
        if (c && c.P) {
          const t2 = document.createElement("canvas");
          ((t2.width = S.CW * dpr),
            (t2.height = S.CH * dpr),
            t2.getContext("2d").putImageData(c.P, 0, 0),
            tc.drawImage(t2, 0, 0, S.CW, S.CH));
        }
        return (
          S.layerOrder.forEach((l) => {
            if (c && c[l]) {
              const t2 = document.createElement("canvas");
              ((t2.width = S.CW * dpr),
                (t2.height = S.CH * dpr),
                t2.getContext("2d").putImageData(c[l], 0, 0),
                tc.drawImage(t2, 0, 0, S.CW, S.CH));
            }
          }),
          tmp.toDataURL("image/png")
        );
      })(fid);
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n  <title>UgokuDraw Frame ${S.cf + 1}</title>\n`;
    ((svgContent += `  <image href="${rasterUrl}" width="${w}" height="${h}" />\n`),
      S.layerOrder.forEach((layer) => {
        const paths = VP.getFramePaths(fid, layer);
        paths &&
          0 !== paths.length &&
          ((svgContent += `  <g id="layer-${layer}">\n`),
          paths.forEach((p) => {
            const pts =
              p.smooth > 0 && p.pts.length >= 3
                ? U.stabilize(p.pts, p.smooth)
                : p.pts;
            if (0 === pts.length) return;
            const color = p.color,
              opacity = p.alpha,
              strokeWidth = p.size;
            let d = "",
              fill = "none";
            if ("pen" === p.type)
              if (1 === pts.length)
                d = `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.1} ${pts[0].y}`;
              else {
                d = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length - 1; i++) {
                  const mx = (pts[i].x + pts[i + 1].x) / 2,
                    my = (pts[i].y + pts[i + 1].y) / 2;
                  d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
                }
                d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
              }
            else if ("line" === p.type)
              d = `M ${pts[0].x} ${pts[0].y} L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
            else if ("rect" === p.type) {
              const rw = pts[1].x - pts[0].x,
                rh = pts[1].y - pts[0].y;
              ((d = `M ${pts[0].x} ${pts[0].y} h ${rw} v ${rh} h ${-rw} z`),
                p.fill && (fill = color));
            } else if ("circle" === p.type) {
              const rx = Math.abs(pts[1].x - pts[0].x) / 2,
                ry = Math.abs(pts[1].y - pts[0].y) / 2;
              ((d = `M ${(pts[0].x + pts[1].x) / 2 + rx} ${(pts[0].y + pts[1].y) / 2} a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 a ${rx} ${ry} 0 1 0 ${2 * rx} 0`),
                p.fill && (fill = color));
            } else {
              d = `M ${pts[0].x} ${pts[0].y}`;
              for (let i = 1; i < pts.length; i++)
                d += ` L ${pts[i].x} ${pts[i].y}`;
              ((d += " Z"), p.fill && (fill = color));
            }
            if (p.outline) {
              const outWidth = strokeWidth + 2 * p.outlineWidth;
              svgContent += `    <path d="${d}" stroke="${p.outlineColor}" stroke-width="${outWidth}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />\n`;
            }
            svgContent += `    <path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />\n`;
          }),
          (svgContent += "  </g>\n"));
      }),
      (svgContent += "</svg>"),
      downloadBlob(
        new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" }),
        `ugoku_frame_${S.cf + 1}.svg`,
      ),
      E.toast("SVG保存完了"));
  }),
    (EX.exportGIF = async (quality) => {
      E.snapToCache();
      const mo = U.$("exportModal");
      (mo.classList.add("show"),
        (U.$("expTitle").textContent = "GIF生成中..."));
      const sc = "low" === quality ? 0.5 : "mid" === quality ? 0.75 : 1,
        ow = Math.round(S.CW * sc),
        oh = Math.round(S.CH * sc),
        delay = Math.round(1e3 / S.fps),
        tmp = document.createElement("canvas");
      ((tmp.width = ow), (tmp.height = oh));
      const tc = tmp.getContext("2d"),
        framesData = [];
      for (let i = 0; i < S.frames.length; i++)
        (await E.ensureCached(S.frames[i].id),
          renderFrameToCtx(tc, S.frames[i].id, ow, oh),
          framesData.push(tc.getImageData(0, 0, ow, oh).data.buffer),
          i !== S.cf && S.fc.delete(S.frames[i].id),
          (U.$("expBar").style.width = ((i + 1) / S.frames.length) * 40 + "%"),
          (U.$("expMsg").textContent =
            `レンダリング ${i + 1}/${S.frames.length}`),
          await new Promise((r) => setTimeout(r, 2)));
      if (E.W) {
        const res = await E.workerCall(
          {
            type: "gifEncode",
            w: ow,
            h: oh,
            framesData: framesData,
            delay: delay,
          },
          framesData,
          (d) => {
            ((U.$("expBar").style.width = 40 + (d.frame / d.total) * 55 + "%"),
              (U.$("expMsg").textContent = `エンコード ${d.frame}/${d.total}`));
          },
        );
        ((U.$("expBar").style.width = "100%"),
          downloadBlob(
            new Blob([new Uint8Array(res.data)], { type: "image/gif" }),
            "ugoku_draw_" + Date.now() + ".gif",
          ),
          mo.classList.remove("show"),
          E.toast("GIF保存完了"));
      } else (mo.classList.remove("show"), E.toast("Worker非対応"));
    }),
    (EX.exportPNGSequence = async (quality) => {
      if ("undefined" == typeof JSZip) return E.toast("JSZip not loaded");
      E.snapToCache();
      const sc = "low" === quality ? 0.5 : "mid" === quality ? 1 : 2,
        ow = Math.round(S.CW * sc),
        oh = Math.round(S.CH * sc),
        tmp = document.createElement("canvas");
      ((tmp.width = ow), (tmp.height = oh));
      const tc = tmp.getContext("2d"),
        mo = U.$("exportModal");
      (mo.classList.add("show"),
        (U.$("expTitle").textContent = "PNG連番(ZIP)出力中..."));
      const zip = new JSZip();
      for (let i = 0; i < S.frames.length; i++) {
        (await E.ensureCached(S.frames[i].id),
          renderFrameToCtx(tc, S.frames[i].id, ow, oh));
        const blob = await new Promise((r) => tmp.toBlob(r, "image/png"));
        (zip.file(`frame_${String(i + 1).padStart(4, "0")}.png`, blob),
          i !== S.cf && S.fc.delete(S.frames[i].id),
          (U.$("expBar").style.width = ((i + 1) / S.frames.length) * 50 + "%"),
          (U.$("expMsg").textContent = `画像生成: ${i + 1}/${S.frames.length}`),
          await new Promise((r) => setTimeout(r, 1)));
      }
      U.$("expMsg").textContent = "ZIPファイル構築中...";
      (downloadBlob(
        await zip.generateAsync(
          { type: "blob", compression: "STORE" },
          (meta) => {
            U.$("expBar").style.width = 50 + 0.5 * meta.percent + "%";
          },
        ),
        `ugoku_png_sequence_${Date.now()}.zip`,
      ),
        mo.classList.remove("show"),
        E.toast("PNG連番出力完了"));
    }),
    (EX.exportCurrentFrame = async () => {
      const tmp = document.createElement("canvas");
      ((tmp.width = S.CW), (tmp.height = S.CH));
      const tc = tmp.getContext("2d");
      (E.snapToCache(),
        await E.ensureCached(E.curId()),
        renderFrameToCtx(tc, E.curId(), S.CW, S.CH),
        tmp.toBlob((blob) => {
          (downloadBlob(blob, `ugoku_frame_${S.cf + 1}.png`),
            E.toast("フレーム画像保存"));
        }, "image/png"));
    }),
    (EX.exportVideo = async (quality) => {
      const MuxerClass = window.UniMuxer || window.Mp4Muxer;
      if (void 0 === window.VideoEncoder || !MuxerClass)
        return E.toast("このブラウザはMP4出力機能に非対応です");
      E.snapToCache();
      const mo = U.$("exportModal");
      (mo.classList.add("show"),
        (U.$("expTitle").textContent = "MP4動画をエンコード中..."),
        (U.$("expBar").style.width = "0%"),
        (U.$("expMsg").textContent = "ファイルシステムの準備中..."));
      try {
        const audioBuffer = await (async function () {
            const playbackRate = S.fps / (S.baseFps || 8),
              rawDuration = Math.max(0.1, S.frames.length / S.fps),
              duration = rawDuration / playbackRate,
              oac = new OfflineAudioContext(
                2,
                Math.floor(44100 * duration),
                44100,
              );
            let hasAudio = !1;
            if (G.Audio && G.Audio.bgmBuffer) {
              const bgmNode = oac.createBufferSource();
              ((bgmNode.buffer = G.Audio.bgmBuffer),
                (bgmNode.playbackRate.value = playbackRate),
                bgmNode.connect(oac.destination),
                bgmNode.start(0),
                (hasAudio = !0));
            }
            return (
              S.frames.forEach((fr, i) => {
                const time = i / S.fps / playbackRate;
                fr.seFlags &&
                  fr.seFlags.forEach((flag, chIdx) => {
                    if (flag && S.seBuffers && S.seBuffers[chIdx]) {
                      const seNode = oac.createBufferSource();
                      ((seNode.buffer = S.seBuffers[chIdx]),
                        (seNode.playbackRate.value = playbackRate),
                        seNode.connect(oac.destination),
                        seNode.start(time),
                        (hasAudio = !0));
                    }
                  });
              }),
              hasAudio ? await oac.startRendering() : null
            );
          })(),
          sc = "low" === quality ? 0.5 : "mid" === quality ? 1 : 1.5,
          bps = "low" === quality ? 2e6 : "mid" === quality ? 5e6 : 1e7,
          baseW = Number(S.CW) || 800,
          baseH = Number(S.CH) || 800;
        let ew = Math.floor(baseW * sc),
          eh = Math.floor(baseH * sc);
        ((ew = ew % 2 == 0 ? ew : ew + 1),
          (eh = eh % 2 == 0 ? eh : eh + 1),
          ew < 2 && (ew = 2),
          eh < 2 && (eh = 2));
        const ec = document.createElement("canvas");
        ((ec.width = ew), (ec.height = eh));
        const ex = ec.getContext("2d");
        let muxerTarget,
          opfsFileHandle = null,
          opfsWritable = null;
        try {
          const root = await navigator.storage.getDirectory();
          if (
            ((opfsFileHandle = await root.getFileHandle(
              `ugoku_video_${Date.now()}.mp4`,
              { create: !0 },
            )),
            !opfsFileHandle.createWritable)
          )
            throw new Error("ストリーミング書き込み非対応");
          ((opfsWritable = await opfsFileHandle.createWritable()),
            (muxerTarget = new MuxerClass.FileSystemWritableFileStreamTarget(
              opfsWritable,
            )));
        } catch (e) {
          muxerTarget = new MuxerClass.ArrayBufferTarget();
        }
        const muxer = new MuxerClass.Muxer({
            target: muxerTarget,
            video: { codec: "avc", width: ew, height: eh },
            audio: audioBuffer
              ? { codec: "aac", sampleRate: 44100, numberOfChannels: 2 }
              : void 0,
            fastStart: "in-memory",
          }),
          videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => {
              console.error("VideoEncoder error:", e);
            },
          });
        videoEncoder.configure({
          codec: "avc1.4D0028",
          width: ew,
          height: eh,
          bitrate: bps,
          framerate: S.fps,
          avc: { format: "avc" },
        });
        let audioEncoder = null;
        if (audioBuffer)
          if (void 0 === window.AudioEncoder)
            E.toast("お使いの環境は音声出力非対応のため無音になります");
          else
            try {
              ((audioEncoder = new AudioEncoder({
                output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                error: (e) => {
                  console.error("AudioEncoder Error:", e);
                },
              })),
                audioEncoder.configure({
                  codec: "mp4a.40.2",
                  sampleRate: 44100,
                  numberOfChannels: 2,
                  bitrate: 128e3,
                }));
            } catch (e) {
              (console.error("AudioEncoder設定エラー:", e),
                (audioEncoder = null));
            }
        for (let i = 0; i < S.frames.length; i++) {
          (await E.ensureCached(S.frames[i].id),
            EX.renderFrameToCtx(ex, S.frames[i].id, ew, eh));
          const timestamp = (i / S.fps) * 1e6,
            frame = new VideoFrame(ec, {
              timestamp: timestamp,
              alpha: "discard",
            }),
            keyFrame = i % (2 * S.fps) == 0;
          (videoEncoder.encode(frame, { keyFrame: keyFrame }),
            frame.close(),
            i !== S.cf && S.fc.delete(S.frames[i].id),
            (U.$("expBar").style.width =
              ((i + 1) / S.frames.length) * 50 + "%"),
            (U.$("expMsg").textContent =
              `映像エンコード: ${i + 1}/${S.frames.length}`),
            await new Promise((r) => setTimeout(r, 0)));
        }
        if (audioBuffer && audioEncoder) {
          const totalFrames = audioBuffer.length,
            framesPerChunk = 1024;
          for (let offset = 0; offset < totalFrames; offset += framesPerChunk) {
            const frameCount = Math.min(framesPerChunk, totalFrames - offset);
            try {
              const audioData = new AudioData({
                format: "f32",
                sampleRate: 44100,
                numberOfChannels: 2,
                numberOfFrames: framesPerChunk,
                timestamp: Math.round((offset / 44100) * 1e6),
                data: getInterleavedData(
                  audioBuffer,
                  offset,
                  frameCount,
                  framesPerChunk,
                ),
              });
              (audioEncoder.encode(audioData), audioData.close());
            } catch (e) {
              console.error("AudioData Error:", e);
            }
            ((U.$("expBar").style.width =
              50 + (offset / totalFrames) * 50 + "%"),
              (U.$("expMsg").textContent = "音声エンコード中..."),
              offset % (10 * framesPerChunk) == 0 &&
                (await new Promise((r) => setTimeout(r, 0))));
          }
        }
        if (
          ((U.$("expMsg").textContent = "最終処理中..."),
          await videoEncoder.flush(),
          audioEncoder && (await audioEncoder.flush()),
          muxer.finalize(),
          opfsWritable)
        ) {
          await opfsWritable.close();
          downloadBlob(
            await opfsFileHandle.getFile(),
            `ugoku_draw_${Date.now()}.mp4`,
          );
        } else {
          const { buffer: buffer } = muxer.target;
          downloadBlob(
            new Blob([buffer], { type: "video/mp4" }),
            `ugoku_draw_${Date.now()}.mp4`,
          );
        }
        (E.toast("MP4出力完了"), mo.classList.remove("show"));
      } catch (err) {
        (console.error(err),
          E.toast("エンコード中にエラーが発生しました"),
          mo.classList.remove("show"));
      }
    }),
    (EX.renderFrameToCtx = renderFrameToCtx),
    (EX.downloadBlob = downloadBlob),
    (G.Export = EX));
})(window.UgokuDraw);
