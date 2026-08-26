import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { getAccounts, getLedgerLines } from '@/lib/accounting/queries';
import { getTrialBalance } from '@/lib/accounting/reports';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, formatDate } from '@/lib/format';
import { buildCsv } from '@/lib/csv';
import { DownloadCsvButton } from '@/components/download-csv-button';

export const metadata = { title: 'Trial Balance' };

export default async function TrialBalancePage() {
  const session = await requireSession();

  if (!session.canViewReports) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Reports are restricted"
        description="You don't have permission to view financial reports. Ask an admin for access."
      />
    );
  }

  const currency = session.org.currency;
  const [accounts, ledger] = await Promise.all([
    getAccounts(session.org.id, { includeArchived: true }),
    getLedgerLines(session.org.id),
  ]);
  const tb = getTrialBalance(accounts, ledger.lines);
  const today = new Date().toISOString().slice(0, 10);

  const csv = buildCsv(tb.rows, [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Account' },
    { key: 'debit', label: 'Debit', format: (r) => (r.debit / 100).toFixed(2) },
    { key: 'credit', label: 'Credit', format: (r) => (r.credit / 100).toFixed(2) },
  ]);

  return (
    <div>
      <Link
        href="/reports"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Reports
      </Link>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trial Balance</h1>
          <p className="text-sm text-muted-foreground">
            As at {formatDate(today)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={tb.balanced ? 'success' : 'destructive'}>
            {tb.balanced ? 'Balanced' : 'Out of balance'}
          </Badge>
          {tb.rows.length > 0 && (
            <DownloadCsvButton csv={csv} filename={`trial-balance-${today}.csv`} />
          )}
        </div>
      </div>

      {tb.rows.length === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          description="Once you record transactions, your trial balance will appear here."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tb.rows.map((row) => (
                <TableRow key={row.accountId}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {row.code}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.debit ? formatMoney(row.debit, currency) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.credit ? formatMoney(row.credit, currency) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(tb.totalDebit, currency)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(tb.totalCredit, currency)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
