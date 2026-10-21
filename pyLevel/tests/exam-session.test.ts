import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { hashToken, sessionStore, type Database } from '../src/lib/session-store.ts';
import { examStore, ExamError } from '../src/exam/store.ts';
import { exam, validateAnswers, validateEvents, validateMonitoring } from '../src/exam/definition.ts';
import { sameOrigin } from '../src/lib/http.ts';
import { createPresenceTracker } from '../src/exam/presence.ts';

const pg = new PGlite();
const db: Database = { async query(sql: string, values?: any[]) { const result = await pg.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows }; } };
const sessions = sessionStore(db);
const exams = examStore(db);

before(async () => {
  await pg.exec('CREATE TABLE users (id text PRIMARY KEY, is_active boolean NOT NULL DEFAULT true)');
  const migration = await readFile(new URL('../migrations/001_sessions_exams.sql', import.meta.url), 'utf8');
  await pg.exec(migration);
  await pg.exec(migration); // Migration is safe to re-run.
  const cameraMigration = await readFile(new URL('../migrations/003_exam_camera.sql', import.meta.url), 'utf8');
  await pg.exec(cameraMigration);
  await pg.exec(cameraMigration);
  await pg.exec("INSERT INTO users (id) VALUES ('alice'), ('bob'), ('disabled')");
});
after(async () => { await pg.close(); });

test('session is opaque, persisted only as a hash, and rejects forged legacy cookies', async () => {
  const token = await sessions.create('alice');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(await sessions.find(token), 'alice');
  const stored = await db.query('SELECT token_hash FROM auth_sessions WHERE user_id = $1', ['alice']);
  assert.equal(stored.rows[0].token_hash, hashToken(token));
  assert.notEqual(stored.rows[0].token_hash, token);
  assert.equal(await sessions.find(JSON.stringify({ id: 'alice' })), null);
  assert.equal(await sessions.find('a'.repeat(64)), null);
  assert.equal(await sessions.find(undefined), null);
});

test('expired, revoked, and inactive-user sessions cannot authenticate', async () => {
  const expired = await sessions.create('alice');
  await db.query("UPDATE auth_sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1", [hashToken(expired)]);
  assert.equal(await sessions.find(expired), null);
  const revoked = await sessions.create('alice');
  await sessions.revoke(revoked);
  assert.equal(await sessions.find(revoked), null);
  const disabled = await sessions.create('disabled');
  await db.query("UPDATE users SET is_active = false WHERE id = 'disabled'");
  assert.equal(await sessions.find(disabled), null);
});

test('CSRF protection requires the exact request origin', () => {
  const request = (origin?: string) => new Request('https://pylevel.example/api/exam/attempt', { method: 'POST', headers: origin ? { origin } : {} });
  assert.equal(sameOrigin(request('https://pylevel.example')), true);
  assert.equal(sameOrigin(request('https://other.example')), false);
  assert.equal(sameOrigin(request('null')), false);
  assert.equal(sameOrigin(request()), false);
});

test('exam starts once per user; resuming cannot reset the deadline', async () => {
  const first = await exams.start('alice');
  const second = await exams.start('alice');
  assert.equal(first!.id, second!.id);
  assert.equal(first!.expiresAt, second!.expiresAt);
  assert.equal(Math.round((Date.parse(first!.expiresAt) - Date.parse(first!.startedAt)) / 60000), exam.durationMinutes);
  assert.equal(await exams.read('unknown-user'), null);
});

test('answers persist, stale revisions conflict, and another user cannot access the attempt', async () => {
  const attempt = (await exams.read('alice'))!;
  const saved = (await exams.sync('alice', { attemptId: attempt.id, submit: false, answers: { acceso: 'return True' }, revision: 0, events: [] }))!;
  assert.equal(saved.answers.acceso, 'return True');
  assert.equal(saved.revision, 1);
  await assert.rejects(exams.sync('alice', { attemptId: attempt.id, submit: false, answers: { acceso: 'overwrite' }, revision: 0, events: [] }), (error: unknown) => error instanceof ExamError && error.status === 409);
  await assert.rejects(exams.sync('bob', { attemptId: attempt.id, submit: false, answers: {}, revision: 1, events: [] }), (error: unknown) => error instanceof ExamError && error.status === 404);
  assert.equal((await exams.read('alice'))!.answers.acceso, 'return True');
});

