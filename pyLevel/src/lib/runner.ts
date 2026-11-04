export function runnerRequest(path: '/api/health' | '/api/execute', options: RequestInit, userId?: string,
  env: Record<string, string | undefined> = process.env) {
  const base = new URL(env.PYLEVEL_RUNNER_URL || 'http://127.0.0.1:8787');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
  if ((!loopback && base.protocol !== 'https:') || !['http:', 'https:'].includes(base.protocol) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Configuración inválida del ejecutor.');
  }
  const token = env.PYLEVEL_RUNNER_TOKEN;
  if (!loopback && (!token || token.length < 32)) throw new Error('Falta la credencial privada del ejecutor.');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (userId) headers.set('X-Pylevel-User-Id', userId);
  return { url: new URL(path, base), options: { ...options, headers, redirect: 'error' as const } };
}

export async function runnerFetch(path: '/api/health' | '/api/execute', options: RequestInit, userId?: string) {
  const configured = runnerRequest(path, options, userId);
  return fetch(configured.url, configured.options);
}
