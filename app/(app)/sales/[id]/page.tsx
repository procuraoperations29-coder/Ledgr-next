import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getAccounts } from '@/lib/accounting/queries';
import { getInvoice } from '@/lib/sme/queries';
import type { Account } from '@/lib/accounting/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney, formatDate } from '@/lib/format';
import { RecordPaymentDialog } from './record-payment-dialog';

export const metadata = { title: 'Invoice' };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Unpaid',
  partly_paid: 'Part-paid',
  paid: 'Paid',
  void: 'Void',
};
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  draft: 'secondary',
  sent: 'default',
  partly_paid: 'warning',
  paid: 'success',
  void: 'secondary',
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getActiveMembership();
  if (!membership) notFound();

  const [invoice, accounts] = await Promise.all([
    getInvoice(membership.organizationId, id),
    getAccounts(membership.organizationId),
  ]);
  if (!invoice) notFound();

  const currency = membership.organization.currency;
  const outstanding = invoice.total - invoice.amount_paid;
  const bankAccounts = (accounts as Account[]).filter((a) => a.isBankOrCash);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/sales"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Sales &amp; Invoices
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {invoice.number}
            </h1>
            <Badge variant={STATUS_VARIANT[invoice.status] ?? 'default'}>
              {STATUS_LABEL[invoice.status] ?? invoice.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoice.customer?.name} · Issued {formatDate(invoice.issue_date, 'short')}
            {invoice.due_date && ` · Due ${formatDate(invoice.due_date, 'short')}`}
          </p>
        </div>
        {outstanding > 0 && invoice.status !== 'void' && bankAccounts.length > 0 && (
          <RecordPaymentDialog
            invoiceId={invoice.id}
            outstanding={outstanding}
            bankAccounts={bankAccounts}
            currency={currency}
          />
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Unit</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{l.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(l.unit_price, currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(l.line_total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1.5 border-t border-border p-4 text-sm">
            <Row label="Subtotal" value={formatMoney(invoice.subtotal, currency)} />
            {invoice.discount > 0 && (
              <Row label="Discount" value={`− ${formatMoney(invoice.discount, currency)}`} />
            )}
            {invoice.tax > 0 && (
              <Row label="Tax" value={formatMoney(invoice.tax, currency)} />
            )}
            <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(invoice.total, currency)}</span>
            </div>
            <Row label="Paid" value={formatMoney(invoice.amount_paid, currency)} />
            <div className="flex items-center justify-between font-medium text-primary">
              <span>Outstanding</span>
              <span className="tabular-nums">{formatMoney(outstanding, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.payments && invoice.payments.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Payments</h2>
            <ul className="divide-y divide-border">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatDate(p.txn_date, 'short')}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(p.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
