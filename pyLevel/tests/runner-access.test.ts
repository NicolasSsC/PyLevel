import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { runnerRequest } from '../src/lib/runner.ts';
import { consumeRunnerAllowance } from '../src/lib/runner-access.ts';
import { readMigrations, applyMigrations } from '../scripts/migration-runner.mjs';

test('runner credentials remain on the server and require HTTPS without redirects or URL credentials', () => {
  const token = 'local-test-runner-credential-32-characters';
  const env = { PYLEVEL_RUNNER_URL: 'https://runner.pylevel.site', PYLEVEL_RUNNER_TOKEN: token };
  const user = randomUUID();
  const request = runnerRequest('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, user, env);
  assert.equal(request.url.href, 'https://runner.pylevel.site/api/execute');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.headers.get('authorization'), `Bearer ${token}`);
  assert.equal(request.options.headers.get('x-pylevel-user-id'), user);
  for (const url of ['http://runner.pylevel.site', 'https://user:password@runner.pylevel.site', 'https://runner.pylevel.site/?key=secret']) {
    assert.throws(() => runnerRequest('/api/health', {}, undefined, { ...env, PYLEVEL_RUNNER_URL: url }));
  }
  assert.throws(() => runnerRequest('/api/health', {}, undefined, { PYLEVEL_RUNNER_URL: env.PYLEVEL_RUNNER_URL }));
  assert.equal(runnerRequest('/api/health', {}, undefined, { PYLEVEL_RUNNER_URL: 'http://127.0.0.1:8787' }).url.protocol, 'http:');
});

test('execution quotas are persisted independently for each account and reject invalid operator limits', async () => {
  const db = await PGlite.create();
  try {
    await applyMigrations({ query: async (sql: string, params?: unknown[]) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1) }, await readMigrations());
    const first = randomUUID(), second = randomUUID();
    for (const id of [first, second]) await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [id, `${id}@test.invalid`, 'test-only']);
    const env = { RUNNER_REQUESTS_PER_MINUTE: '2', RUNNER_REQUESTS_PER_DAY: '3' };
    assert.equal(await consumeRunnerAllowance(db, first, env), true);
    assert.equal(await consumeRunnerAllowance(db, first, env), true);
    assert.equal(await consumeRunnerAllowance(db, first, env), false);
    await db.query("UPDATE runner_request_usage SET window_start=window_start-interval '1 minute' WHERE user_id=$1 AND period='minute'", [first]);
    assert.equal(await consumeRunnerAllowance(db, first, env), true);
    assert.equal(await consumeRunnerAllowance(db, first, env), false);
    assert.equal(await consumeRunnerAllowance(db, second, env), true);
    await assert.rejects(consumeRunnerAllowance(db, first, { RUNNER_REQUESTS_PER_MINUTE: '-1' }));
  } finally { await db.close(); }
});
