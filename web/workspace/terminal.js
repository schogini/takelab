'use strict';
function createTerminalPanel(host,storageKey,isCurrent,promptNumber){
  const el=id=>document.getElementById(id);
  let term=null,fit=null,context=null,session=null,cursor=0,pollTimer=0,resizeTimer=0,visible=false,busy=false,running=false,epoch=0;
  let inputQueue=Promise.resolve(),disposed=false,observer=null,lastStatus='Ready to start',typingTarget=null;
  const typer=new TerminalTyper({send:async character=>{
    const target=typingTarget;
    if(disposed||!visible||!isCurrent()||!running||busy||session?.id!==target?.id||epoch!==target?.epoch)throw Error('Terminal changed. Typing stopped.');
    await sendInput(target.id,character,()=>typer.running&&session?.id===target.id&&epoch===target.epoch);
  },onUpdate:value=>{
    status(value.running?`Typing ${value.sent}/${value.total}…`:(running?'Connected':'Closed'));
    if(isCurrent()){el('terminal-typing-stop').hidden=!value.running;el('terminal-typing-feedback').textContent=value.running?'Typing into this terminal…':value.cancelled?'Typing stopped.':'Text typed. Press Enter in the terminal when ready.';}
  }});
  function sendInput(id,data,valid=()=>true){
    const bytes=new TextEncoder().encode(data);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    const pending=inputQueue.then(()=>{if(valid())return request('input',{id,data:btoa(binary)});});inputQueue=pending.catch(()=>{});return pending;
  }
  function notify(text){el('toast').textContent=text;el('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el('toast').hidden=true,6000);}
  function status(text){lastStatus=text;if(!isCurrent())return;el('terminal-typing-stop').hidden=!typer.running;el('terminal-paste-toggle').disabled=busy||!running;el('terminal-paste-clipboard').disabled=busy||!running||typer.running;if(el('terminal-status').textContent!==text)el('terminal-status').textContent=text;el('terminal-start').textContent=running?'Restart here':'Start here';el('terminal-start').disabled=busy||!context?.token;el('terminal-stop').disabled=busy||!session;}
  function remember(){try{if(session)sessionStorage.setItem(storageKey,JSON.stringify(session));else sessionStorage.removeItem(storageKey);}catch{}}
  async function request(path,data){
    const options={headers:{'X-Preview-Token':context.token}};
    if(data!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(data);}
    const response=await fetch('/api/terminal/'+path,options);const result=await response.json();
    if(!response.ok){const error=new Error(result.error||'Terminal request failed.');error.status=response.status;throw error;}return result;
  }
  function fitTerminal(){if(visible&&fit&&host.clientWidth>0){try{fit.fit();}catch{}}}
  function ensureTerminal(){
    if(term)return;
    let fontSize=15;try{const value=Number(localStorage.getItem('workspace.terminal.font'));if(value>=10&&value<=28)fontSize=value;}catch{}
    term=new Terminal({fontFamily:'Menlo, Monaco, Consolas, monospace',fontSize,lineHeight:1.25,cursorBlink:true,screenReaderMode:true,scrollback:5000,theme:{background:'#151b1a',foreground:'#e3ebdb',cursor:'#d4e59f',selectionBackground:'#526a4280',black:'#151b1a',red:'#ec8d7d',green:'#bad68b',yellow:'#e0cb83',blue:'#9bbdde',magenta:'#c8a2d7',cyan:'#90c9bb',white:'#e3ebdb',brightBlack:'#7e8d81',brightRed:'#ffa18e',brightGreen:'#d2e8a3',brightYellow:'#f2df97',brightBlue:'#b2d0ee',brightMagenta:'#dcb6e9',brightCyan:'#abe2d3',brightWhite:'#f5f9ef'}});
    fit=new FitAddon.FitAddon();term.loadAddon(fit);term.open(host);
    term.onData(data=>{
      if(!session||!running||busy)return;
      typer.cancel();sendInput(session.id,data).catch(error=>notify(error.message));
    });
    term.onResize(({cols,rows})=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(session&&running)request('resize',{id:session.id,cols,rows}).catch(error=>notify(error.message));},100);});
    observer=new ResizeObserver(fitTerminal);observer.observe(host);
    fitTerminal();
  }
  function consume(result){
    if(result.trimmed)term.write('\r\n[Earlier terminal output was trimmed.]\r\n');
    if(result.data){const raw=atob(result.data);term.write(Uint8Array.from(raw,char=>char.charCodeAt(0)));}
    cursor=result.cursor;
    if(result.ended){typer.cancel();running=false;status('Exited'+(result.exit_code!==null?' · '+result.exit_code:''));}
  }
  async function poll(ticket){
    if(ticket!==epoch||!session)return;
    try{const result=await request('output?id='+encodeURIComponent(session.id)+'&after='+cursor);if(ticket!==epoch)return;consume(result);if(!result.ended)pollTimer=setTimeout(()=>poll(ticket),document.hidden?500:visible?70:300);}
    catch(error){if(ticket!==epoch)return;typer.cancel();running=false;status('Disconnected');notify(error.message+' Refresh the page to reconnect.');}
  }
  function describe(){
    if(!isCurrent())return;
    el('terminal-location').textContent=session?'Started in: '+session.cwd:'Opens in: '+(context?.cwd||'…');
    el('terminal-location').title=session?.cwd||context?.cwd||'';
  }
  async function start(){
    if(busy||!context?.token)return;
    typer.cancel();ensureTerminal();busy=true;status('Starting…');const ticket=++epoch;clearTimeout(pollTimer);
    try{
      await inputQueue;
      if(session){try{await request('stop',{id:session.id});}catch(error){if(error.status!==404)throw error;}}
      session=null;remember();running=false;cursor=0;term.reset();fitTerminal();
      const result=await request('start',{path:context.path,cols:term.cols,rows:term.rows});
      if(ticket!==epoch){await request('stop',{id:result.id}).catch(()=>{});return;}session=result;remember();
      const number=Number.isSafeInteger(Number(promptNumber))&&Number(promptNumber)>0?Number(promptNumber):1;
      await request('input',{id:session.id,data:btoa(`clear; PS1="Schogini${number}> "; PS2="Schogini${number}> "\n`)});
      if(ticket!==epoch)return;
      running=true;describe();busy=false;status('Connected');poll(ticket);if(visible)term.focus();
    }catch(error){if(disposed)return;running=false;busy=false;status('Could not start');notify(error.message);}
  }
  async function connect(){
    if(busy||session||!context?.token)return;
    let saved=null;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
    if(!saved?.id)return start();
    busy=true;status('Reconnecting…');const ticket=++epoch;
    try{const result=await request('output?id='+encodeURIComponent(saved.id)+'&after=0');if(ticket!==epoch)return;session={id:saved.id,cwd:result.cwd};cursor=0;running=!result.ended;busy=false;describe();status(running?'Connected':'Exited');consume(result);remember();if(!result.ended)poll(ticket);fitTerminal();if(visible)term.focus();}
    catch(error){busy=false;session=null;remember();if(error.status===404)return start();status('Could not reconnect');notify(error.message);}
  }
  async function stop(){
    if(busy||!session)return;typer.cancel();busy=true;status('Closing…');++epoch;clearTimeout(pollTimer);
    try{await inputQueue;await request('stop',{id:session.id});session=null;running=false;remember();term.write('\r\n[Terminal closed]\r\n');busy=false;describe();status('Closed');}
    catch(error){busy=false;status('Could not close');notify(error.message);}
  }
  function changeFont(delta){ensureTerminal();term.options.fontSize=Math.max(10,Math.min(28,term.options.fontSize+delta));try{localStorage.setItem('workspace.terminal.font',String(term.options.fontSize));}catch{}fitTerminal();if(visible)term.focus();}
  return {
    get visible(){return visible;},get canType(){return !!session&&running&&!busy&&!disposed&&visible&&!typer.running;},start,stop,changeFont,cancelTyping:()=>typer.cancel(),async typeText(text,speed,enterLines){if(!session||!running||busy||!visible)throw Error('Start this terminal before typing.');typingTarget={id:session.id,epoch};term.focus();await typer.type(text,speed,enterLines);},clear(){typer.cancel();term?.clear();term?.focus();},
    async dispose(){typer.cancel();disposed=true;++epoch;clearTimeout(pollTimer);clearTimeout(resizeTimer);observer?.disconnect();let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}const id=session?.id||saved?.id;await inputQueue;if(id)try{await request('stop',{id});}catch(error){if(error.status!==404)throw error;}session=null;remember();term?.dispose();host.remove();},
    setContext(value){context={...value,cwd:value.path?value.root+'/'+value.path:value.root};describe();if(!session)status('Ready to start');if(visible&&!session&&!busy){ensureTerminal();connect();}},
    setVisible(value){if(!value)typer.cancel();visible=value;host.hidden=!value;if(value){describe();status(lastStatus);ensureTerminal();fitTerminal();if(context&&!session&&!busy)connect();else term.focus();}}
  };
}

