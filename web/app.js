'use strict';
const embedded=new URLSearchParams(location.search).has('embedded');
if(embedded)document.body.classList.add('embedded');
const $ = id => document.getElementById(id);
let root = '', token = '', folder = '', entries = [], selected = null, source = false, generation = 0;
const langs = {py:'python',pyw:'python',js:'javascript',mjs:'javascript',ts:'typescript',tsx:'typescript',jsx:'javascript',json:'json',html:'xml',htm:'xml',xml:'xml',svg:'xml',css:'css',sh:'bash',bash:'bash',zsh:'bash',yml:'yaml',yaml:'yaml',sql:'sql',java:'java',c:'c',h:'c',cpp:'cpp',rs:'rust',go:'go',rb:'ruby',md:'markdown',toml:'ini',ini:'ini',diff:'diff'};
const ext = name => name.split('.').pop().toLowerCase();
const bytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(1)+' MB';
const rawURL = path => '/raw?path='+encodeURIComponent(path);
async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load this file.');
  return data;
}
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').hidden=true, 5000); }
function icon(entry) { return entry.directory ? '▱' : /^(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/.test(ext(entry.name)) ? '▧' : /^(md|markdown|mdown)$/.test(ext(entry.name)) ? '¶' : langs[ext(entry.name)] ? '⌘' : '≡'; }
function renderFiles() {
  const term=$('search').value.toLocaleLowerCase();
  $('files').replaceChildren();
  if (folder) {
    const up=document.createElement('button'); up.className='file-row parent'; up.textContent='←  Parent folder'; up.onclick=()=>navigate(folder.split('/').slice(0,-1).join('/')); $('files').append(up);
  }
  const shown=entries.filter(e=>e.name.toLocaleLowerCase().includes(term));
  for (const entry of shown) {
    const button=document.createElement('button'); button.className='file-row'; button.title=entry.name;
    button.classList.toggle('selected', selected?.path===entry.path); button.setAttribute('aria-current',selected?.path===entry.path?'true':'false');
    const glyph=document.createElement('span'); glyph.className='file-icon'+(entry.directory?' directory':''); glyph.textContent=icon(entry);
    const name=document.createElement('span'); name.className='entry-name'; name.textContent=entry.name;
    const detail=document.createElement('span'); detail.className='entry-detail'; detail.textContent=entry.directory?'›':ext(entry.name)===entry.name?'':ext(entry.name).toUpperCase();
    button.append(glyph,name,detail); button.onclick=()=>entry.directory?navigate(entry.path):openFile(entry.path); $('files').append(button);
  }
  if (!shown.length) {const empty=document.createElement('p');empty.className='empty-list';empty.textContent=term?'No matching files.':'This folder is empty.';$('files').append(empty);}
  $('file-count').textContent=shown.length+' items';
}
function renderBreadcrumbs() {
  $('breadcrumbs').replaceChildren();
  const parts=folder?folder.split('/'):[];
  const labels=[root.split('/').filter(Boolean).pop() || '/',...parts];
  labels.forEach((label,i)=>{if(i){const sep=document.createElement('span');sep.textContent=' / ';$('breadcrumbs').append(sep);}const b=document.createElement('button');b.textContent=label;b.onclick=()=>navigate(parts.slice(0,i).join('/'));$('breadcrumbs').append(b);});
}
async function navigate(path) {
  if(window.fileEditor&&!window.fileEditor.canLeave())return false;window.fileEditor?.reset();
  const ticket=++generation;
  try {
    const list=await api('/api/list?path='+encodeURIComponent(path)+($('hidden').checked?'&hidden=1':''));
    if(ticket!==generation)return;
    folder=path; entries=list; $('search').value=''; selected=null; source=false;
    $('welcome').hidden=false;$('preview').hidden=true;$('download').hidden=true;$('source-toggle').hidden=true;$('edit-toggle').hidden=true;$('open-pdf').hidden=true;
    $('footer-path').textContent=path?root+'/'+path:'Select a file to preview';
    renderFiles();renderBreadcrumbs();
  } catch(error){if(ticket===generation)toast(error.message);return false;}
}
async function openFile(path) {
  if(window.fileEditor&&!window.fileEditor.canLeave())return;window.fileEditor?.reset();
  const ticket=++generation;
  try {
    const file=await api('/api/file?path='+encodeURIComponent(path));
    if(ticket!==generation)return;
    $('content').removeAttribute('data-html-path');selected=file;source=false;renderFiles();renderPreview();
  } catch(error){if(ticket===generation)toast(error.message);}
}
function localPath(href) {
  if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('#')) return null;
  const base='https://local.invalid/'+selected.path.split('/').map(encodeURIComponent).join('/');
  const url=new URL(href,base);
  return decodeURIComponent(url.pathname.slice(1));
}
function highlight(code, language) {
  if (language && hljs.getLanguage(language)) {code.className='language-'+language;hljs.highlightElement(code);}
}
function renderPreview() {
  const file=selected;
  $('welcome').hidden=true;$('preview').hidden=false;
  $('file-name').textContent=file.name;
  $('file-type').textContent=file.kind==='html'?(source?'HTML SOURCE':'HTML PAGE'):file.kind==='pdf'?'PDF DOCUMENT':file.kind==='image'?'IMAGE PREVIEW':file.kind==='markdown'?'MARKDOWN DOCUMENT':file.kind==='binary'?'FILE':langs[ext(file.name)]?langs[ext(file.name)].toUpperCase()+' SOURCE':'TEXT DOCUMENT';
  $('file-meta').textContent=bytes(file.size)+' · '+new Date(file.modified*1000).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  $('footer-path').textContent=root+'/'+file.path;
  $('source-toggle').hidden=!['markdown','html'].includes(file.kind);$('source-toggle').textContent=source?(file.kind==='html'?'Browse':'Preview'):'Source';
  $('edit-toggle').hidden=!file.editable;$('open-pdf').hidden=file.kind!=='pdf';if(file.kind==='pdf')$('open-pdf').href=rawURL(file.path);
  $('download').hidden=false;$('download').href=rawURL(file.path)+'&download=1';$('download').download=file.name;
  $('notice').hidden=!file.truncated||embedded||(file.kind==='html'&&!source);$('notice').textContent='Showing the first 2 MB of this file. Download to see the full contents.';
  if(embedded&&file.truncated&&(file.kind!=='html'||source)){$('file-type').textContent+=' · FIRST 2 MB';$('file-type').title=$('notice').textContent;}else $('file-type').removeAttribute('title');
  $('file-name').title=file.name;$('file-meta').title=$('file-meta').textContent;
  const content=$('content');
  if(file.kind==='html'){
    if(content.dataset.htmlPath!==file.path){
      content.replaceChildren();content.dataset.htmlPath=file.path;
      const page=document.createElement('iframe');page.className='html-page';page.title=file.name+' rendered page';page.setAttribute('sandbox','allow-scripts');page.referrerPolicy='no-referrer';page.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; display-capture 'none'");
      page.src='/html-preview/'+file.path.split('/').map(encodeURIComponent).join('/');
      const raw=document.createElement('div');raw.className='html-source code-preview';
      const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=file.text;pre.append(code);raw.append(pre);content.append(page,raw);if(file.text.length<200000)highlight(code,'xml');
    }
    content.className='html-preview';content.querySelector('.html-page').hidden=source;content.querySelector('.html-source').hidden=!source;
  }else{
    content.replaceChildren();content.removeAttribute('data-html-path');content.className='';
  }
  if(file.kind==='pdf') {
    content.className='pdf-preview';
    const viewer=document.createElement('iframe');viewer.className='pdf-viewer';viewer.title=file.name+' PDF viewer';viewer.referrerPolicy='no-referrer';viewer.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; display-capture 'none'");viewer.src='/pdf-viewer.html?path='+encodeURIComponent(file.path);content.append(viewer);
  } else if(file.kind==='image') {
    content.className='image-preview';
    const img=document.createElement('img');img.src=rawURL(file.path);img.alt=file.name;img.onerror=()=>toast('Your browser could not display this image format.');
    img.onload=()=>{const dimensions=document.createElement('div');dimensions.className='image-dimensions';dimensions.textContent=img.naturalWidth+' × '+img.naturalHeight+' px';content.append(dimensions);};content.append(img);
  } else if(file.kind==='binary') {
    content.className='binary-preview';const title=document.createElement('h2');title.textContent='No preview for this file yet.';const p=document.createElement('p');p.textContent='Download it to open in its usual app.';content.append(title,p);
  } else if(file.kind==='markdown'&&!source) {
    content.className='markdown';
    content.innerHTML=DOMPurify.sanitize(marked.parse(file.text), {FORBID_TAGS:['style','form','input','button','video','audio','iframe'],FORBID_ATTR:['style','id','name']});
    content.querySelectorAll('img').forEach(img=>{const path=localPath(img.getAttribute('src'));if(path!==null) img.src=rawURL(path); else {img.removeAttribute('src');img.alt+=' (external image)';}});
    content.querySelectorAll('a').forEach(a=>{const href=a.getAttribute('href');const path=localPath(href);if(path!==null){a.href='#';a.onclick=async event=>{event.preventDefault();if(embedded){window.parent.postMessage({type:'preview-open',path},location.origin);return;}const parent=path.split('/').slice(0,-1).join('/');if(parent!==folder)await navigate(parent);await openFile(path);};}else if(href&&!href.startsWith('#')){a.target='_blank';a.rel='noopener noreferrer';}});
    content.querySelectorAll('pre code').forEach(code=>{const lang=[...code.classList].find(c=>c.startsWith('language-'))?.slice(9);if(code.textContent.length<200000)highlight(code,lang);});
  } else if(file.kind!=='html') {
    content.className='code-preview';const pre=document.createElement('pre');const code=document.createElement('code');code.textContent=file.text;pre.append(code);content.append(pre);if(file.text.length<200000)highlight(code,langs[ext(file.name)]);
  }
  $('preview').scrollTop=0;content.scrollTop=0;
  if(embedded)parent.postMessage({type:'preview-selected',file:{path:file.path,name:file.name,kind:file.kind,type:$('file-type').textContent,meta:$('file-meta').textContent,source,editable:!!file.editable}},location.origin);
}
$('search').oninput=renderFiles;
$('refresh').onclick=async()=>{const path=selected?.path;const navigated=await navigate(folder);if(navigated!==false&&path)await openFile(path);};
$('hidden').onchange=()=>navigate(folder);
$('source-toggle').onclick=()=>{if(window.fileEditor?.editing)return;source=!source;renderPreview();};
$('open-folder').onclick=()=>{$('folder-input').value=root;$('folder-error').textContent='';$('folder-dialog').showModal();$('folder-input').focus();$('folder-input').select();};
$('cancel-folder').onclick=()=>$('folder-dialog').close();
$('folder-form').onsubmit=async event=>{event.preventDefault();if(window.fileEditor&&!window.fileEditor.canLeave())return;try{const result=await api('/api/root',{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Token':token},body:JSON.stringify({path:$('folder-input').value})});window.fileEditor?.reset();root=result.root;updateRoot();$('folder-dialog').close();await navigate('');}catch(error){$('folder-error').textContent=error.message;}};
function updateRoot() {$('folder-name').textContent=root.split('/').filter(Boolean).pop() || '/';$('folder-path').textContent=root;$('folder-path').title=root;document.title=($('folder-name').textContent)+' — TakeLab Files';}
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='k'){event.preventDefault();$('search').focus();}});
(async()=>{try{const state=await api('/api/state');root=state.root;token=state.token;configureAppNav(state.apps);updateRoot();await navigate('');if(embedded)parent.postMessage({type:'preview-ready'},location.origin);}catch(error){toast(error.message);}})();

if(embedded)window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  if(event.data?.type==='workspace-appearance'){
    const colors=event.data.colors;
    if(colors&&['background','foreground','muted','line','control','selected','accent'].every(key=>/^#[0-9a-f]{6}$/i.test(colors[key]))){
      document.body.classList.add('workspace-colors');
      for(const [key,value] of Object.entries(colors))if(['background','foreground','muted','line','control','selected','accent'].includes(key))document.documentElement.style.setProperty('--workspace-'+key,value);
      document.documentElement.style.setProperty('--paper',colors.background);document.documentElement.style.setProperty('--ink',colors.foreground);document.documentElement.style.setProperty('--muted',colors.muted);document.documentElement.style.setProperty('--line',colors.line);document.documentElement.style.setProperty('--green',colors.accent);
    }
  }
  if(event.data?.type==='edit-file')window.fileEditor?.open();
  if(event.data?.type==='open-file')await openFile(event.data.path);
  if(!window.fileEditor?.editing&&event.data?.type==='toggle-source'&&['markdown','html'].includes(selected?.kind)){source=!source;renderPreview();}
  if(!window.fileEditor?.editing&&event.data?.type==='set-source'&&selected?.kind==='html'&&typeof event.data.source==='boolean'){source=event.data.source;renderPreview();}
  if(event.data?.type==='reset-root'){
    window.fileEditor?.reset();generation++;root=event.data.root;selected=null;updateRoot();await navigate('');
  }
});
