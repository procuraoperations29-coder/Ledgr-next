import { describe, it, expect } from 'vitest';
import type { Account, JournalLine } from './types';
import {
  computeInvoiceTotals,
  buildInvoiceJournal,
  buildInvoicePaymentJournal,
  buildExpenseJournal,
  isBalanced,
} from './documents';
import {
  getReceivables,
  getProfitAndLoss,
  getBalanceSheet,
  getCashPosition,
  accountBalance,
} from './reports';

const NGN = (major: number) => Math.round(major * 100);

const ACCOUNTS: Account[] = [
  { id: '1010', code: '1010', name: 'Bank', type: 'asset', subtype: 'bank', normalBalance: 'debit', isBankOrCash: true },
  { id: '1200', code: '1200', name: 'Accounts Receivable', type: 'asset', subtype: 'receivable', normalBalance: 'debit' },
  { id: '2200', code: '2200', name: 'Taxes Payable', type: 'liability', subtype: 'tax', normalBalance: 'credit' },
  { id: '4000', code: '4000', name: 'Sales Revenue', type: 'revenue', subtype: 'sales', normalBalance: 'credit' },
  { id: '6100', code: '6100', name: 'Rent', type: 'expense', subtype: 'operating', normalBalance: 'debit' },
];

describe('§20/§64 · Invoice creates a receivable and revenue', () => {
  it('computes totals with no tax', () => {
    const totals = computeInvoiceTotals(
      [{ quantity: 1, unitPrice: NGN(500_000), taxRate: 0 }],
      0
    );
    expect(totals.subtotal).toBe(NGN(500_000));
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(NGN(500_000));

    const j = buildInvoiceJournal({
      receivableId: '1200',
      revenueId: '4000',
      subtotal: totals.subtotal,
      tax: totals.tax,
    });
    expect(isBalanced(j)).toBe(true);
    expect(getReceivables(ACCOUNTS, j)).toBe(NGN(500_000));
    expect(getProfitAndLoss(ACCOUNTS, j).revenue).toBe(NGN(500_000));
  });

  it('computes VAT (7.5%) and posts AR / Revenue / Tax Payable', () => {
    const totals = computeInvoiceTotals(
      [{ quantity: 2, unitPrice: NGN(50_000), taxRate: 7.5 }],
      0
    );
    expect(totals.subtotal).toBe(NGN(100_000));
    expect(totals.tax).toBe(NGN(7_500));
    expect(totals.total).toBe(NGN(107_500));

    const j = buildInvoiceJournal({
      receivableId: '1200',
      revenueId: '4000',
      taxId: '2200',
      subtotal: totals.subtotal,
      tax: totals.tax,
    });
    expect(isBalanced(j)).toBe(true);
    expect(getReceivables(ACCOUNTS, j)).toBe(NGN(107_500));
    expect(getProfitAndLoss(ACCOUNTS, j).revenue).toBe(NGN(100_000));
    // Tax payable is a liability (credit-normal).
    const taxAcct = ACCOUNTS.find((a) => a.id === '2200')!;
    expect(accountBalance(taxAcct, j)).toBe(NGN(7_500));
  });

  it('applies a discount', () => {
    const totals = computeInvoiceTotals(
      [{ quantity: 1, unitPrice: NGN(100_000), taxRate: 0 }],
      NGN(10_000)
    );
    expect(totals.total).toBe(NGN(90_000));
    const j = buildInvoiceJournal({
      receivableId: '1200',
      revenueId: '4000',
      subtotal: totals.subtotal,
      tax: 0,
      discount: NGN(10_000),
    });
    expect(isBalanced(j)).toBe(true);
    expect(getProfitAndLoss(ACCOUNTS, j).revenue).toBe(NGN(90_000));
  });
});

describe('§20/§64 · Payment reduces receivable and increases cash', () => {
  it('invoice then part-payment', () => {
    const lines: JournalLine[] = [];
    // Invoice ₦500,000
    lines.push(
      ...buildInvoiceJournal({
        receivableId: '1200',
        revenueId: '4000',
        subtotal: NGN(500_000),
        tax: 0,
      })
    );
    // Payment ₦200,000 into bank
    lines.push(...buildInvoicePaymentJournal('1010', '1200', NGN(200_000)));

    expect(getReceivables(ACCOUNTS, lines)).toBe(NGN(300_000));
    expect(getCashPosition(ACCOUNTS, lines)).toBe(NGN(200_000));
  });
});

describe('§21/§64 · Expense increases expense and reduces cash', () => {
  it('rent paid from bank', () => {
    const j = buildExpenseJournal('6100', '1010', NGN(150_000));
    expect(isBalanced(j)).toBe(true);
    const rent = ACCOUNTS.find((a) => a.id === '6100')!;
    expect(accountBalance(rent, j)).toBe(NGN(150_000));
    expect(getCashPosition(ACCOUNTS, j)).toBe(-NGN(150_000));
  });
});

describe('Combined: books still balance after invoice + payment + expense', () => {
  it('Assets = Liabilities + Equity', () => {
    const lines: JournalLine[] = [];
    lines.push(
      ...buildInvoiceJournal({
        receivableId: '1200',
        revenueId: '4000',
        taxId: '2200',
        subtotal: NGN(100_000),
        tax: NGN(7_500),
      })
    );
    lines.push(...buildInvoicePaymentJournal('1010', '1200', NGN(50_000)));
    lines.push(...buildExpenseJournal('6100', '1010', NGN(20_000)));

    const bs = getBalanceSheet(ACCOUNTS, lines);
    expect(bs.balanced).toBe(true);
    expect(bs.assets).toBe(bs.liabilities + bs.equity);
  });
});
