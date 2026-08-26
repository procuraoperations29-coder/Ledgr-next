import { ShieldAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { loadReportBundle } from '@/lib/accounting/report-data';
import {
  getBalanceSheet,
  accountLineItems,
  type LineItem,
} from '@/lib/accounting/reports';
import {
  resolvePeriod,
  isPeriodType,
  type PeriodType,
} from '@/lib/accounting/periods';
import type { Account } from '@/lib/accounting/types';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ReportHeader } from '@/components/reports/report-header';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Balance Sheet' };

const NON_CURRENT_ASSET = new Set(['fixed_asset']);
const NON_CURRENT_LIABILITY = new Set(['loan']);

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireSession();
  if (!session.canViewReports) return <Restricted />;

  const { period: periodParam } = await searchParams;
  const period: PeriodType = isPeriodType(periodParam) ? periodParam : 'this_year';
  const range = resolvePeriod(period, new Date());
  const currency = session.org.currency;

  const { accounts, asAt } = await loadReportBundle(session.org.id, range);
  const lines = asAt.lines;
  const bs = getBalanceSheet(accounts, lines);

  const currentAssets = accountLineItems(
    accounts,
    lines,
    (a: Account) => a.type === 'asset' && !NON_CURRENT_ASSET.has(a.subtype ?? '')
  );
  const nonCurrentAssets = accountLineItems(
    accounts,
    lines,
    (a: Account) => a.type === 'asset' && NON_CURRENT_ASSET.has(a.subtype ?? '')
  );
  const currentLiabilities = accountLineItems(
    accounts,
    lines,
    (a: Account) => a.type === 'liability' && !NON_CURRENT_LIABILITY.has(a.subtype ?? '')
  );
  const nonCurrentLiabilities = accountLineItems(
    accounts,
    lines,
    (a: Account) => a.type === 'liability' && NON_CURRENT_LIABILITY.has(a.subtype ?? '')
  );
  const equityAccounts = accountLineItems(
    accounts,
    lines,
    (a: Account) => a.type === 'equity'
  );

  const empty = lines.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <ReportHeader
        title="Balance Sheet"
        rangeLabel={`As at ${formatDate(range.to)}`}
        period={period}
        action={
          <Badge variant={bs.balanced ? 'success' : 'destructive'}>
            {bs.balanced ? 'Balanced' : 'Out of balance'}
          </Badge>
        }
      />

      {empty ? (
        <EmptyState
          title="Nothing to report yet"
          description="Once you record transactions, your balance sheet will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <dl className="text-sm">
              <Header>Assets</Header>
              <Section title="Current assets" items={currentAssets} currency={currency} />
              {nonCurrentAssets.length > 0 && (
                <Section
                  title="Non-current assets"
                  items={nonCurrentAssets}
                  currency={currency}
                />
              )}
              <Total label="Total assets" value={bs.assets} currency={currency} strong />

              <Header>Liabilities</Header>
              <Section
                title="Current liabilities"
                items={currentLiabilities}
                currency={currency}
              />
              {nonCurrentLiabilities.length > 0 && (
                <Section
                  title="Non-current liabilities"
                  items={nonCurrentLiabilities}
                  currency={currency}
                />
              )}
              <Total
                label="Total liabilities"
                value={bs.liabilities}
                currency={currency}
                strong
              />

              <Header>Equity</Header>
              {equityAccounts.map((it) => (
                <Line
                  key={it.accountId}
                  label={it.plainName || it.name}
                  value={it.amount}
                  currency={currency}
                  indent
                />
              ))}
              <Line
                label="Retained earnings (current & prior years)"
                value={bs.retainedProfit}
                currency={currency}
                indent
              />
              <Total label="Total equity" value={bs.equity} currency={currency} strong />

              <div className="flex items-center justify-between bg-primary/5 px-4 py-3 text-base font-semibold">
                <span>Liabilities + Equity</span>
                <span className="tabular-nums">
                  {formatMoney(bs.liabilities + bs.equity, currency)}
                </span>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-secondary px-4 py-2.5 text-sm font-semibold">
      {children}
    </div>
  );
}

function Section({
  title,
  items,
  currency,
}: {
  title: string;
  items: LineItem[];
  currency: string;
}) {
  return (
    <>
      <div className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-2 pl-6 text-muted-foreground">None</div>
      ) : (
        items.map((it) => (
          <Line
            key={it.accountId}
            label={it.plainName || it.name}
            value={it.amount}
            currency={currency}
            indent
          />
        ))
      )}
    </>
  );
}

function Line({
  label,
  value,
  currency,
  indent,
}: {
  label: string;
  value: number;
  currency: string;
  indent?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-2', indent && 'pl-6')}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatMoney(value, currency)}</span>
    </div>
  );
}

function Total({
  label,
  value,
  currency,
  strong,
}: {
  label: string;
  value: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-border px-4 py-2.5',
        strong ? 'font-semibold' : 'font-medium'
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(value, currency)}</span>
    </div>
  );
}

function Restricted() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Reports are restricted"
      description="You don't have permission to view financial reports. Ask an admin for access."
    />
  );
}
