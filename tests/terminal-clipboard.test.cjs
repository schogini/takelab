const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(readText){
  const elements=new Map(),typed=[],models=[];let popups=0;
  const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',checked:false,hidden:false,isConnected:true,classList:{add(){}},setAttribute(){},hidePopover(){popups++;}});return elements.get(id);};
  const context=vm.createContext({document:{getElementById:el,createElement:()=>({classList:{add(){}},setAttribute(){},isConnected:true})},sessionStorage:{getItem:()=>null,setItem(){}},localStorage:{getItem:()=>null},navigator:{clipboard:{readText}},setTimeout:()=>1,
    createTerminalPanel:(host,key)=>{const panel={visible:false,canType:false,setContext(){},setVisible(value){this.visible=value;this.canType=value;},async typeText(...args){typed.push({key,args});},async start(){},stop(){},changeFont(){},clear(){},cancelTyping(){},async dispose(){this.canType=false;}};models.push(panel);return panel;}});
  const source=fs.readFileSync(require.resolve('../web/workspace/terminal.js'),'utf8').split('const terminalPanel=')[1];vm.runInContext('const terminalPanel='+source+';globalThis.manager=terminalPanel;',context);context.manager.setVisible(true,'1');return {el,manager:context.manager,typed,models,get popups(){return popups;}};
}
test('direct clipboard button types immediately using chosen options without showing a popup',async()=>{
  const f=fixture(async()=>"printf 'hello'\n");f.el('terminal-typing-speed').value='25';await f.el('terminal-paste-clipboard').onclick();assert.equal(f.typed.length,1);assert.equal(f.typed[0].key,'workspace.terminal');assert.deepEqual(Array.from(f.typed[0].args),["printf 'hello'\n",25,false]);assert.equal(f.popups,1,'existing popup is hidden');assert.equal(f.el('terminal-paste-clipboard').disabled,false);
});
test('pending clipboard grant is discarded after switching terminals',async()=>{
  const pending=deferred(),f=fixture(()=>pending.promise);const done=f.el('terminal-paste-clipboard').onclick();f.manager.create('2');f.manager.setVisible(true,'2');pending.resolve('do not send');await done;assert.equal(f.typed.length,0);
});
test('pending clipboard grant is discarded after restarting the same terminal',async()=>{
  const pending=deferred(),f=fixture(()=>pending.promise);const done=f.el('terminal-paste-clipboard').onclick();await f.el('terminal-start').onclick();pending.resolve('do not send');await done;assert.equal(f.typed.length,0);
});
test('clipboard denial reports in the toolbar without opening a popup',async()=>{
  const f=fixture(async()=>{throw Error('Permission denied');});await f.el('terminal-paste-clipboard').onclick();assert.equal(f.typed.length,0);assert.equal(f.el('terminal-paste-clipboard').textContent,'Paste failed');assert.match(f.el('terminal-paste-clipboard').title,/Permission denied/);assert.equal(f.el('terminal-paste-clipboard').disabled,false);
});
