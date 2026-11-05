import { expect, test } from '@playwright/test';

const storageKey = 'pylevel:cookie-notice';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('recuerda la aceptación al recargar, navegar y en otras pestañas', async ({ page, context }) => {
  await page.goto('/');
  const banner = page.getByRole('region', { name: 'Tu privacidad en PyLevel' });
  await expect(banner).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();

  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.goto('/login');
  await expect(other.locator('#cookie-banner')).toBeVisible();
  await banner.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await expect(banner).toBeHidden();
  await expect(other.locator('#cookie-banner')).toBeHidden();

  await page.reload();
  await expect(banner).toBeHidden();
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('#cookie-banner')).toBeHidden();
  await page.goBack();
  await expect(banner).toBeHidden();
  await other.close();
});

test('explica el almacenamiento en móvil y permite consultarlo después de aceptar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Más información' }).click();
  const details = page.getByRole('dialog', { name: 'Cookies y almacenamiento' });
  await expect(details).toBeVisible();
  await expect(details).toContainText('pylevel_session');
  await expect(details).toContainText('6 meses');
  const bounds = await details.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
  await expect(page.getByRole('button', { name: 'Más información' })).toBeFocused();
  await expect(page.locator('#cookie-banner')).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await page.locator('.home-footer').getByRole('button', { name: 'Cookies y almacenamiento', exact: true }).click();
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(details).toBeHidden();
  await expect(page.locator('#cookie-banner')).toBeHidden();
});

test('mantiene la aceptación durante la sesión si el almacenamiento persistente está bloqueado', async ({ page }) => {
  await page.addInitScript(key => {
    const originalSet = Storage.prototype.setItem;
    const originalGet = Storage.prototype.getItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) throw new DOMException('Blocked', 'SecurityError');
      return originalSet.call(this, name, value);
    };
    Storage.prototype.getItem = function (name) {
      if (this === localStorage && name === key) throw new DOMException('Blocked', 'SecurityError');
      return originalGet.call(this, name);
    };
  }, storageKey);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await page.reload();
  await expect(page.locator('#cookie-banner')).toBeHidden();
  await expect(page.getByPlaceholder('Correo')).toBeVisible();
});

test('un registro dañado o antiguo permite volver a aceptar el aviso', async ({ page }) => {
  await page.goto('/login');
  for (const value of ['invalid-json', JSON.stringify({ version: 1, acceptedAt: Date.now() - 181 * 86400000 })]) {
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    }, { key: storageKey, value });
    await page.reload();
    await expect(page.locator('#cookie-banner')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
    await expect(page.locator('#cookie-banner')).toBeHidden();
  }
});
