export const prerender = false;

import type { APIRoute } from 'astro';
import { getUserById } from '../../../lib/db';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const sessionCookie = cookies.get('pylevel_session')?.value;
    if (!sessionCookie) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = JSON.parse(sessionCookie);
    if (!session?.id) {
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await getUserById(session.id);
    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ user: null, error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
