export const prerender = false;
import type { APIRoute } from 'astro';
import { getDbPool } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { exerciseStore } from '../../../../admin/exercise-store';
import { adminBody, adminError } from '../../../../admin/api';
export const GET: APIRoute = async ({params}) => {
  try { const exercise=await exerciseStore(getDbPool()).find(params.id!); return exercise ? json({exercise}) : json({error:'Ejercicio no encontrado.'},404); } catch(error) { return adminError(error); }
};
export const PUT: APIRoute = async ({params,request}) => {
  try { return json({exercise:await exerciseStore(getDbPool()).update(params.id!,await adminBody(request))}); } catch(error) { return adminError(error); }
};
export const DELETE: APIRoute = async ({params}) => {
  try { await exerciseStore(getDbPool()).archive(params.id!); return json({ok:true}); } catch(error) { return adminError(error); }
};
