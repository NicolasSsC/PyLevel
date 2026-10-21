import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Ensure .env is loaded
dotenv.config();

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!pool) {
    const host = (process.env.PGHOST || process.env.DB_HOST || '').trim();
    const database = process.env.PGDATABASE || process.env.DB_NAME || 'pylevel';
    const user = process.env.PGUSER || process.env.DB_USER || 'pylevel_user';
    const password = process.env.PGPASSWORD || process.env.DB_PASSWORD || '';
    const port = parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10);

    pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  initials: string;
}

export function getInitials(name: string): string {
  if (!name) return 'PL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function getDefaultUser(): Promise<UserProfile> {
  try {
    const db = getDbPool();
    const result = await db.query(`
      SELECT 
        u.id,
        u.email,
        COALESCE(p.display_name, split_part(u.email, '@', 1)) AS display_name,
        p.avatar_url,
        COALESCE(p.bio, 'Estudiante de Python') AS bio
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.is_active = true
      ORDER BY u.created_at ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        initials: getInitials(row.display_name),
      };
    }
  } catch (err) {
    console.warn('Could not query user from PostgreSQL, using fallback:', err);
  }

  // Graceful fallback
  return {
    id: 'default',
    email: 'estudiante@pylevel.dev',
    displayName: 'Estudiante Python',
    avatarUrl: null,
    bio: 'Resolviendo retos de lógica en PyLevel',
    initials: 'EP',
  };
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const db = getDbPool();
    const result = await db.query(`
      SELECT 
        u.id,
        u.email,
        COALESCE(p.display_name, split_part(u.email, '@', 1)) AS display_name,
        p.avatar_url,
        COALESCE(p.bio, 'Estudiante de Python') AS bio
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.is_active = true
      ORDER BY u.created_at ASC
    `);

    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      initials: getInitials(row.display_name),
    }));
  } catch (err) {
    console.warn('Could not query users list from PostgreSQL:', err);
    return [];
  }
}
