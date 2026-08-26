import Link from 'next/link';
import { ReceiptText, Plus } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getInvoices } from '@/lib/sme/queries';
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

export const metadata = { title: 'Sales & Invoices' };

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  draft: 'secondary',
  sent: 'default',
  partly_paid: 'warning',
  paid: 'success',
  void: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Unpaid',
  partly_paid: 'Part-paid',
  paid: 'Paid',
  void: 'Void',
};

export default async function SalesPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const invoices = membership ? await getInvoices(membership.organizationId) : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales &amp; Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Bill your customers and track what they owe you.
          </p>
        </div>
        <Button asChild>
          <Link href="/sales/new">
            <Plus className="size-4" /> New invoice
          </Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No invoices yet"
          description="Create your first invoice — Ledgr records the sale and the money owed automatically."
          action={
            <Button asChild>
              <Link href="/sales/new">
                <Plus className="size-4" /> New invoice
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const outstanding = inv.total - inv.amount_paid;
                return (
                  <TableRow key={inv.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/sales/${inv.id}`} className="hover:underline">
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.customer?.name ?? '—'}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(inv.issue_date, 'short')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(inv.total, currency)}
                    </TableCell>
                    <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                      {formatMoney(outstanding, currency)}
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
