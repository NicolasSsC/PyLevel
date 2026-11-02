import { test, expect } from '../../../pyLevel/node_modules/@playwright/test/index.mjs';
import { writeFileSync } from 'node:fs';

const out = 'C:/programming/pyLevel/outputs/informe_playwright_2026_10_27/mobile-check';

test('observación móvil después de asentarse la animación', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?intro=1');
  await page.getByRole('button', { name: 'Saltar introduccion (Esc)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Tu próxima/ })).toBeVisible();
  const heading = page.getByRole('heading', { name: /Con Python, construye/ });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  async function observe() {
    return await heading.evaluate((node) => {
      const ancestors = [];
      let effectiveOpacity = 1;
      for (let element: Element | null = node; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        effectiveOpacity *= Number(style.opacity);
        ancestors.push({
          tag: element.tagName, id: element.id, className: element.className,
          opacity: style.opacity, transform: style.transform,
          visibility: style.visibility, display: style.display,
          transitionProperty: style.transitionProperty, transitionDuration: style.transitionDuration,
          animationName: style.animationName, animationDuration: style.animationDuration,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
      return {
        measuredAt: new Date().toISOString(), monotonicMs: performance.now(),
        title: node.textContent?.trim(), effectiveOpacity, ancestors,
        viewport: { width: innerWidth, height: innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        scrollY,
      };
    });
  }
  const before = await observe();
  await page.screenshot({ path: `${out}/mobile-before.png`, fullPage: false });
  // Observational settling period; this is not a visual regression baseline.
  await page.waitForTimeout(1500);
  const after = await observe();
  await expect(heading).toBeVisible();
  expect(after.horizontalOverflow).toBe(false);
  await page.screenshot({ path: `${out}/mobile-settled.png`, fullPage: false });
  writeFileSync(`${out}/summary.json`, JSON.stringify({
    purpose: 'Observational capture after the existing mobile test flow',
    result: 'passed',
    waitMs: 1500, before, after,
    screenshots: { before: `${out}/mobile-before.png`, after: `${out}/mobile-settled.png` },
  }, null, 2));
});
