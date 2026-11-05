export const prerender = false;

import type { APIRoute } from 'astro';
import { registerUser } from '../../../lib/db';
import { startSession } from '../../../lib/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password, displayName, bio, occupation, acceptedTerms, termsVersion, termsAcceptedAt } = body;

    // Validación de aceptación obligatoria de términos y políticas
    if (acceptedTerms === false) {
      return new Response(
        JSON.stringify({ error: 'Debes aceptar los Términos, Políticas y autorizar el tratamiento de datos para crear una cuenta.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof email !== 'string' || typeof password !== 'string' || typeof displayName !== 'string' ||
        !email || !password || !displayName || email.length > 254 || password.length > 200 || displayName.length > 100 ||
        (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) ||
        (occupation !== undefined && (typeof occupation !== 'string' || occupation.length > 100))) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios: correo, contraseña y nombre.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await registerUser({ email, password, displayName, bio, occupation });

    // Registro seguro de auditoría de autorización legal
    const consentDate = typeof termsAcceptedAt === 'string' && termsAcceptedAt ? termsAcceptedAt : new Date().toISOString();
    const consentVersion = typeof termsVersion === 'string' && termsVersion ? termsVersion : '1.0';
    console.info(`[AUDIT-LEGAL] Consentimiento registrado: userId=${user.id}, version=${consentVersion}, fecha=${consentDate}`);

    await startSession(cookies, request, user.id);

    return new Response(JSON.stringify({
      ok: true,
      user,
      termsAccepted: {
        version: consentVersion,
        acceptedAt: consentDate,
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error en register:', err);
    return new Response(
      JSON.stringify({ error: 'No se pudo crear la cuenta. Verifica los datos o intenta iniciar sesión si ya estás registrado.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
