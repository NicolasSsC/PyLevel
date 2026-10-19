-- No images, recordings, face landmarks or identity templates are stored.
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS camera_mode text NOT NULL DEFAULT 'legacy';
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS camera_consent_at timestamptz;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS camera_unavailable_reason text;
ALTER TABLE exam_events ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE exam_events DROP CONSTRAINT IF EXISTS exam_events_kind_check;
ALTER TABLE exam_events ADD CONSTRAINT exam_events_kind_check CHECK (kind IN
  ('away', 'return', 'camera_ready', 'camera_missing', 'camera_multiple', 'camera_interrupted', 'camera_unavailable'));
ALTER TABLE exam_events DROP CONSTRAINT IF EXISTS exam_events_source_check;
ALTER TABLE exam_events ADD CONSTRAINT exam_events_source_check CHECK (source IN
  ('visibility', 'focus', 'pagehide', 'resume', 'camera'));
