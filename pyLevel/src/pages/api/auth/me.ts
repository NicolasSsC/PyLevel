export const prerender = false;

import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { json } from '../../../lib/http';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    return json({ user: await currentUser(cookies) });
  } catch {
    return json({ user: null, error: 'No se pudo verificar la sesión.' }, 503);
  }
};
