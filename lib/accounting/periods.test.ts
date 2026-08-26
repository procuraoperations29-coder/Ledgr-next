import { describe, it, expect } from 'vitest';
import { resolvePeriod, previousPeriod } from './periods';

// Reference day: 15 August 2026 (month index 7).
const AUG = new Date(2026, 7, 15);

describe('resolvePeriod', () => {
  it('this_month → the calendar month', () => {
    const r = resolvePeriod('this_month', AUG);
    expect(r.from).toBe('2026-08-01');
    expect(r.to).toBe('2026-08-31');
    expect(r.label).toBe('August 2026');
  });

  it('last_month → July', () => {
    const r = resolvePeriod('last_month', AUG);
    expect(r.from).toBe('2026-07-01');
    expect(r.to).toBe('2026-07-31');
  });

  it('this_quarter → Q3 (Jul–Sep)', () => {
    const r = resolvePeriod('this_quarter', AUG);
    expect(r.from).toBe('2026-07-01');
    expect(r.to).toBe('2026-09-30');
    expect(r.label).toBe('Q3 2026');
  });

  it('this_year (Jan FY) → the calendar year', () => {
    const r = resolvePeriod('this_year', AUG, 1);
    expect(r.from).toBe('2026-01-01');
    expect(r.to).toBe('2026-12-31');
  });

  it('this_year (July FY) → Jul 2026 – Jun 2027', () => {
    const r = resolvePeriod('this_year', AUG, 7);
    expect(r.from).toBe('2026-07-01');
    expect(r.to).toBe('2027-06-30');
  });

  it('handles year boundaries for last_month in January', () => {
    const jan = new Date(2026, 0, 10);
    const r = resolvePeriod('last_month', jan);
    expect(r.from).toBe('2025-12-01');
    expect(r.to).toBe('2025-12-31');
  });
});

describe('previousPeriod', () => {
  it('this_month → the prior month', () => {
    const r = previousPeriod('this_month', AUG);
    expect(r.from).toBe('2026-07-01');
    expect(r.to).toBe('2026-07-31');
  });

  it('this_year (Jan FY) → the prior year', () => {
    const r = previousPeriod('this_year', AUG, 1);
    expect(r.from).toBe('2025-01-01');
    expect(r.to).toBe('2025-12-31');
  });
});
