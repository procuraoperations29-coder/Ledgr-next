import type { Account, TransactionType } from './types';

export type CounterKind =
  | 'revenue'
  | 'expense'
  | 'receivable'
  | 'payable'
  | 'loan'
  | 'capital'
  | 'drawings'
  | 'money'
  | 'any';

export interface TxFieldConfig {
  /** Label for the bank/cash (money) account field. */
  moneyLabel: string;
  /** Label for the counter account field. */
  counterLabel: string;
  counterKind: CounterKind;
  /** Short helper shown under the type. */
  hint: string;
}

/** Field labels + valid counter accounts per transaction type (§8). */
export const TX_CONFIG: Record<TransactionType, TxFieldConfig> = {
  money_received: {
    moneyLabel: 'Received into',
    counterLabel: 'What was it for?',
    counterKind: 'revenue',
    hint: 'Money coming into your business',
  },
  money_spent: {
    moneyLabel: 'Paid from',
    counterLabel: 'Category',
    counterKind: 'expense',
    hint: 'Money going out of your business',
  },
  sale: {
    moneyLabel: 'Received into',
    counterLabel: 'Income type',
    counterKind: 'revenue',
    hint: 'A cash sale to a customer',
  },
  purchase: {
    moneyLabel: 'Paid from',
    counterLabel: 'Category',
    counterKind: 'expense',
    hint: 'Buying goods or services',
  },
  customer_payment: {
    moneyLabel: 'Received into',
    counterLabel: 'Amount owed account',
    counterKind: 'receivable',
    hint: 'A customer paying what they owe you',
  },
  supplier_payment: {
    moneyLabel: 'Paid from',
    counterLabel: 'Amount owed account',
    counterKind: 'payable',
    hint: 'Paying a supplier you owe',
  },
  loan_received: {
    moneyLabel: 'Received into',
    counterLabel: 'Loan account',
    counterKind: 'loan',
    hint: 'Receiving a loan',
  },
  loan_repayment: {
    moneyLabel: 'Paid from',
    counterLabel: 'Loan account',
    counterKind: 'loan',
    hint: 'Repaying a loan',
  },
  owner_investment: {
    moneyLabel: 'Received into',
    counterLabel: 'Equity account',
    counterKind: 'capital',
    hint: 'Money you put into the business',
  },
  owner_withdrawal: {
    moneyLabel: 'Paid from',
    counterLabel: 'Drawings account',
    counterKind: 'drawings',
    hint: 'Money you take out of the business',
  },
  transfer: {
    moneyLabel: 'From',
    counterLabel: 'To',
    counterKind: 'money',
    hint: 'Move money between your own accounts',
  },
  other: {
    moneyLabel: 'Account',
    counterLabel: 'Category',
    counterKind: 'any',
    hint: 'Anything else',
  },
};

/** Accounts eligible for the counter field of a given kind. */
export function filterByKind(accounts: Account[], kind: CounterKind): Account[] {
  switch (kind) {
    case 'revenue':
      return accounts.filter((a) => a.type === 'revenue');
    case 'expense':
      return accounts.filter(
        (a) => a.type === 'expense' || a.type === 'cost_of_sales'
      );
    case 'receivable':
      return accounts.filter((a) => a.subtype === 'receivable');
    case 'payable':
      return accounts.filter((a) => a.subtype === 'payable');
    case 'loan':
      return accounts.filter((a) => a.subtype === 'loan');
    case 'capital':
      return accounts.filter(
        (a) => a.type === 'equity' && a.subtype !== 'drawings'
      );
    case 'drawings':
      return accounts.filter((a) => a.subtype === 'drawings');
    case 'money':
      return accounts.filter((a) => a.isBankOrCash);
    case 'any':
    default:
      return accounts;
  }
}

/** Bank/cash accounts for the money field. */
export function moneyAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.isBankOrCash);
}

export function accountLabel(a: Account): string {
  return a.plainName || a.name;
}
