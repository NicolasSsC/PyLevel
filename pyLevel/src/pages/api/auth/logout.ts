export const prerender = false;

import type { APIRoute } from 'astro';
import { endSession } from '../../../lib/session';
import { json } from '../../../lib/http';

export const POST: APIRoute = async ({ cookies }) => {
  try {
    await endSession(cookies);
    return json({ ok: true });
  } catch {
    return json({ error: 'No se pudo cerrar la sesión. Inténtalo nuevamente.' }, 503);
  }
};
