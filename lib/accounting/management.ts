import 'server-only';
import { loadReportBundle } from './report-data';
import { getLedgerLines } from './queries';
import {
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlow,
  getReceivables,
  getPayables,
  getCashPosition,
  getRevenueBreakdown,
  getExpenseBreakdown,
  type ProfitAndLoss,
  type BalanceSheet,
  type CashFlow,
  type LineItem,
} from './reports';
import { generateHealthSummary, type HealthSummary } from './insights';
import type { DateRange } from './periods';
import type { Account } from './types';

export interface ManagementAccountData {
  businessName: string;
  currency: string;
  periodLabel: string;
  rangeFrom: string;
  rangeTo: string;
  pl: ProfitAndLoss;
  balanceSheet: BalanceSheet;
  cashFlow: CashFlow;
  revenue: LineItem[];
  expenses: LineItem[];
  receivables: number;
  payables: number;
  cash: number;
  metrics: {
    grossMargin: number; // percent
    netMargin: number;
    ebitda: number;
  };
  summary: HealthSummary;
}

/** Assemble a full management account — one ledger, every figure agrees (§14). */
export async function buildManagementAccount(
  orgId: string,
  range: DateRange,
  prevRange: DateRange,
  opts: { businessName: string; currency: string }
): Promise<ManagementAccountData> {
  const { accounts, period, asAt, openingCash } = await loadReportBundle(orgId, range);
  const prev = await getLedgerLines(orgId, { from: prevRange.from, to: prevRange.to });

  const pl = getProfitAndLoss(accounts, period.lines);
  const prevPl = getProfitAndLoss(accounts, prev.lines);
  const balanceSheet = getBalanceSheet(accounts, asAt.lines);
  const cashFlow = getCashFlow(accounts, period.lines, period.byJournal, openingCash);

  const revenue = getRevenueBreakdown(accounts, period.lines);
  const expenses = getExpenseBreakdown(accounts, period.lines);

  const receivables = getReceivables(accounts as Account[], asAt.lines);
  const payables = getPayables(accounts as Account[], asAt.lines);
  const cash = getCashPosition(accounts as Account[], asAt.lines);

  const summary = generateHealthSummary({
    pl,
    prevPl,
    expenses,
    receivables,
    cash,
    periodLabel: range.label,
    currency: opts.currency,
  });

  return {
    businessName: opts.businessName,
    currency: opts.currency,
    periodLabel: range.label,
    rangeFrom: range.from,
    rangeTo: range.to,
    pl,
    balanceSheet,
    cashFlow,
    revenue,
    expenses,
    receivables,
    payables,
    cash,
    metrics: {
      grossMargin: pl.revenue > 0 ? (pl.grossProfit / pl.revenue) * 100 : 0,
      netMargin: pl.revenue > 0 ? (pl.netProfit / pl.revenue) * 100 : 0,
      ebitda: pl.ebitda,
    },
    summary,
  };
}
