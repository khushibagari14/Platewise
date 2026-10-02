-- Run in the Supabase SQL Editor. Clerk remains the authentication provider.
-- Private keys stay on the server; browser Data API access is denied by RLS.
CREATE TABLE IF NOT EXISTS public.platewise_meals (
  clerk_user_id text NOT NULL,
  id text NOT NULL,
  created_at timestamptz NOT NULL,
  meal jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clerk_user_id, id)
);
CREATE INDEX IF NOT EXISTS platewise_meals_user_date_idx
  ON public.platewise_meals (clerk_user_id, created_at DESC, id);
CREATE TABLE IF NOT EXISTS public.platewise_nutrition_profiles (
  clerk_user_id text PRIMARY KEY,
  profile jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platewise_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platewise_nutrition_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platewise_meals FROM anon, authenticated;
REVOKE ALL ON public.platewise_nutrition_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platewise_meals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platewise_nutrition_profiles TO service_role;
