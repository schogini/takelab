'use strict';
function createRecordingEnvironment(library){
  return {
    now:()=>performance.now(),wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
    display(options){
      if(!navigator.mediaDevices?.getDisplayMedia||typeof CropTarget==='undefined'||typeof MediaRecorder==='undefined')throw Error('Browse-area recording needs a current Chrome browser on localhost with tab-cropping support.');
      window.WorkspaceRecordingViewport?.begin(options.sharingOffset);
      options.audioContext=new AudioContext();options.audioContext.resume().catch(()=>{});
      return navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',width:{ideal:3840},height:{ideal:2160},frameRate:{ideal:options.fps,max:options.fps}},audio:options.sharedAudio?{suppressLocalAudioPlayback:false}:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',systemAudio:options.sharedAudio?'include':'exclude',monitorTypeSurfaces:'exclude'});
    },
    async microphone(options){return navigator.mediaDevices.getUserMedia({video:false,audio:{...(options.deviceId?{deviceId:{exact:options.deviceId}}:{}),echoCancellation:true,noiseSuppression:true,autoGainControl:true}});},
    async prepareVideo(display,options){
      if(typeof window!=='undefined')window.WorkspaceRecordingViewport?.update();
      // Keep preview canvases sized and rendering for their independent encoders.
      // Suppress their composited windows before the first shared-tab frame.
      document.body.classList.toggle('recording-clean-screen',!!options.separateCameras);
      const track=display.getVideoTracks()[0];
      if(typeof track.cropTo!=='function')throw Error('Choose this workspace in the Chrome Tab section of the share picker. This source cannot be cropped safely.');
      try{await track.cropTo(await CropTarget.fromElement(document.getElementById('reference-stage')));}catch{throw Error('Could not crop that source. Choose this workspace under Chrome Tab, rather than a window, screen, or another tab.');}
      try{await track.applyConstraints({width:{ideal:options.width},height:{ideal:options.height},frameRate:{ideal:options.fps,max:options.fps}});}catch{}
      const video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;video.hidden=true;video.srcObject=display;document.body.append(video);
      const canvas=document.createElement('canvas');canvas.width=options.width;canvas.height=options.height;const ctx=canvas.getContext('2d');let frame=0,last=-1,stream;
      const cleanup=()=>{cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());video.pause();video.srcObject=null;video.remove();};
      try{
        await Promise.race([video.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('The shared tab did not start producing video. Try sharing this workspace again.')),15000))]);
        function draw(now){frame=requestAnimationFrame(draw);const tick=Math.floor(now*options.fps/1000);if(tick===last||video.readyState<2||!video.videoWidth)return;last=tick;ctx.fillStyle='#101612';ctx.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight);ctx.drawImage(video,(canvas.width-video.videoWidth*scale)/2,(canvas.height-video.videoHeight*scale)/2,video.videoWidth*scale,video.videoHeight*scale);}
        draw(performance.now());stream=canvas.captureStream(options.fps);
        const source=track.getSettings();return {stream,cleanup,info:`Source ${source.width||video.videoWidth} × ${source.height||video.videoHeight} → ${options.width} × ${options.height} at ${options.fps} fps`};
      }catch(error){cleanup();throw error;}
    },
    async prepareCameras(options){
      const outputs=[],pending=[];
      try{return (window.WorkspaceCameraSources?.active()||[]).map(source=>{
        const capture=source.stream.getVideoTracks()[0].getSettings(),settings=source.settings();
        const width=source.video.videoWidth||capture.width,height=source.video.videoHeight||capture.height;
        if(!width||!height||source.video.readyState<2)throw Error('Camera dimensions are unavailable. Wait for its picture, then start recording.');
        const dimensions=CameraSettings.recordingSize(width,height,source.canvas.clientWidth,source.canvas.clientHeight,settings.rotation,source.fit);
        const processed=source.renderer.beginRecording(dimensions,options.fps);pending.push(processed.cleanup);
        const previewWidth=Math.max(1,source.canvas.clientWidth);
        const canvas=document.createElement('canvas');Object.assign(canvas,dimensions);const ctx=canvas.getContext('2d');let frame=0,ended,notified=false;pending.push(()=>cancelAnimationFrame(frame));
        function draw(){
          if(!source.isCurrent(source.stream)){if(!notified){notified=true;ended?.();}return;}
          const s=source.settings(),w=canvas.width,h=canvas.height,scale=w/previewWidth,border=s.borderWidth*scale;
          ctx.fillStyle='#101612';ctx.fillRect(0,0,w,h);ctx.save();ctx.beginPath();
          if(s.shape==='circle')ctx.arc(w/2,h/2,Math.min(w,h)/2,0,Math.PI*2);
          else ctx.roundRect(0,0,w,h,s.shape==='rectangle'?0:Math.min(w,h)/2*Math.min(1,s.borderRadius*scale/(Math.min(w,h)/2)));
          ctx.clip();ctx.drawImage(processed.canvas,0,0,w,h);
          if(border){ctx.strokeStyle=s.borderColor;ctx.lineWidth=border*2;ctx.setLineDash(s.borderStyle==='dashed'?[border*4,border*3]:s.borderStyle==='dotted'?[border,border*2]:[]);ctx.stroke();}
          ctx.restore();frame=requestAnimationFrame(draw);
        }
        draw();const stream=canvas.captureStream(options.fps);
        const output={...source,dimensions,stream,onEnded:fn=>{ended=fn;if(notified)fn();},cleanup:()=>{cancelAnimationFrame(frame);processed.cleanup();stream.getTracks().forEach(t=>t.stop());}};outputs.push(output);return output;
      });}catch(error){for(const output of outputs)output.cleanup();for(const cleanup of pending)cleanup();throw error;}
    },
    async mixAudio(display,microphone,options){
      const ctx=options.audioContext;await ctx.resume();if(ctx.state!=='running')throw Error('Audio could not start. Click Start again and allow microphone access.');
      const microphoneDestination=ctx.createMediaStreamDestination(),destination=ctx.createMediaStreamDestination(),compressor=ctx.createDynamicsCompressor(),analyser=ctx.createAnalyser(),micGain=ctx.createGain(),sources=[];
      compressor.connect(analyser);analyser.connect(destination);analyser.fftSize=1024;const samples=new Float32Array(analyser.fftSize);
      const micSource=ctx.createMediaStreamSource(new MediaStream(microphone.getAudioTracks()));sources.push(micSource);micSource.connect(micGain);micGain.connect(compressor);micGain.connect(microphoneDestination);
      let warning='';
      if(options.sharedAudio){if(display.getAudioTracks().length){const source=ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks()));sources.push(source);source.connect(compressor);}else warning='No shared-tab audio was provided; recording the microphone only.';}
      return {stream:destination.stream,microphoneStream:microphoneDestination.stream,warning,mute:value=>micGain.gain.setTargetAtTime(value?0:1,ctx.currentTime,.02),level:()=>{analyser.getFloatTimeDomainData(samples);let sum=0;for(const n of samples)sum+=n*n;return Math.min(1,Math.sqrt(sum/samples.length)*4);},cleanup:()=>{for(const source of sources)source.disconnect();micGain.disconnect();compressor.disconnect();analyser.disconnect();destination.stream.getTracks().forEach(t=>t.stop());microphoneDestination.stream.getTracks().forEach(t=>t.stop());if(ctx.state!=='closed')ctx.close().catch(()=>{});}};
    },
    sink:options=>library.sink(options),
    createRecorder(video,audio,options){return new MediaRecorder(new MediaStream([...video.getVideoTracks(),...audio.getAudioTracks()]),{mimeType:options.mime,videoBitsPerSecond:Math.min(120000000,Math.max(5000000,Math.round((options.width||1920)*(options.height||1080)*(options.fps||30)*.14))),audioBitsPerSecond:192000});},
    cleanup(options){if(typeof window!=='undefined')window.WorkspaceRecordingViewport?.end();document.body.classList.remove('recording-clean-screen');const ctx=options?.audioContext;if(ctx&&ctx.state!=='closed')ctx.close().catch(()=>{});}
  };
}
