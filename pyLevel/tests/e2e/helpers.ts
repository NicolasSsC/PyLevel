import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export async function registerStudent(page: Page) {
  const student = {
    name: 'Estudiante Playwright',
    email: `e2e-${randomUUID()}@example.invalid`,
    password: 'PruebaNavegador2026!',
  };
  await page.goto('/registro');
  await page.getByLabel('Nombre y Apellido').fill(student.name);
  await page.getByLabel('Correo Institucional / Personal').fill(student.email);
  await page.getByLabel('Contraseña (mínimo 6 caracteres)').fill(student.password);
  await page.getByRole('button', { name: 'Crear Cuenta de Estudiante' }).click();
  await expect(page).toHaveURL(/\/perfil\/?$/);
  await expect(page.getByLabel('Nombre completo')).toHaveValue(student.name);
  return student;
}
