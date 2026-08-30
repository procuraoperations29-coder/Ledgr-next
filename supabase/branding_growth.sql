-- Ledgr — custom branding + Growth plan. Apply on top of existing schema.

BEGIN;
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0014 · Custom branding + Growth plan
-- ─────────────────────────────────────────────────────────────

-- Per-org brand colour (logo_url already exists on organizations).
alter table public.organizations
  add column if not exists brand_color text;

-- Second plan: Growth (₦7,000/mo) — more seats + custom branding.
insert into public.plans (code, name, price_kobo, interval, max_users, features, sort)
values (
  'growth', 'Growth', 700000, 'monthly', 10,
  '["Up to 10 users","Everything in Standard","Custom branding — your own logo & colours","Priority support"]'::jsonb,
  2
)
on conflict (code) do nothing;

COMMIT;
