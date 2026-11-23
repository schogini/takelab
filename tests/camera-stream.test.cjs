const test=require('node:test');
const assert=require('node:assert/strict');
const {CameraCapture}=require('../web/workspace/camera-stream.js');
function fakeStream(deviceId='camera-1',live=true){
  const listeners={};
  const track={readyState:live?'live':'ended',stopped:false,stop(){this.stopped=true;this.readyState='ended';},getSettings(){return {deviceId};},addEventListener(name,callback){listeners[name]=callback;},end(){this.readyState='ended';listeners.ended?.();}};
  return {track,getTracks(){return [track];},getVideoTracks(){return [track];}};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test('independent cameras request the selected devices without audio',async()=>{
  const calls=[],streams=[fakeStream('head'),fakeStream('project')];
  const media={async getUserMedia(constraints){calls.push(constraints);return streams[calls.length-1];}};
  const head=new CameraCapture(media),project=new CameraCapture(media);
  assert.equal(await head.start('head'),true);assert.equal(await project.start('project'),true);
  assert.equal(calls[0].audio,false);assert.deepEqual(calls[0].video.deviceId,{exact:'head'});assert.deepEqual(calls[1].video.deviceId,{exact:'project'});
  head.stop();assert.equal(streams[0].track.stopped,true);assert.equal(streams[1].track.stopped,false);assert.equal(project.status,'live');project.stop();
});

test('a late permission result is stopped after the camera was closed',async()=>{
  const permission=deferred(),stream=fakeStream(),updates=[];
  const capture=new CameraCapture({getUserMedia(){return permission.promise;}},value=>updates.push(value.status));
  const starting=capture.start();capture.stop();permission.resolve(stream);
  assert.equal(await starting,false);assert.equal(stream.track.stopped,true);assert.equal(capture.stream,null);assert.equal(capture.status,'off');assert.equal(updates.includes('live'),false);
});

test('a stale startup cannot replace a newer camera selection',async()=>{
  const first=deferred(),second=deferred(),old=fakeStream('old'),current=fakeStream('current');let calls=0;
  const capture=new CameraCapture({getUserMedia(){return (++calls===1?first:second).promise;}});
  const a=capture.start('old'),b=capture.start('current');second.resolve(current);assert.equal(await b,true);
  first.resolve(old);assert.equal(await a,false);assert.equal(old.track.stopped,true);assert.equal(current.track.stopped,false);assert.equal(capture.stream,current);capture.stop();
});

test('switching sources releases the old camera before requesting the new one',async()=>{
  const old=fakeStream('old'),current=fakeStream('current');let calls=0;
  const capture=new CameraCapture({async getUserMedia(){if(++calls===1)return old;assert.equal(old.track.stopped,true);return current;}});
  await capture.start('old');await capture.start('current');assert.equal(capture.stream,current);capture.stop();
});

test('permission rejection gives an actionable message and no live stream',async()=>{
  let latest;const capture=new CameraCapture({async getUserMedia(){throw {name:'NotAllowedError'};}},value=>latest=value);
  assert.equal(await capture.start(),false);assert.equal(latest.status,'error');assert.match(latest.error,/Allow cameras/);assert.equal(capture.stream,null);
});

test('device disconnection clears the stream and reports the ended camera',async()=>{
  const stream=fakeStream();let latest;const capture=new CameraCapture({async getUserMedia(){return stream;}},value=>latest=value);
  await capture.start();stream.track.end();assert.equal(capture.stream,null);assert.equal(stream.track.stopped,true);assert.equal(latest.status,'off');assert.match(latest.error,/disconnected/);
});

test('a camera without live video is released instead of displaying a false live state',async()=>{
  const stream=fakeStream('ended',false);const capture=new CameraCapture({async getUserMedia(){return stream;}});
  assert.equal(await capture.start(),false);assert.equal(stream.track.stopped,true);assert.equal(capture.status,'error');assert.equal(capture.stream,null);
});

test('the default camera request has no mandatory device ID',async()=>{
  let constraints;const stream=fakeStream();const capture=new CameraCapture({async getUserMedia(value){constraints=value;return stream;}});
  await capture.start();assert.equal(constraints.video.deviceId,undefined);assert.equal(constraints.audio,false);capture.stop();
});

test('unsupported browser APIs produce a controlled error',async()=>{
  let latest;const capture=new CameraCapture(undefined,value=>latest=value);
  assert.equal(await capture.start(),false);assert.equal(latest.status,'error');assert.match(latest.error,/localhost or HTTPS/);
});
