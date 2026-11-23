const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {RecordingFormat}=require('../web/workspace/recorder-core.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({count=2,confirmResult=true,removeError=null,removeWait=null,convert=null}={}){
  const nodes=new Map(),confirmations=[],removed=[],revoked=[],settings=new Map([['workspace.appearance','keep appearance'],['workspace.cameraEffects','keep cameras']]);let controller;
  const takes=Array.from({length:count},(_,i)=>({id:`teleprompt-test-${i}.webm`,name:`teleprompt-test-${i}.webm`,file:new File(['video'],`teleprompt-test-${i}.webm`),persisted:true}));
  function node(id){if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',hidden:false,disabled:false,src:'',dataset:{},classList:{toggle(){}},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},append(){},click(){this.clicks=(this.clicks||0)+1;},replaceChildren(...items){this.options=items;},add(item){this.options.push(item);},pause(){},load(){},addEventListener(){},showPopover(){},hidePopover(){},getBoundingClientRect(){return {width:654,height:598};}});return nodes.get(id);}
  const library={async list(){return takes.slice();},async remember(){},async remove(id){removed.push(id);if(removeWait)await removeWait;if(removeError){const error=typeof removeError==='function'?removeError(id):removeError;if(error)throw error;}const index=takes.findIndex(t=>t.id===id);if(index!==-1)takes.splice(index,1);}};
  const context=vm.createContext({document:{getElementById:node,createElement:()=>node('panel'),body:{dataset:{},classList:{toggle(){}},append(){}}},window:{addEventListener(){},CamtasiaExport:{convert}},localStorage:{getItem:key=>settings.get(key)??null,setItem:(key,value)=>settings.set(key,value)},RecordingLibrary:class{constructor(){return library;}},BrowseRecorder:class{constructor(env,update){this.state='idle';this.update=update;controller=this;}snapshot(){return {state:this.state,message:'',elapsed:0,level:0,bytes:0};}},createRecordingEnvironment:()=>({}),RecordingFormat,Option:class{constructor(text,value){Object.assign(this,{text,value});}},URL:{createObjectURL:file=>'blob:'+file.name,revokeObjectURL:url=>revoked.push(url)},ResizeObserver:class{observe(){}},setInterval:()=>1,clearInterval(){},confirm:message=>{confirmations.push(message);return confirmResult;}});
  vm.runInContext(fs.readFileSync(require.resolve('../web/workspace/recorder-ui.js'),'utf8'),context);
  return {node,takes,removed,confirmations,revoked,settings,get controller(){return controller;}};
}
test('cancelled deletion leaves recording, playback and all settings untouched',async()=>{
  const f=fixture({confirmResult:false});await tick();const before=f.node('recording-playback').src;await f.node('recording-delete').onclick();assert.equal(f.removed.length,0);assert.equal(f.node('recording-playback').src,before);assert.match(f.confirmations[0],/teleprompt-test-0.webm/);assert.equal(f.settings.get('workspace.cameraEffects'),'keep cameras');
});
test('confirmed deletion selects the next take and preserves settings',async()=>{
  const f=fixture();await tick();await f.node('recording-delete').onclick();assert.deepEqual(f.removed,['teleprompt-test-0.webm']);assert.equal(f.node('recording-takes').value,'teleprompt-test-1.webm');assert.equal(f.node('recording-download').download,'teleprompt-test-1.webm');assert.match(f.node('recording-status').textContent,/Deleted teleprompt-test-0.webm/);assert.equal(f.settings.size,2);assert.equal(f.settings.get('workspace.appearance'),'keep appearance');assert.ok(f.revoked.length);
});
test('deleting the last take clears playback, download and delete controls',async()=>{
  const f=fixture({count:1});await tick();await f.node('recording-delete').onclick();assert.equal(f.node('recording-takes').value,'');assert.equal(f.node('recording-playback').hidden,true);assert.equal(f.node('recording-download').hidden,true);assert.equal(f.node('recording-delete').hidden,true);assert.equal(f.node('recording-take-info').textContent,'');
});
test('deletion cannot run during capture and Start stays disabled during deletion',async()=>{
  let release;const wait=new Promise(resolve=>release=resolve),f=fixture({removeWait:wait});await tick();f.controller.state='recording';f.controller.update(f.controller.snapshot());assert.equal(f.node('recording-delete').disabled,true);await f.node('recording-delete').onclick();assert.equal(f.removed.length,0);f.controller.state='idle';f.controller.update(f.controller.snapshot());const done=f.node('recording-delete').onclick();await tick();assert.equal(f.node('recording-start').disabled,true);assert.equal(f.node('recording-takes').disabled,true);release();await done;assert.equal(f.node('recording-start').disabled,false);
});
test('a failed deletion restores the take selection and reports the error',async()=>{
  const f=fixture({removeError:Error('Disk denied')});await tick();await f.node('recording-delete').onclick();assert.equal(f.node('recording-takes').value,'teleprompt-test-0.webm');assert.equal(f.node('recording-delete').disabled,false);assert.match(f.node('recording-status').textContent,/Disk denied/);assert.equal(f.takes.length,2);
});

test('Camtasia conversion locks conflicting actions and downloads a separate copy',async()=>{
  let release,called;const wait=new Promise(resolve=>release=resolve);
  const f=fixture({convert:async(take,status)=>{called=take;status('Converting');await wait;return {url:'/api/recording-export/download?id=test',name:'converted.mp4',fps:30};}});await tick();
  const original=f.node('recording-download').href,job=f.node('recording-camtasia').onclick();
  assert.equal(f.node('recording-start').disabled,true);assert.equal(f.node('recording-takes').disabled,true);assert.equal(f.node('recording-delete').disabled,true);
  await f.node('recording-delete').onclick();await f.node('recording-delete-all').onclick();assert.equal(f.confirmations.length,0);assert.equal(f.removed.length,0);assert.equal(called.id,f.takes[0].id);
  release();await job;
  assert.equal(f.node('recording-camtasia-download').download,'converted.mp4');assert.equal(f.node('recording-camtasia-download').clicks,1);assert.equal(f.node('recording-camtasia-download').hidden,false);
  assert.equal(f.node('recording-download').href,original);assert.equal(f.takes.length,2);assert.equal(f.node('recording-start').disabled,false);assert.equal(f.settings.size,2);
});
test('failed Camtasia conversion restores actions and keeps the original downloadable',async()=>{
  const f=fixture({convert:async()=>{throw Error('FFmpeg unavailable');}});await tick();const original=f.node('recording-download').href;
  await f.node('recording-camtasia').onclick();assert.match(f.node('recording-export-status').textContent,/FFmpeg unavailable/);assert.equal(f.node('recording-camtasia-download').hidden,true);assert.equal(f.node('recording-camtasia').disabled,false);assert.equal(f.node('recording-download').href,original);
});

test('Delete all cancellation preserves every recording and settings',async()=>{
  const f=fixture({confirmResult:false});await tick();const original=f.node('recording-download').href;
  await f.node('recording-delete-all').onclick();assert.equal(f.removed.length,0);assert.equal(f.takes.length,2);assert.equal(f.node('recording-download').href,original);assert.match(f.confirmations[0],/all 2 saved recordings/);assert.match(f.confirmations[0],/separate camera/);
});
test('Delete all removes every take, clears playback and preserves settings',async()=>{
  const f=fixture({count:3});await tick();await f.node('recording-delete-all').onclick();
  assert.equal(f.removed.length,3);assert.equal(f.takes.length,0);assert.equal(f.node('recording-playback').hidden,true);assert.equal(f.node('recording-camtasia-download').hidden,true);assert.equal(f.node('recording-download').hidden,true);assert.equal(f.node('recording-delete-all').disabled,true);assert.equal(f.settings.size,2);assert.match(f.node('recording-status').textContent,/Deleted all 3 recordings/);
});
test('Delete all continues after a locked take and reports partial failure accurately',async()=>{
  const f=fixture({count:3,removeError:id=>id.includes('test-1')?Error('Recording in use'):null});await tick();await f.node('recording-delete-all').onclick();
  assert.equal(f.removed.length,3);assert.equal(f.takes.length,1);assert.equal(f.takes[0].id,'teleprompt-test-1.webm');assert.match(f.node('recording-status').textContent,/Deleted 2 of 3/);assert.match(f.node('recording-status').textContent,/Recording in use/);assert.equal(f.node('recording-delete-all').disabled,false);
});
test('Delete all is unavailable during capture, conversion, deletion, and for an empty library',async()=>{
  const empty=fixture({count:0});await tick();await empty.node('recording-delete-all').onclick();assert.equal(empty.confirmations.length,0);assert.equal(empty.node('recording-delete-all').disabled,true);
  let release;const wait=new Promise(resolve=>release=resolve),f=fixture({removeWait:wait});await tick();f.controller.state='recording';f.controller.update(f.controller.snapshot());await f.node('recording-delete-all').onclick();assert.equal(f.confirmations.length,0);
  f.controller.state='idle';const job=f.node('recording-delete-all').onclick();await tick();assert.equal(f.node('recording-start').disabled,true);assert.equal(f.node('recording-takes').disabled,true);assert.equal(f.node('recording-delete-all').disabled,true);await f.node('recording-delete-all').onclick();assert.equal(f.confirmations.length,1);release();await job;
});
