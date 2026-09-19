-- Ledgr — Phase 5 (platform) incremental migrations.
-- Apply AFTER the base schema. Paste into the Supabase SQL Editor and Run.

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- FILE: 20260101001100_platform.sql
-- ═══════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0011 · Platform layer
-- Plans, subscriptions, billing payments, notifications, audit
-- logs, support tickets. Money is integer minor units (kobo).
-- ─────────────────────────────────────────────────────────────

create type public.subscription_status as enum
  ('trial', 'active', 'past_due', 'cancelled', 'suspended');

create type public.billing_status as enum
  ('pending', 'success', 'failed', 'abandoned');

create type public.ticket_status as enum
  ('open', 'in_progress', 'resolved', 'closed');

create type public.ticket_category as enum
  ('question', 'bug', 'account', 'billing', 'other');

-- ── Plans ────────────────────────────────────────────────────
create table public.plans (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  name           text not null,
  price_kobo     bigint not null,
  interval       text not null default 'monthly',   -- monthly | yearly
  max_users      int,
  max_businesses int default 1,
  features       jsonb not null default '[]'::jsonb,
  is_active      boolean not null default true,
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);

insert into public.plans (code, name, price_kobo, interval, max_users, features, sort)
values (
  'standard', 'Standard', 300000, 'monthly', 3,
  '["1 business","Up to 3 users","Unlimited transactions","P&L, Balance Sheet & Cash Flow","Monthly management accounts","Weekly summaries","Basic invoicing","Expense tracking"]'::jsonb,
  1
);

-- ── Subscriptions (one per org) ──────────────────────────────
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null unique references public.organizations(id) on delete cascade,
  plan_id                   uuid references public.plans(id),
  status                    public.subscription_status not null default 'trial',
  trial_ends_at             timestamptz,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  provider                  text,
  provider_customer_ref     text,
  provider_subscription_ref text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index idx_subscriptions_status on public.subscriptions (status);
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function app.touch_updated_at();

-- ── Billing payments ─────────────────────────────────────────
create table public.billing_payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  subscription_id  uuid references public.subscriptions(id),
  provider         text not null,
  provider_ref     text,
  amount_kobo      bigint not null,
  currency         text not null default 'NGN',
  status           public.billing_status not null default 'pending',
  paid_at          timestamptz,
  raw              jsonb,
  created_at       timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index idx_billing_org on public.billing_payments (organization_id, created_at desc);

-- ── Notifications ────────────────────────────────────────────
create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete cascade,  -- null = whole org
  type             text not null,
  title            text not null,
  body             text,
  link             text,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index idx_notifications_org on public.notifications (organization_id, created_at desc);

-- ── Audit log ────────────────────────────────────────────────
create table public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations(id) on delete cascade,
  user_id          uuid references auth.users(id),
  action           text not null,          -- insert | update | delete | custom action
  entity           text not null,          -- table / logical entity
  entity_id        uuid,
  summary          text,
  before           jsonb,
  after            jsonb,
  ip               text,
  created_at       timestamptz not null default now()
);
create index idx_audit_org on public.audit_logs (organization_id, created_at desc);

