const test=require('node:test');
const assert=require('node:assert/strict');
const {BrowseRecorder,RecordingFormat:F}=require('../web/workspace/recorder-core.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {resolve,reject,promise};}
function stream(kind){const callbacks={};const track={stopped:false,stop(){this.stopped=true;},addEventListener(name,fn){callbacks[name]=fn;},end(){callbacks.ended?.();}};return {track,getTracks:()=>[track],getVideoTracks:()=>kind==='video'?[track]:[],getAudioTracks:()=>kind==='audio'?[track]:[]};}
function setup(overrides={}){
  let time=0,completed=[],updates=[],recorder;const display=stream('video'),mic=stream('audio'),output=stream('video'),audio=stream('audio'),chunks=[],events=[];let aborted=false,released=0,muted=false;
  const sink={storage:'disk',async append(blob){chunks.push(blob);},async finish(){return {file:new Blob(chunks),id:'take',name:'take.webm'};},async abort(){aborted=true;}};
  const env={now:()=>time,async display(){events.push('display');return display;},async prepareVideo(){events.push('crop');return {stream:output,info:'test crop',cleanup(){output.track.stop();}};},async microphone(){events.push('mic');return mic;},async mixAudio(){return {stream:audio,cleanup(){audio.track.stop();},mute(value){muted=value;},level:()=>.4};},async sink(){return sink;},createRecorder(){
    recorder={state:'inactive',starts:0,start(){this.starts++;this.state='recording';},pause(){this.state='paused';},resume(){this.state='recording';},chunk(text){this.ondataavailable({data:new Blob([text])});},stop(){this.state='inactive';queueMicrotask(()=>{this.chunk('final');this.onstop();});}};return recorder;
  },cleanup(){released++;},async wait(ms){time+=ms;},...overrides};
  const controller=new BrowseRecorder(env,s=>updates.push(s),take=>completed.push(take));
  return {controller,env,display,mic,output,audio,sink,events,chunks,completed,updates,advance:ms=>time+=ms,get recorder(){return recorder;},get aborted(){return aborted;},get released(){return released;},get muted(){return muted;}};
}
const options={width:1920,height:1080,fps:30,mime:'video/webm',countdown:0};
test('HD dimensions preserve landscape, square, and portrait aspect ratios',()=>{
  assert.deepEqual(F.dimensions(1600,900),{width:1920,height:1080});assert.deepEqual(F.dimensions(900,1600),{width:1080,height:1920});assert.deepEqual(F.dimensions(600,600),{width:1080,height:1080});assert.deepEqual(F.dimensions(800,600,'720'),{width:960,height:720});assert.equal(F.dimensions(654,598).height%2,0);
});
test('format chooses real MP4 support and falls back to supported WebM',()=>{
  assert.equal(F.mime({isTypeSupported:()=>true}),'video/mp4;codecs=avc1,mp4a.40.2');assert.equal(F.mime({isTypeSupported:t=>t==='video/mp4'}),'video/mp4');assert.equal(F.mime({isTypeSupported:t=>t==='video/webm;codecs=vp8,opus'}),'video/webm;codecs=vp8,opus');assert.throws(()=>F.mime({isTypeSupported:()=>false}),/supported video recorder/);
});
test('crop is established before microphone and recording begins',async()=>{
  const h=setup();assert.equal(await h.controller.start(options),true);assert.deepEqual(h.events,['display','crop','mic']);assert.equal(h.controller.state,'recording');assert.equal(h.controller.snapshot().level,.4);h.controller.stop();await tick();
  assert.equal(h.completed.length,1);for(const source of [h.display,h.mic,h.output,h.audio])assert.equal(source.track.stopped,true);
});
test('pause/resume excludes paused time and final data is saved in write order',async()=>{
  const h=setup();await h.controller.start(options);h.recorder.chunk('first');h.advance(1000);h.controller.pause();h.advance(5000);assert.equal(h.controller.snapshot().elapsed,1000);h.controller.resume();h.advance(1500);h.recorder.chunk('second');h.controller.stop();await tick();
  assert.equal(h.completed[0].duration,2500);assert.equal(await h.completed[0].file.text(),'firstsecondfinal');assert.equal(h.completed[0].width,1920);assert.equal(h.controller.state,'idle');
});
test('repeated Start cannot create overlapping captures',async()=>{
  const h=setup();await h.controller.start(options);assert.equal(await h.controller.start(options),false);assert.equal(h.events.filter(e=>e==='display').length,1);h.controller.stop();await tick();
});
test('cancelling a pending screen grant releases the late stream without recording',async()=>{
  const permission=deferred(),h=setup({display:()=>permission.promise});const started=h.controller.start(options);h.controller.stop();assert.equal(h.controller.state,'stopping');permission.resolve(h.display);assert.equal(await started,false);assert.equal(h.display.track.stopped,true);assert.equal(h.controller.state,'idle');assert.equal(h.completed.length,0);assert.equal(h.events.includes('mic'),false);
});
test('cancelling microphone setup stops the cropped stream and any late microphone',async()=>{
  const permission=deferred(),h=setup({microphone:()=>permission.promise});const started=h.controller.start(options);await tick();h.controller.stop();permission.resolve(h.mic);assert.equal(await started,false);assert.equal(h.display.track.stopped,true);assert.equal(h.mic.track.stopped,true);assert.equal(h.output.track.stopped,true);assert.equal(h.completed.length,0);
});
test('microphone denial releases all prepared video resources and reports permissions',async()=>{
  const h=setup({async microphone(){throw {name:'NotAllowedError'};}});assert.equal(await h.controller.start(options),false);assert.equal(h.display.track.stopped,true);assert.equal(h.output.track.stopped,true);assert.match(h.controller.message,/not granted/);assert.equal(h.completed.length,0);
});
test('a rejected crop never falls back to recording the entire shared screen',async()=>{
  const h=setup({async prepareVideo(){throw Error('Choose this workspace tab.');}});assert.equal(await h.controller.start(options),false);assert.equal(h.events.includes('mic'),false);assert.equal(h.display.track.stopped,true);assert.match(h.controller.message,/workspace tab/);
});
test('microphone mute changes only the audio mix, not camera or sharing tracks',async()=>{
  const h=setup();await h.controller.start(options);h.controller.mute(true);assert.equal(h.muted,true);assert.equal(h.controller.snapshot().muted,true);assert.equal(h.display.track.stopped,false);assert.equal(h.mic.track.stopped,false);h.controller.mute(false);assert.equal(h.muted,false);h.controller.stop();await tick();
});
test('ending sharing finalizes the last chunk and releases the microphone',async()=>{
  const h=setup();await h.controller.start(options);h.display.track.end();await tick();assert.equal(h.completed.length,1);assert.equal(await h.completed[0].file.text(),'final');assert.match(h.completed[0].warning,/sharing ended/);assert.equal(h.mic.track.stopped,true);
});
test('microphone disconnection stops rather than silently recording without narration',async()=>{
  const h=setup();await h.controller.start(options);h.mic.track.end();await tick();assert.equal(h.completed.length,1);assert.match(h.completed[0].warning,/Microphone disconnected/);assert.equal(h.display.track.stopped,true);
});
test('write failure stops capture and offers the bytes already saved as a partial take',async()=>{
  const h=setup();h.sink.append=async blob=>{if((await blob.text())==='fail')throw Error('QuotaExceeded');h.chunks.push(blob);};await h.controller.start(options);h.recorder.chunk('good');await tick();h.recorder.chunk('fail');await tick();await tick();assert.equal(h.completed.length,1);assert.equal(h.completed[0].partial,true);assert.equal(await h.completed[0].file.text(),'good');assert.equal(h.display.track.stopped,true);
});
test('empty encoded output is reported as failure, not a saved recording',async()=>{
  const h=setup();h.sink.finish=async()=>({file:new Blob([])});await h.controller.start(options);h.controller.stop();await tick();assert.equal(h.completed.length,0);assert.match(h.controller.message,/No video data/);assert.equal(h.controller.state,'idle');
});
test('cancelling the countdown aborts its temporary file without starting the encoder',async()=>{
  const waiting=deferred(),h=setup({wait:()=>waiting.promise});const started=h.controller.start({...options,countdown:3});await tick();h.controller.stop();waiting.resolve();assert.equal(await started,false);assert.equal(h.recorder.starts,0);assert.equal(h.aborted,true);assert.equal(h.completed.length,0);assert.equal(h.controller.state,'idle');
});
test('Stop waits for pending disk writes and finalizes only once',async()=>{
  const waiting=deferred(),h=setup();let finished=0;h.sink.append=async blob=>{await waiting.promise;h.chunks.push(blob);};const original=h.sink.finish;h.sink.finish=async()=>{finished++;return original();};await h.controller.start(options);h.recorder.chunk('pending');h.controller.stop();h.controller.stop();await tick();assert.equal(h.controller.state,'stopping');assert.equal(h.completed.length,0);waiting.resolve();await tick();assert.equal(h.completed.length,1);assert.equal(finished,1);assert.equal(await h.completed[0].file.text(),'pendingfinal');
});

test('an encoder error preserves final data dispatched after its inactive state',async()=>{
  const h=setup();await h.controller.start(options);h.recorder.chunk('before-');h.recorder.state='inactive';h.recorder.onerror({error:{message:'Encoder interrupted'}});
  queueMicrotask(()=>{h.recorder.chunk('last');h.recorder.onstop();});await tick();assert.equal(h.completed.length,1);assert.equal(await h.completed[0].file.text(),'before-last');assert.match(h.completed[0].warning,/Encoder interrupted/);
});
function camerasHarness(overrides={}){
  const h=setup(),sources=['head','project'].map(key=>({key,title:key+' camera',dimensions:{width:1280,height:720},stream:stream('video'),cleanup(){this.stream.track.stop();},onEnded(fn){this.end=fn;}}));
  const encoders=[],files=[];const mainCreate=h.env.createRecorder,mainSink=h.env.sink;
  h.env.prepareCameras=async()=>sources;
  const mix=h.env.mixAudio;h.env.mixAudio=async(...args)=>({...await mix(...args),microphoneStream:h.mic});
  h.env.createRecorder=(video,audio,options)=>{
    if(video===h.output)return mainCreate(video,audio,options);
    assert.equal(audio,h.mic);const encoder={state:'inactive',start(){this.state='recording';},pause(){this.state='paused';},resume(){this.state='recording';},stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['camera-final'])});this.onstop();});}};encoders.push(encoder);return encoder;
  };
  h.env.sink=async options=>{if(!options.label)return mainSink(options);const chunks=[];const sink={append:async blob=>chunks.push(blob),finish:async()=>({file:new Blob(chunks),name:options.label+'.webm'}),abort:async()=>{sink.aborted=true;}};files.push(sink);return sink;};
  Object.assign(h.env,overrides);return {h,sources,encoders,files};
}
test('optional camera files share pause/resume and stop, with microphone-only input',async()=>{
  const {h,sources,encoders}=camerasHarness();await h.controller.start({...options,separateCameras:true});assert.equal(encoders.length,2);
  h.advance(1000);h.controller.pause();assert.ok(encoders.every(e=>e.state==='paused'));h.advance(5000);h.controller.resume();assert.ok(encoders.every(e=>e.state==='recording'));h.advance(2000);h.controller.stop();await tick();
  const takes=h.completed[0].relatedTakes;assert.equal(takes.length,2);for(const take of takes){assert.equal(take.duration,3000);assert.equal(await take.file.text(),'camera-final');assert.equal(take.width,1280);}assert.ok(sources.every(s=>s.stream.track.stopped));
});
test('camera exports are off by default',async()=>{
  const {h,encoders}=camerasHarness();await h.controller.start(options);h.controller.stop();await tick();assert.equal(encoders.length,0);assert.deepEqual(h.completed[0].relatedTakes,[]);
});
test('camera disconnect saves that file while the main recording continues',async()=>{
  const {h,sources}=camerasHarness();await h.controller.start({...options,separateCameras:true});h.advance(1000);sources[0].end();await tick();assert.equal(h.controller.state,'recording');h.advance(2000);h.controller.stop();await tick();const takes=h.completed[0].relatedTakes;assert.equal(takes[0].duration,1000);assert.equal(takes[1].duration,3000);assert.match(takes[0].warning,/Camera stopped/);
});
test('a failed camera sink preserves the main file and other camera file',async()=>{
  const {h,files}=camerasHarness();await h.controller.start({...options,separateCameras:true});files[0].append=async()=>{throw Error('Camera disk failure');};h.controller.stop();await tick();assert.equal(h.completed.length,1);assert.equal(h.completed[0].relatedTakes.length,1);assert.match(h.completed[0].warning,/Camera disk failure/);
});
test('camera countdown cancellation aborts all temporary outputs',async()=>{
  const {h,files,sources}=camerasHarness();const wait=deferred();h.env.wait=()=>wait.promise;const starting=h.controller.start({...options,separateCameras:true,countdown:3});await tick();h.controller.stop();wait.resolve();await starting;assert.ok(files.every(s=>s.aborted));assert.ok(sources.every(s=>s.stream.track.stopped));assert.equal(h.completed.length,0);
});
test('camera stopped during countdown cannot hang finalization',async()=>{
  const {h,sources}=camerasHarness();const wait=deferred();h.env.wait=()=>wait.promise;const starting=h.controller.start({...options,separateCameras:true,countdown:1});await tick();sources[0].end();wait.resolve();await starting;h.controller.stop();await tick();assert.equal(h.controller.state,'idle');assert.equal(h.completed[0].relatedTakes.length,1);
});
test('camera encoder errors preserve their final data without stopping the main take',async()=>{
  const {h,encoders}=camerasHarness();await h.controller.start({...options,separateCameras:true});const encoder=encoders[0];encoder.state='inactive';encoder.onerror({error:Error('Camera encoder failed')});encoder.ondataavailable({data:new Blob(['last-camera-data'])});encoder.onstop();assert.equal(h.controller.state,'recording');h.controller.stop();await tick();const take=h.completed[0].relatedTakes[0];assert.equal(await take.file.text(),'last-camera-data');assert.equal(take.partial,true);assert.match(take.warning,/Camera encoder failed/);
});
