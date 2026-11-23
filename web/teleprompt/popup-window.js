'use strict';
const PromptPopup=(()=>{
  const key='teleprompt.popupWindow';
  function geometry(display,saved={}){
    const availableWidth=Math.max(240,Number(display.availWidth)||1280),availableHeight=Math.max(180,Number(display.availHeight)||720);
    const width=Math.min(availableWidth,Math.max(240,Number(saved.width)||420)),height=Math.min(availableHeight,Math.max(180,Number(saved.height)||380));
    const edge=Number(display.availLeft)||0,top=Number(display.availTop)||0;
    const left=Number.isFinite(saved.left)?Math.max(edge,Math.min(edge+availableWidth-width,saved.left)):edge+(availableWidth-width)/2;
    return {width:Math.round(width),height:Math.round(height),left:Math.round(left),top};
  }
  function open(path){
    let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
    const g=geometry(window.screen,saved),url=new URL('/teleprompt/index.html',location.origin);url.searchParams.set('floating','1');if(path)url.searchParams.set('file',path);
    return window.open(url.href,'teleprompt-floating',`popup=yes,width=${g.width},height=${g.height},left=${g.left},top=${g.top},resizable=yes,scrollbars=no`);
  }
  return {key,geometry,open};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PromptPopup;
