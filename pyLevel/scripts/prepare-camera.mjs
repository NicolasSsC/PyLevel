import { mkdir, copyFile, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const source = new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url);
const target = new URL('../public/vendor/mediapipe/', import.meta.url);
await mkdir(target, { recursive: true });
const model = new URL('../public/models/face-detector/blaze_face_short_range.tflite', import.meta.url);
if (createHash('sha256').update(await readFile(model)).digest('hex') !== 'b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f') throw new Error('El modelo de cámara no coincide con la versión esperada.');
await copyFile(new URL('../public/models/face-detector/LICENSE', import.meta.url), new URL('LICENSE', target));
for (const name of await readdir(source)) {
  if (/\.(js|wasm)$/.test(name)) await copyFile(new URL(name, source), new URL(name, target));
}
await build({
  entryPoints: [fileURLToPath(new URL('../src/exam/camera-worker.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('camera-worker.js', target)),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true,
});
