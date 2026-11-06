-- ============================================================
-- Migration: primary_keys table
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create the table
create table if not exists public.primary_keys (
  id          uuid primary key default gen_random_uuid(),
  key_text    text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 2. Anon can SELECT (so public listKeys can read primaries)
alter table public.primary_keys enable row level security;

create policy "anon_select_primary_keys"
  on public.primary_keys
  for select
  to anon
  using (true);

-- 3. Service role (admin) can do anything (INSERT / DELETE)
--    Service role bypasses RLS by default, so no extra policy needed.
--    If you want to be explicit:
-- create policy "service_role_all_primary_keys"
--   on public.primary_keys
--   for all
--   to service_role
--   using (true)
--   with check (true);
