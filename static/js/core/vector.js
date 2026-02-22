'use strict';
(function(G){
  var U = G.Utils, C = G.Config, S = G.State;
  var VP = {};

  VP.createPath = function(type, pts, opts){
    return {
      id: U.uid(),
      type: type,
      pts: pts.map(function(p){ return {x:p.x, y:p.y, p:p.p||0.5}; }),
      color: opts.color || S.cc,
      size: opts.size || S.cs,
      alpha: opts.alpha || S.alpha,
      outline: !!opts.outline,
      outlineColor: opts.outlineColor || S.penOutC,
      outlineWidth: opts.outlineWidth || S.penOutW,
      smooth: opts.smooth != null ? opts.smooth : S.penSmooth,
      pressure: !!opts.pressure,
      fill: !!opts.fill,
      symmetry: opts.symmetry || 'none'
    };
  };

  VP.getFramePaths = function(fid, layer){
    if(!S.vectorPaths.has(fid)) S.vectorPaths.set(fid, new Map());
    var fm = S.vectorPaths.get(fid);
    if(!fm.has(layer)) fm.set(layer, []);
    return fm.get(layer);
  };

  VP.addPath = function(fid, layer, path){
    VP.getFramePaths(fid, layer).push(path);
  };

  VP.removePath = function(fid, layer, pathId){
    var arr = VP.getFramePaths(fid, layer);
    var idx = arr.findIndex(function(p){ return p.id === pathId; });
    if(idx >= 0) arr.splice(idx, 1);
  };

  VP.cloneFramePaths = function(srcFid){
    var srcMap = S.vectorPaths.get(srcFid);
    if(!srcMap) return new Map();
    var dst = new Map();
    for(var entry of srcMap){
      var layer = entry[0], paths = entry[1];
      dst.set(layer, paths.map(function(p){
        return Object.assign({}, p, {
          id: U.uid(),
          pts: p.pts.map(function(pt){ return {x:pt.x, y:pt.y, p:pt.p}; })
        });
      }));
    }
    return dst;
  };

  VP.renderPath = function(ctx, path, CW, CH){
    var pts = path.pts;
    if(!pts || !pts.length) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = path.alpha;

    var smoothed = path.smooth > 0 && pts.length >= 3 ? U.stabilize(pts, path.smooth) : pts;
    var transforms = [function(p){ return p; }];
    if(path.symmetry === 'h' || path.symmetry === '4') transforms.push(function(p){ return {x:CW-p.x, y:p.y, p:p.p}; });
    if(path.symmetry === 'v' || path.symmetry === '4') transforms.push(function(p){ return {x:p.x, y:CH-p.y, p:p.p}; });
    if(path.symmetry === '4') transforms.push(function(p){ return {x:CW-p.x, y:CH-p.y, p:p.p}; });

    for(var ti = 0; ti < transforms.length; ti++){
      var tf = transforms[ti];
      var tpts = smoothed.map(tf);

      switch(path.type){
        case 'pen':
          if(path.outline) drawSmoothLine(ctx, tpts, path.size + path.outlineWidth*2, path.outlineColor, path.pressure);
          drawSmoothLine(ctx, tpts, path.size, path.color, path.pressure);
          break;
        case 'line':
          if(tpts.length >= 2){
            if(path.outline){
              ctx.strokeStyle = path.outlineColor;
              ctx.lineWidth = path.size + path.outlineWidth*2;
              ctx.beginPath(); ctx.moveTo(tpts[0].x, tpts[0].y); ctx.lineTo(tpts[tpts.length-1].x, tpts[tpts.length-1].y); ctx.stroke();
            }
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.size;
            ctx.beginPath(); ctx.moveTo(tpts[0].x, tpts[0].y); ctx.lineTo(tpts[tpts.length-1].x, tpts[tpts.length-1].y); ctx.stroke();
          }
          break;
        case 'rect':
          if(tpts.length >= 2){
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.size;
            ctx.beginPath(); ctx.rect(tpts[0].x, tpts[0].y, tpts[1].x-tpts[0].x, tpts[1].y-tpts[0].y);
            if(path.fill){ ctx.fillStyle = path.color; ctx.fill(); }
            ctx.stroke();
          }
          break;
        case 'circle':
          if(tpts.length >= 2){
            var rx = Math.abs(tpts[1].x - tpts[0].x) / 2;
            var ry = Math.abs(tpts[1].y - tpts[0].y) / 2;
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.size;
            ctx.beginPath();
            ctx.ellipse((tpts[0].x+tpts[1].x)/2, (tpts[0].y+tpts[1].y)/2, Math.max(rx,1), Math.max(ry,1), 0, 0, Math.PI*2);
            if(path.fill){ ctx.fillStyle = path.color; ctx.fill(); }
            ctx.stroke();
          }
          break;
        case 'star':
          if(tpts.length >= 2) drawStarPath(ctx, tpts[0], tpts[1], path);
          break;
        case 'heart':
          if(tpts.length >= 2) drawHeartPath(ctx, tpts[0], tpts[1], path);
          break;
        default:
          if(tpts.length >= 2){
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.size;
            ctx.beginPath(); ctx.moveTo(tpts[0].x, tpts[0].y);
            for(var i = 1; i < tpts.length; i++) ctx.lineTo(tpts[i].x, tpts[i].y);
            ctx.stroke();
          }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  function drawSmoothLine(ctx, pts, lineWidth, color, pressure){
    if(!pts.length) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if(pressure && pts[0] && pts[0].p !== undefined){
      for(var i = 1; i < pts.length; i++){
        var p0 = pts[i-1], p1 = pts[i];
        var pr = (p0.p + p1.p) / 2;
        var w = lineWidth * U.clamp(pr*1.5, 0.15, 1.8);
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
        if(i < pts.length - 1){
          var mx = (p1.x + pts[i+1].x) / 2;
          var my = (p1.y + pts[i+1].y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
        } else {
          ctx.lineTo(p1.x, p1.y);
        }
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      if(pts.length === 1) ctx.lineTo(pts[0].x+0.1, pts[0].y);
      else if(pts.length === 2) ctx.lineTo(pts[1].x, pts[1].y);
      else {
        for(var i2 = 1; i2 < pts.length - 1; i2++){
          var mx2 = (pts[i2].x + pts[i2+1].x) / 2;
          var my2 = (pts[i2].y + pts[i2+1].y) / 2;
          ctx.quadraticCurveTo(pts[i2].x, pts[i2].y, mx2, my2);
        }
        ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
      }
      ctx.stroke();
    }
  }

  function drawStarPath(ctx, p0, p1, path){
    var cx = (p0.x+p1.x)/2, cy = (p0.y+p1.y)/2;
    var outerR = Math.max(Math.abs(p1.x-p0.x), Math.abs(p1.y-p0.y))/2;
    var innerR = outerR*0.4;
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.size;
    ctx.beginPath();
    for(var i = 0; i < 10; i++){
      var a = (i*Math.PI/5) - Math.PI/2;
      var r = i%2===0 ? outerR : innerR;
      if(i===0) ctx.moveTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
      else ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
    }
    ctx.closePath();
    if(path.fill){ ctx.fillStyle = path.color; ctx.fill(); }
    ctx.stroke();
  }

  function drawHeartPath(ctx, p0, p1, path){
    var cx = (p0.x+p1.x)/2, cy = (p0.y+p1.y)/2;
    var w = Math.abs(p1.x-p0.x), h = Math.abs(p1.y-p0.y);
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.size;
    ctx.beginPath();
    ctx.moveTo(cx, cy+h*0.35);
    ctx.bezierCurveTo(cx-w*0.5, cy-h*0.1, cx-w*0.5, cy-h*0.45, cx, cy-h*0.15);
    ctx.bezierCurveTo(cx+w*0.5, cy-h*0.45, cx+w*0.5, cy-h*0.1, cx, cy+h*0.35);
    ctx.closePath();
    if(path.fill){ ctx.fillStyle = path.color; ctx.fill(); }
    ctx.stroke();
  }

  VP.renderAllPaths = function(ctx, fid, layer, CW, CH){
    var paths = VP.getFramePaths(fid, layer);
    for(var i = 0; i < paths.length; i++){
      VP.renderPath(ctx, paths[i], CW, CH);
    }
  };

  VP.drawControlPoints = function(ctx, fid, layer, CW, CH, zoom){
    var paths = VP.getFramePaths(fid, layer);
    var r = C.CP_RADIUS / zoom;
    for(var pi = 0; pi < paths.length; pi++){
      var path = paths[pi];
      var isSelected = (S.cpSelectedPath === path.id);
      for(var i = 0; i < path.pts.length; i++){
        var pt = path.pts[i];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI*2);
        if(isSelected && S.cpSelectedPoint === i){
          ctx.fillStyle = '#FF0000'; ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2/zoom; ctx.stroke();
        } else if(isSelected){
          ctx.fillStyle = '#FF6600'; ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5/zoom; ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255,102,0,0.5)'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1/zoom; ctx.stroke();
        }
      }
    }
  };

  VP.hitTestCP = function(fid, layer, x, y, zoom){
    var paths = VP.getFramePaths(fid, layer);
    var hr = C.CP_HIT_RADIUS / zoom;
    var bestDist = hr*hr, bestPath = null, bestPt = -1;
    for(var pi = 0; pi < paths.length; pi++){
      var path = paths[pi];
      for(var i = 0; i < path.pts.length; i++){
        var pt = path.pts[i];
        var dx = pt.x - x, dy = pt.y - y;
        var d2 = dx*dx + dy*dy;
        if(d2 < bestDist){ bestDist = d2; bestPath = path.id; bestPt = i; }
      }
    }
    return bestPath ? {pathId: bestPath, ptIdx: bestPt} : null;
  };

  VP.moveCP = function(fid, layer, pathId, ptIdx, nx, ny){
    var paths = VP.getFramePaths(fid, layer);
    var path = paths.find(function(p){ return p.id === pathId; });
    if(path && path.pts[ptIdx]){
      path.pts[ptIdx].x = nx;
      path.pts[ptIdx].y = ny;
    }
  };

  function pointInPolygon(px, py, ring){
    var inside = false;
    var n = ring.length;
    for(var i = 0, j = n - 1; i < n; j = i++){
      var xi = ring[i][0], yi = ring[i][1];
      var xj = ring[j][0], yj = ring[j][1];
      if(((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)){
        inside = !inside;
      }
    }
    return inside;
  }

  function segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy){
    var denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if(Math.abs(denom) < 1e-12) return null;
    var t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
    var u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
    if(t > 1e-9 && t < 1 - 1e-9 && u >= 0 && u <= 1){
      return {x: ax + t * (bx - ax), y: ay + t * (by - ay), t: t};
    }
    return null;
  }

  function segPolyIntersections(ax, ay, bx, by, ring){
    var hits = [];
    var n = ring.length;
    for(var i = 0, j = n - 1; i < n; j = i++){
      var hit = segSegIntersect(ax, ay, bx, by, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
      if(hit) hits.push(hit);
    }
    if(hits.length === 0) return hits;
    hits.sort(function(a, b){ return a.t - b.t; });
    var filtered = [hits[0]];
    for(var k = 1; k < hits.length; k++){
      if(hits[k].t - filtered[filtered.length - 1].t > 1e-6) filtered.push(hits[k]);
    }
    return filtered;
  }

  function lerpPt(a, b, t){
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      p: (a.p || 0.5) + ((b.p || 0.5) - (a.p || 0.5)) * t
    };
  }

  function clipSegment(a, b, ring){
    var aIn = pointInPolygon(a.x, a.y, ring);
    var hits = segPolyIntersections(a.x, a.y, b.x, b.y, ring);
    if(!hits || !hits.length){
      return aIn ? [] : [[a, b]];
    }
    var result = [];
    var prev = a;
    var inside = aIn;
    for(var i = 0; i < hits.length; i++){
      var ip = lerpPt(a, b, hits[i].t);
      if(!inside){
        result.push([prev, ip]);
      }
      prev = ip;
      inside = !inside;
    }
    if(!inside){
      result.push([prev, b]);
    }
    return result;
  }

VP.erasePaths = function(fid, layer, eraserPts, eraserSize){
    // 【最重要】長さが2未満のときは計算しない（アプリのクラッシュ・書けなくなるバグを防止）
    if(!eraserPts || eraserPts.length < 2) return;
    
    var eraserHalf = eraserSize * 1.15; 
    var exPts = [];
    var p0 = eraserPts[0], p1 = eraserPts[1];
    var dx = p0.x - p1.x, dy = p0.y - p1.y;
    var dist = Math.sqrt(dx*dx + dy*dy) || 1;
    exPts.push({x: p0.x + (dx/dist)*eraserSize, y: p0.y + (dy/dist)*eraserSize});
    
    for(var i=0; i<eraserPts.length; i++) exPts.push(eraserPts[i]);
    
    var pn = eraserPts[eraserPts.length-1], pn1 = eraserPts[eraserPts.length-2];
    var dxn = pn.x - pn1.x, dyn = pn.y - pn1.y;
    var distn = Math.sqrt(dxn*dxn + dyn*dyn) || 1;
    exPts.push({x: pn.x + (dxn/distn)*eraserSize, y: pn.y + (dyn/distn)*eraserSize});

    var eraserPoly = U.strokeToPolygon(
      exPts.map(function(p){ return {x:p.x, y:p.y}; }),
      eraserHalf
    );
    if(eraserPoly.length < 4) return;
    var ring = [];
    for(var ei = 0; ei < eraserPoly.length; ei++){
      ring.push([eraserPoly[ei][0], eraserPoly[ei][1]]);
    }
    if(ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])){
      ring.push([ring[0][0], ring[0][1]]);
    }

    var paths = VP.getFramePaths(fid, layer);
    var newPaths = [];
    for(var pi = 0; pi < paths.length; pi++){
      var path = paths[pi];
      if(path.type !== 'pen' && path.type !== 'line'){
        var keep = true;
        if(path.pts && path.pts.length >= 2){
          var allIn = true;
          for(var ci = 0; ci < path.pts.length; ci++){
            if(!pointInPolygon(path.pts[ci].x, path.pts[ci].y, ring)){ allIn = false; break; }
          }
          if(allIn) keep = false;
        }
        if(keep) newPaths.push(path);
        continue;
      }
      
      var pts = (path.smooth > 0 && path.pts.length >= 3) ? U.stabilize(path.pts, path.smooth) : path.pts;
      if(!pts || pts.length < 2){
        newPaths.push(path);
        continue;
      }
      var runs = [];
      var curRun = [];
      for(var si = 0; si < pts.length - 1; si++){
        var clipped = clipSegment(pts[si], pts[si + 1], ring);
        for(var ci2 = 0; ci2 < clipped.length; ci2++){
          var segPair = clipped[ci2];
          var sp = segPair[0], ep = segPair[1];
          if(curRun.length > 0){
            var last = curRun[curRun.length - 1];
            var dx2 = sp.x - last.x, dy2 = sp.y - last.y;
            if(dx2 * dx2 + dy2 * dy2 > 0.01){
              if(curRun.length >= 2) runs.push(curRun);
              curRun = [sp, ep];
            } else {
              curRun.push(ep);
            }
          } else {
            curRun.push(sp);
            curRun.push(ep);
          }
        }
        if(clipped.length === 0 && curRun.length >= 2){
          runs.push(curRun);
          curRun = [];
        }
      }
      if(curRun.length >= 2) runs.push(curRun);
      for(var ri = 0; ri < runs.length; ri++){
        var run = runs[ri];
        if(run.length < 2) continue;
        
        var runLen = 0;
        for(var k=1; k<run.length; k++){
            runLen += Math.hypot(run[k].x - run[k-1].x, run[k].y - run[k-1].y);
        }
        if(runLen < 1.0) continue;

        // 【修正】線の密集（太さの変化）を防ぐ間引き処理
        var simplifiedRun = [run[0]];
        var lastPt = run[0];
        for(var m=1; m<run.length-1; m++){
            var dx3 = run[m].x - lastPt.x, dy3 = run[m].y - lastPt.y;
            if(dx3*dx3 + dy3*dy3 > 4){ 
                simplifiedRun.push(run[m]);
                lastPt = run[m];
            }
        }
        simplifiedRun.push(run[run.length-1]);

var np = Object.assign({}, path, {
          id: U.uid(),
          pts: simplifiedRun.map(function(p){ return {x: p.x, y: p.y, p: p.p || 0.5}; }),
          smooth: 0 
        });
        newPaths.push(np);
      }
    }
    var fm = S.vectorPaths.get(fid);
    if(fm) fm.set(layer, newPaths);
  };

  VP.serializePaths = function(fid){
    var fm = S.vectorPaths.get(fid);
    if(!fm) return {};
    var out = {};
    for(var entry of fm){
      var layer = entry[0], paths = entry[1];
      out[layer] = paths.map(function(p){
        return Object.assign({}, p, {
          pts: p.pts.map(function(pt){
            return {
              x: Math.round(pt.x*100)/100,
              y: Math.round(pt.y*100)/100,
              p: Math.round((pt.p||0.5)*100)/100
            };
          })
        });
      });
    }
    return out;
  };

  VP.deserializePaths = function(fid, data){
    if(!data) return;
    var fm = new Map();
    for(var layer in data){
      if(!data.hasOwnProperty(layer)) continue;
      fm.set(layer, data[layer].map(function(p){
        return Object.assign({}, p, {
          pts: p.pts.map(function(pt){ return {x:pt.x, y:pt.y, p:pt.p||0.5}; })
        });
      }));
    }
    S.vectorPaths.set(fid, fm);
  };

  G.VectorPaths = VP;
})(window.UgokuDraw);