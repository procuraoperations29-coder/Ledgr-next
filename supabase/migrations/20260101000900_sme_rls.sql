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
