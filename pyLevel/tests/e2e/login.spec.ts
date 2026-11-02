import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const [next, expected] of [
  ['/progreso/', '/progreso/'],
  ['/examen/', '/examen/'],
  ['//example.invalid', '/perfil'],
]) {
  test(`el nuevo acceso conserva la sesión y resuelve next=${next}`, async ({ page }) => {
    const student = await registerStudent(page);
    const logout = await page.request.post('/api/auth/logout', { headers: { Origin: 'http://127.0.0.1:4341' } });
    expect(logout.ok()).toBe(true);
    expect((await (await page.request.get('/api/auth/me')).json()).user).toBeNull();
    await page.goto(`/prelogin/?next=${encodeURIComponent(next)}`);
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(new URL(page.url()).searchParams.get('next')).toBe(next);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Acceso de Estudiante' })).toHaveCount(0);
    await page.getByLabel('Correo', { exact: true }).fill(student.email);
    await page.getByLabel('Clave', { exact: true }).fill(student.password);
    await page.getByLabel('Clave', { exact: true }).press('Enter');
    await expect(page).toHaveURL(`http://127.0.0.1:4341${expected}`);
    const session = await page.request.get('/api/auth/me');
    expect((await session.json()).user.email).toBe(student.email);
    await page.reload();
    await expect(page).toHaveURL(`http://127.0.0.1:4341${expected}`);
  });
}

test('evita envíos duplicados y permite reintentar tras un fallo de conexión', async ({ page }) => {
  let requests = 0;
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/auth/login', async route => {
    requests++;
    await pending;
    await route.abort('failed');
  });
  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill('vista@example.invalid');
  await page.getByLabel('Clave', { exact: true }).fill('ClaveIncorrecta!');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  const submitting = page.getByRole('button', { name: 'Iniciando sesión…', exact: true });
  await expect(submitting).toBeDisabled();
  await page.getByLabel('Clave', { exact: true }).press('Enter');
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(page.getByRole('alert')).toContainText('No pudimos conectar.');
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeEnabled();
  await page.unroute('**/api/auth/login');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo iniciar sesión. Verifica tus credenciales');
  await expect(page).toHaveURL(/\/login$/);
});
