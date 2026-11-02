export const prerender = false;

import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { getDbPool } from '../../../lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

// GET: Listar administradores registrados
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDbPool();
    const res = await db.query(
      `SELECT u.id, u.email, u.created_at, COALESCE(p.display_name, u.email) AS display_name
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.role = 'admin'
       ORDER BY u.created_at ASC`
    );

    const admins = res.rows.map(r => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ success: true, admins }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Error al obtener administradores' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST: Agregar o habilitar un nuevo administrador
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!name) {
      return new Response(JSON.stringify({ success: false, error: 'El nombre es obligatorio.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ success: false, error: 'Ingresa un correo electrónico válido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDbPool();

    // 1. Verificar si ya existe un usuario con este correo
    const existing = await db.query(
      `SELECT u.id, u.email, u.role, p.display_name
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE LOWER(u.email) = $1`,
      [email]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.role === 'admin') {
        return new Response(
          JSON.stringify({
            success: true,
            message: `El usuario ${email} ya cuenta con rol de administrador.`,
            admin: {
              id: existingUser.id,
              email: existingUser.email,
              displayName: existingUser.display_name || name,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Promover a admin
      await db.query(`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1`, [existingUser.id]);
      await db.query(
        `INSERT INTO profiles (user_id, display_name, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()`,
        [existingUser.id, name]
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `El usuario ${email} ha sido habilitado como administrador.`,
          admin: {
            id: existingUser.id,
            email,
            displayName: name,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Si no existe, crear la cuenta de administrador con contraseña inicial
    const passwordHash = await bcrypt.hash('admin123', 10);
    const userId = crypto.randomUUID();
    const now = new Date();

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (id, email, password_hash, is_active, role, created_at, updated_at)
         VALUES ($1, $2, $3, true, 'admin', $4, $4)`,
        [userId, email, passwordHash, now]
      );
      await client.query(
        `INSERT INTO profiles (user_id, display_name, bio, updated_at)
         VALUES ($1, $2, 'Administrador del Sistema', $3)`,
        [userId, name, now]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Administrador ${name} (${email}) registrado y habilitado exitosamente.`,
        admin: {
          id: userId,
          email,
          displayName: name,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Error al agregar administrador' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
