import { getDbPool } from '../src/lib/db.ts';
import { seedCatalog } from '../src/admin/catalog-seed.ts';

const pool = getDbPool();
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(7263982, 2)');
  const added = await seedCatalog(client);
  await client.query('COMMIT');
  console.log(`Catálogo listo: ${added} ejercicios añadidos. Se conservan los existentes.`);
} catch {
  if (client) await client.query('ROLLBACK');
  console.error('No se pudo preparar el catálogo de ejercicios.');
  process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
