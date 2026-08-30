/**
 * 12-month forecasting (Growth plan).
 *
 * Pure and deterministic — the caller supplies the monthly history and the
 * labels for the months to project, so this is fully unit-testable with no
 * clock or database access.
 *
 * Method: least-squares linear trend on each series (revenue, expenses),
 * fitted over the "active window" (from the first month with any activity to
 * the last month of history). Net profit is always revenue − expenses so the
 * projected P&L stays internally consistent. With fewer than three active
 * months there isn't enough signal for a trend, so we fall back to a flat
 * average; with no activity at all the forecast is empty.
 */

export interface MonthPoint {
  /** Human label, e.g. "Aug 2025". */
  label: string;
  /** Sortable key, e.g. "2025-08". */
  ym: string;
  revenue: number;
  /** All costs: cost of sales + operating expenses + finance costs + tax. */
  expenses: number;
  /** revenue − expenses. */
  netProfit: number;
}

export interface ForecastMonth extends MonthPoint {
  forecast: true;
}

export type ForecastMethod = 'trend' | 'average' | 'insufficient';

export interface ForecastResult {
  history: MonthPoint[];
  projection: ForecastMonth[];
  method: ForecastMethod;
  /** Number of months (within the history) that had any activity. */
  monthsOfData: number;
  /** Sum of revenue across the supplied history. */
  historyRevenue: number;
  /** Sum of net profit across the supplied history. */
  historyNetProfit: number;
  /** Sum of revenue across the projected months. */
  projectedRevenue: number;
  projectedExpenses: number;
  projectedNetProfit: number;
  /** Projected total vs history total, as a percentage (null if no history). */
  revenueGrowthPct: number | null;
  /** Average month-on-month revenue growth over the active window, %. */
  avgMonthlyGrowthPct: number | null;
}

/** Ordinary least-squares fit of y against x = 0,1,2,…  Returns y = a + b·x. */
function linearFit(ys: number[]): { a: number; b: number } {
  const n = ys.length;
  if (n === 0) return { a: 0, b: 0 };
  if (n === 1) return { a: ys[0], b: 0 };
  const xBar = (n - 1) / 2;
  const yBar = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xBar) * (ys[i] - yBar);
    den += (i - xBar) * (i - xBar);
  }
  const b = den === 0 ? 0 : num / den;
  return { a: yBar - b * xBar, b };
}

function mean(ys: number[]): number {
  return ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : 0;
}

/** Average month-on-month growth over a series, as a fraction (0.1 = +10%). */
function avgGrowth(ys: number[]): number | null {
  const rates: number[] = [];
  for (let i = 1; i < ys.length; i++) {
    const prev = ys[i - 1];
    if (prev > 0) rates.push((ys[i] - prev) / prev);
  }
  return rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const round = (n: number) => Math.round(n);
const nonNeg = (n: number) => (n < 0 ? 0 : n);

/**
 * Build a forecast from monthly history.
 *
 * @param history       chronological months (oldest → newest).
 * @param futureLabels  labels for the months to project (same length as the
 *                      horizon you want, chronological).
 */
export function buildForecast(
  history: MonthPoint[],
  futureLabels: { label: string; ym: string }[]
): ForecastResult {
  const historyRevenue = round(history.reduce((s, m) => s + m.revenue, 0));
  const historyNetProfit = round(history.reduce((s, m) => s + m.netProfit, 0));

  // The active window: trim leading months with no activity at all so a
  // business that started mid-history isn't dragged down by empty months.
  const firstActive = history.findIndex(
    (m) => m.revenue !== 0 || m.expenses !== 0
  );
  const active = firstActive === -1 ? [] : history.slice(firstActive);
  const monthsOfData = active.filter(
    (m) => m.revenue !== 0 || m.expenses !== 0
  ).length;

  const emptyResult = (method: ForecastMethod): ForecastResult => ({
    history,
    projection: futureLabels.map((f) => ({
      ...f,
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      forecast: true as const,
    })),
    method,
    monthsOfData,
    historyRevenue,
    historyNetProfit,
    projectedRevenue: 0,
    projectedExpenses: 0,
    projectedNetProfit: 0,
    revenueGrowthPct: null,
    avgMonthlyGrowthPct: null,
  });

  if (active.length === 0) return emptyResult('insufficient');

  const revs = active.map((m) => m.revenue);
  const exps = active.map((m) => m.expenses);

  // With a short window, a trend line over-fits noise — use a flat average.
  const useTrend = active.length >= 3;
  const revFit = linearFit(revs);
  const expFit = linearFit(exps);
  const revMean = mean(revs);
  const expMean = mean(exps);

  const projectAt = (i: number) => {
    // Continue the x-axis past the end of the active window.
    const x = active.length + i;
    const revenue = useTrend ? nonNeg(round(revFit.a + revFit.b * x)) : nonNeg(round(revMean));
    const expenses = useTrend ? nonNeg(round(expFit.a + expFit.b * x)) : nonNeg(round(expMean));
    return { revenue, expenses, netProfit: revenue - expenses };
  };

  const projection: ForecastMonth[] = futureLabels.map((f, i) => ({
    ...f,
    ...projectAt(i),
    forecast: true as const,
  }));

  const projectedRevenue = projection.reduce((s, m) => s + m.revenue, 0);
  const projectedExpenses = projection.reduce((s, m) => s + m.expenses, 0);
  const g = avgGrowth(revs);

  return {
    history,
    projection,
    method: useTrend ? 'trend' : 'average',
    monthsOfData,
    historyRevenue,
    historyNetProfit,
    projectedRevenue,
    projectedExpenses,
    projectedNetProfit: projectedRevenue - projectedExpenses,
    revenueGrowthPct: pctChange(projectedRevenue, historyRevenue),
    avgMonthlyGrowthPct: g === null ? null : g * 100,
  };
}
