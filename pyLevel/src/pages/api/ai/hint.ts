export const prerender = false;

import type { APIRoute } from 'astro';
import { invokeAI } from '../../../ai/client';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
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
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
