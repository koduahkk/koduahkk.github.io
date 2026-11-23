-- Row-level security for Supabase.
--
-- The app reads and writes exclusively from the server through Prisma, which
-- connects as the database owner (RLS is bypassed for the owner). Supabase also
-- exposes every public table through its auto-generated REST/GraphQL API to the
-- `anon` and `authenticated` roles. Enabling RLS with no permissive policies
-- denies that API access entirely, so the anon key shipped to browsers can
-- never read lead data, call logs, or secrets.
--
-- On a plain Postgres (local dev without Supabase) these roles don't exist and
-- the REVOKE statements are skipped.

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
  END IF;
END $$;
