'use strict';
(()=>{
  const el=id=>document.getElementById(id),keys=['head','project','top'];
  const titles={head:'Head camera',project:'Project camera',top:'Top'};
  function defaultLayout(){return {front:'head',head:{x:Math.max(20,window.innerWidth-304),y:110,width:280,height:210,visible:false,deviceId:'',deviceChosen:false,mirror:true,fit:'cover'},top:{x:Math.max(20,window.innerWidth-680),y:110,width:320,height:240,visible:false,deviceId:'',deviceChosen:false,mirror:false,fit:'contain'},project:{x:Math.max(20,window.innerWidth-344),y:Math.max(82,window.innerHeight-280),width:320,height:240,visible:false,deviceId:'',deviceChosen:false,mirror:false,fit:'contain'}};}
  let layout=defaultLayout(),devices=[],refreshEpoch=0;
  try{
    const saved=JSON.parse(localStorage.getItem('workspace.cameras')||'null');
    if(saved){if(keys.includes(saved.front))layout.front=saved.front;for(const key of keys){const value=saved[key];if(!value)continue;for(const prop of ['x','y','width','height'])if(Number.isFinite(value[prop]))layout[key][prop]=Math.max(-10000,Math.min(10000,value[prop]));for(const prop of ['visible','mirror','deviceChosen'])if(typeof value[prop]==='boolean')layout[key][prop]=value[prop];if(typeof value.deviceId==='string'&&value.deviceId.length<1000)layout[key].deviceId=value.deviceId;if(['cover','contain'].includes(value.fit))layout[key].fit=value.fit;}}
  }catch{}
  const slots={};
  let storage;try{storage=localStorage;}catch{}
  const effectsStore=new CameraEffectsStore(storage);
  let controls;
  let expanded=null;
  const stage=el('reference-stage');
  function save(message){try{localStorage.setItem('workspace.cameras',JSON.stringify(layout));if(message)el('camera-feedback').textContent=message;}catch{el('camera-feedback').textContent='Browser storage is unavailable; keep this page open to preserve your layout.';}}
  function bounds(key){
    const value=layout[key],maxWidth=Math.max(100,window.innerWidth-16),maxHeight=Math.max(90,window.innerHeight-16);
    const width=Math.max(Math.min(160,maxWidth),Math.min(maxWidth,value.width));
    const height=Math.max(Math.min(120,maxHeight),Math.min(maxHeight,value.height));
    return {width,height,x:Math.max(0,Math.min(window.innerWidth-width,value.x)),y:Math.max(0,Math.min(window.innerHeight-height,value.y))};
  }
  function applyWindow(key){
    const slot=slots[key],value=layout[key],full=expanded===key;
    const stageRect=full?stage.getBoundingClientRect():null;
    const rect=full?{x:stageRect.left,y:stageRect.top,width:stageRect.width,height:stageRect.height}:bounds(key);slot.window.hidden=!value.visible;
    slot.window.classList.toggle('camera-expanded',full);
    el(key+'-camera-front').setAttribute('aria-pressed',String(value.visible&&layout.front===key));
    const expandButton=slot.window.querySelector('[data-camera-expand]');
    expandButton.textContent=full?'❐':'⛶';
    expandButton.setAttribute('aria-label',(full?'Restore ':'Expand ')+titles[key]+(full?' to floating size':' to browse area'));
    expandButton.title=full?'Restore floating position and size':'Fill browse area';
    expandButton.setAttribute('aria-pressed',String(full));
    slot.window.querySelector('.camera-move-handle').setAttribute('aria-disabled',String(full));
    Object.assign(slot.window.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px',zIndex:layout.front===key?'46':'45'});
    slot.renderer.setLayout(value.fit,value.mirror);
    const settings=effectsStore.values[key];slot.window.dataset.shape=settings.shape;slot.window.classList.toggle('camera-cutout',settings.background==='remove');
    const thickness=settings.borderWidth,radius=settings.shape==='rectangle'?0:Math.min(settings.borderRadius,rect.width/2,rect.height/2);
    slot.window.style.setProperty('--camera-corner-radius',radius+'px');
    const frame=slot.window.querySelector('.camera-border'),box=frame.querySelector('rect'),circle=frame.querySelector('circle');
    frame.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    frame.style.stroke=settings.borderColor;frame.style.strokeWidth=thickness;frame.style.opacity=thickness?1:0;
    frame.style.strokeDasharray=settings.borderStyle==='dashed'?`${thickness*3} ${thickness*2}`:settings.borderStyle==='dotted'?`0 ${thickness*2.5}`:'none';
    frame.style.strokeLinecap=settings.borderStyle==='dotted'?'round':'butt';
    for(const [name,value] of Object.entries({x:thickness/2,y:thickness/2,width:Math.max(0,rect.width-thickness),height:Math.max(0,rect.height-thickness),rx:Math.max(0,radius-thickness/2)}))box.setAttribute(name,value);
    circle.setAttribute('cx',rect.width/2);circle.setAttribute('cy',rect.height/2);circle.setAttribute('r',Math.max(0,(Math.min(rect.width,rect.height)-thickness)/2));
    el(key+'-camera-visible').checked=value.visible;el(key+'-camera-mirror').checked=value.mirror;el(key+'-camera-fit').value=value.fit;
  }
  function front(key){layout.front=key;keys.forEach(applyWindow);}
  function setVisible(key,visible){if(!visible&&expanded===key)expanded=null;layout[key].visible=visible;if(!visible)slots[key].capture.stop();else front(key);applyWindow(key);save();}
  function updateCount(){const count=keys.filter(key=>slots[key]?.capture.status==='live').length;el('camera-live-count').textContent=count?' '+count:'';el('camera-stop-all').disabled=!keys.some(key=>['starting','live'].includes(slots[key]?.capture.status));}
  function renderState(key,state){
    const slot=slots[key],live=state.status==='live',starting=state.status==='starting';
    slot.window.classList.toggle('live',live);slot.window.classList.toggle('camera-starting',starting);
    slot.video.hidden=true;slot.output.hidden=!live;slot.placeholder.hidden=live;
    slot.window.querySelector('.camera-live-label').textContent=live?'LIVE':starting?'STARTING':'OFF';
    const message=state.error||(live?'Live':starting?'Waiting for camera access…':'Camera is off');
    slot.placeholder.querySelector('.camera-message').textContent=message;
    el(key+'-camera-state').textContent=message;
    el(key+'-camera-start').disabled=starting;el(key+'-camera-start').textContent=live?'Restart':'Start';
    slot.window.querySelectorAll('[data-camera-start]').forEach(button=>{button.disabled=starting;button.textContent=starting?'Starting…':'Start camera';});
    slot.window.querySelector('[data-camera-toggle]').textContent=live||starting?'■':'▶';
    slot.window.querySelector('[data-camera-toggle]').setAttribute('aria-label',(live||starting?'Stop ':'Start ')+titles[key]);
    el(key+'-camera-stop').disabled=!live&&!starting;
    if(slot.video.srcObject!==state.stream){
      slot.video.srcObject=state.stream;slot.playHint.hidden=true;
      if(state.stream){slot.video.play().catch(()=>{if(slot.capture.stream===state.stream)slot.playHint.hidden=false;});}
    }
    slot.renderer.setActive(live);
    if(!live)slot.notice.hidden=true;
    controls?.renderStatus();if(controls?.key===key)controls.renderHardware();
    updateCount();
  }
  function renderDevices(){
    for(const key of keys){
      const selected=layout[key].deviceId,select=el(key+'-camera-device');select.replaceChildren();
      const option=document.createElement('option');option.value='';option.textContent='Default camera';select.append(option);
      devices.forEach((device,index)=>{if(!device.deviceId)return;const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||'Camera '+(index+1);select.append(option);});
      if(selected&&!devices.some(device=>device.deviceId===selected)){const option=document.createElement('option');option.value=selected;option.textContent='Saved camera (not currently listed)';select.append(option);}
      select.value=selected;
    }
  }
  async function refreshDevices(){
    const ticket=++refreshEpoch;
    if(!navigator.mediaDevices?.enumerateDevices){el('camera-device-note').textContent='Camera access requires a supported browser on localhost or HTTPS.';return;}
    try{
      const found=await navigator.mediaDevices.enumerateDevices();if(ticket!==refreshEpoch)return;
      devices=found.filter(device=>device.kind==='videoinput');
      const used=new Set(keys.filter(key=>layout[key].deviceChosen||slots[key].capture.status==='live').map(key=>slots[key].capture.stream?.getVideoTracks()[0]?.getSettings?.().deviceId||layout[key].deviceId).filter(Boolean));
      for(const key of keys){
        if(layout[key].deviceChosen||slots[key].capture.status!=='off')continue;
        const candidate=devices.find(device=>device.deviceId&&!used.has(device.deviceId));
        if(candidate?.deviceId){layout[key].deviceId=candidate.deviceId;used.add(candidate.deviceId);}
      }
      save();
      renderDevices();
      el('camera-device-note').textContent=devices.length?devices.some(device=>!device.label)?'Camera names appear after you allow camera access.':'Choose a separate device for each view.':'No cameras listed yet. Connect a camera, then refresh.';
    }catch{if(ticket===refreshEpoch)el('camera-device-note').textContent='Could not list cameras. Check browser permissions, then refresh the list.';}
  }
  async function start(key){
    setVisible(key,true);const slot=slots[key];
    if(await slot.capture.start(layout[key].deviceId,effectsStore.values[key])){
      const deviceId=slot.capture.stream?.getVideoTracks()[0]?.getSettings?.().deviceId;
      if(deviceId)layout[key].deviceId=deviceId;save();await refreshDevices();
    }
  }
  function createWindow(key){
    const windowEl=document.createElement('section');windowEl.className='camera-window';windowEl.id=key+'-camera-window';windowEl.setAttribute('role','region');windowEl.setAttribute('aria-label',titles[key]+' window');
    windowEl.innerHTML='<video class="camera-video" autoplay muted playsinline hidden></video><canvas class="camera-output" hidden></canvas><svg class="camera-border" aria-hidden="true" focusable="false"><rect class="camera-border-rect"/><circle class="camera-border-circle"/></svg><p class="camera-effect-notice" hidden></p><div class="camera-placeholder"><span class="camera-placeholder-icon" aria-hidden="true">◎</span><strong>'+titles[key]+'</strong><p class="camera-message">Camera is off</p><button type="button" data-camera-start>Start camera</button></div><button class="camera-play-hint" hidden>Play video</button><header class="camera-window-header"><div class="camera-move-handle" role="button" tabindex="0" aria-label="Move '+titles[key]+'" title="Drag to move. Arrow keys move 5 px; Shift moves 20 px."><span>'+titles[key]+'</span><small class="camera-live-label">OFF</small></div><button type="button" data-camera-adjust aria-label="Adjust '+titles[key]+' picture" title="Picture settings">⚙</button><button type="button" data-camera-expand aria-label="Expand '+titles[key]+' to browse area" title="Fill browse area" aria-pressed="false">⛶</button><button type="button" data-camera-toggle aria-label="Start '+titles[key]+'">▶</button><button type="button" data-camera-hide aria-label="Hide '+titles[key]+'">×</button></header><button type="button" class="camera-resize-handle" aria-label="Resize '+titles[key]+'" title="Drag to resize. Arrow keys resize; hold Shift for larger steps.">⌟</button>';
    el('camera-windows').append(windowEl);
    const slot={window:windowEl,video:windowEl.querySelector('video'),placeholder:windowEl.querySelector('.camera-placeholder'),playHint:windowEl.querySelector('.camera-play-hint'),output:windowEl.querySelector('canvas'),notice:windowEl.querySelector('.camera-effect-notice')};slots[key]=slot;slot.video.muted=true;slot.output.setAttribute('role','img');slot.output.setAttribute('aria-label',titles[key]+' live preview');
    slot.renderer=new CameraRenderer(slot.video,slot.output,()=>effectsStore.values[key],text=>{
      controls?.setStatus(key,text);slot.notice.textContent=text;slot.notice.hidden=!(text&&effectsStore.values[key].background!=='off'&&!slot.renderer.maskReady);
    });
    slot.capture=new CameraCapture(navigator.mediaDevices,state=>renderState(key,state));
    windowEl.querySelector('[data-camera-adjust]').onclick=()=>controls.open(key);
    windowEl.querySelector('[data-camera-start]').onclick=()=>start(key);
    windowEl.querySelector('[data-camera-toggle]').onclick=()=>['live','starting'].includes(slot.capture.status)?slot.capture.stop():start(key);
    windowEl.querySelector('[data-camera-expand]').onclick=()=>{expanded=expanded===key?null:key;front(key);};
    windowEl.querySelector('[data-camera-hide]').onclick=()=>setVisible(key,false);
    slot.playHint.onclick=()=>slot.video.play().then(()=>slot.playHint.hidden=true).catch(()=>{});
    windowEl.addEventListener('pointerdown',()=>{front(key);save();});
    function interactive(handle,resize){
      let drag=null;
      handle.addEventListener('pointerdown',event=>{if(event.button!==0||expanded===key)return;event.preventDefault();front(key);drag={pointerX:event.clientX,pointerY:event.clientY,...bounds(key)};handle.setPointerCapture(event.pointerId);document.body.classList.add('camera-positioning');});
      handle.addEventListener('pointermove',event=>{
        if(!drag)return;const dx=event.clientX-drag.pointerX,dy=event.clientY-drag.pointerY;
        if(resize){layout[key].width=Math.max(160,Math.min(window.innerWidth-16,drag.width+dx));layout[key].height=Math.max(120,Math.min(window.innerHeight-16,drag.height+dy));}
        else{layout[key].x=Math.max(0,Math.min(window.innerWidth-drag.width,drag.x+dx));layout[key].y=Math.max(0,Math.min(window.innerHeight-drag.height,drag.y+dy));}
        applyWindow(key);
      });
      const finish=()=>{if(!drag)return;drag=null;document.body.classList.remove('camera-positioning');save();};
      handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
      handle.addEventListener('keydown',event=>{
        if(expanded===key||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?20:5,rect=bounds(key);front(key);
        if(resize){layout[key].width=rect.width+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0);layout[key].height=rect.height+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0);layout[key].width=Math.max(160,Math.min(window.innerWidth-16,layout[key].width));layout[key].height=Math.max(120,Math.min(window.innerHeight-16,layout[key].height));}
        else{layout[key].x=Math.max(0,Math.min(window.innerWidth-rect.width,rect.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)));layout[key].y=Math.max(0,Math.min(window.innerHeight-rect.height,rect.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)));}
        applyWindow(key);save();
      });
    }
    interactive(windowEl.querySelector('.camera-move-handle'),false);interactive(windowEl.querySelector('.camera-resize-handle'),true);
  }
  keys.forEach(createWindow);
  for(const key of keys){
    el(key+'-camera-front').onclick=()=>setVisible(key,true);
    el(key+'-camera-visible').onchange=()=>setVisible(key,el(key+'-camera-visible').checked);
    el(key+'-camera-device').onchange=()=>{layout[key].deviceId=el(key+'-camera-device').value;layout[key].deviceChosen=true;save();if(slots[key].capture.status==='live')start(key);};
    el(key+'-camera-mirror').onchange=()=>{layout[key].mirror=el(key+'-camera-mirror').checked;applyWindow(key);save();};
    el(key+'-camera-fit').onchange=()=>{layout[key].fit=el(key+'-camera-fit').value;applyWindow(key);save();};
    el(key+'-camera-start').onclick=()=>{el('cameras-panel').hidePopover();start(key);};el(key+'-camera-stop').onclick=()=>slots[key].capture.stop();
    applyWindow(key);renderState(key,{status:'off',error:'',stream:null});
  }
  controls=new CameraControls(effectsStore,slots,(key,name)=>{
    const slot=slots[key];
    if(['background','autoCenter','softening','all'].includes(name))slot.renderer.changed();
    applyWindow(key);
    if(['resolution','fps','all'].includes(name)&&slot.capture.status==='live'){
      const track=slot.capture.stream.getVideoTracks()[0];
      slot.qualityTask=(slot.qualityTask||Promise.resolve()).catch(()=>{}).then(async()=>{
        if(slot.capture.stream?.getVideoTracks()[0]!==track)return;
        try{await track.applyConstraints(CameraSettings.quality(effectsStore.values[key],track.getCapabilities?.()||{}));if(controls.key===key)controls.renderStatus();}
        catch{controls.setStatus(key,'Selected quality is unavailable. The camera is still running at its current quality.');}
      });
    }
  });
  for(const key of keys)el(key+'-camera-adjust').onclick=()=>controls.open(key);
  el('camera-refresh').onclick=refreshDevices;
  el('camera-stop-all').onclick=()=>keys.forEach(key=>slots[key].capture.stop());
  el('camera-save-layout').onclick=()=>{for(const key of keys)Object.assign(layout[key],bounds(key));save('Camera positions and sizes saved.');};
  el('camera-reset-layout').onclick=()=>{expanded=null;const initial=defaultLayout();for(const key of keys){for(const prop of ['x','y','width','height'])layout[key][prop]=initial[key][prop];applyWindow(key);}save('Default window positions and sizes restored.');};
  el('camera-show-both').onclick=()=>{keys.forEach(key=>setVisible(key,true));el('cameras-panel').hidePopover();};
  el('cameras-panel').addEventListener('toggle',event=>{el('cameras-toggle').setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='open')refreshDevices();});
  window.addEventListener('resize',()=>keys.forEach(applyWindow));
  const stageObserver=new ResizeObserver(()=>{if(expanded)applyWindow(expanded);});
  stageObserver.observe(stage);stageObserver.observe(el('preview-pane'));
  navigator.mediaDevices?.addEventListener?.('devicechange',refreshDevices);
  window.WorkspaceCameraSources={active:()=>keys.filter(key=>slots[key].capture.status==='live').map(key=>({key,title:titles[key],canvas:slots[key].output,renderer:slots[key].renderer,video:slots[key].video,fit:layout[key].fit,stream:slots[key].capture.stream,settings:()=>({...effectsStore.values[key]}),isCurrent:stream=>slots[key].capture.status==='live'&&slots[key].capture.stream===stream}))};
  window.addEventListener('pagehide',()=>keys.forEach(key=>slots[key].capture.stop()));
})();
