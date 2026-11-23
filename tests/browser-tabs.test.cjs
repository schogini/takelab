const test=require('node:test');
const assert=require('node:assert/strict');
const BrowserLinks=require('../web/workspace/browser-tabs.js');
test('web addresses normalize safely, including local demonstration servers',()=>{
  for(const [input,expected] of [['example.com/docs','https://example.com/docs'],['https://example.com','https://example.com/'],['http://example.com:8080/demo','http://example.com:8080/demo'],['localhost:3000/demo','http://localhost:3000/demo'],['127.0.0.1:8000','http://127.0.0.1:8000/'],['[::1]:3000','http://[::1]:3000/'],['example.com:8443/path','https://example.com:8443/path'],['//example.com','https://example.com/']])assert.equal(BrowserLinks.normalize(input),expected);
});
test('non-web schemes, credentials, empty and malformed URLs are rejected',()=>{
  for(const input of ['javascript:alert(1)','data:text/html,test','file:///tmp/file','blob:https://example.com/a','ftp://example.com','mailto:a@example.com','about:blank','https://user:secret@example.com','','https://','not a valid address','https://example.com:'+('9'.repeat(10))])assert.throws(()=>BrowserLinks.normalize(input),input);
});
test('embedded sites have an opaque sandbox and cannot access workspace capture or clipboard permissions',()=>{
  const attrs={},frame={setAttribute:(name,value)=>attrs[name]=value};assert.equal(BrowserLinks.configureFrame(frame),frame);assert.equal(attrs.sandbox,'allow-scripts allow-forms');assert.ok(!attrs.sandbox.includes('allow-same-origin'));assert.ok(!attrs.sandbox.includes('allow-top-navigation'));assert.equal(frame.referrerPolicy,'no-referrer');for(const permission of ['camera','microphone','geolocation','display-capture','clipboard-read','clipboard-write'])assert.ok(attrs.allow.includes(permission+" 'none'"));
});

test('Streamlit detection and cloud embed mode preserve paths and existing query parameters',()=>{
  assert.equal(BrowserLinks.isStreamlit('http://localhost:8501/'),true);
  assert.equal(BrowserLinks.isStreamlit('127.0.0.1:8501/demo'),true);
  assert.equal(BrowserLinks.isStreamlit('https://demo.streamlit.app/'),true);
  assert.equal(BrowserLinks.isStreamlit('https://streamlit.app.evil.example/'),false);
  assert.equal(BrowserLinks.appUrl('https://demo.streamlit.app/page?x=1',true),'https://demo.streamlit.app/page?x=1&embed=true');
  assert.equal(BrowserLinks.appUrl('localhost:8501/',true),'http://localhost:8501/');
});
test('app mode preserves a separate app origin but rejects the workspace and local aliases',()=>{
  const attrs={},frame={setAttribute:(name,value)=>attrs[name]=value};
  BrowserLinks.configureFrame(frame,'http://localhost:8501/','http://127.0.0.1:8766',true);
  assert.equal(attrs.sandbox,'allow-scripts allow-forms allow-same-origin');
  assert.ok(attrs.allow.includes("microphone 'none'"));assert.ok(!attrs.sandbox.includes('allow-top-navigation'));
  for(const url of ['http://127.0.0.1:8766','http://localhost:8766','http://[::1]:8766'])assert.throws(()=>BrowserLinks.configureFrame(frame,url,'http://127.0.0.1:8766',true),/separate app server/);
});
