import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { readMigrations, applyMigrations } from '../scripts/migration-runner.mjs';
import { examCodeInput, examExecutionAccess, examPublicFiles } from '../src/exam/execution.ts';
import { exam } from '../src/exam/definition.ts';
import { examStore } from '../src/exam/store.ts';

test('exam execution requires an owned, active, unexpired attempt with recorded camera consent and never changes answers', async () => {
  const pg = await PGlite.create();
  const db = { async query(sql: string, values?: any[]) { return { rows: (values ? await pg.query(sql, values) : (await pg.exec(sql)).at(-1)!).rows as any[] }; } };
  try {
    await applyMigrations(db, await readMigrations());
    const owner = randomUUID(), other = randomUUID(), legacy = randomUUID();
    for (const id of [owner, other, legacy]) await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [id, `${id}@test.invalid`, 'unused']);
    const attempt = (await examStore(db).start(owner, { mode: 'unavailable', reason: 'device', consent: true }))!;
    const previous = (await db.query('SELECT answers,revision,status,expires_at,last_seen_at FROM exam_attempts WHERE id=$1', [attempt.id])).rows;
    assert.ok(await examExecutionAccess(db, owner, attempt.id) > 0);
    await assert.rejects(examExecutionAccess(db, other, attempt.id), { status: 404 });
    assert.deepEqual((await db.query('SELECT answers,revision,status,expires_at,last_seen_at FROM exam_attempts WHERE id=$1', [attempt.id])).rows, previous);
    const old = (await examStore(db).start(legacy))!;
    await assert.rejects(examExecutionAccess(db, legacy, old.id), { status: 409 });
    await db.query("UPDATE exam_attempts SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [attempt.id]);
    await assert.rejects(examExecutionAccess(db, owner, attempt.id), { status: 409 });
    const submitted = (await examStore(db).start(other, { mode: 'camera', consent: true }))!;
    await db.query("UPDATE exam_attempts SET status='submitted',submitted_at=now() WHERE id=$1", [submitted.id]);
    await assert.rejects(examExecutionAccess(db, other, submitted.id), { status: 409 });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM practice_activity')).rows[0].n, 0);
  } finally { await pg.close(); }
});

test('exam code input is bounded and canonical tests include only the displayed examples for each question', async () => {
  const valid = { attemptId: randomUUID(), questionId: 'acceso', code: 'print(42)' };
  const request = (body: unknown) => new Request('http://localhost/api/exam/execute', { method: 'POST', body: JSON.stringify(body) });
  assert.deepEqual(await examCodeInput(request({ ...valid, files: { 'tests/test_publico.py': 'tampered' }, userId: 'another' })), valid);
  for (const body of [null, [], { ...valid, attemptId: 'bad' }, { ...valid, questionId: 'other' }, { ...valid, code: '' }, { ...valid, code: 'x'.repeat(12001) }]) {
    await assert.rejects(examCodeInput(request(body)), { status: 400 });
  }
  await assert.rejects(examCodeInput(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(48001) })), { status: 413 });
  await assert.rejects(examCodeInput(new Request('http://localhost', { method: 'POST', body: '{' })), { status: 400 });
  const counts = [2, 3, 3];
  for (const [index, question] of exam.questions.entries()) {
    const files = examPublicFiles(question.id, question.starter);
    assert.equal(files['main.py'], question.starter);
    assert.equal((files['tests/test_publico.py'].match(/def test_ejemplo_/g) ?? []).length, counts[index]);
    assert.ok(files['tests/test_publico.py'].startsWith('import unittest\nfrom main import '));
  }
  assert.throws(() => examPublicFiles('__proto__', 'code'), { status: 400 });
});
