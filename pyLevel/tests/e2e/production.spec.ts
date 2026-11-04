import { expect, test } from '@playwright/test';
import { registerStudent } from './helpers';

const headers = { Origin: 'http://127.0.0.1:4341' };
test('code execution requires a real session and rejects cross-origin requests', async ({ request }) => {
  expect((await request.post('/api/practice/execute', { headers, data: {} })).status()).toBe(401);
  expect((await request.post('/api/practice/execute', { headers: { Origin: 'https://other.invalid' }, data: {} })).status()).toBe(403);
});
test('readiness checks the real database without exposing configuration', async ({ request }) => {
  const response = await request.get('/api/ready');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  expect(response.headers()['cache-control']).toContain('no-store');
});

test('PyBot requires a session, rejects external origins and applies persisted limits before calling the provider', async ({ page }) => {
  for (const path of ['/api/ai/chat', '/api/ai/hint']) {
    expect((await page.request.post(path, { headers, data: {} })).status()).toBe(401);
  }
  await registerStudent(page);
  expect((await page.request.post('/api/ai/chat', { headers: { Origin: 'https://other.invalid' }, data: {} })).status()).toBe(403);
  // Invalid requests exercise the real counter without spending provider credits.
  for (let i = 0; i < 10; i++) {
    expect((await page.request.post('/api/ai/chat', { headers, data: { mensaje: '' } })).status()).toBe(400);
  }
  const limited = await page.request.post('/api/ai/chat', { headers, data: { mensaje: 'Python' } });
  expect(limited.status()).toBe(429);
  expect(limited.headers()['retry-after']).toBe('60');
});
