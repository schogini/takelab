'use strict';
class CameraRenderer{
  constructor(video,canvas,getSettings,onStatus){
    Object.assign(this,{video,canvas,getSettings,onStatus,fit:'cover',mirror:false,active:false,worker:null,pending:false,epoch:0,frameId:0,lastDraw:0,lastVision:0,face:null,targetFace:null,maskReady:false,failed:false,backgroundImage:null});
    this.ctx=canvas.getContext('2d');
    for(const key of ['source','subject','mask','soft']){this[key]=document.createElement('canvas');this[key+'Ctx']=this[key].getContext('2d');}
    this.observer=new ResizeObserver(()=>this.size());this.observer.observe(canvas);this.size();
  }
  size(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.round(r.width*dpr));this.canvas.height=Math.max(1,Math.round(r.height*dpr));}
  beginRecording(dimensions,fps){
    if(this.recording)throw Error('This camera is already being recorded.');
    const canvas=document.createElement('canvas');Object.assign(canvas,dimensions);this.recording={canvas,fps};
    try{if(this.video.readyState>=2&&this.video.videoWidth)this.draw(this.getSettings(),canvas,true);}catch(error){this.recording=null;throw error;}
    return {canvas,cleanup:()=>{if(this.recording?.canvas===canvas)this.recording=null;}};
  }
  setLayout(fit,mirror){this.fit=fit;this.mirror=mirror;}
  setImage(image){this.backgroundImage=image;}
  setActive(active){if(active===this.active)return;this.active=active;if(active){this.size();this.loop(performance.now());}else{cancelAnimationFrame(this.frameId);this.releaseVision();this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);}}
  releaseVision(){this.epoch++;this.worker?.terminate();this.worker=null;this.pending=false;clearTimeout(this.timeout);this.face=null;this.targetFace=null;this.maskReady=false;this.failed=false;this.lastVision=0;this.onStatus('');}
  changed(){const s=this.getSettings(),signature=[s.background!=='off',s.autoCenter||s.softening>0].join(':');if(signature!==this.visionSignature){this.releaseVision();this.visionSignature=signature;}}
  requestVision(now,s){
    const segment=s.background!=='off',face=s.autoCenter||s.softening>0;
    this.visionSignature=[segment,face].join(':');
    if((!segment&&!face)||this.pending||this.failed||now-this.lastVision<100)return;
    if(!window.Worker||!window.createImageBitmap||!window.OffscreenCanvas){this.failed=true;this.onStatus('Local effects are unavailable in this browser. Use current Chrome, or turn background and face effects off.');return;}
    this.lastVision=now;this.pending=true;const epoch=this.epoch,id=now;
    if(!this.worker){this.onStatus('Loading local vision effects…');this.worker=new Worker('/workspace/camera-vision-worker.js');this.worker.onmessage=({data})=>{
      if(epoch!==this.epoch)return;clearTimeout(this.timeout);this.pending=false;
      if(data.error){this.failed=true;this.onStatus('Vision effect unavailable. Turn background / face effects off to use the normal feed.');console.warn('Local camera effect:',data.error);return;}
      if(data.mask){const {width,height,rgba}=data.mask;this.mask.width=width;this.mask.height=height;this.maskCtx.putImageData(new ImageData(rgba,width,height),0,0);this.maskReady=true;}
      this.targetFace=data.face;this.onStatus(face?(data.face?'Face detected · local effects active':'No face detected · holding framing'):'Local background effect active');
    };this.worker.onerror=()=>{if(epoch!==this.epoch)return;clearTimeout(this.timeout);this.pending=false;this.failed=true;this.onStatus('Local effects could not load. Turn background / face effects off to use the normal feed.');};}
    const resize=Math.min(1,480/Math.max(this.video.videoWidth,this.video.videoHeight)),width=Math.max(1,Math.round(this.video.videoWidth*resize)),height=Math.max(1,Math.round(this.video.videoHeight*resize));
    createImageBitmap(this.video,{resizeWidth:width,resizeHeight:height}).then(frame=>{
      if(epoch!==this.epoch||!this.active){frame.close();return;}
      this.worker.postMessage({id,frame,segment,face,timestamp:now},[frame]);
      this.timeout=setTimeout(()=>{if(epoch!==this.epoch)return;this.worker?.terminate();this.worker=null;this.pending=false;this.failed=true;this.onStatus('Local effects timed out. Turn effects off, then on to retry.');},30000);
    }).catch(()=>{if(epoch===this.epoch){this.pending=false;this.failed=true;this.onStatus('Could not process camera frames. Turn background / face effects off to use the normal feed.');}});
  }
  loop(now){if(!this.active)return;this.frameId=requestAnimationFrame(t=>this.loop(t));const s=this.getSettings();if(now-this.lastDraw<1000/Math.min(s.fps,this.recording?.fps||30)||this.video.readyState<2||!this.video.videoWidth)return;this.lastDraw=now;
    this.requestVision(now,s);
    if(this.recording){
      this.draw(s,this.recording.canvas,true);
      const w=this.canvas.width,h=this.canvas.height,src=this.recording.canvas,fit=Math.min(w/src.width,h/src.height);
      this.ctx.clearRect(0,0,w,h);this.ctx.drawImage(src,(w-src.width*fit)/2,(h-src.height*fit)/2,src.width*fit,src.height*fit);
    }else this.draw(s);
  }
  draw(s,target=this.canvas,native=false){
    const limit=native?Infinity:Math.max(1280,this.canvas.width,this.canvas.height);
    const resize=Math.min(1,limit/Math.max(this.video.videoWidth,this.video.videoHeight)),width=Math.max(1,Math.round(this.video.videoWidth*resize)),height=Math.max(1,Math.round(this.video.videoHeight*resize)),ctx=this.sourceCtx;
    if(this.source.width!==width||this.source.height!==height){for(const key of ['source','subject','soft']){this[key].width=width;this[key].height=height;}}
    ctx.clearRect(0,0,width,height);ctx.filter=`brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%)`;ctx.drawImage(this.video,0,0,width,height);ctx.filter='none';
    if(s.warmth){ctx.save();ctx.globalCompositeOperation='soft-light';ctx.fillStyle=s.warmth>0?`rgba(255,155,65,${s.warmth/200})`:`rgba(65,155,255,${-s.warmth/200})`;ctx.fillRect(0,0,width,height);ctx.restore();}
    if(this.targetFace){const next={x:this.targetFace.x+this.targetFace.width/2,y:this.targetFace.y+this.targetFace.height*.6};if(!this.face)this.face=next;else{this.face.x+=(next.x-this.face.x)*.08;this.face.y+=(next.y-this.face.y)*.08;}}
    // Blend only the cheek regions; leave eyes and mouth sharp.
    if(s.softening&&this.targetFace){const box=this.targetFace;this.softCtx.clearRect(0,0,width,height);this.softCtx.filter=`blur(${Math.max(1,width/350)}px)`;this.softCtx.drawImage(this.source,0,0);this.softCtx.filter='none';ctx.save();ctx.beginPath();for(const offset of [.27,.73]){const x=(box.x+box.width*offset)*width,y=(box.y+box.height*.62)*height,rx=box.width*width*.16;ctx.moveTo(x+rx,y);ctx.ellipse(x,y,rx,box.height*height*.13,0,0,Math.PI*2);}ctx.clip();ctx.globalAlpha=s.softening/100*.65;ctx.drawImage(this.soft,0,0);ctx.restore();}
    const out=target===this.canvas?this.ctx:target.getContext('2d'),w=target.width,h=target.height;out.clearRect(0,0,w,h);
    if(s.background!=='off'&&!this.maskReady)return;
    let picture=this.source;
    if(s.background!=='off'){
      const person=this.subjectCtx;person.clearRect(0,0,width,height);person.drawImage(this.source,0,0);person.globalCompositeOperation='destination-in';person.drawImage(this.mask,0,0,width,height);person.globalCompositeOperation='source-over';picture=this.subject;
    }
    const frame=CameraSettings.framing(width,height,w,h,s,this.fit,s.autoCenter?this.face:null);
    out.save();out.translate(frame.x,frame.y);out.scale(this.mirror?-frame.scale:frame.scale,frame.scale);out.rotate(frame.radians);out.translate(-frame.cx,-frame.cy);
    if(s.background==='blur'){out.filter=`blur(${s.blur}px)`;out.drawImage(this.source,-s.blur*2,-s.blur*2,width+s.blur*4,height+s.blur*4);out.filter='none';}
    if(s.background==='color'||s.background==='image'){out.fillStyle=s.backgroundColor;out.fillRect(0,0,width,height);if(s.background==='image'&&this.backgroundImage){const image=this.backgroundImage,scale=Math.max(width/image.width,height/image.height);out.drawImage(image,(width-image.width*scale)/2,(height-image.height*scale)/2,image.width*scale,image.height*scale);}}
    out.drawImage(picture,0,0);out.restore();
  }
}
