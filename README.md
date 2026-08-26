# Ledgr

**Know Your Numbers. Run Your Business.**

A lightweight, multi-tenant accounting & management-reporting SaaS for small and
growing businesses. Enter transactions in plain language — Ledgr does the
double-entry accounting in the background and turns your numbers into P&L,
balance sheet, cash flow and monthly management accounts.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Quick start

```bash
pnpm install
cp .env.example .env.local     # fill in Supabase keys when ready
pnpm dev                       # dev server
pnpm test                      # accounting engine tests
```

The app boots without Supabase keys (auth/DB features no-op) so the marketing
site and UI can be developed before the database is wired.

## Stack

Next.js 16 · TypeScript · Tailwind · Supabase (Postgres + RLS + Auth + Storage)
· Recharts · @react-pdf/renderer · Vitest.

## Project layout

```
app/                 Next.js routes (marketing home implemented)
components/ui/        Design-system primitives
lib/accounting/       Reporting engine + transaction mapping (+ tests)
lib/supabase/         Server / browser / service-role clients
supabase/migrations/  Database schema (identity, tenancy, RLS, accounting core)
config/env.ts         Centralised env access
```
