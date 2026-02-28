"use strict";
!(function (G) {
  const U = G.Utils,
    C = G.Config,
    S = G.State,
    E = G.Engine,
    DB = {
      db: null,
      NAME: "UgokuDrawV4",
      VER: 2,
      SF: "frames",
      SM: "meta",
      SP: "projects",
      async open() {
        return new Promise((res, rej) => {
          const r = indexedDB.open(this.NAME, this.VER);
          ((r.onupgradeneeded = (e) => {
            const d = e.target.result;
            (d.objectStoreNames.contains(this.SF) ||
              d.createObjectStore(this.SF),
              d.objectStoreNames.contains(this.SM) ||
                d.createObjectStore(this.SM),
              d.objectStoreNames.contains(this.SP) ||
                d.createObjectStore(this.SP));
          }),
            (r.onsuccess = () => {
              ((this.db = r.result), res());
            }),
            (r.onerror = () => rej(r.error)));
        });
      },
      async put(s, k, v) {
        if (this.db)
          return new Promise((res, rej) => {
            const t = this.db.transaction(s, "readwrite");
            (t.objectStore(s).put(v, k),
              (t.oncomplete = res),
              (t.onerror = () => rej(t.error)));
          });
      },
      async get(s, k) {
        return this.db
          ? new Promise((res, rej) => {
              const r = this.db
                .transaction(s, "readonly")
                .objectStore(s)
                .get(k);
              ((r.onsuccess = () => res(r.result)),
                (r.onerror = () => rej(r.error)));
            })
          : null;
      },
      async del(s, k) {
        if (this.db)
          return new Promise((res, rej) => {
            const t = this.db.transaction(s, "readwrite");
            (t.objectStore(s).delete(k),
              (t.oncomplete = res),
              (t.onerror = () => rej(t.error)));
          });
      },
      async clear(s) {
        if (this.db)
          return new Promise((res, rej) => {
            const t = this.db.transaction(s, "readwrite");
            (t.objectStore(s).clear(),
              (t.oncomplete = res),
              (t.onerror = () => rej(t.error)));
          });
      },
    };
  async function saveLayer(fid, layer, imgData) {
    const blob = await (async function (imgData) {
      if (!imgData) return null;
      try {
        if ("undefined" != typeof OffscreenCanvas) {
          const oc = new OffscreenCanvas(imgData.width, imgData.height);
          return (
            oc.getContext("2d").putImageData(imgData, 0, 0),
            await oc.convertToBlob({ type: "image/png" })
          );
        }
        const c = document.createElement("canvas");
        return (
          (c.width = imgData.width),
          (c.height = imgData.height),
          c.getContext("2d").putImageData(imgData, 0, 0),
          new Promise((r) => c.toBlob(r, "image/png"))
        );
      } catch (e) {
        return new Blob([imgData.data.buffer]);
      }
    })(imgData);
    blob
      ? await DB.put(DB.SF, fid + "_" + layer, blob)
      : await DB.del(DB.SF, fid + "_" + layer);
  }
  let saveTimer = null;
  async function flushIDB() {
    if (!DB.db || !S.dirtyIds.size) return;
    const ids = new Set(S.dirtyIds);
    S.dirtyIds.clear();
    const layers = new Map(S.dirtyLayers);
    S.dirtyLayers.clear();
    for (const fid of ids) {
      const c = S.fc.get(fid);
      if (!c) continue;
      const ls = layers.get(fid) || new Set(["A", "B", "C", "P"]);
      for (const l of ls)
        try {
          await saveLayer(fid, l, c[l]);
        } catch (e) {}
    }
    const vectorData = {};
    S.frames.forEach((f) => {
      if (G.VectorPaths) {
        const vd = G.VectorPaths.serializePaths(f.id);
        Object.keys(vd).length > 0 && (vectorData[f.id] = vd);
      }
    });
    try {
      await DB.put(DB.SM, "project", {
        w: S.CW,
        h: S.CH,
        pc: S.pc,
        fps: S.fps,
        baseFps: S.baseFps || S.fps,
        ratio: S.ratio,
        cf: S.cf,
        lo: S.layerOrder,
        pixelMode: S.pixelMode,
        pixelSize: S.pixelSize,
        frames: S.frames.map((f) => ({
          id: f.id,
          sfx: f.sfx,
          seFlags: f.seFlags,
          holdFrames: f.holdFrames || 1,
        })),
        vectors: vectorData,
      });
    } catch (e) {}
    !(function () {
      const si = U.$("saveInd");
      if (!si) return;
      (si.classList.add("show"),
        clearTimeout(si._t),
        (si._t = setTimeout(() => si.classList.remove("show"), 1200)));
    })();
  }
  async function imgDataToPngBlob(imgData) {
    if (!imgData) return null;
    if ("undefined" != typeof OffscreenCanvas) {
      const oc = new OffscreenCanvas(imgData.width, imgData.height);
      return (
        oc.getContext("2d").putImageData(imgData, 0, 0),
        await oc.convertToBlob({ type: "image/png" })
      );
    }
    const c = document.createElement("canvas");
    return (
      (c.width = imgData.width),
      (c.height = imgData.height),
      c.getContext("2d").putImageData(imgData, 0, 0),
      new Promise((r) => c.toBlob(r, "image/png"))
    );
  }
  async function pngBlobToImgData(blob, w, h) {
    if (!blob) return null;
    const bmp = await createImageBitmap(blob),
      c = document.createElement("canvas");
    ((c.width = w), (c.height = h));
    const x = c.getContext("2d");
    return (
      x.drawImage(bmp, 0, 0),
      bmp.close && bmp.close(),
      x.getImageData(0, 0, w, h)
    );
  }
  G.Storage = {
    DB: DB,
    loadLayer: async function (fid, layer, w, h) {
      const dpr = C.DPR,
        blob = await DB.get(DB.SF, fid + "_" + layer);
      return blob
        ? (async function (blob, w, h) {
            if (!blob) return null;
            try {
              const bmp = await createImageBitmap(blob),
                c = document.createElement("canvas");
              ((c.width = w), (c.height = h));
              const x = c.getContext("2d");
              return (
                x.drawImage(bmp, 0, 0),
                bmp.close && bmp.close(),
                x.getImageData(0, 0, w, h)
              );
            } catch (e) {
              const ab = await blob.arrayBuffer();
              return new ImageData(new Uint8ClampedArray(ab), w, h);
            }
          })(blob, w * dpr, h * dpr)
        : null;
    },
    saveLayer: saveLayer,
    deleteFrame: async function (fid) {
      for (const l of ["A", "B", "C", "P"])
        await DB.del(DB.SF, fid + "_" + l).catch(() => {});
    },
    debounceSave: function () {
      saveTimer ||
        (saveTimer = setTimeout(async () => {
          ((saveTimer = null), await flushIDB());
        }, C.AUTOSAVE_DELAY));
    },
    flushIDB: flushIDB,
    saveProjectFile: async function () {
      if ("undefined" == typeof JSZip) return E.toast("JSZip not loaded");
      E.snapToCache();
      const mo = U.$("exportModal");
      (mo.classList.add("show"),
        (U.$("expTitle").textContent = "プロジェクト保存中..."),
        (U.$("expBar").style.width = "0%"),
        (U.$("expMsg").textContent = "準備中"));
      try {
        const zip = new JSZip(),
          dpr = C.DPR,
          vectorData = {};
        S.frames.forEach((f) => {
          if (G.VectorPaths) {
            const vd = G.VectorPaths.serializePaths(f.id);
            Object.keys(vd).length > 0 && (vectorData[f.id] = vd);
          }
        });
        const projectMeta = {
          version: 6,
          w: S.CW,
          h: S.CH,
          dpr: dpr,
          pc: S.pc,
          fps: S.fps,
          baseFps: S.baseFps || S.fps,
          ratio: S.ratio,
          cf: S.cf,
          lo: S.layerOrder,
          pixelMode: S.pixelMode,
          pixelSize: S.pixelSize,
          frames: S.frames.map((f) => ({
            id: f.id,
            sfx: f.sfx,
            seFlags: f.seFlags,
            holdFrames: f.holdFrames || 1,
          })),
          vectors: vectorData,
        };
        zip.file("project.json", JSON.stringify(projectMeta));
        const total = S.frames.length;
        for (let i = 0; i < total; i++) {
          const f = S.frames[i],
            c = await E.ensureCached(f.id);
          if (c)
            for (const l of ["A", "B", "C", "P"])
              if (c[l]) {
                const blob = await imgDataToPngBlob(c[l]);
                blob && zip.file(`frames/${f.id}_${l}.png`, blob);
              }
          (i !== S.cf && S.fc.delete(f.id),
            (U.$("expBar").style.width = ((i + 1) / total) * 80 + "%"),
            (U.$("expMsg").textContent = `ファイル準備中: ${i + 1}/${total}`),
            await new Promise((r) => setTimeout(r, 1)));
        }
        U.$("expMsg").textContent =
          "ファイル結合中... (ブラウザを閉じないでください)";
        const content = await zip.generateAsync(
            { type: "blob", compression: "STORE" },
            (meta) => {
              U.$("expBar").style.width = 80 + 0.2 * meta.percent + "%";
            },
          ),
          a = document.createElement("a");
        ((a.href = URL.createObjectURL(content)),
          (a.download = "ugoku_draw_" + Date.now() + ".ugodraw"),
          a.click(),
          setTimeout(() => URL.revokeObjectURL(a.href), 5e3),
          mo.classList.remove("show"),
          E.toast("プロジェクトの保存が完了しました"));
      } catch (e) {
        (mo.classList.remove("show"), E.toast("保存エラー: " + e.message));
      }
    },
    loadProjectFile: async function (file) {
      try {
        if ("undefined" == typeof JSZip) return E.toast("JSZip not loaded");
        const mo = U.$("exportModal");
        (mo.classList.add("show"),
          (U.$("expTitle").textContent = "プロジェクト読込中..."),
          (U.$("expBar").style.width = "0%"),
          (U.$("expMsg").textContent = "解凍・最適化中..."));
        const zip = await JSZip.loadAsync(file),
          projJson = await zip.file("project.json").async("string"),
          data = JSON.parse(projJson),
          srcDpr = (C.DPR, data.dpr || 1);
        ((S.CW = data.w),
          (S.CH = data.h),
          (S.pc = data.pc || "#FFFFFF"),
          (S.fps = data.fps || 8),
          (S.baseFps = data.baseFps || data.fps || 8),
          (S.ratio = data.ratio || "4:3"),
          data.lo && (S.layerOrder = data.lo),
          void 0 !== data.pixelMode && (S.pixelMode = data.pixelMode),
          data.pixelSize && (S.pixelSize = data.pixelSize));
        const fpsRange = U.$("fpsRange");
        fpsRange && (fpsRange.value = S.fps);
        const fpsNum = U.$("fpsInputVal");
        (fpsNum && (fpsNum.value = S.fps),
          G.Renderer.initCanvases(S.CW, S.CH),
          E.updateTransform(),
          E.updatePaperColor(),
          E.updateLayerZOrder(),
          S.fc.clear(),
          G.Thumbs.clear(),
          (S.undoStack = []),
          (S.redoStack = []),
          S.dirtyIds.clear(),
          S.dirtyLayers.clear(),
          S.vectorPaths.clear(),
          (S.lruOrder = []));
        const total = data.frames.length;
        S.frames = [];
        for (let i = 0; i < total; i++) {
          const fd = data.frames[i],
            nf = {
              id: fd.id || U.uid(),
              sfx: fd.sfx || "",
              seFlags: fd.seFlags || [0, 0, 0, 0],
              holdFrames: fd.holdFrames || 1,
              thumbDirty: !0,
            },
            shouldLoadToMemory = i < C.EVICT_RANGE,
            c = { A: null, B: null, C: null, P: null };
          for (const l of ["A", "B", "C", "P"]) {
            const fn = `frames/${nf.id}_${l}.png`,
              entry = zip.file(fn);
            if (entry) {
              const blob = await entry.async("blob");
              shouldLoadToMemory
                ? (c[l] = await pngBlobToImgData(
                    blob,
                    S.CW * srcDpr,
                    S.CH * srcDpr,
                  ))
                : await DB.put(DB.SF, nf.id + "_" + l, blob);
            }
          }
          (shouldLoadToMemory
            ? (S.fc.set(nf.id, c), S.lruOrder.push(nf.id))
            : S.fc.set(nf.id, { A: null, B: null, C: null, P: null }),
            S.frames.push(nf),
            (U.$("expBar").style.width = ((i + 1) / total) * 100 + "%"),
            (U.$("expMsg").textContent = `フレーム構築中: ${i + 1}/${total}`),
            i % 10 == 0 && (await new Promise((r) => setTimeout(r, 1))));
        }
        if (data.vectors)
          for (const [fid, vd] of Object.entries(data.vectors))
            G.VectorPaths && G.VectorPaths.deserializePaths(fid, vd);
        ((S.cf = Math.min(data.cf || 0, S.frames.length - 1)),
          await E.ensureCached(E.curId()),
          E.cacheToCanvas(E.curId()),
          E.fitView(),
          G.UI && (G.UI.buildLayerList(), G.UI.updateFrameInfo()),
          G.Timeline && G.Timeline.renderTL());
        for (let i = 0; i < S.frames.length; i++)
          E.markAllDirty(S.frames[i].id);
        return (
          mo.classList.remove("show"),
          E.toast("プロジェクト読込完了"),
          !0
        );
      } catch (e) {
        return (
          U.$("exportModal").classList.remove("show"),
          E.toast("エラー: " + e.message),
          !1
        );
      }
    },
    restoreFromIDB: async function () {
      try {
        await DB.open();
      } catch (e) {
        return !1;
      }
      try {
        const meta = await DB.get(DB.SM, "project");
        if (!meta || !meta.frames || !meta.frames.length) return !1;
        ((S.CW = meta.w),
          (S.CH = meta.h),
          (S.pc = meta.pc || "#FFFFFF"),
          (S.fps = meta.fps || 8),
          (S.baseFps = meta.baseFps || meta.fps || 8),
          (S.ratio = meta.ratio || "4:3"),
          meta.lo && (S.layerOrder = meta.lo),
          void 0 !== meta.pixelMode && (S.pixelMode = meta.pixelMode),
          meta.pixelSize && (S.pixelSize = meta.pixelSize));
        const fr = U.$("fpsRange");
        fr && (fr.value = S.fps);
        const fn = U.$("fpsInputVal");
        if (
          (fn && (fn.value = S.fps),
          G.Renderer.initCanvases(S.CW, S.CH),
          E.updateTransform(),
          E.updatePaperColor(),
          E.updateLayerZOrder(),
          (S.frames = meta.frames.map((f) => ({
            id: f.id,
            sfx: f.sfx || "",
            seFlags: f.seFlags || [0, 0, 0, 0],
            holdFrames: f.holdFrames || 1,
            thumbDirty: !0,
          }))),
          (S.cf = Math.min(meta.cf || 0, S.frames.length - 1)),
          (S.lruOrder = []),
          meta.vectors && G.VectorPaths)
        )
          for (const [fid, vd] of Object.entries(meta.vectors))
            G.VectorPaths.deserializePaths(fid, vd);
        return (
          await E.ensureCached(S.frames[S.cf].id),
          E.cacheToCanvas(E.curId()),
          E.toast("復元完了"),
          !0
        );
      } catch (e) {
        return !1;
      }
    },
    clearAll: async function () {
      ((S.frames = [E.mkFrame()]),
        (S.cf = 0),
        ["A", "B", "C"].forEach((l) => {
          E.getLayerCtx(l).clearRect(0, 0, S.CW, S.CH);
          const vc = G.Renderer.getVectorCtx(l);
          vc && vc.clearRect(0, 0, S.CW, S.CH);
        }),
        E.getLayerCtx("Photo").clearRect(0, 0, S.CW, S.CH),
        (S.undoStack = []),
        (S.redoStack = []),
        S.fc.clear(),
        G.Thumbs.clear(),
        S.dirtyIds.clear(),
        S.dirtyLayers.clear(),
        S.vectorPaths.clear(),
        (S.lruOrder = []),
        E.snapToCache(),
        E.markAllDirty(E.curId()),
        E.updateOnion(),
        G.Timeline && G.Timeline.renderTL(),
        G.UI && G.UI.updateFrameInfo(),
        DB.db && (await DB.clear(DB.SF).catch(() => {})));
    },
  };
})(window.UgokuDraw);
