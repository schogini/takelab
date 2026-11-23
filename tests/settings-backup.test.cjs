const test=require('node:test');
const assert=require('node:assert/strict');
const backup=require('../web/workspace/settings-backup.js');
test('settings backup retains camera and teleprompter preferences and ignores unrelated storage',()=>{
  const storage=new Map([['workspace.cameras',JSON.stringify({top:{x:30,width:500}})],['teleprompt.settings',JSON.stringify({font:42})],['private.other','secret']]);const settings=backup.collect({getItem:key=>storage.get(key)??null});const value=backup.validate({app:'teleprompt-workspace',version:1,settings});assert.equal(JSON.parse(value.settings['workspace.cameras']).top.width,500);assert.equal(JSON.parse(value.settings['teleprompt.settings']).font,42);assert.equal(Object.hasOwn(value.settings,'private.other'),false);
});
test('invalid backup versions, settings and executable image URLs are rejected',()=>{
  assert.throws(()=>backup.validate({version:9}));assert.throws(()=>backup.validate({app:'teleprompt-workspace',version:1,settings:{'workspace.cameras':'null'}}));assert.throws(()=>backup.validate({app:'teleprompt-workspace',version:1,settings:{},images:{top:{name:'bad',data:'javascript:alert(1)'}}}));
});
test('Top camera image data can be included in a settings backup',()=>{
  const value=backup.validate({app:'teleprompt-workspace',version:1,settings:{},images:{top:{name:'desk.jpg',data:'data:image/jpeg;base64,YWJj'}}});assert.equal(value.images.top.name,'desk.jpg');assert.equal(value.images.head,null);
});
