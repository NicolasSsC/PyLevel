import { getDbPool } from '../src/lib/db.ts';
import { readMigrations, applyMigrations } from './migration-runner.mjs';

let pool;
try {
  const migrations = await readMigrations();
  pool = getDbPool();
  const client = await pool.connect();
  try {
    const completed = await applyMigrations(client, migrations);
    console.log(completed.length ? `Migraciones aplicadas: ${completed.join(', ')}` : 'La base de PyLevel ya está actualizada.');
  } finally {
    client.release();
  }
} catch {
  console.error('No se pudo aplicar la migración. Verifica la conexión y los permisos de PostgreSQL.');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
