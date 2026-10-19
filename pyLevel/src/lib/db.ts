import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Asegurar carga de variables de entorno en cualquier contexto de ejecución
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (pool) return pool;

  const rawHost = process.env.PGHOST || process.env.DB_HOST || 'dpg-db8p7oivcj2c73ano9e0-a.ohio-postgres.render.com';
  const host = rawHost.trim();
  const port = parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10);
  const user = (process.env.PGUSER || process.env.DB_USER || 'pylevel_user').trim();
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD || '';
  const database = (process.env.PGDATABASE || process.env.DB_NAME || 'pylevel').trim();

  pool = new Pool({
    host,
    port,
    user,
    password,
    database,
    // Explicit opt-out is limited to local development/test databases.
    ssl: process.env.DB_SSL === 'false' && ['127.0.0.1', 'localhost', '::1'].includes(host)
      ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  occupation: string | null;
  birthday: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Registra un nuevo usuario en PostgreSQL Render
 * Inserta en tabla `users` (con hash bcrypt) y tabla `profiles`.
 */
export async function registerUser(params: {
  email: string;
  password: string;
  displayName: string;
  bio?: string;
}): Promise<UserProfile> {
  const email = params.email.trim().toLowerCase();
  const displayName = params.displayName.trim();
  const bio = params.bio?.trim() || 'Estudiante de Ingeniería de Software en PyLevel';

  if (!email || !email.includes('@')) {
    throw new Error('El correo electrónico no es válido.');
  }

  if (!params.password || params.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  if (!displayName) {
    throw new Error('El nombre para mostrar es obligatorio.');
  }

  const db = getDbPool();

  // Verificar si ya existe
  const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
  if (existing.rows.length > 0) {
    throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
  }

  // Cifrado de contraseña con bcrypt (cost factor 10)
  const passwordHash = await bcrypt.hash(params.password, 10);
  const userId = crypto.randomUUID();
  const now = new Date();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (id, email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, $4, $4)
       RETURNING id, email, is_active, created_at`,
      [userId, email, passwordHash, now]
    );

    await client.query(
      `INSERT INTO profiles (user_id, display_name, avatar_url, bio, updated_at)
       VALUES ($1, $2, NULL, $3, $4)`,
      [userId, displayName, bio, now]
    );

    await client.query('COMMIT');

    const createdUser = userRes.rows[0];
    return {
      id: createdUser.id,
      email: createdUser.email,
      displayName,
      avatarUrl: null,
      bio,
      occupation: null,
      birthday: null,
      isActive: createdUser.is_active,
      createdAt: createdUser.created_at.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Autentica un usuario verificando hash bcrypt en PostgreSQL Render
 */
export async function loginUser(params: {
  email: string;
  password: string;
}): Promise<UserProfile> {
  const email = params.email.trim().toLowerCase();

  if (!email || !params.password) {
    throw new Error('Debes ingresar tu correo electrónico y contraseña.');
  }

  const db = getDbPool();

  const res = await db.query(
    `SELECT u.id, u.email, u.password_hash, u.is_active, u.created_at,
            p.display_name, p.avatar_url, p.bio, p.occupation, to_char(p.birthday, 'YYYY-MM-DD') AS birthday
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     WHERE LOWER(u.email) = $1`,
    [email]
  );

  if (res.rows.length === 0) {
    throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
  }

  const row = res.rows[0];

  if (!row.is_active) {
    throw new Error('Tu cuenta se encuentra inactiva. Contacta al administrador.');
  }

  const isPasswordValid = await bcrypt.compare(params.password, row.password_hash);
  if (!isPasswordValid) {
    throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email.split('@')[0],
    avatarUrl: row.avatar_url,
    bio: row.bio,
    occupation: row.occupation,
    birthday: row.birthday,
    isActive: row.is_active,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Obtiene el perfil de un usuario por su ID
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  const db = getDbPool();
  const res = await db.query(
    `SELECT u.id, u.email, u.is_active, u.created_at,
            p.display_name, p.avatar_url, p.bio, p.occupation, to_char(p.birthday, 'YYYY-MM-DD') AS birthday
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     WHERE u.id = $1`,
    [userId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email.split('@')[0],
    avatarUrl: row.avatar_url,
    bio: row.bio,
    occupation: row.occupation,
    birthday: row.birthday,
    isActive: row.is_active,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}
