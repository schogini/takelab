'use strict';
window.CamtasiaExport={
  async convert(take,status){
    status('Sending the recording to this Mac’s local converter…');
    const state=await fetch('/api/state',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Could not connect to the workspace.');return r.json();});
    const headers={'X-Preview-Token':state.token};
    const check=async response=>{let data;try{data=await response.json();}catch{throw Error('Restart the workspace launcher to enable Camtasia exports.');}if(!response.ok)throw Error(data.error||'Conversion failed.');return data;};
    const fps=take.fps===60?60:30;
    let job=await check(await fetch('/api/recording-export?fps='+fps,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:take.file}));
    while(job.state==='converting'||job.state==='uploading'){
      status(`Converting to ${fps} fps MP4 for Camtasia… Keep this page open. Long recordings can take several minutes.`);
      await new Promise(resolve=>setTimeout(resolve,1000));
      job=await check(await fetch('/api/recording-export/status?id='+encodeURIComponent(job.id),{headers,cache:'no-store'}));
    }
    if(job.state!=='ready')throw Error(job.error||'Conversion failed. The original recording is unchanged.');
    const name=take.name.replace(/\.[^.]+$/,'')+'-camtasia.mp4';
    return {url:'/api/recording-export/download?id='+encodeURIComponent(job.id)+'&name='+encodeURIComponent(name),name,fps};
  }
};
