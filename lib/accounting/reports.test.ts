import { describe, it, expect } from 'vitest';
import type { Account, JournalLine, TransactionType } from './types';
import { buildTransactionLines } from './transaction-map';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlow,
  getReceivables,
  getPayables,
  getCashPosition,
} from './reports';

const NGN = (major: number) => Math.round(major * 100); // kobo

// Minimal default chart (id = code) mirroring the DB seeder.
const ACCOUNTS: Account[] = [
  { id: '1000', code: '1000', name: 'Cash', type: 'asset', subtype: 'cash', normalBalance: 'debit', isBankOrCash: true },
  { id: '1010', code: '1010', name: 'Bank', type: 'asset', subtype: 'bank', normalBalance: 'debit', isBankOrCash: true },
  { id: '1200', code: '1200', name: 'Accounts Receivable', type: 'asset', subtype: 'receivable', normalBalance: 'debit' },
  { id: '1400', code: '1400', name: 'Equipment', type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit' },
  { id: '2000', code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'payable', normalBalance: 'credit' },
  { id: '2100', code: '2100', name: 'Loans', type: 'liability', subtype: 'loan', normalBalance: 'credit' },
  { id: '3000', code: '3000', name: "Owner's Capital", type: 'equity', subtype: 'capital', normalBalance: 'credit' },
  { id: '3200', code: '3200', name: 'Drawings', type: 'equity', subtype: 'drawings', normalBalance: 'debit' },
  { id: '4000', code: '4000', name: 'Sales Revenue', type: 'revenue', subtype: 'sales', normalBalance: 'credit' },
  { id: '5000', code: '5000', name: 'Cost of Goods Sold', type: 'cost_of_sales', subtype: 'cogs', normalBalance: 'debit' },
  { id: '6000', code: '6000', name: 'Salaries', type: 'expense', subtype: 'operating', normalBalance: 'debit' },
  { id: '6100', code: '6100', name: 'Rent', type: 'expense', subtype: 'operating', normalBalance: 'debit' },
];

/** Tiny in-memory ledger that posts through the same mapping the DB uses. */
function makeLedger() {
  const lines: JournalLine[] = [];
  const byJournal = new Map<string, JournalLine[]>();
  let seq = 0;

  function record(
    type: TransactionType,
    amountMajor: number,
    moneyId: string,
    counterId: string
  ) {
    const built = buildTransactionLines(type, NGN(amountMajor), moneyId, counterId);
    lines.push(...built.lines);
    byJournal.set(`j${seq++}`, built.lines);
    return built;
  }

  /** Post an arbitrary balanced journal (e.g. an invoice: Dr AR / Cr Revenue). */
  function journal(entryLines: JournalLine[]) {
    const debit = entryLines.reduce((s, l) => s + l.debit, 0);
    const credit = entryLines.reduce((s, l) => s + l.credit, 0);
    if (debit !== credit) throw new Error('unbalanced');
    lines.push(...entryLines);
    byJournal.set(`j${seq++}`, entryLines);
  }

  return { lines, byJournal, record, journal };
}

describe('§64 · Transaction: debit === credit', () => {
  it('every transaction type posts a balanced pair', () => {
    const types: TransactionType[] = [
      'money_received', 'money_spent', 'sale', 'purchase', 'customer_payment',
      'supplier_payment', 'loan_received', 'loan_repayment', 'owner_investment',
      'owner_withdrawal', 'transfer', 'other',
    ];
    for (const t of types) {
      const { lines } = buildTransactionLines(t, NGN(1000), '1010', '4000');
      const d = lines.reduce((s, l) => s + l.debit, 0);
      const c = lines.reduce((s, l) => s + l.credit, 0);
      expect(d).toBe(c);
      expect(d).toBe(NGN(1000));
    }
  });

  it('rejects non-positive amounts and same-account entries', () => {
    expect(() => buildTransactionLines('sale', 0, '1010', '4000')).toThrow();
    expect(() => buildTransactionLines('sale', NGN(10), '1010', '1010')).toThrow();
  });
});

describe('§64 · Expense increases expense & reduces cash', () => {
  it('money_spent on rent debits Rent, credits Bank', () => {
    const { debitAccountId, creditAccountId } = buildTransactionLines(
      'money_spent', NGN(150_000), '1010', '6100'
    );
    expect(debitAccountId).toBe('6100'); // Rent expense up
    expect(creditAccountId).toBe('1010'); // Bank down
  });
});

describe('§64 · Invoice → receivable + revenue, payment → cash up / AR down', () => {
  const led = makeLedger();
  // Invoice ₦500,000 on credit.
  led.journal([
    { accountId: '1200', debit: NGN(500_000), credit: 0 },
    { accountId: '4000', debit: 0, credit: NGN(500_000) },
  ]);
  it('invoice raises AR and revenue', () => {
    expect(getReceivables(ACCOUNTS, led.lines)).toBe(NGN(500_000));
    const pl = getProfitAndLoss(ACCOUNTS, led.lines);
    expect(pl.revenue).toBe(NGN(500_000));
  });
  it('customer payment reduces AR and raises cash', () => {
    led.record('customer_payment', 200_000, '1010', '1200');
    expect(getReceivables(ACCOUNTS, led.lines)).toBe(NGN(300_000));
    expect(getCashPosition(ACCOUNTS, led.lines)).toBe(NGN(200_000));
  });
});

describe('§64 · Loan and Owner equity flows', () => {
  it('loan received raises cash and liability; repayment reduces both', () => {
    const led = makeLedger();
    led.record('loan_received', 1_000_000, '1010', '2100');
    expect(getCashPosition(ACCOUNTS, led.lines)).toBe(NGN(1_000_000));
    // liability balance (credit-normal)
    const bs1 = getBalanceSheet(ACCOUNTS, led.lines);
    expect(bs1.liabilities).toBe(NGN(1_000_000));

    led.record('loan_repayment', 120_000, '1010', '2100');
    expect(getCashPosition(ACCOUNTS, led.lines)).toBe(NGN(880_000));
    const bs2 = getBalanceSheet(ACCOUNTS, led.lines);
    expect(bs2.liabilities).toBe(NGN(880_000));
  });

  it('owner investment raises cash and equity; drawings reduce both', () => {
    const led = makeLedger();
    led.record('owner_investment', 2_000_000, '1010', '3000');
    let bs = getBalanceSheet(ACCOUNTS, led.lines);
    expect(bs.equityAccounts).toBe(NGN(2_000_000));
    expect(bs.assets).toBe(NGN(2_000_000));

    led.record('owner_withdrawal', 100_000, '1010', '3200');
    bs = getBalanceSheet(ACCOUNTS, led.lines);
    expect(bs.equityAccounts).toBe(NGN(1_900_000)); // capital 2m − drawings 100k
    expect(getCashPosition(ACCOUNTS, led.lines)).toBe(NGN(1_900_000));
  });
});

describe('§64 · Full month: P&L, Balance Sheet & Cash Flow identities', () => {
  const led = makeLedger();
  led.record('owner_investment', 2_000_000, '1010', '3000');
  led.record('loan_received', 1_000_000, '1010', '2100');
  led.record('sale', 800_000, '1010', '4000'); // cash sale
  led.journal([
    // credit sale (invoice) ₦500,000
    { accountId: '1200', debit: NGN(500_000), credit: 0 },
    { accountId: '4000', debit: 0, credit: NGN(500_000) },
  ]);
  led.record('customer_payment', 200_000, '1010', '1200');
  led.record('purchase', 300_000, '1010', '5000'); // COGS, paid from bank
  led.record('money_spent', 150_000, '1010', '6100'); // rent
  led.record('money_spent', 250_000, '1010', '6000'); // salaries
  led.record('owner_withdrawal', 100_000, '1010', '3200');
  led.record('loan_repayment', 120_000, '1010', '2100');

  it('trial balance is balanced', () => {
    const tb = getTrialBalance(ACCOUNTS, led.lines);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  it('P&L: revenue − cost of sales − expenses = net profit', () => {
    const pl = getProfitAndLoss(ACCOUNTS, led.lines);
    expect(pl.revenue).toBe(NGN(1_300_000));
    expect(pl.costOfSales).toBe(NGN(300_000));
    expect(pl.operatingExpenses).toBe(NGN(400_000));
    expect(pl.grossProfit).toBe(NGN(1_000_000));
    expect(pl.netProfit).toBe(NGN(600_000));
    expect(pl.netProfit).toBe(
      pl.revenue - pl.costOfSales - pl.operatingExpenses
    );
  });

  it('Balance Sheet: Assets = Liabilities + Equity, and retained = net profit', () => {
    const bs = getBalanceSheet(ACCOUNTS, led.lines);
    const pl = getProfitAndLoss(ACCOUNTS, led.lines);
    expect(bs.balanced).toBe(true);
    expect(bs.assets).toBe(bs.liabilities + bs.equity);
    expect(bs.retainedProfit).toBe(pl.netProfit);
  });

  it('Cash Flow: opening + net movement = closing, closing = cash on hand', () => {
    const cf = getCashFlow(ACCOUNTS, led.lines, led.byJournal, 0);
    expect(cf.reconciles).toBe(true);
    expect(cf.openingCash + cf.netCashFlow).toBe(cf.closingCash);
    expect(cf.closingCash).toBe(NGN(3_080_000));
    expect(cf.closingCash).toBe(getCashPosition(ACCOUNTS, led.lines));
  });

  it('Receivables and Payables headline figures', () => {
    expect(getReceivables(ACCOUNTS, led.lines)).toBe(NGN(300_000));
    expect(getPayables(ACCOUNTS, led.lines)).toBe(0);
  });
});

/*
 * NOTE — Tenant isolation (§64) is enforced by Postgres RLS, not by this pure
 * engine. It is covered by an integration test against a live Supabase project
 * (tests/tenant-isolation.test.ts) once DB keys are wired: a user in Org A
 * receives zero rows when selecting Org B's accounts, journals and transactions.
 */
