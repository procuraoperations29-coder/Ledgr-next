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
