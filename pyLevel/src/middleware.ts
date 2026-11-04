import { defineMiddleware } from 'astro:middleware';
import { json, sameOrigin } from './lib/http';
import { currentUser } from './lib/session';
import { getDbPool } from './lib/db';
import { consumeAiAllowance } from './ai/access';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const adminApi = path.startsWith('/api/admin/');
  const adminPage = path === '/admin' || path.startsWith('/admin/');
  const aiApi = ['/api/ai/chat', '/api/ai/hint'].includes(path.replace(/\/$/, ''));
  const sessionPage = !context.isPrerendered && !path.startsWith('/api/');
  const privateApi = aiApi || ['/api/auth/', '/api/exam/', '/api/account/', '/api/practice/', '/api/admin/'].some(prefix => path.startsWith(prefix));
  // Origin is required for all mutations, including sendBeacon POSTs.
  if (privateApi && context.request.method !== 'GET' && !sameOrigin(context.request)) {
    return json({ error: 'Origen de la solicitud no permitido.' }, 403);
  }
  if (adminApi || adminPage) {
    try {
      const user = await currentUser(context.cookies);
      if (!user) return adminApi ? json({error:'Debes iniciar sesión.'},401) : context.redirect(`/login?next=${encodeURIComponent(path + context.url.search)}`);
      if (user.role !== 'admin') return adminApi ? json({error:'Se requieren permisos de administrador.'},403) : new Response('Acceso reservado a administradores. Vuelve a tu perfil para continuar.',{status:403,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
      context.locals.adminUser = user;
    } catch { return json({error:'No se pudo comprobar el acceso. Intenta nuevamente.'},503); }
  }
  if ((aiApi || path === '/api/admin/exercises/generate') && context.request.method === 'POST') {
    try {
      const user = context.locals.adminUser ?? await currentUser(context.cookies);
      if (!user) return json({ error: 'Debes iniciar sesión para usar PyBot.' }, 401);
      context.locals.sessionUser = user;
      if (!await consumeAiAllowance(getDbPool(), user.id)) {
        const response = json({ error: 'Alcanzaste el límite de consultas de PyBot. Intenta más tarde.' }, 429);
        response.headers.set('Retry-After', '60');
        return response;
      }
    } catch { return json({ error: 'PyBot no está disponible en este momento.' }, 503); }
  }
  if (sessionPage) {
    try {
      context.locals.sessionUser = context.locals.adminUser ?? await currentUser(context.cookies);
    } catch {
      context.locals.sessionUser = null;
    }
  }
  const response = await next();
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=()');
  if (privateApi || adminPage || sessionPage) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.append('Vary', 'Cookie');
  }
  return response;
});
