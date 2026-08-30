import Link from 'next/link';
import { ShieldAlert, Sparkles, TrendingUp, LineChart } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { getOrgPlan, planHasForecast } from '@/lib/plan';
import { getForecastData } from '@/lib/accounting/forecast-data';
import { buildForecast, type MonthPoint, type ForecastMonth } from '@/lib/accounting/forecast';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: '12-Month Forecast' };

export default async function ForecastPage() {
  const session = await requireSession();
  if (!session.canViewReports) return <Restricted />;

  const plan = await getOrgPlan(session.org.id);
  if (!planHasForecast(plan)) return <Upsell />;

  const currency = session.org.currency;
  const { history, futureLabels } = await getForecastData(session.org.id, new Date());
  const f = buildForecast(history, futureLabels);

  if (f.method === 'insufficient') {
    return (
      <div className="mx-auto max-w-3xl">
        <Header />
        <EmptyState
          icon={LineChart}
          title="Not enough history yet"
          description="Record a few months of sales and expenses and your 12-month forecast will appear here automatically."
        />
      </div>
    );
  }

  const growth = f.revenueGrowthPct;

  return (
    <div className="mx-auto max-w-3xl">
      <Header />

      {/* Summary */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Projected revenue"
          hint="Next 12 months"
          value={formatMoney(f.projectedRevenue, currency, { decimals: false })}
          trend={growth}
        />
        <Stat
          label="Projected expenses"
          hint="Next 12 months"
          value={formatMoney(f.projectedExpenses, currency, { decimals: false })}
        />
        <Stat
          label="Projected net profit"
          hint="Next 12 months"
          value={formatMoney(f.projectedNetProfit, currency, { decimals: false })}
          negative={f.projectedNetProfit < 0}
        />
      </div>

      {/* Chart */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
            <Legend className="bg-primary" label="Actual net profit" />
            <Legend className="bg-primary/40" label="Forecast" dashed />
          </div>
          <NetProfitChart history={f.history} projection={f.projection} currency={currency} />
        </CardContent>
      </Card>

      {/* Month-by-month table */}
      <Card className="mb-5">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Month</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Expenses</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net profit</th>
                </tr>
              </thead>
              <tbody>
                {f.history.map((m) => (
                  <Row key={m.ym} m={m} currency={currency} />
                ))}
                <tr>
                  <td colSpan={4} className="border-y border-border bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Forecast
                  </td>
                </tr>
                {f.projection.map((m) => (
                  <Row key={m.ym} m={m} currency={currency} forecast />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {f.method === 'trend' ? (
          <>
            Based on a straight-line trend fitted to your last {f.monthsOfData} month
            {f.monthsOfData === 1 ? '' : 's'} of actual figures
            {f.avgMonthlyGrowthPct !== null && (
              <> (average revenue growth {f.avgMonthlyGrowthPct >= 0 ? '+' : ''}{f.avgMonthlyGrowthPct.toFixed(1)}% per month)</>
            )}
            . This is a projection, not a guarantee — treat it as a planning guide and revisit it as new months post.
          </>
        ) : (
          <>
            Based on the average of your {f.monthsOfData} month{f.monthsOfData === 1 ? '' : 's'} of
            actual figures. Once you have three or more months of history, Ledgr switches to a trend-based
            projection. Treat this as a planning guide, not a guarantee.
          </>
        )}
      </p>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">12-Month Forecast</h1>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3" /> Growth
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Where your revenue, expenses and profit are heading — built from your own ledger.
        </p>
      </div>
    </div>
  );
}

function Row({
  m,
  currency,
  forecast,
}: {
  m: MonthPoint | ForecastMonth;
  currency: string;
  forecast?: boolean;
}) {
  return (
    <tr className={cn('border-b border-border last:border-0', forecast && 'text-muted-foreground')}>
      <td className="px-4 py-2.5 font-medium">{m.label}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(m.revenue, currency, { decimals: false })}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(m.expenses, currency, { decimals: false })}</td>
      <td className={cn('px-4 py-2.5 text-right font-medium tabular-nums', m.netProfit < 0 && 'text-destructive')}>
        {formatMoney(m.netProfit, currency, { decimals: false })}
      </td>
    </tr>
  );
}

function Stat({
  label,
  hint,
  value,
  trend,
  negative,
}: {
  label: string;
  hint: string;
  value: string;
  trend?: number | null;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-semibold tabular-nums', negative && 'text-destructive')}>{value}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{hint}</span>
          {trend !== undefined && trend !== null && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', trend >= 0 ? 'text-success' : 'text-destructive')}>
              <TrendingUp className={cn('size-3', trend < 0 && 'rotate-180')} />
              {trend >= 0 ? '+' : ''}{trend.toFixed(0)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ className, label, dashed }: { className: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-4 rounded-full', className, dashed && 'opacity-70')} />
      {label}
    </span>
  );
}

/** Server-rendered SVG line chart of net profit: solid history, dashed forecast. */
function NetProfitChart({
  history,
  projection,
  currency,
}: {
  history: MonthPoint[];
  projection: ForecastMonth[];
  currency: string;
}) {
  const all = [...history, ...projection];
  const W = 720;
  const H = 220;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 22;
  const n = all.length;

  const values = all.map((m) => m.netProfit);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1);
  const y = (v: number) => padT + ((max - v) * (H - padT - padB)) / span;
  const zeroY = y(0);

  const pts = all.map((m, i) => [x(i), y(m.netProfit)] as const);
  const histPts = pts.slice(0, history.length);
  // Bridge the last actual point into the forecast line so it's continuous.
  const forePts = pts.slice(history.length - 1);
  const toPath = (p: readonly (readonly [number, number])[]) =>
    p.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');

  const divX = (x(history.length - 1) + x(history.length)) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Net profit forecast chart">
      {/* Forecast region shading */}
      <rect x={divX} y={padT} width={W - padR - divX} height={H - padT - padB} className="fill-primary/5" />
      {/* Zero baseline */}
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} className="stroke-border" strokeWidth={1} />
      {/* History / forecast divider */}
      <line x1={divX} y1={padT} x2={divX} y2={H - padB} className="stroke-border" strokeDasharray="3 3" strokeWidth={1} />
      {/* History line */}
      <path d={toPath(histPts)} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Forecast line */}
      <path d={toPath(forePts)} fill="none" className="stroke-primary/50" strokeWidth={2.5} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {pts.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={2.5} className={i < history.length ? 'fill-primary' : 'fill-primary/50'} />
      ))}
      {/* End labels */}
      <text x={x(0)} y={H - 6} className="fill-muted-foreground text-[10px]">{all[0].label}</text>
      <text x={W - padR} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {all[n - 1].label}
      </text>
      {/* Max / min value labels */}
      <text x={padL} y={padT + 8} className="fill-muted-foreground text-[10px]">{formatMoneyCompact(max, currency)}</text>
      {min < 0 && (
        <text x={padL} y={H - padB - 2} className="fill-muted-foreground text-[10px]">{formatMoneyCompact(min, currency)}</text>
      )}
    </svg>
  );
}

function Upsell() {
  return (
    <div className="mx-auto max-w-3xl">
      <Header />
      <Card className="border-primary/30">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <LineChart className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Forecasting is a Growth feature</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Upgrade to Growth to project the next 12 months of revenue, expenses and profit from your
              own numbers — plus priority support, custom branding and up to 10 users.
            </p>
          </div>
          <Button asChild>
            <Link href="/billing">Upgrade to Growth</Link>
          </Button>
        </CardContent>
      </Card>
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
