import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function readMigrations(directory = new URL('../migrations/', import.meta.url)) {
  const names = (await readdir(directory)).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error('No se encontraron migraciones SQL.');
  return Promise.all(names.map(async name => {
    // Git checkouts on Windows and Linux must have the same checksum.
    const sql = (await readFile(new URL(name, directory), 'utf8')).replace(/\r\n/g, '\n');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

/** One transaction and a transaction-scoped lock prevent partial or concurrent setup. */
export async function applyMigrations(client, migrations) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '30s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query('SELECT pg_advisory_xact_lock(7263982, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS pylevel_schema_migrations (
      name text PRIMARY KEY, checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query('SELECT name, checksum FROM pylevel_schema_migrations ORDER BY name');
    const known = new Map(migrations.map(migration => [migration.name, migration.checksum]));
    for (const row of applied.rows) {
      if (known.get(row.name) !== row.checksum) {
        throw new Error(`La migración aplicada ${row.name} fue modificada o falta. Crea una nueva migración.`);
      }
    }
    const existing = new Set(applied.rows.map(row => row.name));
    const completed = [];
    for (const migration of migrations) {
      if (existing.has(migration.name)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO pylevel_schema_migrations (name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum]);
      completed.push(migration.name);
    }
    await client.query('COMMIT');
    return completed;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
