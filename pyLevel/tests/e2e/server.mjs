// All services run in this process, so Playwright also stops the temporary DB.
// Override every DB option before importing app code or loading any .env file.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
Object.assign(process.env, {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: '4341',
  APP_ORIGIN: 'http://127.0.0.1:4341',
  DATABASE_URL: 'postgresql://postgres:local-e2e-only@127.0.0.1:55441/pylevel_e2e',
  PGHOST: '127.0.0.1',
  PGPORT: '55441',
  PGUSER: 'postgres',
  PGPASSWORD: 'local-e2e-only',
  PGDATABASE: 'pylevel_e2e',
  DB_SSL: 'false',
  DB_POOL_MAX: '1', // PGlite has a single PostgreSQL session; avoid multiplexing transactions.
  LOCAL_TEST_DB_PORT: '55441',
  // No real Python runner is used by this initial browser suite.
  PYLEVEL_RUNNER_URL: 'http://127.0.0.1:1',
  PYBOT_LOCAL_ONLY: 'true', // Browser checks must never spend real Gemini credits.
});

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root, env: process.env, stdio: 'inherit', windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${script} terminó con código ${code}`)));
  });
}

try {
  await import('../local-db.mjs');
  await run('scripts/prepare-camera.mjs');
  await run('node_modules/astro/bin/astro.mjs', ['build']);
  await import(new URL('../../dist/server/entry.mjs', import.meta.url).href);
} catch (error) {
  console.error(error);
  process.exit(1);
}
