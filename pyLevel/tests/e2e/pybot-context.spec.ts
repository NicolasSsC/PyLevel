import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

for (const [mode, id, editorName, file] of [
  ['clasicos', 'clasico_bubble_sort', 'Código Python', 'main.py'],
  ['contextualizados', '01_inventario_juan', 'Código del archivo seleccionado', 'inventario/ventas.py'],
]) {
  test(`PyBot recoge ${mode}, conserva el código ejecutado y detecta cambios posteriores`, async ({ page }) => {
    await registerStudent(page);
    await page.route('**/api/practice/health', route => route.fulfill({ json: { status: 'online' } }));
    await page.route('**/api/practice/execute', route => route.fulfill({ json: { status: 'completed', exit_code: 1, output: `Traceback\n  File "${file}", line 1\nNameError: name 'previous_name' is not defined` } }));
    const contexts: any[] = [];
    await page.route('**/api/ai/chat', route => {
      contexts.push(route.request().postDataJSON());
      return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"token":"Revisemos el código ejecutado."}\n\ndata: [DONE]\n\n' });
    });
    await page.goto(`/ejercicios/${mode}/${id}/`);
    if (mode === 'contextualizados') {
      await page.getByRole('button', { name: 'Comenzar a resolver proyecto' }).click();
      await page.getByRole('button', { name: file, exact: true }).click();
    }
    const editor = page.getByRole('textbox', { name: editorName, exact: true });
    const executed = '# contexto sin recorte a 600 caracteres\n' + '# comentario\n'.repeat(75) + 'print(previous_name)';
    await editor.fill(executed);
    await page.getByRole('button', { name: '▶ Ejecutar', exact: true }).click();
    await expect(page.locator('#result')).toContainText('código 1');
    await page.getByRole('button', { name: 'Abrir asistente de Python PyBot' }).click();
    await expect(page.locator('#pybot-context-title')).toContainText('última ejecución con errores');
    await page.getByRole('button', { name: 'Revisar mi último resultado', exact: true }).click();
    await expect.poll(() => contexts.length).toBe(1);
    const first = contexts[0].contexto;
    expect(first.exerciseId).toBe(id);
    expect(first.selectedFile).toBe(file);
    expect(first.files[file]).toBe(executed);
    expect(first.execution.files[file]).toBe(executed);
    expect(first.execution.output).toContain('NameError');
    expect(first.execution.changedSinceExecution).toBe(false);
    expect(contexts[0].historial).toEqual([]); // Current question is sent once.
    await expect(page.locator('#pybot-messages')).toContainText('Revisemos el código ejecutado.');
    await page.getByRole('button', { name: 'Cerrar chat', exact: true }).click();
    await editor.fill('print(42)');
    await page.getByRole('button', { name: 'Abrir asistente de Python PyBot' }).click();
    await expect(page.locator('#pybot-context-title')).toContainText('código modificado después de ejecutar');
    await page.getByRole('textbox', { name: 'Pregunta para PyBot' }).fill('¿Este cambio arregla el error?');
    await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await expect.poll(() => contexts.length).toBe(2);
    expect(contexts[1].contexto.files[file]).toBe('print(42)');
    expect(contexts[1].contexto.execution.files[file]).toBe(executed);
    expect(contexts[1].contexto.execution.changedSinceExecution).toBe(true);
    await page.goto('/progreso/');
    await page.getByRole('button', { name: 'Abrir asistente de Python PyBot' }).click();
    await expect(page.locator('#pybot-context-title')).toHaveText('Tu progreso y herramientas de PyLevel');
    await page.getByRole('textbox', { name: 'Pregunta para PyBot' }).fill('¿Qué ejercicio me recomiendas?');
    await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await expect.poll(() => contexts.length).toBe(3);
    expect(contexts[2].contexto).toEqual({ page: '/progreso/' });
  });
}

test('el chat real recomienda el catálogo publicado con enlaces y conserva el contrato JSON', async ({ page }) => {
  await registerStudent(page);
  await page.goto('/progreso/');
  await page.getByRole('button', { name: 'Abrir asistente de Python PyBot' }).click();
  await page.getByRole('button', { name: 'Recomiéndame un ejercicio', exact: true }).click();
  await expect(page.locator('#pybot-messages')).toContainText('has superado 0 de 20');
  const links = page.locator('#pybot-messages .bot-bubble a');
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) expect(await link.getAttribute('href')).toMatch(/^\/ejercicios\/(clasicos|contextualizados)\/[a-z0-9_]+\/$/);
  const response = await page.request.post('/api/ai/chat', { headers: { Origin: 'http://127.0.0.1:4341' }, data: { mensaje: 'Recomiéndame un ejercicio', contexto: { page: '/', userId: 'another-account', progress: { completed: 999 } } } });
  expect(response.status()).toBe(200);
  expect((await response.json()).respuesta).toContain('has superado 0 de 20');
  const invalid = await page.request.post('/api/ai/chat', { headers: { Origin: 'http://127.0.0.1:4341' }, data: { mensaje: 'Error', contexto: { page: '/', exerciseId: 'unpublished', mode: 'classic', selectedFile: 'main.py', files: {} } } });
  expect(invalid.status()).toBe(404);
});
