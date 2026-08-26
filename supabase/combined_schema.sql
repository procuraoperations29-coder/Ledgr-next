-- Ledgr — combined schema (all migrations, in order). Paste into a fresh Supabase project SQL Editor and Run. Atomic.

BEGIN;

-- FILE: 20260101000000_extensions.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0000 · Extensions
-- ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;      -- case-insensitive emails

-- Dedicated schema for internal helper functions (RLS predicates, triggers).
-- Kept out of `public` so it is not exposed through PostgREST.
create schema if not exists app;


-- FILE: 20260101000100_app_helpers.sql
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


-- FILE: 20260101000200_identity.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0002 · Identity & tenancy
-- ─────────────────────────────────────────────────────────────

create type public.org_status as enum
  ('trial', 'active', 'past_due', 'suspended', 'cancelled');

create type public.member_role as enum
  ('owner', 'admin', 'accountant', 'staff', 'viewer');

create type public.member_status as enum
  ('active', 'invited', 'revoked');

-- ── Organisations (tenants) ──────────────────────────────────
create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique,
  business_type         text,
  industry              text,
  phone                 text,
  email                 citext,
  address               text,
  country               text not null default 'NG',
  currency              text not null default 'NGN',
  fy_start_month        smallint not null default 1
                          check (fy_start_month between 1 and 12),
  logo_url              text,
  status                public.org_status not null default 'trial',
  onboarding_completed  boolean not null default false,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_organizations_updated
  before update on public.organizations
  for each row execute function app.touch_updated_at();

-- ── Membership (user ↔ org + RBAC role) ──────────────────────
create table public.organization_members (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              public.member_role not null default 'owner',
  status            public.member_status not null default 'active',
  -- §25: staff can record transactions but only read reports if granted.
  can_view_reports  boolean not null default false,
  invited_by        uuid references auth.users(id),
  invited_email     citext,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index idx_org_members_user on public.organization_members (user_id);
create index idx_org_members_org  on public.organization_members (organization_id);

create trigger trg_org_members_updated
  before update on public.organization_members
  for each row execute function app.touch_updated_at();

-- ── Profiles (1:1 with auth.users) ───────────────────────────
create table public.profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  avatar_url       text,
  -- §52: accountants can flip into the debit/credit interface.
  accountant_mode  boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function app.touch_updated_at();

-- ── Platform admins (Ledgr operators) ────────────────────────
create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── Auto-provision a profile row on signup ───────────────────
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ── Atomic organisation creation ─────────────────────────────
-- Creates the org AND the owner membership in one transaction, so RLS never
-- has a chicken-and-egg window. Runs as definer; caller must be authenticated.
create or replace function public.create_organization(
  p_name           text,
  p_business_type  text default null,
  p_industry       text default null,
  p_currency       text default 'NGN',
  p_country        text default 'NG',
  p_fy_start_month smallint default 1
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Business name is required' using errcode = '22023';
  end if;

  insert into public.organizations
    (name, business_type, industry, currency, country, fy_start_month, created_by)
  values
    (btrim(p_name), p_business_type, p_industry,
     coalesce(p_currency, 'NGN'), coalesce(p_country, 'NG'),
     coalesce(p_fy_start_month, 1), v_uid)
  returning id into v_org;

  insert into public.organization_members
    (organization_id, user_id, role, status, can_view_reports)
  values
    (v_org, v_uid, 'owner', 'active', true);

  return v_org;
end;
$$;

grant execute on function public.create_organization(
  text, text, text, text, text, smallint
) to authenticated;


-- FILE: 20260101000250_rls_predicates.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0002b · RLS predicate functions
--
-- Created AFTER the identity tables (0002) because these LANGUAGE sql bodies
-- reference organization_members / platform_admins, and PostgreSQL validates
-- those references at CREATE time. Every tenant table's RLS policy is expressed
-- in terms of these. They run SECURITY DEFINER with a pinned search_path so
-- they read organization_members without triggering its own RLS (which would
-- recurse).
-- ─────────────────────────────────────────────────────────────

-- Org ids the current user is an ACTIVE member of.
create or replace function app.current_member_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, app
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and status = 'active';
$$;

-- Does the current user hold one of `roles` in `org`?
create or replace function app.has_org_role(org uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and organization_id = org
      and status = 'active'
      and role::text = any(roles)
  );
$$;

-- May the current user read financial reports for `org`?
create or replace function app.can_view_reports(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and organization_id = org
      and status = 'active'
      and (
        role in ('owner','admin','accountant','viewer')
        or (role = 'staff' and can_view_reports = true)
      )
  );
$$;

-- Is the current user a platform (Ledgr operator) admin?
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- Do the current user and `target` share any active organisation?
create or replace function app.shares_org_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b using (organization_id)
    where a.user_id = auth.uid()
      and b.user_id = target
      and a.status = 'active'
      and b.status = 'active'
  );
$$;


-- FILE: 20260101000300_identity_rls.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0003 · Row-Level Security for the identity layer
--
-- Default posture: RLS ON, no policy = deny. Tenant rows are visible only to
-- active members of the owning organisation (or platform admins). Writes to
-- membership/org settings are restricted to owner/admin.
-- ─────────────────────────────────────────────────────────────

alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.profiles              enable row level security;
alter table public.platform_admins       enable row level security;

-- ── organizations ──
create policy org_select on public.organizations
  for select using (
    id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );

-- Direct inserts are blocked; use public.create_organization(). (No insert policy.)

create policy org_update on public.organizations
  for update using (
    app.has_org_role(id, array['owner','admin'])
    or app.is_platform_admin()
  ) with check (
    app.has_org_role(id, array['owner','admin'])
    or app.is_platform_admin()
  );

-- ── organization_members ──
create policy members_select on public.organization_members
  for select using (
    organization_id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );

create policy members_insert on public.organization_members
  for insert with check (
    app.has_org_role(organization_id, array['owner','admin'])
  );

create policy members_update on public.organization_members
  for update using (
    app.has_org_role(organization_id, array['owner','admin'])
  ) with check (
    app.has_org_role(organization_id, array['owner','admin'])
  );

create policy members_delete on public.organization_members
  for delete using (
    app.has_org_role(organization_id, array['owner','admin'])
  );

-- ── profiles ──
create policy profiles_select on public.profiles
  for select using (
    user_id = auth.uid()
    or app.shares_org_with(user_id)
    or app.is_platform_admin()
  );

create policy profiles_upsert_self on public.profiles
  for insert with check (user_id = auth.uid());

create policy profiles_update_self on public.profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── platform_admins ── (only platform admins can see the roster)
create policy platform_admins_select on public.platform_admins
  for select using (app.is_platform_admin());


-- FILE: 20260101000400_accounting_core.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0004 · Accounting core (ledger truth)
--
-- Money is stored everywhere as INTEGER minor units (kobo) — never floats.
-- The ledger is append-only: posted journals are immutable and are corrected
-- by reversal, never edited or deleted (§9, §10, §40).
-- ─────────────────────────────────────────────────────────────

create type public.account_type as enum
  ('asset', 'liability', 'equity', 'revenue', 'cost_of_sales', 'expense');

create type public.normal_balance as enum ('debit', 'credit');

create type public.journal_status as enum ('draft', 'posted', 'reversed');

create type public.journal_source as enum
  ('transaction', 'invoice', 'payment', 'expense', 'opening',
   'manual', 'reversal', 'inventory');

create type public.txn_type as enum
  ('money_received', 'money_spent', 'transfer', 'sale', 'purchase',
   'customer_payment', 'supplier_payment', 'loan_received', 'loan_repayment',
   'owner_investment', 'owner_withdrawal', 'other');

create type public.txn_status as enum ('draft', 'posted', 'reversed');

create type public.period_status as enum ('open', 'closed');

-- ── Chart of Accounts ────────────────────────────────────────
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  code             text not null,
  name             text not null,        -- accountant-facing name
  plain_name       text,                 -- SME-friendly label (§2)
  type             public.account_type not null,
  subtype          text,                 -- 'cash','bank','receivable','payable',...
  normal_balance   public.normal_balance not null,
  parent_id        uuid references public.accounts(id),
  is_bank_or_cash  boolean not null default false,
  is_system        boolean not null default false,  -- default CoA, protected
  is_active        boolean not null default true,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, code)
);
create index idx_accounts_org       on public.accounts (organization_id);
create index idx_accounts_org_type  on public.accounts (organization_id, type);

