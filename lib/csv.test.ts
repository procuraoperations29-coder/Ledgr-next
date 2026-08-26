import { describe, it, expect } from 'vitest';
import { buildCsv, parseCsv } from './csv';

describe('buildCsv', () => {
  it('builds a header + rows with formatters', () => {
    const csv = buildCsv(
      [{ name: 'ABC', amount: 50000 }],
      [
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount', format: (r) => (r.amount / 100).toFixed(2) },
      ]
    );
    expect(csv).toBe('Name,Amount\r\nABC,500.00');
  });

  it('escapes commas, quotes and newlines', () => {
    const csv = buildCsv(
      [{ note: 'Lagos, Nigeria', quip: 'He said "hi"', multi: 'a\nb' }],
      [
        { key: 'note', label: 'Note' },
        { key: 'quip', label: 'Quip' },
        { key: 'multi', label: 'Multi' },
      ]
    );
    expect(csv).toBe('Note,Quip,Multi\r\n"Lagos, Nigeria","He said ""hi""","a\nb"');
  });

  it('emits just the header for no rows', () => {
    expect(buildCsv([], [{ key: 'a', label: 'A' }])).toBe('A');
  });
});

describe('parseCsv', () => {
  it('parses a simple file into keyed objects', () => {
    const rows = parseCsv('name,email\nABC,a@b.com\nXYZ,x@y.com');
    expect(rows).toEqual([
      { name: 'ABC', email: 'a@b.com' },
      { name: 'XYZ', email: 'x@y.com' },
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('name,note\n"ABC, Ltd","He said ""hi"""');
    expect(rows).toEqual([{ name: 'ABC, Ltd', note: 'He said "hi"' }]);
  });

  it('handles CRLF and embedded newlines in quotes', () => {
    const rows = parseCsv('name,addr\r\nABC,"line1\nline2"\r\n');
    expect(rows).toEqual([{ name: 'ABC', addr: 'line1\nline2' }]);
  });

  it('strips a UTF-8 BOM and ignores blank lines', () => {
    const rows = parseCsv('﻿name\nABC\n\n');
    expect(rows).toEqual([{ name: 'ABC' }]);
  });

  it('round-trips with buildCsv', () => {
    const original = [
      { Name: 'Fresh Farms, Ltd', Email: 'a@b.com' },
      { Name: 'Quote "Co"', Email: 'x@y.com' },
    ];
    const csv = buildCsv(original, [
      { key: 'Name', label: 'Name' },
      { key: 'Email', label: 'Email' },
    ]);
    expect(parseCsv(csv)).toEqual(original);
  });
});
