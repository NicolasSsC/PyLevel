export async function runnerFetch(path: '/api/health' | '/api/execute', options: RequestInit) {
  const base = new URL(process.env.PYLEVEL_RUNNER_URL || 'http://127.0.0.1:8787');
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Configuración inválida del ejecutor.');
  return fetch(new URL(path, base), options);
}
