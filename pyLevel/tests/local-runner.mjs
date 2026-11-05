// Deterministic HTTP fixture: never executes Python. Only for isolated integration tests.
import { createServer } from 'node:http';
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/health') { res.end(JSON.stringify({ status: 'online' })); return; }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const { files, action } = JSON.parse(Buffer.concat(chunks).toString());
  const main = files['main.py'] ?? '';
  if (main.includes('SLOW_FIXTURE')) await new Promise(resolve => setTimeout(resolve, 1500));
  if (res.destroyed) return;
  if (main.includes('TECHNICAL_FIXTURE')) { res.writeHead(503).end(JSON.stringify({ error: 'fixture unavailable' })); return; }
  const tampered = Object.entries(files).some(([path, code]) => path.startsWith('tests/') && code === 'tampered');
  const failed = main.includes('FAIL_FIXTURE') || tampered;
  res.end(JSON.stringify({ status: 'completed', exit_code: failed ? 1 : 0,
    output: action === 'run' ? '42\n' : main.includes('NO_TESTS_FIXTURE') ? 'Ran 0 tests in 0.001s\n\nOK\n' : failed ? 'Ran 2 tests in 0.001s\n\nFAILED (failures=1)\n' : 'Ran 2 tests in 0.001s\n\nOK\n' }));
});
const port = Number(process.env.LOCAL_RUNNER_PORT || 8788);
server.listen(port, '127.0.0.1', () => console.log(`Ejecutor HTTP simulado en 127.0.0.1:${port}. Solo pruebas; no ejecuta código.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