const terminalPanel=(()=>{
  const el=id=>document.getElementById(id),panels=new Map();let active='1',context=null,selectionEpoch=0,clipboardPending=false;
  let saved=[];try{saved=JSON.parse(sessionStorage.getItem('workspace.terminal.tabs')||'[]');}catch{}
  let primaryClosed=false;try{primaryClosed=sessionStorage.getItem('workspace.terminal.primaryClosed')==='true';}catch{}
  const ids=[...(primaryClosed?[]:['1']),...(Array.isArray(saved)?saved:[]).filter(id=>typeof id==='string'&&/^[1-9][0-9]*$/.test(id)&&id!=='1'&&id.length<8).slice(0,3)];
  function save(){try{sessionStorage.setItem('workspace.terminal.primaryClosed',String(!panels.has('1')));sessionStorage.setItem('workspace.terminal.tabs',JSON.stringify([...panels.keys()].filter(id=>id!=='1')));}catch{}}
  function create(id){if(panels.has(id))return;const host=(id==='1'?el('terminal-host'):null)||document.createElement('div');host.classList.add('terminal-host');host.hidden=true;host.id=id==='1'?'terminal-host':'terminal-host-'+id;host.setAttribute('aria-label','Interactive terminal '+id);if(!host.isConnected)el('terminal-panel').append(host);const panel=createTerminalPanel(host,id==='1'?'workspace.terminal':'workspace.terminal.'+id,()=>active===id,id);panels.set(id,panel);if(context)panel.setContext(context);save();}
  ids.forEach(create);
  el('terminal-start').onclick=()=>{++selectionEpoch;return panels.get(active)?.start();};el('terminal-stop').onclick=()=>{++selectionEpoch;return panels.get(active)?.stop();};el('terminal-clear').onclick=()=>panels.get(active)?.clear();
  el('terminal-font-down').onclick=()=>panels.get(active)?.changeFont(-1);el('terminal-font-up').onclick=()=>panels.get(active)?.changeFont(1);
  let typingSpeed='12';try{const savedSpeed=localStorage.getItem('workspace.terminal.typing');if(['5','12','25','50'].includes(savedSpeed))typingSpeed=savedSpeed;}catch{}
  el('terminal-typing-speed').value=typingSpeed;
  el('terminal-typing-speed').onchange=()=>{try{localStorage.setItem('workspace.terminal.typing',el('terminal-typing-speed').value);}catch{}};
  el('terminal-read-clipboard').onclick=async()=>{try{el('terminal-typing-text').value=await navigator.clipboard.readText();el('terminal-typing-feedback').textContent='Clipboard loaded. Review the text, then click Start typing.';}catch{el('terminal-typing-feedback').textContent='Clipboard access was unavailable. Paste into the text box using ⌘V.';el('terminal-typing-text').focus();}};
  el('terminal-typing-start').onclick=async()=>{const panel=panels.get(active);if(!panel)return;try{el('terminal-typing-panel').hidePopover();await panel.typeText(el('terminal-typing-text').value,Number(el('terminal-typing-speed').value),el('terminal-typing-enter-lines').checked);}catch(error){el('terminal-typing-feedback').textContent=error.message;el('toast').textContent=error.message;el('toast').hidden=false;}};
  el('terminal-paste-clipboard').onclick=async()=>{
    if(clipboardPending)return;
    const id=active,panel=panels.get(id),ticket=selectionEpoch,button=el('terminal-paste-clipboard');if(!panel?.canType)return;
    const speed=Number(el('terminal-typing-speed').value),enterLines=el('terminal-typing-enter-lines').checked;
    clipboardPending=true;button.disabled=true;button.textContent='Paste clipboard';button.title='Type clipboard into this terminal using the selected speed';el('terminal-typing-panel').hidePopover();
    try{
      const text=await navigator.clipboard.readText();
      // Permission prompts can outlive a tab switch, close, or replacement shell.
      if(ticket!==selectionEpoch||panels.get(id)!==panel||!panel.canType)return;
      await panel.typeText(text,speed,enterLines);
    }catch(error){el('terminal-typing-feedback').textContent=error.message;button.textContent='Paste failed';button.title='Clipboard typing failed: '+error.message+'. Use Paste as typing to paste manually.';setTimeout(()=>{button.textContent='Paste clipboard';},6000);}
    finally{clipboardPending=false;button.disabled=!panels.get(active)?.canType;}
  };
  el('terminal-typing-stop').onclick=()=>panels.get(active)?.cancelTyping();
  return {
    ids:()=>[...panels.keys()],
    create(id){if(panels.size>=4)throw Error('Up to four terminal tabs can be open. Close one before adding another.');create(id);},
    async close(id){++selectionEpoch;const panel=panels.get(id);if(!panel)return;await panel.dispose();panels.delete(id);save();},
    setContext(value){context=value;for(const panel of panels.values())panel.setContext(value);},
    setVisible(value,id='1'){++selectionEpoch;for(const panel of panels.values())panel.setVisible(false);active=id;el('terminal-typing-title').textContent='Paste as typing · Terminal '+id;el('terminal-typing-stop').hidden=true;panels.get(id)?.setVisible(value);},
    get visible(){return panels.get(active)?.visible||false;}
  };
})();
