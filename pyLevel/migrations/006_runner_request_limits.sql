-- Execution quotas shared by web replicas. Stores counters, never student source code.
CREATE TABLE IF NOT EXISTS runner_request_usage (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('minute', 'day')),
  window_start timestamptz NOT NULL,
  requests integer NOT NULL CHECK (requests > 0),
  PRIMARY KEY (user_id, period, window_start)
);
CREATE INDEX IF NOT EXISTS runner_request_usage_expiry_idx ON runner_request_usage(window_start);
