/**
 * Rule-based business insights (§12). Deliberately NOT AI — deterministic rules
 * over the same ledger-derived figures. Architected so AI narration can replace
 * `generateHealthSummary` later without touching callers (§55).
 */

import { formatMoneyCompact } from '@/lib/format';
import type { ProfitAndLoss, LineItem } from './reports';

export interface Insight {
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface HealthSummary {
  headline: string;
  insights: Insight[];
}

/** Percentage change, or null when there is no prior base to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function changePhrase(pct: number | null): string {
  if (pct === null) return 'up from nothing last period';
  const rounded = Math.round(pct);
  if (rounded === 0) return 'flat versus last period';
  return `${rounded > 0 ? 'up' : 'down'} ${Math.abs(rounded)}% versus last period`;
}

export function generateHealthSummary(input: {
  pl: ProfitAndLoss;
  prevPl: ProfitAndLoss;
  expenses: LineItem[];
  receivables: number;
  cash: number;
  periodLabel: string;
  currency: string;
}): HealthSummary {
  const { pl, prevPl, expenses, receivables, cash, currency } = input;
  const m = (v: number) => formatMoneyCompact(v, currency);
  const insights: Insight[] = [];

  const totalExpenses =
    pl.costOfSales + pl.operatingExpenses + pl.financeCosts + pl.tax;

  const headline =
    pl.revenue > 0 || totalExpenses > 0
      ? `Your business generated ${m(pl.revenue)} in revenue and ${
          pl.netProfit >= 0 ? 'made' : 'lost'
        } ${m(Math.abs(pl.netProfit))} ${
          pl.netProfit >= 0 ? 'in profit' : ''
        } this period.`.trim()
      : 'No activity recorded for this period yet.';

  // Revenue trend
  const revPct = pctChange(pl.revenue, prevPl.revenue);
  if (pl.revenue > 0 || prevPl.revenue > 0) {
    insights.push({
      text: `Revenue is ${changePhrase(revPct)}.`,
      tone: revPct === null || revPct >= 0 ? 'positive' : 'negative',
    });
  }

  // Expense trend
  const prevTotalExp =
    prevPl.costOfSales + prevPl.operatingExpenses + prevPl.financeCosts + prevPl.tax;
  const expPct = pctChange(totalExpenses, prevTotalExp);
  if (totalExpenses > 0 || prevTotalExp > 0) {
    insights.push({
      text: `Operating costs are ${changePhrase(expPct)}.`,
      tone: expPct !== null && expPct > 0 ? 'negative' : 'positive',
    });
  }

  // Largest expense
  if (expenses.length > 0) {
    const top = expenses[0];
    insights.push({
      text: `Your largest cost is ${top.plainName || top.name} at ${m(top.amount)}.`,
      tone: 'neutral',
    });
  }

  // Profit margin
  if (pl.revenue > 0) {
    const margin = Math.round((pl.netProfit / pl.revenue) * 100);
    insights.push({
      text: `Net profit margin is ${margin}%.`,
      tone: margin >= 10 ? 'positive' : margin >= 0 ? 'neutral' : 'negative',
    });
  }

  // Receivables
  if (receivables > 0) {
    insights.push({
      text: `Customers currently owe you ${m(receivables)}.`,
      tone: 'neutral',
    });
  }

  // Cash
  if (cash !== 0) {
    insights.push({
      text: `You have ${m(cash)} in cash and bank right now.`,
      tone: cash > 0 ? 'positive' : 'negative',
    });
  }

  return { headline, insights };
}
