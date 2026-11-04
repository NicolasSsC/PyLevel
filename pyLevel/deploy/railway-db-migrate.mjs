// Generated from repository migrations. No credentials. Do not edit this artifact.

// <define:PYLEVEL_BOOTSTRAP_MIGRATIONS>
var define_PYLEVEL_BOOTSTRAP_MIGRATIONS_default = [{ name: "000_users_profiles.sql", sql: "-- Foundation for a new installation. No accounts or demonstration data are created.\nCREATE TABLE IF NOT EXISTS users (\n  id uuid PRIMARY KEY,\n  email text NOT NULL UNIQUE,\n  password_hash text NOT NULL,\n  is_active boolean NOT NULL DEFAULT true,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n);\n\nCREATE TABLE IF NOT EXISTS profiles (\n  user_id uuid PRIMARY KEY REFERENCES users(id),\n  display_name text NOT NULL,\n  avatar_url text,\n  bio text,\n  updated_at timestamptz NOT NULL DEFAULT now()\n);\n", checksum: "182021b46ea60d2e85224c6e79cacdcd9484f6595d7f89f456f2d6fe5481bbf1" }, { name: "001_sessions_exams.sql", sql: "-- Additive migration. Existing users and profiles are not modified.\nCREATE TABLE IF NOT EXISTS auth_sessions (\n  token_hash char(64) PRIMARY KEY,\n  user_id text NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  expires_at timestamptz NOT NULL\n);\nCREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);\nCREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);\n\nCREATE TABLE IF NOT EXISTS exam_attempts (\n  id uuid PRIMARY KEY,\n  user_id text NOT NULL,\n  exam_id text NOT NULL,\n  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),\n  answers jsonb NOT NULL DEFAULT '{}',\n  revision integer NOT NULL DEFAULT 0,\n  started_at timestamptz NOT NULL DEFAULT now(),\n  expires_at timestamptz NOT NULL,\n  submitted_at timestamptz,\n  last_seen_at timestamptz NOT NULL DEFAULT now(),\n  UNIQUE(user_id, exam_id)\n);\nCREATE TABLE IF NOT EXISTS exam_events (\n  id uuid PRIMARY KEY,\n  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,\n  kind text NOT NULL CHECK (kind IN ('away', 'return')),\n  source text NOT NULL CHECK (source IN ('visibility', 'focus', 'pagehide', 'resume')),\n  occurred_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE INDEX IF NOT EXISTS exam_events_attempt_idx ON exam_events(attempt_id, occurred_at);\n", checksum: "255075e1d6b171f5f800b0d84008917b72c752fd6e09254b88a6829ae9715cda" }, { name: "002_profile_progress.sql", sql: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation text;\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday date;\n\nCREATE TABLE IF NOT EXISTS practice_activity (\n  id uuid PRIMARY KEY,\n  user_id text NOT NULL,\n  exercise_id text NOT NULL,\n  mode text NOT NULL CHECK (mode IN ('classic', 'contextual')),\n  kind text NOT NULL CHECK (kind IN ('opened', 'hint', 'solution', 'run', 'test')),\n  result text CHECK (result IN ('pending', 'passed', 'failed', 'technical_error', 'cancelled')),\n  tests_run integer NOT NULL DEFAULT 0 CHECK (tests_run >= 0),\n  duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),\n  created_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE INDEX IF NOT EXISTS practice_activity_user_idx ON practice_activity(user_id, created_at DESC);\nCREATE INDEX IF NOT EXISTS practice_activity_exercise_idx ON practice_activity(user_id, exercise_id, mode);\n", checksum: "345dd2d534d70b5c3752fa9211844c3bad77e2b086382a92ef5491c6ca8bdebf" }, { name: "003_exam_camera.sql", sql: "-- No images, recordings, face landmarks or identity templates are stored.\nALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS camera_mode text NOT NULL DEFAULT 'legacy';\nALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS camera_consent_at timestamptz;\nALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS camera_unavailable_reason text;\nALTER TABLE exam_events ADD COLUMN IF NOT EXISTS duration_ms integer;\nALTER TABLE exam_events DROP CONSTRAINT IF EXISTS exam_events_kind_check;\nALTER TABLE exam_events ADD CONSTRAINT exam_events_kind_check CHECK (kind IN\n  ('away', 'return', 'camera_ready', 'camera_missing', 'camera_multiple', 'camera_interrupted', 'camera_unavailable'));\nALTER TABLE exam_events DROP CONSTRAINT IF EXISTS exam_events_source_check;\nALTER TABLE exam_events ADD CONSTRAINT exam_events_source_check CHECK (source IN\n  ('visibility', 'focus', 'pagehide', 'resume', 'camera'));\n", checksum: "7af85926bbb624f11330140ddf71756ef74bd5538e7030bacd7e179aced76f3f" }, { name: "004_admin.sql", sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';\n\n-- These tables already exist in Render. Also create them for local installations.\nCREATE TABLE IF NOT EXISTS exercises (\n  id uuid PRIMARY KEY, slug varchar(255) NOT NULL UNIQUE,\n  title varchar(255) NOT NULL, description text NOT NULL,\n  difficulty varchar(50), exercise_type varchar(50) NOT NULL,\n  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()\n);\nALTER TABLE exercises ADD COLUMN IF NOT EXISTS archived_at timestamptz;\nCREATE TABLE IF NOT EXISTS exercise_versions (\n  id uuid PRIMARY KEY, exercise_id uuid NOT NULL REFERENCES exercises(id),\n  version integer NOT NULL, repository_path text NOT NULL, manifest_path text NOT NULL,\n  config jsonb, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,\n  UNIQUE(exercise_id, version)\n);\nCREATE INDEX IF NOT EXISTS exercise_versions_latest_idx ON exercise_versions(exercise_id, version DESC);\nCREATE INDEX IF NOT EXISTS practice_activity_course_idx ON practice_activity(created_at DESC) WHERE kind IN ('run', 'test');\n", checksum: "d792eab6f29b90cf4e7ec9224e923c9842f3654464b4a5ac089e04c98834b997" }, { name: "005_ai_request_limits.sql", sql: "-- Shared request counters, independent of the number of web replicas. No chat text is stored.\nCREATE TABLE IF NOT EXISTS ai_request_usage (\n  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  period text NOT NULL CHECK (period IN ('minute', 'day')),\n  window_start timestamptz NOT NULL,\n  requests integer NOT NULL CHECK (requests > 0),\n  PRIMARY KEY (user_id, period, window_start)\n);\nCREATE INDEX IF NOT EXISTS ai_request_usage_expiry_idx ON ai_request_usage(window_start);\n", checksum: "db1a89004ccee45ac8f13968aa86dbc990b9be1a9ff4db3d0e3c01f02281f425" }];

