"use strict";
!(function (G) {
    const U = G.Utils,
        C = G.Config,
        R = G.Renderer,
        S = G.State,
        E = G.Engine;
    let tlRAF = null,
        preloadTimer = null;
    const TL = {};
    let playT0, playF0;
    ((TL.switchFrame = async (i) => {
        S.playing ||
            i < 0 ||
            i >= S.frames.length ||
            (E.snapToCache(),
                TL.renderThumbForId(E.curId(), !0),
                (E.curFr().thumbDirty = !1),
                (S.cf = i),
                E.autoFlattenDistantFrames && E.autoFlattenDistantFrames(i),
                await E.ensureCached(E.curId()),
                E.cacheToCanvas(E.curId()),
                E.evictFar(),
                TL.renderTL(),
                G.UI && G.UI.updateFrameInfo(),
                S.cpMode && G.Tools && G.Tools.drawControlPointOverlay());
    }),
        (TL.addFrame = () => {
            (E.snapToCache(),
                TL.renderThumbForId(E.curId(), !0),
                (E.curFr().thumbDirty = !1));
            const nf = E.mkFrame(),
                nc = { A: null, B: null, C: null, P: null },
                oc = S.fc.get(E.curId());
            if (oc && oc.P) {
                const dpr = C.DPR;
                nc.P = new ImageData(
                    new Uint8ClampedArray(oc.P.data),
                    S.CW * dpr,
                    S.CH * dpr,
                );
            }
            if (
                (S.frames.splice(S.cf + 1, 0, nf),
                    S.fc.set(nf.id, nc),
                    S.cf++,
                    ["A", "B", "C"].forEach((l) => {
                        E.getLayerCtx(l).clearRect(0, 0, S.CW, S.CH);
                        const vc = R.getVectorCtx(l);
                        vc && vc.clearRect(0, 0, S.CW, S.CH);
                    }),
                    nc.P)
            ) {
                const dpr = C.DPR;
                (E.getLayerCtx("Photo").save(),
                    E.getLayerCtx("Photo").setTransform(1, 0, 0, 1, 0, 0),
                    E.getLayerCtx("Photo").putImageData(nc.P, 0, 0),
                    E.getLayerCtx("Photo").restore(),
                    E.getLayerCtx("Photo").setTransform(dpr, 0, 0, dpr, 0, 0));
            } else E.getLayerCtx("Photo").clearRect(0, 0, S.CW, S.CH);
            (E.updateOnion(),
                E.markAllDirty(nf.id),
                TL.renderTL(),
                G.UI && G.UI.updateFrameInfo(),
                E.toast("コマを追加しました"));
        }),
        (TL.duplicateFrame = () => {
            E.snapToCache();
            const oc = S.fc.get(E.curId()),
                dpr = C.DPR,
                cl = {};
            ["A", "B", "C", "P"].forEach((k) => {
                cl[k] =
                    oc && oc[k]
                        ? new ImageData(
                            new Uint8ClampedArray(oc[k].data),
                            S.CW * dpr,
                            S.CH * dpr,
                        )
                        : null;
            });
            const nf = E.mkFrame();
            if (
                ((nf.sfx = E.curFr().sfx),
                    (nf.seFlags = E.curFr().seFlags
                        ? [...E.curFr().seFlags]
                        : [0, 0, 0, 0]),
                    S.frames.splice(S.cf + 1, 0, nf),
                    S.fc.set(nf.id, cl),
                    G.VectorPaths)
            ) {
                const cloned = G.VectorPaths.cloneFramePaths(E.curId());
                S.vectorPaths.set(nf.id, cloned);
            }
            (S.cf++,
                E.cacheToCanvas(E.curId()),
                E.markAllDirty(nf.id),
                TL.renderTL(),
                G.UI && G.UI.updateFrameInfo(),
                E.toast("コマを複製しました"));
        }),
        (TL.deleteFrame = () => {
            if (S.frames.length <= 1) {
                (["A", "B", "C"].forEach((l) => {
                    E.getLayerCtx(l).clearRect(0, 0, S.CW, S.CH);
                    const vc = R.getVectorCtx(l);
                    vc && vc.clearRect(0, 0, S.CW, S.CH);
                }),
                    E.getLayerCtx("Photo").clearRect(0, 0, S.CW, S.CH));
                const fid = E.curId();
                return (
                    S.fc.set(fid, { A: null, B: null, C: null, P: null }),
                    S.vectorPaths.delete(fid),
                    E.snapToCache(),
                    E.markAllDirty(fid),
                    void TL.renderTL()
                );
            }
            const old = E.curFr();
            (G.Storage && G.Storage.deleteFrame(old.id),
                S.fc.delete(old.id),
                G.Thumbs.delete(old.id),
                S.vectorPaths.delete(old.id),
                S.frames.splice(S.cf, 1),
                S.cf >= S.frames.length && S.cf--,
                E.ensureCached(E.curId()).then(() => E.cacheToCanvas(E.curId())),
                TL.renderTL(),
                G.UI && G.UI.updateFrameInfo());
        }),
        (TL.moveFrame = (from, to) => {
            if (
                from < 0 ||
                from >= S.frames.length ||
                to < 0 ||
                to >= S.frames.length
            )
                return;
            const [item] = S.frames.splice(from, 1);
            (S.frames.splice(to, 0, item), (S.cf = to), TL.renderTL());
        }),
        (TL.play = async () => {
            if (S.frames.length < 2) return E.toast("2コマ以上必要です");
            E.snapToCache();
            const _pr = Math.min(S.frames.length, C.PRELOAD_RANGE || 8);
            for (let i = 0; i < _pr; i++) {
                const _idx = (S.cf + i) % S.frames.length;
                await E.ensureCached(S.frames[_idx].id);
            }
            S.playing = !0;
            const playBtn = U.$("playBtn"),
                stopBtn = U.$("stopBtn");
            (playBtn && (playBtn.style.display = "none"),
                stopBtn && (stopBtn.style.display = "flex"));
            const tlPlay = U.$("tlPlayBtn"),
                tlStop = U.$("tlStopBtn");
            (tlPlay && (tlPlay.style.display = "none"),
                tlStop && (tlStop.style.display = ""),
                G.Audio && G.Audio.bgmBuffer && G.Audio.playBGM(S.cf, S.fps),
                (playT0 = performance.now()),
                (playF0 = S.cf));
            let lastFi = -1;
            const _plId = setInterval(async () => {
                if (!S.playing) return clearInterval(_plId);
                const _elapsed = (performance.now() - playT0) / 1e3,
                    _curFi = Math.min(
                        playF0 + Math.floor(_elapsed * S.fps),
                        S.frames.length - 1,
                    );
                for (let k = 0; k < 8; k++) {
                    const _ni = (_curFi + k) % S.frames.length;
                    if (
                        _ni >= 0 &&
                        _ni < S.frames.length &&
                        !S.fc.has(S.frames[_ni].id)
                    ) {
                        await E.ensureCached(S.frames[_ni].id);
                        break;
                    }
                }
            }, 8);
            S._plId = _plId;
            tlRAF = requestAnimationFrame(function tick(now) {
                if (!S.playing) return;
                const elapsed = (now - playT0) / 1e3;
                let fi = playF0 + Math.floor(elapsed * S.fps);
                if (fi >= S.frames.length) {
                    if (!S.loopPlay) return void TL.stop();
                    ((playT0 = now),
                        (playF0 = 0),
                        (fi = 0),
                        G.Audio && G.Audio.bgmBuffer && G.Audio.playBGM(0, S.fps));
                }
                if (fi !== lastFi) {
                    const fid = S.frames[fi].id,
                        cache = S.fc.get(fid);
                    if (cache && (cache.A || cache.B || cache.C || cache.P)) {
                        lastFi = fi;
                        {
                            const dpr = C.DPR;
                            ([
                                ["A", "A"],
                                ["B", "B"],
                                ["C", "C"],
                                ["P", "Photo"],
                            ].forEach(([k, l]) => {
                                const ctx = E.getLayerCtx(l);
                                (ctx.save(),
                                    ctx.setTransform(1, 0, 0, 1, 0, 0),
                                    ctx.clearRect(0, 0, S.CW * dpr, S.CH * dpr),
                                    cache[k] && ctx.putImageData(cache[k], 0, 0),
                                    ctx.restore(),
                                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0));
                            }),
                                E.redrawVectorLayers(fid));
                        }
                        ((S.cf = fi),
                            G.UI && G.UI.updateFrameInfo(),
                            TL.highlightFrame(fi));
                        const fr = S.frames[fi];
                        G.Audio && fr.seFlags
                            ? fr.seFlags.forEach((flag, chIdx) => {
                                flag && G.Audio.playSEChannel(chIdx);
                            })
                            : fr.sfx && G.Audio && G.Audio.playSFX(fr.sfx);
                    }
                }
                tlRAF = requestAnimationFrame(tick);
            });
        }),
        (TL.stop = () => {
            ((S.playing = !1),
                tlRAF && (cancelAnimationFrame(tlRAF), (tlRAF = null)),
                S._plId && (clearInterval(S._plId), (S._plId = null)));
            const playBtn = U.$("playBtn"),
                stopBtn = U.$("stopBtn");
            (playBtn && (playBtn.style.display = "flex"),
                stopBtn && (stopBtn.style.display = "none"));
            const tlPlay = U.$("tlPlayBtn"),
                tlStop = U.$("tlStopBtn");
            (tlPlay && (tlPlay.style.display = ""),
                tlStop && (tlStop.style.display = "none"),
                G.Audio && (G.Audio.stopBGM(), G.Audio.stopRecord()));
            const recBtn = U.$("recSyncBtn2");
            (recBtn && recBtn.classList.remove("on"),
                (S.recWhilePlaying = !1),
                E.cacheToCanvas(E.curId()),
                TL.renderTL());
        }),
        (TL.renderThumbForId = (fid, isCurrent) => {
            let tc = G.Thumbs.get(fid);
            return (
                tc ||
                ((tc = document.createElement("canvas")),
                    (tc.width = C.THUMB_W),
                    (tc.height = C.THUMB_H),
                    G.Thumbs.set(fid, tc)),
                TL.renderThumb(fid, tc, isCurrent),
                (tc._rendered = !0),
                tc
            );
        }),
        (TL.renderThumb = (fid, tc, isCurrent) => {
            const x = tc.getContext("2d"),
                dpr = C.DPR;
            if (isCurrent)
                ((x.fillStyle = S.pc),
                    x.fillRect(0, 0, C.THUMB_W, C.THUMB_H),
                    x.drawImage(R.canvases.lPhoto, 0, 0, C.THUMB_W, C.THUMB_H),
                    S.layerOrder.forEach((l) => {
                        const rc = R.getRasterCanvas(l),
                            vc = R.getVectorCanvas(l);
                        (rc &&
                            "none" !== rc.style.display &&
                            x.drawImage(rc, 0, 0, C.THUMB_W, C.THUMB_H),
                            vc &&
                            "none" !== vc.style.display &&
                            x.drawImage(vc, 0, 0, C.THUMB_W, C.THUMB_H));
                    }));
            else {
                const c = S.fc.get(fid);
                if (!c) return !1;
                ((x.fillStyle = S.pc), x.fillRect(0, 0, C.THUMB_W, C.THUMB_H));
                const tmp = document.createElement("canvas");
                ((tmp.width = S.CW * dpr), (tmp.height = S.CH * dpr));
                const tx = tmp.getContext("2d");
                (c.P &&
                    (tx.putImageData(c.P, 0, 0),
                        x.drawImage(tmp, 0, 0, C.THUMB_W, C.THUMB_H),
                        tx.clearRect(0, 0, S.CW * dpr, S.CH * dpr)),
                    S.layerOrder.forEach((l) => {
                        c[l] &&
                            (tx.clearRect(0, 0, S.CW * dpr, S.CH * dpr),
                                tx.putImageData(c[l], 0, 0),
                                x.drawImage(tmp, 0, 0, C.THUMB_W, C.THUMB_H));
                    }));
            }
        }),
        (TL.highlightFrame = (fi) => {
            const items = U.$("tls");
            if (!items) return;
            const frames = items.querySelectorAll(".ft");
            (frames.forEach((el, j) => {
                (el.classList.toggle("on", !1),
                    el.classList.toggle("playing", j === fi));
            }),
                frames[fi] &&
                frames[fi].scrollIntoView({
                    behavior: "auto",
                    inline: "center",
                    block: "nearest",
                }));
        }),
        (TL.renderDebounced = () => {
            renderTimer ||
                (renderTimer = requestAnimationFrame(() => {
                    ((renderTimer = null), TL.renderTL());
                }));
        }));
    let renderTimer = null;
    ((TL.renderTL = () => {
        const el = U.$("tls");
        if (!el) return;
        el.innerHTML = "";
        const frag = document.createDocumentFragment();
        const WIN_SIZE = 40;
        const lo = Math.max(0, S.cf - WIN_SIZE);
        const hi = Math.min(S.frames.length - 1, S.cf + WIN_SIZE);
        S.frames.forEach((fm, i) => {
            const d = document.createElement("div");
            ((d.className = "ft" + (i === S.cf ? " on" : "")),
                (d.draggable = !0),
                (d.dataset.idx = i));
            if (i >= lo && i <= hi) {
                let tc = G.Thumbs.get(fm.id);
                (tc ||
                    ((tc = document.createElement("canvas")),
                        (tc.width = C.THUMB_W),
                        (tc.height = C.THUMB_H),
                        G.Thumbs.set(fm.id, tc),
                        (fm.thumbDirty = !0)),
                    i === S.cf
                        ? (TL.renderThumb(fm.id, tc, !0),
                            (fm.thumbDirty = !1),
                            (tc._rendered = !0))
                        : fm.thumbDirty &&
                        S.fc.has(fm.id) &&
                        (TL.renderThumb(fm.id, tc, !1),
                            (fm.thumbDirty = !1),
                            (tc._rendered = !0)));
                const dc = document.createElement("canvas");
                ((dc.width = C.THUMB_W),
                    (dc.height = C.THUMB_H),
                    dc.getContext("2d").drawImage(tc, 0, 0));
                const n = document.createElement("div");
                if (
                    ((n.className = "fn"),
                        (n.textContent = i + 1),
                        d.appendChild(dc),
                        d.appendChild(n),
                        fm.seFlags && fm.seFlags.some((f) => f))
                ) {
                    const sf = document.createElement("div");
                    ((sf.className = "fsfx"), (sf.textContent = "♪"), d.appendChild(sf));
                } else if (fm.sfx) {
                    const sf = document.createElement("div");
                    ((sf.className = "fsfx"), (sf.textContent = "SFX"), d.appendChild(sf));
                }
            } else {
                const n = document.createElement("div");
                ((n.className = "fn"), (n.textContent = i + 1), d.appendChild(n));
            }
            (d.addEventListener("dragstart", (e) => {
                (e.dataTransfer.setData("text/plain", String(i)),
                    (e.dataTransfer.effectAllowed = "move"),
                    (d.style.opacity = "0.4"));
            }),
                d.addEventListener("dragend", () => {
                    d.style.opacity = "1";
                }),
                d.addEventListener("dragover", (e) => {
                    (e.preventDefault(),
                        (e.dataTransfer.dropEffect = "move"),
                        (d.style.borderColor = "var(--acc)"));
                }),
                d.addEventListener("dragleave", () => {
                    d.style.borderColor = "";
                }),
                d.addEventListener("drop", (e) => {
                    (e.preventDefault(), (d.style.borderColor = ""));
                    const f = parseInt(e.dataTransfer.getData("text/plain")),
                        t = parseInt(d.dataset.idx);
                    isNaN(f) || isNaN(t) || f === t || TL.moveFrame(f, t);
                }),
                (d.onclick = () => TL.switchFrame(i)),
                frag.appendChild(d));
        });
        const dropZone = document.createElement("div");
        ((dropZone.className = "ft-drop-zone"),
            (dropZone.textContent = "+"),
            (dropZone.onclick = () => TL.addFrame()),
            dropZone.addEventListener("dragover", (e) => {
                (e.preventDefault(),
                    (dropZone.style.background = "rgba(255,102,0,0.1)"));
            }),
            dropZone.addEventListener("dragleave", () => {
                dropZone.style.background = "";
            }),
            dropZone.addEventListener("drop", (e) => {
                (e.preventDefault(), (dropZone.style.background = ""));
                const f = parseInt(e.dataTransfer.getData("text/plain"));
                isNaN(f) || TL.moveFrame(f, S.frames.length - 1);
            }),
            frag.appendChild(dropZone),
            el.appendChild(frag),
            G.UI && G.UI.updateFrameInfo(),
            (function () {
                if (preloadTimer) return;
                preloadTimer = setTimeout(() => {
                    ((preloadTimer = null),
                        (async function () {
                            const lo = Math.max(0, S.cf - C.PRELOAD_RANGE),
                                hi = Math.min(S.frames.length - 1, S.cf + C.PRELOAD_RANGE);
                            for (let i = lo; i <= hi; i++) {
                                const fid = S.frames[i].id;
                                if (!S.fc.has(fid)) {
                                    await E.ensureCached(fid);
                                    const fm = S.frames[i];
                                    let tc = G.Thumbs.get(fm.id);
                                    (tc ||
                                        ((tc = document.createElement("canvas")),
                                            (tc.width = C.THUMB_W),
                                            (tc.height = C.THUMB_H),
                                            G.Thumbs.set(fm.id, tc)),
                                        (!fm.thumbDirty && tc._rendered) ||
                                        (TL.renderThumb(fm.id, tc, !1),
                                            (fm.thumbDirty = !1),
                                            (tc._rendered = !0)));
                                }
                            }
                        })());
                }, 100);
            })());
        const curEl = el.querySelector(".ft.on");
        curEl &&
            curEl.scrollIntoView({
                behavior: "auto",
                inline: "center",
                block: "nearest",
            });
    }),
        (G.Timeline = TL));
})(window.UgokuDraw);
