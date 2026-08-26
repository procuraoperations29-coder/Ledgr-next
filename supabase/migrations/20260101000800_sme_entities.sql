-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0008 · SME entities (customers, suppliers, invoices,
-- expenses, payments, products, inventory)
-- Money is integer minor units (kobo). Quantities are numeric.
-- ─────────────────────────────────────────────────────────────

-- ── Customers & Suppliers ────────────────────────────────────
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  email            citext,
  phone            text,
  address          text,
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_customers_org on public.customers (organization_id);
create trigger trg_customers_updated before update on public.customers
  for each row execute function app.touch_updated_at();

create table public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  email            citext,
  phone            text,
  address          text,
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_suppliers_org on public.suppliers (organization_id);
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function app.touch_updated_at();

-- ── Products (catalogue + light inventory, §24) ──────────────
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  sku              text,
  cost_price       bigint not null default 0,
  sell_price       bigint not null default 0,
  track_inventory  boolean not null default false,
  qty_on_hand      numeric(16,3) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_products_org on public.products (organization_id);
create unique index idx_products_sku on public.products (organization_id, sku)
  where sku is not null;
create trigger trg_products_updated before update on public.products
  for each row execute function app.touch_updated_at();

-- ── Invoices (§20) ───────────────────────────────────────────
create type public.invoice_status as enum
  ('draft', 'sent', 'partly_paid', 'paid', 'void');

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  customer_id      uuid not null references public.customers(id),
  number           text not null,
  issue_date       date not null,
  due_date         date,
  status           public.invoice_status not null default 'sent',
  subtotal         bigint not null default 0,
  tax              bigint not null default 0,
  discount         bigint not null default 0,
  total            bigint not null default 0,
  amount_paid      bigint not null default 0,
  notes            text,
  revenue_account_id uuid references public.accounts(id),
  journal_id       uuid references public.journals(id),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, number)
);
create index idx_invoices_org       on public.invoices (organization_id);
create index idx_invoices_customer  on public.invoices (organization_id, customer_id);
create index idx_invoices_status    on public.invoices (organization_id, status);
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function app.touch_updated_at();

create table public.invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  product_id       uuid references public.products(id),
  description      text not null,
  quantity         numeric(16,3) not null default 1,
  unit_price       bigint not null default 0,
  tax_rate         numeric(6,3) not null default 0,   -- percent
  line_total       bigint not null default 0,          -- ex-tax
  created_at       timestamptz not null default now()
);
create index idx_invoice_lines_invoice on public.invoice_lines (invoice_id);

-- ── Expenses (§21) ───────────────────────────────────────────
create type public.expense_recurrence as enum
  ('none', 'daily', 'weekly', 'monthly', 'yearly');

create table public.expenses (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  supplier_id          uuid references public.suppliers(id),
  vendor               text,
  category_account_id  uuid not null references public.accounts(id),
  payment_account_id   uuid references public.accounts(id),  -- null when on credit
  on_credit            boolean not null default false,
  amount               bigint not null check (amount > 0),
  txn_date             date not null,
  description          text,
  recurrence           public.expense_recurrence not null default 'none',
  status               text not null default 'paid',         -- 'paid' | 'unpaid'
  attachment_id        uuid,
  journal_id           uuid references public.journals(id),
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_expenses_org  on public.expenses (organization_id, txn_date);
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function app.touch_updated_at();

-- ── Payments (§20 receipts / settlements) ────────────────────
create type public.payment_direction as enum ('in', 'out');

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  direction        public.payment_direction not null,
  party_type       text,          -- 'customer' | 'supplier'
  party_id         uuid,
  invoice_id       uuid references public.invoices(id),
  amount           bigint not null check (amount > 0),
  method           text,
  bank_account_id  uuid references public.accounts(id),
  txn_date         date not null,
  journal_id       uuid references public.journals(id),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create index idx_payments_org     on public.payments (organization_id, txn_date);
create index idx_payments_invoice on public.payments (invoice_id);

-- ── Inventory movements (§24) ────────────────────────────────
create type public.inventory_txn_type as enum ('purchase', 'sale', 'adjustment');

create table public.inventory_transactions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  product_id       uuid not null references public.products(id),
  type             public.inventory_txn_type not null,
  quantity         numeric(16,3) not null,
  unit_cost        bigint not null default 0,
  note             text,
  journal_id       uuid references public.journals(id),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create index idx_inv_txn_org on public.inventory_transactions (organization_id, product_id);
