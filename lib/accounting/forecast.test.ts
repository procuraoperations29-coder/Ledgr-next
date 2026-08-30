import { describe, it, expect } from 'vitest';
import { buildForecast, type MonthPoint } from './forecast';

const NGN = (major: number) => Math.round(major * 100); // kobo

function months(revExp: [number, number][]): MonthPoint[] {
  return revExp.map(([revenue, expenses], i) => ({
    label: `M${i + 1}`,
    ym: `2025-${String(i + 1).padStart(2, '0')}`,
    revenue,
    expenses,
    netProfit: revenue - expenses,
  }));
}

const future = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ label: `F${i + 1}`, ym: `2026-${String(i + 1).padStart(2, '0')}` }));

describe('buildForecast', () => {
  it('projects a rising trend upward', () => {
    // Revenue climbing ~100 → 1200 over 12 months, flat expenses.
    const hist = months(
      Array.from({ length: 12 }, (_, i) => [NGN((i + 1) * 100), NGN(50000)] as [number, number])
    );
    const r = buildForecast(hist, future(12));
    expect(r.method).toBe('trend');
    expect(r.monthsOfData).toBe(12);
    // First projected month keeps rising above the last actual.
    expect(r.projection[0].revenue).toBeGreaterThan(hist[11].revenue);
    // Projected total revenue beats the trailing history.
    expect(r.projectedRevenue).toBeGreaterThan(r.historyRevenue);
    expect(r.revenueGrowthPct).not.toBeNull();
    expect(r.revenueGrowthPct!).toBeGreaterThan(0);
  });

  it('keeps net profit = revenue − expenses in every projected month', () => {
    const hist = months(
      Array.from({ length: 6 }, (_, i) => [NGN(1000 + i * 100), NGN(400 + i * 20)] as [number, number])
    );
    const r = buildForecast(hist, future(12));
    for (const m of r.projection) {
      expect(m.netProfit).toBe(m.revenue - m.expenses);
    }
  });

  it('never projects negative revenue or expenses', () => {
    // Steep decline that a raw trend line would push below zero.
    const hist = months(
      Array.from({ length: 6 }, (_, i) => [NGN(6000 - i * 1000), NGN(3000 - i * 500)] as [number, number])
    );
    const r = buildForecast(hist, future(12));
    for (const m of r.projection) {
      expect(m.revenue).toBeGreaterThanOrEqual(0);
      expect(m.expenses).toBeGreaterThanOrEqual(0);
    }
  });

  it('falls back to a flat average with fewer than three active months', () => {
    const hist = months([
      [NGN(1000), NGN(600)],
      [NGN(1400), NGN(700)],
    ]);
    const r = buildForecast(hist, future(12));
    expect(r.method).toBe('average');
    // Flat: every projected month equal.
    const first = r.projection[0].revenue;
    expect(r.projection.every((m) => m.revenue === first)).toBe(true);
  });

  it('ignores empty leading months (business started mid-history)', () => {
    const hist = months([
      [0, 0],
      [0, 0],
      [NGN(1000), NGN(500)],
      [NGN(1200), NGN(550)],
      [NGN(1400), NGN(600)],
    ]);
    const r = buildForecast(hist, future(12));
    expect(r.monthsOfData).toBe(3);
    expect(r.method).toBe('trend');
    expect(r.projection[0].revenue).toBeGreaterThan(0);
  });

  it('reports insufficient data when there is no activity', () => {
    const hist = months(Array.from({ length: 12 }, () => [0, 0] as [number, number]));
    const r = buildForecast(hist, future(12));
    expect(r.method).toBe('insufficient');
    expect(r.projectedRevenue).toBe(0);
    expect(r.projection).toHaveLength(12);
  });
});
