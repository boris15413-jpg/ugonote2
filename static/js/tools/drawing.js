"use strict";
!(function (G) {
  var U = G.Utils,
    C = G.Config,
    R = G.Renderer,
    S = G.State,
    E = G.Engine,
    T = {};
  function simplifyDP(pts, tolerance) {
    if (!pts || pts.length <= 2) return pts;
    var sqTolerance = tolerance * tolerance,
      markers = new Uint8Array(pts.length);
    ((markers[0] = 1),
      (markers[pts.length - 1] = 1),
      (function dpStep(first, last) {
        for (
          var maxSqDist = 0,
          index = -1,
          p0 = pts[first],
          p1 = pts[last],
          dx = p1.x - p0.x,
          dy = p1.y - p0.y,
          l2 = dx * dx + dy * dy,
          i = first + 1;
          i < last;
          i++
        ) {
          var p = pts[i],
            sqDist = 0;
          if (0 === l2) {
            sqDist = (ddx = p.x - p0.x) * ddx + (ddy = p.y - p0.y) * ddy;
          } else {
            var t = ((p.x - p0.x) * dx + (p.y - p0.y) * dy) / l2;
            t = Math.max(0, Math.min(1, t));
            var ddx,
              ddy,
              px = p0.x + t * dx,
              py = p0.y + t * dy;
            sqDist = (ddx = p.x - px) * ddx + (ddy = p.y - py) * ddy;
          }
          sqDist > maxSqDist && ((index = i), (maxSqDist = sqDist));
        }
        maxSqDist > sqTolerance &&
          ((markers[index] = 1), dpStep(first, index), dpStep(index, last));
      })(0, pts.length - 1));
    for (var result = [], i = 0; i < pts.length; i++)
      markers[i] && result.push(pts[i]);
    return result;
  }
  function flattenPath(path) {
    var pts = path.pts;
    if (!pts || pts.length < 2) return pts;
    var smoothed =
      path.smooth > 0 && pts.length >= 3 && "cut_stroke" !== path.type
        ? U.stabilize(pts, path.smooth)
        : pts,
      flat = [];
    flat.push({ x: smoothed[0].x, y: smoothed[0].y, p: smoothed[0].p });
    for (var i = 0; i < smoothed.length - 1; i++)
      for (
        var p0 = smoothed[i],
        p1 = smoothed[i + 1],
        dist = Math.hypot(p1.x - p0.x, p1.y - p0.y),
        steps = Math.max(1, Math.ceil(dist / 2)),
        t = 1;
        t <= steps;
        t++
      ) {
        var s = t / steps;
        flat.push({
          x: p0.x + (p1.x - p0.x) * s,
          y: p0.y + (p1.y - p0.y) * s,
          p:
            void 0 !== p0.p && void 0 !== p1.p ? p0.p + (p1.p - p0.p) * s : 0.5,
        });
      }
    return flat;
  }
  if (
    ((T.drawPenStroke = function () {
      var ctx = R.contexts.strokeC,
        dpr = C.DPR;
      (ctx.save(),
        ctx.setTransform(1, 0, 0, 1, 0, 0),
        ctx.clearRect(0, 0, S.CW * dpr, S.CH * dpr),
        ctx.restore(),
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0));
      var pts = S.pts;
      pts.length &&
        (S.penSmooth > 0 && (pts = U.stabilize(pts, S.penSmooth)),
          S.penOut &&
          R.drawSmoothLine(
            ctx,
            pts,
            S.cs + 2 * S.penOutW,
            S.penOutC,
            S.pressure,
          ),
          R.drawSmoothLine(ctx, pts, S.cs, S.cc, S.pressure),
          "none" !== S.symmetry &&
          (function (ctx, pts) {
            var CW = S.CW,
              CH = S.CH,
              transforms = [];
            ("h" !== S.symmetry && "4" !== S.symmetry) ||
              transforms.push(function (p) {
                return { x: CW - p.x, y: p.y, p: p.p };
              });
            ("v" !== S.symmetry && "4" !== S.symmetry) ||
              transforms.push(function (p) {
                return { x: p.x, y: CH - p.y, p: p.p };
              });
            "4" === S.symmetry &&
              transforms.push(function (p) {
                return { x: CW - p.x, y: CH - p.y, p: p.p };
              });
            transforms.forEach(function (tf) {
              var m = pts.map(tf);
              (S.penOut &&
                R.drawSmoothLine(
                  ctx,
                  m,
                  S.cs + 2 * S.penOutW,
                  S.penOutC,
                  S.pressure,
                ),
                R.drawSmoothLine(ctx, m, S.cs, S.cc, S.pressure));
            });
          })(ctx, pts));
    }),
      (T.commitPenStroke = function () {
        var dpr = C.DPR,
          sc = R.contexts.strokeC;
        if (
          (sc.save(),
            sc.setTransform(1, 0, 0, 1, 0, 0),
            sc.clearRect(0, 0, S.CW * dpr, S.CH * dpr),
            sc.restore(),
            sc.setTransform(dpr, 0, 0, dpr, 0, 0),
            (R.canvases.strokeC.style.opacity = 1),
            S.pts.length > 0 && G.VectorPaths)
        ) {
          var vp = G.VectorPaths.createPath("pen", S.pts, {
            color: S.cc,
            size: S.cs,
            alpha: S.alpha,
            outline: S.penOut,
            outlineColor: S.penOutC,
            outlineWidth: S.penOutW,
            smooth: S.penSmooth,
            pressure: S.pressure,
            symmetry: S.symmetry,
            brushType: S.brushType || "normal",
            fillType: S.fillType || "solid",
            shadow: S.shadow || "none",
          });
          (G.VectorPaths.addPath(E.curId(), S.cl, vp),
            E.redrawSingleVectorLayer(E.curId(), S.cl));
        }
      }),
      (T.drawEraserPreview = function () {
        var pts = S.pts;
        if (1 === pts.length) {
          E.pushUndo();
          var rCtx = E.curX(),
            vCtx = E.curVX();
          return (
            rCtx &&
            (rCtx.save(),
              (rCtx.globalCompositeOperation = "destination-out"),
              (rCtx.globalAlpha = 1),
              rCtx.beginPath(),
              rCtx.arc(pts[0].x, pts[0].y, S.cs, 0, 2 * Math.PI),
              rCtx.fill(),
              rCtx.restore()),
            void (
              vCtx &&
              (vCtx.save(),
                (vCtx.globalCompositeOperation = "destination-out"),
                (vCtx.globalAlpha = 1),
                vCtx.beginPath(),
                vCtx.arc(pts[0].x, pts[0].y, S.cs, 0, 2 * Math.PI),
                vCtx.fill(),
                vCtx.restore())
            )
          );
        }
        if (!(pts.length < 2)) {
          var p1 = pts[pts.length - 2],
            p2 = pts[pts.length - 1];
          ((rCtx = E.curX()), (vCtx = E.curVX()));
          (rCtx &&
            (rCtx.save(),
              (rCtx.globalCompositeOperation = "destination-out"),
              (rCtx.globalAlpha = 1),
              (rCtx.lineWidth = 2 * S.cs),
              (rCtx.lineCap = "round"),
              (rCtx.lineJoin = "round"),
              rCtx.beginPath(),
              rCtx.moveTo(p1.x, p1.y),
              rCtx.lineTo(p2.x, p2.y),
              rCtx.stroke(),
              rCtx.restore()),
            vCtx &&
            (vCtx.save(),
              (vCtx.globalCompositeOperation = "destination-out"),
              (vCtx.globalAlpha = 1),
              (vCtx.lineWidth = 2 * S.cs),
              (vCtx.lineCap = "round"),
              (vCtx.lineJoin = "round"),
              vCtx.beginPath(),
              vCtx.moveTo(p1.x, p1.y),
              vCtx.lineTo(p2.x, p2.y),
              vCtx.stroke(),
              vCtx.restore()));
        }
      }),
      (T.commitEraser = function () {
        if (0 !== S.pts.length) {
          G.VectorPaths && G.VectorPaths.erasePaths(E.curId(), S.cl, S.pts, S.cs);
          var dpr = C.DPR,
            sc = R.contexts.strokeC;
          (sc.save(),
            sc.setTransform(1, 0, 0, 1, 0, 0),
            sc.clearRect(0, 0, S.CW * dpr, S.CH * dpr),
            sc.restore(),
            sc.setTransform(dpr, 0, 0, dpr, 0, 0),
            E.commitUndo());
        }
      }),
      (T.floodFill = function (sx, sy) {
        var ctx = E.curX(),
          dpr = C.DPR,
          id = ctx.getImageData(0, 0, S.CW * dpr, S.CH * dpr),
          tc2 = document.createElement("canvas").getContext("2d");
        ((tc2.fillStyle = S.cc), tc2.fillRect(0, 0, 1, 1));
        var fc = tc2.getImageData(0, 0, 1, 1).data,
          fillX = Math.floor(sx * dpr),
          fillY = Math.floor(sy * dpr);
        var tmpC = document.createElement("canvas");
        tmpC.width = S.CW * dpr;
        tmpC.height = S.CH * dpr;
        var tCtx = tmpC.getContext("2d");
        if (E.curC()) tCtx.drawImage(E.curC(), 0, 0);
        if (E.curVC()) tCtx.drawImage(E.curVC(), 0, 0);
        var refId = tCtx.getImageData(0, 0, S.CW * dpr, S.CH * dpr);
        E.W
          ? E.workerCall(
            {
              type: "floodFill",
              w: S.CW * dpr,
              h: S.CH * dpr,
              data: id.data.buffer,
              refData: refId.data.buffer,
              sx: fillX,
              sy: fillY,
              fillR: fc[0],
              fillG: fc[1],
              fillB: fc[2],
              tol: 30,
            },
            [id.data.buffer, refId.data.buffer],
          ).then(function (d) {
            (ctx.save(),
              ctx.setTransform(1, 0, 0, 1, 0, 0),
              ctx.putImageData(
                new ImageData(
                  new Uint8ClampedArray(d.data),
                  S.CW * dpr,
                  S.CH * dpr,
                ),
                0,
                0,
              ),
              ctx.restore(),
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0),
              E.commitUndo(),
              E.afterEdit());
          })
          : (!(function (id, refId, w, h, sx, sy, fc) {
            var outD = id.data, refD = refId.data;
            if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;
            var i0 = 4 * (sy * w + sx),
              tr = refD[i0],
              tg = refD[i0 + 1],
              tb = refD[i0 + 2],
              ta = refD[i0 + 3];
            if (tr === fc[0] && tg === fc[1] && tb === fc[2] && 255 === ta)
              return;
            var tol = 30,
              m = function (i) {
                return (
                  Math.abs(refD[i] - tr) <= tol &&
                  Math.abs(refD[i + 1] - tg) <= tol &&
                  Math.abs(refD[i + 2] - tb) <= tol &&
                  Math.abs(refD[i + 3] - ta) <= tol
                );
              },
              vis = new Uint8Array(w * h),
              q = [sy * w + sx];
            vis[sy * w + sx] = 1;
            for (; q.length;) {
              for (
                var pi = q.pop(), px = pi % w, py = (pi / w) | 0, lx = px;
                lx > 0 && !vis[py * w + lx - 1] && m(4 * (py * w + lx - 1));
              )
                vis[py * w + --lx] = 1;
              for (
                var rx = px;
                rx < w - 1 && !vis[py * w + rx + 1] && m(4 * (py * w + rx + 1));
              )
                vis[py * w + ++rx] = 1;
              for (var x = lx; x <= rx; x++) {
                var idx = 4 * (py * w + x);
                ((outD[idx] = fc[0]),
                  (outD[idx + 1] = fc[1]),
                  (outD[idx + 2] = fc[2]),
                  (outD[idx + 3] = 255));
                for (
                  var nyArr = [py - 1, py + 1], ni = 0;
                  ni < nyArr.length;
                  ni++
                ) {
                  var ny = nyArr[ni];
                  if (ny >= 0 && ny < h) {
                    var nIdx = ny * w + x;
                    !vis[nIdx] &&
                      m(4 * nIdx) &&
                      ((vis[nIdx] = 1), q.push(nIdx));
                  }
                }
              }
            }
          })(id, refId, S.CW * dpr, S.CH * dpr, fillX, fillY, fc),
            ctx.save(),
            ctx.setTransform(1, 0, 0, 1, 0, 0),
            ctx.putImageData(id, 0, 0),
            ctx.restore(),
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0),
            E.commitUndo(),
            E.afterEdit());
      }),
      (T.drawPixel = function (x, y) {
        var ctx = E.curX(),
          ps = S.pixelSize,
          gx = Math.floor(x / ps) * ps,
          gy = Math.floor(y / ps) * ps;
        ((ctx.globalAlpha = S.alpha),
          (ctx.fillStyle = S.cc),
          (ctx.imageSmoothingEnabled = !1),
          ctx.fillRect(gx, gy, ps, ps),
          (ctx.imageSmoothingEnabled = !0),
          (ctx.globalAlpha = 1));
      }),
      (T.erasePixel = function (x, y) {
        var ctx = E.curX(),
          ps = S.pixelSize,
          gx = Math.floor(x / ps) * ps,
          gy = Math.floor(y / ps) * ps;
        ctx.clearRect(gx, gy, ps, ps);
      }),
      (T.drawPixelLine = function (x0, y0, x1, y1, erase) {
        var ps = S.pixelSize,
          gx0 = Math.floor(x0 / ps),
          gy0 = Math.floor(y0 / ps),
          gx1 = Math.floor(x1 / ps),
          gy1 = Math.floor(y1 / ps),
          dx = Math.abs(gx1 - gx0),
          dy = -Math.abs(gy1 - gy0),
          sx = gx0 < gx1 ? 1 : -1,
          sy = gy0 < gy1 ? 1 : -1,
          err = dx + dy,
          cx = gx0,
          cy = gy0,
          ctx = E.curX();
        for (
          ctx.imageSmoothingEnabled = !1;
          erase
            ? ctx.clearRect(cx * ps, cy * ps, ps, ps)
            : ((ctx.globalAlpha = S.alpha),
              (ctx.fillStyle = S.cc),
              ctx.fillRect(cx * ps, cy * ps, ps, ps),
              (ctx.globalAlpha = 1)),
          cx !== gx1 || cy !== gy1;
        ) {
          var e2 = 2 * err;
          (e2 >= dy && ((err += dy), (cx += sx)),
            e2 <= dx && ((err += dx), (cy += sy)));
        }
        ctx.imageSmoothingEnabled = !0;
      }),
      (T.drawShapePreview = function (pt) {
        var dc = R.contexts.drC;
        switch (
        (dc.clearRect(0, 0, S.CW, S.CH),
          (dc.lineCap = "round"),
          (dc.lineJoin = "round"),
          (dc.globalAlpha = S.alpha),
          (dc.strokeStyle = S.cc),
          (dc.lineWidth = S.cs),
          S.shapeFill && (dc.fillStyle = S.cc),
          S.ct)
        ) {
          case "line":
            (S.penOut &&
              ((dc.strokeStyle = S.penOutC),
                (dc.lineWidth = S.cs + 2 * S.penOutW),
                dc.beginPath(),
                dc.moveTo(S.sx, S.sy),
                dc.lineTo(pt.x, pt.y),
                dc.stroke()),
              (dc.strokeStyle = S.cc),
              (dc.lineWidth = S.cs),
              dc.beginPath(),
              dc.moveTo(S.sx, S.sy),
              dc.lineTo(pt.x, pt.y),
              dc.stroke());
            break;
          case "rect":
            (dc.beginPath(),
              dc.rect(S.sx, S.sy, pt.x - S.sx, pt.y - S.sy),
              S.shapeFill && dc.fill(),
              dc.stroke());
            break;
          case "circle":
            var crx = Math.abs(pt.x - S.sx) / 2,
              cry = Math.abs(pt.y - S.sy) / 2;
            (dc.beginPath(),
              dc.ellipse(
                (S.sx + pt.x) / 2,
                (S.sy + pt.y) / 2,
                Math.max(crx, 1),
                Math.max(cry, 1),
                0,
                0,
                2 * Math.PI,
              ),
              S.shapeFill && dc.fill(),
              dc.stroke());
            break;
          case "star":
            var scx = (S.sx + pt.x) / 2,
              scy = (S.sy + pt.y) / 2,
              outerR = Math.max(Math.abs(pt.x - S.sx), Math.abs(pt.y - S.sy)) / 2,
              innerR = 0.4 * outerR;
            dc.beginPath();
            for (var i = 0; i < 10; i++) {
              var a = (i * Math.PI) / 5 - Math.PI / 2,
                r = i % 2 == 0 ? outerR : innerR;
              0 === i
                ? dc.moveTo(scx + Math.cos(a) * r, scy + Math.sin(a) * r)
                : dc.lineTo(scx + Math.cos(a) * r, scy + Math.sin(a) * r);
            }
            (dc.closePath(), S.shapeFill && dc.fill(), dc.stroke());
            break;
          case "heart":
            var hcx = (S.sx + pt.x) / 2,
              hcy = (S.sy + pt.y) / 2,
              hw = Math.abs(pt.x - S.sx),
              hh = Math.abs(pt.y - S.sy);
            (dc.beginPath(),
              dc.moveTo(hcx, hcy + 0.35 * hh),
              dc.bezierCurveTo(
                hcx - 0.5 * hw,
                hcy - 0.1 * hh,
                hcx - 0.5 * hw,
                hcy - 0.45 * hh,
                hcx,
                hcy - 0.15 * hh,
              ),
              dc.bezierCurveTo(
                hcx + 0.5 * hw,
                hcy - 0.45 * hh,
                hcx + 0.5 * hw,
                hcy - 0.1 * hh,
                hcx,
                hcy + 0.35 * hh,
              ),
              dc.closePath(),
              S.shapeFill && dc.fill(),
              dc.stroke());
        }
        dc.globalAlpha = 1;
      }),
      (T.commitShape = function (pt) {
        if (G.VectorPaths) {
          var steps,
            p0 = { x: S.sx, y: S.sy },
            p1 = { x: pt.x, y: pt.y },
            pts = [];
          if ("line" === S.ct) {
            steps = Math.max(
              2,
              Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2),
            );
            for (var i = 0; i <= steps; i++)
              pts.push({
                x: p0.x + (i / steps) * (p1.x - p0.x),
                y: p0.y + (i / steps) * (p1.y - p0.y),
                p: 0.5,
              });
          } else if ("rect" === S.ct) {
            var addLine = function (sx, sy, ex, ey) {
              for (
                var st = Math.max(2, Math.ceil(Math.hypot(ex - sx, ey - sy) / 2)),
                i = 0;
                i < st;
                i++
              )
                pts.push({
                  x: sx + (i / st) * (ex - sx),
                  y: sy + (i / st) * (ey - sy),
                  p: 0.5,
                });
            };
            (addLine(p0.x, p0.y, p1.x, p0.y),
              addLine(p1.x, p0.y, p1.x, p1.y),
              addLine(p1.x, p1.y, p0.x, p1.y),
              addLine(p0.x, p1.y, p0.x, p0.y),
              pts.push({ x: p0.x, y: p0.y, p: 0.5 }));
          } else if ("circle" === S.ct) {
            var cx = (p0.x + p1.x) / 2,
              cy = (p0.y + p1.y) / 2,
              rx = Math.abs(p1.x - p0.x) / 2,
              ry = Math.abs(p1.y - p0.y) / 2;
            steps = Math.max(8, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / 2));
            for (i = 0; i <= steps; i++)
              pts.push({
                x: cx + Math.cos((i / steps) * Math.PI * 2) * rx,
                y: cy + Math.sin((i / steps) * Math.PI * 2) * ry,
                p: 0.5,
              });
          } else if ("star" === S.ct) {
            var scx = (p0.x + p1.x) / 2,
              scy = (p0.y + p1.y) / 2,
              outerR = Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)) / 2,
              innerR = 0.4 * outerR,
              starPts = [];
            for (i = 0; i < 10; i++)
              starPts.push({
                x:
                  scx +
                  Math.cos((i * Math.PI) / 5 - Math.PI / 2) *
                  (i % 2 == 0 ? outerR : innerR),
                y:
                  scy +
                  Math.sin((i * Math.PI) / 5 - Math.PI / 2) *
                  (i % 2 == 0 ? outerR : innerR),
              });
            starPts.push(starPts[0]);
            for (var j = 0; j < 10; j++)
              for (
                var st = Math.max(
                  2,
                  Math.ceil(
                    Math.hypot(
                      starPts[j + 1].x - starPts[j].x,
                      starPts[j + 1].y - starPts[j].y,
                    ) / 2,
                  ),
                ),
                k = 0;
                k < st;
                k++
              )
                pts.push({
                  x: starPts[j].x + (starPts[j + 1].x - starPts[j].x) * (k / st),
                  y: starPts[j].y + (starPts[j + 1].y - starPts[j].y) * (k / st),
                  p: 0.5,
                });
            pts.push({ x: starPts[0].x, y: starPts[0].y, p: 0.5 });
          } else if ("heart" === S.ct) {
            var hcx = (p0.x + p1.x) / 2,
              hcy = (p0.y + p1.y) / 2,
              hw = Math.abs(p1.x - p0.x),
              hh = Math.abs(p1.y - p0.y);
            steps = Math.max(20, Math.ceil((hw + hh) / 2));
            for (i = 0; i <= steps; i++) {
              var x,
                y,
                st2,
                t = i / steps;
              (t < 0.5
                ? ((st2 = 2 * t),
                  (x =
                    Math.pow(1 - st2, 3) * hcx +
                    3 * Math.pow(1 - st2, 2) * st2 * (hcx - 0.5 * hw) +
                    3 * (1 - st2) * Math.pow(st2, 2) * (hcx - 0.5 * hw) +
                    Math.pow(st2, 3) * hcx),
                  (y =
                    Math.pow(1 - st2, 3) * (hcy + 0.35 * hh) +
                    3 * Math.pow(1 - st2, 2) * st2 * (hcy - 0.1 * hh) +
                    3 * (1 - st2) * Math.pow(st2, 2) * (hcy - 0.45 * hh) +
                    Math.pow(st2, 3) * (hcy - 0.15 * hh)))
                : ((st2 = 2 * (t - 0.5)),
                  (x =
                    Math.pow(1 - st2, 3) * hcx +
                    3 * Math.pow(1 - st2, 2) * st2 * (hcx + 0.5 * hw) +
                    3 * (1 - st2) * Math.pow(st2, 2) * (hcx + 0.5 * hw) +
                    Math.pow(st2, 3) * hcx),
                  (y =
                    Math.pow(1 - st2, 3) * (hcy - 0.15 * hh) +
                    3 * Math.pow(1 - st2, 2) * st2 * (hcy - 0.45 * hh) +
                    3 * (1 - st2) * Math.pow(st2, 2) * (hcy - 0.1 * hh) +
                    Math.pow(st2, 3) * (hcy + 0.35 * hh))),
                pts.push({ x: x, y: y, p: 0.5 }));
            }
          }
          pts = simplifyDP(pts, 0.5);
          var vp = G.VectorPaths.createPath("cut_stroke", pts, {
            color: S.cc,
            size: S.cs,
            alpha: S.alpha,
            outline: S.penOut,
            outlineColor: S.penOutC,
            outlineWidth: S.penOutW,
            smooth: 0,
            pressure: !1,
            fill: S.shapeFill,
            symmetry: S.symmetry,
          });
          (G.VectorPaths.addPath(E.curId(), S.cl, vp),
            E.redrawSingleVectorLayer(E.curId(), S.cl));
        }
      }),
      (T.eyedrop = function (x, y) {
        var dpr = C.DPR,
          px = Math.floor(x * dpr),
          py = Math.floor(y * dpr);
        if (px < 0 || px >= S.CW * dpr || py < 0 || py >= S.CH * dpr) return null;
        var tmp = document.createElement("canvas");
        ((tmp.width = S.CW * dpr), (tmp.height = S.CH * dpr));
        var tc = tmp.getContext("2d");
        return (
          (tc.fillStyle = S.pc),
          tc.fillRect(0, 0, S.CW * dpr, S.CH * dpr),
          R.canvases.lPhoto && "none" !== R.canvases.lPhoto.style.display && tc.drawImage(R.canvases.lPhoto, 0, 0),
          S.layerOrder.forEach(function (l) {
            var rc = R.getRasterCanvas(l),
              vc = R.getVectorCanvas(l);
            (rc && "none" !== rc.style.display && tc.drawImage(rc, 0, 0),
              vc && "none" !== vc.style.display && tc.drawImage(vc, 0, 0));
          }),
          U.rgbToHex.apply(null, tc.getImageData(px, py, 1, 1).data)
        );
      }),
      (T.drawEyedropPreview = function (x, y, color) {
        var ctx = R.contexts.cursorC;
        ctx &&
          (ctx.clearRect(0, 0, S.CW, S.CH),
            (ctx.strokeStyle = "#333"),
            (ctx.lineWidth = 2),
            ctx.beginPath(),
            ctx.arc(x, y, 16, 0, 2 * Math.PI),
            ctx.stroke(),
            (ctx.fillStyle = color || S.cc),
            ctx.beginPath(),
            ctx.arc(x, y, 14, 0, 2 * Math.PI),
            ctx.fill());
      }),
      (T.startImagePlace = function (imgEl) {
        var a = imgEl.width / imgEl.height,
          ca = S.CW / S.CH,
          bw = a > ca ? S.CW : S.CH * a,
          bh = a > ca ? S.CW / a : S.CH;
        ((S.img = {
          el: imgEl,
          x: S.CW / 2,
          y: S.CH / 2,
          bw: bw,
          bh: bh,
          sc: 1,
          rot: 0,
        }),
          U.$("imgHud").classList.add("show"),
          T.drawImagePreview());
      }),
      (T.drawImagePreview = function () {
        if (S.img) {
          var ctx = R.contexts.floatC;
          ctx.clearRect(0, 0, S.CW, S.CH);
          var im = S.img,
            dw = im.bw * im.sc,
            dh = im.bh * im.sc;
          (ctx.save(),
            ctx.translate(im.x, im.y),
            im.rot && ctx.rotate((im.rot * Math.PI) / 180),
            (ctx.globalAlpha = 0.85),
            (ctx.imageSmoothingEnabled = !0),
            (ctx.imageSmoothingQuality = "high"),
            ctx.drawImage(im.el, -dw / 2, -dh / 2, dw, dh),
            (ctx.globalAlpha = 1),
            (ctx.strokeStyle = "#FF6600"),
            (ctx.lineWidth = 2),
            ctx.setLineDash([6, 4]),
            ctx.strokeRect(-dw / 2, -dh / 2, dw, dh),
            ctx.setLineDash([]),
            ctx.restore());
        }
      }),
      (T.commitImage = function () {
        if (S.img) {
          E.pushUndo();
          var im = S.img,
            ctx = E.curX();
          (ctx.save(),
            ctx.translate(im.x, im.y),
            im.rot && ctx.rotate((im.rot * Math.PI) / 180),
            (ctx.imageSmoothingEnabled = !0),
            (ctx.imageSmoothingQuality = "high"),
            ctx.drawImage(
              im.el,
              (-im.bw * im.sc) / 2,
              (-im.bh * im.sc) / 2,
              im.bw * im.sc,
              im.bh * im.sc,
            ),
            ctx.restore(),
            R.contexts.floatC.clearRect(0, 0, S.CW, S.CH),
            (S.img = null),
            U.$("imgHud").classList.remove("show"),
            E.commitUndo(),
            E.afterEdit(),
            E.toast("画像配置完了"));
        }
      }),
      (T.cancelImage = function () {
        (R.contexts.floatC.clearRect(0, 0, S.CW, S.CH),
          (S.img = null),
          U.$("imgHud").classList.remove("show"));
      }),
      (T.selectionAction = function (mode) {
        if (
          (U.$("selModal").classList.remove("show"),
            (U.$("selBox").style.display = "none"),
            U.$("lassoPath").setAttribute("d", ""),
            G.UI && G.UI.showSelZoomBtn(!1),
            S.sel)
        ) {
          var dpr = C.DPR,
            pW = Math.ceil(S.sel.w * dpr),
            pH = Math.ceil(S.sel.h * dpr),
            pX = Math.floor(S.sel.x * dpr),
            pY = Math.floor(S.sel.y * dpr),
            pathsInfo = (function () {
              var selected = [],
                remaining = [];
              if (!G.VectorPaths)
                return { selected: selected, remaining: remaining };
              for (
                var paths = G.VectorPaths.getFramePaths(E.curId(), S.cl),
                minX = S.sel.x,
                minY = S.sel.y,
                maxX = minX + S.sel.w,
                maxY = minY + S.sel.h,
                hl = S.sel.lasso,
                pointInPoly = function (px, py) {
                  if (!hl)
                    return px >= minX && px <= maxX && py >= minY && py <= maxY;
                  for (
                    var inPoly = !1, k = 0, l = hl.length - 1;
                    k < hl.length;
                    l = k++
                  ) {
                    var xik = hl[k].x,
                      yik = hl[k].y,
                      xil = hl[l].x,
                      yil = hl[l].y;
                    yik > py != yil > py &&
                      px < ((xil - xik) * (py - yik)) / (yil - yik) + xik &&
                      (inPoly = !inPoly);
                  }
                  return inPoly;
                },
                i = 0;
                i < paths.length;
                i++
              ) {
                for (
                  var p = JSON.parse(JSON.stringify(paths[i])),
                  densePts = flattenPath(p),
                  currentSelectedRun = [],
                  currentRemainingRun = [],
                  j = 0;
                  j < densePts.length;
                  j++
                ) {
                  var pt = densePts[j];
                  if (pointInPoly(pt.x, pt.y)) {
                    if (
                      (currentSelectedRun.push(pt),
                        currentRemainingRun.length > 0)
                    ) {
                      var remP = JSON.parse(JSON.stringify(p));
                      ((remP.id = U.uid()),
                        (remP.pts = simplifyDP(currentRemainingRun, 0.8)),
                        (remP.smooth = 0),
                        (remP.type = "cut_stroke"),
                        remaining.push(remP),
                        (currentRemainingRun = []));
                    }
                  } else if (
                    (currentRemainingRun.push(pt), currentSelectedRun.length > 0)
                  ) {
                    var selP = JSON.parse(JSON.stringify(p));
                    ((selP.id = U.uid()),
                      (selP.pts = simplifyDP(currentSelectedRun, 0.8)),
                      (selP.smooth = 0),
                      (selP.type = "cut_stroke"),
                      selected.push(selP),
                      (currentSelectedRun = []));
                  }
                }
                if (currentSelectedRun.length > 0) {
                  var selP2 = JSON.parse(JSON.stringify(p));
                  ((selP2.id = U.uid()),
                    (selP2.pts = simplifyDP(currentSelectedRun, 0.8)),
                    (selP2.smooth = 0),
                    (selP2.type = "cut_stroke"),
                    selected.push(selP2));
                }
                if (currentRemainingRun.length > 0) {
                  var remP2 = JSON.parse(JSON.stringify(p));
                  ((remP2.id = U.uid()),
                    (remP2.pts = simplifyDP(currentRemainingRun, 0.8)),
                    (remP2.smooth = 0),
                    (remP2.type = "cut_stroke"),
                    remaining.push(remP2));
                }
              }
              return { selected: selected, remaining: remaining };
            })();
          if ("copy" === mode) {
            var tmp = document.createElement("canvas");
            ((tmp.width = pW), (tmp.height = pH));
            var tc = tmp.getContext("2d");
            return (
              S.sel.lasso &&
              (tc.beginPath(),
                S.sel.lasso.forEach(function (p, i) {
                  var cx = (p.x - S.sel.x) * dpr,
                    cy = (p.y - S.sel.y) * dpr;
                  i ? tc.lineTo(cx, cy) : tc.moveTo(cx, cy);
                }),
                tc.closePath(),
                tc.clip()),
              tc.drawImage(E.curC(), pX, pY, pW, pH, 0, 0, pW, pH),
              (S.clip = {
                canvas: tmp,
                vectors: pathsInfo.selected,
                cx: S.sel.x + S.sel.w / 2,
                cy: S.sel.y + S.sel.h / 2,
              }),
              (S.sel = null),
              (S.lassoPath = []),
              (S.ct = "paste"),
              U.$$("[data-tool]").forEach(function (b) {
                b.classList.remove("on");
              }),
              void E.toast("コピーしました")
            );
          }
          if ("cut" === mode) {
            if ((E.pushUndo(), G.VectorPaths))
              ((fm = S.vectorPaths.get(E.curId())) &&
                fm.set(S.cl, pathsInfo.remaining),
                E.redrawSingleVectorLayer(E.curId(), S.cl));
            var ctx = E.curX();
            return (
              S.sel.lasso
                ? (ctx.save(),
                  ctx.setTransform(dpr, 0, 0, dpr, 0, 0),
                  ctx.beginPath(),
                  S.sel.lasso.forEach(function (p, i) {
                    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
                  }),
                  ctx.closePath(),
                  ctx.clip(),
                  ctx.setTransform(1, 0, 0, 1, 0, 0),
                  (ctx.globalCompositeOperation = "destination-out"),
                  (ctx.fillStyle = "black"),
                  ctx.fillRect(0, 0, S.CW * dpr, S.CH * dpr),
                  (ctx.globalCompositeOperation = "source-over"),
                  ctx.restore())
                : (ctx.save(),
                  ctx.setTransform(1, 0, 0, 1, 0, 0),
                  ctx.clearRect(pX, pY, pW, pH),
                  ctx.restore()),
              E.commitUndo(),
              E.afterEdit(),
              (S.sel = null),
              (S.lassoPath = []),
              void E.toast("切り取りました")
            );
          }
          if ("transform" === mode) {
            var tmp2 = document.createElement("canvas");
            ((tmp2.width = pW), (tmp2.height = pH));
            var tc2 = tmp2.getContext("2d");
            (S.sel.lasso &&
              (tc2.beginPath(),
                S.sel.lasso.forEach(function (p, i) {
                  var cx2 = (p.x - S.sel.x) * dpr,
                    cy2 = (p.y - S.sel.y) * dpr;
                  i ? tc2.lineTo(cx2, cy2) : tc2.moveTo(cx2, cy2);
                }),
                tc2.closePath(),
                tc2.clip()),
              tc2.drawImage(E.curC(), pX, pY, pW, pH, 0, 0, pW, pH));
            var fm,
              originalRaster = E.curX().getImageData(
                0,
                0,
                S.CW * dpr,
                S.CH * dpr,
              ),
              originalVectors = G.VectorPaths
                ? JSON.parse(
                  JSON.stringify(G.VectorPaths.getFramePaths(E.curId(), S.cl)),
                )
                : [];
            if (G.VectorPaths)
              ((fm = S.vectorPaths.get(E.curId())) &&
                fm.set(S.cl, pathsInfo.remaining),
                E.redrawSingleVectorLayer(E.curId(), S.cl));
            ctx = E.curX();
            (S.sel.lasso
              ? (ctx.save(),
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0),
                ctx.beginPath(),
                S.sel.lasso.forEach(function (p, i) {
                  i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
                }),
                ctx.closePath(),
                ctx.clip(),
                ctx.setTransform(1, 0, 0, 1, 0, 0),
                (ctx.globalCompositeOperation = "destination-out"),
                (ctx.fillStyle = "black"),
                ctx.fillRect(0, 0, S.CW * dpr, S.CH * dpr),
                (ctx.globalCompositeOperation = "source-over"),
                ctx.restore())
              : (ctx.save(),
                ctx.setTransform(1, 0, 0, 1, 0, 0),
                ctx.clearRect(pX, pY, pW, pH),
                ctx.restore()),
              (S.transformMode = !0),
              (S.transformData = {
                canvas: tmp2,
                vectors: pathsInfo.selected,
                originalRaster: originalRaster,
                originalVectors: originalVectors,
                x: S.sel.x + S.sel.w / 2,
                y: S.sel.y + S.sel.h / 2,
                w: S.sel.w,
                h: S.sel.h,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                origBounds: {
                  cx: S.sel.x + S.sel.w / 2,
                  cy: S.sel.y + S.sel.h / 2,
                },
              }),
              (S.sel = null),
              (S.lassoPath = []),
              T.drawTransformPreview(),
              U.$("transformHud").classList.add("show"));
          }
        }
      }),
      (T.drawTransformPreview = function () {
        if (S.transformData) {
          var ctx = R.contexts.floatC;
          ctx.clearRect(0, 0, S.CW, S.CH);
          var td = S.transformData,
            dw = td.w * td.scaleX,
            dh = td.h * td.scaleY;
          if (
            (ctx.save(),
              ctx.translate(td.x, td.y),
              ctx.rotate((td.rotation * Math.PI) / 180),
              (ctx.globalAlpha = 0.85),
              (ctx.imageSmoothingEnabled = !0),
              ctx.drawImage(td.canvas, -dw / 2, -dh / 2, dw, dh),
              td.vectors && td.vectors.length > 0 && G.VectorPaths)
          ) {
            (ctx.scale(td.scaleX, td.scaleY),
              ctx.translate(-td.origBounds.cx, -td.origBounds.cy));
            for (var i = 0; i < td.vectors.length; i++)
              G.VectorPaths.renderPath(ctx, td.vectors[i], S.CW, S.CH);
          }
          (ctx.restore(),
            (ctx.strokeStyle = "#FF6600"),
            (ctx.lineWidth = 2 / S.zoom),
            ctx.setLineDash([6, 4]),
            ctx.strokeRect(td.x - dw / 2, td.y - dh / 2, dw, dh),
            ctx.setLineDash([]));
          var hr = 5 / S.zoom;
          ((ctx.fillStyle = "#FF6600"),
            [
              [td.x - dw / 2, td.y - dh / 2],
              [td.x + dw / 2, td.y - dh / 2],
              [td.x - dw / 2, td.y + dh / 2],
              [td.x + dw / 2, td.y + dh / 2],
              [td.x, td.y - dh / 2],
              [td.x, td.y + dh / 2],
              [td.x - dw / 2, td.y],
              [td.x + dw / 2, td.y],
            ].forEach(function (h) {
              ctx.fillRect(h[0] - hr, h[1] - hr, 2 * hr, 2 * hr);
            }));
        }
      }),
      (T.commitTransform = function () {
        if (S.transformData) {
          var td = S.transformData;
          ((S.transformData = null),
            U.$("transformHud").classList.remove("show"));
          var fm,
            currentRaster = E.curX().getImageData(
              0,
              0,
              S.CW * C.DPR,
              S.CH * C.DPR,
            ),
            currentVectors = G.VectorPaths
              ? JSON.parse(
                JSON.stringify(G.VectorPaths.getFramePaths(E.curId(), S.cl)),
              )
              : [];
          if ((E.curX().putImageData(td.originalRaster, 0, 0), G.VectorPaths))
            (fm = S.vectorPaths.get(E.curId())) &&
              fm.set(S.cl, td.originalVectors);
          if (
            (E.pushUndo(),
              E.curX().putImageData(currentRaster, 0, 0),
              G.VectorPaths)
          )
            (fm = S.vectorPaths.get(E.curId())) && fm.set(S.cl, currentVectors);
          var dw = td.w * td.scaleX,
            dh = td.h * td.scaleY,
            ctx = E.curX();
          if (
            (ctx.save(),
              ctx.translate(td.x, td.y),
              ctx.rotate((td.rotation * Math.PI) / 180),
              (ctx.imageSmoothingEnabled = !0),
              (ctx.imageSmoothingQuality = "high"),
              ctx.drawImage(td.canvas, -dw / 2, -dh / 2, dw, dh),
              ctx.restore(),
              td.vectors && td.vectors.length > 0 && G.VectorPaths)
          ) {
            for (
              var ox = td.origBounds.cx,
              oy = td.origBounds.cy,
              sX = td.scaleX,
              sY = td.scaleY,
              rad = (td.rotation * Math.PI) / 180,
              cosR = Math.cos(rad),
              sinR = Math.sin(rad),
              newVectors = JSON.parse(JSON.stringify(td.vectors)),
              i = 0;
              i < newVectors.length;
              i++
            ) {
              var vp = newVectors[i];
              vp.id = U.uid();
              for (var j = 0; j < vp.pts.length; j++) {
                var pt = vp.pts[j],
                  sx = (pt.x - ox) * sX,
                  sy = (pt.y - oy) * sY,
                  rx = sx * cosR - sy * sinR,
                  ry = sx * sinR + sy * cosR;
                ((pt.x = td.x + rx), (pt.y = td.y + ry));
              }
              G.VectorPaths.addPath(E.curId(), S.cl, vp);
            }
            E.redrawSingleVectorLayer(E.curId(), S.cl);
          }
          (R.contexts.floatC.clearRect(0, 0, S.CW, S.CH),
            (S.transformMode = !1),
            E.commitUndo(),
            E.afterEdit(),
            E.toast("変形完了"));
        }
      }),
      (T.cancelTransform = function () {
        if (S.transformData) {
          var td = S.transformData;
          ((S.transformData = null),
            U.$("transformHud").classList.remove("show"),
            E.curX().putImageData(td.originalRaster, 0, 0),
            G.VectorPaths &&
            (S.vectorPaths.get(E.curId()).set(S.cl, td.originalVectors),
              E.redrawSingleVectorLayer(E.curId(), S.cl)),
            R.contexts.floatC.clearRect(0, 0, S.CW, S.CH),
            (S.transformMode = !1),
            E.afterEdit());
        }
      }),
      (T.pasteAt = function (px, py) {
        if (S.clip) {
          E.pushUndo();
          var dpr = C.DPR;
          if (S.clip.canvas) {
            var ctx = E.curX(),
              logW = S.clip.canvas.width / dpr,
              logH = S.clip.canvas.height / dpr;
            ctx.drawImage(
              S.clip.canvas,
              px - logW / 2,
              py - logH / 2,
              logW,
              logH,
            );
          }
          if (S.clip.vectors && S.clip.vectors.length > 0) {
            for (
              var dx = px - S.clip.cx,
              dy = py - S.clip.cy,
              newVectors = JSON.parse(JSON.stringify(S.clip.vectors)),
              i = 0;
              i < newVectors.length;
              i++
            ) {
              newVectors[i].id = U.uid();
              for (var j = 0; j < newVectors[i].pts.length; j++)
                ((newVectors[i].pts[j].x += dx), (newVectors[i].pts[j].y += dy));
              G.VectorPaths.addPath(E.curId(), S.cl, newVectors[i]);
            }
            E.redrawSingleVectorLayer(E.curId(), S.cl);
          }
          (R.contexts.floatC.clearRect(0, 0, S.CW, S.CH),
            E.commitUndo(),
            E.afterEdit(),
            E.toast("貼り付けました"));
        }
      }),
      (T.rotateLayer = function (deg) {
        E.pushUndo();
        var ctx = E.curX(),
          tmp = document.createElement("canvas");
        ((tmp.width = S.CW),
          (tmp.height = S.CH),
          tmp.getContext("2d").drawImage(E.curC(), 0, 0),
          ctx.clearRect(0, 0, S.CW, S.CH),
          ctx.save(),
          ctx.translate(S.CW / 2, S.CH / 2),
          ctx.rotate((deg * Math.PI) / 180),
          ctx.drawImage(tmp, -S.CW / 2, -S.CH / 2),
          ctx.restore(),
          E.commitUndo(),
          E.afterEdit(),
          E.toast(deg + " deg"));
      }),
      (T.flipLayer = function (axis) {
        E.pushUndo();
        var ctx = E.curX(),
          tmp = document.createElement("canvas");
        ((tmp.width = S.CW),
          (tmp.height = S.CH),
          tmp.getContext("2d").drawImage(E.curC(), 0, 0),
          ctx.clearRect(0, 0, S.CW, S.CH),
          ctx.save(),
          "h" === axis
            ? (ctx.translate(S.CW, 0), ctx.scale(-1, 1))
            : (ctx.translate(0, S.CH), ctx.scale(1, -1)),
          ctx.drawImage(tmp, 0, 0),
          ctx.restore(),
          E.commitUndo(),
          E.afterEdit(),
          E.toast("h" === axis ? "H-Flip" : "V-Flip"));
      }),
      (T.drawCursor = function (x, y) {
        var ctx = R.contexts.cursorC;
        if (ctx) {
          if ((ctx.clearRect(0, 0, S.CW, S.CH), S.cpMode))
            return (
              (ctx.strokeStyle = "rgba(255,0,0,0.6)"),
              (ctx.lineWidth = 1),
              ctx.beginPath(),
              ctx.moveTo(x - 8, y),
              ctx.lineTo(x + 8, y),
              ctx.moveTo(x, y - 8),
              ctx.lineTo(x, y + 8),
              void ctx.stroke()
            );
          if ("pixel" === S.ct) {
            var ps = S.pixelSize,
              gx = Math.floor(x / ps) * ps,
              gy = Math.floor(y / ps) * ps;
            return (
              (ctx.strokeStyle = "rgba(255,100,0,0.7)"),
              (ctx.lineWidth = 1),
              void ctx.strokeRect(gx, gy, ps, ps)
            );
          }
          if ("pen" === S.ct || "eraser" === S.ct) {
            var r = "eraser" === S.ct ? S.cs : S.cs / 2;
            ((ctx.strokeStyle =
              "eraser" === S.ct ? "rgba(255,0,0,0.6)" : "rgba(50,50,50,0.5)"),
              (ctx.lineWidth = 1),
              ctx.beginPath(),
              ctx.arc(x, y, r, 0, 2 * Math.PI),
              ctx.stroke(),
              (ctx.fillStyle =
                "eraser" === S.ct ? "rgba(255,0,0,0.4)" : "rgba(0,0,0,0.3)"),
              ctx.beginPath(),
              ctx.arc(x, y, 1, 0, 2 * Math.PI),
              ctx.fill());
          }
        }
      }),
      (T.drawControlPointOverlay = function () {
        if (S.cpMode && G.VectorPaths) {
          var ctx = R.contexts.cursorC;
          ctx &&
            (ctx.clearRect(0, 0, S.CW, S.CH),
              G.VectorPaths.drawControlPoints(
                ctx,
                E.curId(),
                S.cl,
                S.CW,
                S.CH,
                S.zoom,
              ));
        }
      }),
      G.VectorPaths && !G.VectorPaths._patchedForCut)
  ) {
    var originalRenderPath = G.VectorPaths.renderPath;
    ((G.VectorPaths.renderPath = function (ctx, path, CW, CH) {
      if ("cut_stroke" === path.type) {
        var pts = path.pts;
        if (!pts || !pts.length) return;
        ((ctx.lineCap = "round"),
          (ctx.lineJoin = "round"),
          (ctx.globalAlpha = path.alpha));
        var transforms = [
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
          var tpts = pts.map(transforms[ti]),
            drawFn = function (size, color) {
              ((ctx.lineWidth = size),
                (ctx.strokeStyle = color),
                ctx.beginPath(),
                ctx.moveTo(tpts[0].x, tpts[0].y));
              for (var i = 1; i < tpts.length; i++)
                ctx.lineTo(tpts[i].x, tpts[i].y);
              ctx.stroke();
            };
          (path.outline &&
            drawFn(path.size + 2 * path.outlineWidth, path.outlineColor),
            drawFn(path.size, path.color));
        }
        ctx.globalAlpha = 1;
      } else originalRenderPath(ctx, path, CW, CH);
    }),
      (G.VectorPaths._patchedForCut = !0));
  }
  G.Tools = T;
})(window.UgokuDraw);
