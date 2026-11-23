# Local camera vision dependencies

MediaPipe Tasks Vision 1.2.0, Apache-2.0.
Source: https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-1.2.0.tgz
Bundled files: vision_bundle.js and SIMD / non-SIMD JS + WebAssembly runtime.
License: LICENSE (upstream https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE).
No runtime CDN or cloud requests are used by this app.

Models from Google's official MediaPipe model repository, fixed version 1:
- models/face.tflite: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
- models/person.tflite: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/1/selfie_segmenter_landscape.tflite

Model guides:
https://developers.google.com/edge/mediapipe/solutions/vision/face_detector
https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter

SHA-256 of bundled runtime and models:

```
b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f  models/face.tflite
490e9ea734313e0de10fa0cd9e3c6133e36ea4db2b7a49bde9ef019f72796b8e  models/person.tflite
97fc2ec9c4d5d7809274881528b99675c7f4d63d55cddd14988877de2025ac24  vision_bundle.js
85c1a342be70427987f900969a5f26e17557351111364e6585e97fb03e93e108  wasm/vision_wasm_internal.js
bcc13df22d3d69ec8cbe8e280989356d844ae00f4523eb82072d2484f44134dc  wasm/vision_wasm_internal.wasm
e9b2b799e0f1078f5538b300a57835b823742c37e2646308a03f0f25b39fdcdc  wasm/vision_wasm_nosimd_internal.js
ed5e5e5812490bd90d6a440290845ff9e4c516f696847a28a0c0e0573470d469  wasm/vision_wasm_nosimd_internal.wasm
```
