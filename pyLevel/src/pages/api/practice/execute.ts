export const prerender = false;
import type { APIRoute } from 'astro';
import { exerciseStore } from '../../../admin/exercise-store';
import { currentUser } from '../../../lib/session';
import { getDbPool } from '../../../lib/db';
import { json } from '../../../lib/http';
import { runnerFetch } from '../../../lib/runner';
import { executePractice, preparePracticeFiles } from '../../../account/practice';
import { consumeRunnerAllowance } from '../../../lib/runner-access';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user) return json({ error: 'Debes iniciar sesión para ejecutar código.' }, 401);
    if (Number(request.headers.get('content-length')) > 300000) return json({ error: 'Proyecto demasiado grande.' }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 300000) return json({ error: 'Proyecto demasiado grande.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Proyecto inválido.' }, 400); }
    if (!body || !['classic', 'contextual'].includes(body.mode) || !['run', 'test'].includes(body.action)) return json({ error: 'Ejercicio o acción inválidos.' }, 400);
    const mode = body.mode as 'classic' | 'contextual';
    const exercise = await exerciseStore(getDbPool()).find(body.exerciseId,mode,true);
    if (!exercise) return json({ error: 'No se encontró el ejercicio.' }, 404);
    let files;
    try { files = preparePracticeFiles(exercise, body.action, body.files); }
    catch (error) { return json({ error: (error as Error).message }, 400); }
    if (!await consumeRunnerAllowance(getDbPool(), user.id)) {
      const response = json({ error: 'Alcanzaste el límite de ejecuciones. Intenta más tarde.' }, 429);
      response.headers.set('Retry-After', '60');
      return response;
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
    const result = await executePractice({ db: getDbPool(), userId: user.id, exercise, mode, action: body.action, files, signal,
      async run(files, action, signal) {
        const response = await runnerFetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files, action }), signal }, user.id);
        if (!response.ok) throw new Error(response.status === 429 ? 'Hay una ejecución en curso. Intenta nuevamente en unos segundos.' : 'El ejecutor no está disponible.');
        return response.json();
      },
    });
    return json(result);
  } catch (error) {
    return json({ error: (error as Error).message === 'Hay una ejecución en curso. Intenta nuevamente en unos segundos.' ? (error as Error).message : 'No se pudo ejecutar. Revisa la conexión con el ejecutor y vuelve a intentar.' }, 503);
  }
};
