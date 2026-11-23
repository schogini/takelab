const test=require('node:test');
const assert=require('node:assert/strict');
const Guard=require('../web/workspace/recording-viewport.js');
function fixture(){let size={innerHeight:800,outerHeight:900},offset=-1;const guard=new Guard(()=>size,value=>offset=value);return {guard,resize:(innerHeight,outerHeight)=>{size={innerHeight,outerHeight};guard.update();},get offset(){return offset;}};}
test('sharing strip consumes header space and disappears without moving content',()=>{const f=fixture();f.guard.begin();f.resize(763,900);assert.equal(f.offset,37);assert.equal(37+(52-f.offset),52);assert.equal(763-(52-f.offset),800-52);f.resize(800,900);assert.equal(f.offset,0);});
test('real window resize is not mistaken for sharing chrome',()=>{const f=fixture();f.guard.begin();f.resize(700,800);assert.equal(f.offset,0);f.resize(663,800);assert.equal(f.offset,37);f.resize(763,900);assert.equal(f.offset,37);});
test('cleanup resets compensation and ignores later resizes',()=>{const f=fixture();f.guard.begin();f.resize(763,900);f.guard.end();assert.equal(f.offset,37);f.resize(800,900);assert.equal(f.offset,0);f.resize(750,900);assert.equal(f.offset,0);});
test('unrelated large chrome changes are not compensated',()=>{const f=fixture();f.guard.begin();f.resize(500,900);assert.equal(f.offset,0);});

test('tall sharing strips above the old 52px limit are compensated',()=>{
  const f=fixture();f.guard.begin();f.resize(736,900);assert.equal(f.offset,64);
  const header=Math.max(0,52-f.offset),extra=Math.max(0,f.offset-52);
  assert.equal(64+header-extra+54,106);assert.equal(736-header+extra,800-52);
});
test('manual compensation works when Chrome reports no viewport change and can be tuned live',()=>{
  const f=fixture();f.guard.begin('64');assert.equal(f.offset,64);f.guard.setOffset('36');assert.equal(f.offset,36);f.guard.setOffset('0');assert.equal(f.offset,0);f.guard.setOffset('auto');assert.equal(f.offset,0);f.guard.setOffset('96');assert.equal(f.offset,96);f.guard.end();assert.equal(f.offset,0);
});
test('invalid manual offsets fall back to automatic measurement',()=>{
  const f=fixture();f.guard.begin();f.resize(763,900);for(const value of ['bad','-1','97']){f.guard.setOffset(value);assert.equal(f.offset,37);}
});
