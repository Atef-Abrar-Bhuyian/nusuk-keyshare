-- Admin credentials table: email + sha256-hashed password for /admin access.
-- READ is open to anon (needed so the server function can verify login).
-- INSERT/UPDATE/DELETE are blocked for anon - managed via Supabase SQL editor only.
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- Allow anon to SELECT (server-side login check reads the hash server-side only).
CREATE POLICY "Anon can read credentials for login"
  ON public.admin_credentials FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.admin_credentials TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Allow admin server functions to DELETE keys (RLS policy on keys table).
-- The existing "Anyone can add keys" INSERT policy is already there.
-- We add a permissive DELETE policy so authenticated admin ops can delete.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Service can delete keys"
  ON public.keys FOR DELETE
  TO anon, authenticated
  USING (true);

GRANT DELETE ON public.keys TO anon, authenticated;