create trigger trg_accounts_updated
  before update on public.accounts
  for each row execute function app.touch_updated_at();

-- ── Accounting periods (month/quarter/year awareness, §42-43) ─
create table public.accounting_periods (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  period_start     date not null,
  period_end       date not null,
  status           public.period_status not null default 'open',
  closed_by        uuid references auth.users(id),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, period_start, period_end)
);
create index idx_periods_org on public.accounting_periods (organization_id);

-- ── Journals (double-entry header) ───────────────────────────
create table public.journals (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  entry_date              date not null,
  description             text,
  reference               text,
  source_type             public.journal_source not null default 'manual',
  source_id               uuid,
  status                  public.journal_status not null default 'draft',
  reverses_journal_id     uuid references public.journals(id),
  reversed_by_journal_id  uuid references public.journals(id),
  posted_at               timestamptz,
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_journals_org_date   on public.journals (organization_id, entry_date);
create index idx_journals_org_status on public.journals (organization_id, status);
create index idx_journals_source     on public.journals (organization_id, source_type, source_id);

create trigger trg_journals_updated
  before update on public.journals
  for each row execute function app.touch_updated_at();

-- ── Journal lines (the debits & credits) ─────────────────────
create table public.journal_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  journal_id       uuid not null references public.journals(id) on delete cascade,
  account_id       uuid not null references public.accounts(id),
  debit            bigint not null default 0 check (debit >= 0),
  credit           bigint not null default 0 check (credit >= 0),
  memo             text,
  created_at       timestamptz not null default now(),
  -- Exactly one of debit/credit must be positive.
  constraint chk_one_sided check ((debit = 0) <> (credit = 0))
);
create index idx_jlines_journal     on public.journal_lines (journal_id);
create index idx_jlines_org_account on public.journal_lines (organization_id, account_id);

-- ── Transactions (SME-friendly layer over the ledger, §7-8) ──
create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  type                 public.txn_type not null,
  txn_date             date not null,
  amount               bigint not null check (amount > 0),  -- minor units
  account_id           uuid references public.accounts(id),          -- money account
  category_account_id  uuid references public.accounts(id),          -- income/expense category
  counterparty_type    text,        -- 'customer' | 'supplier' | 'other'
  counterparty_id      uuid,
  description          text,
  reference            text,
  attachment_id        uuid,
  journal_id           uuid references public.journals(id),
  status               public.txn_status not null default 'posted',
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_txn_org_date on public.transactions (organization_id, txn_date);
create index idx_txn_org_type on public.transactions (organization_id, type);

create trigger trg_txn_updated
  before update on public.transactions
  for each row execute function app.touch_updated_at();

-- ── Immutability guards ──────────────────────────────────────
-- Lines of a POSTED journal cannot be inserted, changed or removed.
create or replace function app.guard_journal_lines()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  v_status public.journal_status;
begin
  select status into v_status
  from public.journals
  where id = coalesce(new.journal_id, old.journal_id);

  if v_status = 'posted' then
    raise exception 'Cannot modify lines of a posted journal — reverse it instead.'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_guard_jlines
  before insert or update or delete on public.journal_lines
  for each row execute function app.guard_journal_lines();

