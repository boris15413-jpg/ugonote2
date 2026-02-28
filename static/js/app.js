"use strict";
!(function () {
  const G = window.UgokuDraw,
    U = G.Utils,
    C = G.Config,
    S = G.State,
    E = G.Engine,
    R = G.Renderer,
    T = G.Tools,
    TL = G.Timeline,
    A = G.Audio,
    EX = G.Export,
    ST = G.Storage,
    UI = G.UI,
    VP = G.VectorPaths;
  (UI.buildHTML(),
    U.$$(".nav-item").forEach((b) => {
      b.onclick = () => {
        (S.playing && TL.stop(), UI.showPage(b.dataset.page));
      };
    }),
    (U.$("saveBtn").onclick = () => ST.saveProjectFile()),
    (U.$("loadBtn").onclick = () => U.$("projInput").click()),
    (U.$("projInput").onchange = async (e) => {
      const f = e.target.files[0];
      (f && (await ST.loadProjectFile(f), UI.buildLayerList()),
        (U.$("projInput").value = ""));
    }),
    (U.$("addVideoBtn").onclick = () => U.$("videoInput").click()),
    (U.$("videoInput").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const mo = U.$("exportModal");
      (mo.classList.add("show"),
        (U.$("expTitle").textContent = "動画をインポート中..."),
        (U.$("expBar").style.width = "0%"),
        (U.$("expMsg").textContent = "準備中..."));
      try {
        (S.playing && TL.stop(),
          (U.$("expMsg").textContent = "音声を抽出中..."));
        try {
          await A.loadBGM(f);
          const bgmName = U.$("mixBgmName");
          bgmName && (bgmName.textContent = "動画音声");
        } catch (err) {
          console.warn("音声の抽出に失敗しました", err);
        }
        const v = document.createElement("video");
        ((v.src = URL.createObjectURL(f)),
          (v.muted = !0),
          (v.playsInline = !0));
        await new Promise((r) => {
          ((v.onloadedmetadata = r), setTimeout(r, 2000));
        });
        const tFrames = Math.floor(v.duration * S.fps);
        if (tFrames < 1)
          return (
            mo.classList.remove("show"),
            void E.toast("動画を読み込めませんでした")
          );
        const dpr = C.DPR,
          c = document.createElement("canvas");
        ((c.width = S.CW * dpr), (c.height = S.CH * dpr));
        const x = c.getContext("2d");
        for (let i = 0; i < tFrames; i++) {
          v.currentTime = i / S.fps;
          await new Promise((r) => {
            v.onseeked = r;
            setTimeout(r, 150);
          });
          x.clearRect(0, 0, c.width, c.height);
          const vr = v.videoWidth / v.videoHeight,
            cr = c.width / c.height;
          let dw, dh, dx, dy;
          (vr > cr
            ? ((dw = c.width),
              (dh = c.width / vr),
              (dx = 0),
              (dy = (c.height - dh) / 2))
            : ((dh = c.height),
              (dw = c.height * vr),
              (dx = (c.width - dw) / 2),
              (dy = 0)),
            x.drawImage(v, 0, 0, v.videoWidth, v.videoHeight, dx, dy, dw, dh));
          if (i >= S.frames.length) {
            const nf = E.mkFrame();
            S.frames.push(nf);
          }
          const fid = S.frames[i].id;
          const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.8));
          if (ST.DB.db) {
            await ST.DB.put(ST.DB.SF, fid + "_P", blob);
          }
          if (i < C.LRU_SIZE) {
            let cache = S.fc.get(fid);
            cache ||
              ((cache = { A: null, B: null, C: null, P: null }),
                S.fc.set(fid, cache));
            const id = x.getImageData(0, 0, c.width, c.height);
            cache.P = new ImageData(
              new Uint8ClampedArray(id.data),
              c.width,
              c.height,
            );
            E.touchLRU(fid);
          } else {
            S.fc.delete(fid);
          }
          if (i % 2 === 0) {
            ((U.$("expBar").style.width = ((i + 1) / tFrames) * 100 + "%"),
              (U.$("expMsg").textContent =
                `映像を変換中... ${i + 1}/${tFrames}コマ`));
            await new Promise((r) => requestAnimationFrame(r));
          }
        }
        (URL.revokeObjectURL(v.src), (S.cf = 0));
        await E.ensureCached(E.curId());
        (E.cacheToCanvas(E.curId()),
          TL.renderTL(),
          UI.updateFrameInfo && UI.updateFrameInfo(),
          E.toast("インポート完了"));
      } catch (err) {
        (console.error(err), E.toast("インポート中にエラーが発生しました"));
      } finally {
        (mo.classList.remove("show"), (U.$("videoInput").value = ""));
      }
    }),
    (U.$("clearAllBtn").onclick = () => {
      if (window.confirm("すべてのレイヤーとコマを本当に削除しますか？")) {
        ST.clearAll();
      }
    }),
    (U.$("expGifBtn").onclick = () => EX.exportGIF("mid")),
    (U.$("expFrameBtn").onclick = () => EX.exportCurrentFrame()),
    (U.$("expSvgBtn").onclick = () => EX.exportSVG()),
    (U.$("expMp4Btn").onclick = () => EX.exportVideo("mid")),
    (U.$("expPngBtn").onclick = () => EX.exportPNGSequence("mid")),
    (U.$("undoBtn").onclick = () => E.undo()),
    (U.$("redoBtn").onclick = () => E.redo()),
    U.$$("[data-tool]").forEach((b) => {
      b.onclick = () => {
        (U.$$(".dock-tool").forEach((t) => t.classList.remove("on")),
          b.classList.add("on"),
          (S.ct = b.dataset.tool),
          "cpEdit" === S.ct
            ? ((S.cpMode = !S.cpMode),
              b.classList.toggle("on", S.cpMode),
              T.drawControlPointOverlay())
            : ((S.cpMode = !1),
              R.contexts.cursorC.clearRect(0, 0, S.CW, S.CH)));
      };
    }),
    ["navCanvas", "navMenu", "navTimeline"].forEach((id) => {
      U.$(id).onclick = () => UI.showPage(id.replace("nav", "").toLowerCase());
    }));
  const mxBtn = U.$("mixerBtn");
  (mxBtn && (mxBtn.onclick = () => UI.openMixer()),
    UI.setupMixerEvents && UI.setupMixerEvents(),
    (U.$("audioBtn").onclick = () => U.$("audioModal").classList.add("show")),
    (U.$("bgmFile").onchange = async (e) => {
      const f = e.target.files[0];
      (f && (await A.loadBGM(f)), (e.target.value = ""));
    }),
    (U.$("bgmVolRange").oninput = (e) => {
      (A.setBGMVolume(+e.target.value / 100),
        (U.$("bgmVolLabel").textContent = e.target.value + "%"));
    }),
    (U.$("sfxVolRange").oninput = (e) => {
      (A.setSFXVolume(+e.target.value / 100),
        (U.$("sfxVolLabel").textContent = e.target.value + "%"));
    }),
    (U.$("clearAudioBtn").onclick = () => {
      (A.clearBGM(), E.toast("BGMを消去しました"));
    }),
    (U.$("prevAudioBtn").onclick = () => {
      A.bgmBuffer && A.playBGM(0, S.fps);
    }),
    (U.$("recSyncBtn").onclick = async () => {
      S.recWhilePlaying ? TL.stop() : (await A.startSyncRecord()) && TL.play();
    }),
    (U.$("sfxPreviewBtn").onclick = () => {
      const n = U.$("sfxSelect").value;
      n && A.playSFX(n);
    }),
    (U.$("sfxAssignBtn").onclick = () => {
      ((E.curFr().sfx = U.$("sfxSelect").value),
        E.toast("SFX: " + (E.curFr().sfx || "なし")));
    }),
    (U.$("ratioConfOk").onclick = () => {
      const r = S._pendingRatio;
      r &&
        (U.$("ratioConfirmModal").classList.remove("show"),
          (S.CW = r.w),
          (S.CH = r.h),
          (S.ratio = r.name),
          (S.frames = [E.mkFrame()]),
          (S.cf = 0),
          S.fc.clear(),
          G.Thumbs.clear(),
          (S.undoStack = []),
          (S.redoStack = []),
          S.dirtyIds.clear(),
          S.dirtyLayers.clear(),
          S.vectorPaths.clear(),
          (S.lruOrder = []),
          R.initCanvases(S.CW, S.CH),
          E.updateTransform(),
          E.updatePaperColor(),
          E.updateLayerZOrder(),
          E.snapToCache(),
          E.markAllDirty(E.curId()),
          E.fitView(),
          TL.renderTL(),
          UI.updateFrameInfo && UI.updateFrameInfo(),
          U.$("ratioBadge") && (U.$("ratioBadge").textContent = r.name),
          E.toast("画面比率: " + r.name));
    }),
    (U.$("ratioConfNo").onclick = () =>
      U.$("ratioConfirmModal").classList.remove("show")));
  const ptrs = new Map();
  let pinch = null,
    drawPtrId = null,
    imgDrag = !1,
    lastPixelX = -1,
    lastPixelY = -1,
    tfDrag = !1,
    tfStartX = 0,
    tfStartY = 0,
    tfHandle = null;
  const getPinch = () => {
    const vs = [...ptrs.values()];
    return vs.length < 2
      ? null
      : {
        dist: Math.hypot(vs[0].x - vs[1].x, vs[0].y - vs[1].y),
        mx: (vs[0].x + vs[1].x) / 2,
        my: (vs[0].y + vs[1].y) / 2,
      };
  },
    cancelDraw = () => {
      if (S.drawing) {
        ((S.drawing = !1), (S.pts = []));
        const dpr = C.DPR;
        (R.contexts.strokeC.save(),
          R.contexts.strokeC.setTransform(1, 0, 0, 1, 0, 0),
          R.contexts.strokeC.clearRect(0, 0, S.CW * dpr, S.CH * dpr),
          R.contexts.strokeC.restore(),
          R.contexts.strokeC.setTransform(dpr, 0, 0, dpr, 0, 0),
          R.contexts.drC.clearRect(0, 0, S.CW, S.CH),
          (S.eSnap = null));
      }
      drawPtrId = null;
    },
    vp = U.$("viewport");
  (vp.addEventListener("pointerdown", (e) => {
    if (
      e.target.closest(".img-hud") ||
      e.target.closest(".zoom-cluster") ||
      e.target.closest(".sel-zoom-btn") ||
      e.target.closest(".hud-badge")
    )
      return;
    if (S.playing) return;
    if (
      (e.preventDefault(),
        vp.setPointerCapture(e.pointerId),
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }),
        ptrs.size >= 2)
    ) {
      (cancelDraw(), (imgDrag = !1));
      const pi = getPinch();
      return void (pinch = S.img
        ? {
          mode: "img",
          dist0: pi.dist,
          sc0: S.img.sc,
          mx0: pi.mx,
          my0: pi.my,
          ix0: S.img.x,
          iy0: S.img.y,
        }
        : S.transformMode && S.transformData
          ? {
            mode: "transform",
            dist0: pi.dist,
            sx0: S.transformData.scaleX,
            sy0: S.transformData.scaleY,
            mx0: pi.mx,
            my0: pi.my,
            tx0: S.transformData.x,
            ty0: S.transformData.y,
          }
          : {
            mode: "canvas",
            dist0: pi.dist,
            zoom0: S.zoom,
            px0: S.panX,
            py0: S.panY,
            mx0: pi.mx,
            my0: pi.my,
          });
    }
    drawPtrId = e.pointerId;
    const pt = R.screenToCanvas(e.clientX, e.clientY, S);
    if (((pt.p = e.pressure || 0.5), S.transformMode && S.transformData)) {
      ((tfDrag = !0), (tfStartX = pt.x), (tfStartY = pt.y));
      const td = S.transformData,
        dw = td.w * td.scaleX,
        dh = td.h * td.scaleY,
        dx = pt.x - td.x,
        dy = pt.y - td.y,
        hr = 10 / S.zoom,
        handles = [
          { name: "tl", hx: -dw / 2, hy: -dh / 2 },
          { name: "tr", hx: dw / 2, hy: -dh / 2 },
          { name: "bl", hx: -dw / 2, hy: dh / 2 },
          { name: "br", hx: dw / 2, hy: dh / 2 },
          { name: "t", hx: 0, hy: -dh / 2 },
          { name: "b", hx: 0, hy: dh / 2 },
          { name: "l", hx: -dw / 2, hy: 0 },
          { name: "r", hx: dw / 2, hy: 0 },
        ];
      tfHandle = null;
      for (const h of handles)
        if (Math.abs(dx - h.hx) < hr && Math.abs(dy - h.hy) < hr) {
          tfHandle = h.name;
          break;
        }
      return;
    }
    if (S.img) return ((imgDrag = !0), (S.lx = pt.x), void (S.ly = pt.y));
    if (
      ((S.lx = pt.x),
        (S.ly = pt.y),
        (S.sx = pt.x),
        (S.sy = pt.y),
        1 === e.button || "hand" === S.ct)
    )
      return ((S.panning = !0), (S.lx = e.clientX), void (S.ly = e.clientY));
    if (S.cpMode && VP) {
      const hit = VP.hitTestCP(E.curId(), S.cl, pt.x, pt.y, S.zoom);
      return void (hit
        ? ((S.cpSelectedPath = hit.pathId),
          (S.cpSelectedPoint = hit.ptIdx),
          (S.cpDragging = !0),
          T.drawControlPointOverlay())
        : ((S.cpSelectedPath = null),
          (S.cpSelectedPoint = -1),
          T.drawControlPointOverlay()));
    }
    if ("eyedrop" === S.ct) {
      const hex = T.eyedrop(pt.x, pt.y);
      return void (
        hex &&
        ((S.cc = hex),
          (U.$("customColor").value = hex),
          U.$$(".color-swatch").forEach((c) => c.classList.remove("on")),
          U.$$(".qc").forEach((c) => c.classList.remove("on")),
          T.drawEyedropPreview(pt.x, pt.y, hex),
          E.toast("色: " + hex))
      );
    }
    if ("paste" !== S.ct) {
      if ("fill" === S.ct) return (E.pushUndo(), void T.floodFill(pt.x, pt.y));
      if ("text" === S.ct)
        return (
          (S.txX = pt.x),
          (S.txY = pt.y),
          U.$("textModal").classList.add("show"),
          U.$("textInput").focus(),
          ptrs.delete(e.pointerId),
          void vp.releasePointerCapture(e.pointerId)
        );
      if ("pixel" === S.ct)
        return (
          E.pushUndo(),
          T.drawPixel(pt.x, pt.y),
          (lastPixelX = pt.x),
          (lastPixelY = pt.y),
          void (S.drawing = !0)
        );
      ((S.drawing = !0),
        "pen" === S.ct
          ? (E.pushUndo(),
            (S.pts = [pt]),
            T.drawPenStroke(),
            (R.canvases.strokeC.style.opacity = S.alpha))
          : "eraser" === S.ct
            ? ((S.pts = [pt]), T.drawEraserPreview())
            : "select" === S.ct
              ? (S.sel = { x: pt.x, y: pt.y, w: 0, h: 0 })
              : "lasso" === S.ct
                ? ((S.lassoPath = [pt]),
                  U.$("lassoPath").setAttribute("d", `M${pt.x},${pt.y}`))
                : ["line", "rect", "circle", "star", "heart"].includes(S.ct) &&
                (E.pushUndo(), R.contexts.drC.clearRect(0, 0, S.CW, S.CH)));
    } else T.pasteAt(pt.x, pt.y);
  }),
    vp.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return;
      if (
        (ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }),
          1 === ptrs.size && !S.drawing && !tfDrag)
      ) {
        const pt = R.screenToCanvas(e.clientX, e.clientY, S);
        if (S.cpMode) T.drawCursor(pt.x, pt.y);
        else if ("eyedrop" === S.ct) {
          const hex = T.eyedrop(pt.x, pt.y);
          T.drawEyedropPreview(pt.x, pt.y, hex);
        } else T.drawCursor(pt.x, pt.y);
      }
      if (ptrs.size >= 2 && pinch) {
        e.preventDefault();
        const pi = getPinch();
        if (!pi) return;
        if ("img" === pinch.mode && S.img) {
          S.img.sc = U.clamp(pinch.sc0 * (pi.dist / pinch.dist0), 0.05, 5);
          const r = U.$("cw").getBoundingClientRect();
          ((S.img.x = pinch.ix0 + (pi.mx - pinch.mx0) * (S.CW / r.width)),
            (S.img.y = pinch.iy0 + (pi.my - pinch.my0) * (S.CH / r.height)),
            T.drawImagePreview());
        } else if ("transform" === pinch.mode && S.transformData) {
          const td = S.transformData;
          ((td.scaleX = U.clamp(pinch.sx0 * (pi.dist / pinch.dist0), 0.1, 10)),
            (td.scaleY = U.clamp(
              pinch.sy0 * (pi.dist / pinch.dist0),
              0.1,
              10,
            )));
          const r = U.$("cw").getBoundingClientRect();
          ((td.x = pinch.tx0 + (pi.mx - pinch.mx0) * (S.CW / r.width)),
            (td.y = pinch.ty0 + (pi.my - pinch.my0) * (S.CH / r.height)),
            T.drawTransformPreview());
        } else
          "canvas" === pinch.mode &&
            ((S.zoom = U.clamp(
              pinch.zoom0 * (pi.dist / pinch.dist0),
              C.MIN_ZOOM,
              C.MAX_ZOOM,
            )),
              (S.panX = pinch.px0 + (pi.mx - pinch.mx0)),
              (S.panY = pinch.py0 + (pi.my - pinch.my0)),
              E.updateTransform());
        return;
      }
      if (e.pointerId !== drawPtrId) return;
      if (S.transformMode && tfDrag && S.transformData) {
        const pt = R.screenToCanvas(e.clientX, e.clientY, S),
          td = S.transformData;
        if (tfHandle) {
          const dx = pt.x - tfStartX,
            dy = pt.y - tfStartY;
          (("br" !== tfHandle && "tr" !== tfHandle && "r" !== tfHandle) ||
            (td.scaleX = U.clamp(td.scaleX + dx / td.w, 0.1, 10)),
            ("bl" !== tfHandle && "tl" !== tfHandle && "l" !== tfHandle) ||
            (td.scaleX = U.clamp(td.scaleX - dx / td.w, 0.1, 10)),
            ("br" !== tfHandle && "bl" !== tfHandle && "b" !== tfHandle) ||
            (td.scaleY = U.clamp(td.scaleY + dy / td.h, 0.1, 10)),
            ("tr" !== tfHandle && "tl" !== tfHandle && "t" !== tfHandle) ||
            (td.scaleY = U.clamp(td.scaleY - dy / td.h, 0.1, 10)),
            (tfStartX = pt.x),
            (tfStartY = pt.y));
        } else
          ((td.x += pt.x - tfStartX),
            (td.y += pt.y - tfStartY),
            (tfStartX = pt.x),
            (tfStartY = pt.y));
        return void T.drawTransformPreview();
      }
      if (S.cpMode && S.cpDragging && VP) {
        const pt = R.screenToCanvas(e.clientX, e.clientY, S);
        return (
          VP.moveCP(
            E.curId(),
            S.cl,
            S.cpSelectedPath,
            S.cpSelectedPoint,
            pt.x,
            pt.y,
          ),
          E.redrawSingleVectorLayer(E.curId(), S.cl),
          void T.drawControlPointOverlay()
        );
      }
      if (S.img && imgDrag) {
        const pt = R.screenToCanvas(e.clientX, e.clientY, S);
        return (
          (S.img.x += pt.x - S.lx),
          (S.img.y += pt.y - S.ly),
          (S.lx = pt.x),
          (S.ly = pt.y),
          void T.drawImagePreview()
        );
      }
      if (S.panning)
        return (
          (S.panX += e.clientX - S.lx),
          (S.panY += e.clientY - S.ly),
          (S.lx = e.clientX),
          (S.ly = e.clientY),
          void E.updateTransform()
        );
      const pt = R.screenToCanvas(e.clientX, e.clientY, S);
      if (((pt.p = e.pressure || 0.5), "paste" === S.ct && S.clip))
        return (
          R.contexts.floatC.clearRect(0, 0, S.CW, S.CH),
          (R.contexts.floatC.globalAlpha = 0.5),
          R.contexts.floatC.drawImage(
            S.clip,
            pt.x - S.clip.width / 2,
            pt.y - S.clip.height / 2,
          ),
          void (R.contexts.floatC.globalAlpha = 1)
        );
      if (S.drawing) {
        if ("pixel" === S.ct)
          return (
            T.drawPixelLine(lastPixelX, lastPixelY, pt.x, pt.y, !1),
            (lastPixelX = pt.x),
            (lastPixelY = pt.y),
            void T.drawCursor(pt.x, pt.y)
          );
        if ("pen" === S.ct) (S.pts.push(pt), T.drawPenStroke());
        else if ("eraser" === S.ct) (S.pts.push(pt), T.drawEraserPreview());
        else if (["line", "rect", "circle", "star", "heart"].includes(S.ct))
          T.drawShapePreview(pt);
        else if ("select" === S.ct && S.sel) {
          ((S.sel.w = pt.x - S.sel.x), (S.sel.h = pt.y - S.sel.y));
          const sb = U.$("selBox");
          sb.style.display = "block";
          const x = Math.min(S.sel.x, S.sel.x + S.sel.w),
            y = Math.min(S.sel.y, S.sel.y + S.sel.h);
          ((sb.style.left = (x / S.CW) * 100 + "%"),
            (sb.style.top = (y / S.CH) * 100 + "%"),
            (sb.style.width = (Math.abs(S.sel.w) / S.CW) * 100 + "%"),
            (sb.style.height = (Math.abs(S.sel.h) / S.CH) * 100 + "%"));
        } else if ("lasso" === S.ct) {
          S.lassoPath.push(pt);
          let d = "M" + S.lassoPath[0].x + "," + S.lassoPath[0].y;
          for (let i = 1; i < S.lassoPath.length; i++)
            d += "L" + S.lassoPath[i].x + "," + S.lassoPath[i].y;
          U.$("lassoPath").setAttribute("d", d);
        }
      }
    }),
    vp.addEventListener("pointerup", function (e) {
      if (
        (ptrs.delete(e.pointerId),
          ptrs.size < 2 && (pinch = null),
          e.pointerId === drawPtrId)
      ) {
        if (((drawPtrId = null), S.transformMode && tfDrag))
          return ((tfDrag = !1), void (tfHandle = null));
        if (S.cpMode && S.cpDragging)
          return (
            (S.cpDragging = !1),
            E.snapToCache(),
            E.markDirty(E.curId(), S.cl),
            (E.curFr().thumbDirty = !0),
            void E.afterEdit()
          );
        if (imgDrag) imgDrag = !1;
        else if (S.panning) S.panning = !1;
        else if ("eyedrop" !== S.ct) {
          if (S.drawing) {
            if (((S.drawing = !1), "pixel" === S.ct))
              return (
                (lastPixelX = -1),
                (lastPixelY = -1),
                E.commitUndo(),
                void E.afterEdit()
              );
            if ("pen" === S.ct)
              (T.commitPenStroke(),
                (S.pts = []),
                E.commitUndo(),
                E.afterEdit());
            else if ("eraser" === S.ct)
              (T.commitEraser(),
                (S.pts = []),
                E.snapToCache(),
                E.markDirty(E.curId(), S.cl),
                (E.curFr().thumbDirty = !0),
                G.Timeline && G.Timeline.renderDebounced(),
                G.Storage && G.Storage.debounceSave());
            else if (
              ["line", "rect", "circle", "star", "heart"].includes(S.ct)
            ) {
              const pt = R.screenToCanvas(e.clientX, e.clientY, S);
              C.DPR;
              (R.contexts.drC.clearRect(0, 0, S.CW, S.CH),
                T.commitShape(pt),
                E.commitUndo(),
                E.afterEdit());
            } else {
              if ("select" === S.ct && S.sel)
                return (
                  S.sel.w < 0 && ((S.sel.x += S.sel.w), (S.sel.w *= -1)),
                  S.sel.h < 0 && ((S.sel.y += S.sel.h), (S.sel.h *= -1)),
                  void (S.sel.w > 2 && S.sel.h > 2
                    ? (U.$("selModal").classList.add("show"),
                      UI.showSelZoomBtn && UI.showSelZoomBtn(!0))
                    : ((S.sel = null),
                      (U.$("selBox").style.display = "none"),
                      UI.showSelZoomBtn && UI.showSelZoomBtn(!1)))
                );
              if ("lasso" === S.ct && S.lassoPath.length > 4) {
                const pts = S.lassoPath,
                  mnx = Math.max(
                    0,
                    Math.floor(Math.min(...pts.map((p) => p.x))),
                  ),
                  mny = Math.max(
                    0,
                    Math.floor(Math.min(...pts.map((p) => p.y))),
                  ),
                  mxx = Math.min(
                    S.CW,
                    Math.ceil(Math.max(...pts.map((p) => p.x))),
                  ),
                  mxy = Math.min(
                    S.CH,
                    Math.ceil(Math.max(...pts.map((p) => p.y))),
                  );
                return void (mxx - mnx > 2 && mxy - mny > 2
                  ? ((S.sel = {
                    x: mnx,
                    y: mny,
                    w: mxx - mnx,
                    h: mxy - mny,
                    lasso: pts,
                  }),
                    U.$("selModal").classList.add("show"),
                    UI.showSelZoomBtn && UI.showSelZoomBtn(!0))
                  : (U.$("lassoPath").setAttribute("d", ""),
                    (S.lassoPath = [])));
              }
            }
            ((E.curX().globalCompositeOperation = "source-over"),
              (E.curX().globalAlpha = 1));
          }
        } else R.contexts.cursorC.clearRect(0, 0, S.CW, S.CH);
      }
    }),
    vp.addEventListener("pointercancel", (e) => {
      (ptrs.delete(e.pointerId),
        ptrs.size < 2 && (pinch = null),
        e.pointerId === drawPtrId && cancelDraw());
    }),
    vp.addEventListener(
      "wheel",
      (e) => {
        if ((e.preventDefault(), S.img))
          ((S.img.sc = U.clamp(
            S.img.sc * (e.deltaY > 0 ? 0.92 : 1.08),
            0.05,
            5,
          )),
            T.drawImagePreview());
        else if (S.transformMode && S.transformData) {
          const td = S.transformData,
            angle = e.deltaY > 0 ? 5 : -5;
          ((td.rotation += angle), T.drawTransformPreview());
        } else {
          const factor = e.deltaY > 0 ? 0.9 : 1.1;
          E.zoomAtPoint(factor, e.clientX, e.clientY);
        }
      },
      { passive: !1 },
    ),
    vp.addEventListener("dblclick", (e) => {
      e.target.closest(".img-hud") ||
        e.target.closest(".zoom-cluster") ||
        e.target.closest(".sel-zoom-btn") ||
        e.target.closest(".hud-badge") ||
        (S.img && T.commitImage(), S.transformMode && T.commitTransform());
    }),
    vp.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const cm = U.$("ctxMenu");
      ((cm.style.left = Math.min(e.clientX, innerWidth - 180) + "px"),
        (cm.style.top = Math.min(e.clientY, innerHeight - 150) + "px"),
        cm.classList.add("show"));
    }),
    document.addEventListener("click", (e) => {
      e.target.closest(".ctx-menu") || U.$("ctxMenu").classList.remove("show");
    }),
    U.$$("[data-ctx]").forEach((it) => {
      it.onclick = () => {
        U.$("ctxMenu").classList.remove("show");
        const a = it.dataset.ctx;
        "undo" === a
          ? E.undo()
          : "redo" === a
            ? E.redo()
            : "paste" === a && S.clip
              ? ((S.ct = "paste"),
                U.$$("[data-tool]").forEach((b) => b.classList.remove("on")),
                E.toast("貼り付けモード"))
              : "clear" === a
                ? (E.pushUndo(),
                  E.curX().clearRect(0, 0, S.CW, S.CH),
                  E.commitUndo(),
                  E.afterEdit(),
                  E.toast("レイヤー消去"))
                : "eyedrop" === a &&
                ((S.ct = "eyedrop"),
                  U.$$(".dock-tool").forEach((b) =>
                    b.classList.toggle("on", "eyedrop" === b.dataset.tool),
                  ),
                  E.toast("スポイト"));
      };
    }),
    (U.$("selCopyBtn").onclick = () => T.selectionAction("copy")),
    (U.$("selCutBtn").onclick = () => T.selectionAction("cut")),
    (U.$("selTransformBtn").onclick = () => T.selectionAction("transform")),
    (U.$("selCancelBtn").onclick = () => {
      (U.$("selModal").classList.remove("show"),
        (S.sel = null),
        (U.$("selBox").style.display = "none"),
        U.$("lassoPath").setAttribute("d", ""),
        (S.lassoPath = []),
        UI.showSelZoomBtn && UI.showSelZoomBtn(!1));
    }),
    (U.$("tfOk").onclick = () => T.commitTransform()),
    (U.$("tfCn").onclick = () => T.cancelTransform()),
    (U.$("tfRotL").onclick = () => {
      S.transformData &&
        ((S.transformData.rotation -= 15), T.drawTransformPreview());
    }),
    (U.$("tfRotR").onclick = () => {
      S.transformData &&
        ((S.transformData.rotation += 15), T.drawTransformPreview());
    }));
  const selZoomBtn = U.$("selZoomBtn");
  selZoomBtn && (selZoomBtn.onclick = () => UI.zoomToSelection());
  const selZoomModalBtn = U.$("selZoomModalBtn");
  (selZoomModalBtn && (selZoomModalBtn.onclick = () => UI.zoomToSelection()),
    (U.$("textOk").onclick = () => {
      const t = U.$("textInput").value;
      if (t) {
        E.pushUndo();
        const ctx = E.curX(),
          bold = U.$("textBold").checked ? "bold " : "";
        ((ctx.font = `${bold}${S.txFs}px 'M PLUS Rounded 1c',sans-serif`),
          (ctx.globalAlpha = S.alpha),
          (ctx.textBaseline = "top"),
          U.$("textOutline").checked &&
          ((ctx.strokeStyle = U.$("textOutColor").value),
            (ctx.lineWidth = +U.$("textOutWidth").value),
            (ctx.lineJoin = "round"),
            (ctx.miterLimit = 2),
            ctx.strokeText(t, S.txX, S.txY)),
          (ctx.fillStyle = S.cc),
          ctx.fillText(t, S.txX, S.txY),
          (ctx.globalAlpha = 1),
          E.commitUndo(),
          E.afterEdit());
      }
      (U.$("textModal").classList.remove("show"),
        (U.$("textInput").value = ""));
    }),
    (U.$("textCancel").onclick = () =>
      U.$("textModal").classList.remove("show")),
    (U.$("textSize").oninput = (e) => {
      ((S.txFs = +e.target.value),
        (U.$("textSizeLabel").textContent = e.target.value + "px"));
    }),
    (U.$("textOutline").onchange = (e) => {
      U.$("textOutlineOpts").style.display = e.target.checked ? "flex" : "none";
    }),
    (U.$("textOutWidth").oninput = (e) => {
      U.$("textOutWidthLabel").textContent = e.target.value + "px";
    }),
    (U.$("imgOk").onclick = () => T.commitImage()),
    (U.$("imgCn").onclick = () => T.cancelImage()),
    (U.$("addPhotoBtn").onclick = () => U.$("imgInput").click()),
    (U.$("imgInput").onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const img = new Image();
      ((img.onload = () => T.startImagePlace(img)),
        (img.src = URL.createObjectURL(f)),
        (U.$("imgInput").value = ""));
    }),
    U.$$(".color-swatch").forEach((c) => {
      c.onclick = () => {
        (U.$$(".color-swatch").forEach((x) => x.classList.remove("on")),
          c.classList.add("on"),
          (S.cc = c.dataset.c),
          U.$$(".qc").forEach((q) => q.classList.remove("on")),
          U.$$(".qc").forEach((q) => {
            q.dataset.c === S.cc && q.classList.add("on");
          }));
      };
    }),
    U.$$(".qc").forEach((c) => {
      c.onclick = () => {
        (U.$$(".qc").forEach((x) => x.classList.remove("on")),
          c.classList.add("on"),
          (S.cc = c.dataset.c),
          U.$$(".color-swatch").forEach((x) => x.classList.remove("on")),
          U.$$(".color-swatch").forEach((x) => {
            x.dataset.c === S.cc && x.classList.add("on");
          }));
      };
    }),
    (U.$("customColor").oninput = (e) => {
      ((S.cc = e.target.value),
        U.$$(".color-swatch").forEach((x) => x.classList.remove("on")),
        U.$$(".qc").forEach((x) => x.classList.remove("on")));
    }),
    U.$$(".size-dot").forEach((b) => {
      b.onclick = () => {
        (U.$$(".size-dot").forEach((x) => x.classList.remove("on")),
          b.classList.add("on"),
          (S.cs = +b.dataset.size),
          U.$$(".qs").forEach((x) =>
            x.classList.toggle("on", +x.dataset.size === S.cs),
          ));
      };
    }),
    U.$$(".qs").forEach((b) => {
      b.onclick = () => {
        (U.$$(".qs").forEach((x) => x.classList.remove("on")),
          b.classList.add("on"),
          (S.cs = +b.dataset.size),
          U.$$(".size-dot").forEach((x) =>
            x.classList.toggle("on", +x.dataset.size === S.cs),
          ));
      };
    }),
    (U.$("alphaRange").oninput = (e) => {
      ((S.alpha = +e.target.value / 100),
        (U.$("alphaLabel").textContent = e.target.value + "%"));
    }),
    (U.$("smoothRange").oninput = (e) => {
      ((S.penSmooth = +e.target.value),
        (U.$("smoothLabel").textContent = e.target.value));
    }),
    (U.$("outlineCheck").onchange = (e) => {
      ((S.penOut = e.target.checked),
        U.$("outlineOpts").classList.toggle("hide", !S.penOut),
        U.$("outlineToggle").classList.toggle("on", S.penOut));
    }),
    (U.$("outlineColor").oninput = (e) => {
      S.penOutC = e.target.value;
    }),
    (U.$("outlineWidth").oninput = (e) => {
      S.penOutW = +e.target.value;
    }),
    (U.$("fillCheck").onchange = (e) => {
      ((S.shapeFill = e.target.checked),
        U.$("fillToggle").classList.toggle("on", e.target.checked));
    }),
    (U.$("pressureCheck").onchange = (e) => {
      ((S.pressure = e.target.checked),
        U.$("pressureToggle").classList.toggle("on", e.target.checked));
    }),
    (U.$("pixelModeCheck").onchange = (e) => {
      ((S.pixelMode = e.target.checked),
        U.$("pixelModeToggle").classList.toggle("on", e.target.checked),
        E.updateGrid(),
        E.updateTransform());
    }),
    (U.$("pixelSizeRange").oninput = (e) => {
      ((S.pixelSize = +e.target.value),
        (U.$("pixelSizeLabel").textContent = e.target.value + "px"),
        S.grid && E.updateGrid());
    }),
    U.$$("[data-sym]").forEach((b) => {
      b.onclick = () => {
        (U.$$("[data-sym]").forEach((x) => x.classList.remove("on")),
          b.classList.add("on"),
          (S.symmetry = b.dataset.sym),
          E.toast("対称: " + b.textContent));
      };
    }),
    (U.$("onionBtn").onclick = () => {
      ((S.onion = !S.onion),
        U.$("onionBtn").classList.toggle("on", S.onion),
        E.updateOnion(),
        E.toast(S.onion ? "オニオンスキン ON" : "オニオンスキン OFF"));
    }),
    (U.$("gridBtn").onclick = () => {
      ((S.grid = !S.grid),
        U.$("gridBtn").classList.toggle("on", S.grid),
        E.updateGrid(),
        E.toast(S.grid ? "グリッド ON" : "グリッド OFF"));
    }),
    (U.$("paperBtn").onclick = () => U.$("paperModal").classList.add("show")),
    (U.$("ratioBtn").onclick = () => U.$("ratioModal").classList.add("show")),
    U.$$(".paper-opt").forEach((o) => {
      o.onclick = () => {
        (U.$$(".paper-opt").forEach((x) => x.classList.remove("on")),
          o.classList.add("on"),
          (S.pc = o.dataset.p),
          E.updatePaperColor());
      };
    }),
    (U.$("rotateBtn").onclick = () => U.$("rotateModal").classList.add("show")),
    U.$$("[data-rot]").forEach((b) => {
      b.onclick = () => {
        (T.rotateLayer(+b.dataset.rot),
          U.$("rotateModal").classList.remove("show"));
      };
    }),
    (U.$("rotCustomBtn").onclick = () => {
      (T.rotateLayer(+U.$("rotAngle").value),
        U.$("rotateModal").classList.remove("show"));
    }),
    (U.$("flipHBtn").onclick = () => T.flipLayer("h")),
    (U.$("flipVBtn").onclick = () => T.flipLayer("v")),
    (U.$("mergeBtn").onclick = () => U.$("mergeModal").classList.add("show")),
    (U.$("mergeDownBtn").onclick = () => {
      if ("Photo" === S.cl) return E.toast("写真レイヤーは結合できません");
      const idx = S.layerOrder.indexOf(S.cl);
      if (idx <= 0) return E.toast("下にレイヤーがありません");
      (E.pushUndo(),
        E.flattenLayerToRaster(E.curId(), S.cl),
        E.getLayerCtx(S.layerOrder[idx - 1]).drawImage(E.curC(), 0, 0),
        E.curX().clearRect(0, 0, S.CW, S.CH),
        E.commitUndo(),
        E.afterEdit(),
        U.$("mergeModal").classList.remove("show"),
        E.toast("下に結合しました"));
    }),
    (U.$("mergeAllBtn").onclick = () => {
      (E.pushUndo(),
        ["A", "B", "C"].forEach((l) => E.flattenLayerToRaster(E.curId(), l)));
      const tmp = document.createElement("canvas");
      ((tmp.width = S.CW), (tmp.height = S.CH));
      const tc = tmp.getContext("2d");
      (S.layerOrder.forEach((l) => tc.drawImage(E.getLayerCanvas(l), 0, 0)),
        E.getLayerCtx("A").clearRect(0, 0, S.CW, S.CH),
        E.getLayerCtx("A").drawImage(tmp, 0, 0),
        E.getLayerCtx("B").clearRect(0, 0, S.CW, S.CH),
        E.getLayerCtx("C").clearRect(0, 0, S.CW, S.CH),
        E.commitUndo(),
        E.snapToCache(),
        E.markAllDirty(E.curId()),
        (E.curFr().thumbDirty = !0),
        TL.renderDebounced(),
        U.$("mergeModal").classList.remove("show"),
        E.toast("すべてAに結合しました"));
    }),
    (U.$("flattenVecBtn").onclick = () => {
      (E.flattenLayerToRaster(E.curId(), S.cl),
        E.snapToCache(),
        E.markDirty(E.curId(), S.cl),
        (E.curFr().thumbDirty = !0),
        TL.renderDebounced(),
        U.$("mergeModal").classList.remove("show"),
        E.toast("ベクターを焼き付けました"));
    }),
    (U.$("zoomInBtn").onclick = () => {
      ((S.zoom = Math.min(C.MAX_ZOOM, 1.25 * S.zoom)), E.updateTransform());
    }),
    (U.$("zoomOutBtn").onclick = () => {
      ((S.zoom = Math.max(C.MIN_ZOOM, S.zoom / 1.25)), E.updateTransform());
    }),
    (U.$("fitViewBtn").onclick = E.fitView),
    (U.$("playBtn").onclick = () => TL.play()),
    (U.$("stopBtn").onclick = () => TL.stop()));
  const tlPlayBtn = U.$("tlPlayBtn");
  tlPlayBtn && (tlPlayBtn.onclick = () => TL.play());
  const tlStopBtn = U.$("tlStopBtn");
  (tlStopBtn && (tlStopBtn.onclick = () => TL.stop()),
    (U.$("prevFrBtn").onclick = () => {
      S.cf > 0 && TL.switchFrame(S.cf - 1);
    }),
    (U.$("nextFrBtn").onclick = () => {
      S.cf < S.frames.length - 1 && TL.switchFrame(S.cf + 1);
    }),
    (U.$("firstFBtn").onclick = () => {
      S.cf > 0 && TL.switchFrame(0);
    }),
    (U.$("lastFBtn").onclick = () => {
      S.cf < S.frames.length - 1 && TL.switchFrame(S.frames.length - 1);
    }),
    (U.$("prevFBtn").onclick = () => {
      S.cf > 0 && TL.switchFrame(S.cf - 1);
    }),
    (U.$("nextFBtn").onclick = () => {
      S.cf < S.frames.length - 1 && TL.switchFrame(S.cf + 1);
    }),
    (U.$("fpsRange").oninput = (e) => {
      S.fps = +e.target.value;
      const inp = U.$("fpsInputVal");
      (inp && (inp.value = S.fps), S.playing && (TL.stop(), TL.play()));
    }));
  const fpsInp = U.$("fpsInputVal");
  (fpsInp &&
    (fpsInp.onchange = (e) => {
      let n = U.clamp(parseInt(e.target.value) || 8, 1, 60);
      ((S.fps = n),
        (e.target.value = n),
        (U.$("fpsRange").value = n),
        S.playing && (TL.stop(), TL.play()));
    }),
    (U.$("frameCounter").onclick = () => {
      ((U.$("gotoNum").value = S.cf + 1),
        (U.$("gotoMax").textContent = S.frames.length),
        U.$("gotoModal").classList.add("show"),
        U.$("gotoNum").focus());
    }),
    (U.$("gotoOk").onclick = () => {
      const n = U.clamp(+U.$("gotoNum").value, 1, S.frames.length) - 1;
      (U.$("gotoModal").classList.remove("show"),
        n !== S.cf && TL.switchFrame(n));
    }),
    UI.initLoopToggle && UI.initLoopToggle(),
    UI.initScrubber && UI.initScrubber(),
    (U.$("addFrameBtn").onclick = () => TL.addFrame()),
    (U.$("dupFrameBtn").onclick = () => TL.duplicateFrame()),
    (U.$("delFrameBtn").onclick = () => TL.deleteFrame()));
  const tlAddBtn = U.$("tlAddBtn");
  tlAddBtn && (tlAddBtn.onclick = () => TL.addFrame());
  const tlDupBtn = U.$("tlDupBtn");
  tlDupBtn && (tlDupBtn.onclick = () => TL.duplicateFrame());
  const tlDelBtn = U.$("tlDelBtn");
  (tlDelBtn && (tlDelBtn.onclick = () => TL.deleteFrame()),
    (U.$("cpFrameBtn").onclick = () => {
      E.snapToCache();
      const c = S.fc.get(E.curId()),
        dpr = C.DPR,
        cl = {};
      (["A", "B", "C", "P"].forEach((k) => {
        cl[k] =
          c && c[k]
            ? new ImageData(
              new Uint8ClampedArray(c[k].data),
              S.CW * dpr,
              S.CH * dpr,
            )
            : null;
      }),
        (S.frClip = { cache: cl, sfx: E.curFr().sfx }),
        E.toast("コマをコピーしました"));
    }),
    (U.$("psFrameBtn").onclick = () => {
      if (!S.frClip) return E.toast("コピーされたコマがありません");
      const dpr = C.DPR,
        nf = E.mkFrame();
      nf.sfx = S.frClip.sfx;
      const nc = {};
      (["A", "B", "C", "P"].forEach((k) => {
        nc[k] = S.frClip.cache[k]
          ? new ImageData(
            new Uint8ClampedArray(S.frClip.cache[k].data),
            S.CW * dpr,
            S.CH * dpr,
          )
          : null;
      }),
        S.frames.splice(S.cf + 1, 0, nf),
        S.fc.set(nf.id, nc),
        S.cf++,
        E.cacheToCanvas(E.curId()),
        E.markAllDirty(nf.id),
        TL.renderTL(),
        E.toast("コマを貼り付けました"));
    }),
    (U.$("addManyBtn").onclick = () =>
      U.$("addManyModal").classList.add("show")),
    (U.$("addManyOk").onclick = () => {
      const n = U.clamp(+U.$("addManyNum").value, 1, 200);
      (U.$("addManyModal").classList.remove("show"), E.snapToCache());
      const dpr = C.DPR;
      for (let i = 0; i < n; i++) {
        const nf = E.mkFrame(),
          nc = { A: null, B: null, C: null, P: null },
          oc = S.fc.get(E.curId());
        (oc &&
          oc.P &&
          (nc.P = new ImageData(
            new Uint8ClampedArray(oc.P.data),
            S.CW * dpr,
            S.CH * dpr,
          )),
          S.frames.splice(S.cf + 1 + i, 0, nf),
          S.fc.set(nf.id, nc),
          E.markAllDirty(nf.id));
      }
      ((S.cf += n),
        E.ensureCached(E.curId()).then(() => E.cacheToCanvas(E.curId())),
        TL.renderTL(),
        E.toast(n + "コマ追加しました"));
    }),
    document.addEventListener("keydown", (e) => {
      if (
        "INPUT" !== e.target.tagName &&
        "SELECT" !== e.target.tagName &&
        "TEXTAREA" !== e.target.tagName
      ) {
        if (
          ((e.ctrlKey || e.metaKey) &&
            ("z" === e.key && (e.preventDefault(), E.undo()),
              "y" === e.key && (e.preventDefault(), E.redo()),
              "c" === e.key &&
              S.sel &&
              (e.preventDefault(), T.selectionAction("copy")),
              "v" === e.key &&
              S.clip &&
              (e.preventDefault(),
                (S.ct = "paste"),
                U.$$("[data-tool]").forEach((b) => b.classList.remove("on")),
                E.toast("貼り付けモード")),
              "s" === e.key && (e.preventDefault(), ST.saveProjectFile())),
            " " === e.key &&
            (e.preventDefault(), S.playing ? TL.stop() : TL.play()),
            "ArrowRight" === e.key &&
            !S.playing &&
            S.cf < S.frames.length - 1 &&
            TL.switchFrame(S.cf + 1),
            "ArrowLeft" === e.key &&
            !S.playing &&
            S.cf > 0 &&
            TL.switchFrame(S.cf - 1),
            "Home" === e.key && TL.switchFrame(0),
            "End" === e.key && TL.switchFrame(S.frames.length - 1),
            "Enter" === e.key &&
            (S.img && T.commitImage(), S.transformMode && T.commitTransform()),
            "Escape" === e.key)
        ) {
          if (S.transformMode) return void T.cancelTransform();
          (S.img && T.cancelImage(),
            S.cpMode &&
            ((S.cpMode = !1),
              (S.cpSelectedPath = null),
              R.contexts.cursorC.clearRect(0, 0, S.CW, S.CH),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "pen" === b.dataset.tool),
              ),
              (S.ct = "pen")),
            "paste" === S.ct &&
            (R.contexts.floatC.clearRect(0, 0, S.CW, S.CH),
              (S.ct = "pen"),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "pen" === b.dataset.tool),
              )));
        }
        if (
          (("b" !== e.key && "B" !== e.key) ||
            ((S.ct = "pen"),
              (S.cpMode = !1),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "pen" === b.dataset.tool),
              )),
            ("e" !== e.key && "E" !== e.key) ||
            ((S.ct = "eraser"),
              (S.cpMode = !1),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "eraser" === b.dataset.tool),
              )),
            ("g" !== e.key && "G" !== e.key) ||
            ((S.ct = "fill"),
              (S.cpMode = !1),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "fill" === b.dataset.tool),
              )),
            ("h" !== e.key && "H" !== e.key) ||
            ((S.ct = "hand"),
              (S.cpMode = !1),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "hand" === b.dataset.tool),
              )),
            ("i" !== e.key && "I" !== e.key) ||
            ((S.ct = "eyedrop"),
              (S.cpMode = !1),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "eyedrop" === b.dataset.tool),
              ),
              E.toast("スポイト")),
            ("d" !== e.key && "D" !== e.key) ||
            ((S.ct = "pixel"),
              (S.cpMode = !1),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "pixel" === b.dataset.tool),
              ),
              E.toast("ドット絵")),
            ("p" !== e.key && "P" !== e.key) ||
            ((S.cpMode = !S.cpMode),
              U.$$(".dock-tool").forEach((b) =>
                b.classList.toggle("on", "cpEdit" === b.dataset.tool && S.cpMode),
              ),
              S.cpMode
                ? (T.drawControlPointOverlay(), E.toast("制御点モード"))
                : (R.contexts.cursorC.clearRect(0, 0, S.CW, S.CH),
                  E.toast("制御点 OFF"))),
            "[" === e.key &&
            ((S.cs = Math.max(1, S.cs - 1)),
              U.$$(".size-dot").forEach((b) =>
                b.classList.toggle("on", +b.dataset.size === S.cs),
              )),
            "]" === e.key &&
            ((S.cs = Math.min(64, S.cs + 1)),
              U.$$(".size-dot").forEach((b) =>
                b.classList.toggle("on", +b.dataset.size === S.cs),
              )),
            "l" === e.key || "L" === e.key)
        ) {
          S.loopPlay = !S.loopPlay;
          const lb = U.$("loopToggle");
          (lb && lb.classList.toggle("on", S.loopPlay),
            E.toast(S.loopPlay ? "ループ ON" : "ループ OFF"));
        }
        ("1" === e.key && UI.showPage("canvas"),
          "2" === e.key && UI.showPage("menu"),
          "3" === e.key && UI.showPage("timeline"));
      }
    }),
    window.addEventListener("resize", () => {
      "canvas" === S.currentPage && E.fitView();
    }),
    window.addEventListener("beforeunload", (e) => {
      (E.snapToCache(),
        E.markAllDirty(E.curId()),
        ST.flushIDB(),
        S.modified && (e.preventDefault(), (e.returnValue = "")));
    }),
    "serviceWorker" in navigator &&
    navigator.serviceWorker.register("/static/js/sw.js").catch(() => { }),
    (async function () {
      (E.initEngine(),
        (await ST.restoreFromIDB()) ||
        ((S.frames = [E.mkFrame()]), E.snapToCache()),
        UI.buildLayerList(),
        TL.renderTL(),
        E.fitView(),
        UI.updateFrameInfo && UI.updateFrameInfo());
    })());
})();
