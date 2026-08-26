import 'server-only';
import { getAccounts, getLedgerLines, type LedgerData } from './queries';
import { getCashPosition } from './reports';
import type { Account } from './types';
import type { DateRange } from './periods';

export interface ReportBundle {
  accounts: Account[];
  /** Lines within [from, to] — for P&L, cash flow. */
  period: LedgerData;
  /** All lines up to and including `to` — for the balance sheet (as-at). */
  asAt: LedgerData;
  /** Bank/cash balance at the start of the period. */
  openingCash: number;
}

function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

/** One coherent fetch for a report page — everything from the same ledger. */
export async function loadReportBundle(
  orgId: string,
  range: DateRange
): Promise<ReportBundle> {
  const [accounts, period, asAt, opening] = await Promise.all([
    getAccounts(orgId, { includeArchived: true }),
    getLedgerLines(orgId, { from: range.from, to: range.to }),
    getLedgerLines(orgId, { to: range.to }),
    getLedgerLines(orgId, { to: dayBefore(range.from) }),
  ]);

  return {
    accounts: accounts as Account[],
    period,
    asAt,
    openingCash: getCashPosition(accounts as Account[], opening.lines),
  };
}
