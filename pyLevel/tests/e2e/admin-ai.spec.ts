import { expect, test } from '@playwright/test';
import { generatedDraft, generationInput } from '../../src/admin/ai-draft';
import { registerStudent } from './helpers';

const headers = { Origin: 'http://127.0.0.1:4341' };
const request = { mode: 'classic', tema: 'Sumas', difficulty: 'Medio' };
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('the generator is absent from both catalogs and the server restricts generation to administrators', async ({ page }) => {
  for (const mode of ['clasicos', 'contextualizados']) {
    await page.goto(`/ejercicios/${mode}/`);
    await expect(page.locator('#open-ai-modal-btn, #ai-generator-modal')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Crear.*con IA/ })).toHaveCount(0);
  }
  for (const path of ['/api/ai/generate-challenge', '/api/ai/generate-project']) expect((await page.request.post(path, { headers, data: {} })).status()).toBe(404);
  expect((await page.request.post('/api/admin/exercises/generate', { headers, data: request })).status()).toBe(401);
  await registerStudent(page);
  expect((await page.request.post('/api/admin/exercises/generate', { headers, data: request })).status()).toBe(403);
  await page.request.post('/api/auth/login', { headers, data: { email: 'admin@pylevel.test', password: 'AdminLocal2026!' } });
  expect((await page.request.post('/api/admin/exercises/generate', { headers: { Origin: 'https://other.invalid' }, data: request })).status()).toBe(403);
  expect((await page.request.post('/api/admin/exercises/generate', { headers, data: { ...request, tema: '' } })).status()).toBe(400);
});

for (const mode of ['classic', 'contextual'] as const) {
  test(`an administrator reviews an AI ${mode} draft before saving it to the real catalog`, async ({ page }) => {
    await page.request.post('/api/auth/login', { headers, data: { email: 'admin@pylevel.test', password: 'AdminLocal2026!' } });
    const raw = mode === 'classic'
      ? { success: true, reto: { titulo: 'Sumas generadas', descripcion: 'Practica sumas.', enunciado: 'Implementa sumar(a, b).', nombre_funcion: 'sumar', codigo_inicial: 'def sumar(a, b):\n    pass\n', casos_prueba: [{ entrada: [1, 2], esperado: 3, visible: true }] } }
      : { success: true, proyecto: { nombre: 'Proyecto generado', descripcion: 'Practica módulos.', enunciado: 'Implementa una reserva.', temas: ['POO'], criterios_aceptacion: ['La reserva devuelve 42.'], archivos: { 'main.py': 'from model import valor\nprint(valor)\n', 'model.py': 'valor = 42\n' }, test_runner: 'import json\nprint(json.dumps({"exito": True}))\n' } };
    const draft = generatedDraft(raw, generationInput({ ...request, mode }));
    // The provider response is controlled here; authentication and catalog persistence are real.
    await page.route('**/api/admin/exercises/generate', async route => {
      expect(route.request().postDataJSON()).toEqual({ ...request, mode });
      await route.fulfill({ status: 200, json: { exercise: draft, source: 'gemini' } });
    });
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Crear Nuevo Ejercicio', exact: true }).click();
    await page.locator('#form-mode').selectOption(mode);
    await page.locator('#form-difficulty').selectOption('Medio');
    await page.getByLabel('Tema del ejercicio', { exact: true }).fill('Sumas');
    await page.getByRole('button', { name: 'Generar borrador con IA', exact: true }).click();
    await expect(page.locator('#form-title')).toHaveValue(draft.title);
    expect((await page.request.get(`/api/admin/exercises/${draft.id}`)).status()).toBe(404);
    await page.locator('#form-title').fill('Revisado por administración');
    if (mode === 'contextual') await page.getByLabel('model.py', { exact: true }).fill('valor = 43\n');
    await page.getByRole('button', { name: 'Guardar ejercicio', exact: true }).click();
    await expect(page.locator('#exercise-modal')).not.toBeVisible();
    const saved = (await (await page.request.get(`/api/admin/exercises/${draft.id}`)).json()).exercise;
    expect(saved).toMatchObject({ mode, title: 'Revisado por administración', isAI: true });
    expect(saved.files['tests/test_publico.py']).toBe(draft.files['tests/test_publico.py']);
    if (mode === 'contextual') expect(saved.files['model.py']).toBe('valor = 43\n');
    const path = mode === 'classic' ? 'clasicos' : 'contextualizados';
    expect((await page.request.get(`/ejercicios/${path}/${draft.id}/`)).status()).toBe(200);
    await page.request.delete(`/api/admin/exercises/${draft.id}`, { headers });
  });
}

test('a generation failure keeps the manual draft editable and does not save anything', async ({ page }) => {
  await page.request.post('/api/auth/login', { headers, data: { email: 'admin@pylevel.test', password: 'AdminLocal2026!' } });
  await page.route('**/api/admin/exercises/generate', route => route.fulfill({ status: 503, json: { error: 'El generador no está disponible.' } }));
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Crear Nuevo Ejercicio', exact: true }).click();
  await page.locator('#form-title').fill('Conservar este título');
  await page.getByLabel('Tema del ejercicio', { exact: true }).fill('Listas');
  await page.getByRole('button', { name: 'Generar borrador con IA', exact: true }).click();
  await expect(page.locator('#ai-draft-status')).toHaveText('El generador no está disponible.');
  await expect(page.locator('#form-title')).toHaveValue('Conservar este título');
  await expect(page.locator('#form-title')).toBeEditable();
  await expect(page.getByRole('button', { name: 'Guardar ejercicio', exact: true })).toBeEnabled();
});