// <define:PYLEVEL_BOOTSTRAP_TARGET>
var define_PYLEVEL_BOOTSTRAP_TARGET_default = { projectId: "b123126a-6ec5-420a-8b18-2f97f45d784c", environmentId: "80eee0f3-df98-474c-8de3-380850c45841" };

// scripts/railway-bootstrap-entry.ts
import pg from "pg@8.23.1";

// src/lib/db-config.ts
function positiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${name} debe ser un entero positivo${maximum === 65535 ? " hasta 65535" : ""}.`);
  }
  return number;
}
function databaseConfig(env) {
  let host;
  let port;
  let user;
  let password;
  let database;
  let urlSsl = null;
  if (env.DATABASE_URL?.trim()) {
    try {
      const url = new URL(env.DATABASE_URL.trim());
      if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
      if (["sslcert", "sslkey", "sslrootcert"].some((key) => url.searchParams.has(key))) throw new Error();
      host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
      port = url.port || "5432";
      user = decodeURIComponent(url.username);
      password = decodeURIComponent(url.password);
      database = decodeURIComponent(url.pathname.slice(1));
      if (!host || !user || !database || url.hash) throw new Error();
      urlSsl = url.searchParams.get("sslmode");
    } catch {
      throw new Error("DATABASE_URL debe ser una URL PostgreSQL con usuario, host y base. Usa DB_SSL_CA para el certificado.");
    }
  } else {
    host = (env.PGHOST || env.DB_HOST || "").trim().toLowerCase();
    port = env.PGPORT || env.DB_PORT || "5432";
    user = (env.PGUSER || env.DB_USER || "").trim();
    password = env.PGPASSWORD ?? env.DB_PASSWORD ?? "";
    database = (env.PGDATABASE || env.DB_NAME || "").trim();
    if (!host || !user || !database) {
      throw new Error("Configura DATABASE_URL o PGHOST, PGUSER y PGDATABASE antes de conectar PostgreSQL.");
    }
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  const railwayPrivate = host.endsWith(".railway.internal");
  const sslMode = (env.DB_SSL || urlSsl || (local ? "disable" : railwayPrivate ? "require" : "verify-full")).trim().toLowerCase();
  let ssl;
  if (["false", "disable"].includes(sslMode)) {
    if (!local && !railwayPrivate) throw new Error("DB_SSL=false solo se permite en loopback o la red privada de Railway.");
    ssl = false;
  } else if (["true", "verify-full", "require"].includes(sslMode)) {
    ssl = {
      rejectUnauthorized: sslMode !== "require" || Boolean(env.DB_SSL_CA),
      ...env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, "\n") } : {}
    };
  } else {
    throw new Error("DB_SSL/sslmode debe ser disable, require o verify-full (tambi\xE9n true/false).");
  }
  return {
    host,
    port: positiveInteger(port, "PGPORT", 65535),
    user,
    password,
    database,
    ssl,
    max: positiveInteger(env.DB_POOL_MAX || "5", "DB_POOL_MAX"),
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 1e4
  };
}

// scripts/migration-runner.mjs
async function applyMigrations(client2, migrations) {
  await client2.query("BEGIN");
  try {
    await client2.query("SET LOCAL lock_timeout = '30s'");
    await client2.query("SET LOCAL statement_timeout = '120s'");
    await client2.query("SELECT pg_advisory_xact_lock(7263982, 1)");
    await client2.query(`CREATE TABLE IF NOT EXISTS pylevel_schema_migrations (
      name text PRIMARY KEY, checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client2.query("SELECT name, checksum FROM pylevel_schema_migrations ORDER BY name");
    const known = new Map(migrations.map((migration) => [migration.name, migration.checksum]));
    for (const row of applied.rows) {
      if (known.get(row.name) !== row.checksum) {
        throw new Error(`La migraci\xF3n aplicada ${row.name} fue modificada o falta. Crea una nueva migraci\xF3n.`);
      }
    }
    const existing = new Set(applied.rows.map((row) => row.name));
    const completed = [];
    for (const migration of migrations) {
      if (existing.has(migration.name)) continue;
      await client2.query(migration.sql);
      await client2.query("INSERT INTO pylevel_schema_migrations (name, checksum) VALUES ($1, $2)", [migration.name, migration.checksum]);
      completed.push(migration.name);
    }
    await client2.query("COMMIT");
    return completed;
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  }
}

