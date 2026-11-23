const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function library(){
  const context=vm.createContext({navigator:{storage:{getDirectory:async()=>{throw Error('Unavailable');}}},crypto:require('node:crypto').webcrypto,File:class{constructor(chunks,name){this.name=name;this.size=chunks.reduce((sum,c)=>sum+c.size,0);this.lastModified=Date.now();}}});
  vm.runInContext(fs.readFileSync(require.resolve('../web/workspace/recording-library.js'),'utf8')+';globalThis.library=new RecordingLibrary();',context);return context.library;
}
test('concurrent camera and browse memory sinks share the recording memory limit',async()=>{
  const lib=library(),main=await lib.sink({mime:'video/mp4'}),camera=await lib.sink({mime:'video/mp4',label:'head'});
  await main.append({size:300*1024*1024});await assert.rejects(camera.append({size:300*1024*1024}),/memory recording limit/);
  await main.abort();await camera.append({size:300*1024*1024});await camera.abort();assert.equal(lib.pendingBytes,0);
});
test('memory takes are retained once and completed camera files have descriptive names',async()=>{
  const lib=library(),sink=await lib.sink({mime:'video/mp4',label:'project'});await sink.append({size:1024});const take=await sink.finish();await lib.remember({...take,label:'Project camera'});const takes=await lib.list();assert.equal(takes.length,1);assert.match(takes[0].name,/-project\.mp4$/);assert.equal(lib.pendingBytes,0);
});
function diskLibrary(){
  class Directory{
    constructor(){this.kind='directory';this.children=new Map();}
    async getDirectoryHandle(name,{create=false}={}){if(!this.children.has(name)){if(!create)throw Error('Missing directory');this.children.set(name,new Directory());}return this.children.get(name);}
    async getFileHandle(name,{create=false}={}){if(!this.children.has(name)){if(!create)throw Error('Missing file');const handle={kind:'file',bytes:new Blob([]),getFile:async()=>new File([handle.bytes],name),createWritable:async()=>{const parts=[];return {write:async part=>{if(this.failWrite)throw Error('Disk full');parts.push(part);},close:async()=>{handle.bytes=new Blob(parts);},abort:async()=>{}};}};this.children.set(name,handle);}return this.children.get(name);}
    async removeEntry(name){if(!this.children.has(name))throw Object.assign(Error('Missing entry'),{name:'NotFoundError'});this.children.delete(name);}
    async *entries(){yield* this.children.entries();}
  }
  const root=new Directory(),held=new Map();
  const locks={request:async(name,options,callback)=>{if(typeof options==='function'){callback=options;options={};}if(held.has(name)){if(options.ifAvailable)return callback(null);throw Error('Test lock busy');}held.set(name,true);try{return await callback({name});}finally{held.delete(name);}}};
  function fresh(){const context=vm.createContext({navigator:{storage:{getDirectory:async()=>root},locks},crypto:require('node:crypto').webcrypto,File,Blob});vm.runInContext(fs.readFileSync(require.resolve('../web/workspace/recording-library.js'),'utf8')+';globalThis.library=new RecordingLibrary();',context);return context.library;}
  return {root,fresh,crash:()=>held.clear()};
}
test('closed checkpoints survive a simulated tab crash and recover the Top camera in order',async()=>{
  const disk=diskLibrary(),lib=disk.fresh(),sink=await lib.sink({mime:'video/mp4',label:'top',width:1920,height:1080,fps:30});await sink.append(new Blob(['header']));await sink.append(new Blob(['video']));
  assert.equal((await lib.list()).length,0,'live take must not be recovered by another scan');
  disk.crash();const recovered=await disk.fresh().list();assert.equal(recovered.length,1);assert.equal(await recovered[0].file.text(),'headervideo');assert.equal(recovered[0].recovered,true);assert.equal(recovered[0].label,'Top');assert.equal(recovered[0].width,1920);assert.match(recovered[0].warning,/final unsaved/);
  assert.equal((await disk.fresh().list()).length,1,'recovery is idempotent');
});
test('a chunk whose writer was open at crash is excluded while prior checkpoints survive',async()=>{
  const disk=diskLibrary(),lib=disk.fresh(),sink=await lib.sink({mime:'video/webm'});await sink.append(new Blob(['saved']));const root=await lib.root();let journal;for await(const [name,handle] of root.entries())if(name.endsWith('.chunks'))journal=handle;const file=await journal.getFileHandle('00000001.chunk',{create:true}),writer=await file.createWritable();await writer.write(new Blob(['not-closed']));disk.crash();const recovered=await disk.fresh().list();assert.equal(await recovered[0].file.text(),'saved');
});
test('normal finish assembles one complete file and removes its checkpoint directory',async()=>{
  const disk=diskLibrary(),lib=disk.fresh(),sink=await lib.sink({mime:'video/webm',label:'head'});await sink.append(new Blob(['one']));await sink.append(new Blob(['two']));const take=await sink.finish();assert.equal(await take.file.text(),'onetwo');assert.equal(take.recovered,false);const root=await lib.root();assert.ok([...root.children.keys()].every(name=>!name.endsWith('.chunks')));
});
test('failed final assembly retains checkpoint data for a later retry',async()=>{
  const disk=diskLibrary(),lib=disk.fresh(),sink=await lib.sink({mime:'video/webm'});await sink.append(new Blob(['saved']));const root=await lib.root();root.failWrite=true;await assert.rejects(sink.finish(),/Disk full/);await sink.abort();assert.ok([...root.children.keys()].some(name=>name.endsWith('.chunks')));root.failWrite=false;const recovered=await disk.fresh().list();assert.equal(await recovered[0].file.text(),'saved');
});

