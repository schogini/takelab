'use strict';
/* Browser-owned sharing chrome changes the viewport without resizing the window.
   Spend that height from our header, keeping the content fixed on the screen. */
class RecordingViewportGuard {
  constructor(read,apply){this.read=read;this.apply=apply;this.baseline=null;}
  setOffset(value){this.override=value==='auto'||value===null||value===undefined?null:Number(value);if(!Number.isFinite(this.override)||this.override<0||this.override>96)this.override=null;this.update();}
  begin(value='auto'){this.setOffset(value);this.ending=false;if(!this.baseline)this.baseline=this.read();this.update();}
  update(){
    if(!this.baseline)return;
    const now=this.read(),before=this.baseline;
    const lost=(now.outerHeight-now.innerHeight)-(before.outerHeight-before.innerHeight);
    // Allow taller sharing strips, but leave the browse frame below browser chrome.
    const automatic=lost>0&&lost<=96?lost:0;
    const offset=!this.ending&&this.override!==null&&this.override!==undefined?this.override:automatic;
    this.apply(offset);
    if(this.ending&&offset===0)this.baseline=null;
  }
  end(){this.ending=true;this.update();}
}
if(typeof module!=='undefined'&&module.exports)module.exports=RecordingViewportGuard;
