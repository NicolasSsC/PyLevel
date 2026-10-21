import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detector: FaceDetector | null = null;
const scope = self as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (data: unknown) => void };
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const files = await FilesetResolver.forVisionTasks('/vendor/mediapipe');
      detector = await FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: '/models/face-detector/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: .65,
      });
      scope.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        const result = detector!.detectForVideo(data.frame, data.timestamp);
        scope.postMessage({ type: 'faces', count: result.detections.length });
      } finally { data.frame.close(); }
    }
  } catch { scope.postMessage({ type: 'error' }); }
};
