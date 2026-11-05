import { expect, test } from '@playwright/test';

const documents = [
  '/manual-de-usuario',
  '/terminos-y-condiciones',
  '/politica-de-uso-aceptable',
  '/politica-de-privacidad',
  '/politica-de-cookies',
];

test('el footer abre la documentación, las políticas y las preguntas frecuentes', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('pylevel_preload_seen', 'true'));
  await page.goto('/');
  const footer = page.locator('.home-footer');
  for (const path of documents) {
    await expect(footer.locator(`a[href="${path}"]`)).toHaveCount(1);
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
  }
  await footer.getByRole('link', { name: 'Preguntas frecuentes' }).click();
  await expect(page).toHaveURL(/manual-de-usuario#seccion-8-1$/);
  const firstQuestion = page.locator('.faq-accordion-trigger').first();
  await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');
  const panel = page.locator(`[id="${await firstQuestion.getAttribute('aria-controls')}"]`);
  await expect(panel).toBeVisible();
  await firstQuestion.click();
  await expect(panel).toBeHidden();
});

for (const width of [320, 390]) {
  test(`el footer y sus documentos se pueden leer a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('pylevel_preload_seen', 'true'));
    for (const path of ['/', ...documents]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      if (path !== '/') {
        const index = page.locator('.mobile-toc-details');
        await index.locator('summary').click();
        await expect(index.locator('nav')).toBeVisible();
      }
    }
  });
}

test('el manual del administrador permite alternar, buscar y abrir enlaces directos', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    headers: { Origin: 'http://127.0.0.1:4341' },
    data: { email: 'admin@pylevel.test', password: 'AdminLocal2026!' },
  });
  expect(login.status()).toBe(200);
  await page.goto('/admin/manual/');
  await expect(page.locator('#manual-section-admin')).toBeVisible();
  await expect(page.locator('#manual-section-tecnico')).toBeHidden();
  await page.getByRole('tab', { name: 'Manual Oficial de Software: PyLevel' }).click();
  await expect(page.locator('#manual-section-tecnico')).toBeVisible();
  await expect(page.locator('#manual-section-admin')).toBeHidden();
  const search = page.getByRole('searchbox', { name: 'Buscar en el manual' });
  await search.fill('BlazeFace');
  await expect(page.locator('.doc-topic:visible').first()).toContainText('BlazeFace');
  await search.fill('zzzz_sin_coincidencias_zzzz');
  await expect(page.getByText('No se encontraron secciones con esa búsqueda.')).toBeVisible();
  await search.fill('');
  await expect(page.locator('#manual-section-tecnico')).toBeVisible();
  await page.goto('/admin/manual/#tec-cap-4-1');
  await expect(page.locator('#manual-section-tecnico')).toBeVisible();
  await expect(page.locator('#tec-cap-4-1')).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
