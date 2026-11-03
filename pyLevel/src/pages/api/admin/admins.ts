export const prerender = false;
import type { APIRoute } from 'astro';
import { getDbPool } from '../../../lib/db';
import { json } from '../../../lib/http';
import { accessStore } from '../../../admin/access-store';
import { adminBody, adminError } from '../../../admin/api';
import { AdminError } from '../../../admin/types';
export const GET: APIRoute = async () => {
  try{return json({admins:await accessStore(getDbPool()).list()});}catch(error){return adminError(error);}
};
export const POST: APIRoute = async ({request,locals}) => {
  try {
    const body=await adminBody(request);
    if(typeof body.email!=='string' || body.email.length>254 || !body.email.includes('@'))throw new AdminError('Correo inválido.');
    await accessStore(getDbPool()).change(locals.adminUser!.id,body.email.trim().toLowerCase(),true);
    return json({admins:await accessStore(getDbPool()).list()});
  }catch(error){return adminError(error);}
};
