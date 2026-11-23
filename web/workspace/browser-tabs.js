'use strict';
const BrowserLinks=(()=>{
  function normalize(value){
    let input=String(value||'').trim();if(!input||input.length>8192)throw Error('Enter a web address (http or https).');
    if(/^(javascript|data|file|vbscript|mailto|ftp|blob|about):/i.test(input))throw Error('Only http and https addresses can be opened.');
    if(input.startsWith('//'))input='https:'+input;
    else if(!/^https?:\/\//i.test(input)){
      if(/^[a-z][a-z\d+.-]*:/i.test(input)&&!/^[-a-z\d.]+:\d+(?:[/?#]|$)/i.test(input))throw Error('Only http and https addresses can be opened.');
      input=(/^(localhost(?=[:/?#]|$)|127\.\d+\.\d+\.\d+|\[::1\])/i.test(input)?'http://':'https://')+input;
    }
    let url;try{url=new URL(input);}catch{throw Error('Enter a valid web address.');}
    if(!['https:','http:'].includes(url.protocol)||!url.hostname)throw Error('Only http and https addresses can be opened.');
    if(url.username||url.password)throw Error('Use a URL without a username or password.');
    return url.href;
  }
  function isStreamlit(value){
    const url=new URL(normalize(value));
    return url.hostname.endsWith('.streamlit.app')||url.hostname==='streamlit.app'||(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.port==='8501');
  }
  function appUrl(value,enabled){
    const url=new URL(normalize(value));
    if(enabled&&(url.hostname.endsWith('.streamlit.app')||url.hostname==='streamlit.app'))url.searchParams.set('embed','true');
    return url.href;
  }
  function configureFrame(frame,url='',workspaceOrigin='',appMode=false){
    if(appMode){
      const target=new URL(normalize(url)),workspace=new URL(workspaceOrigin);
      const loopback=host=>['localhost','127.0.0.1','[::1]'].includes(host);
      if(target.origin===workspace.origin||(loopback(target.hostname)&&loopback(workspace.hostname)&&target.port===workspace.port))throw Error('App mode is for a separate app server, not the workspace URL.');
    }
    // App mode preserves the other server's origin for storage and WebSockets;
    // the browser's cross-origin boundary still separates it from this workspace.
    frame.setAttribute('sandbox','allow-scripts allow-forms'+(appMode?' allow-same-origin':''));frame.referrerPolicy='no-referrer';
    frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; display-capture 'none'; clipboard-read 'none'; clipboard-write 'none'");
    return frame;
  }
  return {normalize,isStreamlit,appUrl,configureFrame};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=BrowserLinks;
