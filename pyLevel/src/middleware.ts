import { defineMiddleware } from 'astro:middleware';
import { json, sameOrigin } from './lib/http';
import { currentUser } from './lib/session';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const adminApi = path.startsWith('/api/admin/');
  const adminPage = path === '/admin' || path.startsWith('/admin/');
  const privateApi = ['/api/auth/', '/api/exam/', '/api/account/', '/api/practice/', '/api/admin/'].some(prefix => path.startsWith(prefix));
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
  const response = await next();
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=()');
  if (privateApi || adminPage || ['/examen', '/perfil', '/progreso'].some(prefix => path.startsWith(prefix))) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.append('Vary', 'Cookie');
  }
  return response;
});
