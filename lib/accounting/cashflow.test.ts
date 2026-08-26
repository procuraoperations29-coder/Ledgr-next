import { describe, it, expect } from 'vitest';
import type { Account, JournalLine } from './types';
import { getCashFlow } from './reports';

const NGN = (major: number) => Math.round(major * 100);

const ACCOUNTS: Account[] = [
  { id: 'bank', code: '1010', name: 'Bank', type: 'asset', subtype: 'bank', normalBalance: 'debit', isBankOrCash: true },
  { id: 'equip', code: '1400', name: 'Equipment', type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit' },
  { id: 'capital', code: '3000', name: "Owner's Capital", type: 'equity', subtype: 'capital', normalBalance: 'credit' },
  { id: 'sales', code: '4000', name: 'Sales', type: 'revenue', subtype: 'sales', normalBalance: 'credit' },
];

// Three journals in the period:
//  J1 owner invests ₦1,000,000  (financing)
//  J2 buys equipment ₦200,000   (investing)
//  J3 cash sale ₦300,000        (operating)
const J: Record<string, JournalLine[]> = {
  j1: [
    { accountId: 'bank', debit: NGN(1_000_000), credit: 0 },
    { accountId: 'capital', debit: 0, credit: NGN(1_000_000) },
  ],
  j2: [
    { accountId: 'equip', debit: NGN(200_000), credit: 0 },
    { accountId: 'bank', debit: 0, credit: NGN(200_000) },
  ],
  j3: [
    { accountId: 'bank', debit: NGN(300_000), credit: 0 },
    { accountId: 'sales', debit: 0, credit: NGN(300_000) },
  ],
};

describe('§16/§64 · Cash Flow reconciles: opening + net = closing', () => {
  const periodLines = [...J.j1, ...J.j2, ...J.j3];
  const byJournal = new Map(Object.entries(J));

  it('classifies sections and reconciles', () => {
    const cf = getCashFlow(ACCOUNTS, periodLines, byJournal, 0);
    expect(cf.financing).toBe(NGN(1_000_000));
    expect(cf.investing).toBe(-NGN(200_000));
    expect(cf.operating).toBe(NGN(300_000));
    expect(cf.netCashFlow).toBe(NGN(1_100_000));
    expect(cf.closingCash).toBe(NGN(1_100_000));
    expect(cf.reconciles).toBe(true);
  });

  it('carries an opening balance into closing', () => {
    const cf = getCashFlow(ACCOUNTS, periodLines, byJournal, NGN(500_000));
    expect(cf.openingCash).toBe(NGN(500_000));
    expect(cf.closingCash).toBe(NGN(1_600_000));
    expect(cf.reconciles).toBe(true);
  });
});
