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
