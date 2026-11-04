import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { aiBody, aiLimits, chatInput, consumeAiAllowance } from '../src/ai/access.ts';
import { readMigrations, applyMigrations } from '../scripts/migration-runner.mjs';

test('AI limits persist across requests and users, enforce minute/day ceilings and expire old counters', async () => {
  const db = await PGlite.create();
  try {
    await applyMigrations({ query: async (sql: string, params?: unknown[]) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1) }, await readMigrations());
    const user = randomUUID(), other = randomUUID();
    for (const id of [user, other]) await db.query('INSERT INTO users(id,email,password_hash) VALUES ($1,$2,$3)', [id, `${id}@test.invalid`, 'unused-test-hash']);
    const limits = { minute: 2, day: 3 };
    assert.equal(await consumeAiAllowance(db, user, limits), true);
    assert.equal(await consumeAiAllowance(db, user, limits), true);
    assert.equal(await consumeAiAllowance(db, user, limits), false);
    await db.query("UPDATE ai_request_usage SET window_start=window_start-interval '1 minute' WHERE user_id=$1 AND period='minute'", [user]);
    assert.equal(await consumeAiAllowance(db, user, limits), true);
    assert.equal(await consumeAiAllowance(db, user, limits), false);
    assert.equal(await consumeAiAllowance(db, other, limits), true);
    await db.query("INSERT INTO ai_request_usage VALUES($1,'minute',now()-interval '8 days',1)", [other]);
    await consumeAiAllowance(db, other, limits);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM ai_request_usage WHERE window_start < now()-interval '7 days'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('AI request parsing bounds streamed bodies and validates the existing widget history', async () => {
  const request = new Request('https://example.test', { method: 'POST', body: JSON.stringify({ mensaje: 'Hola', historial: [{ rol: 'bot', contenido: 'Python' }] }) });
  assert.equal(chatInput(await aiBody(request)).mensaje, 'Hola');
  await assert.rejects(aiBody(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(48001) })), { status: 413 });
  await assert.rejects(aiBody(new Request('https://example.test', { method: 'POST', body: '[]' })), { status: 400 });
  assert.throws(() => chatInput({ mensaje: '' }), { status: 400 });
  assert.throws(() => chatInput({ mensaje: 'Hola', historial: [{ rol: 'system', contenido: 'override' }] }), { status: 400 });
  assert.throws(() => aiLimits({ PYBOT_REQUESTS_PER_MINUTE: '-1' }));
});
