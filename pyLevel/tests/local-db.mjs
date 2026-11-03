// Isolated, disposable database for HTTP and browser verification. Never loads .env.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { seedCatalog } from '../src/admin/catalog-seed.ts';

const db = await PGlite.create();
await db.exec(`CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id), display_name text NOT NULL,
  avatar_url text, bio text, updated_at timestamptz NOT NULL
);`);
await db.exec(await readFile(new URL('../migrations/001_sessions_exams.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/002_profile_progress.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/003_exam_camera.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/004_admin.sql', import.meta.url), 'utf8'));
await seedCatalog(db);
const id = randomUUID();
await db.query('INSERT INTO users (id,email,password_hash,is_active,created_at,updated_at) VALUES ($1, $2, $3, true, now(), now())', [id, 'demo@pylevel.test', await bcrypt.hash('PruebaLocal2026!', 10)]);
await db.query('INSERT INTO profiles (user_id, display_name, avatar_url, bio, updated_at) VALUES ($1, $2, NULL, $3, now())', [id, 'Estudiante de prueba', 'Cuenta temporal para verificar el examen']);
const adminId=randomUUID();
await db.query("INSERT INTO users(id,email,password_hash,is_active,role,created_at,updated_at) VALUES($1,'admin@pylevel.test',$2,true,'admin',now(),now())",[adminId,await bcrypt.hash('AdminLocal2026!',10)]);
await db.query("INSERT INTO profiles(user_id,display_name,updated_at) VALUES($1,'Administrador de pruebas',now())",[adminId]);
const port = Number(process.env.LOCAL_TEST_DB_PORT || 55439);
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port, maxConnections: 8 });
await server.start();
console.log(`PostgreSQL temporal listo en 127.0.0.1:${port}. Sin persistencia ni datos reales.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.stop(); await db.close(); process.exit(0); });
