/**
 * Money & date formatting. Ledgr stores money as integer minor units (kobo)
 * to avoid floating-point drift, and formats to major units for display.
 *
 * All ledger math happens on integer minor units. Never do arithmetic on the
 * formatted strings, and never store money as a JS float.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
};

export function currencySymbol(currency = 'NGN'): string {
  return CURRENCY_SYMBOLS[currency] ?? currency + ' ';
}

/** Format integer minor units (kobo) as a currency string, e.g. 300000 -> "₦3,000.00". */
export function formatMoney(
  minorUnits: number,
  currency = 'NGN',
  opts: { decimals?: boolean } = {}
): string {
  const showDecimals = opts.decimals ?? true;
  const major = minorUnits / 100;
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(Math.abs(major));
  const sign = major < 0 ? '-' : '';
  return `${sign}${currencySymbol(currency)}${formatted}`;
}

/** Compact money for dashboard cards, e.g. 5800000_00 kobo -> "₦5.8m". */
export function formatMoneyCompact(minorUnits: number, currency = 'NGN'): string {
  const major = minorUnits / 100;
  const abs = Math.abs(major);
  const sign = major < 0 ? '-' : '';
  const sym = currencySymbol(currency);
  if (abs >= 1_000_000_000) return `${sign}${sym}${(major / 1_000_000_000).toFixed(1)}b`;
  if (abs >= 1_000_000) return `${sign}${sym}${(major / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}${sym}${(major / 1_000).toFixed(1)}k`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

/** Parse a user-entered major-unit amount ("3,000.50") into integer minor units. */
export function parseMoneyToMinor(input: string): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const major = Number.parseFloat(cleaned);
  if (Number.isNaN(major)) return 0;
  return Math.round(major * 100);
}

export function formatDate(date: string | Date, style: 'short' | 'long' = 'long'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(d);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}
