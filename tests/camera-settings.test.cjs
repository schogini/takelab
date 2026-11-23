const test=require('node:test');
const assert=require('node:assert/strict');
const {CameraSettings:S,CameraEffectsStore}=require('../web/workspace/camera-settings.js');
const {CameraCapture}=require('../web/workspace/camera-stream.js');
test('saved settings are bounded and untrusted modes and colors are discarded',()=>{
  const value=S.clean({zoom:99,brightness:-50,panX:Infinity,fps:1000,rotation:13,background:'url(secret)',backgroundColor:'red;display:none',autoCenter:'true'});
  assert.equal(value.zoom,3);assert.equal(value.brightness,50);assert.equal(value.panX,0);assert.equal(value.fps,30);assert.equal(value.rotation,0);assert.equal(value.background,'off');assert.equal(value.backgroundColor,'#263b46');assert.equal(value.autoCenter,false);
});
test('rotated Fit and Fill use the rotated dimensions and preserve manual positioning',()=>{
  const s={...S.defaults(),rotation:90,panX:20,panY:-10,zoom:2};
  const fit=S.framing(1920,1080,600,400,s,'contain');
  assert.equal(fit.scale,400/1920*2);assert.equal(fit.x,360);assert.equal(fit.y,180);
  const fill=S.framing(1920,1080,600,400,s,'cover');assert.equal(fill.scale,600/1080*2);
});
test('auto-centering uses a face crop without changing persisted manual settings',()=>{
  const s={...S.defaults(),autoCenter:true};const frame=S.framing(1000,500,500,250,s,'cover',{x:.7,y:.4});
  assert.equal(frame.cx,1000-500/(2*frame.scale));assert.equal(frame.cy,200);assert.equal(frame.scale,.5*1.35);assert.equal(s.panX,0);assert.equal(s.zoom,1);
});
test('person confidence masks soften edges and preserve opaque and transparent regions',()=>{
  const mask=S.alphaMask(new Float32Array([0,.25,.5,.75,1]));assert.deepEqual([mask[3],mask[7],mask[11],mask[15],mask[19]],[0,0,128,255,255]);
});
test('per-camera presets survive storage without crossing camera settings',()=>{
  let saved;const storage={getItem(){return saved;},setItem(k,v){saved=v;}};const first=new CameraEffectsStore(storage);
  first.values.head=S.clean({brightness:130,background:'blur'});first.presets.head.push({name:'Desk',settings:{...first.values.head}});assert.equal(first.save(),true);
  const restored=new CameraEffectsStore(storage);assert.equal(restored.values.head.brightness,130);assert.equal(restored.presets.head[0].settings.background,'blur');assert.equal(restored.values.project.background,'off');assert.equal(restored.presets.project.length,0);
  restored.values.head.brightness=70;assert.equal(restored.presets.head[0].settings.brightness,130);
});
test('unavailable storage leaves usable defaults and reports a failed save',()=>{
  const store=new CameraEffectsStore({getItem(){throw Error();},setItem(){throw Error();}});assert.equal(store.values.head.zoom,1);assert.equal(store.save(),false);
});
test('capture requests chosen quality as preferences without requesting audio',async()=>{
  let requested;const track={readyState:'live',stop(){},addEventListener(){}};const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};const capture=new CameraCapture({async getUserMedia(c){requested=c;return stream;}});
  await capture.start('usb',{resolution:'1080',fps:24});assert.equal(requested.video.width.ideal,1920);assert.equal(requested.video.height.ideal,1080);assert.equal(requested.video.frameRate.max,24);assert.deepEqual(requested.video.deviceId,{exact:'usb'});assert.equal(requested.audio,false);capture.stop();
});
