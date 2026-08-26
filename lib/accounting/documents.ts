/**
 * Document → ledger helpers for invoices, payments and expenses.
 *
 * Mirrors the SQL RPCs create_invoice / record_invoice_payment / record_expense
 * (the DB is the runtime source of truth). Used for UI previews and to test the
 * posting rules without a live database. All money is integer minor units.
 */

import type { JournalLine } from './types';

export interface InvoiceLineInput {
  quantity: number;
  unitPrice: number; // minor units
  taxRate: number; // percent
}

export interface InvoiceTotals {
  subtotal: number; // ex-tax, before discount
  tax: number;
  total: number; // subtotal − discount + tax
}

export function computeInvoiceTotals(
  lines: InvoiceLineInput[],
  discount = 0
): InvoiceTotals {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    const lineTotal = Math.round(l.quantity * l.unitPrice);
    subtotal += lineTotal;
    tax += Math.round((lineTotal * l.taxRate) / 100);
  }
  return { subtotal, tax, total: subtotal - discount + tax };
}

/** Dr Accounts Receivable (total); Cr Revenue (subtotal − discount); Cr Tax. */
export function buildInvoiceJournal(opts: {
  receivableId: string;
  revenueId: string;
  taxId?: string;
  subtotal: number;
  tax: number;
  discount?: number;
}): JournalLine[] {
  const discount = opts.discount ?? 0;
  const total = opts.subtotal - discount + opts.tax;
  const lines: JournalLine[] = [
    { accountId: opts.receivableId, debit: total, credit: 0 },
    { accountId: opts.revenueId, debit: 0, credit: opts.subtotal - discount },
  ];
  if (opts.tax > 0) {
    if (!opts.taxId) throw new Error('Tax account required when tax > 0.');
    lines.push({ accountId: opts.taxId, debit: 0, credit: opts.tax });
  }
  return lines;
}

/** Dr Bank/Cash; Cr Accounts Receivable. */
export function buildInvoicePaymentJournal(
  bankId: string,
  receivableId: string,
  amount: number
): JournalLine[] {
  return [
    { accountId: bankId, debit: amount, credit: 0 },
    { accountId: receivableId, debit: 0, credit: amount },
  ];
}

/** Dr expense category; Cr payment account (or Accounts Payable when on credit). */
export function buildExpenseJournal(
  categoryId: string,
  creditAccountId: string,
  amount: number
): JournalLine[] {
  return [
    { accountId: categoryId, debit: amount, credit: 0 },
    { accountId: creditAccountId, debit: 0, credit: amount },
  ];
}

export function isBalanced(lines: JournalLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const c = lines.reduce((s, l) => s + l.credit, 0);
  return d === c;
}
