'use strict';
const RecordingFormat=(()=>{
  function dimensions(width,height,quality='1080'){
    const portrait=height>width,max=quality==='720'?[1280,720]:quality==='2160'?[3840,2160]:[1920,1080],limit=portrait?[max[1],max[0]]:max;
    const scale=Math.min(limit[0]/Math.max(1,width),limit[1]/Math.max(1,height));
    return {width:Math.max(2,Math.floor(width*scale/2)*2),height:Math.max(2,Math.floor(height*scale/2)*2)};
  }
  function mime(Recorder){for(const type of ['video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1.64002A,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'])if(Recorder.isTypeSupported(type))return type;throw Error('This browser has no supported video recorder. Use current Chrome.');}
  function error(error){if(error?.cancelled)return '';if(['NotAllowedError','PermissionDeniedError'].includes(error?.name))return 'Screen or microphone access was not granted. Click Start to try again.';if(error?.name==='OverconstrainedError')return 'The selected microphone is unavailable. Choose the default microphone or another connected input.';if(error?.name==='NotFoundError')return 'No microphone was found. Connect a microphone and try again.';if(error?.name==='NotReadableError')return 'The screen or microphone is busy or unavailable. Check browser and macOS permissions.';return error?.message||'Could not record. Check your browser permissions and try again.';}
  return {dimensions,mime,error};
})();
// Camera outputs own their canvas tracks and sinks, never the live preview tracks.
class CameraRecordings{
  constructor(env,options,audio){this.env=env;this.options=options;this.audio=audio;this.outputs=[];this.warnings=[];}
  async prepare(){
    const sources=await this.env.prepareCameras(this.options);
    if(!sources.length)this.warnings.push('No cameras were live at Start; only the browse video was saved.');
    for(const source of sources){
      const output={source,writes:Promise.resolve(),duration:0,since:0};this.outputs.push(output);
      try{
        output.sink=await this.env.sink({...this.options,...source.dimensions,label:source.key});
        output.recorder=this.env.createRecorder(source.stream,this.audio.microphoneStream,{...this.options,...source.dimensions});
        output.stopped=new Promise(resolve=>output.resolve=resolve);
        output.recorder.ondataavailable=event=>{if(event.data?.size)output.writes=output.writes.then(()=>{if(!output.writeError)return output.sink.append(event.data);}).catch(error=>{output.error=error;output.writeError=true;this.stopOne(output);});};
        output.recorder.onerror=event=>{output.error=event.error||Error('Camera encoder interrupted');this.stopOne(output);};
        output.recorder.onstop=()=>{this.freeze(output);output.done=true;source.cleanup();output.resolve();};
        source.onEnded?.(()=>{output.warning='Camera stopped or changed during this take.';this.stopOne(output);});
      }catch(error){output.error=error;source.cleanup();if(output.sink)await output.sink.abort().catch(()=>{});output.sink=null;}
    }
  }
  freeze(o){if(o.running){o.duration+=Math.max(0,this.env.now()-o.since);o.running=false;}}
  start(){for(const o of this.outputs)if(o.recorder&&!o.error&&!o.done){try{o.recorder.start(1000);o.started=true;o.since=this.env.now();o.running=true;}catch(error){o.error=error;o.done=true;o.resolve();}}}
  pause(){for(const o of this.outputs)if(o.recorder?.state==='recording'){try{o.recorder.pause();this.freeze(o);}catch(error){o.error=error;this.stopOne(o);}}}
  resume(){for(const o of this.outputs)if(o.recorder?.state==='paused'){try{o.recorder.resume();o.since=this.env.now();o.running=true;}catch(error){o.error=error;this.stopOne(o);}}}
  stopOne(o){this.freeze(o);if(!o.started){o.done=true;o.resolve?.();return;}if(o.recorder?.state!=='inactive'&&o.recorder)try{o.recorder.stop();}catch(error){o.error=error;o.done=true;o.resolve();}}
  async abort(){for(const o of this.outputs){o.source.cleanup();if(o.sink)await o.sink.abort().catch(()=>{});}}
  async finish(){
    this.outputs.forEach(o=>this.stopOne(o));
    const takes=[];
    for(const o of this.outputs){
      if(!o.sink)continue;
      try{
        if(o.stopped)await o.stopped;
        await o.writes;const take=await o.sink.finish();
        if(!take.file.size)throw o.error||Error('No video data');
        Object.assign(take,{label:o.source.title,duration:o.duration,...o.source.dimensions,fps:this.options.fps,warning:o.warning||o.error?.message||'',partial:!!o.error});takes.push(take);
      }catch(error){this.warnings.push(`${o.source.title}: ${error.message}`);await o.sink.abort().catch(()=>{});}
      finally{o.source.cleanup();}
    }
    for(const o of this.outputs)if(!o.sink&&o.error)this.warnings.push(`${o.source.title}: ${o.error.message}`);
    return takes;
  }
}
class BrowseRecorder{
  constructor(env,onUpdate=()=>{},onComplete=()=>{}){this.env=env;this.onUpdate=onUpdate;this.onComplete=onComplete;this.state='idle';this.session=null;this.message='';}
  snapshot(){const s=this.session;return {state:this.state,message:this.message,elapsed:s?s.elapsed+(this.state==='recording'?Math.max(0,this.env.now()-s.since):0):0,bytes:s?.bytes||0,level:s?.audio?.level?.()||0,muted:!!s?.muted,info:s?.video?.info||'',storage:s?.sink?.storage||''};}
  publish(state,message=''){this.state=state;this.message=message;this.onUpdate(this.snapshot());}
  check(s){if(s.cancelled||this.session!==s)throw {cancelled:true};}
  freeze(s){if(this.state==='recording')s.elapsed+=Math.max(0,this.env.now()-s.since);}
  async start(options){
    if(this.state!=='idle')return false;
    const s={options,elapsed:0,since:0,bytes:0,writes:Promise.resolve(),cancelled:false,muted:false,finishing:false,error:''};this.session=s;this.publish('starting','Choose this workspace browser tab, then allow microphone access.');
    try{
      // Call the screen picker directly in the Start click's user activation.
      s.display=await this.env.display(options);this.check(s);
      const videoTrack=s.display.getVideoTracks()[0];if(!videoTrack)throw Error('No shared video was returned. Choose this workspace tab.');
      videoTrack.addEventListener('ended',()=>{if(this.session===s)this.stop('Screen sharing ended.');},{once:true});
      s.video=await this.env.prepareVideo(s.display,options);this.check(s);
      s.mic=await this.env.microphone(options);this.check(s);
      const micTrack=s.mic.getAudioTracks()[0];if(!micTrack)throw Error('The microphone returned no audio. Check the selected input.');
      micTrack.addEventListener('ended',()=>{if(this.session===s)this.stop('Microphone disconnected.');},{once:true});
      s.audio=await this.env.mixAudio(s.display,s.mic,options);this.check(s);
      s.sink=await this.env.sink(options);this.check(s);
      if(options.separateCameras){s.cameras=new CameraRecordings(this.env,options,s.audio);await s.cameras.prepare();this.check(s);}
      s.recorder=this.env.createRecorder(s.video.stream,s.audio.stream,options);
      s.recorder.ondataavailable=event=>{
        if(!event.data?.size)return;s.bytes+=event.data.size;
        s.writes=s.writes.then(()=>{if(!s.writeError)return s.sink.append(event.data);}).catch(error=>{s.writeError=error;this.stop('Recording stopped because local storage could not accept more video.');});
      };
      s.recorder.onerror=event=>this.stop('The video encoder reported an error: '+(event.error?.message||'recording interrupted'));
      s.recorder.onstop=()=>this.finish(s,options);
      for(let remaining=options.countdown||0;remaining>0;remaining--){this.check(s);this.publish('starting',`Starting in ${remaining}…`);await this.env.wait(1000);}
      this.check(s);s.recorder.start(1000);s.cameras?.start();s.since=this.env.now();this.publish('recording',s.audio.warning||(options.sharedAudio?'Recording browse area + microphone + shared-tab audio.':'Recording browse area + microphone.'));return true;
    }catch(error){
      this.release(s);await s.cameras?.abort();if(s.sink)try{await s.sink.abort();}catch{}
      if(this.session===s){this.session=null;this.publish('idle',RecordingFormat.error(error));}return false;
    }
  }
  pause(){const s=this.session;if(this.state!=='recording')return;try{s.recorder.pause();s.cameras?.pause();this.freeze(s);this.publish('paused','Paused. Click Resume to continue this take.');}catch(error){this.stop(RecordingFormat.error(error));}}
  resume(){const s=this.session;if(this.state!=='paused')return;try{s.recorder.resume();s.cameras?.resume();s.since=this.env.now();this.publish('recording','Recording resumed.');}catch(error){this.stop(RecordingFormat.error(error));}}
  mute(value){const s=this.session;if(!s?.audio)return;s.muted=value;s.audio.mute(value);this.onUpdate(this.snapshot());}
  stop(reason=''){
    const s=this.session;if(!s||this.state==='stopping')return;
    if(reason)s.error=reason;
    if(this.state==='starting'){s.cancelled=true;this.release(s);this.publish('stopping','Cancelling capture setup…');return;}
    this.freeze(s);this.publish('stopping','Finishing recording…');
    if(s.recorder&&s.recorder.state!=='inactive')try{s.recorder.stop();}catch{this.finish(s,s.options||{});}
    // An encoder error may set inactive before its final data and stop events.
    // Keep the sink open until onstop rather than dropping that last chunk.
  }
  release(s){
    for(const stream of [s.display,s.mic])stream?.getTracks().forEach(track=>track.stop());
    s.video?.cleanup?.();s.audio?.cleanup?.();this.env.cleanup?.(s.options);
  }
  async finish(s,options){
    if(s.finishing)return;s.finishing=true;
    if(this.state!=='stopping'){this.freeze(s);this.publish('stopping','Finishing recording…');}
    const cameraTakes=s.cameras?.finish();
    this.release(s);
    try{
      await s.writes;const take=await s.sink.finish();if(!take.file.size)throw Error('No video data was produced. Try recording again.');
      Object.assign(take,{duration:s.elapsed,width:options.width,height:options.height,fps:options.fps,warning:s.error||'',partial:!!s.writeError});
      take.relatedTakes=await cameraTakes||[];
      if(s.cameras?.warnings.length)take.warning=[take.warning,...s.cameras.warnings].filter(Boolean).join(' ');
      await this.onComplete(take);this.session=null;this.publish('idle',take.partial?'Storage interrupted this take. Download the partial recording.':take.warning||(take.relatedTakes.length?`Recording ready, including ${take.relatedTakes.length} separate camera videos. Choose each file under Saved takes.`:'Recording ready. Download it below.'));
    }catch(error){const related=await cameraTakes||[];for(const take of related)await this.onComplete(take);this.session=null;this.publish('idle',RecordingFormat.error(error));}
  }
}
if(typeof module!=='undefined'&&module.exports)module.exports={RecordingFormat,BrowseRecorder,CameraRecordings};
