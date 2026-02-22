'use strict';
(function(G){
  const U=G.Utils, C=G.Config;
  const R = {};
  const canvases={}, contexts={};
  const canvasIds=['bgC','lPhoto','rC','rB','rA','vC','vB','vA','onC','gridC','strokeC','drC','floatC','cursorC'];

  R.initCanvases = (w,h) => {
    const dpr=C.DPR;
    canvasIds.forEach(id=>{
      const el=U.$(id);
      if(!el) return;
      canvases[id]=el;
      el.width=w*dpr; el.height=h*dpr;
      const willRead=['rA','rB','rC','lPhoto'].includes(id);
      const ctx=el.getContext('2d',{willReadFrequently:willRead});
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      contexts[id]=ctx;
    });
    const sp=U.$('selPath');
    if(sp) sp.setAttribute('viewBox',`0 0 ${w} ${h}`);
  };

  R.screenToCanvas = (ex,ey,state) => {
    const cw=U.$('cw');
    if(!cw) return {x:0,y:0};
    const r=cw.getBoundingClientRect();
    return {
      x:(ex-r.left)*(state.CW/r.width),
      y:(ey-r.top)*(state.CH/r.height)
    };
  };

  R.drawSmoothLine = (ctx,pts,lineWidth,color,pressure) => {
    if(!pts.length) return;
    ctx.lineCap='round'; ctx.lineJoin='round';
    if(pressure&&pts[0]?.p!==undefined){
      for(let i=1;i<pts.length;i++){
        const p0=pts[i-1],p1=pts[i];
        const pr=(p0.p+p1.p)/2;
        const w=lineWidth*U.clamp(pr*1.5,0.15,1.8);
        ctx.lineWidth=w; ctx.strokeStyle=color;
        ctx.beginPath(); ctx.moveTo(p0.x,p0.y);
        if(i<pts.length-1){
          const mx=(p1.x+pts[i+1].x)/2, my=(p1.y+pts[i+1].y)/2;
          ctx.quadraticCurveTo(p1.x,p1.y,mx,my);
        } else ctx.lineTo(p1.x,p1.y);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth=lineWidth; ctx.strokeStyle=color;
      ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
      if(pts.length===1) ctx.lineTo(pts[0].x+0.1,pts[0].y);
      else if(pts.length===2) ctx.lineTo(pts[1].x,pts[1].y);
      else {
        for(let i=1;i<pts.length-1;i++){
          const mx=(pts[i].x+pts[i+1].x)/2, my=(pts[i].y+pts[i+1].y)/2;
          ctx.quadraticCurveTo(pts[i].x,pts[i].y,mx,my);
        }
        ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);
      }
      ctx.stroke();
    }
  };

  R.rasterLayerMap = {A:'rA',B:'rB',C:'rC'};
  R.vectorLayerMap = {A:'vA',B:'vB',C:'vC'};

  R.getRasterCtx = l => contexts[R.rasterLayerMap[l]];
  R.getVectorCtx = l => contexts[R.vectorLayerMap[l]];
  R.getRasterCanvas = l => canvases[R.rasterLayerMap[l]];
  R.getVectorCanvas = l => canvases[R.vectorLayerMap[l]];

  R.renderComposite = (tc,fid,ow,oh,S) => {
    tc.fillStyle=S.pc;
    tc.fillRect(0,0,ow,oh);
    const c=S.fc.get(fid);if(!c) return;
    const dpr=C.DPR;
    const tmp=document.createElement('canvas');
    tmp.width=S.CW*dpr; tmp.height=S.CH*dpr;
    const tx=tmp.getContext('2d');
    const mk=k=>{
      if(!c[k]) return;
      tx.clearRect(0,0,S.CW*dpr,S.CH*dpr);
      tx.putImageData(c[k],0,0);
      tc.drawImage(tmp,0,0,ow,oh);
    };
    mk('P');
    S.layerOrder.forEach(l=>mk(l));
  };

  R.canvases=canvases;
  R.contexts=contexts;
  G.Renderer=R;
})(window.UgokuDraw);