export const prerender = false;

import type { APIRoute } from 'astro';
import { registerUser } from '../../../lib/db';
import { startSession } from '../../../lib/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password, displayName, bio } = body;

    if (typeof email !== 'string' || typeof password !== 'string' || typeof displayName !== 'string' ||
        !email || !password || !displayName || email.length > 254 || password.length > 200 || displayName.length > 100 ||
        (bio !== undefined && (typeof bio !== 'string' || bio.length > 500))) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios: correo, contraseña y nombre.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await registerUser({ email, password, displayName, bio });

    await startSession(cookies, request, user.id);

    return new Response(JSON.stringify({ ok: true, user }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error en register:', err);
    return new Response(
      JSON.stringify({ error: 'No se pudo crear la cuenta. Verifica los datos o intenta iniciar sesión si ya estás registrado.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
