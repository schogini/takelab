'use strict';
class TerminalTyper{
  constructor({send,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random,onUpdate=()=>{}}){Object.assign(this,{send,wait,random,onUpdate,epoch:0,running:false});}
  static prepare(text,enterLines=false){
    // Clipboard escape/control sequences must not become invisible terminal keys.
    let value=String(text).replace(/\r\n?/g,'\n').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'').replace(/\t/g,'    ').replace(/\n+$/g,'');
    return value.replace(/\n/g,enterLines?'\r':' ');
  }
  cancel(){++this.epoch;const wasRunning=this.running;this.running=false;if(wasRunning)this.onUpdate({running:false,cancelled:true});}
  async type(text,speed=12,enterLines=false){
    const characters=Array.from(TerminalTyper.prepare(text,enterLines));if(!characters.length)throw Error('Paste or enter some text first.');if(characters.length>20000)throw Error('Use up to 20,000 characters per typing session.');
    this.cancel();const ticket=this.epoch;this.running=true;const rate=Math.max(2,Math.min(60,Number(speed)||12));this.onUpdate({running:true,sent:0,total:characters.length});
    try{
      for(let i=0;i<characters.length;i++){
        if(ticket!==this.epoch)return;
        await this.send(characters[i]);if(ticket!==this.epoch)return;
        this.onUpdate({running:true,sent:i+1,total:characters.length});
        if(i<characters.length-1)await this.wait(1000/rate*(.8+this.random()*.4));
      }
    }finally{if(ticket===this.epoch){this.running=false;this.onUpdate({running:false,cancelled:false});}}
  }
}
if(typeof module!=='undefined'&&module.exports)module.exports={TerminalTyper};
