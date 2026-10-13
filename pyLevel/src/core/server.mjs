// Development-only bridge. Never expose the Docker supervisor to public traffic.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('../../../runner/execute.py', import.meta.url));
const runtime = spawnSync('docker', ['info', '--format', '{{json .Runtimes}}'], { encoding: 'utf8', timeout: 5000 });
const image = spawnSync('docker', ['image', 'inspect', process.env.PYLEVEL_IMAGE || 'pylevel-python:local'], { timeout: 5000 });
if (runtime.status !== 0 || !JSON.parse(runtime.stdout).runsc || image.status !== 0) {
  throw new Error('Docker, runsc y la imagen pylevel-python:local deben estar preparados antes del arranque.');
}
let active = false;
const children = new Set();
const reply = (res, status, data) => {
  if (!res.destroyed) res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
};

const server = createServer(async (req, res) => {
  if (req.url === '/api/health' && req.method === 'GET') {
    reply(res, 200, { status: 'online', busy: active }); return;
  }
  if (req.url !== '/api/execute' || req.method !== 'POST') {
    reply(res, 404, { error: 'Ruta inexistente' }); return;
  }
  // JSON content type + no CORS: cross-origin browser forms cannot submit jobs.
  if (req.headers['content-type'] !== 'application/json' || req.headers['sec-fetch-site'] === 'cross-site') {
    reply(res, 403, { error: 'Solicitud no permitida' }); return;
  }
  if (active) { reply(res, 429, { error: 'Hay una ejecución en curso. Intenta de nuevo en unos segundos.' }); return; }
  active = true;
  let child;
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 262144) { reply(res, 413, { error: 'Proyecto demasiado grande' }); return; }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    try { JSON.parse(body); } catch { reply(res, 400, { error: 'JSON inválido' }); return; }
    if (res.destroyed) return;
    child = spawn('python3', [runner], { stdio: ['pipe', 'pipe', 'pipe'] });
    children.add(child);
    let output = '';
    let failed = false;
    const cancel = () => { if (!res.writableEnded) child.kill('SIGINT'); };
    res.on('close', cancel);
    await new Promise(resolve => {
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        if (output.length > 524288) { failed = true; child.kill('SIGINT'); }
      });
      child.stderr.on('data', () => {});
      child.stdin.on('error', () => {});
      child.on('error', () => { failed = true; resolve(); });
      child.on('close', () => resolve());
      child.stdin.end(body);
    });
    res.off('close', cancel);
    try {
      if (failed) throw new Error();
      const result = JSON.parse(output);
      reply(res, result.status === 'invalid_request' ? 400 : 200, result);
    } catch { reply(res, 503, { error: 'El ejecutor no está disponible. Revisa el servicio gVisor.' }); }
  } catch { reply(res, 400, { error: 'No se pudo recibir el proyecto' }); }
  finally { if (child) children.delete(child); active = false; }
});
server.requestTimeout = 5000;
server.headersTimeout = 5000;
server.listen(8787, '127.0.0.1', () => console.log('PyLevel executor listening on port 8787'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const child of children) child.kill('SIGINT');
  server.close();
});
