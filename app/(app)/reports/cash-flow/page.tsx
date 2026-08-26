import { ShieldAlert, ArrowDownUp, Landmark, Building2 } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { loadReportBundle } from '@/lib/accounting/report-data';
import { getCashFlow } from '@/lib/accounting/reports';
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

export const metadata = { title: 'Cash Flow' };

export default async function CashFlowPage({
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
  const currency = session.org.currency;

  const { accounts, period: ledger, openingCash } = await loadReportBundle(
    session.org.id,
    range
  );
  const cf = getCashFlow(accounts, ledger.lines, ledger.byJournal, openingCash);
  const empty = ledger.lines.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <ReportHeader title="Cash Flow" rangeLabel={range.label} period={period} />

      {empty ? (
        <EmptyState
          title="No cash movements yet"
          description="Record money coming in and going out to see your cash flow."
        />
      ) : (
        <Card>
          <CardContent className="space-y-1 p-0">
            <Row label="Opening cash" value={cf.openingCash} currency={currency} muted />

            <Group
              icon={ArrowDownUp}
              title="Operating activities"
              value={cf.operating}
              currency={currency}
            />
            <Group
              icon={Building2}
              title="Investing activities"
              value={cf.investing}
              currency={currency}
            />
            <Group
              icon={Landmark}
              title="Financing activities"
              value={cf.financing}
              currency={currency}
            />

            <div className="flex items-center justify-between border-t border-border px-4 py-3 font-medium">
              <span>Net cash flow</span>
              <span
                className={cn(
                  'tabular-nums',
                  cf.netCashFlow >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {formatMoney(cf.netCashFlow, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-primary/5 px-4 py-3 text-base font-semibold">
              <span>Closing cash</span>
              <span className="tabular-nums">
                {formatMoney(cf.closingCash, currency)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  value,
  currency,
}: {
  icon: typeof Landmark;
  title: string;
  value: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </span>
        {title}
      </span>
      <span
        className={cn(
          'tabular-nums',
          value > 0 && 'text-success',
          value < 0 && 'text-destructive'
        )}
      >
        {formatMoney(value, currency)}
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  muted,
}: {
  label: string;
  value: number;
  currency: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className="tabular-nums">{formatMoney(value, currency)}</span>
    </div>
  );
}
