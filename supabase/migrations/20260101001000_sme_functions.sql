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