// scripts/railway-bootstrap-entry.ts
var expectedTables = [
  "users",
  "profiles",
  "auth_sessions",
  "exam_attempts",
  "exam_events",
  "practice_activity",
  "exercises",
  "exercise_versions",
  "pylevel_schema_migrations",
  "ai_request_usage"
];
var pool;
var client;
try {
  if (process.env.RAILWAY_PROJECT_ID !== define_PYLEVEL_BOOTSTRAP_TARGET_default.projectId || process.env.RAILWAY_ENVIRONMENT_ID !== define_PYLEVEL_BOOTSTRAP_TARGET_default.environmentId) {
    throw Object.assign(new Error("Unexpected Railway target"), { code: "WRONG_TARGET" });
  }
  pool = new pg.Pool({ ...databaseConfig(process.env), max: 1 });
  client = await pool.connect();
  const tablesBefore = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  if (tablesBefore.rows.length && !tablesBefore.rows.some((row) => row.tablename === "pylevel_schema_migrations")) {
    throw Object.assign(new Error("Database already contains an unregistered schema"), { code: "REVIEW_EXISTING_SCHEMA" });
  }
  const completed = await applyMigrations(client, define_PYLEVEL_BOOTSTRAP_MIGRATIONS_default);
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  if (expectedTables.some((name) => !tables.rows.some((row) => row.tablename === name))) {
    throw Object.assign(new Error("Incomplete schema"), { code: "INCOMPLETE_SCHEMA" });
  }
  const history = await client.query("SELECT name, checksum FROM pylevel_schema_migrations ORDER BY name");
  const counts = await client.query("SELECT (SELECT count(*)::int FROM users) AS accounts, (SELECT count(*)::int FROM exercises) AS exercises");
  console.log(JSON.stringify({
    event: "pylevel.database.ready",
    applied: completed,
    tables: tables.rows.map((row) => row.tablename),
    migrations: history.rows,
    ...counts.rows[0]
  }));
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "BOOTSTRAP_FAILED";
  console.error(JSON.stringify({ event: "pylevel.database.failed", code }));
  process.exitCode = 1;
} finally {
  client?.release();
  await pool?.end();
}
