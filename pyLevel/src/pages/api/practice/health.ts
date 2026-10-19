export const prerender = false;
import type { APIRoute } from 'astro';
import { runnerFetch } from '../../../lib/runner';
import { json } from '../../../lib/http';
export const GET: APIRoute = async () => {
  try {
    const response = await runnerFetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    return json({ status: data.status === 'online' ? 'online' : 'offline' });
  } catch { return json({ status: 'offline' }, 503); }
};
