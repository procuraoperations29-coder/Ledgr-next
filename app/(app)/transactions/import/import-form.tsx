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
import type { Account, TransactionType } from '@/lib/accounting/types';
import { TRANSACTION_LABELS } from '@/lib/accounting/transaction-map';
import {
  bulkImportTransactionsAction,
  type BulkImportRow,
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

const TEMPLATE_HEADERS = [
  'Date',
  'Type',
  'Amount',
  'Account',
  'Category',
  'Description',
  'Reference',
];

const TYPE_BY_LABEL: Record<string, TransactionType> = Object.fromEntries(
  Object.entries(TRANSACTION_LABELS).map(([key, label]) => [
    label.toLowerCase(),
    key as TransactionType,
  ])
);

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  data?: BulkImportRow;
  error?: string;
}

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
  // Try dd/mm/yyyy or mm/dd/yyyy as a fallback.
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

export function ImportForm({
  accounts,
  currency,
}: {
  accounts: Account[];
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
        'Money Spent',
        '2500',
        accounts.find((a) => a.isBankOrCash)?.name ?? 'Cash',
        accounts.find((a) => a.type === 'expense')?.name ?? 'Office Supplies',
        'e.g. August office rent',
        '',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    if (accounts.length > 0) {
      const accountRows = [
        ['Account / Category name', 'Type'],
        ...accounts.map((a) => [a.plainName || a.name, a.type]),
      ];
      const wsAccounts = XLSX.utils.aoa_to_sheet(accountRows);
      wsAccounts['!cols'] = [{ wch: 32 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsAccounts, 'Your accounts (reference)');
    }

    const typeRows = [
      ['Transaction type (use exactly as written)'],
      ...Object.values(TRANSACTION_LABELS).map((label) => [label]),
    ];
    const wsTypes = XLSX.utils.aoa_to_sheet(typeRows);
    wsTypes['!cols'] = [{ wch: 32 }];
    XLSX.utils.book_append_sheet(wb, wsTypes, 'Transaction types (reference)');

    XLSX.writeFile(wb, 'ledgr-transactions-template.xlsx');
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

      // Normalize header keys so casing/whitespace in the file doesn't matter.
      const normalizedRows = json.map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) out[normalizeHeader(k)] = v;
        return out;
      });

      if (normalizedRows.length > 500) {
        setGlobalError('This file has more than 500 rows. Please split it up and upload in batches.');
      }

      const parsed: ParsedRow[] = normalizedRows.slice(0, 500).map((raw, idx) => {
        const rowNumber = idx + 2; // header is row 1
        const dateRaw = raw['date'];
        const typeRaw = cellToString(raw['type']);
        const amountRaw = raw['amount'];
        const accountRaw = cellToString(raw['account']);
        const categoryRaw = cellToString(raw['category']);
        const description = cellToString(raw['description']);
        const reference = cellToString(raw['reference']);

        const missing = ['date', 'type', 'amount', 'account', 'category'].filter(
          (k) => cellToString(raw[k]) === ''
        );
        if (missing.length > 0) {
          return {
            rowNumber,
            raw,
            error: `Missing ${missing.join(', ')}.`,
          };
        }

        const date = toIsoDate(dateRaw);
        if (!date) {
          return { rowNumber, raw, error: `Could not read date "${cellToString(dateRaw)}". Use YYYY-MM-DD.` };
        }

        const type = TYPE_BY_LABEL[typeRaw.toLowerCase()];
        if (!type) {
          return {
            rowNumber,
            raw,
            error: `Unknown transaction type "${typeRaw}". See the "Transaction types" tab in the template.`,
          };
        }

        const amountMajor = Number(
          typeof amountRaw === 'string' ? amountRaw.replace(/,/g, '') : amountRaw
        );
        if (!amountMajor || Number.isNaN(amountMajor) || amountMajor <= 0) {
          return { rowNumber, raw, error: `Invalid amount "${cellToString(amountRaw)}".` };
        }

        const account = findAccount(accounts, accountRaw);
        if (!account) {
          return { rowNumber, raw, error: `Account "${accountRaw}" not found.` };
        }
        const category = findAccount(accounts, categoryRaw);
        if (!category) {
          return { rowNumber, raw, error: `Category "${categoryRaw}" not found.` };
        }
        if (account.id === category.id) {
          return { rowNumber, raw, error: 'Account and category must be different.' };
        }

        return {
          rowNumber,
          raw,
          data: {
            rowNumber,
            type,
            date,
            amountMajor,
            accountId: account.id,
            categoryAccountId: category.id,
            description: description || undefined,
            reference: reference || undefined,
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
      const res = await bulkImportTransactionsAction(
        validRows.map((r) => r.data!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
      );
      setResult(res);
      if (res.successCount > 0) {
        toast.success(
          `${res.successCount} transaction${res.successCount === 1 ? '' : 's'} imported`
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

  const noAccounts = accounts.length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">1. Get the template</p>
              <p className="text-sm text-muted-foreground">
                An Excel file pre-filled with your accounts and valid transaction types.
              </p>
            </div>
            <Button variant="outline" type="button" onClick={downloadTemplate}>
              <Download className="size-4" /> Download Excel template
            </Button>
          </div>
        </CardContent>
      </Card>

      {noAccounts && (
        <Alert variant="info">
          <AlertDescription>
            No accounts found yet. Finish setting up your business before bulk
            uploading transactions.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <p className="text-sm font-medium">2. Upload your filled-in file</p>
            <p className="text-sm text-muted-foreground">
              Accepts .xlsx, .xls or .csv, using the same columns as the template.
            </p>
          </div>
          <label
            htmlFor="import-file"
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 px-4 py-8 text-center transition-colors hover:bg-secondary/50',
              noAccounts && 'pointer-events-none opacity-50'
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
              disabled={noAccounts}
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
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Details / issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.rowNumber} className={cn(r.error && 'bg-destructive/5')}>
                        <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                        <TableCell>{r.data?.date ?? cellToString(r.raw['date'])}</TableCell>
                        <TableCell>
                          {r.data ? TRANSACTION_LABELS[r.data.type] : cellToString(r.raw['type'])}
                        </TableCell>
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
                Import {validRows.length} transaction{validRows.length === 1 ? '' : 's'}
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
