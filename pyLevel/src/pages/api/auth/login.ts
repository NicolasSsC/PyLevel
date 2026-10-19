export const prerender = false;

import type { APIRoute } from 'astro';
import { loginUser } from '../../../lib/db';
import { startSession } from '../../../lib/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 254 || password.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Debes ingresar tu correo y contraseña.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await loginUser({ email, password });

    await startSession(cookies, request, user.id);

    return new Response(JSON.stringify({ ok: true, user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en login:', err);
    return new Response(
      JSON.stringify({ error: 'No se pudo iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
