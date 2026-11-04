import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readMigrations, applyMigrations } from './migration-runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, '../.pgdata');

console.log('Iniciando base de datos PostgreSQL local (PGlite)...');
const db = new PGlite(dataDir);
await db.waitReady;

await applyMigrations({ query: async (sql, params) => params ? db.query(sql, params) : (await db.exec(sql)).at(-1) }, await readMigrations());

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
