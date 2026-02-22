'use strict';
self.onmessage = function(e){
  const {type,reqId}=e.data;
  if(type==='floodFill') doFill(e.data,reqId);
  else if(type==='gifEncode') doGif(e.data,reqId);
  else if(type==='blur') doBlur(e.data,reqId);
  else if(type==='eraserClip') doEraserClip(e.data,reqId);
};

function doFill(msg,reqId){
  const {w,h,sx,sy,fillR,fillG,fillB,tol}=msg;
  const d=new Uint8ClampedArray(msg.data);
  const x0=Math.floor(sx),y0=Math.floor(sy);
  if(x0<0||x0>=w||y0<0||y0>=h){self.postMessage({type:'done',reqId,data:d.buffer},[d.buffer]);return;}
  const i0=(y0*w+x0)*4,tr=d[i0],tg=d[i0+1],tb=d[i0+2],ta=d[i0+3];
  if(tr===fillR&&tg===fillG&&tb===fillB&&ta===255){self.postMessage({type:'done',reqId,data:d.buffer},[d.buffer]);return;}
  const m=i=>Math.abs(d[i]-tr)<=tol&&Math.abs(d[i+1]-tg)<=tol&&Math.abs(d[i+2]-tb)<=tol&&Math.abs(d[i+3]-ta)<=tol;
  const vis=new Uint8Array(w*h),q=[y0*w+x0];vis[y0*w+x0]=1;
  while(q.length){const pi=q.pop(),px=pi%w,py=(pi/w)|0;
    let lx=px;while(lx>0&&!vis[py*w+lx-1]&&m((py*w+lx-1)*4)){lx--;vis[py*w+lx]=1;}
    let rx=px;while(rx<w-1&&!vis[py*w+rx+1]&&m((py*w+rx+1)*4)){rx++;vis[py*w+rx]=1;}
    for(let x=lx;x<=rx;x++){const i=(py*w+x)*4;d[i]=fillR;d[i+1]=fillG;d[i+2]=fillB;d[i+3]=255;
      for(const ny of[py-1,py+1])if(ny>=0&&ny<h){const ni=ny*w+x;if(!vis[ni]&&m(ni*4)){vis[ni]=1;q.push(ni);}}}}
  self.postMessage({type:'done',reqId,data:d.buffer},[d.buffer]);
}

function doBlur(msg,reqId){
  const {w,h,radius}=msg;const d=new Uint8ClampedArray(msg.data);const o=new Uint8ClampedArray(d.length);
  const r=radius;for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sr=0,sg=0,sb=0,sa=0,c=0;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h){const i=(ny*w+nx)*4;sr+=d[i];sg+=d[i+1];sb+=d[i+2];sa+=d[i+3];c++;}}
    const i=(y*w+x)*4;o[i]=sr/c;o[i+1]=sg/c;o[i+2]=sb/c;o[i+3]=sa/c;}
  self.postMessage({type:'done',reqId,data:o.buffer},[o.buffer]);
}

function doEraserClip(msg,reqId){
  self.postMessage({type:'done',reqId,result:'ok'});
}

function doGif(msg,reqId){
  const {w,h,framesData,delay}=msg;
  const cm=new Map,cols=[];
  const ac=(r,g,b)=>{const k=(r<<16)|(g<<8)|b;if(!cm.has(k)&&cols.length<255){cm.set(k,cols.length);cols.push([r,g,b]);}};
  for(const fd of framesData){const d=new Uint8Array(fd);for(let i=0;i<d.length;i+=4)ac(d[i]&0xF8,d[i+1]&0xF8,d[i+2]&0xF8);}
  while(cols.length<256)cols.push([0,0,0]);const ti=255;
  const nr=(r,g,b,a)=>{if(a<128)return ti;r&=0xF8;g&=0xF8;b&=0xF8;const k=(r<<16)|(g<<8)|b;if(cm.has(k))return cm.get(k);let best=0,bd=1e9;for(let i=0;i<cols.length-1;i++){const dr=r-cols[i][0],dg=g-cols[i][1],db=b-cols[i][2],d2=dr*dr+dg*dg+db*db;if(d2<bd){bd=d2;best=i;}}return best;};
  const buf=[];const wr=b=>buf.push(b),ws=s=>{for(let i=0;i<s.length;i++)wr(s.charCodeAt(i));},wsh=v=>{wr(v&0xFF);wr((v>>8)&0xFF);};
  ws('GIF89a');wsh(w);wsh(h);wr(0xF7);wr(0);wr(0);for(let i=0;i<256;i++){wr(cols[i][0]);wr(cols[i][1]);wr(cols[i][2]);}
  wr(0x21);wr(0xFF);wr(11);ws('NETSCAPE2.0');wr(3);wr(1);wsh(0);wr(0);
  for(let fi=0;fi<framesData.length;fi++){
    const d=new Uint8Array(framesData[fi]);wr(0x21);wr(0xF9);wr(4);wr(0x09);wsh(Math.round(delay/10));wr(ti);wr(0);
    wr(0x2C);wsh(0);wsh(0);wsh(w);wsh(h);wr(0);wr(8);
    const px=new Uint8Array(w*h);for(let i=0;i<w*h;i++){const j=i*4;px[i]=nr(d[j],d[j+1],d[j+2],d[j+3]);}
    const sb=lzw(8,px);for(const b of sb){wr(b.length);for(const x of b)wr(x);}wr(0);
    self.postMessage({type:'progress',reqId,frame:fi+1,total:framesData.length});
  }
  wr(0x3B);const r=new Uint8Array(buf);self.postMessage({type:'done',reqId,data:r.buffer},[r.buffer]);
}

function lzw(mcs,px){const cc=1<<mcs,ei=cc+1;let cs=mcs+1,nc=ei+1;const tb=new Map;
  const rst=()=>{tb.clear();for(let i=0;i<cc;i++)tb.set(String(i),i);nc=ei+1;cs=mcs+1;};
  const out=[];let bb=0,bc=0;
  const em=c=>{bb|=(c<<bc);bc+=cs;while(bc>=8){out.push(bb&0xFF);bb>>=8;bc-=8;}};
  rst();em(cc);let cur=String(px[0]);
  for(let i=1;i<px.length;i++){const nx=String(px[i]),cb=cur+','+nx;if(tb.has(cb))cur=cb;else{em(tb.get(cur));if(nc<=4095){tb.set(cb,nc++);if(nc>(1<<cs)&&cs<12)cs++;}else{em(cc);rst();}cur=nx;}}
  em(tb.get(cur));em(ei);if(bc>0)out.push(bb&0xFF);
  const blocks=[];for(let i=0;i<out.length;i+=255)blocks.push(out.slice(i,i+255));return blocks;}