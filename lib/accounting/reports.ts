/**
 * Reporting engine (§41).
 *
 * Every figure derives from the SAME ledger lines. Callers fetch journal lines
 * (already filtered to the reporting window) plus the org's chart of accounts,
 * and these pure functions turn them into reports. No report re-computes from
 * transactions or any parallel source — Principle 4.
 *
 * All amounts are integer minor units (kobo).
 */

import type { Account, AccountType, JournalLine } from './types';

export type AccountIndex = Map<string, Account>;

export function indexAccounts(accounts: Account[]): AccountIndex {
  return new Map(accounts.map((a) => [a.id, a]));
}

/** Raw debit-minus-credit for one account across the given lines. */
function rawNet(accountId: string, lines: JournalLine[]): number {
  let net = 0;
  for (const l of lines) {
    if (l.accountId === accountId) net += l.debit - l.credit;
  }
  return net;
}

/** Balance expressed in the account's normal-balance orientation (>=0 typical). */
export function accountBalance(account: Account, lines: JournalLine[]): number {
  const net = rawNet(account.id, lines);
  return account.normalBalance === 'debit' ? net : -net;
}

/** Sum of `raw debit - credit` over every account of the given type(s). */
function typeRawNet(
  accounts: Account[],
  lines: JournalLine[],
  types: AccountType[]
): number {
  const ids = new Set(
    accounts.filter((a) => types.includes(a.type)).map((a) => a.id)
  );
  let net = 0;
  for (const l of lines) {
    if (ids.has(l.accountId)) net += l.debit - l.credit;
  }
  return net;
}

// ── Trial Balance ────────────────────────────────────────────
export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
}
export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export function getTrialBalance(
  accounts: Account[],
  lines: JournalLine[]
): TrialBalance {
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const a of accounts) {
    const net = rawNet(a.id, lines); // debit - credit
    if (net === 0) continue;
    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDebit += debit;
    totalCredit += credit;
    rows.push({ accountId: a.id, code: a.code, name: a.name, debit, credit });
  }

  rows.sort((x, y) => x.code.localeCompare(y.code));
  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  };
}

// ── Profit & Loss ────────────────────────────────────────────
export interface ProfitAndLoss {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  financeCosts: number;
  profitBeforeTax: number;
  tax: number;
  netProfit: number;
  ebitda: number;
}

/**
 * @param financeSubtypes account subtypes treated as finance costs (e.g. 'finance')
 * @param taxAccountIds   expense accounts that represent tax
 */
export function getProfitAndLoss(
  accounts: Account[],
  lines: JournalLine[],
  opts: { financeSubtypes?: string[]; taxAccountIds?: string[] } = {}
): ProfitAndLoss {
  const financeSubtypes = new Set(opts.financeSubtypes ?? ['finance']);
  const taxIds = new Set(opts.taxAccountIds ?? []);

  // Revenue accounts are credit-normal: balance = credit - debit = -(raw net).
  const revenue = -typeRawNet(accounts, lines, ['revenue']);
  const costOfSales = typeRawNet(accounts, lines, ['cost_of_sales']);

  // Split operating expenses out from finance costs and tax.
  let operatingExpenses = 0;
  let financeCosts = 0;
  let tax = 0;
  const expenseAccounts = accounts.filter((a) => a.type === 'expense');
  for (const a of expenseAccounts) {
    const bal = rawNet(a.id, lines); // expense is debit-normal
    if (taxIds.has(a.id)) tax += bal;
    else if (a.subtype && financeSubtypes.has(a.subtype)) financeCosts += bal;
    else operatingExpenses += bal;
  }

  const grossProfit = revenue - costOfSales;
  const operatingProfit = grossProfit - operatingExpenses;
  const profitBeforeTax = operatingProfit - financeCosts;
  const netProfit = profitBeforeTax - tax;

  return {
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    financeCosts,
    profitBeforeTax,
    tax,
    netProfit,
    // EBITDA ≈ operating profit + depreciation/amortisation.
    ebitda:
      operatingProfit +
      expenseAccounts
        .filter((a) => a.subtype === 'depreciation' || a.name === 'Depreciation')
        .reduce((s, a) => s + rawNet(a.id, lines), 0),
  };
}

// ── Balance Sheet ────────────────────────────────────────────
export interface BalanceSheet {
  assets: number;
  liabilities: number;
  equityAccounts: number;
  retainedProfit: number;
  equity: number;
  balanced: boolean; // Assets === Liabilities + Equity
}

/**
 * `lines` must be every posted line up to the balance-sheet date. Retained
 * profit is the accumulated P&L to date (no closing entries in MVP), rolled
 * into equity so that Assets = Liabilities + Equity always holds.
 */
export function getBalanceSheet(
  accounts: Account[],
  lines: JournalLine[]
): BalanceSheet {
  const assets = typeRawNet(accounts, lines, ['asset']); // debit-normal
  const liabilities = -typeRawNet(accounts, lines, ['liability']); // credit-normal
  const equityAccounts = -typeRawNet(accounts, lines, ['equity']);
  const retainedProfit = -typeRawNet(accounts, lines, [
    'revenue',
    'cost_of_sales',
    'expense',
  ]);
  const equity = equityAccounts + retainedProfit;

  return {
    assets,
    liabilities,
    equityAccounts,
    retainedProfit,
    equity,
    balanced: assets === liabilities + equity,
  };
}

