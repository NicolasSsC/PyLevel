import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from '../src/lib/session-store.ts';
import { sessionStore, hashToken } from '../src/lib/session-store.ts';
import { validateProfile, updateProfile, todayInBogota } from '../src/account/profile.ts';
import { activityStore, classifyResult } from '../src/account/activity.ts';
import { buildProgress, type CatalogEntry } from '../src/account/progress.ts';
import { executePractice, preparePracticeFiles } from '../src/account/practice.ts';

const pg = new PGlite();
const db: Database = { async query(sql, values) { const result = await pg.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows }; } };
const alice = randomUUID(), bob = randomUUID();
const activity = activityStore(db);
const catalog: CatalogEntry[] = [
  { id: 'first', mode: 'classic', title: 'Lógica', difficulty: 'Fácil', topics: ['Lógica'], href: '/first' },
  { id: 'second', mode: 'contextual', title: 'Inventario', difficulty: 'Medio', topics: ['Validación'], href: '/second' },
];
const exercise = { id: 'first', title: 'Lógica', difficulty: 'Fácil' as const, description: '', level: '', statement: '', expected: '', topics: ['Lógica'], files: { 'main.py': 'pass', 'tests/test_publico.py': 'trusted tests' } };
const profile = { displayName: 'Alicia', email: 'alice@example.test', occupation: 'Estudiante', birthday: '2000-02-29' };

before(async () => {
  await pg.exec(`CREATE TABLE users (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE profiles (user_id uuid PRIMARY KEY REFERENCES users(id), display_name text, bio text, avatar_url text, updated_at timestamptz DEFAULT now());`);
  for (const name of ['001_sessions_exams.sql', '002_profile_progress.sql', '002_profile_progress.sql']) await pg.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  const hash = await bcrypt.hash('CurrentPassword2026!', 4);
  for (const [id, email, name] of [[alice, 'alice@example.test', 'Alice'], [bob, 'bob@example.test', 'Bob']]) {
    await db.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [id, email, hash]);
    await db.query('INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)', [id, name]);
  }
});
after(() => pg.close());

test('birthday validation uses Colombia date and rejects impossible or future dates', () => {
  assert.equal(todayInBogota(new Date('2026-10-19T03:00:00Z')), '2026-10-18');
  assert.equal(validateProfile(profile, '2026-10-18').birthday, '2000-02-29');
  for (const birthday of ['2025-02-29', '2026-10-19', '2026-13-01', '1899-01-01']) assert.throws(() => validateProfile({ ...profile, birthday }, '2026-10-18'));
  assert.throws(() => validateProfile({ ...profile, occupation: 42 }));
  assert.throws(() => validateProfile({ ...profile, displayName: '   ' }));
  assert.throws(() => validateProfile({ ...profile, email: 'invalid' }));
  assert.equal(validateProfile({ ...profile, occupation: '', birthday: '' }).birthday, null);
});

test('profile persists name, occupation and birthday for the authenticated user only', async () => {
  await pg.transaction(async tx => { await updateProfile(tx as unknown as Database, alice, validateProfile(profile), 'a'.repeat(64)); });
  const row = (await db.query("SELECT display_name, occupation, to_char(birthday, 'YYYY-MM-DD') AS birthday FROM profiles WHERE user_id = $1", [alice])).rows[0];
  assert.deepEqual(row, { display_name: 'Alicia', occupation: 'Estudiante', birthday: '2000-02-29' });
  assert.equal((await db.query('SELECT display_name FROM profiles WHERE user_id = $1', [bob])).rows[0].display_name, 'Bob');
});

test('email changes require the current password, reject duplicates and revoke other sessions', async () => {
  const sessions = sessionStore(db);
  const keep = await sessions.create(alice), other = await sessions.create(alice);
  const change = (email: string, currentPassword: string) => pg.transaction(tx => updateProfile(tx as unknown as Database, alice, validateProfile({ ...profile, email, currentPassword }), hashToken(keep)));
  await assert.rejects(change('new@example.test', 'wrong'), /contraseña actual/);
  await assert.rejects(change('bob@example.test', 'CurrentPassword2026!'), /ya está registrado/);
  assert.equal((await db.query('SELECT email FROM users WHERE id = $1', [alice])).rows[0].email, 'alice@example.test');
  await change('new@example.test', 'CurrentPassword2026!');
  assert.equal(await sessions.find(keep), alice);
  assert.equal(await sessions.find(other), null);
  assert.equal((await db.query('SELECT email FROM users WHERE id = $1', [alice])).rows[0].email, 'new@example.test');
});

