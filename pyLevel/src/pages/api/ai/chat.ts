export const prerender = false;

import type { APIRoute } from 'astro';
import { streamChat, chatAnswer } from '../../../ai/client';
import { aiBody, chatInput, AiRequestError } from '../../../ai/access';
import { json } from '../../../lib/http';
import { loadTutorContext } from '../../../ai/tutor-context';
import { getDbPool } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    if (!locals.sessionUser) return json({ error: 'Debes iniciar sesión para usar PyBot.' }, 401);
    const body = await aiBody(request);
    const { mensaje, historial, contexto } = chatInput(body);
    const tutorContext = await loadTutorContext(getDbPool(), locals.sessionUser.id, contexto);
    const stream = body.stream === true;

    const wantsStream = stream === true || request.headers.get('accept')?.includes('text/event-stream');

    if (wantsStream) {
      const readableStream = await streamChat({
        mensaje: mensaje || '',
        historial,
        contexto: tutorContext,
      });

      return new Response(readableStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const result = await chatAnswer({ mensaje, historial, contexto: tutorContext });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return json({ success: false, error: error instanceof AiRequestError ? error.message : 'PyBot no pudo responder. Intenta nuevamente.' }, error instanceof AiRequestError ? error.status : 503);
  }
};
