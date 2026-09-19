'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import type { Account } from '@/lib/accounting/types';
import {
  bulkImportExpensesAction,
  type BulkExpenseRow,
  type BulkImportResult,
} from '../actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { currencySymbol } from '@/lib/format';

interface Party {
  id: string;
  name: string;
}

const TEMPLATE_HEADERS = [
  'Date',
  'Amount',
  'Category',
  'Payment Account',
  'Supplier (if on credit)',
  'Vendor',
  'Description',
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = cellToString(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, a, b, year] = m;
    const day = Number(a) > 12 ? a : b;
    const month = Number(a) > 12 ? b : a;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function findAccount(accounts: Account[], name: string): Account | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return accounts.find(
    (a) =>
      a.name.toLowerCase() === needle ||
      (a.plainName ?? '').toLowerCase() === needle ||
      a.code.toLowerCase() === needle
  );
}

function findSupplier(suppliers: Party[], name: string): Party | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return suppliers.find((s) => s.name.toLowerCase() === needle);
}

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  data?: BulkExpenseRow;
  error?: string;
}

export function ImportForm({
  categories,
  paymentAccounts,
  suppliers,
  currency,
}: {
  categories: Account[];
  paymentAccounts: Account[];
  suppliers: Party[];
  currency: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const validRows = useMemo(() => rows.filter((r) => !r.error), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.error), [rows]);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const sample = [
      TEMPLATE_HEADERS,
      [
        new Date().toISOString().slice(0, 10),
        '5000',
        categories[0]?.plainName || categories[0]?.name || 'Office Supplies',
        paymentAccounts[0]?.name ?? 'Cash',
        '',
        'e.g. Shoprite',
        'e.g. Printer paper',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

    if (categories.length > 0) {
      const catRows = [
        ['Category (use exactly as written)'],
        ...categories.map((a) => [a.plainName || a.name]),
      ];
      const wsCat = XLSX.utils.aoa_to_sheet(catRows);
      wsCat['!cols'] = [{ wch: 32 }];
      XLSX.utils.book_append_sheet(wb, wsCat, 'Categories (reference)');
    }

    if (paymentAccounts.length > 0) {
      const payRows = [
        ['Payment account (use exactly as written)'],
        ...paymentAccounts.map((a) => [a.name]),
      ];
      const wsPay = XLSX.utils.aoa_to_sheet(payRows);
      wsPay['!cols'] = [{ wch: 32 }];
      XLSX.utils.book_append_sheet(wb, wsPay, 'Payment accounts (reference)');
    }

    if (suppliers.length > 0) {
      const supRows = [
        ['Supplier (use exactly as written)'],
        ...suppliers.map((s) => [s.name]),
      ];
      const wsSup = XLSX.utils.aoa_to_sheet(supRows);
      wsSup['!cols'] = [{ wch: 32 }];
      XLSX.utils.book_append_sheet(wb, wsSup, 'Suppliers (reference)');
    }

    XLSX.writeFile(wb, 'ledgr-expenses-template.xlsx');
  }

  async function handleFile(file: File) {
    setParsing(true);
    setResult(null);
    setGlobalError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: true,
      });

      if (json.length === 0) {
        setRows([]);
        setGlobalError('No rows found in that file.');
        return;
      }

      const normalizedRows = json.map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) out[normalizeHeader(k)] = v;
        return out;
      });

      if (normalizedRows.length > 500) {
        setGlobalError('This file has more than 500 rows. Please split it up and upload in batches.');
      }

      const parsed: ParsedRow[] = normalizedRows.slice(0, 500).map((raw, idx) => {
        const rowNumber = idx + 2;
        const dateRaw = raw['date'];
        const amountRaw = raw['amount'];
        const categoryRaw = cellToString(raw['category']);
        const paymentRaw = cellToString(raw['payment account']);
        const supplierRaw = cellToString(raw['supplier (if on credit)'] ?? raw['supplier']);
        const vendor = cellToString(raw['vendor']);
        const description = cellToString(raw['description']);

        const missing = ['date', 'amount', 'category'].filter(
          (k) => cellToString(raw[k]) === ''
        );
        if (missing.length > 0) {
          return { rowNumber, raw, error: `Missing ${missing.join(', ')}.` };
        }

        const date = toIsoDate(dateRaw);
        if (!date) {
          return { rowNumber, raw, error: `Could not read date "${cellToString(dateRaw)}". Use YYYY-MM-DD.` };
        }

        const amountMajor = Number(
          typeof amountRaw === 'string' ? amountRaw.replace(/,/g, '') : amountRaw
        );
        if (!amountMajor || Number.isNaN(amountMajor) || amountMajor <= 0) {
          return { rowNumber, raw, error: `Invalid amount "${cellToString(amountRaw)}".` };
        }

        const category = findAccount(categories, categoryRaw);
        if (!category) {
          return { rowNumber, raw, error: `Category "${categoryRaw}" not found.` };
        }

        const onCredit = paymentRaw === '' && supplierRaw !== '';
        let paymentAccountId: string | undefined;
        let supplierId: string | undefined;

        if (onCredit) {
          const supplier = findSupplier(suppliers, supplierRaw);
          if (!supplier) {
            return { rowNumber, raw, error: `Supplier "${supplierRaw}" not found.` };
          }
          supplierId = supplier.id;
        } else {
          if (paymentRaw === '') {
            return {
              rowNumber,
              raw,
              error: 'Set a payment account, or leave it blank and name a supplier to record it on credit.',
            };
          }
          const payment = findAccount(paymentAccounts, paymentRaw);
          if (!payment) {
            return { rowNumber, raw, error: `Payment account "${paymentRaw}" not found.` };
          }
          paymentAccountId = payment.id;
          if (supplierRaw) {
            const supplier = findSupplier(suppliers, supplierRaw);
            if (supplier) supplierId = supplier.id;
          }
        }

        return {
          rowNumber,
          raw,
          data: {
            rowNumber,
            categoryAccountId: category.id,
            amountMajor,
            date,
            paymentAccountId,
            supplierId,
            vendor: vendor || undefined,
            description: description || undefined,
            onCredit,
          },
        };
      });

      setRows(parsed);
    } catch {
      setGlobalError('Could not read that file. Make sure it is a .xlsx, .xls or .csv file that follows the template.');
      setRows([]);
    } finally {
      setParsing(false);
    }
  }

  async function submit() {
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await bulkImportExpensesAction(
        validRows.map((r) => r.data!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
      );
      setResult(res);
      if (res.successCount > 0) {
        toast.success(
          `${res.successCount} expense${res.successCount === 1 ? '' : 's'} imported`
        );
        router.refresh();
      }
      if (res.failureCount === 0) {
        setRows([]);
        setFileName(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch {
      toast.error('Something went wrong while importing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const noCategories = categories.length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">1. Get the template</p>
              <p className="text-sm text-muted-foreground">
                An Excel file pre-filled with your categories, payment accounts and suppliers.
              </p>
            </div>
            <Button variant="outline" type="button" onClick={downloadTemplate}>
              <Download className="size-4" /> Download Excel template
            </Button>
          </div>
        </CardContent>
      </Card>

      {noCategories && (
        <Alert variant="info">
          <AlertDescription>
            No expense categories found yet. Finish setting up your business
            before bulk uploading expenses.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <p className="text-sm font-medium">2. Upload your filled-in file</p>
            <p className="text-sm text-muted-foreground">
              Accepts .xlsx, .xls or .csv, using the same columns as the template.
              Leave &ldquo;Payment Account&rdquo; blank and name a supplier to
              record an unpaid (on-credit) expense.
            </p>
          </div>
          <label
            htmlFor="import-file"
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 px-4 py-8 text-center transition-colors hover:bg-secondary/50',
              noCategories && 'pointer-events-none opacity-50'
            )}
          >
            <UploadCloud className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">
              {fileName ?? 'Click to choose a file'}
            </span>
            <span className="text-xs text-muted-foreground">
              or drag and drop it here
            </span>
            <input
              id="import-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={noCategories}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading file…
            </div>
          )}

          {globalError && (
            <Alert variant="destructive">
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-4" /> {validRows.length} ready to import
                </span>
                {invalidRows.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="size-4" /> {invalidRows.length} need fixing
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Row</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Details / issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.rowNumber} className={cn(r.error && 'bg-destructive/5')}>
                        <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                        <TableCell>{r.data?.date ?? cellToString(r.raw['date'])}</TableCell>
                        <TableCell>{cellToString(r.raw['category'])}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.data
                            ? `${currencySymbol(currency)}${r.data.amountMajor.toLocaleString()}`
                            : cellToString(r.raw['amount'])}
                        </TableCell>
                        <TableCell className={cn(r.error && 'text-destructive')}>
                          {r.error ? (
                            <span className="inline-flex items-center gap-1.5">
                              <XCircle className="size-3.5 shrink-0" /> {r.error}
                            </span>
                          ) : (
                            cellToString(r.raw['description']) || '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={validRows.length === 0 || submitting}
                onClick={submit}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                <FileSpreadsheet className="size-4" />
                Import {validRows.length} expense{validRows.length === 1 ? '' : 's'}
              </Button>
            </>
          )}

          {result && result.failureCount > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                {result.successCount} imported, {result.failureCount} failed while
                saving. Fix the rows below and re-upload just those rows.
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {result.rows
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={r.rowNumber}>
                        Row {r.rowNumber}: {r.error}
                      </li>
                    ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
