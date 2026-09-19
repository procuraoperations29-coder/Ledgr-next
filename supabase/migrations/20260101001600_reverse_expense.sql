-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0016 · Delete (reverse) an expense
--
-- Expenses live in their own table (public.expenses) with their own
-- journal entry — reverse_transaction() only knows about
-- public.transactions, so it can't be reused here. This mirrors it:
-- posts an offsetting journal entry via the existing reverse_journal()
-- (which already enforces owner/admin/accountant-only), then marks the
-- expense itself 'reversed' so it drops out of expense totals/reports.
-- ─────────────────────────────────────────────────────────────

create or replace function public.reverse_expense(
  p_expense uuid,
  p_reason  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_org     uuid;
  v_journal uuid;
  v_status  text;
  v_rev     uuid;
begin
  select organization_id, journal_id, status into v_org, v_journal, v_status
  from public.expenses where id = p_expense;

  if v_org is null then
    raise exception 'Expense not found.' using errcode = 'P0002';
  end if;
  if v_status = 'reversed' then
    raise exception 'This expense has already been deleted.' using errcode = '23514';
  end if;

  -- reverse_journal() itself checks the caller is an owner/admin/accountant
  -- for this org, so authorisation happens there.
  v_rev := public.reverse_journal(v_journal, current_date, p_reason);
  update public.expenses set status = 'reversed' where id = p_expense;
  return v_rev;
end;
$$;

grant execute on function public.reverse_expense(uuid, text) to authenticated;
