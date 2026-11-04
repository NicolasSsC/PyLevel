export const prerender = false;

import type { APIRoute } from 'astro';
import { invokeAI } from '../../../ai/client';
import { aiBody, AiRequestError } from '../../../ai/access';
import { json } from '../../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await aiBody(request);
    const { tipo = 'reto', ...datos } = body;

    const action = tipo === 'proyecto' ? 'hint_project' : 'hint_challenge';
    const result = await invokeAI({
      action,
      data: datos,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return json({ success: false, error: error instanceof AiRequestError ? error.message : 'PyBot no pudo generar la pista.' }, error instanceof AiRequestError ? error.status : 503);
  }
};
