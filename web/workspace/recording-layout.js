'use strict';
(()=>{
  const pane=document.getElementById('preview-pane');
  const stage=document.getElementById('reference-stage');
  const selector=document.getElementById('recording-ratio');
  const viewportGuard=new RecordingViewportGuard(
    ()=>({innerHeight:window.innerHeight,outerHeight:window.outerHeight}),
    offset=>{
      document.body.style.setProperty('--recording-offset',offset+'px');
      document.body.style.setProperty('--recording-reclaimed-toolbar',Math.min(52,offset)+'px');
      document.body.style.setProperty('--workspace-header-height',Math.max(0,52-offset)+'px');
      document.body.style.setProperty('--recording-extra-offset',Math.max(0,offset-52)+'px');
      document.body.style.setProperty('--recording-controls-max-width',Math.max(1,Math.min(window.innerWidth-24,stage.getBoundingClientRect().left-24))+'px');
      document.body.classList.toggle('recording-viewport-compensated',offset>0);
    }
  );
  let viewportTimer;
  const checkViewport=()=>{
    viewportGuard.update();
    if(!viewportGuard.baseline){clearInterval(viewportTimer);viewportTimer=null;}
  };
  window.WorkspaceRecordingViewport={
    begin:value=>{viewportGuard.begin(value);clearInterval(viewportTimer);viewportTimer=setInterval(checkViewport,250);},
    update:checkViewport,
    setOffset:value=>viewportGuard.setOffset(value),
    end:()=>{viewportGuard.end();checkViewport();}
  };
  window.addEventListener('resize',checkViewport);
  window.visualViewport?.addEventListener('resize',checkViewport);
  window.addEventListener('pagehide',()=>clearInterval(viewportTimer));
  const ratios={'16:9':16/9,'16:10':16/10,'4:3':4/3,'1:1':1,'9:16':9/16,'3:4':3/4};
  try{const saved=localStorage.getItem('workspace.recordingRatio');if(saved==='free'||Object.hasOwn(ratios,saved))selector.value=saved;}catch{}
  function apply(){
    const ratio=ratios[selector.value];
    pane.classList.toggle('recording-ratio-locked',!!ratio);
    const margins=getComputedStyle(stage),heading=pane.querySelector('.pane-heading');
    const availableWidth=Math.max(0,pane.clientWidth-parseFloat(margins.marginLeft)-parseFloat(margins.marginRight));
    const availableHeight=Math.max(0,pane.clientHeight-heading.getBoundingClientRect().height-parseFloat(margins.marginTop)-parseFloat(margins.marginBottom));
    const width=ratio?Math.min(availableWidth,availableHeight*ratio):availableWidth;
    const height=ratio?width/ratio:availableHeight;
    const requested=parseFloat(margins.getPropertyValue('--view-inner-spacing'));
    const inset=Number.isFinite(requested)?requested:24;
    // Reserve space inside the fixed frame, including on very small panes.
    stage.style.setProperty('--recording-safe-inset',Math.max(0,Math.min(inset,width/4,height/4))+'px');
    if(ratio){stage.style.width=width+'px';stage.style.height=height+'px';}
    else{stage.style.removeProperty('width');stage.style.removeProperty('height');}
    const rect=stage.getBoundingClientRect();
    selector.title=`Browse recording area: ${Math.round(rect.width)} × ${Math.round(rect.height)} px · ${selector.value==='free'?'Free size':selector.value}`;
  }
  function save(){try{localStorage.setItem('workspace.recordingRatio',selector.value);}catch{}}
  selector.addEventListener('change',()=>{apply();save();});
  document.getElementById('view-inner-spacing').addEventListener('input',apply);
  document.getElementById('appearance-reset').addEventListener('click',apply);
  document.getElementById('reset-layout').addEventListener('click',()=>{selector.value='free';apply();save();});
  new ResizeObserver(apply).observe(pane);
  apply();
})();
