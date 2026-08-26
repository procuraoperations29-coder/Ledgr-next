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
