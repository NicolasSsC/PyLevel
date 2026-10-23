import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, '../.pgdata');

console.log('Iniciando base de datos PostgreSQL local (PGlite)...');
const db = new PGlite(dataDir);
await db.waitReady;

// Tablas base de usuarios y perfiles
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id),
    display_name text NOT NULL,
    avatar_url text,
    bio text,
    updated_at timestamptz NOT NULL
  );
`);

// Migraciones
const migrationsDir = new URL('../migrations/', import.meta.url);
const names = (await readdir(migrationsDir)).filter(name => name.endsWith('.sql')).sort();
for (const name of names) {
  try {
    const sql = await readFile(new URL(name, migrationsDir), 'utf8');
    await db.exec(sql);
  } catch (err) {
    console.warn(`Nota en migración ${name}:`, err.message);
  }
}

const port = parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10);
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port, maxConnections: 32 });
await server.start();
console.log(`✓ Base de datos PostgreSQL local activa en 127.0.0.1:${port}`);
console.log(`✓ Datos persistentes guardados en: ${dataDir}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log('Deteniendo servidor de base de datos...');
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
