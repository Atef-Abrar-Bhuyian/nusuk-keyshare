CREATE TABLE public.keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_text text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.keys TO anon;
GRANT SELECT, INSERT ON public.keys TO authenticated;
GRANT ALL ON public.keys TO service_role;

ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view keys"
  ON public.keys FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can add keys"
  ON public.keys FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);