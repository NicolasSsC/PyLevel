import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { databaseConfig } from './db-config.ts';

// Asegurar carga de variables de entorno en cualquier contexto de ejecución
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env'), quiet: true });

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (pool) return pool;

  pool = new Pool(databaseConfig(process.env));
  pool.on('error', () => {
    console.error('Se perdió una conexión inactiva con PostgreSQL. El siguiente acceso intentará reconectar.');
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
  role: 'admin' | 'user';
  createdAt: string;
}

/**
 * Registra un nuevo usuario en PostgreSQL.
 * Inserta en tabla `users` (con hash bcrypt) y tabla `profiles`.
 */
export async function registerUser(params: {
  email: string;
  password: string;
  displayName: string;
  bio?: string;
  occupation?: string;
}): Promise<UserProfile> {
  const email = params.email.trim().toLowerCase();
  const displayName = params.displayName.trim();
  const bio = params.bio?.trim() || 'Aprendiendo Python en PyLevel';
  const occupation = params.occupation?.trim() || null;

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
      `INSERT INTO profiles (user_id, display_name, avatar_url, bio, occupation, updated_at)
       VALUES ($1, $2, NULL, $3, $4, $5)`,
      [userId, displayName, bio, occupation, now]
    );

    await client.query('COMMIT');

    const createdUser = userRes.rows[0];
    return {
      id: createdUser.id,
      email: createdUser.email,
      displayName,
      avatarUrl: null,
      bio,
      occupation,
      birthday: null,
      isActive: createdUser.is_active,
      role: 'user',
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
    `SELECT u.id, u.email, u.password_hash, u.is_active, u.created_at, COALESCE(to_jsonb(u)->>'role','user') AS role,
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
    role: row.role === 'admin' ? 'admin' : 'user',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Obtiene el perfil de un usuario por su ID
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  const db = getDbPool();
  const res = await db.query(
    `SELECT u.id, u.email, u.is_active, u.created_at, COALESCE(to_jsonb(u)->>'role','user') AS role,
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
    role: row.role === 'admin' ? 'admin' : 'user',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}
