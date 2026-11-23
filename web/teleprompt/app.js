'use strict';
const $ = id => document.getElementById(id);
const reader=$('reader'), script=$('script');
const defaults={font:36,speed:35,spacing:1.7,width:760,countdown:3,mirror:false,guide:true,light:false};
let settings={...defaults};
try{const saved=JSON.parse(localStorage.getItem('teleprompt.settings')||'{}');for(const key of ['font','speed','spacing','width','countdown']){if(Number.isFinite(saved[key]))settings[key]=saved[key];}for(const key of ['mirror','guide','light']){if(typeof saved[key]==='boolean')settings[key]=saved[key];}}catch{}
let root='',token='',folder='',entries=[],selected=null,generation=0,playing=false,counting=false,manuallyPaused=false,frame=0,lastTime=0,position=0,deadline=0,words=0;
const query=new URLSearchParams(location.search);
const embedded=query.has('embedded'),floating=query.get('floating')==='1';
if(floating)document.body.classList.add('floating-prompt');
if(embedded)document.body.classList.add('embedded');
if(query.get('compact')==='1')document.body.classList.add('focus');
async function api(url,options){const response=await fetch(url,options);const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to load this script.');return result;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6000);}
function maxScroll(){return Math.max(0,reader.scrollHeight-reader.clientHeight);}
function updateProgress(){
  const max=maxScroll(), remaining=Math.max(0,max-reader.scrollTop),seconds=Math.ceil(remaining/settings.speed);
  $('progress').style.width=(max?Math.min(100,reader.scrollTop/max*100):0)+'%';
  $('remaining').textContent=settings.speed+' px/s'+(selected?' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' remaining':'');
}
function store(){try{localStorage.setItem('teleprompt.settings',JSON.stringify(settings));}catch{}}
function applySettings(preserve=false){
  const ratio=maxScroll()?reader.scrollTop/maxScroll():0;
  for(const key of ['font','speed','spacing','width','countdown']){$(key).value=String(settings[key]);settings[key]=Number($(key).value);}
  for(const key of ['mirror','guide','light'])$(key).checked=settings[key];
  document.documentElement.style.setProperty('--font',settings.font+'px');
  document.documentElement.style.setProperty('--spacing',settings.spacing);
  document.documentElement.style.setProperty('--width',settings.width+'px');
  document.body.classList.toggle('light',settings.light);script.style.transform=settings.mirror?'scaleX(-1)':'';
  $('reading-guide').hidden=!settings.guide||!selected;
  $('font-value').textContent=settings.font+' px';$('quick-font').textContent=settings.font;
  $('speed-value').textContent=settings.speed+' px/s';$('spacing-value').textContent=settings.spacing.toFixed(1)+'×';$('width-value').textContent=settings.width+' px';
  if(preserve){reader.scrollTop=ratio*maxScroll();position=reader.scrollTop;}
  updateProgress();store();
}
function adjustFont(delta){settings.font=Math.max(16,Math.min(96,settings.font+delta));applySettings(true);}
function adjustSpeed(delta){settings.speed=Math.max(5,Math.min(160,settings.speed+delta));applySettings();}
for(const key of ['font','speed','spacing','width','countdown'])$(key).addEventListener('input',()=>{settings[key]=Number($(key).value);applySettings(['font','spacing','width'].includes(key));});
for(const key of ['mirror','guide','light'])$(key).addEventListener('change',()=>{settings[key]=$(key).checked;applySettings();});
$('font-down').onclick=$('quick-down').onclick=()=>adjustFont(-2);
$('font-up').onclick=$('quick-up').onclick=()=>adjustFont(2);
function pause(message,manual=false){
  manuallyPaused=Boolean(manual&&selected&&words);
  reader.title=manuallyPaused?'Click the script to resume auto-scroll':'';
  cancelAnimationFrame(frame);frame=0;playing=false;counting=false;$('countdown-overlay').hidden=true;
  $('play').replaceChildren(document.createTextNode('▶ '));const label=document.createElement('span');label.textContent=selected?'Resume':'Start';$('play').append(label);
  $('play-status').textContent=message||(manuallyPaused?'Paused · click script to resume':selected?'Paused':'Choose a script');
}
function tick(now){
  if(counting){const left=Math.ceil((deadline-now)/1000);if(left>0){$('countdown-overlay').textContent=left;frame=requestAnimationFrame(tick);return;}counting=false;playing=true;$('countdown-overlay').hidden=true;lastTime=now;$('play-status').textContent='On air';$('play').innerHTML='Ⅱ <span>Pause</span>';}
  if(!playing)return;
  const delta=Math.min(.1,Math.max(0,(now-lastTime)/1000));lastTime=now;
  position=Math.min(maxScroll(),position+settings.speed*delta);reader.scrollTop=position;updateProgress();
  if(position>=maxScroll()){pause('End of script');return;}
  frame=requestAnimationFrame(tick);
}
function start({skipCountdown=false}={}){
  if(!selected||!words)return;
  if(playing||counting){pause();return;}
  if(reader.scrollTop>=maxScroll()-1)reader.scrollTop=0;
  manuallyPaused=false;reader.title='';
  position=reader.scrollTop;lastTime=performance.now();
  if(settings.countdown&&!skipCountdown){counting=true;deadline=lastTime+settings.countdown*1000;$('countdown-overlay').textContent=settings.countdown;$('countdown-overlay').hidden=false;$('play').innerHTML='■ <span>Cancel</span>';$('play-status').textContent='Get ready';}
  else{playing=true;$('play').innerHTML='Ⅱ <span>Pause</span>';$('play-status').textContent='On air';}
  frame=requestAnimationFrame(tick);
}
function restart(){pause(selected?'Ready':'Choose a script');reader.scrollTop=0;position=0;$('play').innerHTML='▶ <span>Start</span>';updateProgress();}
$('play').onclick=start;$('restart').onclick=restart;
reader.addEventListener('scroll',updateProgress,{passive:true});
for(const event of ['wheel','touchstart'])reader.addEventListener(event,()=>pause(undefined,true),{passive:true});
let pointerStart=null;
reader.addEventListener('pointerdown',event=>{
  pointerStart={x:event.clientX,y:event.clientY};
  if(playing||counting)pause();
},{passive:true});
reader.addEventListener('click',event=>{
  if(!manuallyPaused||playing||counting||!pointerStart||event.button!==0)return;
  if(Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)return;
  if(window.getSelection()?.isCollapsed===false||event.target.closest('a,button,input,select,summary'))return;
  start({skipCountdown:true});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||counting))pause('Paused while away');});
