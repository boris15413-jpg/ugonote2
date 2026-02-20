'use strict';
(function(G){
  const U=G.Utils,C=G.Config,R=G.Renderer,S=G.State,E=G.Engine;
  const T={};

  T.drawPenStroke=()=>{
    const ctx=R.contexts.strokeC;const dpr=C.DPR;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,S.CW*dpr,S.CH*dpr);ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0);
    let pts=S.pts;if(!pts.length)return;
    if(S.penSmooth>0) pts=U.stabilize(pts,S.penSmooth);
    if(S.penOut) R.drawSmoothLine(ctx,pts,S.cs+S.penOutW*2,S.penOutC,S.pressure);
    R.drawSmoothLine(ctx,pts,S.cs,S.cc,S.pressure);
    if(S.symmetry!=='none') drawSymmetry(ctx,pts);
  };

  function drawSymmetry(ctx,pts){
    const CW=S.CW,CH=S.CH;const transforms=[];
    if(S.symmetry==='h'||S.symmetry==='4') transforms.push(p=>({x:CW-p.x,y:p.y,p:p.p}));
    if(S.symmetry==='v'||S.symmetry==='4') transforms.push(p=>({x:p.x,y:CH-p.y,p:p.p}));
    if(S.symmetry==='4') transforms.push(p=>({x:CW-p.x,y:CH-p.y,p:p.p}));
    transforms.forEach(tf=>{
      const m=pts.map(tf);
      if(S.penOut) R.drawSmoothLine(ctx,m,S.cs+S.penOutW*2,S.penOutC,S.pressure);
      R.drawSmoothLine(ctx,m,S.cs,S.cc,S.pressure);
    });
  }

  T.commitPenStroke=()=>{
    const dpr=C.DPR;
    E.curX().globalAlpha=S.alpha;
    E.curX().save();E.curX().setTransform(1,0,0,1,0,0);
    E.curX().drawImage(R.canvases.strokeC,0,0);
    E.curX().restore();E.curX().setTransform(dpr,0,0,dpr,0,0);
    E.curX().globalAlpha=1;
    const sc=R.contexts.strokeC;
    sc.save();sc.setTransform(1,0,0,1,0,0);sc.clearRect(0,0,S.CW*dpr,S.CH*dpr);sc.restore();sc.setTransform(dpr,0,0,dpr,0,0);
    R.canvases.strokeC.style.opacity=1;

    if(S.pts.length>0 && G.VectorPaths){
      const vp=G.VectorPaths.createPath('pen',S.pts,{
        color:S.cc, size:S.cs, alpha:S.alpha,
        outline:S.penOut, outlineColor:S.penOutC, outlineWidth:S.penOutW,
        smooth:S.penSmooth, pressure:S.pressure, symmetry:S.symmetry
      });
      G.VectorPaths.addPath(E.curId(),S.cl,vp);
    }
  };

  T.applyEraser=()=>{
    const ctx=E.curX(),pts=S.pts;
    if(!pts.length||!S.eSnap) return;
    const dpr=C.DPR;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(S.eSnap,0,0);ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.globalCompositeOperation='destination-out';
    ctx.globalAlpha=S.alpha; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=S.cs*2;
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
    if(pts.length===1) ctx.lineTo(pts[0].x+0.1,pts[0].y);
    ctx.stroke();
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  };

  T.commitEraser=()=>{
    if(S.pts.length>0 && G.VectorPaths){
      const vp=G.VectorPaths.createPath('eraser',S.pts,{
        color:'#000000', size:S.cs*2, alpha:S.alpha,
        outline:false, smooth:0, pressure:false, symmetry:'none'
      });
      G.VectorPaths.addPath(E.curId(),S.cl,vp);
    }
  };

  T.floodFill=(sx,sy)=>{
    const ctx=E.curX();const dpr=C.DPR;
    const id=ctx.getImageData(0,0,S.CW*dpr,S.CH*dpr);
    const tc2=document.createElement('canvas').getContext('2d');
    tc2.fillStyle=S.cc;tc2.fillRect(0,0,1,1);
    const fc=tc2.getImageData(0,0,1,1).data;
    const fillX=Math.floor(sx*dpr),fillY=Math.floor(sy*dpr);
    if(E.W){
      E.workerCall({type:'floodFill',w:S.CW*dpr,h:S.CH*dpr,data:id.data.buffer,sx:fillX,sy:fillY,fillR:fc[0],fillG:fc[1],fillB:fc[2],tol:30},[id.data.buffer]).then(d=>{
        ctx.save();ctx.setTransform(1,0,0,1,0,0);
        ctx.putImageData(new ImageData(new Uint8ClampedArray(d.data),S.CW*dpr,S.CH*dpr),0,0);
        ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0);
        E.commitUndo();E.afterEdit();
      });
    } else {
      syncFill(id,S.CW*dpr,S.CH*dpr,fillX,fillY,fc);
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(id,0,0);ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0);
      E.commitUndo();E.afterEdit();
    }
  };

  function syncFill(id,w,h,sx,sy,fc){
    const d=id.data;
    if(sx<0||sx>=w||sy<0||sy>=h) return;
    const i0=(sy*w+sx)*4,tr=d[i0],tg=d[i0+1],tb=d[i0+2],ta=d[i0+3];
    if(tr===fc[0]&&tg===fc[1]&&tb===fc[2]&&ta===255) return;
    const tol=30;
    const m=i=>Math.abs(d[i]-tr)<=tol&&Math.abs(d[i+1]-tg)<=tol&&Math.abs(d[i+2]-tb)<=tol&&Math.abs(d[i+3]-ta)<=tol;
    const vis=new Uint8Array(w*h),q=[sy*w+sx];vis[sy*w+sx]=1;
    while(q.length){
      const pi=q.pop(),px=pi%w,py=(pi/w)|0;
      let lx=px;while(lx>0&&!vis[py*w+lx-1]&&m((py*w+lx-1)*4)){lx--;vis[py*w+lx]=1;}
      let rx=px;while(rx<w-1&&!vis[py*w+rx+1]&&m((py*w+rx+1)*4)){rx++;vis[py*w+rx]=1;}
      for(let x=lx;x<=rx;x++){
        const i=(py*w+x)*4;d[i]=fc[0];d[i+1]=fc[1];d[i+2]=fc[2];d[i+3]=255;
        for(const ny of[py-1,py+1]) if(ny>=0&&ny<h){const ni=ny*w+x;if(!vis[ni]&&m(ni*4)){vis[ni]=1;q.push(ni);}}
      }
    }
  }

  T.drawPixel=(x,y)=>{
    const ctx=E.curX();
    const ps=S.pixelSize;
    const gx=Math.floor(x/ps)*ps, gy=Math.floor(y/ps)*ps;
    ctx.globalAlpha=S.alpha;
    ctx.fillStyle=S.cc;
    ctx.imageSmoothingEnabled=false;
    ctx.fillRect(gx,gy,ps,ps);
    ctx.imageSmoothingEnabled=true;
    ctx.globalAlpha=1;
  };

  T.erasePixel=(x,y)=>{
    const ctx=E.curX();
    const ps=S.pixelSize;
    const gx=Math.floor(x/ps)*ps, gy=Math.floor(y/ps)*ps;
    ctx.clearRect(gx,gy,ps,ps);
  };

  T.drawPixelLine=(x0,y0,x1,y1,erase)=>{
    const ps=S.pixelSize;
    const gx0=Math.floor(x0/ps),gy0=Math.floor(y0/ps);
    const gx1=Math.floor(x1/ps),gy1=Math.floor(y1/ps);
    let dx=Math.abs(gx1-gx0),dy=-Math.abs(gy1-gy0);
    let sx=gx0<gx1?1:-1, sy=gy0<gy1?1:-1;
    let err=dx+dy, cx=gx0, cy=gy0;
    const ctx=E.curX();
    ctx.imageSmoothingEnabled=false;
    while(true){
      if(erase) ctx.clearRect(cx*ps,cy*ps,ps,ps);
      else { ctx.globalAlpha=S.alpha;ctx.fillStyle=S.cc;ctx.fillRect(cx*ps,cy*ps,ps,ps);ctx.globalAlpha=1; }
      if(cx===gx1&&cy===gy1) break;
      const e2=2*err;
      if(e2>=dy){err+=dy;cx+=sx;}
      if(e2<=dx){err+=dx;cy+=sy;}
    }
    ctx.imageSmoothingEnabled=true;
  };

  T.drawShapePreview=pt=>{
    const dc=R.contexts.drC;
    dc.clearRect(0,0,S.CW,S.CH);
    dc.lineCap='round';dc.lineJoin='round';dc.globalAlpha=S.alpha;
    dc.strokeStyle=S.cc;dc.lineWidth=S.cs;
    if(S.shapeFill) dc.fillStyle=S.cc;
    switch(S.ct){
      case'line':
        if(S.penOut){dc.strokeStyle=S.penOutC;dc.lineWidth=S.cs+S.penOutW*2;dc.beginPath();dc.moveTo(S.sx,S.sy);dc.lineTo(pt.x,pt.y);dc.stroke();}
        dc.strokeStyle=S.cc;dc.lineWidth=S.cs;dc.beginPath();dc.moveTo(S.sx,S.sy);dc.lineTo(pt.x,pt.y);dc.stroke();break;
      case'rect':dc.beginPath();dc.rect(S.sx,S.sy,pt.x-S.sx,pt.y-S.sy);if(S.shapeFill)dc.fill();dc.stroke();break;
      case'circle':{
        const rx=Math.abs(pt.x-S.sx)/2,ry=Math.abs(pt.y-S.sy)/2;
        dc.beginPath();dc.ellipse((S.sx+pt.x)/2,(S.sy+pt.y)/2,Math.max(rx,1),Math.max(ry,1),0,0,Math.PI*2);
        if(S.shapeFill)dc.fill();dc.stroke();break;}
      case'star':{
        const cx=(S.sx+pt.x)/2,cy=(S.sy+pt.y)/2;
        const outerR=Math.max(Math.abs(pt.x-S.sx),Math.abs(pt.y-S.sy))/2,innerR=outerR*0.4;
        dc.beginPath();
        for(let i=0;i<10;i++){const a=(i*Math.PI/5)-Math.PI/2;const r=i%2===0?outerR:innerR;const px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;i===0?dc.moveTo(px,py):dc.lineTo(px,py);}
        dc.closePath();if(S.shapeFill)dc.fill();dc.stroke();break;}
      case'heart':{
        const cx=(S.sx+pt.x)/2,cy=(S.sy+pt.y)/2,w=Math.abs(pt.x-S.sx),h=Math.abs(pt.y-S.sy);
        dc.beginPath();dc.moveTo(cx,cy+h*0.35);
        dc.bezierCurveTo(cx-w*0.5,cy-h*0.1,cx-w*0.5,cy-h*0.45,cx,cy-h*0.15);
        dc.bezierCurveTo(cx+w*0.5,cy-h*0.45,cx+w*0.5,cy-h*0.1,cx,cy+h*0.35);
        dc.closePath();if(S.shapeFill)dc.fill();dc.stroke();break;}
    }
    dc.globalAlpha=1;
  };

  T.commitShape=(pt)=>{
    if(!G.VectorPaths) return;
    const p0={x:S.sx,y:S.sy,p:0.5};
    const p1={x:pt.x,y:pt.y,p:0.5};
    const vp=G.VectorPaths.createPath(S.ct,[p0,p1],{
      color:S.cc, size:S.cs, alpha:S.alpha,
      outline:S.penOut, outlineColor:S.penOutC, outlineWidth:S.penOutW,
      smooth:0, pressure:false, fill:S.shapeFill, symmetry:S.symmetry
    });
    G.VectorPaths.addPath(E.curId(),S.cl,vp);
  };

  T.eyedrop=(x,y)=>{
    const dpr=C.DPR;
    const px=Math.floor(x*dpr),py=Math.floor(y*dpr);
    if(px<0||px>=S.CW*dpr||py<0||py>=S.CH*dpr) return null;
    const tmp=document.createElement('canvas');
    tmp.width=S.CW*dpr;tmp.height=S.CH*dpr;
    const tc=tmp.getContext('2d');
    tc.fillStyle=S.pc;tc.fillRect(0,0,S.CW*dpr,S.CH*dpr);
    const photo=R.canvases.lPhoto;
    if(photo&&photo.style.display!=='none') tc.drawImage(photo,0,0);
    S.layerOrder.forEach(l=>{
      const cv=E.getLayerCanvas(l);
      if(cv&&cv.style.display!=='none') tc.drawImage(cv,0,0);
    });
    const d=tc.getImageData(px,py,1,1).data;
    return U.rgbToHex(d[0],d[1],d[2]);
  };

  T.drawEyedropPreview=(x,y,color)=>{
    const ctx=R.contexts.cursorC; if(!ctx) return;
    ctx.clearRect(0,0,S.CW,S.CH);
    const r=16;
    ctx.strokeStyle='#333';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=color||S.cc;
    ctx.beginPath();ctx.arc(x,y,r-2,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x-r+4,y);ctx.lineTo(x+r-4,y);ctx.moveTo(x,y-r+4);ctx.lineTo(x,y+r-4);ctx.stroke();
  };

  T.startImagePlace=imgEl=>{
    const a=imgEl.width/imgEl.height,ca=S.CW/S.CH;
    let bw,bh;
    if(a>ca){bw=S.CW;bh=S.CW/a;} else {bh=S.CH;bw=S.CH*a;}
    S.img={el:imgEl,x:S.CW/2,y:S.CH/2,bw,bh,sc:1,rot:0};
    U.$('imgHud').classList.add('show');
    T.drawImagePreview();
  };

  T.drawImagePreview=()=>{
    if(!S.img)return;
    const ctx=R.contexts.floatC;
    ctx.clearRect(0,0,S.CW,S.CH);
    const {el,x,y,bw,bh,sc,rot}=S.img;
    const dw=bw*sc,dh=bh*sc;
    ctx.save();ctx.translate(x,y);
    if(rot) ctx.rotate(rot*Math.PI/180);
    ctx.globalAlpha=0.85;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(el,-dw/2,-dh/2,dw,dh);
    ctx.globalAlpha=1;ctx.strokeStyle='#FF6600';ctx.lineWidth=2;ctx.setLineDash([6,4]);
    ctx.strokeRect(-dw/2,-dh/2,dw,dh);ctx.setLineDash([]);ctx.restore();
  };

  T.commitImage=()=>{
    if(!S.img)return;E.pushUndo();
    const {el,x,y,bw,bh,sc,rot}=S.img;
    const ctx=E.curX();
    ctx.save();ctx.translate(x,y);if(rot)ctx.rotate(rot*Math.PI/180);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(el,-bw*sc/2,-bh*sc/2,bw*sc,bh*sc);ctx.restore();
    R.contexts.floatC.clearRect(0,0,S.CW,S.CH);S.img=null;
    U.$('imgHud').classList.remove('show');
    E.commitUndo();E.afterEdit();E.toast('画像配置完了');
  };
  T.cancelImage=()=>{R.contexts.floatC.clearRect(0,0,S.CW,S.CH);S.img=null;U.$('imgHud').classList.remove('show');};

  T.selectionAction=mode=>{
    U.$('selModal').classList.remove('show');U.$('selBox').style.display='none';
    U.$('lassoPath').setAttribute('d','');
    if(G.UI) G.UI.showSelZoomBtn(false);
    if(!S.sel) return;
    const ctx=E.curX(),hl=S.sel.lasso;
    const dpr=C.DPR;

    const pW = Math.ceil(S.sel.w * dpr);
    const pH = Math.ceil(S.sel.h * dpr);
    const pX = Math.floor(S.sel.x * dpr);
    const pY = Math.floor(S.sel.y * dpr);

    if(mode==='copy'){
      const tmp=document.createElement('canvas');
      tmp.width=pW; tmp.height=pH;
      const tc=tmp.getContext('2d');
      
      if(hl){
        tc.beginPath();
        hl.forEach((p,i)=>{
          const cx = (p.x - S.sel.x) * dpr;
          const cy = (p.y - S.sel.y) * dpr;
          i ? tc.lineTo(cx, cy) : tc.moveTo(cx, cy);
        });
        tc.closePath(); tc.clip();
      }
      

      tc.drawImage(E.curC(), pX, pY, pW, pH, 0, 0, pW, pH);
      
      S.clip=tmp; 
      S.sel=null; S.lassoPath=[];
      S.ct='paste';
      U.$$('[data-tool]').forEach(b=>b.classList.remove('on'));
      E.toast('コピーしました');
      return;
    }

    
    if(mode==='cut'){
      E.pushUndo();
      if(hl){
        ctx.save();
        ctx.setTransform(dpr,0,0,dpr,0,0); // Use logical for path creation
        ctx.beginPath();hl.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
        ctx.setTransform(1,0,0,1,0,0); // Switch back to physical for clearRect
        ctx.clearRect(pX, pY, pW, pH); // Approximate rect clear within clip
        // Better: just clearRect the bounding box, clip handles shape
        ctx.clearRect(0,0,S.CW*dpr,S.CH*dpr); // No, this clears everything.
        // With clip active, we can fillRect with clear or composite op
        ctx.globalCompositeOperation='destination-out';
        ctx.fillStyle='black';
        ctx.fillRect(0,0,S.CW*dpr,S.CH*dpr); // Clears only inside clip
        ctx.globalCompositeOperation='source-over';
        ctx.restore();
      }
      else {
        // Rect cut
        ctx.save(); ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(pX, pY, pW, pH);
        ctx.restore();
      }
      E.commitUndo();E.afterEdit();S.sel=null;S.lassoPath=[];E.toast('切り取りました');return;
    }
  };

  T.pasteAt=(px,py)=>{
    if(!S.clip)return;E.pushUndo();
    
    const dpr = C.DPR;
    const ctx = E.curX();
    const logW = S.clip.width / dpr;
    const logH = S.clip.height / dpr;
    
    ctx.drawImage(S.clip, px - logW/2, py - logH/2, logW, logH);
    
    R.contexts.floatC.clearRect(0,0,S.CW,S.CH);
    E.commitUndo();E.afterEdit();E.toast('貼り付けました');
  };

  T.rotateLayer=deg=>{
    E.pushUndo();const ctx=E.curX();
    const tmp=document.createElement('canvas');tmp.width=S.CW;tmp.height=S.CH;
    tmp.getContext('2d').drawImage(E.curC(),0,0);
    ctx.clearRect(0,0,S.CW,S.CH);
    ctx.save();ctx.translate(S.CW/2,S.CH/2);ctx.rotate(deg*Math.PI/180);
    ctx.drawImage(tmp,-S.CW/2,-S.CH/2);ctx.restore();
    E.commitUndo();E.afterEdit();E.toast(deg+' deg');
  };
  T.flipLayer=axis=>{
    E.pushUndo();const ctx=E.curX();
    const tmp=document.createElement('canvas');tmp.width=S.CW;tmp.height=S.CH;
    tmp.getContext('2d').drawImage(E.curC(),0,0);
    ctx.clearRect(0,0,S.CW,S.CH);ctx.save();
    if(axis==='h'){ctx.translate(S.CW,0);ctx.scale(-1,1);}
    else{ctx.translate(0,S.CH);ctx.scale(1,-1);}
    ctx.drawImage(tmp,0,0);ctx.restore();
    E.commitUndo();E.afterEdit();E.toast(axis==='h'?'H-Flip':'V-Flip');
  };

  T.drawCursor=(x,y)=>{
    const ctx=R.contexts.cursorC;if(!ctx) return;
    ctx.clearRect(0,0,S.CW,S.CH);
    if(S.cpMode){
      // In control-point mode, show crosshair
      ctx.strokeStyle='rgba(255,0,0,0.6)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);ctx.stroke();
      return;
    }
    if(S.ct==='pixel'){
      const ps=S.pixelSize;
      const gx=Math.floor(x/ps)*ps,gy=Math.floor(y/ps)*ps;
      ctx.strokeStyle='rgba(255,100,0,0.7)';ctx.lineWidth=1;
      ctx.strokeRect(gx,gy,ps,ps);
      return;
    }
    if(S.ct!=='pen'&&S.ct!=='eraser') return;
    const r=S.ct==='eraser'?S.cs:S.cs/2;
    ctx.strokeStyle=S.ct==='eraser'?'rgba(255,0,0,0.6)':'rgba(50,50,50,0.5)';
    ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=S.ct==='eraser'?'rgba(255,0,0,0.4)':'rgba(0,0,0,0.3)';
    ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();
  };

  T.drawControlPointOverlay=()=>{
    if(!S.cpMode||!G.VectorPaths) return;
    const ctx=R.contexts.cursorC;if(!ctx)return;
    ctx.clearRect(0,0,S.CW,S.CH);
    G.VectorPaths.drawControlPoints(ctx,E.curId(),S.cl,S.CW,S.CH,S.zoom);
  };

  G.Tools=T;
})(window.UgokuDraw);
