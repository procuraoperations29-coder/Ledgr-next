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