-- ── Support tickets ──────────────────────────────────────────
create table public.support_tickets (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  created_by       uuid references auth.users(id),
  subject          text not null,
  category         public.ticket_category not null default 'question',
  status           public.ticket_status not null default 'open',
  priority         text not null default 'normal',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_tickets_org on public.support_tickets (organization_id, created_at desc);
create index idx_tickets_status on public.support_tickets (status);
create trigger trg_tickets_updated before update on public.support_tickets
  for each row execute function app.touch_updated_at();

create table public.ticket_messages (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.support_tickets(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  author_id        uuid references auth.users(id),
  is_staff         boolean not null default false,
  body             text not null,
  created_at       timestamptz not null default now()
);
create index idx_ticket_messages_ticket on public.ticket_messages (ticket_id, created_at);

-- ── Audit trigger: capture financial & admin changes (§32) ───
create or replace function app.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  if tg_op = 'DELETE' then
    v_org := old.organization_id; v_id := old.id;
  else
    v_org := new.organization_id; v_id := new.id;
  end if;

  insert into public.audit_logs
    (organization_id, user_id, action, entity, entity_id, before, after)
  values (
    v_org, auth.uid(), lower(tg_op), tg_table_name, v_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_transactions after insert or update or delete on public.transactions
  for each row execute function app.write_audit();
create trigger trg_audit_invoices after insert or update or delete on public.invoices
  for each row execute function app.write_audit();
create trigger trg_audit_payments after insert or update or delete on public.payments
  for each row execute function app.write_audit();
create trigger trg_audit_expenses after insert or update or delete on public.expenses
  for each row execute function app.write_audit();
create trigger trg_audit_accounts after insert or update or delete on public.accounts
  for each row execute function app.write_audit();
create trigger trg_audit_members after insert or update or delete on public.organization_members
  for each row execute function app.write_audit();
create trigger trg_audit_subscriptions after insert or update or delete on public.subscriptions
  for each row execute function app.write_audit();

-- ── Ensure a trial subscription exists for an org ────────────
create or replace function public.ensure_subscription(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_sub  uuid;
  v_plan uuid;
begin
  if not app.has_org_role(p_org, array['owner','admin']) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select id into v_sub from public.subscriptions where organization_id = p_org;
  if v_sub is not null then
    return v_sub;
  end if;

  select id into v_plan from public.plans where code = 'standard' limit 1;

  insert into public.subscriptions
    (organization_id, plan_id, status, trial_ends_at,
     current_period_start, current_period_end)
  values
    (p_org, v_plan, 'trial', now() + interval '7 days',
     now(), now() + interval '7 days')
  returning id into v_sub;

  return v_sub;
end;
$$;

grant execute on function public.ensure_subscription(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════
-- FILE: 20260101001200_platform_rls.sql
-- ═══════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0012 · RLS for the platform layer
-- ─────────────────────────────────────────────────────────────

alter table public.plans             enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.billing_payments  enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.support_tickets   enable row level security;
alter table public.ticket_messages   enable row level security;

-- ── plans (public catalogue) ──
create policy plans_select on public.plans for select using (true);

-- ── subscriptions ──
create policy subscriptions_select on public.subscriptions
  for select using (
    organization_id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );
create policy subscriptions_admin_update on public.subscriptions
  for update using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- ── billing_payments (read-only to clients) ──
create policy billing_select on public.billing_payments
  for select using (
    organization_id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );

-- ── notifications ──
create policy notifications_select on public.notifications
  for select using (
    app.is_platform_admin()
    or (user_id = auth.uid())
    or (user_id is null and organization_id in (select app.current_member_org_ids()))
  );
-- Members may mark their notifications read.
create policy notifications_update on public.notifications
  for update using (
    (user_id = auth.uid())
    or (user_id is null and organization_id in (select app.current_member_org_ids()))
  ) with check (
    (user_id = auth.uid())
    or (user_id is null and organization_id in (select app.current_member_org_ids()))
  );

-- ── audit_logs (owner/admin/accountant or platform admin) ──
create policy audit_select on public.audit_logs
  for select using (
    app.is_platform_admin()
    or app.has_org_role(organization_id, array['owner','admin','accountant'])
  );

-- ── support_tickets ──
create policy tickets_select on public.support_tickets
  for select using (
    organization_id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );
create policy tickets_insert on public.support_tickets
  for insert with check (
    organization_id in (select app.current_member_org_ids())
    and created_by = auth.uid()
  );
create policy tickets_update on public.support_tickets
  for update using (
    app.is_platform_admin()
    or app.has_org_role(organization_id, array['owner','admin'])
  ) with check (
    app.is_platform_admin()
    or app.has_org_role(organization_id, array['owner','admin'])
  );

-- ── ticket_messages ──
create policy ticket_messages_select on public.ticket_messages
  for select using (
    organization_id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );
create policy ticket_messages_insert on public.ticket_messages
  for insert with check (
    app.is_platform_admin()
    or (organization_id in (select app.current_member_org_ids()) and author_id = auth.uid())
  );


COMMIT;
