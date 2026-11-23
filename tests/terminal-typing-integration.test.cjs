const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const elements=new Map(),inputs=[],stops=[],terminals=[];let number=0;
  const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false});return elements.get(id);};
  const context=vm.createContext({document:{hidden:false,getElementById:el},localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},TextEncoder,Uint8Array,atob,btoa,
    Terminal:class{constructor(){this.cols=80;this.rows=24;this.options={fontSize:15};terminals.push(this);}open(){}loadAddon(){}onData(fn){this.data=fn;}onResize(){}focus(){}reset(){}write(){}dispose(){}},FitAddon:{FitAddon:class{fit(){}}},ResizeObserver:class{observe(){}disconnect(){}},
    setTimeout:(fn,ms)=>{if(ms!==70&&ms!==100&&ms!==300&&ms!==500&&ms!==6000)queueMicrotask(fn);return 1;},clearTimeout(){},
    fetch:async(url,options)=>{const data=options.body?JSON.parse(options.body):{};let result={};if(url.endsWith('/start'))result={id:'session-'+(++number),cwd:'/test'};else if(url.endsWith('/input'))inputs.push({id:data.id,text:atob(data.data)});else if(url.endsWith('/stop'))stops.push(data.id);else if(url.includes('/output?'))result={data:'',cursor:0,ended:false};return {ok:true,json:async()=>result};}
  });
  vm.runInContext(fs.readFileSync(require.resolve('../web/workspace/terminal-typing.js'),'utf8'),context);
  const source=fs.readFileSync(require.resolve('../web/workspace/terminal.js'),'utf8').split('const terminalPanel=')[0];vm.runInContext(source+';globalThis.make=createTerminalPanel;',context);
  const make=(id,isCurrent=()=>true)=>{const host={clientWidth:800,hidden:true,remove(){}};const panel=context.make(host,'test-'+id,isCurrent,String(id));panel.setContext({token:'test',root:'/test',path:''});return panel;};return {make,inputs,stops,terminals};
}
test('animated paste reaches only its terminal as individual characters and leaves Enter unsent',async()=>{
  const f=fixture(),panel=f.make(2);panel.setVisible(true);await tick();assert.match(f.inputs[0].text,/clear; PS1="Schogini2>/);f.inputs.length=0;await panel.typeText('echo hi\n',50,false);assert.equal(f.inputs.map(x=>x.text).join(''),'echo hi');assert.ok(f.inputs.every(x=>x.id==='session-1'&&x.text.length===1));await panel.dispose();assert.deepEqual(f.stops,['session-1']);
});
test('switching away cancels input and never sends remaining characters to another terminal',async()=>{
  const f=fixture();let selected=1;const first=f.make(1,()=>selected===1),second=f.make(2,()=>selected===2);first.setVisible(true);await tick();f.inputs.length=0;const pending=first.typeText('abcdef',5,false);first.setVisible(false);selected=2;second.setVisible(true);await pending;await tick();const firstInput=f.inputs.filter(x=>x.id==='session-1');assert.ok(firstInput.length<=1);assert.ok(f.inputs.filter(x=>x.id==='session-2').every(x=>x.text.startsWith('clear; PS1=')));await first.dispose();await second.dispose();
});
