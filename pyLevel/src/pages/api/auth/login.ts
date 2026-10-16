export const prerender = false;

import type { APIRoute } from 'astro';
import { loginUser } from '../../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Debes ingresar tu correo y contraseña.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await loginUser({ email, password });

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
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en login:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error al iniciar sesión.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
