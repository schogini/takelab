const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {CameraSettings:S}=require('../web/workspace/camera-settings.js');
const {CameraCapture}=require('../web/workspace/camera-stream.js');
const {RecordingFormat}=require('../web/workspace/recorder-core.js');
test('highest native resolution is negotiated from device capabilities at selected fps',async()=>{
  let applied,request;const track={readyState:'live',addEventListener(){},stop(){},getCapabilities:()=>({width:{max:4096},height:{max:2160}}),applyConstraints:async c=>{applied=c;}};
  const stream={getVideoTracks:()=>[track],getTracks:()=>[track]};const capture=new CameraCapture({getUserMedia:async c=>{request=c;return stream;}});
  await capture.start('usb',{resolution:'max',fps:30});assert.equal(request.video.resizeMode,'none');assert.equal(applied.width.ideal,4096);assert.equal(applied.height.ideal,2160);assert.equal(applied.frameRate.max,30);capture.stop();
});
test('camera output retains native detail with a tiny preview, including crop, fit and rotation',()=>{
  assert.deepEqual(S.recordingSize(3840,2160,160,90),{width:3840,height:2160});
  assert.deepEqual(S.recordingSize(3840,2160,280,210),{width:2880,height:2160});
  assert.deepEqual(S.recordingSize(3840,2160,280,210,0,'contain'),{width:3840,height:2880});
  assert.deepEqual(S.recordingSize(3840,2160,90,160,90),{width:2160,height:3840});
  assert.equal(S.defaults().resolution,'max');assert.equal(S.quality({resolution:'2160'}).width.ideal,3840);
  assert.deepEqual(RecordingFormat.dimensions(1600,900,'2160'),{width:3840,height:2160});
});
test('recording renderer processes original 4K pixels while preview remains small',()=>{
  function canvas(){const calls=[];const ctx=new Proxy({calls,drawImage(...args){calls.push(args);}},{get:(o,k)=>k in o?o[k]:()=>{}});return {width:1,height:1,getContext:()=>ctx,getBoundingClientRect:()=>({width:160,height:90})};}
  const context=vm.createContext({document:{createElement:canvas},CameraSettings:S,ResizeObserver:class{observe(){}},devicePixelRatio:1});
  vm.runInContext(fs.readFileSync(require.resolve('../web/workspace/camera-effects.js'),'utf8')+';globalThis.Renderer=CameraRenderer;',context);
  const preview=canvas(),video={videoWidth:3840,videoHeight:2160,readyState:2};const renderer=new context.Renderer(video,preview,()=>S.defaults(),()=>{});
  const recording=renderer.beginRecording({width:3840,height:2160},30);assert.ok(recording.canvas.getContext('2d').calls.length>0,'First encoded frame is filled before recording starts');renderer.draw(S.defaults(),recording.canvas,true);
  assert.equal(renderer.source.width,3840);assert.equal(renderer.source.height,2160);assert.equal(recording.canvas.width,3840);assert.equal(preview.width,160);
  recording.cleanup();assert.equal(renderer.recording,null);
});
test('stopping during maximum-resolution negotiation immediately releases the camera',async()=>{
  let finish,stops=0;const pending=new Promise(resolve=>finish=resolve);
  const track={readyState:'live',addEventListener(){},stop(){stops++;},getCapabilities:()=>({}),applyConstraints:()=>pending};
  const stream={getVideoTracks:()=>[track],getTracks:()=>[track]},capture=new CameraCapture({getUserMedia:async()=>stream});
  const task=capture.start('',{resolution:'max'});await new Promise(resolve=>setImmediate(resolve));capture.stop();assert.ok(stops>0);finish();assert.equal(await task,false);assert.equal(capture.stream,null);
});
