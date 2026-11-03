import { json } from '../lib/http';
import { AdminError } from './types.ts';
export async function adminBody(request: Request) {
  if (Number(request.headers.get('content-length')) > 400000) throw new AdminError('La solicitud es demasiado grande.',413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 400000) throw new AdminError('La solicitud es demasiado grande.',413);
  try { const body=JSON.parse(raw); if(!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); return body; }
  catch { throw new AdminError('Solicitud JSON inválida.'); }
}
export function adminError(error: unknown) {
  if (error instanceof AdminError) return json({error:error.message},error.status);
  console.error('Error en administración:',error instanceof Error ? error.message : 'Error desconocido');
  return json({error:'No se pudo completar la operación. Intenta nuevamente.'},503);
}
