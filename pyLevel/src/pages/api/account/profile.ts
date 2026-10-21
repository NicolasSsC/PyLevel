export const prerender = false;
import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { getDbPool, getUserById } from '../../../lib/db';
import { hashToken, SESSION_COOKIE } from '../../../lib/session-store';
import { json } from '../../../lib/http';
import { validateProfile, updateProfile, ProfileError } from '../../../account/profile';

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const user = await currentUser(cookies);
    if (!user) return json({ error: 'Inicia sesión para editar tu perfil.' }, 401);
    const raw = await request.text();
    if (raw.length > 5000) return json({ error: 'Datos demasiado largos.' }, 413);
    let input;
    try { input = validateProfile(JSON.parse(raw)); }
    catch (error) { return json({ error: error instanceof ProfileError ? error.message : 'Datos inválidos.' }, 400); }
    const client = await getDbPool().connect();
    try {
      await client.query('BEGIN');
      await updateProfile(client, user.id, input, hashToken(cookies.get(SESSION_COOKIE)!.value));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof ProfileError) return json({ error: error.message }, error.status);
      if ((error as {code?: string}).code === '23505') return json({ error: 'Este correo ya está registrado.' }, 409);
      throw error;
    } finally { client.release(); }
    return json({ user: await getUserById(user.id) });
  } catch { return json({ error: 'No pudimos guardar tu perfil. Inténtalo nuevamente.' }, 503); }
};
