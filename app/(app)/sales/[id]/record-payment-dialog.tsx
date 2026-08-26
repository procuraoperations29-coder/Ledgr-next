'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Account } from '@/lib/accounting/types';
import { accountLabel } from '@/lib/accounting/transaction-ui';
import { recordInvoicePaymentAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { currencySymbol, formatMoney } from '@/lib/format';

export function RecordPaymentDialog({
  invoiceId,
  outstanding,
  bankAccounts,
  currency,
}: {
  invoiceId: string;
  outstanding: number;
  bankAccounts: Account[];
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [amount, setAmount] = useState((outstanding / 100).toFixed(2));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bankId, setBankId] = useState(bankAccounts[0]?.id ?? '');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const amountMajor = Number(amount);
    if (!amountMajor || amountMajor <= 0) return setError('Enter an amount.');
    if (!bankId) return setError('Choose where the money came in.');

    startTransition(async () => {
      const result = await recordInvoicePaymentAction({
        invoiceId,
        amountMajor,
        bankAccountId: bankId,
        date,
      });
      if (result?.error) return setError(result.error);
      toast.success('Payment recorded');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Outstanding: {formatMoney(outstanding, currency)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currencySymbol(currency)}
                </span>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 tabular-nums"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-bank">Received into</Label>
            <Select
              id="pay-bank"
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
            >
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
