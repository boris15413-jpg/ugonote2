'use strict';
(function(G){
  const U=G.Utils,C=G.Config,S=G.State;
  const VP={};

  VP.createPath=(type,pts,opts)=>({
    id:U.uid(),
    type:type,
    pts:pts.map(p=>({x:p.x,y:p.y,p:p.p||0.5})),
    color:opts.color||S.cc,
    size:opts.size||S.cs,
    alpha:opts.alpha||S.alpha,
    outline:!!opts.outline,
    outlineColor:opts.outlineColor||S.penOutC,
    outlineWidth:opts.outlineWidth||S.penOutW,
    smooth:opts.smooth!=null?opts.smooth:S.penSmooth,
    pressure:!!opts.pressure,
    fill:!!opts.fill,
    symmetry:opts.symmetry||'none',
  });

  VP.getFramePaths=(fid,layer)=>{
    if(!S.vectorPaths.has(fid)) S.vectorPaths.set(fid,new Map());
    const fm=S.vectorPaths.get(fid);
    if(!fm.has(layer)) fm.set(layer,[]);
    return fm.get(layer);
  };

  VP.addPath=(fid,layer,path)=>{
    VP.getFramePaths(fid,layer).push(path);
  };

  VP.removePath=(fid,layer,pathId)=>{
    const arr=VP.getFramePaths(fid,layer);
    const idx=arr.findIndex(p=>p.id===pathId);
    if(idx>=0) arr.splice(idx,1);
  };

  VP.cloneFramePaths=(srcFid)=>{
    const srcMap=S.vectorPaths.get(srcFid);
    if(!srcMap) return new Map();
    const dst=new Map();
    for(const [layer,paths] of srcMap){
      dst.set(layer, paths.map(p=>({
        ...p,
        id:U.uid(),
        pts:p.pts.map(pt=>({...pt}))
      })));
    }
    return dst;
  };

  VP.renderPath=(ctx,path,CW,CH)=>{
    const pts=path.pts;
    if(!pts||!pts.length) return;
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.globalAlpha=path.alpha;

    const smoothed = path.smooth>0 && pts.length>=3 ? U.stabilize(pts,path.smooth) : pts;
    const transforms=[p=>p];
    if(path.symmetry==='h'||path.symmetry==='4') transforms.push(p=>({x:CW-p.x,y:p.y,p:p.p}));
    if(path.symmetry==='v'||path.symmetry==='4') transforms.push(p=>({x:p.x,y:CH-p.y,p:p.p}));
    if(path.symmetry==='4') transforms.push(p=>({x:CW-p.x,y:CH-p.y,p:p.p}));

    for(const tf of transforms){
      const tpts=smoothed.map(tf);

      switch(path.type){
        case 'pen':
        case 'eraser':
          if(path.type==='eraser'){
            ctx.globalCompositeOperation='destination-out';
          }
          if(path.outline && path.type!=='eraser'){
            drawSmoothLine(ctx,tpts,path.size+path.outlineWidth*2,path.outlineColor,path.pressure);
          }
          drawSmoothLine(ctx,tpts,path.size,path.color,path.pressure);
          if(path.type==='eraser'){
            ctx.globalCompositeOperation='source-over';
          }
          break;
        case 'line':
          if(tpts.length>=2){
            if(path.outline){
              ctx.strokeStyle=path.outlineColor;ctx.lineWidth=path.size+path.outlineWidth*2;
              ctx.beginPath();ctx.moveTo(tpts[0].x,tpts[0].y);ctx.lineTo(tpts[tpts.length-1].x,tpts[tpts.length-1].y);ctx.stroke();
            }
            ctx.strokeStyle=path.color;ctx.lineWidth=path.size;
            ctx.beginPath();ctx.moveTo(tpts[0].x,tpts[0].y);ctx.lineTo(tpts[tpts.length-1].x,tpts[tpts.length-1].y);ctx.stroke();
          }
          break;
        case 'rect':
          if(tpts.length>=2){
            ctx.strokeStyle=path.color;ctx.lineWidth=path.size;
            ctx.beginPath();ctx.rect(tpts[0].x,tpts[0].y,tpts[1].x-tpts[0].x,tpts[1].y-tpts[0].y);
            if(path.fill){ctx.fillStyle=path.color;ctx.fill();}
            ctx.stroke();
          }
          break;
        case 'circle':
          if(tpts.length>=2){
            const rx=Math.abs(tpts[1].x-tpts[0].x)/2,ry=Math.abs(tpts[1].y-tpts[0].y)/2;
            ctx.strokeStyle=path.color;ctx.lineWidth=path.size;
            ctx.beginPath();ctx.ellipse((tpts[0].x+tpts[1].x)/2,(tpts[0].y+tpts[1].y)/2,Math.max(rx,1),Math.max(ry,1),0,0,Math.PI*2);
            if(path.fill){ctx.fillStyle=path.color;ctx.fill();}
            ctx.stroke();
          }
          break;
        case 'star':
          if(tpts.length>=2) drawStarPath(ctx,tpts[0],tpts[1],path);
          break;
        case 'heart':
          if(tpts.length>=2) drawHeartPath(ctx,tpts[0],tpts[1],path);
          break;
        default:
          // For other shapes, fallback to line-based rendering
          if(tpts.length>=2){
            ctx.strokeStyle=path.color;ctx.lineWidth=path.size;
            ctx.beginPath();ctx.moveTo(tpts[0].x,tpts[0].y);
            for(let i=1;i<tpts.length;i++) ctx.lineTo(tpts[i].x,tpts[i].y);
            ctx.stroke();
          }
      }
    }
    ctx.globalAlpha=1;
    ctx.globalCompositeOperation='source-over';
  };

  function drawSmoothLine(ctx,pts,lineWidth,color,pressure){
    if(!pts.length)return;
    ctx.lineCap='round';ctx.lineJoin='round';
    if(pressure&&pts[0]?.p!==undefined){
      for(let i=1;i<pts.length;i++){
        const p0=pts[i-1],p1=pts[i];
        const pr=(p0.p+p1.p)/2;
        const w=lineWidth*U.clamp(pr*1.5,0.15,1.8);
        ctx.lineWidth=w;ctx.strokeStyle=color;
        ctx.beginPath();ctx.moveTo(p0.x,p0.y);
        if(i<pts.length-1){
          const mx=(p1.x+pts[i+1].x)/2,my=(p1.y+pts[i+1].y)/2;
          ctx.quadraticCurveTo(p1.x,p1.y,mx,my);
        } else ctx.lineTo(p1.x,p1.y);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth=lineWidth;ctx.strokeStyle=color;
      ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
      if(pts.length===1) ctx.lineTo(pts[0].x+0.1,pts[0].y);
      else if(pts.length===2) ctx.lineTo(pts[1].x,pts[1].y);
      else {
        for(let i=1;i<pts.length-1;i++){
          const mx=(pts[i].x+pts[i+1].x)/2,my=(pts[i].y+pts[i+1].y)/2;
          ctx.quadraticCurveTo(pts[i].x,pts[i].y,mx,my);
        }
        ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);
      }
      ctx.stroke();
    }
  }

  function drawStarPath(ctx,p0,p1,path){
    const cx=(p0.x+p1.x)/2,cy=(p0.y+p1.y)/2;
    const outerR=Math.max(Math.abs(p1.x-p0.x),Math.abs(p1.y-p0.y))/2,innerR=outerR*0.4;
    ctx.strokeStyle=path.color;ctx.lineWidth=path.size;
    ctx.beginPath();
    for(let i=0;i<10;i++){const a=(i*Math.PI/5)-Math.PI/2;const r=i%2===0?outerR:innerR;
      i===0?ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}
    ctx.closePath();if(path.fill){ctx.fillStyle=path.color;ctx.fill();}ctx.stroke();
  }

  function drawHeartPath(ctx,p0,p1,path){
    const cx=(p0.x+p1.x)/2,cy=(p0.y+p1.y)/2,w=Math.abs(p1.x-p0.x),h=Math.abs(p1.y-p0.y);
    ctx.strokeStyle=path.color;ctx.lineWidth=path.size;
    ctx.beginPath();ctx.moveTo(cx,cy+h*0.35);
    ctx.bezierCurveTo(cx-w*0.5,cy-h*0.1,cx-w*0.5,cy-h*0.45,cx,cy-h*0.15);
    ctx.bezierCurveTo(cx+w*0.5,cy-h*0.45,cx+w*0.5,cy-h*0.1,cx,cy+h*0.35);
    ctx.closePath();if(path.fill){ctx.fillStyle=path.color;ctx.fill();}ctx.stroke();
  }

  VP.renderAllPaths=(ctx,fid,layer,CW,CH)=>{
    const paths=VP.getFramePaths(fid,layer);
    for(const p of paths) VP.renderPath(ctx,p,CW,CH);
  };

  VP.drawControlPoints=(ctx,fid,layer,CW,CH,zoom)=>{
    const paths=VP.getFramePaths(fid,layer);
    const r=C.CP_RADIUS/zoom;
    for(const path of paths){
      const isSelected=(S.cpSelectedPath===path.id);
      for(let i=0;i<path.pts.length;i++){
        const pt=path.pts[i];
        ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,Math.PI*2);
        if(isSelected && S.cpSelectedPoint===i){
          ctx.fillStyle='#FF0000';ctx.fill();
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=2/zoom;ctx.stroke();
        } else if(isSelected){
          ctx.fillStyle='#FF6600';ctx.fill();
          ctx.strokeStyle='#FFFFFF';ctx.lineWidth=1.5/zoom;ctx.stroke();
        } else {
          ctx.fillStyle='rgba(255,102,0,0.5)';ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=1/zoom;ctx.stroke();
        }
      }
    }
  };

  VP.hitTestCP=(fid,layer,x,y,zoom)=>{
    const paths=VP.getFramePaths(fid,layer);
    const hr=C.CP_HIT_RADIUS/zoom;
    let bestDist=hr*hr, bestPath=null, bestPt=-1;
    for(const path of paths){
      for(let i=0;i<path.pts.length;i++){
        const pt=path.pts[i];
        const dx=pt.x-x, dy=pt.y-y;
        const d2=dx*dx+dy*dy;
        if(d2<bestDist){bestDist=d2;bestPath=path.id;bestPt=i;}
      }
    }
    return bestPath ? {pathId:bestPath, ptIdx:bestPt} : null;
  };

  VP.moveCP=(fid,layer,pathId,ptIdx,nx,ny)=>{
    const paths=VP.getFramePaths(fid,layer);
    const path=paths.find(p=>p.id===pathId);
    if(path && path.pts[ptIdx]){
      path.pts[ptIdx].x=nx;
      path.pts[ptIdx].y=ny;
    }
  };

  // Re-render a layer from vector paths (redraw raster from vectors)
  VP.rerasterize=(fid,layer,ctx,CW,CH,dpr)=>{
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,CW*dpr,CH*dpr);
    ctx.restore();
    ctx.setTransform(dpr,0,0,dpr,0,0);
    VP.renderAllPaths(ctx,fid,layer,CW,CH);
  };

  VP.serializePaths=(fid)=>{
    const fm=S.vectorPaths.get(fid);
    if(!fm) return {};
    const out={};
    for(const [layer,paths] of fm){
      out[layer]=paths.map(p=>({...p, pts:p.pts.map(pt=>({x:Math.round(pt.x*100)/100,y:Math.round(pt.y*100)/100,p:Math.round((pt.p||0.5)*100)/100}))}));
    }
    return out;
  };

  VP.deserializePaths=(fid,data)=>{
    if(!data) return;
    const fm=new Map();
    for(const [layer,paths] of Object.entries(data)){
      fm.set(layer, paths.map(p=>({...p, pts:p.pts.map(pt=>({x:pt.x,y:pt.y,p:pt.p||0.5}))})));
    }
    S.vectorPaths.set(fid,fm);
  };

  G.VectorPaths=VP;
})(window.UgokuDraw);
