-- Run once in the Neon SQL Editor before enabling database-backed history.
-- All application queries are server-side and scoped to the Clerk user ID.
CREATE TABLE IF NOT EXISTS platewise_meals (
  id text PRIMARY KEY,
  clerk_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  meal jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platewise_meals_user_date_idx
  ON platewise_meals (clerk_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platewise_nutrition_profiles (
  clerk_user_id text PRIMARY KEY,
  profile jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
