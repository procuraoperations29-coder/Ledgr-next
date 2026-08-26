-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0004 · Accounting core (ledger truth)
--
-- Money is stored everywhere as INTEGER minor units (kobo) — never floats.
-- The ledger is append-only: posted journals are immutable and are corrected
-- by reversal, never edited or deleted (§9, §10, §40).
-- ─────────────────────────────────────────────────────────────

create type public.account_type as enum
  ('asset', 'liability', 'equity', 'revenue', 'cost_of_sales', 'expense');

create type public.normal_balance as enum ('debit', 'credit');

create type public.journal_status as enum ('draft', 'posted', 'reversed');

create type public.journal_source as enum
  ('transaction', 'invoice', 'payment', 'expense', 'opening',
   'manual', 'reversal', 'inventory');

create type public.txn_type as enum
  ('money_received', 'money_spent', 'transfer', 'sale', 'purchase',
   'customer_payment', 'supplier_payment', 'loan_received', 'loan_repayment',
   'owner_investment', 'owner_withdrawal', 'other');

create type public.txn_status as enum ('draft', 'posted', 'reversed');

create type public.period_status as enum ('open', 'closed');

-- ── Chart of Accounts ────────────────────────────────────────
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  code             text not null,
  name             text not null,        -- accountant-facing name
  plain_name       text,                 -- SME-friendly label (§2)
  type             public.account_type not null,
  subtype          text,                 -- 'cash','bank','receivable','payable',...
  normal_balance   public.normal_balance not null,
  parent_id        uuid references public.accounts(id),
  is_bank_or_cash  boolean not null default false,
  is_system        boolean not null default false,  -- default CoA, protected
  is_active        boolean not null default true,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, code)
);
create index idx_accounts_org       on public.accounts (organization_id);
create index idx_accounts_org_type  on public.accounts (organization_id, type);

create trigger trg_accounts_updated
  before update on public.accounts
  for each row execute function app.touch_updated_at();

-- ── Accounting periods (month/quarter/year awareness, §42-43) ─
create table public.accounting_periods (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  period_start     date not null,
  period_end       date not null,
  status           public.period_status not null default 'open',
  closed_by        uuid references auth.users(id),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, period_start, period_end)
);
create index idx_periods_org on public.accounting_periods (organization_id);

-- ── Journals (double-entry header) ───────────────────────────
create table public.journals (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  entry_date              date not null,
  description             text,
  reference               text,
  source_type             public.journal_source not null default 'manual',
  source_id               uuid,
  status                  public.journal_status not null default 'draft',
  reverses_journal_id     uuid references public.journals(id),
  reversed_by_journal_id  uuid references public.journals(id),
  posted_at               timestamptz,
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_journals_org_date   on public.journals (organization_id, entry_date);
create index idx_journals_org_status on public.journals (organization_id, status);
create index idx_journals_source     on public.journals (organization_id, source_type, source_id);

create trigger trg_journals_updated
  before update on public.journals
  for each row execute function app.touch_updated_at();

-- ── Journal lines (the debits & credits) ─────────────────────
create table public.journal_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  journal_id       uuid not null references public.journals(id) on delete cascade,
  account_id       uuid not null references public.accounts(id),
  debit            bigint not null default 0 check (debit >= 0),
  credit           bigint not null default 0 check (credit >= 0),
  memo             text,
  created_at       timestamptz not null default now(),
  -- Exactly one of debit/credit must be positive.
  constraint chk_one_sided check ((debit = 0) <> (credit = 0))
);
create index idx_jlines_journal     on public.journal_lines (journal_id);
create index idx_jlines_org_account on public.journal_lines (organization_id, account_id);

-- ── Transactions (SME-friendly layer over the ledger, §7-8) ──
create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  type                 public.txn_type not null,
  txn_date             date not null,
  amount               bigint not null check (amount > 0),  -- minor units
  account_id           uuid references public.accounts(id),          -- money account
  category_account_id  uuid references public.accounts(id),          -- income/expense category
  counterparty_type    text,        -- 'customer' | 'supplier' | 'other'
  counterparty_id      uuid,
  description          text,
  reference            text,
  attachment_id        uuid,
  journal_id           uuid references public.journals(id),
  status               public.txn_status not null default 'posted',
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_txn_org_date on public.transactions (organization_id, txn_date);
create index idx_txn_org_type on public.transactions (organization_id, type);

create trigger trg_txn_updated
  before update on public.transactions
  for each row execute function app.touch_updated_at();

-- ── Immutability guards ──────────────────────────────────────
-- Lines of a POSTED journal cannot be inserted, changed or removed.
create or replace function app.guard_journal_lines()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  v_status public.journal_status;
begin
  select status into v_status
  from public.journals
  where id = coalesce(new.journal_id, old.journal_id);

  if v_status = 'posted' then
    raise exception 'Cannot modify lines of a posted journal — reverse it instead.'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_guard_jlines
  before insert or update or delete on public.journal_lines
  for each row execute function app.guard_journal_lines();

-- A posted journal is immutable except for being linked to its reversal.
create or replace function app.guard_journals()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Posted journals cannot be deleted — reverse it instead.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status = 'posted' then
    if new.entry_date      is distinct from old.entry_date
       or new.organization_id is distinct from old.organization_id
       or new.source_type  is distinct from old.source_type
       or new.source_id    is distinct from old.source_id then
      raise exception 'Posted journals are immutable.' using errcode = '23514';
    end if;
    if new.status not in ('posted', 'reversed') then
      raise exception 'Invalid status transition for a posted journal.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_journals
  before update or delete on public.journals
  for each row execute function app.guard_journals();
