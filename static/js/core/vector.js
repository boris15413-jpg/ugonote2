"use strict";
!(function (G) {
    var U = G.Utils,
        C = G.Config,
        S = G.State,
        VP = {};
    VP.drawParameterizeLine = function (ctx, pts, lineWidth, color, pressure, brushType) {
        if (!pts || !pts.length) return;
        var step = Math.max(1, lineWidth * 0.15);
        var alphaMod = 1.0;
        if (brushType === "watercolor") {
            alphaMod = 0.2;
            step = Math.max(1, lineWidth * 0.2);
        } else if (brushType === "crayon") {
            step = Math.max(1, lineWidth * 0.4);
        }
        ctx.fillStyle = color;
        var curAlpha = ctx.globalAlpha;
        if (alphaMod < 1.0) ctx.globalAlpha = curAlpha * alphaMod;

        var dLast = 0;
        for (var i = 1; i < pts.length; i++) {
            var p0 = pts[i - 1], p1 = pts[i];
            var dx = p1.x - p0.x, dy = p1.y - p0.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) continue;
            var dDirX = dx / dist, dDirY = dy / dist;

            var dWalk = step - dLast;
            while (dWalk <= dist) {
                var cx = p0.x + dDirX * dWalk;
                var cy = p0.y + dDirY * dWalk;
                var pr = p0.p + (p1.p - p0.p) * (dWalk / dist);
                var w = lineWidth * (pressure ? U.clamp(1.5 * pr, 0.15, 1.8) : 1);

                ctx.beginPath();
                if (brushType === "crayon") {
                    var rx = (Math.random() - 0.5) * w * 0.4;
                    var ry = (Math.random() - 0.5) * w * 0.4;
                    ctx.arc(cx + rx, cy + ry, w * (0.3 + 0.4 * Math.random()), 0, 2 * Math.PI);
                } else if (brushType === "watercolor") {
                    ctx.arc(cx, cy, w * (0.8 + 0.4 * Math.random()), 0, 2 * Math.PI);
                }
                ctx.fill();
                dWalk += step;
            }
            dLast = dist - (dWalk - step);
        }
        ctx.globalAlpha = curAlpha;
    };
    function drawSmoothLine(ctx, pts, lineWidth, color, pressure) {
        if (pts.length)
            if (
                ((ctx.lineCap = "round"),
                    (ctx.lineJoin = "round"),
                    pressure && pts[0] && void 0 !== pts[0].p)
            )
                for (var i = 1; i < pts.length; i++) {
                    var p0 = pts[i - 1],
                        p1 = pts[i],
                        pr = (p0.p + p1.p) / 2,
                        w = lineWidth * U.clamp(1.5 * pr, 0.15, 1.8);
                    if (
                        ((ctx.lineWidth = w),
                            (ctx.strokeStyle = color),
                            ctx.beginPath(),
                            ctx.moveTo(p0.x, p0.y),
                            i < pts.length - 1)
                    ) {
                        var mx = (p1.x + pts[i + 1].x) / 2,
                            my = (p1.y + pts[i + 1].y) / 2;
                        ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
                    } else ctx.lineTo(p1.x, p1.y);
                    ctx.stroke();
                }
            else {
                if (
                    ((ctx.lineWidth = lineWidth),
                        (ctx.strokeStyle = color),
                        ctx.beginPath(),
                        ctx.moveTo(pts[0].x, pts[0].y),
                        1 === pts.length)
                )
                    ctx.lineTo(pts[0].x + 0.1, pts[0].y);
                else if (2 === pts.length) ctx.lineTo(pts[1].x, pts[1].y);
                else {
                    for (var i2 = 1; i2 < pts.length - 1; i2++) {
                        var mx2 = (pts[i2].x + pts[i2 + 1].x) / 2,
                            my2 = (pts[i2].y + pts[i2 + 1].y) / 2;
                        ctx.quadraticCurveTo(pts[i2].x, pts[i2].y, mx2, my2);
                    }
                    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                }
                ctx.stroke();
            }
    }
    function drawStarPath(ctx, p0, p1, path) {
        var cx = (p0.x + p1.x) / 2,
            cy = (p0.y + p1.y) / 2,
            outerR = Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)) / 2,
            innerR = 0.4 * outerR;
        ((ctx.strokeStyle = path.color),
            (ctx.lineWidth = path.size),
            ctx.beginPath());
        for (var i = 0; i < 10; i++) {
            var a = (i * Math.PI) / 5 - Math.PI / 2,
                r = i % 2 == 0 ? outerR : innerR;
            0 === i
                ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        (ctx.closePath(),
            path.fill && ((ctx.fillStyle = path.color), ctx.fill()),
            ctx.stroke());
    }
    function drawHeartPath(ctx, p0, p1, path) {
        var cx = (p0.x + p1.x) / 2,
            cy = (p0.y + p1.y) / 2,
            w = Math.abs(p1.x - p0.x),
            h = Math.abs(p1.y - p0.y);
        ((ctx.strokeStyle = path.color),
            (ctx.lineWidth = path.size),
            ctx.beginPath(),
            ctx.moveTo(cx, cy + 0.35 * h),
            ctx.bezierCurveTo(
                cx - 0.5 * w,
                cy - 0.1 * h,
                cx - 0.5 * w,
                cy - 0.45 * h,
                cx,
                cy - 0.15 * h,
            ),
            ctx.bezierCurveTo(
                cx + 0.5 * w,
                cy - 0.45 * h,
                cx + 0.5 * w,
                cy - 0.1 * h,
                cx,
                cy + 0.35 * h,
            ),
            ctx.closePath(),
            path.fill && ((ctx.fillStyle = path.color), ctx.fill()),
            ctx.stroke());
    }
    function pointInPolygon(px, py, ring) {
        for (var inside = !1, n = ring.length, i = 0, j = n - 1; i < n; j = i++) {
            var xi = ring[i][0],
                yi = ring[i][1],
                xj = ring[j][0],
                yj = ring[j][1];
            yi > py != yj > py &&
                px < ((xj - xi) * (py - yi)) / (yj - yi) + xi &&
                (inside = !inside);
        }
        return inside;
    }
    function segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
        var denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
        if (Math.abs(denom) < 1e-12) return null;
        var t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom,
            u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
        return t > 1e-9 && t < 1 - 1e-9 && u >= 0 && u <= 1
            ? { x: ax + t * (bx - ax), y: ay + t * (by - ay), t: t }
            : null;
    }
    function lerpPt(a, b, t) {
        return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            p: (a.p || 0.5) + ((b.p || 0.5) - (a.p || 0.5)) * t,
        };
    }
    function clipSegment(a, b, ring) {
        var aIn = pointInPolygon(a.x, a.y, ring),
            hits = (function (ax, ay, bx, by, ring) {
                for (var hits = [], n = ring.length, i = 0, j = n - 1; i < n; j = i++) {
                    var hit = segSegIntersect(
                        ax,
                        ay,
                        bx,
                        by,
                        ring[j][0],
                        ring[j][1],
                        ring[i][0],
                        ring[i][1],
                    );
                    hit && hits.push(hit);
                }
                if (0 === hits.length) return hits;
                hits.sort(function (a, b) {
                    return a.t - b.t;
                });
                for (var filtered = [hits[0]], k = 1; k < hits.length; k++)
                    hits[k].t - filtered[filtered.length - 1].t > 1e-6 &&
                        filtered.push(hits[k]);
                return filtered;
            })(a.x, a.y, b.x, b.y, ring);
        if (!hits || !hits.length) return aIn ? [] : [[a, b]];
        for (var result = [], prev = a, inside = aIn, i = 0; i < hits.length; i++) {
            var ip = lerpPt(a, b, hits[i].t);
            (inside || result.push([prev, ip]), (prev = ip), (inside = !inside));
        }
        return (inside || result.push([prev, b]), result);
    }
    ((VP.createPath = function (type, pts, opts) {
        return {
            id: U.uid(),
            type: type,
            pts: pts.map(function (p) {
                return { x: p.x, y: p.y, p: p.p || 0.5 };
            }),
            color: opts.color || S.cc,
            size: opts.size || S.cs,
            alpha: opts.alpha || S.alpha,
            outline: !!opts.outline,
            outlineColor: opts.outlineColor || S.penOutC,
            outlineWidth: opts.outlineWidth || S.penOutW,
            smooth: null != opts.smooth ? opts.smooth : S.penSmooth,
            pressure: !!opts.pressure,
            fill: !!opts.fill,
            symmetry: opts.symmetry || "none",
            brushType: opts.brushType || "normal",
            fillType: opts.fillType || "solid",
            shadow: opts.shadow || "none",
        };
    }),
        (VP.getFramePaths = function (fid, layer) {
            S.vectorPaths.has(fid) || S.vectorPaths.set(fid, new Map());
            var fm = S.vectorPaths.get(fid);
            return (fm.has(layer) || fm.set(layer, []), fm.get(layer));
        }),
        (VP.addPath = function (fid, layer, path) {
            VP.getFramePaths(fid, layer).push(path);
        }),
        (VP.removePath = function (fid, layer, pathId) {
            var arr = VP.getFramePaths(fid, layer),
                idx = arr.findIndex(function (p) {
                    return p.id === pathId;
                });
            idx >= 0 && arr.splice(idx, 1);
        }),
        (VP.cloneFramePaths = function (srcFid) {
            var srcMap = S.vectorPaths.get(srcFid);
            if (!srcMap) return new Map();
            var dst = new Map();
            for (var entry of srcMap) {
                var layer = entry[0],
                    paths = entry[1];
                dst.set(
                    layer,
                    paths.map(function (p) {
                        return Object.assign({}, p, {
                            id: U.uid(),
                            pts: p.pts.map(function (pt) {
                                return { x: pt.x, y: pt.y, p: pt.p };
                            }),
                        });
                    }),
                );
            }
            return dst;
        }),
        (VP.renderPath = function (ctx, path, CW, CH) {
            var pts = path.pts;
            if (pts && pts.length) {
                ((ctx.lineCap = "round"),
                    (ctx.lineJoin = "round"),
                    (ctx.globalAlpha = path.alpha));
                if (path.shadow === "drop") {
                    ctx.shadowColor = "rgba(0,0,0,0.5)";
                    ctx.shadowBlur = Math.max(4, path.size);
                    ctx.shadowOffsetX = path.size * 0.2;
                    ctx.shadowOffsetY = path.size * 0.2;
                } else {
                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                }
                var smoothed =
                    path.smooth > 0 && pts.length >= 3
                        ? U.stabilize(pts, path.smooth)
                        : pts,
                    transforms = [
                        function (p) {
                            return p;
                        },
                    ];
                (("h" !== path.symmetry && "4" !== path.symmetry) ||
                    transforms.push(function (p) {
                        return { x: CW - p.x, y: p.y, p: p.p };
                    }),
                    ("v" !== path.symmetry && "4" !== path.symmetry) ||
                    transforms.push(function (p) {
                        return { x: p.x, y: CH - p.y, p: p.p };
                    }),
                    "4" === path.symmetry &&
                    transforms.push(function (p) {
                        return { x: CW - p.x, y: CH - p.y, p: p.p };
                    }));
                for (var ti = 0; ti < transforms.length; ti++) {
                    var tf = transforms[ti],
                        tpts = smoothed.map(tf);
                    switch (path.type) {
                        case "pen":
                            if (path.brushType === "crayon" || path.brushType === "watercolor") {
                                VP.drawParameterizeLine(ctx, tpts, path.size, path.color, path.pressure, path.brushType);
                            } else {
                                (path.outline &&
                                    drawSmoothLine(
                                        ctx,
                                        tpts,
                                        path.size + 2 * path.outlineWidth,
                                        path.outlineColor,
                                        path.pressure,
                                    ),
                                    drawSmoothLine(
                                        ctx,
                                        tpts,
                                        path.size,
                                        path.color,
                                        path.pressure,
                                    ));
                            }
                            break;
                        case "line":
                            tpts.length >= 2 &&
                                (path.outline &&
                                    ((ctx.strokeStyle = path.outlineColor),
                                        (ctx.lineWidth = path.size + 2 * path.outlineWidth),
                                        ctx.beginPath(),
                                        ctx.moveTo(tpts[0].x, tpts[0].y),
                                        ctx.lineTo(tpts[tpts.length - 1].x, tpts[tpts.length - 1].y),
                                        ctx.stroke()),
                                    (ctx.strokeStyle = path.color),
                                    (ctx.lineWidth = path.size),
                                    ctx.beginPath(),
                                    ctx.moveTo(tpts[0].x, tpts[0].y),
                                    ctx.lineTo(tpts[tpts.length - 1].x, tpts[tpts.length - 1].y),
                                    ctx.stroke());
                            break;
                        case "rect":
                            tpts.length >= 2 &&
                                ((ctx.strokeStyle = path.color),
                                    (ctx.lineWidth = path.size),
                                    ctx.beginPath(),
                                    ctx.rect(
                                        tpts[0].x,
                                        tpts[0].y,
                                        tpts[1].x - tpts[0].x,
                                        tpts[1].y - tpts[0].y,
                                    ),
                                    path.fill && ((ctx.fillStyle = path.color), ctx.fill()),
                                    ctx.stroke());
                            break;
                        case "circle":
                            if (tpts.length >= 2) {
                                var rx = Math.abs(tpts[1].x - tpts[0].x) / 2,
                                    ry = Math.abs(tpts[1].y - tpts[0].y) / 2;
                                ((ctx.strokeStyle = path.color),
                                    (ctx.lineWidth = path.size),
                                    ctx.beginPath(),
                                    ctx.ellipse(
                                        (tpts[0].x + tpts[1].x) / 2,
                                        (tpts[0].y + tpts[1].y) / 2,
                                        Math.max(rx, 1),
                                        Math.max(ry, 1),
                                        0,
                                        0,
                                        2 * Math.PI,
                                    ),
                                    path.fill && ((ctx.fillStyle = path.color), ctx.fill()),
                                    ctx.stroke());
                            }
                            break;
                        case "star":
                            tpts.length >= 2 && drawStarPath(ctx, tpts[0], tpts[1], path);
                            break;
                        case "heart":
                            tpts.length >= 2 && drawHeartPath(ctx, tpts[0], tpts[1], path);
                            break;
                        default:
                            if (tpts.length >= 2) {
                                ((ctx.strokeStyle = path.color),
                                    (ctx.lineWidth = path.size),
                                    ctx.beginPath(),
                                    ctx.moveTo(tpts[0].x, tpts[0].y));
                                for (var i = 1; i < tpts.length; i++)
                                    ctx.lineTo(tpts[i].x, tpts[i].y);
                                ctx.stroke();
                            }
                    }
                }
                ((ctx.globalAlpha = 1), (ctx.globalCompositeOperation = "source-over"),
                    (ctx.shadowColor = "transparent"), (ctx.shadowBlur = 0), (ctx.shadowOffsetX = 0), (ctx.shadowOffsetY = 0));
            }
        }),
        (VP.renderAllPaths = function (ctx, fid, layer, CW, CH) {
            for (
                var paths = VP.getFramePaths(fid, layer), i = 0;
                i < paths.length;
                i++
            )
                VP.renderPath(ctx, paths[i], CW, CH);
        }),
        (VP.drawControlPoints = function (ctx, fid, layer, CW, CH, zoom) {
            for (
                var paths = VP.getFramePaths(fid, layer),
                r = C.CP_RADIUS / zoom,
                pi = 0;
                pi < paths.length;
                pi++
            )
                for (
                    var path = paths[pi],
                    isSelected = S.cpSelectedPath === path.id,
                    i = 0;
                    i < path.pts.length;
                    i++
                ) {
                    var pt = path.pts[i];
                    (ctx.beginPath(),
                        ctx.arc(pt.x, pt.y, r, 0, 2 * Math.PI),
                        isSelected && S.cpSelectedPoint === i
                            ? ((ctx.fillStyle = "#FF0000"),
                                ctx.fill(),
                                (ctx.strokeStyle = "#FFFFFF"),
                                (ctx.lineWidth = 2 / zoom),
                                ctx.stroke())
                            : isSelected
                                ? ((ctx.fillStyle = "#FF6600"),
                                    ctx.fill(),
                                    (ctx.strokeStyle = "#FFFFFF"),
                                    (ctx.lineWidth = 1.5 / zoom),
                                    ctx.stroke())
                                : ((ctx.fillStyle = "rgba(255,102,0,0.5)"),
                                    ctx.fill(),
                                    (ctx.strokeStyle = "rgba(255,255,255,0.7)"),
                                    (ctx.lineWidth = 1 / zoom),
                                    ctx.stroke()));
                }
        }),
        (VP.hitTestCP = function (fid, layer, x, y, zoom) {
            for (
                var paths = VP.getFramePaths(fid, layer),
                hr = C.CP_HIT_RADIUS / zoom,
                bestDist = hr * hr,
                bestPath = null,
                bestPt = -1,
                pi = 0;
                pi < paths.length;
                pi++
            )
                for (var path = paths[pi], i = 0; i < path.pts.length; i++) {
                    var pt = path.pts[i],
                        dx = pt.x - x,
                        dy = pt.y - y,
                        d2 = dx * dx + dy * dy;
                    d2 < bestDist &&
                        ((bestDist = d2), (bestPath = path.id), (bestPt = i));
                }
            return bestPath ? { pathId: bestPath, ptIdx: bestPt } : null;
        }),
        (VP.moveCP = function (fid, layer, pathId, ptIdx, nx, ny) {
            var path = VP.getFramePaths(fid, layer).find(function (p) {
                return p.id === pathId;
            });
            path &&
                path.pts[ptIdx] &&
                ((path.pts[ptIdx].x = nx), (path.pts[ptIdx].y = ny));
        }),
        (VP.erasePaths = function (fid, layer, eraserPts, eraserSize) {
            if (eraserPts && !(eraserPts.length < 2)) {
                var eraserHalf = 1.15 * eraserSize,
                    exPts = [],
                    p0 = eraserPts[0],
                    p1 = eraserPts[1],
                    dx = p0.x - p1.x,
                    dy = p0.y - p1.y,
                    dist = Math.sqrt(dx * dx + dy * dy) || 1;
                exPts.push({
                    x: p0.x + (dx / dist) * eraserSize,
                    y: p0.y + (dy / dist) * eraserSize,
                });
                for (var i = 0; i < eraserPts.length; i++) exPts.push(eraserPts[i]);
                var pn = eraserPts[eraserPts.length - 1],
                    pn1 = eraserPts[eraserPts.length - 2],
                    dxn = pn.x - pn1.x,
                    dyn = pn.y - pn1.y,
                    distn = Math.sqrt(dxn * dxn + dyn * dyn) || 1;
                exPts.push({
                    x: pn.x + (dxn / distn) * eraserSize,
                    y: pn.y + (dyn / distn) * eraserSize,
                });
                var eraserPoly = U.strokeToPolygon(
                    exPts.map(function (p) {
                        return { x: p.x, y: p.y };
                    }),
                    eraserHalf,
                );
                if (!(eraserPoly.length < 4)) {
                    for (var ring = [], ei = 0; ei < eraserPoly.length; ei++)
                        ring.push([eraserPoly[ei][0], eraserPoly[ei][1]]);
                    ring.length > 0 &&
                        (ring[0][0] !== ring[ring.length - 1][0] ||
                            ring[0][1] !== ring[ring.length - 1][1]) &&
                        ring.push([ring[0][0], ring[0][1]]);
                    for (
                        var paths = VP.getFramePaths(fid, layer), newPaths = [], pi = 0;
                        pi < paths.length;
                        pi++
                    ) {
                        var path = paths[pi];
                        if ("pen" === path.type || "line" === path.type) {
                            var pts =
                                path.smooth > 0 && path.pts.length >= 3
                                    ? U.stabilize(path.pts, path.smooth)
                                    : path.pts;
                            if (!pts || pts.length < 2) newPaths.push(path);
                            else {
                                for (
                                    var runs = [], curRun = [], si = 0;
                                    si < pts.length - 1;
                                    si++
                                ) {
                                    for (
                                        var clipped = clipSegment(pts[si], pts[si + 1], ring),
                                        ci2 = 0;
                                        ci2 < clipped.length;
                                        ci2++
                                    ) {
                                        var segPair = clipped[ci2],
                                            sp = segPair[0],
                                            ep = segPair[1];
                                        if (curRun.length > 0) {
                                            var last = curRun[curRun.length - 1],
                                                dx2 = sp.x - last.x,
                                                dy2 = sp.y - last.y;
                                            dx2 * dx2 + dy2 * dy2 > 0.01
                                                ? (curRun.length >= 2 && runs.push(curRun),
                                                    (curRun = [sp, ep]))
                                                : curRun.push(ep);
                                        } else (curRun.push(sp), curRun.push(ep));
                                    }
                                    0 === clipped.length &&
                                        curRun.length >= 2 &&
                                        (runs.push(curRun), (curRun = []));
                                }
                                curRun.length >= 2 && runs.push(curRun);
                                for (var ri = 0; ri < runs.length; ri++) {
                                    var run = runs[ri];
                                    if (!(run.length < 2)) {
                                        for (var runLen = 0, k = 1; k < run.length; k++)
                                            runLen += Math.hypot(
                                                run[k].x - run[k - 1].x,
                                                run[k].y - run[k - 1].y,
                                            );
                                        if (!(runLen < 1)) {
                                            for (
                                                var simplifiedRun = [run[0]], lastPt = run[0], m = 1;
                                                m < run.length - 1;
                                                m++
                                            ) {
                                                var dx3 = run[m].x - lastPt.x,
                                                    dy3 = run[m].y - lastPt.y;
                                                dx3 * dx3 + dy3 * dy3 > 4 &&
                                                    (simplifiedRun.push(run[m]), (lastPt = run[m]));
                                            }
                                            simplifiedRun.push(run[run.length - 1]);
                                            var np = Object.assign({}, path, {
                                                id: U.uid(),
                                                pts: simplifiedRun.map(function (p) {
                                                    return { x: p.x, y: p.y, p: p.p || 0.5 };
                                                }),
                                                smooth: 0,
                                            });
                                            newPaths.push(np);
                                        }
                                    }
                                }
                            }
                        } else {
                            var keep = !0;
                            if (path.pts && path.pts.length >= 2) {
                                for (var allIn = !0, ci = 0; ci < path.pts.length; ci++)
                                    if (!pointInPolygon(path.pts[ci].x, path.pts[ci].y, ring)) {
                                        allIn = !1;
                                        break;
                                    }
                                allIn && (keep = !1);
                            }
                            keep && newPaths.push(path);
                        }
                    }
                    var fm = S.vectorPaths.get(fid);
                    fm && fm.set(layer, newPaths);
                }
            }
        }),
        (VP.serializePaths = function (fid) {
            var fm = S.vectorPaths.get(fid);
            if (!fm) return {};
            var out = {};
            for (var entry of fm) {
                var layer = entry[0],
                    paths = entry[1];
                out[layer] = paths.map(function (p) {
                    return Object.assign({}, p, {
                        pts: p.pts.map(function (pt) {
                            return {
                                x: Math.round(100 * pt.x) / 100,
                                y: Math.round(100 * pt.y) / 100,
                                p: Math.round(100 * (pt.p || 0.5)) / 100,
                            };
                        }),
                    });
                });
            }
            return out;
        }),
        (VP.deserializePaths = function (fid, data) {
            if (data) {
                var fm = new Map();
                for (var layer in data)
                    data.hasOwnProperty(layer) &&
                        fm.set(
                            layer,
                            data[layer].map(function (p) {
                                return Object.assign({}, p, {
                                    pts: p.pts.map(function (pt) {
                                        return { x: pt.x, y: pt.y, p: pt.p || 0.5 };
                                    }),
                                });
                            }),
                        );
                S.vectorPaths.set(fid, fm);
            }
        }),
        (G.VectorPaths = VP));
})(window.UgokuDraw);
