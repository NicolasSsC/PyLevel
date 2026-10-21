export const prerender = false;
import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { getDbPool } from '../../../lib/db';
import { json } from '../../../lib/http';
import { examStore, ExamError } from '../../../exam/store';
import { uuidPattern, validateAnswers, validateEvents, validateMonitoring } from '../../../exam/definition';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user) return json({ error: 'Inicia sesión para acceder al examen.' }, 401);
    const attempt = await examStore(getDbPool()).read(user.id);
    return json({ attempt, serverNow: new Date().toISOString() });
  } catch {
    return json({ error: 'No se pudo cargar el examen. Inténtalo nuevamente.' }, 503);
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const user = await currentUser(cookies);
    if (!user) return json({ error: 'Tu sesión venció. Inicia sesión nuevamente para continuar.' }, 401);
    if (Number(request.headers.get('content-length')) > 250000) return json({ error: 'Solicitud demasiado grande.' }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 250000) return json({ error: 'Solicitud demasiado grande.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Solicitud inválida.' }, 400); }
    if (!body || !['start', 'sync', 'submit'].includes(body.action)) return json({ error: 'Acción inválida.' }, 400);
    let input;
    let monitoring;
    try { if (body.action === 'start' || body.monitoring !== undefined) monitoring = validateMonitoring(body.monitoring); }
    catch (error) { return json({ error: (error as Error).message }, 400); }
    if (body.action !== 'start') {
      try {
        if (!uuidPattern.test(body.attemptId)) throw new Error('Intento inválido.');
        const answers = body.answers === undefined ? undefined : validateAnswers(body.answers);
        if (answers !== undefined && (!Number.isSafeInteger(body.revision) || body.revision < 0)) throw new Error('Versión inválida.');
        if (body.action === 'submit' && answers === undefined) throw new Error('Faltan las respuestas.');
        input = { attemptId: body.attemptId, submit: body.action === 'submit', answers, revision: body.revision, events: validateEvents(body.events), monitoring };
      } catch (error) { return json({ error: (error as Error).message }, 400); }
    }
    const client = await getDbPool().connect();
    try {
      await client.query('BEGIN');
      const store = examStore(client);
      const attempt = input ? await store.sync(user.id, input) : await store.start(user.id, monitoring);
      await client.query('COMMIT');
      return json({ attempt, serverNow: new Date().toISOString() });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof ExamError) {
        return json({ error: error.message, attempt: await examStore(client).read(user.id), serverNow: new Date().toISOString() }, error.status);
      }
      throw error;
    } finally { client.release(); }
  } catch {
    return json({ error: 'No se pudo guardar en el servidor. Conserva esta ventana abierta y vuelve a intentarlo.' }, 503);
  }
};
