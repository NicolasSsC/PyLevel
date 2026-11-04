import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseConfig } from '../src/lib/db-config.ts';

const railway = 'postgresql://app:p%40ss%3Aword@postgres.railway.internal:5432/railway';

test('Railway DATABASE_URL has priority and decodes credentials without passing the URL to pg', () => {
  const config = databaseConfig({ DATABASE_URL: railway, PGHOST: 'old.example.com', PGUSER: 'old', PGDATABASE: 'old' });
  assert.equal(config.host, 'postgres.railway.internal');
  assert.equal(config.password, 'p@ss:word');
  assert.equal(config.database, 'railway');
  assert.equal(config.connectionString, undefined);
  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});

test('local PG and DB aliases remain supported with bounded pool and port values', () => {
  const config = databaseConfig({ DB_HOST: 'localhost', DB_USER: 'postgres', DB_NAME: 'local', DB_SSL: 'false', DB_POOL_MAX: '1' });
  assert.equal(config.ssl, false);
  assert.equal(config.max, 1);
  assert.equal(databaseConfig({ DATABASE_URL: 'postgres://app:pass@[::1]:5432/local' }).host, '::1');
  for (const value of ['0', '-1', 'NaN', '5garbage', '1.5']) {
    assert.throws(() => databaseConfig({ DATABASE_URL: railway, DB_POOL_MAX: value }));
  }
  assert.throws(() => databaseConfig({ PGHOST: 'localhost', PGUSER: 'postgres', PGDATABASE: 'local', PGPORT: '65536' }));
});

test('public connections verify TLS by default and cannot silently disable it', () => {
  const url = 'postgres://app:pass@database.example.com/production';
  assert.deepEqual(databaseConfig({ DATABASE_URL: url }).ssl, { rejectUnauthorized: true });
  assert.throws(() => databaseConfig({ DATABASE_URL: url, DB_SSL: 'false' }));
  assert.throws(() => databaseConfig({ DATABASE_URL: `${url}?sslmode=disable` }));
  assert.throws(() => databaseConfig({ DATABASE_URL: `${url}?sslmode=prefer` }));
  assert.deepEqual(databaseConfig({ DATABASE_URL: `${url}?sslmode=require`, DB_SSL_CA: 'line1\\nline2' }).ssl, { rejectUnauthorized: true, ca: 'line1\nline2' });
});

test('invalid or missing configuration fails without leaking secrets or choosing Render', () => {
  assert.throws(() => databaseConfig({}), /Configura DATABASE_URL/);
  for (const url of ['https://app:VERY_SECRET@example.com/db', 'postgres://app:VERY_SECRET@/db', 'postgres://app:VERY_SECRET@host/db?sslrootcert=file']) {
    assert.throws(() => databaseConfig({ DATABASE_URL: url }), error => error instanceof Error && !error.message.includes('VERY_SECRET'));
  }
});
