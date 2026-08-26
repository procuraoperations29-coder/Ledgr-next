import Link from 'next/link';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getTransactions } from '@/lib/accounting/queries';
import { moneyDirection, TRANSACTION_LABELS } from '@/lib/accounting/transaction-map';
import type { TransactionType } from '@/lib/accounting/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, formatDate } from '@/lib/format';
import { buildCsv } from '@/lib/csv';
import { DownloadCsvButton } from '@/components/download-csv-button';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Transactions' };

export default async function TransactionsPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const rows = membership
    ? await getTransactions(membership.organizationId, { limit: 100 })
    : [];

  const csv = buildCsv(rows, [
    { key: 'txn_date', label: 'Date' },
    { key: 'type', label: 'Type', format: (r) => TRANSACTION_LABELS[r.type as TransactionType] ?? r.type },
    { key: 'description', label: 'Description', format: (r) => r.description ?? '' },
    { key: 'account', label: 'Account', format: (r) => r.account?.name ?? '' },
    { key: 'category', label: 'Category', format: (r) => r.category?.name ?? '' },
    { key: 'amount', label: 'Amount', format: (r) => (r.amount / 100).toFixed(2) },
    { key: 'status', label: 'Status' },
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Every entry, building your financial reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <DownloadCsvButton csv={csv} filename="transactions.csv" />
          )}
          <Button asChild>
            <Link href="/transactions/new">
              <Plus className="size-4" /> Record
            </Link>
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions yet"
          description="Record your first transaction to start building your financial reports."
          action={
            <Button asChild>
              <Link href="/transactions/new">
                <Plus className="size-4" /> Record Transaction
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const dir = moneyDirection(r.type as TransactionType);
                const reversed = r.status === 'reversed';
                return (
                  <TableRow key={r.id} className={cn(reversed && 'opacity-50')}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(r.txn_date, 'short')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {r.description ||
                          r.category?.plain_name ||
                          r.category?.name ||
                          TRANSACTION_LABELS[r.type as TransactionType]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.account?.plain_name || r.account?.name}
                        {reversed && ' · reversed'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">
                        {TRANSACTION_LABELS[r.type as TransactionType]}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        dir === 'in' && 'text-success',
                        dir === 'out' && 'text-foreground'
                      )}
                    >
                      {dir === 'in' ? '+' : dir === 'out' ? '−' : ''}
                      {formatMoney(r.amount, currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
