-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0001 · Shared trigger helper
--
-- Only the table-independent trigger function lives here, because identity
-- tables in migration 0002 attach it in their triggers. The RLS predicate
-- functions (which read organization_members / platform_admins) are created
-- in migration 0002b, AFTER those tables exist — PostgreSQL validates the body
-- of LANGUAGE sql functions at creation time.
-- ─────────────────────────────────────────────────────────────

-- Generic updated_at trigger. References no tables, so it is safe here.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
