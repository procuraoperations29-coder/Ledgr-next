import { ShieldAlert, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { buildManagementAccount } from '@/lib/accounting/management';
import {
  resolvePeriod,
  previousPeriod,
  isPeriodType,
  type PeriodType,
} from '@/lib/accounting/periods';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ReportHeader } from '@/components/reports/report-header';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Management Account' };

export default async function ManagementAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireSession();
  if (!session.canViewReports) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Reports are restricted"
        description="You don't have permission to view financial reports. Ask an admin for access."
      />
    );
  }

  const { period: periodParam } = await searchParams;
  const period: PeriodType = isPeriodType(periodParam) ? periodParam : 'this_month';
  const range = resolvePeriod(period, new Date());
  const prevRange = previousPeriod(period, new Date());
  const currency = session.org.currency;

  const data = await buildManagementAccount(session.org.id, range, prevRange, {
    businessName: session.org.name,
    currency,
  });

  const empty = data.pl.revenue === 0 && data.expenses.length === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <ReportHeader
        title="Management Account"
        rangeLabel={`${data.periodLabel} · prepared by Ledgr`}
        period={period}
        action={
          <Button asChild variant="outline" size="sm">
            <a href={`/reports/management-account/pdf?period=${period}`} target="_blank">
              <Download className="size-4" /> PDF
            </a>
          </Button>
        }
      />

      {empty ? (
        <EmptyState
          title="Nothing to report yet"
          description="Record some activity this period to generate a management account."
        />
      ) : (
        <div className="space-y-6">
          {/* Executive summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Revenue" value={formatMoney(data.pl.revenue, currency)} />
            <Metric
              label="Gross Profit"
              value={formatMoney(data.pl.grossProfit, currency)}
              sub={`${Math.round(data.metrics.grossMargin)}% margin`}
            />
            <Metric
              label="Net Profit"
              value={formatMoney(data.pl.netProfit, currency)}
              sub={`${Math.round(data.metrics.netMargin)}% margin`}
              tone={data.pl.netProfit >= 0 ? 'success' : 'destructive'}
            />
            <Metric label="Cash" value={formatMoney(data.cash, currency)} />
          </div>

          {/* Commentary */}
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Management commentary
              </h2>
              <p className="text-base">{data.summary.headline}</p>
              <ul className="mt-3 space-y-1.5">
                {data.summary.insights.map((ins, i) => (
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
            </CardContent>
          </Card>

          {/* P&L summary */}
          <ReportBlock title="Profit & Loss">
            <StmtRow label="Revenue" value={formatMoney(data.pl.revenue, currency)} />
            <StmtRow label="Cost of sales" value={formatMoney(data.pl.costOfSales, currency)} />
            <StmtRow label="Gross profit" value={formatMoney(data.pl.grossProfit, currency)} strong />
            <StmtRow label="Operating expenses" value={formatMoney(data.pl.operatingExpenses, currency)} />
            <StmtRow label="EBITDA" value={formatMoney(data.metrics.ebitda, currency)} />
            <StmtRow label="Operating profit" value={formatMoney(data.pl.operatingProfit, currency)} strong />
            {data.pl.tax > 0 && <StmtRow label="Tax" value={formatMoney(data.pl.tax, currency)} />}
            <StmtRow label="Net profit" value={formatMoney(data.pl.netProfit, currency)} strong highlight />
          </ReportBlock>

          {/* Balance sheet + cash flow */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ReportBlock title="Balance Sheet">
              <StmtRow label="Total assets" value={formatMoney(data.balanceSheet.assets, currency)} />
              <StmtRow label="Total liabilities" value={formatMoney(data.balanceSheet.liabilities, currency)} />
              <StmtRow label="Total equity" value={formatMoney(data.balanceSheet.equity, currency)} strong />
            </ReportBlock>
            <ReportBlock title="Cash Flow">
              <StmtRow label="Opening cash" value={formatMoney(data.cashFlow.openingCash, currency)} />
              <StmtRow label="Net movement" value={formatMoney(data.cashFlow.netCashFlow, currency)} />
              <StmtRow label="Closing cash" value={formatMoney(data.cashFlow.closingCash, currency)} strong />
            </ReportBlock>
          </div>

          {/* Revenue & expense analysis */}
          <div className="grid gap-4 sm:grid-cols-2">
            <AnalysisBlock
              title="Top revenue"
              icon={TrendingUp}
              items={data.revenue.slice(0, 5)}
              currency={currency}
            />
            <AnalysisBlock
              title="Top expenses"
              icon={TrendingDown}
              items={data.expenses.slice(0, 5)}
              currency={currency}
            />
          </div>

          {/* Working capital */}
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Customers owe you" value={formatMoney(data.receivables, currency)} />
            <Metric label="You owe suppliers" value={formatMoney(data.payables, currency)} />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Prepared by Ledgr on {formatDate(new Date())} · {data.businessName}
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'success' | 'destructive';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 text-lg font-semibold tabular-nums',
            tone === 'success' && 'text-success',
            tone === 'destructive' && 'text-destructive'
          )}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ReportBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
          {title}
        </div>
        <div>{children}</div>
      </CardContent>
    </Card>
  );
}

function StmtRow({
  label,
  value,
  strong,
  highlight,
}: {
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 text-sm',
        strong && 'font-semibold',
        highlight && 'bg-primary/5'
      )}
    >
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function AnalysisBlock({
  title,
  icon: Icon,
  items,
  currency,
}: {
  title: string;
  icon: typeof TrendingUp;
  items: { accountId: string; name: string; plainName: string | null; amount: number }[];
  currency: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.accountId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{it.plainName || it.name}</span>
                <span className="tabular-nums">{formatMoney(it.amount, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
