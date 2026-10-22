export const prerender = false;

import type { APIRoute } from 'astro';
import { invokeAI } from '../../../ai/client';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { tema = 'General', dificultad = 'media', existentes = [] } = body;

    const result = await invokeAI({
      action: 'generate_project',
      data: { tema, dificultad, existentes },
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