-- A posted journal is immutable except for being linked to its reversal.
create or replace function app.guard_journals()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Posted journals cannot be deleted — reverse it instead.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status = 'posted' then
    if new.entry_date      is distinct from old.entry_date
       or new.organization_id is distinct from old.organization_id
       or new.source_type  is distinct from old.source_type
       or new.source_id    is distinct from old.source_id then
      raise exception 'Posted journals are immutable.' using errcode = '23514';
    end if;
    if new.status not in ('posted', 'reversed') then
      raise exception 'Invalid status transition for a posted journal.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_journals
  before update or delete on public.journals
  for each row execute function app.guard_journals();


-- FILE: 20260101000500_accounting_functions.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0005 · Accounting engine (RPC)
--
-- ALL ledger writes funnel through these SECURITY DEFINER functions. The base
-- tables have no INSERT policy, so the ONLY way to create a journal is via
-- post_journal_entry — which refuses to post anything that does not balance.
-- ─────────────────────────────────────────────────────────────

-- ── post_journal_entry: the one true posting path ────────────
create or replace function public.post_journal_entry(
  p_org         uuid,
  p_date        date,
  p_description text,
  p_reference   text,
  p_source_type public.journal_source,
  p_source_id   uuid,
  p_lines       jsonb   -- [{account_id, debit, credit, memo}]
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid          uuid := auth.uid();
  v_journal      uuid;
  v_line         jsonb;
  v_debit        bigint;
  v_credit       bigint;
  v_total_debit  bigint := 0;
  v_total_credit bigint := 0;
begin
  if not app.has_org_role(p_org, array['owner','admin','accountant','staff']) then
    raise exception 'Not authorised to post to this organisation.' using errcode = '42501';
  end if;

  -- Block posting into a closed period (§43).
  if exists (
    select 1 from public.accounting_periods
    where organization_id = p_org
      and p_date between period_start and period_end
      and status = 'closed'
  ) then
    raise exception 'That date is in a closed accounting period.' using errcode = '23514';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal needs at least two lines.' using errcode = '22023';
  end if;

  insert into public.journals
    (organization_id, entry_date, description, reference, source_type, source_id, status, created_by)
  values
    (p_org, p_date, p_description, p_reference,
     coalesce(p_source_type, 'manual'), p_source_id, 'draft', v_uid)
  returning id into v_journal;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_debit  := coalesce((v_line->>'debit')::bigint, 0);
    v_credit := coalesce((v_line->>'credit')::bigint, 0);

    -- Tenant-safe, active-account check (§44: no cross-tenant / inactive refs).
    if not exists (
      select 1 from public.accounts
      where id = (v_line->>'account_id')::uuid
        and organization_id = p_org
        and is_active = true
    ) then
      raise exception 'Invalid or inactive account in a journal line.' using errcode = '23503';
    end if;

    insert into public.journal_lines
      (organization_id, journal_id, account_id, debit, credit, memo)
    values
      (p_org, v_journal, (v_line->>'account_id')::uuid, v_debit, v_credit, v_line->>'memo');

    v_total_debit  := v_total_debit  + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception 'Journal does not balance (debits % ≠ credits %).',
      v_total_debit, v_total_credit using errcode = '23514';
  end if;
  if v_total_debit = 0 then
    raise exception 'Journal total cannot be zero.' using errcode = '23514';
  end if;

  update public.journals
    set status = 'posted', posted_at = now()
    where id = v_journal;

  return v_journal;
end;
$$;

grant execute on function public.post_journal_entry(
  uuid, date, text, text, public.journal_source, uuid, jsonb
) to authenticated;

-- ── record_transaction: SME-friendly wrapper (§7-9) ──────────
-- Convention: p_account_id is ALWAYS the money (bank/cash) account.
-- p_category_account_id is the other side (revenue, expense, AR, AP, loan…).
-- For transfers, p_account_id = source, p_category_account_id = destination.
create or replace function public.record_transaction(
  p_org                 uuid,
  p_type                public.txn_type,
  p_date                date,
  p_amount              bigint,
  p_account_id          uuid,
  p_category_account_id uuid,
  p_counterparty_type   text default null,
  p_counterparty_id     uuid default null,
  p_description         text default null,
  p_reference           text default null,
  p_attachment_id       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid         uuid := auth.uid();
  v_debit_acct  uuid;
  v_credit_acct uuid;
  v_journal     uuid;
  v_txn         uuid := gen_random_uuid();
  v_desc        text;
begin
  if not app.has_org_role(p_org, array['owner','admin','accountant','staff']) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.' using errcode = '22023';
  end if;

  -- Map transaction type → which account is debited / credited.
  if p_type in ('money_received','sale','customer_payment','loan_received','owner_investment') then
    v_debit_acct  := p_account_id;           -- money in
    v_credit_acct := p_category_account_id;
  elsif p_type in ('money_spent','purchase','supplier_payment','loan_repayment','owner_withdrawal','other') then
    v_debit_acct  := p_category_account_id;
    v_credit_acct := p_account_id;           -- money out
  elsif p_type = 'transfer' then
    v_debit_acct  := p_category_account_id;  -- destination account
    v_credit_acct := p_account_id;           -- source account
  else
    raise exception 'Unsupported transaction type.' using errcode = '22023';
  end if;

  if v_debit_acct is null or v_credit_acct is null then
    raise exception 'Both accounts are required for this transaction.' using errcode = '22023';
  end if;
  if v_debit_acct = v_credit_acct then
    raise exception 'The two accounts must be different.' using errcode = '22023';
  end if;

  v_desc := coalesce(nullif(btrim(p_description), ''),
                     initcap(replace(p_type::text, '_', ' ')));

  v_journal := public.post_journal_entry(
    p_org, p_date, v_desc, p_reference, 'transaction', v_txn,
    jsonb_build_array(
      jsonb_build_object('account_id', v_debit_acct,  'debit', p_amount, 'credit', 0, 'memo', p_description),
      jsonb_build_object('account_id', v_credit_acct, 'debit', 0, 'credit', p_amount, 'memo', p_description)
    )
  );

  insert into public.transactions
    (id, organization_id, type, txn_date, amount, account_id, category_account_id,
     counterparty_type, counterparty_id, description, reference, attachment_id,
     journal_id, status, created_by)
  values
    (v_txn, p_org, p_type, p_date, p_amount, p_account_id, p_category_account_id,
     p_counterparty_type, p_counterparty_id, p_description, p_reference, p_attachment_id,
     v_journal, 'posted', v_uid);

  return v_txn;
end;
$$;

grant execute on function public.record_transaction(
  uuid, public.txn_type, date, bigint, uuid, uuid, text, uuid, text, text, uuid
) to authenticated;

-- ── reverse_journal: append a mirror entry (§10) ─────────────
create or replace function public.reverse_journal(
  p_journal uuid,
  p_date    date default null,
  p_reason  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_org    uuid;
  v_status public.journal_status;
  v_rev    uuid;
begin
  select organization_id, status into v_org, v_status
  from public.journals where id = p_journal;

  if v_org is null then
    raise exception 'Journal not found.' using errcode = 'P0002';
  end if;
  if not app.has_org_role(v_org, array['owner','admin','accountant']) then
    raise exception 'Not authorised to reverse entries.' using errcode = '42501';
  end if;
  if v_status <> 'posted' then
    raise exception 'Only posted journals can be reversed.' using errcode = '23514';
  end if;

  insert into public.journals
    (organization_id, entry_date, description, source_type, source_id,
     status, reverses_journal_id, created_by)
  values
    (v_org, coalesce(p_date, current_date),
     coalesce(nullif(btrim(p_reason), ''), 'Reversal of entry'),
     'reversal', p_journal, 'draft', p_journal, auth.uid())
  returning id into v_rev;

  -- Mirror each line (debit ↔ credit).
  insert into public.journal_lines
    (organization_id, journal_id, account_id, debit, credit, memo)
  select v_org, v_rev, account_id, credit, debit,
         coalesce(nullif(btrim(p_reason), ''), 'Reversal')
  from public.journal_lines
  where journal_id = p_journal;

  update public.journals set status = 'posted', posted_at = now() where id = v_rev;
  update public.journals
    set status = 'reversed', reversed_by_journal_id = v_rev
    where id = p_journal;

  return v_rev;
end;
$$;

grant execute on function public.reverse_journal(uuid, date, text) to authenticated;

-- ── reverse_transaction: reverse the underlying journal ──────
create or replace function public.reverse_transaction(
  p_txn    uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_org     uuid;
  v_journal uuid;
  v_rev     uuid;
begin
  select organization_id, journal_id into v_org, v_journal
  from public.transactions where id = p_txn;

  if v_org is null then
    raise exception 'Transaction not found.' using errcode = 'P0002';
  end if;

  v_rev := public.reverse_journal(v_journal, current_date, p_reason);
  update public.transactions set status = 'reversed' where id = p_txn;
  return v_rev;
end;
$$;

grant execute on function public.reverse_transaction(uuid, text) to authenticated;

-- ── account_balance: signed balance in normal-balance terms ──
-- Includes posted + reversed journals (reversals net out); excludes drafts.
create or replace function public.account_balance(
  p_account uuid,
  p_as_of   date default null
)
returns bigint
language sql
stable
security invoker         -- RLS on the base tables enforces tenant scope
set search_path = public, app
as $$
  select coalesce(sum(
    case when a.normal_balance = 'debit'
         then l.debit - l.credit
         else l.credit - l.debit end
  ), 0)::bigint
  from public.journal_lines l
  join public.journals j on j.id = l.journal_id
  join public.accounts a on a.id = l.account_id
  where l.account_id = p_account
    and j.status <> 'draft'
    and (p_as_of is null or j.entry_date <= p_as_of);
$$;

grant execute on function public.account_balance(uuid, date) to authenticated;


-- FILE: 20260101000600_default_chart_of_accounts.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0006 · Default Chart of Accounts seeder (§6)
--
-- Called during onboarding. Idempotent per org (skips if accounts exist).
-- plain_name gives the SME-friendly label; name is the accountant term.
-- ─────────────────────────────────────────────────────────────

create or replace function public.seed_default_accounts(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if not app.has_org_role(p_org, array['owner','admin','accountant']) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  -- Idempotent: do nothing if this org already has a chart.
  if exists (select 1 from public.accounts where organization_id = p_org) then
    return;
  end if;

  insert into public.accounts
    (organization_id, code, name, plain_name, type, subtype, normal_balance, is_bank_or_cash, is_system)
  values
    -- Assets ────────────────────────────────
    (p_org, '1000', 'Cash',                'Cash in hand',            'asset', 'cash',        'debit', true,  true),
    (p_org, '1010', 'Bank',                'Money in the bank',       'asset', 'bank',        'debit', true,  true),
    (p_org, '1200', 'Accounts Receivable', 'Money customers owe you', 'asset', 'receivable',  'debit', false, true),
    (p_org, '1300', 'Inventory',           'Stock / Inventory',       'asset', 'inventory',   'debit', false, true),
    (p_org, '1400', 'Equipment',           'Equipment',               'asset', 'fixed_asset', 'debit', false, true),
    (p_org, '1500', 'Vehicles',            'Vehicles',                'asset', 'fixed_asset', 'debit', false, true),
    (p_org, '1900', 'Other Assets',        'Other assets',            'asset', 'other',       'debit', false, true),

    -- Liabilities ───────────────────────────
    (p_org, '2000', 'Accounts Payable',    'Money you owe suppliers', 'liability', 'payable', 'credit', false, true),
    (p_org, '2100', 'Loans',               'Loans',                   'liability', 'loan',    'credit', false, true),
    (p_org, '2200', 'Taxes Payable',       'Taxes you owe',           'liability', 'tax',     'credit', false, true),
    (p_org, '2900', 'Other Liabilities',   'Other money you owe',     'liability', 'other',   'credit', false, true),

    -- Equity ────────────────────────────────
    (p_org, '3000', 'Owner''s Capital',    'Owner''s investment',     'equity', 'capital',    'credit', false, true),
    (p_org, '3100', 'Retained Earnings',   'Retained earnings',       'equity', 'retained',   'credit', false, true),
    (p_org, '3200', 'Drawings',            'Owner withdrawals',       'equity', 'drawings',   'debit',  false, true),

    -- Revenue ───────────────────────────────
    (p_org, '4000', 'Sales Revenue',       'Sales',                   'revenue', 'sales',     'credit', false, true),
    (p_org, '4100', 'Service Revenue',     'Service income',          'revenue', 'service',   'credit', false, true),
    (p_org, '4900', 'Other Income',        'Other income',            'revenue', 'other',     'credit', false, true),

    -- Cost of Sales ─────────────────────────
    (p_org, '5000', 'Cost of Goods Sold',  'Cost of goods sold',      'cost_of_sales', 'cogs',          'debit', false, true),
    (p_org, '5100', 'Direct Labour',       'Direct labour',           'cost_of_sales', 'direct_labour', 'debit', false, true),
    (p_org, '5200', 'Direct Expenses',     'Direct expenses',         'cost_of_sales', 'direct',        'debit', false, true),

    -- Operating Expenses ────────────────────
    (p_org, '6000', 'Salaries',                 'Salaries & wages',    'expense', 'operating', 'debit', false, true),
    (p_org, '6100', 'Rent',                     'Rent',                'expense', 'operating', 'debit', false, true),
    (p_org, '6200', 'Utilities',                'Utilities',           'expense', 'operating', 'debit', false, true),
    (p_org, '6300', 'Internet',                 'Internet & airtime',  'expense', 'operating', 'debit', false, true),
    (p_org, '6400', 'Marketing',                'Marketing',           'expense', 'operating', 'debit', false, true),
    (p_org, '6500', 'Transportation',           'Transport',           'expense', 'operating', 'debit', false, true),
    (p_org, '6600', 'Office Expenses',          'Office expenses',     'expense', 'operating', 'debit', false, true),
    (p_org, '6700', 'Professional Fees',        'Professional fees',   'expense', 'operating', 'debit', false, true),
    (p_org, '6800', 'Bank Charges',             'Bank charges',        'expense', 'operating', 'debit', false, true),
    (p_org, '6900', 'Repairs & Maintenance',    'Repairs',             'expense', 'operating', 'debit', false, true),
    (p_org, '7000', 'Insurance',                'Insurance',           'expense', 'operating', 'debit', false, true),
    (p_org, '7100', 'Depreciation',             'Depreciation',        'expense', 'operating', 'debit', false, true),
    (p_org, '7900', 'Other Operating Expenses', 'Other expenses',      'expense', 'operating', 'debit', false, true);
end;
$$;

grant execute on function public.seed_default_accounts(uuid) to authenticated;


-- FILE: 20260101000700_accounting_rls.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0007 · RLS for the accounting core
--
-- Ledger writes (journals, journal_lines, transactions) have NO write policy
-- on purpose: the only way in is the SECURITY DEFINER RPCs, which enforce
-- balancing, authorisation and period locks. Direct client writes are denied.
-- ─────────────────────────────────────────────────────────────

alter table public.accounts            enable row level security;
alter table public.accounting_periods  enable row level security;
alter table public.journals            enable row level security;
alter table public.journal_lines       enable row level security;
alter table public.transactions        enable row level security;

-- ── accounts (chart of accounts) ──
create policy accounts_select on public.accounts
  for select using (
    organization_id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );

create policy accounts_insert on public.accounts
  for insert with check (
    app.has_org_role(organization_id, array['owner','admin','accountant'])
  );

-- Edit / archive (is_active). Deletion is intentionally not permitted — an
-- account with history is archived, never deleted (§6).
create policy accounts_update on public.accounts
  for update using (
    app.has_org_role(organization_id, array['owner','admin','accountant'])
  ) with check (
    app.has_org_role(organization_id, array['owner','admin','accountant'])
  );

-- ── accounting_periods ──
create policy periods_select on public.accounting_periods
  for select using (
    organization_id in (select app.current_member_org_ids())
  );

create policy periods_write on public.accounting_periods
  for all using (
    app.has_org_role(organization_id, array['owner','admin','accountant'])
  ) with check (
    app.has_org_role(organization_id, array['owner','admin','accountant'])
  );

-- ── journals & journal_lines (accountant-level ledger) ──
-- Readable only by those allowed to see financial reports.
create policy journals_select on public.journals
  for select using (
    app.can_view_reports(organization_id)
    or app.is_platform_admin()
  );

create policy journal_lines_select on public.journal_lines
  for select using (
    app.can_view_reports(organization_id)
    or app.is_platform_admin()
  );

-- ── transactions (SME-facing operational layer) ──
-- Any active member may read the transaction feed; writes go through RPC only.
create policy transactions_select on public.transactions
  for select using (
    organization_id in (select app.current_member_org_ids())
    or app.is_platform_admin()
  );


-- FILE: 20260101000800_sme_entities.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0008 · SME entities (customers, suppliers, invoices,
-- expenses, payments, products, inventory)
-- Money is integer minor units (kobo). Quantities are numeric.
-- ─────────────────────────────────────────────────────────────

-- ── Customers & Suppliers ────────────────────────────────────
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  email            citext,
  phone            text,
  address          text,
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_customers_org on public.customers (organization_id);
create trigger trg_customers_updated before update on public.customers
  for each row execute function app.touch_updated_at();

create table public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  email            citext,
  phone            text,
  address          text,
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_suppliers_org on public.suppliers (organization_id);
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function app.touch_updated_at();

-- ── Products (catalogue + light inventory, §24) ──────────────
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  sku              text,
  cost_price       bigint not null default 0,
  sell_price       bigint not null default 0,
  track_inventory  boolean not null default false,
  qty_on_hand      numeric(16,3) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_products_org on public.products (organization_id);
create unique index idx_products_sku on public.products (organization_id, sku)
  where sku is not null;
create trigger trg_products_updated before update on public.products
  for each row execute function app.touch_updated_at();

-- ── Invoices (§20) ───────────────────────────────────────────
create type public.invoice_status as enum
  ('draft', 'sent', 'partly_paid', 'paid', 'void');

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  customer_id      uuid not null references public.customers(id),
  number           text not null,
  issue_date       date not null,
  due_date         date,
  status           public.invoice_status not null default 'sent',
  subtotal         bigint not null default 0,
  tax              bigint not null default 0,
  discount         bigint not null default 0,
  total            bigint not null default 0,
  amount_paid      bigint not null default 0,
  notes            text,
  revenue_account_id uuid references public.accounts(id),
  journal_id       uuid references public.journals(id),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, number)
);
create index idx_invoices_org       on public.invoices (organization_id);
create index idx_invoices_customer  on public.invoices (organization_id, customer_id);
create index idx_invoices_status    on public.invoices (organization_id, status);
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function app.touch_updated_at();

create table public.invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  product_id       uuid references public.products(id),
  description      text not null,
  quantity         numeric(16,3) not null default 1,
  unit_price       bigint not null default 0,
  tax_rate         numeric(6,3) not null default 0,   -- percent
  line_total       bigint not null default 0,          -- ex-tax
  created_at       timestamptz not null default now()
);
create index idx_invoice_lines_invoice on public.invoice_lines (invoice_id);

-- ── Expenses (§21) ───────────────────────────────────────────
create type public.expense_recurrence as enum
  ('none', 'daily', 'weekly', 'monthly', 'yearly');

create table public.expenses (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  supplier_id          uuid references public.suppliers(id),
  vendor               text,
  category_account_id  uuid not null references public.accounts(id),
  payment_account_id   uuid references public.accounts(id),  -- null when on credit
  on_credit            boolean not null default false,
  amount               bigint not null check (amount > 0),
  txn_date             date not null,
  description          text,
  recurrence           public.expense_recurrence not null default 'none',
  status               text not null default 'paid',         -- 'paid' | 'unpaid'
  attachment_id        uuid,
  journal_id           uuid references public.journals(id),
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_expenses_org  on public.expenses (organization_id, txn_date);
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function app.touch_updated_at();

-- ── Payments (§20 receipts / settlements) ────────────────────
create type public.payment_direction as enum ('in', 'out');

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  direction        public.payment_direction not null,
  party_type       text,          -- 'customer' | 'supplier'
  party_id         uuid,
  invoice_id       uuid references public.invoices(id),
  amount           bigint not null check (amount > 0),
  method           text,
  bank_account_id  uuid references public.accounts(id),
  txn_date         date not null,
  journal_id       uuid references public.journals(id),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create index idx_payments_org     on public.payments (organization_id, txn_date);
create index idx_payments_invoice on public.payments (invoice_id);

-- ── Inventory movements (§24) ────────────────────────────────
create type public.inventory_txn_type as enum ('purchase', 'sale', 'adjustment');

create table public.inventory_transactions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  product_id       uuid not null references public.products(id),
  type             public.inventory_txn_type not null,
  quantity         numeric(16,3) not null,
  unit_cost        bigint not null default 0,
  note             text,
  journal_id       uuid references public.journals(id),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create index idx_inv_txn_org on public.inventory_transactions (organization_id, product_id);


-- FILE: 20260101000900_sme_rls.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0009 · RLS for SME entities
--
-- Catalogue tables (customers, suppliers, products) allow direct role-gated
-- writes. Ledger-posting tables (invoices, invoice_lines, expenses, payments,
-- inventory_transactions) are read-only to clients; all writes go through the
-- SECURITY DEFINER RPCs in migration 0010.
-- ─────────────────────────────────────────────────────────────

alter table public.customers               enable row level security;
alter table public.suppliers               enable row level security;
alter table public.products                enable row level security;
alter table public.invoices                enable row level security;
alter table public.invoice_lines           enable row level security;
alter table public.expenses                enable row level security;
alter table public.payments                enable row level security;
alter table public.inventory_transactions  enable row level security;

-- Helper macro-style policies: catalogue tables share the same shape.
-- customers
create policy customers_select on public.customers
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());
create policy customers_insert on public.customers
  for insert with check (app.has_org_role(organization_id, array['owner','admin','accountant','staff']));
create policy customers_update on public.customers
  for update using (app.has_org_role(organization_id, array['owner','admin','accountant','staff']))
  with check (app.has_org_role(organization_id, array['owner','admin','accountant','staff']));

-- suppliers
create policy suppliers_select on public.suppliers
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());
create policy suppliers_insert on public.suppliers
  for insert with check (app.has_org_role(organization_id, array['owner','admin','accountant','staff']));
create policy suppliers_update on public.suppliers
  for update using (app.has_org_role(organization_id, array['owner','admin','accountant','staff']))
  with check (app.has_org_role(organization_id, array['owner','admin','accountant','staff']));

-- products
create policy products_select on public.products
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());
create policy products_insert on public.products
  for insert with check (app.has_org_role(organization_id, array['owner','admin','accountant','staff']));
