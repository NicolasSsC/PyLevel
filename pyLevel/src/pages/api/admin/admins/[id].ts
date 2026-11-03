export const prerender = false;
import type { APIRoute } from 'astro';
import { getDbPool } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { accessStore } from '../../../../admin/access-store';
import { adminError } from '../../../../admin/api';
export const DELETE: APIRoute = async ({params,locals}) => {
  try { await accessStore(getDbPool()).change(locals.adminUser!.id,params.id!,false); return json({admins:await accessStore(getDbPool()).list()}); }
  catch(error){return adminError(error);}
};
