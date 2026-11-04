export const prerender = false;

import type { APIRoute } from 'astro';
import { invokeAI, streamChat } from '../../../ai/client';
import { aiBody, chatInput, AiRequestError } from '../../../ai/access';
import { json } from '../../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await aiBody(request);
    const { mensaje, historial, contexto } = chatInput(body);
    const stream = body.stream === true;

    const wantsStream = stream === true || request.headers.get('accept')?.includes('text/event-stream');

    if (wantsStream) {
      const readableStream = await streamChat({
        mensaje: mensaje || '',
        historial,
        contexto,
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

    const result = await invokeAI({
      action: 'chat',
      data: { mensaje, historial, contexto },
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return json({ success: false, error: error instanceof AiRequestError ? error.message : 'PyBot no pudo responder. Intenta nuevamente.' }, error instanceof AiRequestError ? error.status : 503);
  }
};
