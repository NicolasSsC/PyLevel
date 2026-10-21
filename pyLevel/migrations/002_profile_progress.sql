ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday date;

CREATE TABLE IF NOT EXISTS practice_activity (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  exercise_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('classic', 'contextual')),
  kind text NOT NULL CHECK (kind IN ('opened', 'hint', 'solution', 'run', 'test')),
  result text CHECK (result IN ('pending', 'passed', 'failed', 'technical_error', 'cancelled')),
  tests_run integer NOT NULL DEFAULT 0 CHECK (tests_run >= 0),
  duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS practice_activity_user_idx ON practice_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS practice_activity_exercise_idx ON practice_activity(user_id, exercise_id, mode);
