const test=require('node:test');
const assert=require('node:assert/strict');
const {TerminalTyper}=require('../web/workspace/terminal-typing.js');
test('default typing sends Unicode characters separately without executing multiline clipboard text',async()=>{
  const sent=[],waits=[],updates=[];const typer=new TerminalTyper({send:async value=>sent.push(value),wait:async ms=>waits.push(ms),random:()=>.5,onUpdate:value=>updates.push(value)});
  await typer.type('echo 🌍\r\necho two\n',10);
  assert.equal(sent.join(''),'echo 🌍 echo two');assert.ok(sent.includes('🌍'));assert.ok(waits.every(ms=>ms===100));assert.equal(waits.length,sent.length-1);assert.equal(typer.running,false);assert.equal(updates.at(-1).cancelled,false);
});
test('Enter between lines is opt-in and a final clipboard newline never executes the last line',async()=>{
  const sent=[];const typer=new TerminalTyper({send:async value=>sent.push(value),wait:async()=>{}});await typer.type('echo one\necho two\n\n',12,true);assert.equal(sent.join(''),'echo one\recho two');assert.notEqual(sent.at(-1),'\r');
});
test('cancelling during an in-flight character prevents any subsequent input',async()=>{
  const sent=[];let release;const blocked=new Promise(resolve=>release=resolve);const typer=new TerminalTyper({send:async value=>{sent.push(value);await blocked;},wait:async()=>{}});const done=typer.type('abcdef');typer.cancel();release();await done;assert.deepEqual(sent,['a']);assert.equal(typer.running,false);
});
test('starting new text cancels the previous typing sequence rather than interleaving',async()=>{
  const sent=[];let release;const blocked=new Promise(resolve=>release=resolve);const typer=new TerminalTyper({send:async value=>sent.push(value),wait:()=>blocked});const first=typer.type('old');await Promise.resolve();const second=typer.type('N');release();await Promise.all([first,second]);assert.equal(sent.join(''),'oN');
});
test('control keys and terminal escape sequences are filtered from clipboard text',()=>{
  assert.equal(TerminalTyper.prepare('\x1b[31mecho\x1b[0m\x03\x7f\tready\n'),'echo    ready');
});
test('typing failures stop the sequence and oversized or empty inputs are rejected',async()=>{
  let calls=0;const typer=new TerminalTyper({send:async()=>{calls++;throw Error('Disconnected');}});await assert.rejects(typer.type('abc'),/Disconnected/);assert.equal(calls,1);assert.equal(typer.running,false);await assert.rejects(typer.type(''),/some text/);await assert.rejects(typer.type('a'.repeat(20001)),/20,000/);
});
