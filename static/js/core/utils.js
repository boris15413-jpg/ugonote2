'use strict';
(function(G){
  const U = {};

  U.uid = () => crypto.randomUUID ? crypto.randomUUID() : 'f'+Date.now()+Math.random().toString(36).slice(2,8);
  U.$ = id => document.getElementById(id);
  U.$$ = sel => document.querySelectorAll(sel);
  U.$1 = sel => document.querySelector(sel);
  U.clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  U.lerp = (a,b,t) => a+(b-a)*t;
  U.dist = (x1,y1,x2,y2) => Math.hypot(x2-x1,y2-y1);
  U.deg2rad = d => d*Math.PI/180;
  U.rad2deg = r => r*180/Math.PI;
  U.hexToRgb = hex => {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return {r,g,b};
  };
  U.rgbToHex = (r,g,b) => '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');

  U.throttle = (fn,ms) => { let last=0; return (...a)=>{const now=Date.now();if(now-last>=ms){last=now;fn(...a);}};};
  U.debounce = (fn,ms) => { let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};

  U.catmullRom = (pts,tension,segments) => {
    segments = segments||8;
    if(pts.length<3) return pts;
    const out=[pts[0]];
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[Math.min(pts.length-1,i+1)],p3=pts[Math.min(pts.length-1,i+2)];
      for(let t=1;t<=segments;t++){
        const s=t/segments,s2=s*s,s3=s2*s;
        const x=0.5*((2*p1.x)+((-p0.x+p2.x)*s)+((2*p0.x-5*p1.x+4*p2.x-p3.x)*s2)+((-p0.x+3*p1.x-3*p2.x+p3.x)*s3));
        const y=0.5*((2*p1.y)+((-p0.y+p2.y)*s)+((2*p0.y-5*p1.y+4*p2.y-p3.y)*s2)+((-p0.y+3*p1.y-3*p2.y+p3.y)*s3));
        const p=p1.p!==undefined?U.lerp(p1.p,p2.p,s):undefined;
        out.push({x,y,p});
      }
    }
    return out;
  };

  U.stabilize = (pts,level) => {
    if(level<=0||pts.length<3) return pts;
    const res=[];
    const alpha = 0.5;
    const beta = 0.3;
    res.push(pts[0]);
    let vx = 0, vy = 0;
    for(let i=1;i<pts.length;i++){
      const prev = res[res.length-1];
      const raw = pts[i];
      const dx = raw.x - prev.x;
      const dy = raw.y - prev.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const maxJump = 30 + level * 5;
      let tx = raw.x, ty = raw.y;
      if(dist > maxJump && i < pts.length - 1) {
        tx = prev.x + dx * (maxJump / dist);
        ty = prev.y + dy * (maxJump / dist);
      }
      const w = Math.min(level, 8) / 8;
      const predictX = prev.x + vx;
      const predictY = prev.y + vy;
      const sx = U.lerp(tx, predictX, w * beta);
      const sy = U.lerp(ty, predictY, w * beta);
      const fx = U.lerp(raw.x, sx, w * alpha);
      const fy = U.lerp(raw.y, sy, w * alpha);
      vx = fx - prev.x;
      vy = fy - prev.y;
      res.push({x:fx, y:fy, p:raw.p});
    }
    return res;
  };

  U.EventBus = {
    _h:{},
    on(ev,fn){(this._h[ev]||(this._h[ev]=[])).push(fn);},
    off(ev,fn){if(this._h[ev])this._h[ev]=this._h[ev].filter(f=>f!==fn);},
    emit(ev,...args){if(this._h[ev])this._h[ev].forEach(f=>f(...args));}
  };

  U.el = (tag,attrs,children) => {
    const e = document.createElement(tag);
    if(attrs) Object.entries(attrs).forEach(([k,v])=>{
      if(k==='class') e.className=v;
      else if(k==='style'&&typeof v==='object') Object.assign(e.style,v);
      else if(k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(),v);
      else if(k==='html') e.innerHTML=v;
      else if(k==='text') e.textContent=v;
      else e.setAttribute(k,v);
    });
    if(children){
      if(typeof children==='string') e.innerHTML=children;
      else if(Array.isArray(children)) children.forEach(c=>{if(c)e.appendChild(typeof c==='string'?document.createTextNode(c):c);});
    }
    return e;
  };

  U.strokeToPolygon = (pts, halfWidth) => {
    if(!pts || pts.length < 2) return [];
    const left = [], right = [];
    for(let i = 0; i < pts.length; i++){
      let nx, ny;
      if(i === 0){
        nx = -(pts[1].y - pts[0].y);
        ny = pts[1].x - pts[0].x;
      } else if(i === pts.length - 1){
        nx = -(pts[i].y - pts[i-1].y);
        ny = pts[i].x - pts[i-1].x;
      } else {
        nx = -(pts[i+1].y - pts[i-1].y);
        ny = pts[i+1].x - pts[i-1].x;
      }
      const len = Math.sqrt(nx*nx + ny*ny) || 1;
      nx /= len; ny /= len;
      left.push([pts[i].x + nx*halfWidth, pts[i].y + ny*halfWidth]);
      right.push([pts[i].x - nx*halfWidth, pts[i].y - ny*halfWidth]);
    }
    right.reverse();
    const ring = left.concat(right);
    ring.push(ring[0]);
    return ring;
  };

  U.pathToPolygon = (path, segments) => {
    segments = segments || 4;
    const pts = path.pts;
    if(!pts || pts.length < 2) return null;
    const smoothed = path.smooth > 0 && pts.length >= 3 ? U.stabilize(pts, path.smooth) : pts;
    const halfW = path.size / 2;
    const expanded = [];
    if(smoothed.length < 3){
      for(let i = 0; i < smoothed.length; i++){
        expanded.push(smoothed[i]);
      }
    } else {
      expanded.push(smoothed[0]);
      for(let i = 1; i < smoothed.length - 1; i++){
        const mx = (smoothed[i].x + smoothed[i+1].x)/2;
        const my = (smoothed[i].y + smoothed[i+1].y)/2;
        for(let t = 0; t <= segments; t++){
          const s = t / segments;
          const x = (1-s)*(1-s)*smoothed[i-1 < 0 ? 0 : i].x + 2*(1-s)*s*smoothed[i].x + s*s*mx;
          const y = (1-s)*(1-s)*smoothed[i-1 < 0 ? 0 : i].y + 2*(1-s)*s*smoothed[i].y + s*s*my;
          expanded.push({x, y});
        }
      }
      expanded.push(smoothed[smoothed.length-1]);
    }
    return U.strokeToPolygon(expanded, halfW);
  };

  G.Utils = U;
})(window.UgokuDraw);