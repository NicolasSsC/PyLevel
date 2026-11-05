import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

test('mantiene la precarga de Inicio y abre el login animado solo al solicitarlo', async ({ page }) => {
  await page.goto('/?intro=1');
  await expect(page.getByRole('dialog', { name: 'Precarga de PyLevel' })).toBeVisible();
  await expect(page.locator('#pylevel-prelogin')).toHaveCount(0);
  await expect(page.locator('#top-navbar')).toBeHidden();
  await expect(page.locator('#preload-svg-logo')).toHaveClass(/materialized/);
  await expect(page.locator('#pylevel-preload')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: /Tu próxima/ })).toBeVisible();
  await expect(page.locator('#top-navbar')).toBeVisible();
  await expect(page.locator('#python-home')).not.toHaveAttribute('inert');
  await expect(page.locator('.home-side-menu')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ver intro' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('#pylevel-preload')).toHaveCount(0);
  await expect(page.locator('#prelogin-form')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-login-part="email"]')).toHaveClass(/is-built/);
  await expect(page.locator('[data-login-part="recovery"]')).not.toHaveClass(/is-built/);
  await expect(page.locator('#prelogin-form')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByPlaceholder('Correo')).toBeVisible();
  await expect(page.getByPlaceholder('Clave')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crear cuenta' })).toBeVisible();
  await expect(page.locator('.console-file')).toContainText('login.py');
  await expect(page.locator('.console-language')).toHaveText('Python');
  await expect(page.locator('.console-code')).toContainText('from nicegui import ui');
  await page.getByRole('link', { name: 'Volver a Inicio' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4341/');
  await expect(page.locator('#pylevel-preload')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: /Tu próxima/ })).toBeVisible();
});

test('saltar la precarga libera Inicio y permite navegar al login desde el botón final', async ({ page }) => {
  await page.goto('/?intro=1');
  await page.getByRole('button', { name: 'Saltar precarga (Esc)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Tu próxima/ })).toBeFocused();
  await expect(page.locator('#top-navbar')).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await page.getByRole('link', { name: /Descubre las posibilidades/ }).click();
  await expect(page.getByRole('heading', { name: /Una herramienta/ })).toBeInViewport();
  await page.getByRole('link', { name: /Dale forma a tu primera idea/ }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('el botón de inicio "Empieza a crear" lleva al login', async ({ page }) => {
  await page.goto('/?intro=1');
  await page.getByRole('button', { name: 'Saltar precarga (Esc)' }).click();
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  const createButton = page.getByRole('link', { name: /Empieza a crear/ });
  await expect(createButton).toHaveAttribute('href', '/login');
  await createButton.click();
  await expect(page).toHaveURL(/\/login$/);
});

test('Escape termina la precarga y recuerda la visita a Inicio', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#pylevel-preload')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#top-navbar')).toBeVisible();
  await expect(page.locator('#python-home')).not.toHaveAttribute('inert');
  await page.reload();
  await expect(page.locator('#pylevel-preload')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: /Tu próxima/ })).toBeVisible();
  await expect(page.locator('#pylevel-prelogin')).toHaveCount(0);
});

test('permite saltar y repetir la animación únicamente en el prelogin', async ({ page }) => {
  await page.goto('/prelogin/?intro=1');
  await page.getByRole('button', { name: 'Saltar animación' }).click();
  await expect(page.getByPlaceholder('Correo')).toBeFocused();
  await expect(page.locator('#prelogin-form')).not.toHaveAttribute('inert');
  await expect(page.locator('#top-navbar')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Saltar animación' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder('Correo')).toBeFocused();
  await page.goto('/prelogin/');
  await expect(page.locator('#prelogin-form')).toHaveAttribute('aria-busy', 'false', { timeout: 2000 });
});

test('el formulario completo respeta el orden de teclado y permite volver a Inicio', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/prelogin/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByPlaceholder('Correo')).toBeFocused({ timeout: 2000 });
  await page.keyboard.press('Tab');
  await expect(page.getByPlaceholder('Clave')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Crear cuenta' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Olvidé la contraseña' })).toBeFocused();
  await page.getByPlaceholder('Correo').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: 'Volver a Inicio' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('http://127.0.0.1:4341/');
  await expect(page.locator('#top-navbar')).toBeVisible();
});

test('valida los campos, informa sobre recuperación y abre el registro existente', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mutations: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') mutations.push(request.url()); });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByPlaceholder('Correo')).toBeFocused();
  await page.getByPlaceholder('Correo').fill('vista@example.invalid');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByPlaceholder('Clave')).toBeFocused();
  expect(mutations).toEqual([]);
  await page.getByRole('button', { name: 'Olvidé la contraseña' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'La recuperación de contraseña aún no está disponible.' })).toBeVisible();
  await page.getByRole('link', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByRole('heading', { name: 'Crear cuenta', exact: true })).toBeVisible();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`Inicio y acceso siguen accesibles a ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const signin = page.getByRole('link', { name: 'Iniciar sesión' });
    await expect(signin).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.width === 320) {
      // Font metrics differ between Windows and the Linux CI runner.
      for (const font of ['Arial, sans-serif', 'Verdana, sans-serif']) {
        const style = await page.addStyleTag({ content: `:root { --font-sans: ${font}; }` });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Inicio no debe desbordar con ${font}`).toBe(true);
        await expect(signin).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeInViewport({ ratio: 1 });
        await style.evaluate(node => node.parentNode?.removeChild(node));
      }
    }
    await signin.click();
    await expect(page.getByPlaceholder('Correo')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Crear cuenta' })).toBeInViewport();
    expect(await page.locator('#pylevel-prelogin').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.getByRole('link', { name: 'Volver a Inicio' }).click();
    await expect(page.locator('#top-navbar')).toBeVisible();
  });
}

test('sin JavaScript muestra el nuevo acceso con un aviso y conserva el enlace de registro', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4341/');
    await expect(page.locator('#top-navbar')).toBeVisible();
    await expect(page.locator('#pylevel-preload')).toBeHidden();
    await expect(page.locator('#pylevel-prelogin')).toHaveCount(0);
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    const notice = page.locator('noscript .login-message');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Activa JavaScript para iniciar sesión.');
    await expect(page.getByPlaceholder('Correo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/registro$/);
  } finally { await context.close(); }
});

test('Inicio conserva el perfil cuando ya hay sesión iniciada', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await registerStudent(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Menú de perfil de usuario' })).toBeVisible();
  await expect(page.locator('#pylevel-prelogin')).toHaveCount(0);
});
