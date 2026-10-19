export const prerender = false;
import type { APIRoute } from 'astro';
import { catalogs } from '../../../core/catalog';
import { currentUser } from '../../../lib/session';
import { getDbPool } from '../../../lib/db';
import { json } from '../../../lib/http';
import { runnerFetch } from '../../../lib/runner';
import { executePractice, preparePracticeFiles } from '../../../account/practice';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    if (Number(request.headers.get('content-length')) > 300000) return json({ error: 'Proyecto demasiado grande.' }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 300000) return json({ error: 'Proyecto demasiado grande.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Proyecto inválido.' }, 400); }
    if (!body || !['classic', 'contextual'].includes(body.mode) || !['run', 'test'].includes(body.action)) return json({ error: 'Ejercicio o acción inválidos.' }, 400);
    const mode = body.mode as 'classic' | 'contextual';
    const exercise = catalogs[mode].find(e => e.id === body.exerciseId);
    if (!exercise) return json({ error: 'No se encontró el ejercicio.' }, 404);
    let files;
    try { files = preparePracticeFiles(exercise, body.action, body.files); }
    catch (error) { return json({ error: (error as Error).message }, 400); }
    const user = await currentUser(cookies);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]);
    const result = await executePractice({ db: getDbPool(), userId: user?.id ?? null, exercise, mode, action: body.action, files, signal,
      async run(files, action, signal) {
        const response = await runnerFetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files, action }), signal });
        if (!response.ok) throw new Error(response.status === 429 ? 'Hay una ejecución en curso. Intenta nuevamente en unos segundos.' : 'El ejecutor no está disponible.');
        return response.json();
      },
    });
    return json(result);
  } catch (error) {
    return json({ error: (error as Error).message === 'Hay una ejecución en curso. Intenta nuevamente en unos segundos.' ? (error as Error).message : 'No se pudo ejecutar. Revisa la conexión con el ejecutor y vuelve a intentar.' }, 503);
  }
};
