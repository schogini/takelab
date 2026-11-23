const test=require('node:test');
const assert=require('node:assert/strict');
const Popup=require('../web/teleprompt/popup-window.js');
test('popup opens centered at the usable screen top next to the camera',()=>{
  assert.deepEqual(Popup.geometry({availWidth:1440,availHeight:875,availTop:25,availLeft:0}),{width:420,height:380,left:510,top:25});
});
test('saved width and horizontal placement are restored, with top always reset to usable edge',()=>{
  assert.deepEqual(Popup.geometry({availWidth:1440,availHeight:875,availTop:25,availLeft:0},{width:300,height:260,left:620,top:500}),{width:300,height:260,left:620,top:25});
});
test('offscreen and tiny saved geometry is bounded including monitors left of the primary display',()=>{
  const display={availWidth:1280,availHeight:720,availLeft:-1280,availTop:0};
  assert.deepEqual(Popup.geometry(display,{width:100,height:100,left:-3000}),{width:240,height:180,left:-1280,top:0});
  assert.deepEqual(Popup.geometry(display,{width:3000,height:2000,left:2000}),{width:1280,height:720,left:-1280,top:0});
});
