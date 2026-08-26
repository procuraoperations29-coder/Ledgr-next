/**
 * Tiny CSV helpers — build (export) and parse (import). No dependency.
 * RFC-4180-ish: quotes fields containing comma/quote/newline, doubles quotes.
 */

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  /** Optional formatter for the cell (e.g. money → major units). */
  format?: (row: T) => string | number;
}

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from rows + column defs. */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) =>
          escapeCell(c.format ? c.format(row) : (row as Record<string, unknown>)[c.key as string])
        )
        .join(',')
    )
    .join('\r\n');
  return body ? `${header}\r\n${body}` : header;
}

/**
 * Parse a CSV string into an array of row objects keyed by the header row.
 * Handles quoted fields, escaped quotes and embedded newlines. Trims a UTF-8 BOM.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      // handle CRLF: skip the \n after \r
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // trailing field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) return [];

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}
