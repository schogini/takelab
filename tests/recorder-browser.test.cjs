const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function environment(){
  const classes=new Set(),events=[];
  const document={body:{classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);},remove(name){classes.delete(name);}}},getElementById:()=>({})};
  const context=vm.createContext({document,CropTarget:{fromElement:async()=>{events.push(classes.has('recording-clean-screen'));return {};}}});
  vm.runInContext(fs.readFileSync(require.resolve('../web/workspace/recorder-browser.js'),'utf8')+';globalThis.env=createRecordingEnvironment({});',context);
  const track={cropTo:async()=>{throw Error('Wrong source');}};
  return {env:context.env,classes,events,display:{getVideoTracks:()=>[track]}};
}
test('separate-camera capture hides composited overlays before cropping and restores after setup failure',async()=>{
  const {env,classes,events,display}=environment(),options={separateCameras:true};
  await assert.rejects(env.prepareVideo(display,options),/Could not crop/);
  assert.deepEqual(events,[true]);assert.ok(classes.has('recording-clean-screen'));
  env.cleanup(options);assert.equal(classes.has('recording-clean-screen'),false);
});
test('combined capture keeps camera overlays visible',async()=>{
  const {env,classes,events,display}=environment();
  await assert.rejects(env.prepareVideo(display,{separateCameras:false}),/Could not crop/);
  assert.deepEqual(events,[false]);assert.equal(classes.size,0);env.cleanup({});
});
