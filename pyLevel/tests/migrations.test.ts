import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { readMigrations, applyMigrations } from '../scripts/migration-runner.mjs';

function connection(db: PGlite) {
  return { query: async (sql: string, params?: unknown[]) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1) };
}

test('a blank database gets the complete schema without accounts; rerunning preserves registered data', async () => {
  const db = await PGlite.create();
  try {
    const migrations = await readMigrations();
    assert.equal((await applyMigrations(connection(db), migrations)).length, 6);
    const tables = await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    for (const name of ['users', 'profiles', 'auth_sessions', 'exam_attempts', 'exam_events', 'practice_activity', 'exercises', 'exercise_versions', 'pylevel_schema_migrations']) {
      assert.ok(tables.rows.some(row => row.tablename === name), name);
    }
    assert.deepEqual((await db.query('SELECT count(*)::int AS count FROM users')).rows, [{ count: 0 }]);
    const id = randomUUID();
    await db.query("INSERT INTO users(id,email,password_hash) VALUES ($1,'registered@example.test','test-hash')", [id]);
    await db.query("INSERT INTO profiles(user_id,display_name,occupation,birthday) VALUES ($1,'Cuenta real','Docente','1990-01-01')", [id]);
    assert.deepEqual(await applyMigrations(connection(db), migrations), []);
    assert.equal((await db.query<{ role: string }>('SELECT role FROM users WHERE id=$1', [id])).rows[0].role, 'user');
    assert.equal((await db.query('SELECT * FROM pylevel_schema_migrations')).rows.length, 6);
  } finally { await db.close(); }
});

test('migration failure rolls back schema and history together', async () => {
  const db = await PGlite.create();
  try {
    const migrations = await readMigrations();
    const sql = 'CREATE TABLE rollback_probe(id int); SELECT missing_column FROM rollback_probe;';
    await assert.rejects(applyMigrations(connection(db), [...migrations, { name: '006_broken.sql', sql, checksum: createHash('sha256').update(sql).digest('hex') }]));
    assert.deepEqual((await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows, []);
    assert.equal((await applyMigrations(connection(db), migrations)).length, 6);
    await assert.rejects(applyMigrations(connection(db), migrations.map((migration: { name: string; checksum: string }) => ({ ...migration, checksum: '0'.repeat(64) }))), /fue modificada/);
    assert.equal((await db.query('SELECT * FROM pylevel_schema_migrations')).rows.length, 6);
  } finally { await db.close(); }
});
