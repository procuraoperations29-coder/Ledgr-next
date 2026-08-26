import { ShieldAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { loadReportBundle } from '@/lib/accounting/report-data';
import {
  getProfitAndLoss,
  accountLineItems,
  type LineItem,
} from '@/lib/accounting/reports';
import {
  resolvePeriod,
  isPeriodType,
  type PeriodType,
} from '@/lib/accounting/periods';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { ReportHeader } from '@/components/reports/report-header';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Profit & Loss' };

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireSession();
  if (!session.canViewReports) return <Restricted />;

  const { period: periodParam } = await searchParams;
  const period: PeriodType = isPeriodType(periodParam) ? periodParam : 'this_month';
  const range = resolvePeriod(period, new Date());
  const currency = session.org.currency;

  const { accounts, period: ledger } = await loadReportBundle(session.org.id, range);
  const lines = ledger.lines;
  const pl = getProfitAndLoss(accounts, lines);

  const revenue = accountLineItems(accounts, lines, (a) => a.type === 'revenue', {
    byAmount: true,
  });
  const cogs = accountLineItems(accounts, lines, (a) => a.type === 'cost_of_sales', {
    byAmount: true,
  });
  const opex = accountLineItems(accounts, lines, (a) => a.type === 'expense', {
    byAmount: true,
  });

  const empty = revenue.length === 0 && cogs.length === 0 && opex.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <ReportHeader title="Profit & Loss" rangeLabel={range.label} period={period} />

      {empty ? (
        <EmptyState
          title="Nothing to report yet"
          description="Record sales and expenses in this period to see your profit and loss."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <dl className="text-sm">
              <SectionRows title="Revenue" items={revenue} currency={currency} />
              <Total label="Total revenue" value={pl.revenue} currency={currency} />

              {cogs.length > 0 && (
                <>
                  <SectionRows title="Cost of Sales" items={cogs} currency={currency} />
                  <Total label="Total cost of sales" value={pl.costOfSales} currency={currency} />
                </>
              )}

              <Total label="Gross Profit" value={pl.grossProfit} currency={currency} strong />

              <SectionRows title="Operating Expenses" items={opex} currency={currency} />
              <Total
                label="Total operating expenses"
                value={pl.operatingExpenses}
                currency={currency}
              />

              <Total label="Operating Profit" value={pl.operatingProfit} currency={currency} strong />

              {pl.financeCosts > 0 && (
                <Line label="Finance costs" value={pl.financeCosts} currency={currency} />
              )}
              {pl.tax > 0 && <Line label="Tax" value={pl.tax} currency={currency} />}

              <div className="flex items-center justify-between bg-primary/5 px-4 py-3 text-base font-semibold">
                <span>Net Profit</span>
                <span
                  className={cn(
                    'tabular-nums',
                    pl.netProfit < 0 && 'text-destructive'
                  )}
                >
                  {formatMoney(pl.netProfit, currency)}
                </span>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectionRows({
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
      <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-2.5 text-muted-foreground">None</div>
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
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5',
        indent && 'pl-6'
      )}
    >
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
