import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('conserva las notificaciones leídas entre secciones, recargas y pestañas', async ({ page, context }) => {
  await registerStudent(page);
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.locator('#unread-count-text')).toHaveText('2 nuevas');

  const otherTab = await context.newPage();
  try {
    await otherTab.goto('/progreso/');
    await expect(otherTab.getByRole('button', { name: 'Notificaciones', exact: true })).toBeVisible();
    await expect(otherTab.locator('#notif-badge')).toHaveText('2');
    await page.getByRole('button', { name: 'Marcar leídas', exact: true }).click();
    await expect(page.locator('#notif-badge')).toBeHidden();
    await expect(page.locator('#notif-list .unread')).toHaveCount(0);
    await expect(otherTab.locator('#notif-badge')).toBeHidden();
    await otherTab.getByRole('button', { name: 'Notificaciones', exact: true }).click();
    await expect(otherTab.locator('#unread-count-text')).toHaveText('0 nuevas');
  } finally { await otherTab.close(); }

  await page.getByRole('navigation', { name: 'Mi cuenta', exact: true }).getByRole('link', { name: 'Progreso y métricas' }).click();
  await expect(page.locator('#notifications-btn')).toBeVisible();
  await expect(page.locator('#notif-badge')).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.locator('#unread-count-text')).toHaveText('0 nuevas');
  await expect(page.getByRole('button', { name: 'Marcar leídas', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Ejercicios', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.locator('#unread-count-text')).toHaveText('0 nuevas');
  await page.goBack();
  await expect(page.locator('#notifications-btn')).toBeVisible();
  await expect(page.locator('#notif-badge')).toBeHidden();
});

test('cada cuenta conserva su propio estado al salir y volver a iniciar sesión', async ({ page }) => {
  const first = await registerStudent(page);
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar leídas', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4341/');

  await registerStudent(page);
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.locator('#unread-count-text')).toHaveText('2 nuevas');
  await expect(page.locator('#notif-list .unread')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4341/');
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByLabel('Correo', { exact: true }).fill(first.email);
  await page.getByLabel('Clave', { exact: true }).fill(first.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil\/?$/);
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.locator('#unread-count-text')).toHaveText('0 nuevas');
  await expect(page.locator('#notif-badge')).toBeHidden();
});
