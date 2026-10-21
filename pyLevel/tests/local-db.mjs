// Isolated, disposable database for HTTP and browser verification. Never loads .env.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

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
const id = randomUUID();
await db.query('INSERT INTO users VALUES ($1, $2, $3, true, now(), now())', [id, 'demo@pylevel.test', await bcrypt.hash('PruebaLocal2026!', 10)]);
await db.query('INSERT INTO profiles (user_id, display_name, avatar_url, bio, updated_at) VALUES ($1, $2, NULL, $3, now())', [id, 'Estudiante de prueba', 'Cuenta temporal para verificar el examen']);
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55439, maxConnections: 8 });
await server.start();
console.log('PostgreSQL temporal listo en 127.0.0.1:55439. Sin persistencia ni datos reales.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.stop(); await db.close(); process.exit(0); });
