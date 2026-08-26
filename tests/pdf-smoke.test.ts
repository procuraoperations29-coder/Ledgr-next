import { describe, it, expect } from 'vitest';
import { renderManagementAccountPdf } from '@/app/(app)/reports/management-account/management-account-pdf';
import type { ManagementAccountData } from '@/lib/accounting/management';

const MOCK: ManagementAccountData = {
  businessName: 'Tayo Foods Limited',
  currency: 'NGN',
  periodLabel: 'August 2026',
  rangeFrom: '2026-08-01',
  rangeTo: '2026-08-31',
  pl: {
    revenue: 845000000,
    costOfSales: 300000000,
    grossProfit: 545000000,
    operatingExpenses: 290000000,
    operatingProfit: 255000000,
    financeCosts: 0,
    profitBeforeTax: 255000000,
    tax: 0,
    netProfit: 255000000,
    ebitda: 255000000,
  },
  balanceSheet: {
    assets: 500000000,
    liabilities: 90000000,
    equityAccounts: 155000000,
    retainedProfit: 255000000,
    equity: 410000000,
    balanced: true,
  },
  cashFlow: {
    openingCash: 100000000,
    operating: 220000000,
    investing: 0,
    financing: 0,
    netCashFlow: 220000000,
    closingCash: 320000000,
    reconciles: true,
  },
  revenue: [
    { accountId: '4000', code: '4000', name: 'Sales Revenue', plainName: 'Sales', amount: 845000000 },
  ],
  expenses: [
    { accountId: '6000', code: '6000', name: 'Salaries', plainName: 'Salaries & wages', amount: 120000000 },
  ],
  receivables: 145000000,
  payables: 90000000,
  cash: 320000000,
  metrics: { grossMargin: 64.5, netMargin: 30.2, ebitda: 255000000 },
  summary: {
    headline: 'Your business generated ₦8.5m in revenue and made ₦2.6m in profit this period.',
    insights: [
      { text: 'Revenue is up 12% versus last period.', tone: 'positive' },
      { text: 'Your largest cost is Salaries & wages at ₦1.2m.', tone: 'neutral' },
    ],
  },
};

describe('Management Account PDF renders', () => {
  it('produces a valid PDF buffer', async () => {
    const buffer = await renderManagementAccountPdf(MOCK);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF files start with the "%PDF" magic bytes.
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
  }, 30000);
});
