-- Migration 004: Admin role and dynamic exercises catalog
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Asegurar que el desarrollador principal tenga rol de administrador
UPDATE users SET role = 'admin' WHERE LOWER(email) = 'santiagopinilla112@gmail.com';

CREATE TABLE IF NOT EXISTS catalog_exercises (
  id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('classic', 'contextual')),
  title text NOT NULL,
  level text NOT NULL DEFAULT 'Inicial',
  difficulty text NOT NULL CHECK (difficulty IN ('Fácil', 'Medio', 'Difícil')),
  topics jsonb NOT NULL DEFAULT '[]',
  description text NOT NULL,
  statement text NOT NULL,
  expected text NOT NULL DEFAULT '',
  files jsonb NOT NULL DEFAULT '{}',
  briefing jsonb,
  hints jsonb DEFAULT '[]',
  solution text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_exercises_mode_active_idx ON catalog_exercises(mode, is_active);

