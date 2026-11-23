'use strict';
const CameraSettings=(()=>{
  const ranges={brightness:[50,160,100],contrast:[50,160,100],saturation:[0,180,100],warmth:[-100,100,0],softening:[0,100,0],zoom:[1,3,1],panX:[-100,100,0],panY:[-100,100,0],blur:[2,30,12],borderWidth:[0,16,2],borderRadius:[0,60,10]};
  const choices={rotation:[0,90,180,270],shape:['rounded','rectangle','circle'],borderStyle:['solid','dashed','dotted'],background:['off','blur','remove','color','image'],resolution:['480','720','1080','2160','max'],fps:[15,24,30,60]};
  function defaults(){return {...Object.fromEntries(Object.entries(ranges).map(([key,value])=>[key,value[2]])),rotation:0,shape:'rounded',background:'off',backgroundColor:'#263b46',borderColor:'#6b8354',borderStyle:'solid',autoCenter:false,resolution:'max',fps:30};}
  function clean(input){const result=defaults();if(!input||typeof input!=='object')return result;for(const [key,[min,max,fallback]] of Object.entries(ranges))result[key]=Number.isFinite(input[key])?Math.max(min,Math.min(max,input[key])):fallback;for(const [key,options] of Object.entries(choices))if(options.includes(input[key]))result[key]=input[key];if(typeof input.autoCenter==='boolean')result.autoCenter=input.autoCenter;for(const key of ['backgroundColor','borderColor'])if(/^#[0-9a-f]{6}$/i.test(input[key]))result[key]=input[key];return result;}
  function quality(settings,caps={}){const sizes={480:[854,480],720:[1280,720],1080:[1920,1080],2160:[3840,2160],max:[16384,16384]},[w,h]=sizes[settings.resolution]||sizes.max,fps=choices.fps.includes(settings.fps)?settings.fps:30;return {width:{ideal:settings.resolution==='max'?(caps.width?.max||w):w},height:{ideal:settings.resolution==='max'?(caps.height?.max||h):h},frameRate:{ideal:fps,max:fps},resizeMode:'none'};}
  function recordingSize(width,height,viewWidth,viewHeight,rotation=0,fit='cover'){
    if(rotation%180)[width,height]=[height,width];
    const ratio=viewWidth>0&&viewHeight>0?viewWidth/viewHeight:width/height;
    const h=fit==='contain'?Math.max(height,width/ratio):Math.min(height,width/ratio);
    return {width:Math.max(2,Math.floor(h*ratio/2)*2),height:Math.max(2,Math.floor(h/2)*2)};
  }
  // Rotation changes the source extent used by Fit/Fill; manual zoom stays independent.
  function framing(sw,sh,dw,dh,settings,fit,face){const rotated=settings.rotation%180!==0,rw=rotated?sh:sw,rh=rotated?sw:sh;const base=(fit==='contain'?Math.min:Math.max)(dw/rw,dh/rh),scale=base*settings.zoom*(settings.autoCenter?1.35:1),halfX=Math.min(sw/2,(rotated?dh:dw)/(2*scale)),halfY=Math.min(sh/2,(rotated?dw:dh)/(2*scale));return {scale,cx:Math.max(halfX,Math.min(sw-halfX,(face?.x??.5)*sw)),cy:Math.max(halfY,Math.min(sh-halfY,(face?.y??.5)*sh)),x:dw/2+settings.panX*dw/200,y:dh/2+settings.panY*dh/200,radians:settings.rotation*Math.PI/180};}
  function alphaMask(probabilities){const rgba=new Uint8ClampedArray(probabilities.length*4);for(let i=0;i<probabilities.length;i++){const p=Math.max(0,Math.min(1,(probabilities[i]-.25)/.5));rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=255;rgba[i*4+3]=255*p*p*(3-2*p);}return rgba;}
  return {ranges,defaults,clean,quality,recordingSize,framing,alphaMask};
})();
class CameraEffectsStore{
  constructor(storage){this.storage=storage;this.values={head:CameraSettings.defaults(),project:CameraSettings.defaults(),top:CameraSettings.defaults()};this.presets={head:[],project:[],top:[]};try{const saved=JSON.parse(storage.getItem('workspace.cameraEffects'));for(const key of ['head','project','top']){this.values[key]=CameraSettings.clean(saved?.values?.[key]);this.presets[key]=(Array.isArray(saved?.presets?.[key])?saved.presets[key]:[]).filter(p=>typeof p.name==='string').slice(0,12).map(p=>({name:p.name.slice(0,50),settings:CameraSettings.clean(p.settings)}));}}catch{}}
  save(){try{this.storage.setItem('workspace.cameraEffects',JSON.stringify({values:this.values,presets:this.presets}));return true;}catch{return false;}}
}
if(typeof module!=='undefined'&&module.exports)module.exports={CameraSettings,CameraEffectsStore};
