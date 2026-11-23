'use strict';
class RecordingLibrary{
  constructor(){this.memory=[];this.pendingBytes=0;}
  async root(){return (await navigator.storage.getDirectory()).getDirectoryHandle('teleprompt-recordings',{create:true});}
  async sink(options){
    const extension=options.mime.startsWith('video/mp4')?'mp4':'webm';
    const name=`teleprompt-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomUUID().slice(0,6)}${['head','project','top'].includes(options.label)?'-'+options.label:''}.${extension}`;
    let root;
    try{root=await this.root();}catch{}
    if(root){
      const release=await this.acquire(name),journalName=name+'.chunks';
      try{
        const journal=await root.getDirectoryHandle(journalName,{create:true});
        const metadata={name,mime:options.mime,width:options.width,height:options.height,fps:options.fps,label:{head:'Head camera',project:'Project camera',top:'Top'}[options.label]||'Browse area',started:Date.now()};
        await this.write(journal,'manifest.json',JSON.stringify(metadata));let index=0,preserve=false;
        return {storage:'disk',append:async blob=>{
          // A closed file is a checkpoint. Never keep the whole take in an open writer.
          await this.write(journal,String(index).padStart(8,'0')+'.chunk',blob);index++;
        },finish:async()=>{preserve=true;try{return await this.assemble(root,journal,metadata,false);}finally{release();}},abort:async()=>{try{if(!preserve)await root.removeEntry(journalName,{recursive:true});}finally{release();}}};
      }catch(error){release();throw error;}
    }
    const chunks=[];let size=0;
    return {storage:'memory',append:async blob=>{if(this.pendingBytes+blob.size+this.memory.reduce((sum,take)=>sum+take.file.size,0)>512*1024*1024)throw Error('Browser memory recording limit reached.');chunks.push(blob);size+=blob.size;this.pendingBytes+=blob.size;},finish:async()=>{const take={id:name,name,mime:options.mime,file:new File(chunks,name,{type:options.mime}),persisted:false};this.pendingBytes-=size;size=0;chunks.length=0;this.memory.unshift(take);return take;},abort:async()=>{this.pendingBytes-=size;size=0;chunks.length=0;}};
  }
  async write(directory,name,data){const handle=await directory.getFileHandle(name,{create:true}),writer=await handle.createWritable();try{await writer.write(data);await writer.close();}catch(error){await writer.abort().catch(()=>{});throw error;}}
  async acquire(name){
    // A crashed tab releases this lock. Other tabs must not recover a live take.
    if(!navigator.locks)throw Error('Crash-safe recording needs Web Locks. Use current Chrome on localhost.');
    let release;
    await new Promise((resolve,reject)=>{navigator.locks.request('teleprompt-recording:'+name,()=>new Promise(done=>{release=done;resolve();})).catch(reject);});
    return release;
  }
  async assemble(root,journal,metadata,recovered){
    const chunks=[];for await(const [name,handle] of journal.entries())if(handle.kind==='file'&&/^\d{8}\.chunk$/.test(name))chunks.push(name);
    chunks.sort();const handle=await root.getFileHandle(metadata.name,{create:true}),writer=await handle.createWritable();let count=0;
    try{
      for(const name of chunks){if(name!==String(count).padStart(8,'0')+'.chunk')break;const file=await(await journal.getFileHandle(name)).getFile();if(!file.size)break;await writer.write(file);count++;}
      await writer.close();
    }catch(error){await writer.abort().catch(()=>{});throw error;}
    if(!count){await root.removeEntry(metadata.name).catch(()=>{});throw Error('No checkpointed video was found.');}
    const take={...metadata,id:metadata.name,file:await handle.getFile(),persisted:true,recovered,partial:recovered,warning:recovered?'Recovered after interruption. The final unsaved seconds may be missing; playback may require repair.':''};
    const {file,...meta}=take;await this.write(root,take.name+'.json',JSON.stringify(meta));
    await root.removeEntry(metadata.name+'.chunks',{recursive:true}).catch(()=>{});
    return take;
  }
  async recover(root){
    this.recoveryWarning='';
    if(!navigator.locks)return;
    const names=[];for await(const [name,handle] of root.entries())if(handle.kind==='directory'&&/^teleprompt-.*\.(mp4|webm)\.chunks$/.test(name))names.push(name);
    for(const name of names)await navigator.locks.request('teleprompt-recording:'+name.slice(0,-7),{ifAvailable:true},async lock=>{
      if(!lock)return;
      try{
        const journal=await root.getDirectoryHandle(name),metadata=JSON.parse(await(await(await journal.getFileHandle('manifest.json')).getFile()).text());
        if(metadata.name!==name.slice(0,-7)||!/^video\/(mp4|webm)(;|$)/.test(metadata.mime))return;
        // A crash after the final file and metadata committed needs only cleanup.
        let completed=false;try{const meta=JSON.parse(await(await(await root.getFileHandle(metadata.name+'.json')).getFile()).text());completed=meta.id===metadata.name&&(await(await root.getFileHandle(metadata.name)).getFile()).size>0;}catch{}
        if(completed)await root.removeEntry(name,{recursive:true});else await this.assemble(root,journal,metadata,true);
      }catch(error){this.recoveryWarning='Some interrupted video chunks could not be recovered. They remain saved locally; free disk space and reload to retry.';}
    });
  }
  async remember(take){
    if(!take.persisted){if(!this.memory.some(item=>item.id===take.id))this.memory.unshift(take);return;}
    try{const root=await this.root(),handle=await root.getFileHandle(take.name+'.json',{create:true}),writer=await handle.createWritable();const {file,...meta}=take;await writer.write(JSON.stringify(meta));await writer.close();}catch{}
  }
  async remove(id){
    if(typeof id!=='string'||!/^teleprompt-[a-z0-9._-]+\.(mp4|webm)$/i.test(id))throw Error('Invalid recording filename.');
    const memoryIndex=this.memory.findIndex(take=>take.id===id);
    if(memoryIndex!==-1){this.memory.splice(memoryIndex,1);return;}
    const root=await this.root();
    if(!navigator.locks)throw Error('Deleting recordings needs a current Chrome browser on localhost.');
    await navigator.locks.request('teleprompt-recording:'+id,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('This recording is in use by another tab. Stop that recording before deleting it.');
      const remove=async(name,options)=>{try{await root.removeEntry(name,options);}catch(error){if(error.name!=='NotFoundError')throw error;}};
      // Remove only this take's checkpoints first, so recovery cannot recreate it.
      await remove(id+'.chunks',{recursive:true});
      await remove(id);
      await remove(id+'.json');
    });
  }
  async list(){
    const takes=[...this.memory];
    try{const root=await this.root();await this.recover(root);for await(const [name,handle] of root.entries())if(handle.kind==='file'&&/^teleprompt-.*\.(mp4|webm)$/.test(name)){
      const file=await handle.getFile();if(!file.size)continue;let meta={};try{meta=JSON.parse(await(await(await root.getFileHandle(name+'.json')).getFile()).text());}catch{}
      takes.push({...meta,id:name,name,file,mime:meta.mime||(name.endsWith('.mp4')?'video/mp4':'video/webm'),persisted:true});
    }}catch{}
    return takes.sort((a,b)=>b.file.lastModified-a.file.lastModified);
  }
}
