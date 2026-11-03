export const prerender = false;
import type { APIRoute } from 'astro';
import { getDbPool } from '../../../lib/db';
import { json } from '../../../lib/http';
import { exerciseStore } from '../../../admin/exercise-store';
import { adminBody, adminError } from '../../../admin/api';
export const GET: APIRoute = async () => {
  try { return json({exercises:await exerciseStore(getDbPool()).list()}); } catch(error) { return adminError(error); }
};
export const POST: APIRoute = async ({request}) => {
  try { return json({exercise:await exerciseStore(getDbPool()).create(await adminBody(request))},201); } catch(error) { return adminError(error); }
};