test('deleting a memory recording leaves other takes and storage accounting intact',async()=>{
  const lib=library(),first=await lib.sink({mime:'video/mp4'}),second=await lib.sink({mime:'video/mp4',label:'head'});await first.append({size:100});await second.append({size:200});const a=await first.finish(),b=await second.finish();await lib.remove(a.id);const remaining=await lib.list();assert.equal(remaining.length,1);assert.equal(remaining[0].id,b.id);assert.equal(remaining[0].file.size,200);assert.equal(lib.pendingBytes,0);
});
test('deleting a disk take removes only its video, metadata and recovery directory',async()=>{
  const disk=diskLibrary(),lib=disk.fresh(),first=await lib.sink({mime:'video/mp4'}),second=await lib.sink({mime:'video/mp4',label:'top'});await first.append(new Blob(['first']));await second.append(new Blob(['second']));const a=await first.finish(),b=await second.finish(),root=await lib.root();
  await lib.write(root,'workspace-settings.json','keep settings');const journal=await root.getDirectoryHandle(a.name+'.chunks',{create:true});await lib.write(journal,'manifest.json',JSON.stringify({name:a.name,mime:a.mime}));await lib.write(journal,'00000000.chunk',new Blob(['must not resurrect']));
  await lib.remove(a.id);const remaining=await disk.fresh().list();assert.equal(remaining.length,1);assert.equal(remaining[0].id,b.id);assert.equal(await remaining[0].file.text(),'second');assert.equal(await(await(await root.getFileHandle('workspace-settings.json')).getFile()).text(),'keep settings');assert.ok(!root.children.has(a.name+'.json'));assert.ok(!root.children.has(a.name+'.chunks'));
});
test('a take locked by an active recorder cannot be deleted',async()=>{
  const disk=diskLibrary(),lib=disk.fresh(),sink=await lib.sink({mime:'video/webm'});await sink.append(new Blob(['live']));const root=await lib.root(),id=[...root.children.keys()].find(name=>name.endsWith('.chunks')).slice(0,-7);await assert.rejects(lib.remove(id),/in use by another tab/);const take=await sink.finish();assert.equal(await take.file.text(),'live');
});
test('recording deletion rejects path traversal, settings names and invalid IDs',async()=>{
  const lib=diskLibrary().fresh();for(const id of ['../settings.json','workspace.cameraEffects','teleprompt-../other.mp4','teleprompt-a.mp4.json','teleprompt-a\\b.mp4',null])await assert.rejects(lib.remove(id),/Invalid recording filename/);
});
test('already deleted recordings are harmless and disk errors are reported without deleting other data',async()=>{
  const disk=diskLibrary(),lib=disk.fresh(),sink=await lib.sink({mime:'video/webm'});await sink.append(new Blob(['keep']));const take=await sink.finish(),root=await lib.root();const original=root.removeEntry.bind(root);root.removeEntry=async(name,options)=>{if(name===take.id)throw Error('Disk access denied');return original(name,options);};await assert.rejects(lib.remove(take.id),/Disk access denied/);assert.equal(await(await(await root.getFileHandle(take.id)).getFile()).text(),'keep');root.removeEntry=original;await lib.remove(take.id);await lib.remove(take.id);assert.equal((await lib.list()).length,0);
});