test('beacon retries deduplicate incidents and heartbeats do not overwrite answers or revision', async () => {
  const attempt = (await exams.read('alice'))!;
  const event = { id: randomUUID(), kind: 'away' as const, source: 'visibility' as const };
  const data = { attemptId: attempt.id, submit: false, events: [event] };
  await exams.sync('alice', data);
  const saved = (await exams.sync('alice', data))!;
  assert.equal(saved.incidents, 1);
  assert.equal(saved.revision, attempt.revision);
  assert.deepEqual(saved.answers, attempt.answers);
  assert.equal(saved.events.length, 1);
});

test('submission is immutable and retrying a delivery is idempotent', async () => {
  const attempt = (await exams.read('alice'))!;
  const data = { attemptId: attempt.id, submit: true, answers: { acceso: 'final answer' }, revision: attempt.revision, events: [] };
  const submitted = (await exams.sync('alice', data))!;
  assert.equal(submitted.status, 'submitted');
  const retry = (await exams.sync('alice', { ...data, answers: { acceso: 'late overwrite' } }))!;
  assert.equal(retry.status, 'submitted');
  assert.equal(retry.answers.acceso, 'final answer');
  assert.equal(retry.submittedAt, submitted.submittedAt);
  assert.equal((await exams.start('alice'))!.id, attempt.id);
});

test('camera consent, technical alternatives and episode durations persist without changing answers', async () => {
  const monitoring = validateMonitoring({ mode: 'camera', consent: true });
  const attempt = (await exams.start('camera-user', monitoring))!;
  assert.equal(attempt.cameraMode, 'camera');
  assert.ok(attempt.cameraConsentAt);
  const id = randomUUID();
  const episode = (durationMs: number) => ({ id, kind: 'camera_missing' as const, source: 'camera' as const, durationMs });
  await exams.sync('camera-user', { attemptId: attempt.id, submit: false, events: [episode(5000)] });
  await exams.sync('camera-user', { attemptId: attempt.id, submit: false, events: [episode(13000)] });
  const saved = (await exams.sync('camera-user', { attemptId: attempt.id, submit: false, events: [episode(5000)] }))!;
  assert.equal(saved.cameraIncidents, 1);
  assert.equal(saved.incidents, 0);
  assert.equal(saved.events[0].durationMs, 13000);
  assert.deepEqual(saved.answers, {});
  assert.equal(saved.revision, 0);
  const other = (await exams.start('camera-other', monitoring))!;
  await exams.sync('camera-other', { attemptId: other.id, submit: false, events: [episode(20000)] });
  assert.equal((await exams.read('camera-user'))!.events[0].durationMs, 13000);
  assert.equal((await exams.read('camera-other'))!.cameraIncidents, 0);
  const alternative = (await exams.sync('camera-user', { attemptId: attempt.id, submit: false, events: [], monitoring: validateMonitoring({ mode: 'unavailable', consent: true, reason: 'device' }) }))!;
  assert.equal(alternative.cameraMode, 'unavailable');
  assert.equal(alternative.cameraUnavailableReason, 'device');
  await exams.sync('camera-user', { attemptId: attempt.id, submit: true, events: [], answers: {}, revision: 0 });
  await exams.sync('camera-user', { attemptId: attempt.id, submit: false, events: [episode(25000)] });
  assert.equal((await exams.read('camera-user'))!.events[0].durationMs, 13000);
});

