import { expect, test, type Page } from '@playwright/test';

const titles = ['Ejercicios', 'Asistente PyBot', 'Exámenes', 'Progreso'];

async function openJourney(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.addInitScript(() => sessionStorage.setItem('pylevel_preload_seen', 'true'));
  await page.goto('/#que-es-pylevel');
  const journey = page.getByRole('region', { name: 'Herramientas de PyLevel' });
  await expect(journey.getByRole('button', { name: 'Ejercicios', exact: true })).toBeVisible();
  const geometry = await page.locator('#pylevel-journey').evaluate(node => {
    const stage = node.querySelector<HTMLElement>('.journey-stage')!;
    const stickyTop = parseFloat(getComputedStyle(stage).top);
    return { start: window.scrollY + node.getBoundingClientRect().top - stickyTop, range: (node as HTMLElement).offsetHeight - stage.offsetHeight, stickyTop };
  });
  await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), geometry.start + 8);
  return { journey, geometry };
}

test('el scroll amplía los cuatro conceptos y permite retroceder', async ({ page }) => {
  const { journey, geometry } = await openJourney(page);
  const title = page.getByRole('heading', { name: '¿Qué es PyLevel?', exact: true });
  await expect(title).toBeInViewport();
  const initialTitle = await title.boundingBox();
  await expect(journey.getByRole('heading', { name: titles[0], exact: true })).toBeVisible();
  for (let i = 1; i < titles.length; i++) {
    await page.mouse.wheel(0, Math.ceil(geometry.range / (titles.length - 1)));
    await expect(journey.getByRole('heading', { name: titles[i], exact: true })).toBeVisible();
    await expect(journey.getByRole('button', { name: titles[i], exact: true })).toHaveAttribute('aria-expanded', 'true');
    const box = await page.locator('.journey-stage').boundingBox();
    expect(Math.abs(box!.y - geometry.stickyTop)).toBeLessThan(3);
    await expect(title).toBeInViewport();
    expect(Math.abs((await title.boundingBox())!.y - initialTitle!.y)).toBeLessThan(3);
  }
  await page.mouse.wheel(0, -Math.ceil(geometry.range / (titles.length - 1)));
  await expect(journey.getByRole('heading', { name: 'Exámenes', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: /Las grandes ideas/ }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: /Las grandes ideas/ })).toBeInViewport();
});

test('los selectores funcionan con teclado y el contenido es únicamente informativo', async ({ page }) => {
  const { journey } = await openJourney(page);
  const button = journey.getByRole('button', { name: 'Progreso', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(journey.getByRole('heading', { name: 'Progreso', exact: true })).toBeVisible();
  await expect(button).toBeFocused();
  await journey.getByRole('button', { name: 'Asistente PyBot', exact: true }).click();
  await expect(journey.getByRole('heading', { name: 'Asistente PyBot', exact: true })).toBeVisible();
  await expect(journey.locator('article a, article button')).toHaveCount(0);
  await expect(journey.getByText('Sigue bajando para descubrir cada herramienta.')).toHaveCount(0);
});

test('móvil conserva las cuatro explicaciones sin ocultar contenido ni desbordar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('pylevel_preload_seen', 'true'));
  await page.goto('/#que-es-pylevel');
  const journey = page.getByRole('region', { name: 'Herramientas de PyLevel' });
  await expect(journey.getByRole('heading', { level: 3 })).toHaveCount(4);
  for (const title of titles) {
    const heading = journey.getByRole('heading', { name: title, exact: true });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeInViewport();
    await expect(page.getByRole('heading', { name: '¿Qué es PyLevel?', exact: true })).toBeInViewport();
  }
  await expect(journey.getByRole('button')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('los capítulos ocupan la pantalla y el ajuste de scroll respeta movimiento reducido', async ({ page }) => {
  await openJourney(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toMatch(/^y(?: proximity)?$/);
  const dimensions = await page.locator('[data-page-panel]').evaluateAll(nodes => ({
    available: innerHeight - document.getElementById('top-navbar')!.offsetHeight,
    heights: nodes.map(node => node.getBoundingClientRect().height),
  }));
  for (const height of dimensions.heights) expect(height).toBeGreaterThanOrEqual(dimensions.available - 1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('none');
});

test('movimiento reducido y redimensionado devuelven todos los artículos al flujo de lectura', async ({ page }) => {
  const { journey } = await openJourney(page);
  await journey.getByRole('button', { name: 'Exámenes', exact: true }).click();
  await expect(journey.getByRole('heading', { name: 'Exámenes', exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(journey.getByRole('heading', { level: 3 })).toHaveCount(4);
  await expect(journey.getByRole('button')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(journey.getByRole('button', { name: 'Progreso', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(journey.getByRole('heading', { level: 3 })).toHaveCount(4);
  await expect(journey.locator('article[inert]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('sin JavaScript los cuatro conceptos siguen disponibles', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4341/#que-es-pylevel');
    const journey = page.getByRole('region', { name: 'Herramientas de PyLevel' });
    await expect(journey.getByRole('heading', { level: 3 })).toHaveCount(4);
    await expect(journey.getByRole('button')).toHaveCount(0);
    for (const title of titles) await expect(journey.getByRole('heading', { name: title, exact: true })).toBeVisible();
  } finally { await context.close(); }
});
