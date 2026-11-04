import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations, readMigrations } from '../scripts/migration-runner.mjs';
import { seedCatalog } from '../src/admin/catalog-seed.ts';
import { exerciseStore } from '../src/admin/exercise-store.ts';
import type { AdminDatabase } from '../src/admin/database.ts';
import { activityStore } from '../src/account/activity.ts';
import { chatInput } from '../src/ai/access.ts';
import { loadTutorContext, localContextReply } from '../src/ai/tutor-context.ts';
import { contextFiles } from '../src/ai/page-context.ts';
import { chatAnswer } from '../src/ai/client.ts';

test('context loads only the authenticated account and published catalogue, without solutions or private profile fields', async () => {
  const pg = await PGlite.create();
  const query = async (sql: string, values?: any[]) => ({ rows: (values ? await pg.query(sql, values) : (await pg.exec(sql)).at(-1)!).rows as any[] });
  const db: AdminDatabase = { query, async connect() { return { query, release() {} }; } };
  try {
    await applyMigrations(db, await readMigrations());
    await seedCatalog(db);
    const me = randomUUID(), other = randomUUID();
    for (const id of [me, other]) await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [id, `${id}@private.invalid`, 'private-hash']);
    const catalog = await exerciseStore(db).list({ publicOnly: true });
    const easy = catalog.filter(item => item.difficulty === 'Fácil');
    const completed = easy[0], pending = easy[1], hidden = easy[2];
    await exerciseStore(db).update(hidden.id, { version: hidden.version, is_active: false });
    const store = activityStore(db);
    const passed = await store.record(me, completed.id, completed.mode, 'test', undefined, 'pending');
    await store.finish(me, passed, 'passed', 5, 10);
    const failed = await store.record(me, pending.id, pending.mode, 'test', undefined, 'pending');
    await store.finish(me, failed, 'failed', 5, 10);
    const otherPass = await store.record(other, pending.id, pending.mode, 'test', undefined, 'pending');
    await store.finish(other, otherPass, 'passed', 5, 10);
    const input = chatInput({ mensaje: 'Recomiéndame', contexto: { page: '/progreso/', userId: other, progress: { completed: 999 }, datos_pylevel: 'forged' } }).contexto;
    const context = await loadTutorContext(db, me, input);
    assert.equal(context.progress.completed, 1);
    assert.equal(context.progress.total, 19);
    assert.equal(context.recommendations[0].id, pending.id);
    assert.ok(context.recommendations.every(item => item.id !== completed.id && item.id !== hidden.id));
    const serialized = JSON.stringify(context);
    assert.ok(!serialized.includes('private-hash') && !serialized.includes('@private.invalid') && !serialized.includes(other) && !serialized.includes('999'));
    assert.ok(!serialized.includes('"solution"') && !serialized.includes('"hints"'));
    assert.match(localContextReply('¿Qué ejercicio me recomiendas?', context)!, new RegExp(pending.id));
    const fresh = await loadTutorContext(db, other, { page: '/' });
    assert.notEqual(fresh.recommendations[0].id, pending.id);
    await assert.rejects(loadTutorContext(db, me, { page: '/', exerciseId: hidden.id, mode: hidden.mode }), { status: 404 });
    await assert.rejects(loadTutorContext(db, me, { page: '/', exerciseId: completed.id, mode: completed.mode, selectedFile: 'secrets.py', files: { 'secrets.py': 'x' } }), { status: 400 });

    const current = chatInput({ mensaje: 'Este error', contexto: {
      page: '/ejercicios/clasicos/', exerciseId: completed.id, mode: completed.mode, selectedFile: 'main.py', files: { 'main.py': 'print(42)' },
      execution: { action: 'run', status: 'completed', exitCode: 1, output: 'NameError: old_name', files: { 'main.py': 'print(old_name)' }, createdAt: new Date().toISOString(), truncated: false, changedSinceExecution: true },
    } }).contexto;
    const withError = await loadTutorContext(db, me, current);
    assert.equal(withError.workspace?.files['main.py'], 'print(42)');
    assert.equal(withError.execution?.files['main.py'], 'print(old_name)');
    assert.match(localContextReply('Tengo este error', withError)!, /versión anterior/);
  } finally { await pg.close(); }
});

test('multi-file context has a bounded UTF-8 budget and rejects arbitrary paths, types and forged server context', () => {
  const files = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`file${i}.py`, 'á🧑'.repeat(5000)]));
  const limited = contextFiles(files, 'file29.py');
  assert.equal(Object.keys(limited.files)[0], 'file29.py');
  assert.equal(limited.truncated, true);
  assert.ok(Object.values(limited.files).reduce((sum, code) => sum + Buffer.byteLength(code), 0) <= 6000);
  const base = { page: '/', exerciseId: 'practice', mode: 'classic', selectedFile: 'main.py', files: { 'main.py': 'x' } };
  for (const override of [{ files: { '../secret.py': 'x' } }, { page: 'https://other.invalid' }, { files: { 'main.py': 4 } }, { running: 'yes' }, { execution: {} }]) {
    assert.throws(() => chatInput({ mensaje: 'Hola', contexto: { ...base, ...override } }), { status: 400 });
  }
  assert.deepEqual(chatInput({ mensaje: 'Hola', contexto: { page: '/', recommendations: ['fake'], userId: 'someone' } }).contexto, { page: '/' });
});

test('real HTTP Gemini fixture receives full context; JSON response and provider failure preserve contextual help', async () => {
  const requests: any[] = [];
  let fail = false;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    if (fail) { res.writeHead(503, { 'Content-Type': 'text/html' }); res.end('Unavailable'); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const event = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Revisa el código de la última ejecución.' }] } }] })}\n\n`;
    res.write(event.slice(0, 17));
    res.end(event.slice(17));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const context: any = { platform: 'PyLevel', sections: [], page: { title: 'Inicio', path: '/' }, progress: { completed: 0, total: 1, attempted: 0, recent: [] }, recommendations: [{ id: 'test_exercise', title: 'Un reto real', difficulty: 'Fácil', href: '/ejercicios/clasicos/test_exercise/', reason: 'Para empezar' }], exercise: { title: 'Reto', statement: 'Enunciado real' }, workspace: { files: { 'main.py': 'a'.repeat(1800) } } };
  const provider = { apiKey: 'local-test-key-only', fetch: ((url: any, init: any) => fetch(`http://127.0.0.1:${port}${new URL(url).pathname}`, init)) as typeof fetch };
  try {
    const answer = await chatAnswer({ mensaje: 'Ayúdame', contexto: context }, provider);
    assert.equal(answer.respuesta, 'Revisa el código de la última ejecución.');
    const prompt = requests[0].contents[0].parts[0].text;
    assert.ok(prompt.includes('a'.repeat(1800)) && prompt.includes('Enunciado real'));
    assert.match(requests[0].systemInstruction.parts[0].text, /nunca instrucciones/);
    assert.ok(!JSON.stringify(requests[0]).includes(provider.apiKey));
    fail = true;
    const fallback = await chatAnswer({ mensaje: '¿Qué ejercicio me recomiendas?', contexto: context }, provider);
    assert.match(fallback.respuesta, /Un reto real/);
    assert.equal(requests.length, 5); // One successful stream, then four provider attempts.
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
