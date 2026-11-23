'use strict';
(()=>{
  const editor=document.createElement('section');editor.id='file-editor';editor.hidden=true;
  editor.innerHTML='<header><strong id="editor-name"></strong><div><button id="editor-save" type="button">Save ⌘S</button><button id="editor-cancel" type="button">Cancel</button></div></header><p id="editor-status" role="status"></p><textarea id="editor-text" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Edit file contents"></textarea>';
  document.querySelector('main').insertBefore(editor,document.querySelector('.main-footer'));
  const text=document.getElementById('editor-text'),status=document.getElementById('editor-status');let state=null,loading=false,saving=false,sequence=0;
  const dirty=()=>!!state&&text.value!==state.text;
  function report(){if(embedded&&selected)parent.postMessage({type:'preview-editor-state',path:selected.path,editing:!!state||loading,dirty:dirty(),saving},location.origin);}
  function controls(){document.getElementById('editor-save').disabled=saving||!dirty();document.getElementById('editor-cancel').disabled=saving;text.readOnly=saving;report();}
  function reset(){++sequence;state=null;loading=false;editor.hidden=true;text.value='';report();}
  function canLeave(){if(saving){toast('Wait for the file to finish saving.');return false;}return !dirty()||confirm('Discard unsaved edits to '+selected.name+'?');}
  async function open(){
    if(state||loading||!selected?.editable)return;const file=selected,ticket=++sequence;loading=true;report();
    try{
      const data=await api('/api/edit?path='+encodeURIComponent(file.path),{headers:{'X-Preview-Token':token}});
      if(ticket!==sequence||selected?.path!==file.path)return;
      state=data;text.value=data.text;document.getElementById('editor-name').textContent=file.name;
      status.textContent='Editing local file · '+data.encoding+' · Save writes to the original file.';
      $('welcome').hidden=true;$('preview').hidden=true;editor.hidden=false;loading=false;controls();text.focus();
    }catch(error){if(ticket===sequence){loading=false;report();toast(error.message);}}
  }
  async function save(){
    if(!state||saving||!dirty())return;const path=state.path;saving=true;status.textContent='Saving…';controls();
    try{
      await api('/api/edit',{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Token':token},body:JSON.stringify({...state,text:text.value})});
      saving=false;reset();await openFile(path);
      if(embedded)parent.postMessage({type:'file-saved',path},location.origin);
    }catch(error){status.textContent=error.message;}
    finally{saving=false;controls();}
  }
  function cancel(){if(!canLeave())return;reset();if(selected)renderPreview();}
  $('edit-toggle').onclick=open;document.getElementById('editor-save').onclick=save;document.getElementById('editor-cancel').onclick=cancel;
  text.addEventListener('input',()=>{controls();});
  text.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();text.setRangeText('    ',text.selectionStart,text.selectionEnd,'end');controls();}});
  document.addEventListener('keydown',event=>{if(!state)return;if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}if(event.key==='Escape'&&!saving){event.preventDefault();cancel();}});
  window.addEventListener('beforeunload',event=>{if(dirty()||saving){event.preventDefault();event.returnValue='';}});
  window.fileEditor={open,save,cancel,reset,canLeave,get editing(){return !!state||loading;}};
})();
