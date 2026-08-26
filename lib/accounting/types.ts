/**
 * Shared accounting types. Money is ALWAYS integer minor units (kobo).
 * These mirror the database enums in supabase/migrations/*_accounting_core.sql.
 */

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'cost_of_sales'
  | 'expense';

export type NormalBalance = 'debit' | 'credit';

export type TransactionType =
  | 'money_received'
  | 'money_spent'
  | 'transfer'
  | 'sale'
  | 'purchase'
  | 'customer_payment'
  | 'supplier_payment'
  | 'loan_received'
  | 'loan_repayment'
  | 'owner_investment'
  | 'owner_withdrawal'
  | 'other';

export interface Account {
  id: string;
  code: string;
  name: string;
  plainName?: string | null;
  type: AccountType;
  subtype?: string | null;
  normalBalance: NormalBalance;
  isBankOrCash?: boolean;
}

/** A single debit/credit row. Exactly one of debit/credit is > 0. */
export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
}
