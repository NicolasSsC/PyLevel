-- Additive migration. Existing users and profiles are not modified.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  exam_id text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
  answers jsonb NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, exam_id)
);
CREATE TABLE IF NOT EXISTS exam_events (
  id uuid PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('away', 'return')),
  source text NOT NULL CHECK (source IN ('visibility', 'focus', 'pagehide', 'resume')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_events_attempt_idx ON exam_events(attempt_id, occurred_at);
