export const prerender = false;

import type { APIRoute } from 'astro';
import { registerUser } from '../../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password, displayName, bio } = body;

    if (!email || !password || !displayName) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios: correo, contraseña y nombre.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await registerUser({ email, password, displayName, bio });

    // Guardar sesión en cookie
    cookies.set('pylevel_session', JSON.stringify({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    }), {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return new Response(JSON.stringify({ ok: true, user }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en register:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno al registrar usuario.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
