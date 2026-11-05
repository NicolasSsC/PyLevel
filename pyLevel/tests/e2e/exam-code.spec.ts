import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

const headers = { Origin: 'http://127.0.0.1:4341' };
test('la prueba del examen exige sesión e intento propio y no acepta otro origen', async ({ page, browser }) => {
  expect((await page.request.post('/api/exam/execute', { headers, data: {} })).status()).toBe(401);
  await registerStudent(page);
  expect((await page.request.post('/api/exam/execute', { headers: { Origin: 'https://other.invalid' }, data: {} })).status()).toBe(403);
  const started = await page.request.post('/api/exam/attempt', { headers, data: { action: 'start', monitoring: { mode: 'unavailable', reason: 'device', consent: true } } });
  const { attempt } = await started.json();
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await registerStudent(other);
    const response = await other.request.post('/api/exam/execute', { headers, data: { attemptId: attempt.id, questionId: 'acceso', code: 'pass' } });
    expect(response.status()).toBe(404);
  } finally { await context.close(); }
});

test('muestra fallos y permite reintentar, sin confundir resultados de preguntas diferentes', async ({ page }, testInfo) => {
  await registerStudent(page);
  await page.request.post('/api/exam/attempt', { headers, data: { action: 'start', monitoring: { mode: 'unavailable', reason: 'device', consent: true } } });
  await page.goto('/examen/');
  const editor = page.getByRole('textbox', { name: 'Tu solución · main.py', exact: true });
  const run = page.getByRole('button', { name: 'Probar código', exact: true });
  const panel = page.getByRole('region', { name: 'Resultado de prueba · Control de acceso' });
  await expect(page.locator('#exam-camera')).toBeHidden();
  await editor.fill('FAIL_FIXTURE');
  await run.click();
  await expect(panel).toContainText('FAILED');
  await expect(panel).not.toHaveAttribute('data-state', 'passed');
  await editor.fill('NO_TESTS_FIXTURE');
  await run.click();
  await expect(panel).toContainText('Ran 0 tests');
  await expect(panel).not.toHaveAttribute('data-state', 'passed');
  await editor.fill('TECHNICAL_FIXTURE');
  await run.click();
  await expect(panel).toContainText('No se pudo probar el código');
  await expect(run).toBeEnabled();
  await editor.fill('print(42)');
  await run.click();
  await expect(panel).toContainText('Ejemplos superados');
  await expect(panel).toHaveCSS('border-top-color', 'rgb(52, 211, 153)');
  await editor.fill('SLOW_FIXTURE');
  await expect(panel).toHaveAttribute('data-state', 'changed');
  await run.click();
  await expect(page.getByRole('button', { name: 'Detener prueba' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Suma de números pares', exact: true })).toBeVisible();
  await expect(page.locator('[data-code-output="pares"]')).toBeHidden();
  await expect(run).toBeEnabled();
  await page.getByRole('button', { name: '← Anterior', exact: true }).click();
  await expect(panel).toContainText('Prueba detenida al cambiar de pregunta');
  await editor.fill('print(42)');
  await run.click();
  await expect(panel).toContainText('Ejemplos superados');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(node => {
      const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.right > innerWidth + 1;
    }).slice(0, 12).map(node => ({ tag: node.tagName, id: node.id, className: String(node.className), right: node.getBoundingClientRect().right })),
  }));
  if (mobileLayout.scrollWidth > mobileLayout.width) console.log('Mobile resize layout:', JSON.stringify(mobileLayout));
  // Viewport emulation and the page's resize/render cycle settle asynchronously.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: testInfo.outputPath('prueba-examen-movil.png') });
});
