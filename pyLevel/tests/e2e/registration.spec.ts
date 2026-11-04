import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('la consola construye el registro y permite saltar la animación', async ({ page }) => {
  await page.goto('/registro?intro=1');
  await expect(page.locator('#prelogin-form')).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('button', { name: 'Saltar animación' }).click();
  await expect(page.getByLabel('Nombre completo', { exact: true })).toBeFocused();
  await expect(page.locator('.console-file')).toContainText('registro.py');
  await expect(page.locator('.console-code')).toContainText('ui.select(perfiles');
  await expect(page.locator('#top-navbar')).toHaveCount(0);
  await expect(page.getByText('Registro persistente en PostgreSQL', { exact: false })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Correo', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Clave', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox')).toBeFocused();
});

test('crear una cuenta guarda el perfil elegido y permite corregir un correo duplicado', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const email = `registro-${randomUUID()}@example.invalid`;
  await page.goto('/registro');
  await page.getByLabel('Nombre completo', { exact: true }).fill('Ana Docente');
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Clave', { exact: true }).fill('PruebaRegistro2026!');
  await page.getByRole('combobox', { name: /Cuál es tu perfil/ }).selectOption('Docente');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil\/?$/);
  await expect(page.getByLabel('Ocupación', { exact: true })).toHaveValue('Docente');
  await page.reload();
  await expect(page.getByLabel('Ocupación', { exact: true })).toHaveValue('Docente');
  const session = await page.request.get('/api/auth/me');
  expect((await session.json()).user).toMatchObject({ email, occupation: 'Docente', role: 'user' });
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4341/');
  await page.goto('/registro');
  await page.getByLabel('Nombre completo', { exact: true }).fill('Ana Programadora');
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Clave', { exact: true }).fill('PruebaRegistro2026!');
  await page.getByRole('combobox').selectOption('Programador/a');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo crear la cuenta.');
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
  await expect(page.getByRole('combobox')).toHaveValue('Programador/a');
  await page.getByLabel('Correo', { exact: true }).fill(`registro-${randomUUID()}@example.invalid`);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil\/?$/);
  await expect(page.getByLabel('Ocupación', { exact: true })).toHaveValue('Programador/a');
});

test('el registro rechaza una ocupación inválida antes de crear la cuenta', async ({ page }) => {
  const response = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://127.0.0.1:4341' },
    data: { email: `invalid-${randomUUID()}@example.invalid`, password: 'PruebaRegistro2026!', displayName: 'Ana', occupation: 42 },
  });
  expect(response.status()).toBe(400);
  expect(response.headers()['set-cookie']).toBeUndefined();
});

test('la opción de placeholder "Selecciona tu perfil" no se puede seleccionar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/registro');
  const select = page.getByRole('combobox');
  const placeholderOption = select.locator('option[value=""]');
  await expect(placeholderOption).toBeDisabled();
  await expect(placeholderOption).toHaveAttribute('hidden', '');
  await expect(select).toHaveValue('');
});

for (const width of [320, 390]) {
  test(`el registro sigue accesible a ${width}px sin desplazamiento horizontal`, async ({ page }) => {
    await page.setViewportSize({ width, height: 568 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/registro');
    const occupation = page.getByRole('combobox');
    await occupation.scrollIntoViewIfNeeded();
    await expect(occupation).toBeInViewport({ ratio: 1 });
    await occupation.selectOption('Estudiante');
    await expect(occupation).toHaveValue('Estudiante');
    expect(await page.locator('#pylevel-prelogin').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const create = page.getByRole('button', { name: 'Crear cuenta', exact: true });
    await create.scrollIntoViewIfNeeded();
    await expect(create).toBeInViewport({ ratio: 1 });
    await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
}
