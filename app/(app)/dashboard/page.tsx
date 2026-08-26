import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Plus,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts, getLedgerLines, getTransactions } from '@/lib/accounting/queries';
import {
  getProfitAndLoss,
  getCashPosition,
  getReceivables,
  getPayables,
  getExpenseBreakdown,
} from '@/lib/accounting/reports';
import { generateHealthSummary } from '@/lib/accounting/insights';
import { resolvePeriod, previousPeriod } from '@/lib/accounting/periods';
import { moneyDirection, TRANSACTION_LABELS } from '@/lib/accounting/transaction-map';
import type { TransactionType } from '@/lib/accounting/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const orgId = membership?.organizationId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const monthName = now.toLocaleString('en-NG', { month: 'long' });

  const prevMonth = previousPeriod('this_month', now);

  const [accounts, all, month, prev, recent] = orgId
    ? await Promise.all([
        getAccounts(orgId),
        getLedgerLines(orgId),
        getLedgerLines(orgId, { from: monthStart, to: today }),
        getLedgerLines(orgId, { from: prevMonth.from, to: prevMonth.to }),
        getTransactions(orgId, { limit: 6 }),
      ])
    : [
        [],
        { lines: [], byJournal: new Map() },
        { lines: [], byJournal: new Map() },
        { lines: [], byJournal: new Map() },
        [],
      ];

  const cash = getCashPosition(accounts, all.lines);
  const receivables = getReceivables(accounts, all.lines);
  const payables = getPayables(accounts, all.lines);
  const pl = getProfitAndLoss(accounts, month.lines);
  const prevPl = getProfitAndLoss(accounts, prev.lines);
  const expenses =
    pl.costOfSales + pl.operatingExpenses + pl.financeCosts + pl.tax;

  const hasActivity = all.lines.length > 0;
  const health = generateHealthSummary({
    pl,
    prevPl,
    expenses: getExpenseBreakdown(accounts, month.lines),
    receivables,
    cash,
    periodLabel: monthName,
    currency,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {membership?.organization.name ?? 'Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s how your business is doing.
          </p>
        </div>
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/transactions/new">
            <Plus className="size-4" /> Record Transaction
          </Link>
        </Button>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Cash Balance"
          value={formatMoney(cash, currency)}
          tone="primary"
        />
        <StatCard
          icon={TrendingUp}
          label={`Revenue · ${monthName}`}
          value={formatMoney(pl.revenue, currency)}
          tone="success"
        />
        <StatCard
          icon={TrendingDown}
          label={`Expenses · ${monthName}`}
          value={formatMoney(expenses, currency)}
        />
        <StatCard
          icon={PiggyBank}
          label={`Net Profit · ${monthName}`}
          value={formatMoney(pl.netProfit, currency)}
          tone={pl.netProfit >= 0 ? 'success' : 'destructive'}
        />
      </div>

      {/* Business health (§12) */}
      {hasActivity && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> How your business is doing
            </h2>
            <p className="text-base">{health.headline}</p>
            {health.insights.length > 0 && (
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {health.insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        ins.tone === 'positive' && 'bg-success',
                        ins.tone === 'negative' && 'bg-destructive',
                        ins.tone === 'neutral' && 'bg-muted-foreground'
                      )}
                    />
                    <span className="text-muted-foreground">{ins.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <a
              href="/reports/management-account"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              View full management account →
            </a>
          </CardContent>
        </Card>
      )}

      {/* Receivables / payables */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <ArrowDownRight className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customers owe you</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(receivables, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <ArrowUpRight className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You owe suppliers</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(payables, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent transactions</h2>
            <Link
              href="/transactions"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {!hasActivity ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="No transactions yet"
              description="Record your first transaction to see your numbers come to life."
              action={
                <Button asChild>
                  <Link href="/transactions/new">
                    <Plus className="size-4" /> Record Transaction
                  </Link>
                </Button>
              }
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => {
                const dir = moneyDirection(r.type as TransactionType);
                return (
                  <li key={r.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {r.description ||
                          TRANSACTION_LABELS[r.type as TransactionType]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.txn_date, 'short')} ·{' '}
                        {r.account?.plain_name || r.account?.name}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        dir === 'in' ? 'text-success' : 'text-foreground'
                      )}
                    >
                      {dir === 'in' ? '+' : dir === 'out' ? '−' : ''}
                      {formatMoney(r.amount, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'destructive';
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div
          className={cn(
            'mb-3 grid h-9 w-9 place-items-center rounded-lg',
            tone === 'primary' && 'bg-primary/10 text-primary',
            tone === 'success' && 'bg-success/12 text-success',
            tone === 'destructive' && 'bg-destructive/10 text-destructive',
            !tone && 'bg-secondary text-secondary-foreground'
          )}
        >
          <Icon className="size-5" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
