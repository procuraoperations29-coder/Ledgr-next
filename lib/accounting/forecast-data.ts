import 'server-only';
import { getAccounts, getLedgerLines } from './queries';
import { getProfitAndLoss } from './reports';
import type { Account } from './types';
import type { MonthPoint } from './forecast';

const MON = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthMeta(y: number, m0: number) {
  const mm = String(m0 + 1).padStart(2, '0');
  return {
    from: `${y}-${mm}-01`,
    to: new Date(Date.UTC(y, m0 + 1, 0)).toISOString().slice(0, 10),
    label: `${MON[m0]} ${y}`,
    ym: `${y}-${mm}`,
  };
}

export interface ForecastData {
  history: MonthPoint[];
  futureLabels: { label: string; ym: string }[];
}

/**
 * Fetch the last `historyMonths` complete months of P&L (ending with the month
 * before `today`) plus labels for the next `historyMonths` months to project.
 * One chart of accounts, one ledger query per month.
 */
export async function getForecastData(
  orgId: string,
  today: Date,
  historyMonths = 12
): Promise<ForecastData> {
  const y = today.getUTCFullYear();
  const m0 = today.getUTCMonth();

  const past: ReturnType<typeof monthMeta>[] = [];
  for (let i = historyMonths; i >= 1; i--) {
    const t = y * 12 + m0 - i;
    past.push(monthMeta(Math.floor(t / 12), ((t % 12) + 12) % 12));
  }

  const futureLabels: { label: string; ym: string }[] = [];
  for (let i = 0; i < historyMonths; i++) {
    const t = y * 12 + m0 + i;
    const mm = monthMeta(Math.floor(t / 12), ((t % 12) + 12) % 12);
    futureLabels.push({ label: mm.label, ym: mm.ym });
  }

  const accounts = (await getAccounts(orgId, { includeArchived: true })) as Account[];
  const ledgers = await Promise.all(
    past.map((m) => getLedgerLines(orgId, { from: m.from, to: m.to }))
  );

  const history: MonthPoint[] = past.map((m, i) => {
    const pl = getProfitAndLoss(accounts, ledgers[i].lines);
    const revenue = pl.revenue;
    // Total costs, guaranteed consistent with the ledger's net profit.
    const expenses = revenue - pl.netProfit;
    return { label: m.label, ym: m.ym, revenue, expenses, netProfit: pl.netProfit };
  });

  return { history, futureLabels };
}