create policy products_update on public.products
  for update using (app.has_org_role(organization_id, array['owner','admin','accountant','staff']))
  with check (app.has_org_role(organization_id, array['owner','admin','accountant','staff']));

-- Read-only (to clients) posting tables — writes are RPC-only.
create policy invoices_select on public.invoices
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());
create policy invoice_lines_select on public.invoice_lines
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());
create policy expenses_select on public.expenses
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());
create policy payments_select on public.payments
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());
create policy inventory_txn_select on public.inventory_transactions
  for select using (organization_id in (select app.current_member_org_ids()) or app.is_platform_admin());


-- FILE: 20260101001000_sme_functions.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0010 · SME posting RPCs
-- Invoices, invoice payments and expenses — each posts through
-- post_journal_entry so the ledger stays the single source of truth.
-- ─────────────────────────────────────────────────────────────

-- ── create_invoice ───────────────────────────────────────────
-- p_lines: [{description, quantity, unit_price, tax_rate, product_id?}]
-- Posts (when not draft): Dr Accounts Receivable (total)
--                         Cr Revenue (subtotal − discount)
--                         Cr Taxes Payable (tax)
create or replace function public.create_invoice(
  p_org                uuid,
  p_customer           uuid,
  p_issue_date         date,
  p_due_date           date,
  p_revenue_account    uuid,
  p_lines              jsonb,
  p_discount           bigint default 0,
  p_notes              text default null,
  p_status             public.invoice_status default 'sent'
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid       uuid := auth.uid();
  v_invoice   uuid := gen_random_uuid();
  v_line      jsonb;
  v_qty       numeric;
  v_price     bigint;
  v_rate      numeric;
  v_line_tot  bigint;
  v_subtotal  bigint := 0;
  v_tax       bigint := 0;
  v_total     bigint;
  v_number    text;
  v_seq       int;
  v_ar        uuid;
  v_taxacct   uuid;
  v_journal   uuid;
begin
  if not app.has_org_role(p_org, array['owner','admin','accountant','staff']) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = p_customer and organization_id = p_org) then
    raise exception 'Invoice needs a valid customer.' using errcode = '23503';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) < 1 then
    raise exception 'An invoice needs at least one line.' using errcode = '22023';
  end if;

  -- Line maths.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty   := coalesce((v_line->>'quantity')::numeric, 1);
    v_price := coalesce((v_line->>'unit_price')::bigint, 0);
    v_rate  := coalesce((v_line->>'tax_rate')::numeric, 0);
    v_line_tot := round(v_qty * v_price);
    v_subtotal := v_subtotal + v_line_tot;
    v_tax := v_tax + round(v_line_tot * v_rate / 100.0);
  end loop;

  v_total := v_subtotal - coalesce(p_discount, 0) + v_tax;
  if v_total <= 0 then
    raise exception 'Invoice total must be greater than zero.' using errcode = '22023';
  end if;

  -- Sequential invoice number per org.
  select count(*) + 1 into v_seq from public.invoices where organization_id = p_org;
  v_number := 'INV-' || lpad(v_seq::text, 4, '0');

  insert into public.invoices
    (id, organization_id, customer_id, number, issue_date, due_date, status,
     subtotal, tax, discount, total, amount_paid, notes, revenue_account_id, created_by)
  values
    (v_invoice, p_org, p_customer, v_number, p_issue_date, p_due_date,
     coalesce(p_status, 'sent'), v_subtotal, v_tax, coalesce(p_discount, 0),
     v_total, 0, p_notes, p_revenue_account, v_uid);

  -- Persist lines.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty   := coalesce((v_line->>'quantity')::numeric, 1);
    v_price := coalesce((v_line->>'unit_price')::bigint, 0);
    v_rate  := coalesce((v_line->>'tax_rate')::numeric, 0);
    v_line_tot := round(v_qty * v_price);
    insert into public.invoice_lines
      (organization_id, invoice_id, product_id, description, quantity, unit_price, tax_rate, line_total)
    values
      (p_org, v_invoice, nullif(v_line->>'product_id','')::uuid,
       coalesce(v_line->>'description','Item'), v_qty, v_price, v_rate, v_line_tot);
  end loop;

  -- Post to the ledger unless it's a draft.
  if coalesce(p_status, 'sent') <> 'draft' then
    select id into v_ar from public.accounts
      where organization_id = p_org and subtype = 'receivable' and is_active order by code limit 1;
    if v_ar is null then
      raise exception 'No Accounts Receivable account found.' using errcode = 'P0002';
    end if;

    declare v_lines jsonb;
    begin
      v_lines := jsonb_build_array(
        jsonb_build_object('account_id', v_ar, 'debit', v_total, 'credit', 0, 'memo', v_number),
        jsonb_build_object('account_id', p_revenue_account, 'debit', 0,
                           'credit', v_subtotal - coalesce(p_discount,0), 'memo', v_number)
      );
      if v_tax > 0 then
        select id into v_taxacct from public.accounts
          where organization_id = p_org and subtype = 'tax' and is_active order by code limit 1;
        if v_taxacct is null then
          raise exception 'No Taxes Payable account found for the tax on this invoice.' using errcode = 'P0002';
        end if;
        v_lines := v_lines || jsonb_build_object('account_id', v_taxacct, 'debit', 0, 'credit', v_tax, 'memo', v_number);
      end if;

      v_journal := public.post_journal_entry(
        p_org, p_issue_date, 'Invoice ' || v_number, v_number, 'invoice', v_invoice, v_lines
      );
      update public.invoices set journal_id = v_journal where id = v_invoice;
    end;
  end if;

  return v_invoice;
