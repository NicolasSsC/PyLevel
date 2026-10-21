import { readFile, readdir } from 'node:fs/promises';
import { getDbPool } from '../src/lib/db.ts';

const pool = getDbPool();
try {
  const directory = new URL('../migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  const sql = (await Promise.all(names.map(name => readFile(new URL(name, directory), 'utf8')))).join('\n');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migraciones de PyLevel aplicadas.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} catch {
  console.error('No se pudo aplicar la migración. Verifica la conexión y los permisos de PostgreSQL.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
