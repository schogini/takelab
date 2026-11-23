'use strict';
const workspaceAppearance=(()=>{
  const el=id=>document.getElementById(id);
  const defaults={background:'#f9f8f3',border:'#6b8354',width:2,radius:10,inset:24};
  let settings={...defaults},colors;
  try{const saved=JSON.parse(localStorage.getItem('workspace.appearance')||'{}');for(const key of ['background','border'])if(/^#[0-9a-f]{6}$/i.test(saved[key]))settings[key]=saved[key];for(const key of ['width','radius','inset'])if(Number.isFinite(saved[key]))settings[key]=saved[key];}catch{}
  const rgb=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16));
  function mix(a,b,amount){return '#'+rgb(a).map((value,i)=>Math.round(value*amount+rgb(b)[i]*(1-amount)).toString(16).padStart(2,'0')).join('');}
  function palette(){
    const linear=rgb(settings.background).map(value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
    const dark=.2126*linear[0]+.7152*linear[1]+.0722*linear[2]<.179;
    const foreground=dark?'#f0f5ec':'#1b291f';
    return {background:settings.background,foreground,muted:mix(foreground,settings.background,.7),line:mix(foreground,settings.background,.22),control:mix(foreground,settings.background,.05),selected:mix(foreground,settings.background,.13),accent:dark?'#d4e59f':'#3d622f'};
  }
  function send(frame){if(colors&&frame?.contentWindow&&!frame.classList.contains('web-frame'))frame.contentWindow.postMessage({type:'workspace-appearance',colors},location.origin);}
  function apply(){
    settings.width=Math.max(0,Math.min(10,Math.round(settings.width)));settings.radius=Math.max(0,Math.min(24,Math.round(settings.radius)));settings.inset=Math.max(0,Math.min(64,Math.round(settings.inset)));colors=palette();
    document.body.classList.add('workspace-colors');
    for(const [key,value] of Object.entries(colors))document.documentElement.style.setProperty('--workspace-'+key,value);
    document.documentElement.style.setProperty('--line',colors.line);document.documentElement.style.setProperty('--green',colors.accent);
    document.documentElement.style.setProperty('--view-border-color',settings.border);document.documentElement.style.setProperty('--view-border-width',settings.width+'px');document.documentElement.style.setProperty('--view-border-radius',settings.radius+'px');
    document.documentElement.style.setProperty('--view-inner-spacing',settings.inset+'px');
    el('view-inner-spacing').value=settings.inset;el('inner-spacing-value').textContent=settings.inset+' px';
    el('workspace-background').value=settings.background;el('view-border-color').value=settings.border;el('view-border-width').value=settings.width;el('view-border-radius').value=settings.radius;
    el('background-value').textContent=settings.background;el('border-color-value').textContent=settings.border;el('border-width-value').textContent=settings.width+' px';el('border-radius-value').textContent=settings.radius+' px';
    document.querySelectorAll('[data-background]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.background===settings.background)));
    document.querySelectorAll('#file-panels iframe').forEach(send);
    try{localStorage.setItem('workspace.appearance',JSON.stringify(settings));}catch{}
  }
  for(const [id,key] of [['workspace-background','background'],['view-border-color','border'],['view-border-width','width'],['view-border-radius','radius'],['view-inner-spacing','inset']])el(id).addEventListener('input',()=>{settings[key]=['width','radius','inset'].includes(key)?Number(el(id).value):el(id).value;apply();});
  document.querySelectorAll('[data-background]').forEach(button=>button.onclick=()=>{settings.background=button.dataset.background;apply();});
  el('appearance-reset').onclick=()=>{settings={...defaults};apply();};
  el('appearance-panel').addEventListener('toggle',event=>el('appearance-toggle').setAttribute('aria-expanded',String(event.newState==='open')));
  apply();return {send};
})();
