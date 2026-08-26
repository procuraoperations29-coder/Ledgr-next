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
