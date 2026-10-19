# Detector local de rostros

- Modelo: MediaPipe BlazeFace short-range, float16, versión 1.
- Fuente oficial: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
- Guía: https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js
- Proyecto y licencia Apache-2.0: https://github.com/google-ai-edge/mediapipe
- SHA-256: `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`

Archivo original, sin modificaciones. Se distribuye con la licencia en `LICENSE`.
El modelo y el runtime se descargan desde el propio sitio. El navegador procesa
las imágenes localmente; la API de examen solamente recibe eventos de actividad.
La cantidad de rostros detectados no acredita identidad ni conducta académica.
