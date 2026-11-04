import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

for (const [mode, id, editorName] of [
  ['clasicos', 'clasico_bubble_sort', 'Código Python'],
  ['contextualizados', '01_inventario_juan', 'Código del archivo seleccionado'],
]) {
  test(`${mode}: marca las pruebas correctas en verde y conserva el check por cuenta`, async ({ page, browser }, testInfo) => {
    await registerStudent(page);
    const path = `/ejercicios/${mode}/`;
    const card = page.locator(`.card-item[data-id="${id}"]`);
    // A legacy browser flag cannot claim a server-verified completion.
    await page.evaluate(id => localStorage.setItem('pylevel_progress', JSON.stringify({ [id]: { completed: true } })), id);
    await page.goto(path);
    await expect(card.getByText('Pendiente', { exact: true })).toBeVisible();
    await card.locator('.card-link').click();
    if (mode === 'contextualizados') await page.getByRole('button', { name: 'Comenzar a resolver proyecto' }).click();
    const editor = page.getByRole('textbox', { name: editorName, exact: true });
    const terminal = page.locator('[data-practice-terminal]');
    const run = page.getByRole('button', { name: '▶ Ejecutar', exact: true });
    const check = page.getByRole('button', { name: 'Probar', exact: true });
    await editor.fill('print(42)');
    await expect(run).toBeEnabled();
    await run.click();
    await expect(page.locator('#result')).toContainText('código 0');
    await expect(terminal).toHaveAttribute('data-feedback', 'neutral');

    await check.click();
    await expect(page.locator('#result')).toHaveText('✓ Correcto · 2 pruebas superadas');
    await expect(terminal).toHaveAttribute('data-feedback', 'correct');
    await expect(terminal).toHaveCSS('border-top-color', 'rgb(52, 211, 153)');
    await expect(terminal).toHaveCSS('border-left-color', 'rgb(52, 211, 153)');
    await expect(page.locator('#practice-progress')).toContainText('Actividad guardada');
    await terminal.scrollIntoViewIfNeeded();
    await terminal.screenshot({ path: testInfo.outputPath('terminal-correcta.png') });

    await editor.fill('FAIL_FIXTURE');
    await expect(terminal).toHaveAttribute('data-feedback', 'neutral');
    await expect(page.locator('#result')).toHaveText('Código modificado · vuelve a probar');
    await check.click();
    await expect(page.locator('#result')).toContainText('Pruebas no superadas');
    await expect(terminal).not.toHaveAttribute('data-feedback', 'correct');

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(card.getByText('Completado', { exact: true })).toBeVisible();
    await expect(card).toHaveAttribute('data-completed', 'true');
    await page.reload();
    await expect(card.getByText('Completado', { exact: true })).toBeVisible();
    const cookie = await page.context().storageState();
    const noJs = await browser.newContext({ storageState: cookie, javaScriptEnabled: false });
    try {
      const otherPage = await noJs.newPage();
      await otherPage.goto(`http://127.0.0.1:4341${path}`);
      await expect(otherPage.locator(`.card-item[data-id="${id}"]`).getByText('Completado', { exact: true })).toBeVisible();
    } finally { await noJs.close(); }
    await card.screenshot({ path: testInfo.outputPath('ejercicio-completado.png') });
    await page.getByRole('button', { name: 'Menú de perfil de usuario' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:4341/');
    await registerStudent(page);
    await page.goto(path);
    await expect(card.getByText('Pendiente', { exact: true })).toBeVisible();
    await expect(card).toHaveAttribute('data-completed', 'false');
  });
}

test('un resultado sin pruebas o una incidencia técnica no muestran Correcto ni completan la tarjeta', async ({ page }) => {
  await registerStudent(page);
  await page.goto('/ejercicios/clasicos/clasico_bubble_sort/');
  const editor = page.getByRole('textbox', { name: 'Código Python', exact: true });
  const check = page.getByRole('button', { name: 'Probar', exact: true });
  await expect(check).toBeEnabled();
  await editor.fill('NO_TESTS_FIXTURE');
  await check.click();
  await expect(page.locator('#result')).toContainText('Pruebas no superadas');
  await expect(page.locator('[data-practice-terminal]')).not.toHaveAttribute('data-feedback', 'correct');
  await editor.fill('TECHNICAL_FIXTURE');
  await check.click();
  await expect(page.locator('#result')).toHaveText('No se pudo ejecutar');
  await page.goto('/ejercicios/clasicos/');
  await expect(page.locator('.card-item[data-id="clasico_bubble_sort"]').getByText('Pendiente', { exact: true })).toBeVisible();
});
