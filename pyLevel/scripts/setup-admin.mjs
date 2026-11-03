import { readFile } from 'node:fs/promises';
import { getDbPool } from '../src/lib/db.ts';
import { seedCatalog } from '../src/admin/catalog-seed.ts';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) throw new Error('Uso: node --experimental-strip-types scripts/setup-admin.mjs correo-de-cuenta-existente');
const pool = getDbPool();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const account = await client.query('SELECT id,is_active FROM users WHERE lower(email)=$1 FOR UPDATE',[email]);
  if (account.rows.length !== 1 || !account.rows[0].is_active) throw new Error('La cuenta debe existir y estar activa.');
  await client.query(await readFile(new URL('../migrations/004_admin.sql',import.meta.url),'utf8'));
  const seeded = await seedCatalog(client);
  await client.query("UPDATE users SET role='admin',updated_at=now() WHERE id=$1",[account.rows[0].id]);
  await client.query('COMMIT');
  console.log(JSON.stringify({admin:email,exercisesAdded:seeded,passwordChanged:false}));
} catch (error) { await client.query('ROLLBACK'); console.error(error.message); process.exitCode=1; }
finally { client.release(); await pool.end(); }
