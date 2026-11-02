import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

test('exige consentimiento, guarda una respuesta y entrega el examen sin cámara', async ({ page }) => {
  await registerStudent(page);
  await page.goto('/examen/');
  const start = page.getByRole('button', { name: /Comenzar examen/ });
  await expect(start).toBeVisible();
  await expect(start).toBeDisabled();
  await page.getByText('No puedo usar la cámara', { exact: true }).click();
  await page.getByLabel('Motivo de la dificultad de cámara').selectOption('device');
  const fallback = page.getByRole('button', { name: 'Registrar dificultad y continuar' });
  await expect(fallback).toBeDisabled();
  await page.getByLabel(/Entiendo y acepto este uso de la cámara/).check();
  await fallback.click();
  await expect(start).toBeDisabled();
  await page.getByLabel(/Entiendo que se registran las salidas/).check();
  await start.click();
  const editor = page.getByRole('textbox', { name: 'Tu solución · main.py' });
  await expect(editor).toBeEditable();
  const answer = 'def puede_acceder(tiene_entrada, es_invitado, esta_bloqueado):\n    return (tiene_entrada or es_invitado) and not esta_bloqueado\n';
  await editor.fill(answer);
  await expect(page.locator('#save-state')).toContainText('Guardado ·');

  // Clear drafts on the next document, after beforeunload/pagehide cache them.
  // This ensures recovery uses the server rather than the browser's local copy.
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pylevel:exam:')) localStorage.removeItem(key);
    }
  });
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(editor).toHaveValue(answer);
  await page.getByRole('button', { name: /Revisar y entregar/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Entregar examen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Examen entregado', exact: true })).toBeVisible();
  await expect(page.locator('#result-answers')).toHaveText('1 de 3');
  await expect(page.locator('#result-camera-mode')).toContainText('cámara no disponible');
  await page.goto('/progreso/');
  const exams = page.getByRole('region', { name: 'Mis exámenes', exact: true });
  await expect(exams.getByText('1 finalizado', { exact: true })).toBeVisible();
  await expect(exams.getByText('Pendiente de revisión', { exact: true })).toBeVisible();
  await expect(exams.getByRole('link', { name: 'Ver entrega →' })).toHaveAttribute('href', '/examen/');
  await page.goto('/perfil');
  await expect(page.getByRole('region', { name: 'Mis exámenes', exact: true })).toHaveCount(0);
});