test('legacy attempts accept camera events only after consent; malformed camera payloads are rejected', async () => {
  const attempt = (await exams.start('legacy-camera'))!;
  const event = { id: randomUUID(), kind: 'camera_interrupted' as const, source: 'camera' as const, durationMs: 0 };
  await assert.rejects(exams.sync('legacy-camera', { attemptId: attempt.id, submit: false, events: [event] }), /condiciones/);
  const saved = (await exams.sync('legacy-camera', { attemptId: attempt.id, submit: false, events: [event], monitoring: { mode: 'camera', consent: true } }))!;
  assert.equal(saved.cameraIncidents, 1);
  for (const invalid of [{ ...event, durationMs: -1 }, { ...event, durationMs: 7200001 }, { ...event, durationMs: '5000' }, { ...event, source: 'focus' }, { ...event, kind: 'away' }]) assert.throws(() => validateEvents([invalid]));
  assert.throws(() => validateMonitoring({ mode: 'camera', consent: false }));
  assert.throws(() => validateMonitoring({ mode: 'unavailable', consent: true }));
  assert.throws(() => validateMonitoring({ mode: 'unavailable', consent: true, reason: 'anything' }));
});

test('server rejects answers after expiry, including when browser tries to submit them', async () => {
  const attempt = (await exams.start('bob'))!;
  await db.query("UPDATE exam_attempts SET expires_at = clock_timestamp() - interval '1 minute' WHERE id = $1", [attempt.id]);
  const late = (await exams.sync('bob', { attemptId: attempt.id, submit: true, answers: { pares: 'too late' }, revision: 0, events: [] }))!;
  assert.equal(late.status, 'expired');
  assert.deepEqual(late.answers, {});
  assert.equal(late.submittedAt, late.expiresAt);
  assert.equal((await exams.start('bob'))!.status, 'expired');
});

test('simultaneous transactions cannot both save the same revision', async () => {
  const attempt = (await exams.start('concurrent'))!;
  const save = (code: string) => pg.transaction(async tx => {
    const store = examStore({ async query(sql, values) { const result = await tx.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows }; } });
    return store.sync('concurrent', { attemptId: attempt.id, submit: false, answers: { acceso: code }, revision: 0, events: [] });
  });
  const results = await Promise.allSettled([save('first'), save('second')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const rejected = results.find(r => r.status === 'rejected');
  assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof ExamError && rejected.reason.status === 409);
  assert.equal((await exams.read('concurrent'))!.revision, 1);
});

test('answer and event validation limits untrusted payloads', () => {
  assert.throws(() => validateAnswers({ unknown: 'code' }));
  assert.throws(() => validateAnswers({ acceso: 'a'.repeat(12001) }));
  assert.throws(() => validateAnswers({ acceso: 123 }));
  assert.throws(() => validateAnswers([]));
  assert.throws(() => validateEvents([{ id: 'invalid', kind: 'away', source: 'visibility' }]));
  assert.throws(() => validateEvents(Array(41).fill({ id: randomUUID(), kind: 'away', source: 'visibility' })));
  assert.deepEqual(validateAnswers({ acceso: 'def test(): pass' }), { acceso: 'def test(): pass' });
});

test('blur, hidden and pagehide count as one departure; a genuine return allows a new episode', () => {
  const events: string[] = [];
  const presence = createPresenceTracker((kind, source) => events.push(`${kind}:${source}`));
  assert.equal(presence.leave('focus'), true);
  assert.equal(presence.leave('visibility'), false);
  assert.equal(presence.leave('pagehide'), false);
  assert.equal(presence.resume(false, true, 'focus'), false);
  assert.equal(presence.resume(true, false, 'visibility'), false);
  assert.equal(presence.resume(true, true, 'focus'), true);
  assert.equal(presence.resume(true, true, 'visibility'), false);
  assert.deepEqual(events, ['away:focus', 'return:focus']);
  assert.equal(presence.leave('visibility'), true);
  assert.equal(presence.away, true);
});

test('restoring an interrupted page records only its return, without duplicating the saved departure', () => {
  const events: string[] = [];
  const presence = createPresenceTracker(kind => events.push(kind));
  presence.restore(true);
  assert.equal(presence.resume(true, true, 'resume'), true);
  assert.deepEqual(events, ['return']);
  assert.equal(presence.away, false);
});
