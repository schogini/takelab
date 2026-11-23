'use strict';
importScripts('/vendor/mediapipe/vision_bundle.js','/workspace/camera-settings.js');
let files,segmenter,detector;
async function prepare(segment,face){
  files ||= await Vision.FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
  if(segment&&!segmenter)segmenter=await Vision.ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'/vendor/mediapipe/models/person.tflite',delegate:'CPU'},runningMode:'VIDEO',outputCategoryMask:false,outputConfidenceMasks:true,canvas:new OffscreenCanvas(480,270)});
  if(face&&!detector)detector=await Vision.FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:'/vendor/mediapipe/models/face.tflite',delegate:'CPU'},runningMode:'VIDEO',minDetectionConfidence:.55,canvas:new OffscreenCanvas(480,270)});
}
self.onmessage=async({data})=>{
  const {id,frame,segment,face,timestamp}=data;
  try{
    await prepare(segment,face);let mask=null,box=null;
    if(segment){segmenter.segmentForVideo(frame,timestamp,result=>{const masks=result.confidenceMasks,person=masks[masks.length>1?1:0];mask={width:person.width,height:person.height,rgba:CameraSettings.alphaMask(person.getAsFloat32Array())};});}
    if(face){const found=detector.detectForVideo(frame,timestamp).detections;const largest=found.sort((a,b)=>b.boundingBox.width*b.boundingBox.height-a.boundingBox.width*a.boundingBox.height)[0]?.boundingBox;if(largest)box={x:largest.originX/frame.width,y:largest.originY/frame.height,width:largest.width/frame.width,height:largest.height/frame.height};}
    self.postMessage({id,mask,face:box},mask?[mask.rgba.buffer]:[]);
  }catch(error){self.postMessage({id,error:String(error?.message||error)});}finally{frame?.close();}
};
