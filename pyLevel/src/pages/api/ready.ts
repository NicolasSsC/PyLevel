export const prerender = false;
import type { APIRoute } from 'astro';
import { getDbPool } from '../../lib/db';
import { json } from '../../lib/http';

export const GET: APIRoute = async () => {
  try {
    await getDbPool().query('SELECT 1');
    return json({ status: 'ok' });
  } catch { return json({ status: 'unavailable' }, 503); }
};