end;
$$;

grant execute on function public.create_invoice(
  uuid, uuid, date, date, uuid, jsonb, bigint, text, public.invoice_status
) to authenticated;

-- ── record_invoice_payment ───────────────────────────────────
create or replace function public.record_invoice_payment(
  p_invoice       uuid,
  p_amount        bigint,
  p_bank_account  uuid,
  p_date          date,
  p_method        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_org         uuid;
  v_total       bigint;
  v_paid        bigint;
  v_outstanding bigint;
  v_customer    uuid;
  v_ar          uuid;
  v_journal     uuid;
  v_payment     uuid := gen_random_uuid();
  v_newpaid     bigint;
begin
  select organization_id, total, amount_paid, customer_id
    into v_org, v_total, v_paid, v_customer
  from public.invoices where id = p_invoice;

  if v_org is null then
    raise exception 'Invoice not found.' using errcode = 'P0002';
  end if;
  if not app.has_org_role(v_org, array['owner','admin','accountant','staff']) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'Payment must be greater than zero.' using errcode = '22023';
  end if;

  v_outstanding := v_total - v_paid;
  if p_amount > v_outstanding then
    raise exception 'Payment exceeds the outstanding balance (%).', v_outstanding using errcode = '22023';
  end if;

  select id into v_ar from public.accounts
    where organization_id = v_org and subtype = 'receivable' and is_active order by code limit 1;

  v_journal := public.post_journal_entry(
    v_org, p_date, 'Payment received', null, 'payment', p_invoice,
    jsonb_build_array(
      jsonb_build_object('account_id', p_bank_account, 'debit', p_amount, 'credit', 0),
      jsonb_build_object('account_id', v_ar, 'debit', 0, 'credit', p_amount)
    )
  );

  v_newpaid := v_paid + p_amount;
  update public.invoices
    set amount_paid = v_newpaid,
        status = case when v_newpaid >= v_total then 'paid'::public.invoice_status
                      else 'partly_paid'::public.invoice_status end
    where id = p_invoice;

  insert into public.payments
    (id, organization_id, direction, party_type, party_id, invoice_id,
     amount, method, bank_account_id, txn_date, journal_id, created_by)
  values
    (v_payment, v_org, 'in', 'customer', v_customer, p_invoice,
     p_amount, p_method, p_bank_account, p_date, v_journal, auth.uid());

  return v_payment;
end;
$$;

grant execute on function public.record_invoice_payment(uuid, bigint, uuid, date, text)
  to authenticated;

-- ── record_expense ───────────────────────────────────────────
-- Paid now:  Dr category, Cr payment account.
-- On credit: Dr category, Cr Accounts Payable (creates a payable).
create or replace function public.record_expense(
  p_org               uuid,
  p_category_account  uuid,
  p_amount            bigint,
  p_date              date,
  p_payment_account   uuid default null,
  p_supplier          uuid default null,
  p_vendor            text default null,
  p_description       text default null,
  p_recurrence        public.expense_recurrence default 'none',
  p_on_credit         boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid      uuid := auth.uid();
  v_expense  uuid := gen_random_uuid();
  v_credit   uuid;
  v_journal  uuid;
begin
  if not app.has_org_role(p_org, array['owner','admin','accountant','staff']) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero.' using errcode = '22023';
  end if;

  if p_on_credit then
    select id into v_credit from public.accounts
      where organization_id = p_org and subtype = 'payable' and is_active order by code limit 1;
    if v_credit is null then
      raise exception 'No Accounts Payable account found.' using errcode = 'P0002';
    end if;
  else
    if p_payment_account is null then
      raise exception 'Choose the account this was paid from.' using errcode = '22023';
    end if;
    v_credit := p_payment_account;
  end if;

  v_journal := public.post_journal_entry(
    p_org, p_date, coalesce(nullif(btrim(p_description),''), 'Expense'), null,
    'expense', v_expense,
    jsonb_build_array(
      jsonb_build_object('account_id', p_category_account, 'debit', p_amount, 'credit', 0),
      jsonb_build_object('account_id', v_credit, 'debit', 0, 'credit', p_amount)
    )
  );

  insert into public.expenses
    (id, organization_id, supplier_id, vendor, category_account_id, payment_account_id,
     on_credit, amount, txn_date, description, recurrence, status, journal_id, created_by)
  values
    (v_expense, p_org, p_supplier, p_vendor, p_category_account,
     case when p_on_credit then null else p_payment_account end,
     p_on_credit, p_amount, p_date, p_description, coalesce(p_recurrence,'none'),
     case when p_on_credit then 'unpaid' else 'paid' end, v_journal, v_uid);

  return v_expense;
end;
$$;

grant execute on function public.record_expense(
  uuid, uuid, bigint, date, uuid, uuid, text, text, public.expense_recurrence, boolean
) to authenticated;


-- FILE: 20260101001100_platform.sql
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
    (p_org, v_plan, 'trial', now() + interval '14 days',
     now(), now() + interval '14 days')
  returning id into v_sub;

  return v_sub;
end;
$$;

grant execute on function public.ensure_subscription(uuid) to authenticated;


-- FILE: 20260101001200_platform_rls.sql
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


-- FILE: 20260101001300_notifications_mark_read.sql
-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0013 · Harden notifications updates (security review)
--
-- The previous notifications_update policy let a member UPDATE any column of a
-- notification in their org (content tampering within the org). Replace it with
-- a SECURITY DEFINER RPC that only ever sets read_at, matching the app's
-- "all writes go through RPC" pattern. Clients can no longer update the table
-- directly.
-- ─────────────────────────────────────────────────────────────

drop policy if exists notifications_update on public.notifications;

create or replace function public.mark_notifications_read(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if p_org not in (select app.current_member_org_ids()) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  update public.notifications
    set read_at = now()
    where organization_id = p_org
      and (user_id = auth.uid() or user_id is null)
      and read_at is null;
end;
$$;

grant execute on function public.mark_notifications_read(uuid) to authenticated;


COMMIT;
