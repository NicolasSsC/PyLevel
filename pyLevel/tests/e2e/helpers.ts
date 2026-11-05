import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export async function registerStudent(page: Page) {
  const student = {
    name: 'Estudiante Playwright',
    email: `e2e-${randomUUID()}@example.invalid`,
    password: 'PruebaNavegador2026!',
  };
  await page.goto('/registro');
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
  await page.getByLabel('Nombre completo', { exact: true }).fill(student.name);
  await page.getByLabel('Correo', { exact: true }).fill(student.email);
  await page.getByLabel('Clave', { exact: true }).fill(student.password);
  const terms = page.getByRole('checkbox');
  if ((await terms.count()) > 0) {
    await terms.check();
  }
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil\/?$/);
  await expect(page.getByLabel('Nombre completo')).toHaveValue(student.name);
  return student;
}
