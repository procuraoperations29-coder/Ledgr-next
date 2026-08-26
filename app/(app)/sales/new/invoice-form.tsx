'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { Account } from '@/lib/accounting/types';
import { accountLabel } from '@/lib/accounting/transaction-ui';
import { computeInvoiceTotals } from '@/lib/accounting/documents';
import { createInvoiceAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatMoney } from '@/lib/format';

interface Customer {
  id: string;
  name: string;
}
interface LineRow {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

const emptyLine = (): LineRow => ({
  description: '',
  quantity: '1',
  unitPrice: '',
  taxRate: '0',
});

export function InvoiceForm({
  customers,
  revenueAccounts,
  currency,
}: {
  customers: Customer[];
  revenueAccounts: Account[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState('');
  const [revenueAccountId, setRevenueAccountId] = useState(
    revenueAccounts[0]?.id ?? ''
  );
  const [discount, setDiscount] = useState('');
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);

  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        lines.map((l) => ({
          quantity: Number(l.quantity) || 0,
          unitPrice: Math.round((Number(l.unitPrice) || 0) * 100),
          taxRate: Number(l.taxRate) || 0,
        })),
        Math.round((Number(discount) || 0) * 100)
      ),
    [lines, discount]
  );

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!customerId) return setError('Choose a customer.');
    if (!revenueAccountId) return setError('Choose an income type.');
    const validLines = lines.filter(
      (l) => l.description.trim() && Number(l.unitPrice) > 0
    );
    if (validLines.length === 0)
      return setError('Add at least one line with a description and price.');

    startTransition(async () => {
      const result = await createInvoiceAction({
        customerId,
        issueDate,
        dueDate: dueDate || '',
        revenueAccountId,
        discountMajor: Number(discount) || 0,
        lines: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity) || 1,
          unitPriceMajor: Number(l.unitPrice) || 0,
          taxRate: Number(l.taxRate) || 0,
        })),
      });
      if (result?.error) return setError(result.error);
      toast.success('Invoice created');
      router.push(result.id ? `/sales/${result.id}` : '/sales');
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cust">Customer</Label>
            <Select
              id="cust"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inc">Income type</Label>
            <Select
              id="inc"
              value={revenueAccountId}
              onChange={(e) => setRevenueAccountId(e.target.value)}
            >
              {revenueAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="idate">Issue date</Label>
            <Input
              id="idate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ddate">Due date (optional)</Label>
            <Input
              id="ddate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="hidden gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_5rem_7rem_5rem_2.5rem]">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span>Tax %</span>
            <span />
          </div>
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_5rem_2.5rem] sm:items-center"
            >
              <Input
                value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                placeholder="Item or service"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
                placeholder="Qty"
                className="tabular-nums"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                placeholder="0.00"
                className="tabular-nums"
              />
              <Input
                type="number"
                min="0"
                step="0.1"
                value={line.taxRate}
                onChange={(e) => updateLine(i, { taxRate: e.target.value })}
                className="tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setLines((r) => r.filter((_, idx) => idx !== i))}
                disabled={lines.length <= 1}
                aria-label="Remove line"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((r) => [...r, emptyLine()])}
          >
            <Plus className="size-4" /> Add line
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="h-8 w-28 tabular-nums"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">{formatMoney(totals.tax, currency)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Create invoice
        </Button>
      </div>
    </form>
  );
}
