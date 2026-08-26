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