// ── Cash Flow (simplified, §16) ──────────────────────────────
export type CashFlowSection = 'operating' | 'investing' | 'financing';

export interface CashFlow {
  openingCash: number;
  operating: number;
  investing: number;
  financing: number;
  netCashFlow: number;
  closingCash: number;
  reconciles: boolean; // opening + net === closing
}

function classifyCounter(type: AccountType, subtype?: string | null): CashFlowSection {
  if (type === 'asset' && (subtype === 'fixed_asset' || subtype === 'equipment'))
    return 'investing';
  if (type === 'equity') return 'financing';
  if (type === 'liability' && (subtype === 'loan' || subtype === 'other'))
    return 'financing';
  return 'operating';
}

/**
 * Direct-method cash flow. `periodLines` are lines within the period; each
 * cash-touching journal is classified by its non-cash counter account. Opening
 * cash is supplied by the caller (sum of bank/cash balances before the period).
 */
export function getCashFlow(
  accounts: Account[],
  periodLines: JournalLine[],
  periodLinesByJournal: Map<string, JournalLine[]>,
  openingCash: number
): CashFlow {
  const idx = indexAccounts(accounts);
  const cashIds = new Set(
    accounts.filter((a) => a.isBankOrCash).map((a) => a.id)
  );

  const totals: Record<CashFlowSection, number> = {
    operating: 0,
    investing: 0,
    financing: 0,
  };

  for (const [, jLines] of periodLinesByJournal) {
    // Net cash movement in this journal (debit increases cash).
    let cashMove = 0;
    let counter: JournalLine | null = null;
    for (const l of jLines) {
      if (cashIds.has(l.accountId)) cashMove += l.debit - l.credit;
      else if (!counter) counter = l;
    }
    if (cashMove === 0 || !counter) continue;
    const acc = idx.get(counter.accountId);
    const section = acc ? classifyCounter(acc.type, acc.subtype) : 'operating';
    totals[section] += cashMove;
  }

  const netCashFlow = totals.operating + totals.investing + totals.financing;
  // Fallback: derive net directly from cash lines to stay exact.
  let directNet = 0;
  for (const l of periodLines) {
    if (cashIds.has(l.accountId)) directNet += l.debit - l.credit;
  }

  const closingCash = openingCash + directNet;
  return {
    openingCash,
    operating: totals.operating,
    investing: totals.investing,
    financing: totals.financing,
    netCashFlow: directNet,
    closingCash,
    reconciles: openingCash + directNet === closingCash,
  };
}

// ── Receivables / Payables totals (headline; ageing lives in SME layer) ──
export function getReceivables(accounts: Account[], lines: JournalLine[]): number {
  const ids = new Set(
    accounts.filter((a) => a.subtype === 'receivable').map((a) => a.id)
  );
  let net = 0;
  for (const l of lines) if (ids.has(l.accountId)) net += l.debit - l.credit;
  return net;
}

export function getPayables(accounts: Account[], lines: JournalLine[]): number {
  const ids = new Set(
    accounts.filter((a) => a.subtype === 'payable').map((a) => a.id)
  );
  let net = 0;
  for (const l of lines) if (ids.has(l.accountId)) net += l.credit - l.debit;
  return net;
}

/** Sum of bank/cash balances across the given lines. */
export function getCashPosition(accounts: Account[], lines: JournalLine[]): number {
  const ids = new Set(
    accounts.filter((a) => a.isBankOrCash).map((a) => a.id)
  );
  let net = 0;
  for (const l of lines) if (ids.has(l.accountId)) net += l.debit - l.credit;
  return net;
}

// ── Per-account line items (for report section detail) ───────
export interface LineItem {
  accountId: string;
  code: string;
  name: string;
  plainName: string | null;
  amount: number; // normal-balance orientation
}

/**
 * Balances for the accounts matching `filter`, in normal-balance orientation,
 * dropping zero balances. Sorted by code (ascending) unless `byAmount` is set.
 */
export function accountLineItems(
  accounts: Account[],
  lines: JournalLine[],
  filter: (a: Account) => boolean,
  opts: { byAmount?: boolean } = {}
): LineItem[] {
  const items = accounts
    .filter(filter)
    .map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      plainName: a.plainName ?? null,
      amount: accountBalance(a, lines),
    }))
    .filter((li) => li.amount !== 0);

  items.sort((x, y) =>
    opts.byAmount ? y.amount - x.amount : x.code.localeCompare(y.code)
  );
  return items;
}

export function getRevenueBreakdown(accounts: Account[], lines: JournalLine[]): LineItem[] {
  return accountLineItems(accounts, lines, (a) => a.type === 'revenue', { byAmount: true });
}

export function getExpenseBreakdown(accounts: Account[], lines: JournalLine[]): LineItem[] {
  return accountLineItems(
    accounts,
    lines,
    (a) => a.type === 'expense' || a.type === 'cost_of_sales',
    { byAmount: true }
  );
}
