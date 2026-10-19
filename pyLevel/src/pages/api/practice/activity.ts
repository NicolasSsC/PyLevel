export const prerender = false;
import type { APIRoute } from 'astro';
import { catalogs } from '../../../core/catalog';
import { currentUser } from '../../../lib/session';
import { getDbPool } from '../../../lib/db';
import { json } from '../../../lib/http';
import { activityStore } from '../../../account/activity';
import { uuidPattern } from '../../../exam/definition';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: 'Actividad inválida.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Actividad inválida.' }, 400); }
    if (!body || !['classic', 'contextual'].includes(body.mode) || !['opened', 'hint', 'solution'].includes(body.kind) || !uuidPattern.test(body.id)) return json({ error: 'Actividad inválida.' }, 400);
    const mode = body.mode as 'classic' | 'contextual';
    if (!catalogs[mode].some(e => e.id === body.exerciseId)) return json({ error: 'Ejercicio inexistente.' }, 404);
    const user = await currentUser(cookies);
    if (!user) return json({ saved: false });
    await activityStore(getDbPool()).record(user.id, body.exerciseId, mode, body.kind, body.id);
    return json({ saved: true });
  } catch { return json({ error: 'No se pudo guardar esta actividad.' }, 503); }
};
