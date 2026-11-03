ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- These tables already exist in Render. Also create them for local installations.
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY, slug varchar(255) NOT NULL UNIQUE,
  title varchar(255) NOT NULL, description text NOT NULL,
  difficulty varchar(50), exercise_type varchar(50) NOT NULL,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE TABLE IF NOT EXISTS exercise_versions (
  id uuid PRIMARY KEY, exercise_id uuid NOT NULL REFERENCES exercises(id),
  version integer NOT NULL, repository_path text NOT NULL, manifest_path text NOT NULL,
  config jsonb, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
  UNIQUE(exercise_id, version)
);
CREATE INDEX IF NOT EXISTS exercise_versions_latest_idx ON exercise_versions(exercise_id, version DESC);
CREATE INDEX IF NOT EXISTS practice_activity_course_idx ON practice_activity(created_at DESC) WHERE kind IN ('run', 'test');