test('zero tests, failed tests, timeouts and runs cannot claim a completed exercise', () => {
  assert.equal(classifyResult('test', { status: 'completed', exit_code: 0, output: 'Ran 0 tests in 0.0s\n\nOK\n' }).result, 'failed');
  assert.equal(classifyResult('test', { status: 'completed', exit_code: 1, output: 'Ran 2 tests in 0.1s\nFAILED\n' }).result, 'failed');
  assert.equal(classifyResult('test', { status: 'timeout', exit_code: -1, output: '' }).result, 'technical_error');
  assert.equal(classifyResult('test', { status: 'completed', exit_code: 0, output: 'Ran 1 test in 0.1s\n\nOK\n' }).testsRun, 1);
});

test('practice progress uses canonical test files for both exercise modalities', () => {
  const files = preparePracticeFiles(exercise, 'test', { 'main.py': 'answer', 'tests/test_publico.py': 'tampered' });
  assert.equal(files['tests/test_publico.py'], 'trusted tests');
  assert.equal(files['main.py'], 'answer');
  assert.throws(() => preparePracticeFiles(exercise, 'test', { 'main.py': 'answer', 'other.py': 'unexpected' }));
});

test('progress records actual runner results, deduplicates events and preserves completion after retries', async () => {
  const id = randomUUID();
  await activity.record(alice, 'first', 'classic', 'hint', id);
  await activity.record(alice, 'first', 'classic', 'hint', id);
  const run = (action: 'run' | 'test', output: string, exit_code = 0) => executePractice({ db, userId: alice, exercise, mode: 'classic', action, files: exercise.files, signal: new AbortController().signal,
    async run() { return { status: 'completed', exit_code, output }; } });
  await run('run', '42');
  await run('test', 'Ran 0 tests in 0.0s\n\nOK\n');
  assert.equal(buildProgress(await activity.read(alice), catalog).completed.length, 0);
  await run('test', 'Ran 2 tests in 0.1s\n\nOK\n');
  await run('test', 'Ran 2 tests in 0.1s\n\nOK\n');
  await run('test', 'Ran 2 tests in 0.1s\nFAILED\n', 1);
  const progress = buildProgress(await activity.read(alice), catalog);
  assert.equal(progress.completed.length, 1);
  assert.equal(progress.attempts, 5);
  assert.equal(progress.hints, 1);
  assert.equal(progress.percentage, 50);
  assert.equal(progress.inProgress, 0);
  assert.equal(progress.topics.find(t => t.name === 'Lógica')!.completed, 1);
  assert.equal(buildProgress(await activity.read(bob), catalog).attempts, 0);
});

test('runner failures stay technical, guests do not acquire user progress, and feedback reflects recorded evidence', async () => {
  await assert.rejects(executePractice({ db, userId: alice, exercise: { ...exercise, id: 'second' }, mode: 'contextual', action: 'test', files: exercise.files, signal: new AbortController().signal,
    async run() { throw new Error('unavailable'); } }));
  const data = await activity.read(alice);
  const progress = buildProgress(data, catalog);
  assert.equal(progress.technicalErrors, 1);
  assert.equal(progress.completed.length, 1);
  assert.ok(progress.feedback.some(f => f.title === 'Hay incidencias del ejecutor'));
  const before = (await db.query('SELECT count(*) AS total FROM practice_activity')).rows[0].total;
  await executePractice({ db, userId: null, exercise, mode: 'classic', action: 'test', files: exercise.files, signal: new AbortController().signal,
    async run() { return { status: 'completed', exit_code: 0, output: 'Ran 2 tests in 0.1s\n\nOK\n' }; } });
  assert.equal((await db.query('SELECT count(*) AS total FROM practice_activity')).rows[0].total, before);
  const empty = buildProgress(await activity.read(bob), catalog);
  assert.equal(empty.feedback[0].title, 'Tu progreso empieza con una práctica');
  assert.equal(empty.percentage, 0);
});