new ResizeObserver(()=>{position=reader.scrollTop;updateProgress();}).observe(reader);
function toggleFocus(force){
  document.body.classList.toggle('focus',force??!document.body.classList.contains('focus'));
  $('focus').textContent=document.body.classList.contains('focus')?'Exit focus ⛶':'Focus ⛶';
  $('settings').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');$('floating-settings').setAttribute('aria-expanded','false');if(embedded)parent.postMessage({type:'reading-settings-state',open:false},location.origin);
}
$('focus').onclick=()=>toggleFocus();
$('files-toggle').onclick=()=>toggleFocus();$('close-files').onclick=()=>toggleFocus(true);
function setReadingSettings(open){
  if(open&&document.body.classList.contains('focus'))toggleFocus(false);
  $('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));$('floating-settings').setAttribute('aria-expanded',String(open));
  if(embedded)parent.postMessage({type:'reading-settings-state',open},location.origin);
}
$('settings-toggle').onclick=()=>setReadingSettings($('settings').hidden);
$('settings-close').onclick=()=>setReadingSettings(false);
$('popout').onclick=()=>{pause();if(!PromptPopup.open(selected?.path))toast('Allow pop-ups for this local app to open the floating teleprompter.');};
$('floating-settings').onclick=()=>setReadingSettings($('settings').hidden);
$('floating-slower').onclick=()=>adjustSpeed(-5);$('floating-faster').onclick=()=>adjustSpeed(5);
function resizeFloating(delta){window.resizeTo(Math.max(240,Math.min(screen.availWidth,window.outerWidth+delta)),window.outerHeight);}
$('floating-narrower').onclick=()=>resizeFloating(-40);$('floating-wider').onclick=()=>resizeFloating(40);
$('floating-top').onclick=()=>window.moveTo(window.screenX,screen.availTop||0);
$('floating-close').onclick=()=>window.close();
if(floating){
  new ResizeObserver(entries=>document.documentElement.style.setProperty('--floating-controls-height',entries[0].target.getBoundingClientRect().height+'px')).observe(document.querySelector('.transport'));
  let saveTimer;
  const saveWindow=()=>{try{localStorage.setItem(PromptPopup.key,JSON.stringify({width:window.innerWidth,height:window.innerHeight,left:window.screenX}));}catch{}};
  window.addEventListener('resize',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(saveWindow,250);});
  window.addEventListener('pagehide',saveWindow);
}

