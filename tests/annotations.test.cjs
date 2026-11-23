const test=require('node:test');
const assert=require('node:assert/strict');
const {AnnotationTools,BrowseAnnotationModel}=require('../web/workspace/annotation-model.js');
const mark=(color='#ff0000')=>({tool:'pen',color,width:.01,points:[{x:.1,y:.2},{x:.8,y:.6}]});
test('annotations and their undo histories stay isolated per file, terminal or web tab',()=>{
  const model=new BrowseAnnotationModel(),terminal=Symbol('terminal'),web=Symbol('web');model.select('slides.png');model.add(mark());model.select(terminal);assert.equal(model.page().strokes.length,0);model.add(mark('#00ff00'));model.select(web);assert.equal(model.undo(),false);model.select('slides.png');assert.equal(model.page().strokes[0].color,'#ff0000');model.undo();model.select(terminal);assert.equal(model.page().strokes.length,1);
});
test('Clear is undoable, including when additional marks were drawn afterward',()=>{
  const model=new BrowseAnnotationModel();model.add(mark());model.add({...mark(),tool:'highlighter'});model.clear();assert.equal(model.page().strokes.length,0);model.add(mark('#0000ff'));model.undo();model.undo();assert.equal(model.page().strokes.length,2);model.undo();assert.equal(model.page().strokes[0].tool,'pen');
});
test('closed or reloaded tabs lose their marks without affecting other tabs',()=>{
  const model=new BrowseAnnotationModel();model.select('one');model.add(mark());model.select('two');model.add(mark());model.drop('one');model.select('one');assert.equal(model.page().strokes.length,0);model.select('two');assert.equal(model.page().strokes.length,1);model.reset('two');assert.equal(model.page().strokes.length,0);
});
test('pointer coordinates remain proportional when the browse frame is resized',()=>{
  assert.deepEqual(AnnotationTools.point(300,200,{left:100,top:100,width:400,height:200}),{x:.5,y:.5});assert.deepEqual(AnnotationTools.point(50,999,{left:100,top:100,width:400,height:200}),{x:0,y:1});assert.equal(AnnotationTools.point(1,2,{left:0,top:0,width:0,height:200}),null);
});
test('saved tool settings are bounded and do not accept invalid colors or missing values',()=>{
  const settings=AnnotationTools.settings({laser:{color:'url(evil)',width:9000},pen:{color:'#aabbcc',width:-1},highlighter:{width:NaN}});assert.equal(settings.laser.width,20);assert.equal(settings.laser.color,'#ff3b30');assert.equal(settings.pen.color,'#aabbcc');assert.equal(settings.pen.width,1);assert.equal(settings.highlighter.width,22);
});
test('stored marks are copied and bounded, and transient laser marks are never persisted',()=>{
  const model=new BrowseAnnotationModel(),stroke=mark();model.add(stroke);stroke.points[0].x=.9;assert.equal(model.page().strokes[0].points[0].x,.1);assert.equal(model.add({...mark(),tool:'laser'}),false);assert.equal(model.add({...mark(),width:NaN}),false);model.add({...mark(),points:[{x:-2,y:99}]});assert.deepEqual(model.page().strokes[1].points,[{x:0,y:1}]);
});
