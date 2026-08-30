-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0014 · Custom branding + Growth plan
-- ─────────────────────────────────────────────────────────────

-- Per-org brand colour (logo_url already exists on organizations).
alter table public.organizations
  add column if not exists brand_color text;

-- Which plan a payment was for (so activation can switch the subscription's plan).
alter table public.billing_payments
  add column if not exists plan_id uuid references public.plans(id);

-- Second plan: Growth (₦7,000/mo) — more seats + branding + forecast + priority support.
insert into public.plans (code, name, price_kobo, interval, max_users, features, sort)
values (
  'growth', 'Growth', 700000, 'monthly', 10,
  '["Everything in Standard","Up to 10 users","12-month financial forecast","Custom branding — your own logo & colours","Priority support"]'::jsonb,
  2
)
on conflict (code) do nothing;

-- Keep the Growth plan's headline features current even if the row already
-- existed from an earlier run (on conflict above would have skipped it).
update public.plans
set features = '["Everything in Standard","Up to 10 users","12-month financial forecast","Custom branding — your own logo & colours","Priority support"]'::jsonb,
    max_users = 10,
    price_kobo = 700000
where code = 'growth';
