export const prerender = false;

import type { APIRoute } from 'astro';
import { invokeAI, streamChat } from '../../../ai/client';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { mensaje, historial = [], contexto = {}, stream = false } = body;

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
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
