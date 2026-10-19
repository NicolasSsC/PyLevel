import { defineMiddleware } from 'astro:middleware';
import { json, sameOrigin } from './lib/http';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const privateApi = ['/api/auth/', '/api/exam/', '/api/account/', '/api/practice/'].some(prefix => path.startsWith(prefix));
  // Origin is required for all mutations, including sendBeacon POSTs.
  if (privateApi && context.request.method !== 'GET' && !sameOrigin(context.request)) {
    return json({ error: 'Origen de la solicitud no permitido.' }, 403);
  }
  const response = await next();
  if (privateApi || ['/examen', '/perfil', '/progreso'].some(prefix => path.startsWith(prefix))) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.append('Vary', 'Cookie');
  }
  return response;
});
