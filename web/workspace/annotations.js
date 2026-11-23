'use strict';
(()=>{
  const el=id=>document.getElementById(id),stage=el('reference-stage'),model=new BrowseAnnotationModel();
  let settings=AnnotationTools.settings(),mode='interact',stroke=null,pointer=null,laser=null,trail=[],raf=0,size={width:1,height:1,ratio:1};
  try{settings=AnnotationTools.settings(JSON.parse(localStorage.getItem('workspace.annotationTools')||'null'));}catch{}
  const layer=document.createElement('div');layer.id='browse-annotations';layer.setAttribute('aria-label','Browse annotation overlay');
  const saved=document.createElement('canvas'),surface=document.createElement('canvas'),light=document.createElement('canvas');saved.className='annotation-saved';saved.setAttribute('aria-hidden','true');light.setAttribute('aria-hidden','true');surface.className='annotation-surface';light.className='annotation-laser';surface.setAttribute('aria-label','Draw on browse view');surface.tabIndex=-1;for(const canvas of [saved,surface,light])layer.append(canvas);stage.append(layer);
  const contexts=[saved,surface,light].map(canvas=>canvas.getContext('2d'));
  function clear(ctx){ctx.clearRect(0,0,size.width,size.height);}
  function draw(ctx,value){
    if(!value?.points.length)return;ctx.save();ctx.globalAlpha=value.tool==='highlighter'?.3:1;ctx.strokeStyle=ctx.fillStyle=value.color;ctx.lineWidth=Math.max(1,value.width*Math.min(size.width,size.height));ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    const first=value.points[0];ctx.moveTo(first.x*size.width,first.y*size.height);for(const p of value.points.slice(1))ctx.lineTo(p.x*size.width,p.y*size.height);
    if(value.points.length===1){ctx.arc(first.x*size.width,first.y*size.height,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();ctx.restore();
  }
  function paintMarks(){clear(contexts[0]);for(const value of model.page().strokes)draw(contexts[0],value);}
  function paint(now){
    raf=0;clear(contexts[1]);draw(contexts[1],stroke);clear(contexts[2]);trail=trail.filter(p=>now-p.time<350);
    if(mode==='laser'){
      const ctx=contexts[2],value=settings.laser;ctx.save();ctx.strokeStyle=value.color;ctx.lineCap='round';ctx.lineWidth=Math.max(2,value.width/3);ctx.shadowColor=value.color;ctx.shadowBlur=14;
      for(let i=1;i<trail.length;i++){ctx.globalAlpha=Math.max(0,1-(now-trail[i].time)/350)*.55;ctx.beginPath();ctx.moveTo(trail[i-1].x*size.width,trail[i-1].y*size.height);ctx.lineTo(trail[i].x*size.width,trail[i].y*size.height);ctx.stroke();}
      if(laser){ctx.globalAlpha=1;ctx.fillStyle=value.color;ctx.beginPath();ctx.arc(laser.x*size.width,laser.y*size.height,value.width/2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(laser.x*size.width,laser.y*size.height,Math.max(1,value.width/6),0,Math.PI*2);ctx.fill();}ctx.restore();
    }
    if(trail.length)raf=requestAnimationFrame(paint);
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(paint);}
  function hideLaser(){laser=null;trail=[];schedule();}
  function cancelGesture(){stroke=null;if(pointer!==null&&surface.hasPointerCapture(pointer))surface.releasePointerCapture(pointer);pointer=null;schedule();}
  function update(){
    layer.dataset.mode=mode;surface.style.pointerEvents=mode==='interact'?'none':'auto';surface.style.cursor=mode==='laser'?'none':'crosshair';surface.style.touchAction=mode==='interact'?'auto':'none';surface.tabIndex=mode==='interact'?-1:0;
    el('annotation-toggle').textContent=mode==='interact'?'Annotate ▾':({laser:'Laser',pen:'Pen',highlighter:'Highlighter'}[mode]+' ▾');el('annotation-interact').hidden=mode==='interact';
    el('annotation-laser').setAttribute('aria-pressed',String(mode==='laser'));for(const button of document.querySelectorAll('[data-annotation-mode]'))button.setAttribute('aria-pressed',String(button.dataset.annotationMode===mode));
    el('annotation-undo').disabled=!model.page().history.length;el('annotation-clear').disabled=!model.page().strokes.length;
    const current=settings[mode]||settings.pen,[min,max]=AnnotationTools.ranges[mode]||AnnotationTools.ranges.pen;el('annotation-color').value=current.color;el('annotation-width').min=min;el('annotation-width').max=max;el('annotation-width').value=current.width;el('annotation-width-value').textContent=current.width+' px';el('annotation-color').disabled=el('annotation-width').disabled=mode==='interact';
  }
  function selectMode(value){if(!['interact','laser','pen','highlighter'].includes(value))return;cancelGesture();hideLaser();mode=value;update();el('annotation-panel').hidePopover();if(mode!=='interact')surface.focus({preventScroll:true});}
  function resize(){
    const rect=layer.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const ratio=Math.min(devicePixelRatio||1,2,4096/rect.width,4096/rect.height);size={width:rect.width,height:rect.height,ratio};
    for(let i=0;i<3;i++){const canvas=[saved,surface,light][i];canvas.width=Math.max(1,Math.round(size.width*ratio));canvas.height=Math.max(1,Math.round(size.height*ratio));contexts[i].setTransform(ratio,0,0,ratio,0,0);}paintMarks();schedule();
  }
  function location(event){return AnnotationTools.point(event.clientX,event.clientY,layer.getBoundingClientRect());}
  surface.addEventListener('pointerdown',event=>{
    if(mode==='interact'||event.button!==0)return;event.preventDefault();surface.focus({preventScroll:true});const p=location(event);if(!p)return;pointer=event.pointerId;surface.setPointerCapture(pointer);
    if(mode==='laser'){laser=p;trail=[{...p,time:performance.now()}];}
    else if(model.page().strokes.length<500){const value=settings[mode];stroke={tool:mode,color:value.color,width:value.width/Math.min(size.width,size.height),points:[p]};}
    else el('annotation-feedback').textContent='This tab has 500 marks. Use Clear before adding more.';schedule();
  });
  surface.addEventListener('pointermove',event=>{
    const p=location(event);if(!p||mode==='interact')return;
    if(mode==='laser'){laser=p;trail.push({...p,time:performance.now()});if(trail.length>100)trail.shift();schedule();}
    else if(pointer===event.pointerId&&stroke){if(stroke.points.length<4000)stroke.points.push(p);schedule();}
  });
  function finish(event){if(pointer!==event.pointerId)return;if(stroke){model.add(stroke);stroke=null;paintMarks();update();}if(surface.hasPointerCapture(pointer))surface.releasePointerCapture(pointer);pointer=null;if(event.pointerType==='touch')hideLaser();schedule();}
  surface.addEventListener('pointerup',finish);surface.addEventListener('pointercancel',()=>{cancelGesture();hideLaser();});surface.addEventListener('lostpointercapture',()=>{if(pointer!==null)cancelGesture();});surface.addEventListener('pointerleave',()=>{laser=null;schedule();});
  for(const button of document.querySelectorAll('[data-annotation-mode]'))button.onclick=()=>selectMode(button.dataset.annotationMode);
  el('annotation-laser').onclick=()=>selectMode(mode==='laser'?'interact':'laser');el('annotation-interact').onclick=()=>selectMode('interact');
  el('annotation-undo').onclick=()=>{cancelGesture();model.undo();paintMarks();update();};el('annotation-clear').onclick=()=>{cancelGesture();model.clear();paintMarks();update();};
  for(const id of ['annotation-color','annotation-width'])el(id).addEventListener('input',()=>{if(!settings[mode])return;settings[mode]={color:el('annotation-color').value,width:Number(el('annotation-width').value)};settings=AnnotationTools.settings(settings);try{localStorage.setItem('workspace.annotationTools',JSON.stringify(settings));}catch{}update();schedule();});
  document.addEventListener('keydown',event=>{if(mode==='interact')return;if(event.key==='Escape'){event.preventDefault();selectMode('interact');}else if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!event.target.closest?.('input,textarea,select,[contenteditable]')){event.preventDefault();el('annotation-undo').click();}});
  new ResizeObserver(resize).observe(layer);window.addEventListener('blur',()=>{cancelGesture();hideLaser();});window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);});
  window.browseAnnotations={setTab(key){cancelGesture();hideLaser();model.select(key);mode='interact';paintMarks();update();},drop(key){model.drop(key);},reset(key){model.reset(key);if(model.key===key){cancelGesture();hideLaser();paintMarks();update();}}};
  resize();update();
})();
