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
