'use strict';
const AnnotationTools=(()=>{
  const defaults={laser:{color:'#ff3b30',width:8},pen:{color:'#ff3b30',width:4},highlighter:{color:'#ffe450',width:22}};
  const ranges={laser:[3,20],pen:[1,16],highlighter:[8,40]};
  function settings(input){const result={};for(const key of Object.keys(defaults)){const value=input?.[key];result[key]={color:/^#[a-f\d]{6}$/i.test(value?.color)?value.color:defaults[key].color,width:Number.isFinite(value?.width)?Math.max(ranges[key][0],Math.min(ranges[key][1],value.width)):defaults[key].width};}return result;}
  function point(x,y,rect){if(!Number.isFinite(x)||!Number.isFinite(y)||rect.width<=0||rect.height<=0)return null;return {x:Math.max(0,Math.min(1,(x-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(y-rect.top)/rect.height))};}
  return {settings,point,ranges};
})();
class BrowseAnnotationModel{
  constructor(){this.tabs=new Map();this.key=null;}
  page(){if(!this.tabs.has(this.key))this.tabs.set(this.key,{strokes:[],history:[]});return this.tabs.get(this.key);}
  select(key){this.key=key;return this.page();}
  add(stroke){
    if(!['pen','highlighter'].includes(stroke?.tool)||!/^#[a-f\d]{6}$/i.test(stroke.color)||!Number.isFinite(stroke.width)||stroke.width<=0)return false;
    const points=(Array.isArray(stroke.points)?stroke.points:[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,4000).map(p=>({x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))}));
    const page=this.page();if(!points.length||page.strokes.length>=500)return false;
    const value={tool:stroke.tool,color:stroke.color,width:Math.min(.5,stroke.width),points};page.strokes.push(value);page.history.push({type:'add',stroke:value});this.trim(page);return true;
  }
  trim(page){if(page.history.length>100)page.history.shift();}
  undo(){const page=this.page(),action=page.history.pop();if(!action)return false;if(action.type==='clear')page.strokes=action.strokes;else{const index=page.strokes.indexOf(action.stroke);if(index!==-1)page.strokes.splice(index,1);}return true;}
  clear(){const page=this.page();if(!page.strokes.length)return false;page.history.push({type:'clear',strokes:page.strokes});page.strokes=[];this.trim(page);return true;}
  reset(key){this.tabs.delete(key);}
  drop(key){this.tabs.delete(key);}
}
if(typeof module!=='undefined'&&module.exports)module.exports={AnnotationTools,BrowseAnnotationModel};
