import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { buildRailwayBootstrap, target } from '../scripts/build-railway-bootstrap.mjs';

function run(code: string, databaseUrl: string, wrongTarget = false) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), windowsHide: true,
      env: { ...process.env, DATABASE_URL: databaseUrl, DB_SSL: 'false', DB_POOL_MAX: '1',
        RAILWAY_PROJECT_ID: wrongTarget ? 'another-project' : target.projectId,
        RAILWAY_ENVIRONMENT_ID: target.environmentId },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, output }));
    child.stdin.end(code);
  });
}

test('the standalone Railway task migrates over the PostgreSQL protocol and refuses other targets or existing schemas', async () => {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55442, maxConnections: 1 });
  await server.start();
  try {
    const code = await buildRailwayBootstrap({ versionedImports: false });
    const url = 'postgres://postgres:test-only-password@127.0.0.1:55442/bootstrap_test';
    const wrong = await run(code, url, true);
    assert.equal(wrong.code, 1);
    assert.match(wrong.output, /WRONG_TARGET/);
    assert.deepEqual((await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows, []);
    await db.exec('CREATE TABLE existing_production_data(id integer)');
    const existing = await run(code, url);
    assert.equal(existing.code, 1);
    assert.match(existing.output, /REVIEW_EXISTING_SCHEMA/);
    await db.exec('DROP TABLE existing_production_data');
    const first = await run(code, url);
    assert.equal(first.code, 0, first.output);
    const report = JSON.parse(first.output.trim());
    assert.equal(report.event, 'pylevel.database.ready');
    assert.equal(report.applied.length, 6);
    assert.equal(report.accounts, 0);
    assert.equal(report.exercises, 0);
    assert.equal(report.tables.length, 10);
    assert.equal(report.migrations.length, 6);
    assert.ok(!first.output.includes('test-only-password'));
    const second = await run(code, url);
    assert.equal(second.code, 0, second.output);
    assert.deepEqual(JSON.parse(second.output.trim()).applied, []);
    const artifact = await buildRailwayBootstrap();
    assert.match(artifact, /from "pg@8\.23\.1"/);
    assert.ok(!artifact.includes('readFile('));
  } finally { await server.stop(); await db.close(); }
});
