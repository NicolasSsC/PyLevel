import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('sin sesión Ejercicios y Examen quedan ocultos junto a su submenú', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('.nav-links');
  for (const path of ['/ejercicios/', '/examen/']) {
    const link = nav.locator(`[data-session-link="${path}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toBeHidden();
    await expect(link).not.toHaveAttribute('href');
    await expect(link).toHaveAttribute('tabindex', '-1');
    await expect(link).toHaveAttribute('title', 'Inicia sesión para acceder.');
  }
  await expect(page.locator('.exercises-popover')).toBeHidden();
  await expect(page.locator('#pybot-widget')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeEnabled();
});

test('el menú móvil oculta ejercicios, modalidades y examen sin sesión', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const menu = page.locator('#mobile-drawer');
  for (const name of ['Todos los ejercicios', '</> Ejercicios Clásicos', '{ } Contextualizados', 'Examen de Python']) {
    const link = menu.getByRole('link', { name, exact: true, includeHidden: true });
    await expect(link).toBeHidden();
    await expect(link).not.toHaveAttribute('href');
  }
  await expect(menu.getByRole('link', { name: 'Inicio', exact: true })).toBeEnabled();
  await expect(page.locator('#pybot-widget')).toBeHidden();
});

test('una sesión activa muestra los accesos y salir los oculta, incluso al volver atrás', async ({ page }) => {
  await registerStudent(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link', { name: 'Ejercicios', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Abrir asistente de Python PyBot' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir asistente de Python PyBot' }).click();
  await expect(page.locator('#pybot-chat-panel')).toBeVisible();
  await page.locator('#pybot-close-btn').click();
  await expect(nav.getByRole('link', { name: 'Examen', exact: true })).toHaveAttribute('href', '/examen/');
  await nav.getByRole('link', { name: 'Ejercicios', exact: true }).hover();
  const submenu = page.locator('.exercises-popover');
  await expect(submenu).toBeVisible();
  await expect(submenu.getByRole('menuitem', { name: /Ejercicios Clásicos/ })).toBeEnabled();
  await expect(submenu.getByRole('menuitem', { name: /Contextualizados/ })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.locator('#mobile-drawer').getByRole('link', { name: 'Todos los ejercicios' })).toBeEnabled();
  await expect(page.locator('#mobile-drawer').getByRole('link', { name: 'Examen de Python' })).toBeEnabled();
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.goto('/ejercicios/');
  await expect(page.locator('.nav-links [data-session-link="/ejercicios/"]')).toHaveAttribute('aria-disabled', 'false');
  await page.getByRole('button', { name: 'Menú de perfil de usuario' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4341/');
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/ejercicios\/?$/);
  await expect(page.locator('.nav-links')).toBeHidden();
  await expect(page.locator('#pybot-widget')).toBeHidden();
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.locator('#mobile-drawer').getByRole('link', { name: 'Todos los ejercicios', includeHidden: true })).toBeHidden();
  await expect(page.locator('#mobile-drawer').getByRole('link', { name: 'Examen de Python', includeHidden: true })).toBeHidden();
});

test('los accesos también permanecen ocultos sin JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4341/');
    const nav = page.locator('.nav-links');
    await expect(nav.locator('[data-session-link="/ejercicios/"]')).toBeHidden();
    await expect(nav.locator('[data-session-link="/examen/"]')).toBeHidden();
    await expect(page.locator('#pybot-widget')).toBeHidden();
  } finally { await context.close(); }
});

test('el HTML ya incluye el perfil y PyBot al navegar, sin esperar al cliente', async ({ page, browser }) => {
  const student = await registerStudent(page);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const document = await context.newPage();
    for (const path of ['/', '/ejercicios/', '/ejercicios/clasicos/', '/examen/', '/perfil', '/progreso/']) {
      const response = await document.goto(`http://127.0.0.1:4341${path}`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['cache-control']).toContain('no-store');
      expect(response?.headers()['vary']).toMatch(/Cookie/i);
      await expect(document.locator('#profile-wrapper')).toBeVisible();
      await expect(document.locator('#user-profile-name')).toHaveText('Estudiante');
      await expect(document.locator('#dropdown-email')).toHaveText(student.email);
      await expect(document.locator('.nav-links')).toBeVisible();
      await expect(document.locator('.nav-links [data-session-link="/ejercicios/"]')).toHaveAttribute('href', '/ejercicios/');
      await expect(document.locator('#pybot-widget')).toBeVisible();
      await expect(document.locator('#home-signin-link')).toBeHidden();
      await expect(document.locator('#python-home [data-guest-only]').first()).toBeHidden();
    }
  } finally { await context.close(); }

  const guest = await browser.newContext({ javaScriptEnabled: false });
  try {
    const document = await guest.newPage();
    for (const path of ['/', '/ejercicios/']) {
      const response = await document.goto(`http://127.0.0.1:4341${path}`);
      expect(await response!.text()).not.toContain(student.email);
      await expect(document.locator('#profile-wrapper')).toBeHidden();
      await expect(document.locator('#pybot-widget')).toBeHidden();
    }
  } finally { await guest.close(); }
});

test('suaviza el contenido y conserva los controles al navegar con movimiento permitido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await registerStudent(page);
  await expect(page.locator('#top-navbar')).toHaveCSS('view-transition-name', 'pylevel-navbar');
  await expect(page.locator('#pybot-widget')).toHaveCSS('view-transition-name', 'pylevel-pybot');
  await page.locator('.nav-links').getByRole('link', { name: 'Ejercicios', exact: true }).click();
  await expect(page).toHaveURL(/\/ejercicios\/?$/);
  await expect(page.locator('#user-profile-name')).toHaveText('Estudiante');
  await page.getByRole('button', { name: 'Abrir asistente de Python PyBot' }).click();
  await expect(page.locator('#pybot-chat-panel')).toBeVisible();
  await page.locator('#pybot-close-btn').click();
  await page.locator('.nav-links').getByRole('link', { name: 'Examen', exact: true }).click();
  await expect(page).toHaveURL(/\/examen\/?$/);
  await expect(page.locator('#profile-wrapper')).toBeVisible();
  await expect(page.locator('#pybot-widget')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#top-navbar')).toHaveCSS('view-transition-name', 'none');
});
