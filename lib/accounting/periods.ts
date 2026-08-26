/**
 * Reporting-period utilities (§42).
 *
 * Pure and deterministic: callers pass `today` explicitly so behaviour is
 * testable. Ranges are inclusive ISO dates (yyyy-mm-dd). Fiscal-year aware via
 * `fyStartMonth` (1 = January).
 */

export type PeriodType =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function iso(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function lastDay(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

/** Add `n` months to a (year, month0) pair. */
function addMonths(y: number, m0: number, n: number): [number, number] {
  const total = y * 12 + m0 + n;
  return [Math.floor(total / 12), ((total % 12) + 12) % 12];
}

function monthRange(y: number, m0: number): DateRange {
  return {
    from: iso(y, m0, 1),
    to: iso(y, m0, lastDay(y, m0)),
    label: `${MONTHS[m0]} ${y}`,
  };
}

/** Fiscal year (start month0 = fyStartMonth-1) containing the given date. */
function fiscalYearRange(y: number, m0: number, fyStart0: number): DateRange {
  const startYear = m0 >= fyStart0 ? y : y - 1;
  const [ey, em0] = addMonths(startYear, fyStart0, 11);
  const label =
    fyStart0 === 0
      ? `${startYear}`
      : `FY ${startYear}/${(startYear + 1).toString().slice(2)}`;
  return {
    from: iso(startYear, fyStart0, 1),
    to: iso(ey, em0, lastDay(ey, em0)),
    label,
  };
}

export function resolvePeriod(
  type: PeriodType,
  today: Date,
  fyStartMonth = 1,
  custom?: { from: string; to: string }
): DateRange {
  const y = today.getFullYear();
  const m0 = today.getMonth();
  const fyStart0 = fyStartMonth - 1;

  switch (type) {
    case 'this_month':
      return monthRange(y, m0);
    case 'last_month': {
      const [py, pm0] = addMonths(y, m0, -1);
      return monthRange(py, pm0);
    }
    case 'this_quarter': {
      const q0 = Math.floor(m0 / 3) * 3;
      const [ey, em0] = addMonths(y, q0, 2);
      return {
        from: iso(y, q0, 1),
        to: iso(ey, em0, lastDay(ey, em0)),
        label: `Q${q0 / 3 + 1} ${y}`,
      };
    }
    case 'this_year':
      return fiscalYearRange(y, m0, fyStart0);
    case 'last_year': {
      const cur = fiscalYearRange(y, m0, fyStart0);
      const startYear = Number(cur.from.slice(0, 4)) - 1;
      return fiscalYearRange(startYear, fyStart0, fyStart0);
    }
    case 'custom':
      return {
        from: custom?.from ?? monthRange(y, m0).from,
        to: custom?.to ?? monthRange(y, m0).to,
        label: 'Custom period',
      };
  }
}

/** The comparable prior period (same kind, immediately before). */
export function previousPeriod(
  type: PeriodType,
  today: Date,
  fyStartMonth = 1
): DateRange {
  const y = today.getFullYear();
  const m0 = today.getMonth();
  switch (type) {
    case 'this_month':
      return resolvePeriod('last_month', today, fyStartMonth);
    case 'last_month': {
      const [py, pm0] = addMonths(y, m0, -2);
      return monthRange(py, pm0);
    }
    case 'this_quarter': {
      const q0 = Math.floor(m0 / 3) * 3;
      const [sy, sm0] = addMonths(y, q0, -3);
      const [ey, em0] = addMonths(sy, sm0, 2);
      return {
        from: iso(sy, sm0, 1),
        to: iso(ey, em0, lastDay(ey, em0)),
        label: `Q${(((sm0 / 3) % 4) + 4) % 4 + 1} ${sy}`,
      };
    }
    case 'this_year':
      return resolvePeriod('last_year', today, fyStartMonth);
    case 'last_year': {
      const cur = resolvePeriod('last_year', today, fyStartMonth);
      const startYear = Number(cur.from.slice(0, 4)) - 1;
      return fiscalYearRange(startYear, fyStartMonth - 1, fyStartMonth - 1);
    }
    default:
      return resolvePeriod('last_month', today, fyStartMonth);
  }
}

export const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
];

export function isPeriodType(v: string | undefined): v is PeriodType {
  return (
    v === 'this_month' || v === 'last_month' || v === 'this_quarter' ||
    v === 'this_year' || v === 'last_year' || v === 'custom'
  );
}
