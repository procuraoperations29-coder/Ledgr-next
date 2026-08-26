# Ledgr — Architecture

> **Know Your Numbers. Run Your Business.**
> A multi-tenant accounting & management-reporting SaaS for small businesses.

Priority order when trade-offs arise:
**Accounting correctness → security → multi-tenancy → usability → visual polish.**

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions), React 18, TypeScript |
| Styling | Tailwind CSS + design tokens (`app/globals.css`), Radix primitives |
| Data | Supabase — PostgreSQL, **Row-Level Security**, Auth, Storage |
| Charts | Recharts |
| PDF | `@react-pdf/renderer` (management-account PDFs) |
| Validation | Zod |
| Tests | Vitest (accounting engine), + DB integration tests when keys wired |

Deployment target: **Vercel + Supabase (managed Postgres)**.

---

## Principles (mandatory)

1. Simple for business owners.
2. Powerful enough for accountants (Accountant Mode).
3. Accounting complexity lives in the backend, never in the user's face.
4. **Every financial report derives from the same ledger** (`journal_lines`).
5. **Never compromise tenant isolation** — enforced by Postgres RLS.
6. Mobile-first.
7. Reports explain the business, not just display numbers.

---

## Multi-tenancy & security

- Every tenant row carries `organization_id`. Tenant context is **derived from
  the authenticated session**, never trusted from the client.
- RLS is ON for every table; **no policy = deny**. Policies are expressed via
  `SECURITY DEFINER` helpers in the `app` schema:
  - `app.current_member_org_ids()` — orgs the caller actively belongs to.
  - `app.has_org_role(org, roles[])` — RBAC gate.
  - `app.can_view_reports(org)` — financial-report visibility (§25 staff rule).
  - `app.is_platform_admin()` — Ledgr operator access.
- Platform-admin / billing-webhook paths use the service-role client
  (`lib/supabase/service-role.ts`) and must be audited.

### RBAC roles
`owner` · `admin` · `accountant` · `staff` · `viewer`
Staff can record transactions but only see reports if `can_view_reports` is set.

---

## Accounting engine (the core)

Two layers, **one source of truth**:

1. **Ledger truth** — `journals` (header) + `journal_lines` (debit/credit).
   - Money is integer **minor units (kobo)**, never floats.
   - Line constraint: exactly one of `debit`/`credit` is positive.
   - Posting happens **only** through `post_journal_entry()`, which validates
     `Σdebit = Σcredit` inside one transaction before status → `posted`. An
     unbalanced entry is impossible to post.
   - Posted journals/lines are **immutable** (triggers block edit/delete).
     Corrections use `reverse_journal()` / `reverse_transaction()` which append
     a mirror entry. Nothing financial is ever hard-deleted.
2. **Friendly layer** — `transactions` records the SME-facing action
   ("Money Spent", amount, paid-from, category…). `record_transaction()` maps
   the transaction type → the correct debit/credit accounts and posts a journal.

### Transaction → debit/credit mapping
`p_account_id` is always the bank/cash account; `p_category_account_id` is the
counter account (revenue, expense, AR, AP, loan, capital…).

| Type group | Debit | Credit |
|---|---|---|
| money in (received, sale, customer_payment, loan_received, owner_investment) | cash/bank | counter |
| money out (spent, purchase, supplier_payment, loan_repayment, owner_withdrawal, other) | counter | cash/bank |
| transfer | destination | source |

The TypeScript mirror lives in `lib/accounting/transaction-map.ts` (drives UI
hints + tests). **The database is the runtime source of truth.**

### Reporting engine (`lib/accounting/reports.ts`)
Pure functions over ledger lines: `getTrialBalance`, `getProfitAndLoss`,
`getBalanceSheet`, `getCashFlow`, `getReceivables`, `getPayables`,
`getCashPosition`. Balance-sheet equity folds in accumulated P&L so
**Assets = Liabilities + Equity** always holds (proven in tests).

---

## Database schema (implemented so far)

**Identity/tenancy:** `organizations`, `organization_members`, `profiles`,
`platform_admins` + `create_organization()` RPC.

**Accounting core:** `accounts` (chart of accounts), `accounting_periods`,
`journals`, `journal_lines`, `transactions` + engine RPCs
(`post_journal_entry`, `record_transaction`, `reverse_journal`,
`reverse_transaction`, `account_balance`, `seed_default_accounts`).

Migrations live in `supabase/migrations/` (ordered). PKs are UUID; every tenant
table is indexed on `organization_id` and hot columns
(`+ entry_date`, `+ account_id`, `+ type`).

_Planned (later phases):_ `customers`, `suppliers`, `invoices`, `invoice_lines`,
`payments`, `expenses`, `bank_reconciliations`, `bank_statement_lines`,
`products`, `inventory_transactions`, `plans`, `subscriptions`,
`billing_payments`, `notifications`, `audit_logs`, `attachments`,
`support_tickets`, `settings`.

---

## App structure (planned route groups)

- `(marketing)` — public site (home ✅, features, pricing, how-it-works, FAQ)
- `(auth)` — sign up / log in / reset / verify
- `(onboarding)` — 6-step business setup wizard
- `(app)` — business console: dashboard, transactions, sales, expenses,
  customers, suppliers, bank & cash, inventory, reports, management accounts,
  settings. Desktop sidebar; mobile bottom-nav + FAB.
- `(admin)` — platform operator console: organisations, metrics, support, audit.

---

## Delivery phases

- **Phase 1 — Foundation** ✅ config, DB identity + tenancy + RLS, accounting
  core schema + engine RPCs, default chart of accounts, reporting engine +
  passing tests, design-system primitives, marketing home.
- **Phase 2 — Accounting core (UI)** ✅ auth (sign up / log in / reset / verify
  + email callback), 4-step onboarding wizard (creates org, seeds chart, posts
  opening balances), app shell (sidebar + mobile nav + FAB), Record Transaction
  flow, transactions feed, chart of accounts (add/archive + live balances),
  Trial Balance & General Ledger reports.
- **Phase 3 — SME features** ✅ customers, suppliers, invoices (create → Dr AR /
  Cr Revenue + Tax; detail + record payment → Dr Cash / Cr AR), expenses (paid or
  on-credit → AP), bank & cash accounts with live balances, light inventory
  (products + stock value). Posting via `create_invoice` /
  `record_invoice_payment` / `record_expense` RPCs; 6 more engine tests.
- **Phase 4 — Reporting** ✅ period-aware P&L, Balance Sheet, Cash Flow report
  pages; Management Account (executive summary + commentary + statements) with a
  professional **PDF export** (`@react-pdf/renderer`); rule-based business-health
  insights on the dashboard (§12); period selector (month/quarter/year, FY-aware).
  +11 engine tests (periods, cash-flow identity, PDF render).
- **Phase 5 — Platform** subscriptions, payment abstraction (Paystack /
  Flutterwave), admin dashboard + metrics, support, notifications, audit logs.
- **Phase 6 — Polish** mobile, CSV import, perf, error handling, hardening.

---

## Testing

`pnpm test` runs the Vitest accounting suite (`lib/accounting/*.test.ts`),
covering §64: balanced entries, P&L identity, Balance-Sheet identity, cash-flow
reconciliation, invoice→receivable+revenue, payment, expense, loan, owner
capital/drawings. **Tenant isolation** is an RLS behaviour, covered by a DB
integration test (`tests/tenant-isolation.test.ts`) once Supabase keys are set.

---

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill from your Supabase project
pnpm dev                     # http://localhost:3000 (we use 3001 to avoid clashes)
pnpm test                    # accounting engine
```
