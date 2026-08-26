'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Account, TransactionType } from '@/lib/accounting/types';
import {
  TX_CONFIG,
  filterByKind,
  moneyAccounts,
  accountLabel,
} from '@/lib/accounting/transaction-ui';
import { TRANSACTION_LABELS } from '@/lib/accounting/transaction-map';
import { recordTransactionAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { currencySymbol } from '@/lib/format';

// Order the picker with the most common types first.
const TYPE_ORDER: TransactionType[] = [
  'money_received', 'money_spent', 'sale', 'purchase',
  'customer_payment', 'supplier_payment', 'transfer',
  'owner_investment', 'owner_withdrawal', 'loan_received',
  'loan_repayment', 'other',
];

export function RecordForm({
  accounts,
  currency,
}: {
  accounts: Account[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<TransactionType>('money_spent');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState('');
  const [counterId, setCounterId] = useState('');
  const [description, setDescription] = useState('');

  const config = TX_CONFIG[type];
  const money = useMemo(() => moneyAccounts(accounts), [accounts]);
  const counters = useMemo(
    () => filterByKind(accounts, config.counterKind),
    [accounts, config.counterKind]
  );

  const noAccounts = accounts.length === 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const amountMajor = Number(amount);
    if (!amountMajor || amountMajor <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!accountId || !counterId) {
      setError('Please choose both accounts.');
      return;
    }
    if (accountId === counterId) {
      setError('The two accounts must be different.');
      return;
    }

    startTransition(async () => {
      const result = await recordTransactionAction({
        type,
        date,
        amountMajor,
        accountId,
        categoryAccountId: counterId,
        description: description || undefined,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      toast.success('Transaction recorded');
      router.push('/transactions');
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Type picker */}
      <div>
        <Label className="mb-2 block">Transaction type</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setCounterId('');
              }}
              className={cn(
                'rounded-md border px-3 py-2.5 text-sm font-medium transition-colors',
                type === t
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-secondary'
              )}
            >
              {TRANSACTION_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{config.hint}</p>
      </div>

      {noAccounts ? (
        <Alert variant="info">
          <AlertDescription>
            No accounts found yet. Finish setting up your business (or connect the
            database) to record transactions.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {currencySymbol(currency)}
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8 text-lg tabular-nums"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account">{config.moneyLabel}</Label>
                <Select
                  id="account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {money.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="counter">{config.counterLabel}</Label>
                <Select
                  id="counter"
                  value={counterId}
                  onChange={(e) => setCounterId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {counters.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. August office rent"
                rows={2}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save transaction
            </Button>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
