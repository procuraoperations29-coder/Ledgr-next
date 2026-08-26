'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import type { Account } from '@/lib/accounting/types';
import { accountLabel } from '@/lib/accounting/transaction-ui';
import { recordExpenseAction } from './actions';
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
import { currencySymbol } from '@/lib/format';

interface Party {
  id: string;
  name: string;
}

export function RecordExpenseDialog({
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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [onCredit, setOnCredit] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [description, setDescription] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const amountMajor = Number(amount);
    if (!amountMajor || amountMajor <= 0) return setError('Enter an amount.');
    if (!categoryId) return setError('Choose a category.');
    if (!onCredit && !paymentId) return setError('Choose where it was paid from.');

    startTransition(async () => {
      const result = await recordExpenseAction({
        categoryAccountId: categoryId,
        amountMajor,
        date,
        paymentAccountId: onCredit ? undefined : paymentId,
        supplierId: supplierId || undefined,
        description: description || undefined,
        onCredit,
      });
      if (result?.error) return setError(result.error);
      toast.success('Expense recorded');
      setOpen(false);
      setAmount('');
      setDescription('');
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Record expense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record an expense</DialogTitle>
          <DialogDescription>Money going out of your business.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currencySymbol(currency)}
                </span>
                <Input
                  id="e-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 tabular-nums"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-date">Date</Label>
              <Input
                id="e-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="e-cat">Category</Label>
            <Select
              id="e-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select…</option>
              {categories.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onCredit}
              onChange={(e) => setOnCredit(e.target.checked)}
              className="size-4 rounded border-input"
            />
            This is unpaid (on credit from a supplier)
          </label>

          {onCredit ? (
            <div className="space-y-2">
              <Label htmlFor="e-sup">Supplier</Label>
              <Select
                id="e-sup"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="e-pay">Paid from</Label>
              <Select
                id="e-pay"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
              >
                <option value="">Select…</option>
                {paymentAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="e-desc">Description (optional)</Label>
            <Input
              id="e-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Diesel for generator"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
