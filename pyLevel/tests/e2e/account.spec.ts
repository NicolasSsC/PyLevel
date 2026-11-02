import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const path of ['/perfil', '/progreso/', '/examen/']) {
  test(`protege ${path} cuando no hay sesión`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(new URL(page.url()).searchParams.get('next')).toBe(path);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
}

test('rechaza una contraseña incorrecta', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo').fill('demo@pylevel.test');
  await page.getByLabel('Clave', { exact: true }).fill('PasswordIncorrecto!');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo iniciar sesión. Verifica tus credenciales');
  await expect(page).toHaveURL(/\/login$/);
});

test('registra una cuenta, conserva la sesión y permite salir e ingresar', async ({ page, context }) => {
  const student = await registerStudent(page);
  const cookie = (await context.cookies()).find(item => item.name === 'pylevel_session');
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' });
  await page.reload();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue(student.email);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4341/');
  await expect(page.getByRole('link', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  await page.goto('/perfil');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel('Correo').fill(student.email);
  await page.getByLabel('Clave', { exact: true }).fill(student.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil\/?$/);
  await expect(page.getByLabel('Nombre completo')).toHaveValue(student.name);
});

test('guarda los datos personales y los conserva al recargar', async ({ page }) => {
  await registerStudent(page);
  await page.getByLabel('Nombre completo').fill('Ana Playwright');
  await page.getByLabel('Ocupación', { exact: true }).fill('Desarrolladora');
  await page.getByLabel('Cumpleaños', { exact: true }).fill('2000-05-21');
  await page.getByRole('button', { name: /Guardar cambios/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tu perfil se guardó correctamente.' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Nombre completo')).toHaveValue('Ana Playwright');
  await expect(page.getByLabel('Ocupación', { exact: true })).toHaveValue('Desarrolladora');
  await expect(page.getByLabel('Cumpleaños', { exact: true })).toHaveValue('2000-05-21');
});

test('separa los datos personales del aprendizaje y muestra el progreso inicial', async ({ page }) => {
  await registerStudent(page);
  await expect(page.getByRole('heading', { name: 'Datos personales', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Avance por temas|Historial de práctica|Mis exámenes/ })).toHaveCount(0);
  await expect(page.locator('.account-page')).not.toContainText('EXÁMENES REALIZADOS');
  await page.goto('/progreso/');
  await expect(page.getByRole('heading', { name: 'Progreso y métricas', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu primer ejercicio te espera' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu progreso empieza con una práctica' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Feedback para tu siguiente paso' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Mis exámenes', exact: true }).getByRole('heading', { name: 'Aún no has realizado exámenes' })).toBeVisible();
  await page.getByRole('link', { name: 'Elegir un ejercicio →', exact: true }).click();
  await expect(page).toHaveURL(/\/ejercicios\/?$/);
});
