'use strict';
const el=id=>document.getElementById(id),status=el('pdf-status');let viewer=null,pdf=null,task=null;
function controls(){if(!pdf||!viewer)return;el('pdf-page').value=String(viewer.currentPageNumber);el('pdf-previous').disabled=viewer.currentPageNumber<=1;el('pdf-next').disabled=viewer.currentPageNumber>=pdf.numPages;}
function zoom(factor){if(!viewer||!pdf)return;const scale=Math.max(.25,Math.min(4,viewer.currentScale*factor));viewer.currentScale=scale;let option=el('pdf-scale').querySelector('[data-custom]');if(!option){option=document.createElement('option');option.dataset.custom='true';el('pdf-scale').append(option);}option.value=String(scale);option.textContent=Math.round(scale*100)+'%';el('pdf-scale').value=String(scale);}
try{
  const path=new URLSearchParams(location.search).get('path');if(!path)throw Error('No PDF was selected.');document.title=path.split('/').pop()+' — PDF viewer';
  const pdfjs=await import('/vendor/pdfjs/pdf.mjs');globalThis.pdfjsLib=pdfjs;
  const {PDFViewer,PDFLinkService,EventBus}=await import('/vendor/pdfjs/pdf_viewer.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
  const eventBus=new EventBus(),container=el('viewerContainer'),linkService=new PDFLinkService({eventBus,externalLinkTarget:2,externalLinkRel:'noopener noreferrer'});
  viewer=new PDFViewer({container,eventBus,linkService,annotationMode:0,imageResourcesPath:'/vendor/pdfjs/images/'});linkService.setViewer(viewer);
  eventBus.on('pagesinit',()=>{viewer.currentScaleValue='page-width';status.hidden=true;controls();});eventBus.on('pagechanging',controls);
  const url='/raw?path='+encodeURIComponent(path);
  task=pdfjs.getDocument({url,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/',iccUrl:'/vendor/pdfjs/iccs/',isEvalSupported:false,enableXfa:false});
  task.onPassword=callback=>{const password=prompt('This PDF is password protected. Enter its password:');if(password===null){task.destroy();status.textContent='Password entry cancelled. Reopen the PDF tab to try again.';return;}callback(password);};
  pdf=await task.promise;viewer.setDocument(pdf);linkService.setDocument(pdf,null);
  el('pdf-pages').textContent='/ '+pdf.numPages;el('pdf-page').max=String(pdf.numPages);
  for(const id of ['pdf-page','pdf-zoom-out','pdf-scale','pdf-zoom-in'])el(id).disabled=false;
  el('pdf-download').href=url+'&download=1';el('pdf-download').download=path.split('/').pop();el('pdf-download').hidden=false;
  el('pdf-previous').onclick=()=>{viewer.currentPageNumber=Math.max(1,viewer.currentPageNumber-1);};el('pdf-next').onclick=()=>{viewer.currentPageNumber=Math.min(pdf.numPages,viewer.currentPageNumber+1);};
  el('pdf-page').onchange=()=>{const page=Number(el('pdf-page').value);if(Number.isInteger(page)&&page>=1&&page<=pdf.numPages)viewer.currentPageNumber=page;controls();};
  el('pdf-scale').onchange=()=>{viewer.currentScaleValue=el('pdf-scale').value;};el('pdf-zoom-out').onclick=()=>zoom(1/1.2);el('pdf-zoom-in').onclick=()=>zoom(1.2);
  new ResizeObserver(()=>{if(['page-width','page-fit'].includes(viewer.currentScaleValue))viewer.currentScaleValue=viewer.currentScaleValue;viewer.update();}).observe(container);
}catch(error){status.hidden=false;status.textContent='Could not display this PDF: '+error.message+'. Use Open PDF or Download in View options.';}
window.addEventListener('pagehide',()=>{viewer?.cleanup();task?.destroy();});
