import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['camera'] });

test('la cámara sigue procesando imágenes al ocultar la preparación durante el examen', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    (window as any).__examFrames = 0;
    const NativeWorker = window.Worker;
    window.Worker = class {
      onmessage: ((event: any) => void) | null = null;
      onerror = null;
      constructor(url: string | URL) {
        if (!String(url).includes('camera-worker.js')) return new NativeWorker(url) as any;
      }
      postMessage(data: any) {
        if (data.type === 'init') setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), 0);
        if (data.type === 'frame') {
          (window as any).__examFrames++;
          data.frame.close();
          setTimeout(() => this.onmessage?.({ data: { type: 'faces', count: 1 } }), 0);
        }
      }
      terminate() { this.onmessage = null; }
    } as any;
  });
  await registerStudent(page);
  await page.goto('/examen/');
  await page.getByLabel(/Entiendo y acepto este uso de la cámara/).check();
  await page.getByRole('button', { name: 'Activar o reconectar cámara', exact: true }).click();
  await expect(page.locator('#camera-status')).toHaveText('Cámara activa · Un rostro detectado');
  await page.getByLabel(/Entiendo que se registran las salidas/).check();
  await page.getByRole('button', { name: /Comenzar examen/ }).click();
  await expect(page.getByRole('region', { name: 'Examen en curso' })).toBeVisible();
  await expect(page.locator('#exam-camera')).toBeHidden();
  await page.evaluate(() => {
    (window as any).__cameraStatusChanges = 0;
    new MutationObserver(() => { (window as any).__cameraStatusChanges++; })
      .observe(document.getElementById('camera-live')!, { childList: true, subtree: true });
  });
  const frames = await page.evaluate(() => (window as any).__examFrames);
  await expect.poll(() => page.evaluate(() => (window as any).__examFrames)).toBeGreaterThan(frames + 3);
  expect(await page.evaluate(() => (window as any).__cameraStatusChanges)).toBe(0);
  expect(await page.evaluate(() => (document.getElementById('camera-preview') as HTMLVideoElement).srcObject instanceof MediaStream)).toBe(true);
  await expect(page.locator('#camera-live')).toHaveText('Cámara activa · Un rostro detectado');
  await page.getByRole('button', { name: 'Revisar cámara', exact: true }).click();
  await expect(page.locator('#exam-camera')).toBeVisible();
  await page.getByRole('button', { name: 'Volver al examen', exact: true }).click();
  await expect(page.locator('#exam-camera')).toBeHidden();
  await page.locator('#exam-workspace').screenshot({ path: testInfo.outputPath('examen-sin-preparacion.png') });
});
