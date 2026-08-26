/**
 * The transaction-type → debit/credit mapping.
 *
 * This is a faithful TypeScript mirror of public.record_transaction() in
 * supabase/migrations/*_accounting_functions.sql. The DATABASE is the source of
 * truth at runtime; this module exists to (a) drive UI hints/labels and (b) let
 * the test-suite assert the mapping without a live database. If you change the
 * SQL mapping, change this too — the tests guard the pairing.
 *
 * Convention: `moneyAccountId` is ALWAYS the bank/cash account. For transfers
 * it is the source; `counterAccountId` is the destination.
 */

import type { JournalLine, TransactionType } from './types';

export type MoneyDirection = 'in' | 'out' | 'transfer';

const MONEY_IN: TransactionType[] = [
  'money_received',
  'sale',
  'customer_payment',
  'loan_received',
  'owner_investment',
];

const MONEY_OUT: TransactionType[] = [
  'money_spent',
  'purchase',
  'supplier_payment',
  'loan_repayment',
  'owner_withdrawal',
  'other',
];

export function moneyDirection(type: TransactionType): MoneyDirection {
  if (type === 'transfer') return 'transfer';
  return MONEY_IN.includes(type) ? 'in' : 'out';
}

export interface BuiltTransaction {
  debitAccountId: string;
  creditAccountId: string;
  lines: JournalLine[];
}

/**
 * Produce the two balanced ledger lines a transaction posts.
 * Throws on the same conditions the DB rejects.
 */
export function buildTransactionLines(
  type: TransactionType,
  amount: number,
  moneyAccountId: string,
  counterAccountId: string
): BuiltTransaction {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer (minor units).');
  }
  if (!moneyAccountId || !counterAccountId) {
    throw new Error('Both accounts are required.');
  }
  if (moneyAccountId === counterAccountId) {
    throw new Error('The two accounts must be different.');
  }

  const dir = moneyDirection(type);
  let debitAccountId: string;
  let creditAccountId: string;

  if (dir === 'in') {
    debitAccountId = moneyAccountId;
    creditAccountId = counterAccountId;
  } else {
    // 'out' and 'transfer' both credit the money/source account.
    debitAccountId = counterAccountId;
    creditAccountId = moneyAccountId;
  }

  return {
    debitAccountId,
    creditAccountId,
    lines: [
      { accountId: debitAccountId, debit: amount, credit: 0 },
      { accountId: creditAccountId, debit: 0, credit: amount },
    ],
  };
}

/** SME-friendly labels for the transaction picker (§7). */
export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  money_received: 'Money Received',
  money_spent: 'Money Spent',
  transfer: 'Transfer',
  sale: 'Sale',
  purchase: 'Purchase',
  customer_payment: 'Customer Payment',
  supplier_payment: 'Supplier Payment',
  loan_received: 'Loan Received',
  loan_repayment: 'Loan Repayment',
  owner_investment: 'Owner Investment',
  owner_withdrawal: 'Owner Withdrawal',
  other: 'Other',
};
