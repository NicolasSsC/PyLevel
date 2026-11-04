import pg from 'pg';
import { databaseConfig } from '../src/lib/db-config.ts';
import { applyMigrations } from './migration-runner.mjs';

// The builder embeds only repository SQL and these non-secret target identifiers.
declare const PYLEVEL_BOOTSTRAP_MIGRATIONS: { name: string; checksum: string; sql: string }[];
declare const PYLEVEL_BOOTSTRAP_TARGET: { projectId: string; environmentId: string };

const expectedTables = ['users', 'profiles', 'auth_sessions', 'exam_attempts', 'exam_events',
  'practice_activity', 'exercises', 'exercise_versions', 'pylevel_schema_migrations', 'ai_request_usage', 'runner_request_usage'];
let pool: pg.Pool | undefined;
let client: pg.PoolClient | undefined;
try {
  if (process.env.RAILWAY_PROJECT_ID !== PYLEVEL_BOOTSTRAP_TARGET.projectId ||
      process.env.RAILWAY_ENVIRONMENT_ID !== PYLEVEL_BOOTSTRAP_TARGET.environmentId) {
    throw Object.assign(new Error('Unexpected Railway target'), { code: 'WRONG_TARGET' });
  }
  // No dotenv: this task can only use the reference configured on its Railway service.
  pool = new pg.Pool({ ...databaseConfig(process.env), max: 1 });
  client = await pool.connect();
  const tablesBefore = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  if (tablesBefore.rows.length && !tablesBefore.rows.some(row => row.tablename === 'pylevel_schema_migrations')) {
    throw Object.assign(new Error('Database already contains an unregistered schema'), { code: 'REVIEW_EXISTING_SCHEMA' });
  }
  const completed = await applyMigrations(client, PYLEVEL_BOOTSTRAP_MIGRATIONS);
  const tables = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  if (expectedTables.some(name => !tables.rows.some(row => row.tablename === name))) {
    throw Object.assign(new Error('Incomplete schema'), { code: 'INCOMPLETE_SCHEMA' });
  }
  const history = await client.query('SELECT name, checksum FROM pylevel_schema_migrations ORDER BY name');
  const counts = await client.query('SELECT (SELECT count(*)::int FROM users) AS accounts, (SELECT count(*)::int FROM exercises) AS exercises');
  // Aggregate counts and migration checksums only; never credentials or personal data.
  console.log(JSON.stringify({ event: 'pylevel.database.ready', applied: completed,
    tables: tables.rows.map(row => row.tablename), migrations: history.rows, ...counts.rows[0] }));
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'BOOTSTRAP_FAILED';
  console.error(JSON.stringify({ event: 'pylevel.database.failed', code }));
  process.exitCode = 1;
} finally {
  client?.release();
  await pool?.end();
}
