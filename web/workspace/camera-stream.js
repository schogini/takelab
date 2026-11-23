'use strict';
const cameraSettingsAPI=typeof module!=='undefined'&&module.exports?require('./camera-settings.js').CameraSettings:CameraSettings;
function cameraErrorMessage(error){
  if(['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error?.name))return 'Camera access was blocked. Allow cameras for this local app, then click Start again.';
  if(['NotFoundError','DevicesNotFoundError'].includes(error?.name))return 'No camera found. Connect a camera, refresh the list, and try again.';
  if(['NotReadableError','TrackStartError'].includes(error?.name))return 'This camera is busy or unavailable. Choose another camera or close the app using it.';
  if(error?.name==='OverconstrainedError')return 'The selected camera is unavailable. Choose another camera and try again.';
  if(error?.name==='AbortError')return 'Camera startup was interrupted. Click Start to try again.';
  return 'Could not start this camera. Choose a connected camera and try again.';
}
class CameraCapture{
  constructor(mediaDevices,onUpdate=()=>{}){this.mediaDevices=mediaDevices;this.onUpdate=onUpdate;this.stream=null;this.status='off';this.epoch=0;}
  publish(status,error=''){this.status=status;this.onUpdate({status,error,stream:this.stream});}
  stop(message=''){
    ++this.epoch;const old=this.stream;this.stream=null;
    if(old)old.getTracks().forEach(track=>track.stop());
    this.publish('off',message);
  }
  async start(deviceId='',quality={}){
    this.stop();const ticket=this.epoch;
    if(!this.mediaDevices?.getUserMedia){this.publish('error','Camera access requires a supported browser on localhost or HTTPS.');return false;}
    this.publish('starting');
    const video=cameraSettingsAPI.quality(quality);
    if(deviceId)video.deviceId={exact:deviceId};
    try{
      const stream=await this.mediaDevices.getUserMedia({video,audio:false});
      if(ticket!==this.epoch){stream.getTracks().forEach(track=>track.stop());return false;}
      this.stream=stream;
      if(quality.resolution==='max'||!quality.resolution){
        const track=stream.getVideoTracks()[0];
        try{if(track?.applyConstraints&&track.getCapabilities)await track.applyConstraints(cameraSettingsAPI.quality({...quality,resolution:'max'},track.getCapabilities()));}catch{} // Keep the successfully opened native mode when negotiation fails.
        if(ticket!==this.epoch){stream.getTracks().forEach(track=>track.stop());return false;}
      }
      if(!stream.getVideoTracks().some(track=>track.readyState!=='ended')){stream.getTracks().forEach(track=>track.stop());this.stream=null;this.publish('error','The camera returned no live video. Choose another camera.');return false;}
      this.stream=stream;
      for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(this.stream===stream)this.stop('Camera disconnected. Choose a camera and click Start again.');},{once:true});
      this.publish('live');return true;
    }catch(error){if(ticket===this.epoch)this.publish('error',cameraErrorMessage(error));return false;}
  }
}
if(typeof module!=='undefined'&&module.exports)module.exports={CameraCapture,cameraErrorMessage};