function renderFiles(){
  const term=$('search').value.toLocaleLowerCase();$('files').replaceChildren();
  const shown=entries.filter(e=>e.name.toLocaleLowerCase().includes(term));
  for(const entry of shown){const b=document.createElement('button');b.className='file-row';b.title=entry.name;b.classList.toggle('selected',selected?.path===entry.path);b.setAttribute('aria-current',selected?.path===entry.path?'true':'false');const icon=document.createElement('span');icon.textContent=entry.directory?'▱':'¶';const name=document.createElement('span');name.textContent=entry.name;b.append(icon,name);b.onclick=()=>entry.directory?navigate(entry.path):openFile(entry.path);$('files').append(b);}
  if(!shown.length){const p=document.createElement('p');p.className='empty';p.textContent=term?'No matching scripts.':'No Markdown files here. Open a subfolder or choose another folder.';$('files').append(p);}
  $('file-count').textContent=shown.filter(e=>!e.directory).length+' scripts';
}
function renderBreadcrumbs(){
  $('breadcrumbs').replaceChildren();const parts=folder?folder.split('/'):[];
  ['Home',...parts].forEach((part,i)=>{if(i)$('breadcrumbs').append(document.createTextNode(' / '));const b=document.createElement('button');b.textContent=part;b.onclick=()=>navigate(parts.slice(0,i).join('/'));$('breadcrumbs').append(b);});
}
async function navigate(path){
  const ticket=++generation;
  try{const list=await api('/api/list?path='+encodeURIComponent(path));if(ticket!==generation)return false;folder=path;entries=list;$('search').value='';renderFiles();renderBreadcrumbs();return true;}catch(error){if(ticket===generation)toast(error.message);return false;}
}
async function openFile(path){
  pause();const ticket=++generation;
  try{
    const file=await api('/api/file?path='+encodeURIComponent(path));if(ticket!==generation)return;
    if(file.kind!=='markdown'||typeof file.text!=='string')throw new Error('This Markdown file is not readable UTF-8 or UTF-16 text.');
    if(file.truncated)throw new Error('This script is larger than 2 MB. Split it into smaller Markdown files.');
    selected=file;
    script.innerHTML=DOMPurify.sanitize(marked.parse(file.text),{FORBID_TAGS:['img','picture','source','iframe','style','form','input','button','audio','video','object','embed'],FORBID_ATTR:['style','id','name','autofocus']});
    script.querySelectorAll('details').forEach(el=>el.open=true);
    script.querySelectorAll('a').forEach(a=>{a.removeAttribute('href');a.removeAttribute('target');});
    words=script.textContent.trim()?script.textContent.trim().split(/\s+/u).length:0;
    script.hidden=false;$('welcome').hidden=true;$('script-title').textContent=file.name;document.title=file.name+' — TakeLab Prompt';
    $('word-count').textContent=words.toLocaleString()+' WORDS';$('play').disabled=!words;$('restart').disabled=!words;
    if(!words)toast('This script has no spoken text. Images are omitted from the teleprompter.');
    applySettings();restart();renderFiles();reader.focus({preventScroll:true});
  }catch(error){if(ticket===generation)toast(error.message);}
}
function updateRoot(){const name=root.split('/').filter(Boolean).pop()||'/';$('folder-name').textContent=name;$('folder-path').textContent=root;$('folder-path').title=root;}
$('search').oninput=renderFiles;$('refresh').onclick=()=>navigate(folder);
$('folder-button').onclick=()=>{pause();$('folder-input').value=root;$('folder-error').textContent='';$('folder-dialog').showModal();$('folder-input').select();};
$('cancel-folder').onclick=()=>$('folder-dialog').close();
$('folder-form').onsubmit=async event=>{
  event.preventDefault();try{const result=await api('/api/root',{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Token':token},body:JSON.stringify({path:$('folder-input').value})});
    root=result.root;selected=null;script.replaceChildren();script.hidden=true;$('welcome').hidden=false;$('reading-guide').hidden=true;$('play').disabled=true;$('restart').disabled=true;$('script-title').textContent='Your next good take.';$('word-count').textContent='MARKDOWN TELEPROMPTER';document.title='TakeLab Prompt';restart();updateRoot();$('folder-dialog').close();await navigate('');
  }catch(error){$('folder-error').textContent=error.message;}
};
document.addEventListener('keydown',event=>{
  if(event.metaKey||event.ctrlKey||event.altKey||$('folder-dialog').open)return;
  if(event.key==='Escape'){toggleFocus(false);return;}
  if(event.target.closest('input,select,textarea,button'))return;
  if(event.key===' '){event.preventDefault();start();}
  else if(event.key==='ArrowRight'){event.preventDefault();adjustSpeed(5);}
  else if(event.key==='ArrowLeft'){event.preventDefault();adjustSpeed(-5);}
  else if(event.key==='+'||event.key==='='){event.preventDefault();adjustFont(2);}
  else if(event.key==='-'){event.preventDefault();adjustFont(-2);}
  else if(event.key==='Home'){event.preventDefault();restart();}
  else if(event.key.toLowerCase()==='f'){event.preventDefault();toggleFocus();}
  else if(['ArrowDown','ArrowUp','PageDown','PageUp','End'].includes(event.key)){event.preventDefault();pause(undefined,true);const direction=['ArrowUp','PageUp'].includes(event.key)?-1:1;if(event.key==='End')reader.scrollTop=maxScroll();else reader.scrollTop+=direction*(event.key.startsWith('Page')?reader.clientHeight*.8:settings.font*settings.spacing);}
});
applySettings();$('focus').textContent=document.body.classList.contains('focus')?'Exit focus ⛶':'Focus ⛶';
(async()=>{try{const state=await api('/api/state');root=state.root;token=state.token;configureAppNav(state.apps);updateRoot();const path=query.get('file');if(await navigate(path?path.split('/').slice(0,-1).join('/'):'')&&path)await openFile(path);if(embedded)parent.postMessage({type:'prompt-ready'},location.origin);if(floating&&window.opener)window.opener.postMessage({type:'floating-prompt-ready'},location.origin);}catch(error){toast(error.message);}})();

if(embedded||floating)window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==(embedded?parent:window.opener))return;
  if(event.data?.type==='pause-for-popup')pause();
  if(event.data?.type==='toggle-reading-settings')setReadingSettings($('settings').hidden);
  if(event.data?.type==='open-file')await openFile(event.data.path);
  if(event.data?.type==='reset-root'){
    generation++;pause();root=event.data.root;selected=null;words=0;script.replaceChildren();script.hidden=true;
    $('welcome').hidden=false;$('reading-guide').hidden=true;$('play').disabled=true;$('restart').disabled=true;
    $('script-title').textContent='Choose a script';document.title='TakeLab Prompt';$('word-count').textContent='MARKDOWN TELEPROMPTER';updateRoot();restart();
  }
});
