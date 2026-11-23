'use strict';
const $=id=>document.getElementById(id);
let root='',token='',folder='',entries=[],active=null,promptPath=null,listGeneration=0,floatingPrompt=null;
const PREVIEW=Symbol('preview'),TERMINAL=Symbol('terminal');
let promptReady=false,activeView=PREVIEW,tabSequence=0;
const fileTabs=new Map(),terminalTabs=new Map(),webTabs=new Map();
const isTerminal=key=>(key===TERMINAL&&terminalPanel.ids().includes('1'))||terminalTabs.has(key);
let layout={side:240,prompt:340,collapsed:false};
try{const saved=JSON.parse(localStorage.getItem('workspace.layout')||'{}');for(const key of ['side','prompt'])if(Number.isFinite(saved[key]))layout[key]=saved[key];layout.collapsed=saved.collapsed===true;}catch{}
const markdown=path=>/\.(md|markdown|mdown)$/i.test(path);
const message=(frame,data)=>$(frame).contentWindow.postMessage(data,location.origin);
const saveLayout=()=>{try{localStorage.setItem('workspace.layout',JSON.stringify(layout));}catch{}};
function applyLayout(){
  layout.side=Math.max(160,Math.min(400,layout.side));
  const available=window.innerWidth-(layout.collapsed?0:layout.side+7)-267;
  layout.prompt=Math.max(180,Math.min(1200,available,layout.prompt));
  document.documentElement.style.setProperty('--side',layout.side+'px');document.documentElement.style.setProperty('--prompt',layout.prompt+'px');
  document.body.classList.toggle('files-collapsed',layout.collapsed);$('toggle-files').setAttribute('aria-expanded',String(!layout.collapsed));$('toggle-files').setAttribute('aria-label',layout.collapsed?'Show file list':'Collapse file list');
  $('file-divider').setAttribute('aria-valuenow',layout.side);$('prompt-divider').setAttribute('aria-valuenow',layout.prompt);
  $('prompt-divider').setAttribute('aria-valuemax',Math.max(180,Math.min(1200,available)));saveLayout();
}
function setupDivider(id,key){
  const divider=$(id);let drag=null;
  divider.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={x:event.clientX,width:layout[key]};divider.setPointerCapture(event.pointerId);divider.classList.add('dragging');document.body.classList.add('resizing');});
  divider.addEventListener('pointermove',event=>{if(!drag)return;layout[key]=drag.width+event.clientX-drag.x;applyLayout();});
  const finish=()=>{drag=null;divider.classList.remove('dragging');document.body.classList.remove('resizing');};
  divider.addEventListener('pointerup',finish);divider.addEventListener('pointercancel',finish);divider.addEventListener('lostpointercapture',finish);
  divider.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();if(event.key==='Home')layout[key]=key==='side'?160:180;else if(event.key==='End')layout[key]=key==='side'?400:1200;else layout[key]+=(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?40:10);applyLayout();});
}
setupDivider('file-divider','side');setupDivider('prompt-divider','prompt');
$('toggle-files').onclick=()=>{layout.collapsed=!layout.collapsed;applyLayout();};
$('reset-layout').onclick=()=>{layout={side:240,prompt:340,collapsed:false};applyLayout();};
window.addEventListener('resize',applyLayout);applyLayout();
async function api(url,options){const response=await fetch(url,options);const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to open file.');return data;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5000);}
function loadPrompt(path){if(!markdown(path))return;promptPath=path;if(floatingPrompt&&!floatingPrompt.closed)floatingPrompt.postMessage({type:'open-file',path},location.origin);$('prompt-settings-toggle').title='Teleprompter: '+path;if(promptReady)message('prompt-frame',{type:'open-file',path});renderFiles();}
function fileTabButton(key){return key===TERMINAL?$('terminal-tab'):terminalTabs.has(key)?terminalTabs.get(key).button:key===PREVIEW?$('preview-tab'):webTabs.get(key)?.button||fileTabs.get(key)?.button;}
function activateReference(key,focus=false){
  if(!isTerminal(key)&&!webTabs.has(key)&&key!==PREVIEW&&!fileTabs.has(key))key=PREVIEW;
  if(key===PREVIEW&&fileTabs.size)key=[...fileTabs.keys()].at(-1);else if(key===PREVIEW&&webTabs.size)key=webTabs.keys().next().value;
  activeView=key;$('browser-navigation').hidePopover();const terminal=isTerminal(key);$('terminal-typing-panel').hidePopover();$('terminal-paste-toggle').hidden=!terminal;$('terminal-paste-clipboard').hidden=!terminal;
  $('preview-tab').hidden=fileTabs.size>0||webTabs.size>0;
  $('preview-frame').hidden=key!==PREVIEW;$('file-panels').hidden=terminal;$('terminal-panel').hidden=!terminal;if(terminal)$('terminal-panel').setAttribute('aria-labelledby',fileTabButton(key).id);
  for(const name of [PREVIEW,TERMINAL]){const b=fileTabButton(name);b.setAttribute('aria-selected',String(key===name));b.tabIndex=key===name?0:-1;}
  $('primary-terminal-tab').classList.toggle('selected',key===TERMINAL);
  for(const [id,tab] of terminalTabs){const chosen=id===key;tab.button.setAttribute('aria-selected',String(chosen));tab.button.tabIndex=chosen?0:-1;tab.wrapper.classList.toggle('selected',chosen);}
  for(const [id,tab] of webTabs){const chosen=id===key;tab.panel.hidden=!chosen;tab.button.setAttribute('aria-selected',String(chosen));tab.button.tabIndex=chosen?0:-1;tab.wrapper.classList.toggle('selected',chosen);}
  for(const [path,tab] of fileTabs){const chosen=path===key;tab.frame.hidden=!chosen;tab.button.setAttribute('aria-selected',String(chosen));tab.button.tabIndex=chosen?0:-1;tab.wrapper.classList.toggle('selected',chosen);}
  if(fileTabs.has(key))active=fileTabs.get(key).file;else if(key===PREVIEW||webTabs.has(key))active=null;
  $('use-script').hidden=terminal||!fileTabs.has(key)||!markdown(key);
  updateReferenceHeader();terminalPanel.setVisible(terminal,key===TERMINAL?'1':terminalTabs.get(key)?.id);renderFiles();
  window.browseAnnotations?.setTab(key);
  const button=fileTabButton(key);button?.scrollIntoView({block:'nearest',inline:'nearest'});if(focus)button?.focus();
}
function updateReferenceHeader(){
  const terminal=isTerminal(activeView),web=webTabs.get(activeView),tab=fileTabs.get(activeView),file=tab?.file;
  for(const id of ['browser-address-toggle','browser-reload','browser-external'])$(id).hidden=!web;
  $('browser-reload').disabled=$('browser-refresh-menu').disabled=!web?.url;if(web){$('browser-url').value=web.url;$('browser-app-mode').checked=!!web.appMode;$('browser-external').hidden=!web.url;if(web.url)$('browser-external').href=web.url;$('browser-address-toggle').title=web.url||'Enter a URL';}
  $('terminal-tools').hidden=!terminal;$('terminal-details').hidden=!terminal;
  $('file-tools').hidden=terminal||!!web;$('file-details').hidden=terminal||!!web;
  $('reference-kind').textContent=file?.type||(file?'FILE PREVIEW':'REFERENCE VIEW');
  $('reference-name').textContent=file?.name||'Choose a file';$('reference-name').title=file?.path||'';
  $('reference-meta').textContent=file?.meta||'';$('reference-meta').title=file?.meta||'';
  $('file-edit').hidden=terminal||!file?.editable;$('file-edit').disabled=!tab?.ready||!!file?.editing;$('file-edit').textContent=file?.editing?'Editing…':'Edit';
  $('file-source').hidden=!['markdown','html'].includes(file?.kind);$('file-source').disabled=!tab?.ready||!!file?.editing;
  $('file-source').textContent=file?.source?(file?.kind==='html'?'Browse':'Preview'):'Source';
  $('html-view-modes').hidden=file?.kind!=='html';
  $('html-browse').setAttribute('aria-pressed',String(file?.kind==='html'&&!file.source));
  $('html-source').setAttribute('aria-pressed',String(file?.kind==='html'&&!!file.source));
  $('html-browse').disabled=$('html-source').disabled=!tab?.ready||!!file?.editing;
  $('file-open-pdf').hidden=file?.kind!=='pdf';if(file?.kind==='pdf')$('file-open-pdf').href='/raw?path='+encodeURIComponent(file.path);
  $('file-download').hidden=!file;
  if(file){$('file-download').href='/raw?path='+encodeURIComponent(file.path)+'&download=1';$('file-download').download=file.name;}
  $('use-script').hidden=terminal||file?.kind!=='markdown';
}
$('file-edit').onclick=()=>{const tab=fileTabs.get(activeView);if(tab?.ready)tab.frame.contentWindow.postMessage({type:'edit-file'},location.origin);};
$('file-source').onclick=()=>{const tab=fileTabs.get(activeView);if(tab?.ready)tab.frame.contentWindow.postMessage({type:'toggle-source'},location.origin);};
for(const [id,source] of [['html-browse',false],['html-source',true]])$(id).onclick=()=>{
  const tab=fileTabs.get(activeView);if(tab?.ready&&tab.file?.kind==='html')tab.frame.contentWindow.postMessage({type:'set-source',source},location.origin);
};
function closeFileTab(path){
  const keys=[...fileTabs.keys()],index=keys.indexOf(path),tab=fileTabs.get(path);if(!tab)return;
  if(tab.file?.saving){toast('Wait for the file to finish saving.');return;}
  if(tab.file?.dirty&&!confirm('Discard unsaved edits to '+tab.file.name+'?'))return;
  const chosen=activeView===path;window.browseAnnotations?.drop(path);tab.frame.remove();tab.wrapper.remove();fileTabs.delete(path);if(active?.path===path)active=null;
  if(chosen){const remaining=[...fileTabs.keys()];activateReference(remaining[Math.min(index,remaining.length-1)]||PREVIEW,true);}
  else{activateReference(activeView);fileTabButton(activeView)?.focus();}
}
function loadPreview(path){
  if(!fileTabs.has(path)){
    const number=++tabSequence,name=path.split('/').pop();
    const frame=document.createElement('iframe');frame.id='file-panel-'+number;frame.title=name+' preview';frame.setAttribute('role','tabpanel');frame.setAttribute('aria-labelledby','file-tab-'+number);frame.hidden=true;
    const wrapper=document.createElement('div');wrapper.className='file-tab';wrapper.setAttribute('role','presentation');
    const button=document.createElement('button');button.id='file-tab-'+number;button.setAttribute('role','tab');button.setAttribute('aria-controls',frame.id);button.setAttribute('aria-selected','false');button.dataset.path=path;button.title=path;button.textContent=name;button.onclick=()=>activateReference(path);
    const close=document.createElement('button');close.className='close-file-tab';close.textContent='×';close.title='Close '+name;close.setAttribute('aria-label','Close '+name);close.onclick=()=>closeFileTab(path);
    wrapper.append(button,close);$('file-tabs').append(wrapper);
    fileTabs.set(path,{path,frame,wrapper,button,ready:false,file:{path,name,kind:markdown(path)?'markdown':'other'}});
    frame.src='/index.html?embedded=1';$('file-panels').append(frame);
  }
  activateReference(path);if(!promptPath&&markdown(path))loadPrompt(path);
}
function clearFileTabs(){for(const tab of fileTabs.values()){window.browseAnnotations?.drop(tab.path);tab.frame.remove();tab.wrapper.remove();}fileTabs.clear();active=null;activateReference(isTerminal(activeView)||webTabs.has(activeView)?activeView:PREVIEW);}
$('prompt-popout').onclick=()=>{
  if(floatingPrompt&&!floatingPrompt.closed){floatingPrompt.focus();return;}
  floatingPrompt=PromptPopup.open(promptPath);
  if(!floatingPrompt){toast('Allow pop-ups for this workspace to open the floating teleprompter.');return;}
  message('prompt-frame',{type:'pause-for-popup'});
};
$('prompt-settings-toggle').onclick=()=>{if(promptReady)message('prompt-frame',{type:'toggle-reading-settings'});};
$('use-script').onclick=()=>{if(fileTabs.has(activeView)&&markdown(activeView))loadPrompt(activeView);};
window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;const data=event.data;
  if(floatingPrompt&&event.source===floatingPrompt&&data?.type==='floating-prompt-ready'){if(promptPath)floatingPrompt.postMessage({type:'open-file',path:promptPath},location.origin);return;}
  if(event.source===$('prompt-frame').contentWindow&&data?.type==='prompt-ready'){promptReady=true;$('prompt-settings-toggle').disabled=false;if(promptPath)message('prompt-frame',{type:'open-file',path:promptPath});return;}
  if(event.source===$('prompt-frame').contentWindow&&data?.type==='reading-settings-state'){$('prompt-settings-toggle').setAttribute('aria-expanded',String(data.open===true));return;}
  if(event.source===$('preview-frame').contentWindow&&data?.type==='preview-ready'){workspaceAppearance.send($('preview-frame'));return;}
  const tab=[...fileTabs.values()].find(item=>event.source===item.frame.contentWindow);if(!tab)return;
  if(data?.type==='preview-ready'&&!tab.ready){tab.ready=true;workspaceAppearance.send(tab.frame);tab.frame.contentWindow.postMessage({type:'open-file',path:tab.path},location.origin);}
  if(data?.type==='preview-open'&&typeof data.path==='string')loadPreview(data.path);
  if(data?.type==='preview-editor-state'&&data.path===tab.path){Object.assign(tab.file,{editing:!!data.editing,dirty:!!data.dirty,saving:!!data.saving});if(activeView===tab.path)updateReferenceHeader();}
  if(data?.type==='file-saved')window.browseAnnotations?.reset(tab.path);
  if(data?.type==='file-saved'&&promptPath===tab.path)message('prompt-frame',{type:'open-file',path:tab.path});
  if(data?.type==='preview-selected'&&data.file?.path===tab.path){tab.file=data.file;if(activeView===tab.path){active=tab.file;updateReferenceHeader();renderFiles();}}
});
function renderFiles(){
  const scroll=$('files').scrollTop,term=$('search').value.toLocaleLowerCase();$('files').replaceChildren();const shown=entries.filter(e=>e.name.toLocaleLowerCase().includes(term));
  if(folder){const up=document.createElement('div');up.className='file-row';const b=document.createElement('button');b.textContent='← Parent folder';b.onclick=()=>navigate(folder.split('/').slice(0,-1).join('/'));up.append(b);$('files').append(up);}
  for(const entry of shown){
    const row=document.createElement('div');row.className='file-row';row.classList.toggle('selected',active?.path===entry.path);
    const b=document.createElement('button');b.title=entry.name;b.setAttribute('aria-current',active?.path===entry.path?'true':'false');
    const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=entry.directory?'▱':markdown(entry.name)?'¶':/\.pdf$/i.test(entry.name)?'▤':/\.(png|jpe?g|svg|webp|gif|avif)$/i.test(entry.name)?'▧':'≡';
    const name=document.createElement('span');name.className='name';name.textContent=entry.name;b.append(glyph,name);b.onclick=()=>entry.directory?navigate(entry.path):loadPreview(entry.path);row.append(b);
    if(!entry.directory&&markdown(entry.name)){const p=document.createElement('button');p.className='prompt-file';p.classList.toggle('pinned',promptPath===entry.path);p.textContent='▶';p.title='Use '+entry.name+' in teleprompter';p.setAttribute('aria-label',p.title);p.setAttribute('aria-pressed',String(promptPath===entry.path));p.onclick=()=>loadPrompt(entry.path);row.append(p);}
    $('files').append(row);
  }
  if(!shown.length){const p=document.createElement('p');p.className='empty';p.textContent=term?'No matching files.':'This folder is empty.';$('files').append(p);}
  $('file-count').textContent=shown.length+' items · ▶ loads a script';$('files').scrollTop=scroll;
}
function breadcrumbs(){const parts=folder?folder.split('/'):[];$('breadcrumbs').replaceChildren();['Home',...parts].forEach((name,i)=>{if(i)$('breadcrumbs').append(document.createTextNode(' / '));const b=document.createElement('button');b.textContent=name;b.onclick=()=>navigate(parts.slice(0,i).join('/'));$('breadcrumbs').append(b);});}
async function navigate(path){const ticket=++listGeneration;try{const list=await api('/api/list?path='+encodeURIComponent(path)+($('hidden').checked?'&hidden=1':''));if(ticket!==listGeneration)return;folder=path;entries=list;terminalPanel.setContext({root,path:folder,token});$('search').value='';renderFiles();breadcrumbs();}catch(error){if(ticket===listGeneration)toast(error.message);}}
function updateRoot(){$('folder-name').textContent=root.split('/').filter(Boolean).pop()||'/';$('folder-path').textContent=root;$('folder-path').title=root;document.title=$('folder-name').textContent+' — TakeLab Workspace';}
$('search').oninput=renderFiles;$('hidden').onchange=()=>navigate(folder);$('refresh').onclick=()=>navigate(folder);
$('open-folder').onclick=()=>{$('folder-input').value=root;$('folder-error').textContent='';$('folder-dialog').showModal();$('folder-input').select();};
$('cancel-folder').onclick=()=>$('folder-dialog').close();
$('folder-form').onsubmit=async event=>{event.preventDefault();if([...fileTabs.values()].some(tab=>tab.file?.saving)){toast('Wait for files to finish saving.');return;}if([...fileTabs.values()].some(tab=>tab.file?.dirty)&&!confirm('Discard unsaved file edits and switch folders?'))return;try{const state=await api('/api/root',{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Token':token},body:JSON.stringify({path:$('folder-input').value})});root=state.root;promptPath=null;clearFileTabs();$('use-script').hidden=true;message('prompt-frame',{type:'reset-root',root});if(floatingPrompt&&!floatingPrompt.closed)floatingPrompt.postMessage({type:'reset-root',root},location.origin);message('preview-frame',{type:'reset-root',root});updateRoot();$('folder-dialog').close();await navigate('');}catch(error){$('folder-error').textContent=error.message;}};
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='k'){event.preventDefault();if(layout.collapsed){layout.collapsed=false;applyLayout();}$('search').focus();}});
(async()=>{try{const state=await api('/api/state');root=state.root;token=state.token;updateRoot();await navigate('');}catch(error){toast(error.message);}})();

$('terminal-tab').onclick=()=>activateReference(TERMINAL);$('preview-tab').onclick=()=>activateReference(PREVIEW);
document.querySelector('.view-tabs').addEventListener('keydown',event=>{
  const button=event.target.closest('[role="tab"]');if(!button)return;
  if(event.key==='Delete'&&button.dataset.browser){event.preventDefault();const key=[...webTabs].find(([,tab])=>tab.button.id===button.id)?.[0];if(key)closeWebTab(key);return;}
  if(event.key==='Delete'&&button.id==='terminal-tab'){event.preventDefault();closeTerminalTab(TERMINAL);return;}
  if(event.key==='Delete'&&button.dataset.terminal){event.preventDefault();const key=[...terminalTabs].find(([,tab])=>tab.id===button.dataset.terminal)?.[0];if(key)closeTerminalTab(key);return;}
  if(event.key==='Delete'&&button.dataset.path){event.preventDefault();closeFileTab(button.dataset.path);return;}
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const buttons=[...document.querySelectorAll('.view-tabs [role="tab"]')].filter(b=>!b.hidden);const index=buttons.indexOf(button);
  const next=event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1):buttons[(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];
  activateReference(next.dataset.browser?[...webTabs].find(([,tab])=>tab.button.id===next.id)?.[0]:next.dataset.terminal?([...terminalTabs.entries()].find(([,tab])=>tab.id===next.dataset.terminal)?.[0]||TERMINAL):next.dataset.path||(next.id==='terminal-tab'?TERMINAL:PREVIEW),true);
});

$('reference-menu').addEventListener('toggle',event=>$('reference-menu-toggle').setAttribute('aria-expanded',String(event.newState==='open')));
$('reference-menu').addEventListener('click',event=>{
  const action=event.target.closest('#file-tools button,#file-tools a,#terminal-paste-menu,#terminal-new,#terminal-start,#terminal-stop,#terminal-clear');
  if(action&&!action.disabled)$('reference-menu').hidePopover();
});

function addTerminalTab(id){
  if(id==='1'){$('primary-terminal-tab').hidden=false;$('terminal-tab').hidden=false;return TERMINAL;}
  const key=Symbol('terminal-'+id),wrapper=document.createElement('div');wrapper.className='file-tab';wrapper.setAttribute('role','presentation');
  const button=document.createElement('button');button.id='terminal-tab-'+id;button.textContent='›_ Terminal '+id;button.dataset.terminal=id;button.setAttribute('role','tab');button.setAttribute('aria-selected','false');button.tabIndex=-1;button.setAttribute('aria-controls','terminal-panel');button.onclick=()=>activateReference(key);
  const close=document.createElement('button');close.className='close-file-tab';close.textContent='×';close.setAttribute('aria-label','Close Terminal '+id);close.onclick=()=>closeTerminalTab(key);wrapper.append(button,close);$('file-tabs').prepend(wrapper);terminalTabs.set(key,{id,button,wrapper});return key;
}
async function closeTerminalTab(key){
  const primary=key===TERMINAL,tab=primary?{id:'1',button:$('terminal-tab'),wrapper:$('primary-terminal-tab')}:terminalTabs.get(key);
  if(!tab||tab.closing||tab.button.disabled)return;tab.closing=true;tab.button.disabled=true;
  try{
    await terminalPanel.close(tab.id);window.browseAnnotations?.drop(key);
    if(primary){tab.wrapper.hidden=true;tab.button.hidden=true;tab.button.disabled=false;}else{tab.wrapper.remove();terminalTabs.delete(key);}
    const fallback=terminalPanel.ids().includes('1')?TERMINAL:terminalTabs.keys().next().value||PREVIEW;
    activateReference(activeView===key?fallback:activeView,true);
  }catch(error){tab.closing=false;tab.button.disabled=false;toast(error.message);}
}
function newTerminal(){try{const id=String(Math.max(0,...terminalPanel.ids().map(Number))+1);terminalPanel.create(id);activateReference(addTerminalTab(id),true);}catch(error){toast(error.message);}}
$('primary-terminal-tab').hidden=$('terminal-tab').hidden=!terminalPanel.ids().includes('1');
for(const id of terminalPanel.ids())if(id!=='1')addTerminalTab(id);
$('terminal-close').onclick=()=>closeTerminalTab(TERMINAL);
$('terminal-new').onclick=newTerminal;$('new-terminal-tab').onclick=newTerminal;

window.addEventListener('beforeunload',event=>{if([...fileTabs.values()].some(tab=>tab.file?.dirty||tab.file?.saving)){event.preventDefault();event.returnValue='';}});

function createWebTab(){
  const number=++tabSequence,key=Symbol('web-'+number),panel=document.createElement('section');panel.className='web-panel';panel.id='web-panel-'+number;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','web-tab-'+number);
  const empty=document.createElement('div');empty.className='web-empty';const title=document.createElement('h2');title.textContent='Open a web page';const help=document.createElement('p');help.textContent='Use URL above to enter a website. If a site blocks embedded viewing, use ↗ to open it externally.';empty.append(title,help);panel.append(empty);
  const frame=BrowserLinks.configureFrame(document.createElement('iframe'));frame.className='web-frame';frame.hidden=true;frame.title='Web page';panel.append(frame);$('file-panels').append(panel);
  const wrapper=document.createElement('div');wrapper.className='file-tab';wrapper.setAttribute('role','presentation');const button=document.createElement('button');button.id='web-tab-'+number;button.dataset.browser=String(number);button.textContent='◉ New web tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.onclick=()=>activateReference(key);
  const close=document.createElement('button');close.className='close-file-tab';close.textContent='×';close.setAttribute('aria-label','Close browser tab');close.title='Close browser tab';close.onclick=()=>closeWebTab(key);wrapper.append(button,close);$('file-tabs').append(wrapper);
  webTabs.set(key,{panel,frame,empty,wrapper,button,url:'',appMode:false});activateReference(key,true);$('browser-navigation').showPopover();$('browser-url').focus();
}
function closeWebTab(key){const tab=webTabs.get(key);if(!tab)return;window.browseAnnotations?.drop(key);tab.frame.src='about:blank';tab.panel.remove();tab.wrapper.remove();webTabs.delete(key);activateReference(activeView===key?webTabs.keys().next().value||PREVIEW:activeView,true);}
$('new-browser-tab').onclick=createWebTab;
$('browser-url').addEventListener('input',()=>{try{$('browser-app-mode').checked=BrowserLinks.isStreamlit($('browser-url').value);}catch{}});
$('browser-url-form').onsubmit=event=>{event.preventDefault();const tab=webTabs.get(activeView);if(!tab)return;try{const appMode=$('browser-app-mode').checked,url=BrowserLinks.appUrl($('browser-url').value,appMode);BrowserLinks.configureFrame(tab.frame,url,location.origin,appMode);window.browseAnnotations?.reset(activeView);tab.url=url;tab.appMode=appMode;tab.button.textContent='◉ '+new URL(url).host;tab.button.title=url;tab.frame.title=new URL(url).host+' web page';tab.empty.hidden=true;tab.frame.hidden=false;tab.frame.src=url;$('browser-url-error').textContent='';updateReferenceHeader();$('browser-navigation').hidePopover();}catch(error){$('browser-url-error').textContent=error.message;}};
function refreshWebTab(){const tab=webTabs.get(activeView);if(!tab?.url)return;window.browseAnnotations?.reset(activeView);tab.frame.src=tab.url;$('browser-navigation').hidePopover();}
$('browser-reload').onclick=refreshWebTab;$('browser-refresh-menu').onclick=refreshWebTab;
$('browser-navigation').addEventListener('toggle',event=>{if(event.newState==='open'){$('browser-url-error').textContent='';$('browser-url').focus();$('browser-url').select();}});
