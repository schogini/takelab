'use strict';
(()=>{
  const el=id=>document.getElementById(id),stage=el('reference-stage'),library=new RecordingLibrary();
  let prefs={quality:'1080',fps:30,countdown:3,sharedAudio:false,separateCameras:false,deviceId:'',sharingOffset:'auto'},takes=[],currentUrl='',selected=null,previewSequence=0,lastState='idle',deleting=false,exporting=false;
  try{const saved=JSON.parse(localStorage.getItem('workspace.recorder')||'{}');if(['720','1080','2160'].includes(saved.quality))prefs.quality=saved.quality;if([30,60].includes(saved.fps))prefs.fps=saved.fps;if([0,3,5].includes(saved.countdown))prefs.countdown=saved.countdown;if(typeof saved.separateCameras==='boolean')prefs.separateCameras=saved.separateCameras;if(typeof saved.sharedAudio==='boolean')prefs.sharedAudio=saved.sharedAudio;if(typeof saved.deviceId==='string')prefs.deviceId=saved.deviceId;if(['auto','0','32','36','40','48','52','64','80','96'].includes(saved.sharingOffset))prefs.sharingOffset=saved.sharingOffset;}catch{}
  const panel=document.createElement('section');panel.id='recording-panel';panel.setAttribute('popover','auto');panel.setAttribute('aria-labelledby','recording-title');
  panel.innerHTML=`<header><div><p>YOUR NEXT TAKE</p><h2 id="recording-title">Record browse area</h2></div><button type="button" popovertarget="recording-panel" popovertargetaction="hide" aria-label="Close recording settings">×</button></header>
    <p class="recorder-help">Records the browse frame. Camera overlays are included unless separate camera videos are enabled. The teleprompter and top controls stay outside the recording.</p>
    <fieldset id="recording-options"><label>Quality <select id="recording-quality"><option value="1080">Full HD · 1080p</option><option value="720">HD · 720p</option><option value="2160">4K · 2160p</option></select></label><label>Frame rate <select id="recording-fps"><option value="30">30 fps</option><option value="60">60 fps</option></select></label><label>Countdown <select id="recording-countdown"><option value="0">None</option><option value="3">3 seconds</option><option value="5">5 seconds</option></select></label><p id="recording-output" class="recorder-help"></p><button id="recording-use-wide" type="button">Use 16:9 browse frame</button><label>Microphone <select id="recording-microphone"><option value="">Default microphone</option></select></label><button id="recording-refresh-mics" type="button">Refresh microphones</button><label class="recorder-check"><input id="recording-shared-audio" type="checkbox"> Include shared-tab audio when available</label><label class="recorder-check"><input id="recording-separate-cameras" type="checkbox"> Save cameras separately · clean screen video</label><p class="recorder-help">Start cameras first. Camera windows are hidden during capture so the screen video stays camera-free; they return when recording ends. The feeds keep running. Each live camera gets its own processed video with microphone audio, matching Pause / Resume. Effects, framing and borders are included; transparent areas use a dark background. Shared-tab audio is only in the main take. Separate camera files keep native capture detail independently of preview size, using the view’s aspect ratio and framing. Small previews no longer reduce recording resolution. Highest available / 4K needs more CPU, disk and USB bandwidth; lower camera quality if frames drop.</p><p class="recorder-help">Start opens Chrome's share picker. Choose <strong>this workspace tab</strong>; enable tab audio there if desired. Microphone permission is separate. Shared-tab audio availability depends on Chrome and macOS.</p></fieldset>
    <label>Sharing bar offset <select id="recording-sharing-offset"><option value="auto">Automatic</option><option value="0">Off</option><option value="32">32 px</option><option value="36">36 px</option><option value="40">40 px</option><option value="48">48 px</option><option value="52">52 px</option><option value="64">64 px</option><option value="80">80 px</option><option value="96">96 px</option></select></label><p class="recorder-help">Chrome’s sharing notification cannot be hidden by this page. Automatic offsets its height to keep the browse frame steady. If the frame still moves, choose an offset while sharing; larger values move the frame upward. Recording controls dock at the lower left while compensation is active. Taller offsets can partly hide the upper tabs behind browser chrome.</p>
    <div class="recorder-actions"><button id="recording-start" type="button">● Start recording</button><button id="recording-pause-panel" type="button" disabled>Pause</button><button id="recording-stop-panel" type="button" disabled>Stop &amp; save take</button></div>
    <label id="recording-meter-label" hidden>Mixed audio level <meter id="recording-meter" min="0" max="1" low=".08" high=".9" optimum=".6" value="0"></meter></label>
    <p id="recording-status" role="status"></p><p id="recording-details" class="recorder-help"></p>
    <section class="recorded-takes"><h3>Saved takes</h3><label>Take <select id="recording-takes"><option value="">No recordings yet</option></select></label><p id="recording-take-info" class="recorder-help"></p><video id="recording-playback" controls playsinline preload="metadata" hidden></video><a id="recording-download" hidden download>Download recording ↓</a><button id="recording-camtasia" type="button" hidden>Download for Camtasia</button><a id="recording-camtasia-download" hidden download>Download Camtasia MP4 ↓</a><p id="recording-export-status" class="recorder-help" role="status"></p><p class="recorder-help">Camtasia export converts locally to constant-frame-rate H.264 MP4 with 48 kHz AAC audio. Requires FFmpeg on this Mac. Your original recording stays saved.</p><button id="recording-delete" type="button" hidden>Delete selected recording</button><button id="recording-delete-all" type="button" disabled>Delete all recordings</button><p class="recorder-help">Crash recovery checkpoints are saved as video chunks arrive. Reload this same workspace URL after an interruption and check Saved takes for Recovered files. The latest unsaved data may be missing, and interrupted files may need video repair. Completed takes are kept in this browser's local storage when available. Download files to keep them independently of browser storage. Nothing is sent to an external service.</p></section>`;
  document.body.append(panel);
  el('recording-sharing-offset').value=prefs.sharingOffset;el('recording-sharing-offset').onchange=()=>{prefs.sharingOffset=el('recording-sharing-offset').value;savePrefs();window.WorkspaceRecordingViewport?.setOffset(prefs.sharingOffset);};
  el('recording-quality').value=prefs.quality;el('recording-fps').value=String(prefs.fps);el('recording-countdown').value=String(prefs.countdown);el('recording-shared-audio').checked=prefs.sharedAudio;el('recording-separate-cameras').checked=prefs.separateCameras;
  const controller=new BrowseRecorder(createRecordingEnvironment(library),render,async take=>{
    const {relatedTakes:related=[],...mainTake}=take;for(const item of [mainTake,...related])await library.remember(item);await refreshTakes(take.id);panel.showPopover();
  });
  function clock(ms){const seconds=Math.floor(ms/1000);return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  function output(){const r=stage.getBoundingClientRect(),dimensions=RecordingFormat.dimensions(r.width,r.height,prefs.quality);el('recording-output').textContent=`Output: ${dimensions.width} × ${dimensions.height} · browse frame ${Math.round(r.width)} × ${Math.round(r.height)} px. Choose 16:9 for ${prefs.quality==='2160'?'3840 × 2160':prefs.quality==='1080'?'1920 × 1080':'1280 × 720'}. Source detail depends on your viewport and display. Keep the workspace tab visible while recording.`;return dimensions;}
  function savePrefs(){try{localStorage.setItem('workspace.recorder',JSON.stringify(prefs));}catch{}}
  for(const [id,key] of [['recording-quality','quality'],['recording-fps','fps'],['recording-countdown','countdown'],['recording-shared-audio','sharedAudio'],['recording-separate-cameras','separateCameras'],['recording-microphone','deviceId']])el(id).onchange=()=>{prefs[key]=['fps','countdown'].includes(key)?Number(el(id).value):['sharedAudio','separateCameras'].includes(key)?el(id).checked:el(id).value;savePrefs();output();};
  async function refreshMics(){
    try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'&&d.deviceId),select=el('recording-microphone');select.replaceChildren(new Option('Default microphone',''));devices.forEach((d,i)=>select.add(new Option(d.label||'Microphone '+(i+1),d.deviceId)));if(prefs.deviceId&&!devices.some(d=>d.deviceId===prefs.deviceId))select.add(new Option('Saved microphone (not currently listed)',prefs.deviceId));select.value=prefs.deviceId;}catch{el('recording-status').textContent='Microphone names appear after permission is granted. Start with the default input, or check browser permissions.';}
  }
  el('recording-refresh-mics').onclick=refreshMics;
  el('recording-use-wide').onclick=()=>{const select=el('recording-ratio');select.value='16:9';select.dispatchEvent(new Event('change'));output();};
  el('recording-start').onclick=()=>{
    if(deleting||exporting)return;
    if(typeof MediaRecorder==='undefined'){el('recording-status').textContent='Video recording is unavailable in this browser. Use current Chrome.';return;}
    try{if(document.body.dataset.settingsLoading==='true')throw Error('Settings are being loaded. Wait for the app to reload.');const bounds=stage.getBoundingClientRect();if(bounds.width<2||bounds.height<2)throw Error('The browse frame is too small. Enlarge the window before recording.');el('recording-playback').pause();const options={...prefs,...output(),mime:RecordingFormat.mime(MediaRecorder)};controller.start(options);}catch(error){el('recording-status').textContent=RecordingFormat.error(error);}
  };
  const togglePause=()=>controller.state==='paused'?controller.resume():controller.pause();
  el('recording-pause').onclick=togglePause;el('recording-pause-panel').onclick=togglePause;
  el('recording-stop').onclick=()=>controller.stop();el('recording-stop-panel').onclick=()=>controller.stop();
  el('recording-mute').onclick=()=>controller.mute(!controller.snapshot().muted);
  function render(s){
    if(s.state==='recording'&&['starting','paused'].includes(lastState))panel.hidePopover();lastState=s.state;
    const active=s.state!=='idle',running=['recording','paused'].includes(s.state);
    document.body.dataset.recordingState=s.state;
    const stateLabel={starting:'SETTING UP',recording:'RECORDING',paused:'PAUSED',stopping:'SAVING',idle:'READY'}[s.state]||'READY';
    if(el('recording-state-label').textContent!==stateLabel)el('recording-state-label').textContent=stateLabel;
    el('recording-state-icon').textContent=s.state==='paused'?'Ⅱ':s.state==='recording'?'●':s.state==='stopping'?'■':'…';
    document.body.classList.toggle('recording-session-active',active);document.body.classList.toggle('recording-is-paused',s.state==='paused');
    el('recording-options').disabled=active;el('recording-start').disabled=active||deleting||exporting;el('recording-quick-controls').hidden=!active;
    el('recording-clock').value=clock(s.elapsed);el('recording-clock').textContent=clock(s.elapsed);
    for(const id of ['recording-pause','recording-pause-panel']){el(id).disabled=!running;el(id).textContent=s.state==='paused'?'Resume':'Pause';el(id).setAttribute('aria-label',s.state==='paused'?'Resume recording':'Pause recording');}
    for(const id of ['recording-stop','recording-stop-panel'])el(id).disabled=!active||s.state==='stopping';
    el('recording-stop-panel').textContent=s.state==='starting'?'Cancel setup':'Stop & save take';
    el('recording-stop').textContent=s.state==='starting'?'Cancel':'Stop';
    el('recording-mute').disabled=!running;el('recording-mute').textContent=s.muted?'Unmute mic':'Mute mic';el('recording-mute').setAttribute('aria-pressed',String(s.muted));el('recording-mute').setAttribute('aria-label',s.muted?'Unmute microphone':'Mute microphone');
    el('recording-meter-label').hidden=!running;el('recording-meter').value=s.level;
    if(el('recording-status').textContent!==s.message)el('recording-status').textContent=s.message;
    el('recording-details').textContent=active?[s.info,`${(s.bytes/1048576).toFixed(1)} MB`,s.storage==='memory'?'Memory only · NO crash recovery · download before closing; 512 MB limit':s.storage==='disk'?'Saving crash recovery checkpoints':''].filter(Boolean).join(' · '):'';
    el('recording-toggle').textContent=active?'Options ▾':'● Record';el('recording-toggle').setAttribute('aria-label',active?'Recording options':'Record browse area');
    el('recording-playback').hidden=active||!selected;el('recording-playback').pause();el('recording-takes').disabled=active||deleting||exporting;el('recording-delete').disabled=active||deleting||exporting||!selected;el('recording-camtasia').disabled=active||deleting||exporting||!selected;el('recording-delete-all').disabled=active||deleting||exporting||!takes.length;
  }
  async function refreshTakes(preferred){takes=await library.list();el('recording-delete-all').disabled=controller.state!=='idle'||deleting||exporting||!takes.length;const select=el('recording-takes');if(library.recoveryWarning)el('recording-status').textContent=library.recoveryWarning;select.replaceChildren(new Option(takes.length?'Choose a take':'No recordings yet',''));for(const take of takes)select.add(new Option((take.recovered?'Recovered · ':'')+(take.label?take.label+' · ':'Browse area · ')+take.name,take.id));const requested=preferred||selected?.id,id=takes.some(take=>take.id===requested)?requested:takes[0]?.id||'';select.value=id;await selectTake(id);}
  async function selectTake(id){
    const sequence=++previewSequence,take=takes.find(t=>t.id===id),video=el('recording-playback');video.pause();video.removeAttribute('src');video.load();if(currentUrl){URL.revokeObjectURL(currentUrl);currentUrl='';}selected=take||null;
    el('recording-camtasia').hidden=!take;el('recording-camtasia').disabled=deleting||exporting||controller.state!=='idle'||!take;el('recording-camtasia-download').hidden=true;el('recording-camtasia-download').removeAttribute('href');el('recording-export-status').textContent='';
    el('recording-download').hidden=!take;el('recording-delete').hidden=!take;el('recording-delete').disabled=deleting||controller.state!=='idle'||!take;video.hidden=!take||controller.state!=='idle';if(!take){el('recording-take-info').textContent='';el('recording-download').removeAttribute('href');return;}
    if(sequence!==previewSequence)return;currentUrl=URL.createObjectURL(take.file);video.src=currentUrl;const link=el('recording-download');link.href=currentUrl;link.download=take.name;
    el('recording-take-info').textContent=[take.width?`${take.width} × ${take.height}`:'',take.duration!==undefined?clock(take.duration):'',`${(take.file.size/1048576).toFixed(1)} MB`,take.persisted?'Saved locally':'Session only · download before closing',take.warning].filter(Boolean).join(' · ');
  }
  el('recording-delete').onclick=async()=>{
    if(deleting||exporting||controller.state!=='idle'||!selected)return;
    const take=selected;
    if(!confirm(`Delete this recording from this browser?\n\n${take.name}\n\nThis cannot be undone. Downloaded copies, settings and other recordings are kept.`))return;
    deleting=true;render(controller.snapshot());el('recording-status').textContent='Deleting recording…';let result='';
    try{
      await selectTake('');
      await library.remove(take.id);
      await refreshTakes();result='Deleted '+take.name+'.';
    }catch(error){await refreshTakes(take.id);result='Could not delete recording: '+error.message;}
    finally{deleting=false;render(controller.snapshot());el('recording-status').textContent=result;}
  };
  el('recording-delete-all').onclick=async()=>{
    if(deleting||exporting||controller.state!=='idle'||!takes.length)return;
    const targets=takes.slice();
    if(!confirm(`Delete all ${targets.length} saved recording${targets.length===1?'':'s'} from this browser?\n\nThis includes screen and separate camera videos. This cannot be undone. Downloaded copies and all settings are kept.`))return;
    deleting=true;document.body.dataset.recordingDeletion='true';render(controller.snapshot());let result='';
    try{
      await selectTake('');
      let removed=0;const failures=[];
      for(const take of targets){
        el('recording-status').textContent=`Deleting recordings… ${removed+failures.length+1} of ${targets.length}`;
        try{await library.remove(take.id);removed++;}catch(error){failures.push(take.name+': '+error.message);}
      }
      await refreshTakes();
      result=failures.length?`Deleted ${removed} of ${targets.length} recordings. Could not delete ${failures.length}: ${failures.join('; ')}`:`Deleted all ${removed} recordings. Settings and downloaded copies are kept.`;
    }catch(error){await refreshTakes();result='Could not finish deleting recordings: '+error.message;}
    finally{deleting=false;delete document.body.dataset.recordingDeletion;render(controller.snapshot());el('recording-status').textContent=result;}
  };
  el('recording-camtasia').onclick=async()=>{
    if(exporting||deleting||controller.state!=='idle'||!selected)return;
    const take=selected,link=el('recording-camtasia-download'),status=el('recording-export-status');
    exporting=true;document.body.dataset.recordingExport='true';render(controller.snapshot());link.hidden=true;
    try{
      const result=await window.CamtasiaExport.convert(take,message=>status.textContent=message);
      link.href=result.url;link.download=result.name;link.hidden=false;
      status.textContent=`Camtasia MP4 ready · constant ${result.fps} fps. Download starting; use the link above to download again. The original is unchanged.`;
      link.click();
    }catch(error){status.textContent=error.message||'Could not export. The original recording is unchanged.';}
    finally{exporting=false;delete document.body.dataset.recordingExport;render(controller.snapshot());}
  };
  el('recording-takes').onchange=()=>selectTake(el('recording-takes').value);
  panel.addEventListener('toggle',event=>{if(event.newState==='open'){output();if(controller.state==='idle')refreshMics();}else el('recording-playback').pause();});
  new ResizeObserver(output).observe(stage);
  const timer=setInterval(()=>{if(controller.state!=='idle')render(controller.snapshot());},200);
  window.addEventListener('beforeunload',event=>{if(controller.state!=='idle'||exporting||deleting){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{clearInterval(timer);controller.stop();if(currentUrl)URL.revokeObjectURL(currentUrl);});
  render(controller.snapshot());output();refreshTakes();
})();
