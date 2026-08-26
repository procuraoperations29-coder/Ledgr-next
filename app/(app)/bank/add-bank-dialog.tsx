'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { createBankAccountAction } from './actions';
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

export function AddBankDialog({ currency }: { currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'bank' | 'cash'>('bank');
  const [opening, setOpening] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter an account name.');
    startTransition(async () => {
      const result = await createBankAccountAction({
        name: name.trim(),
        kind,
        openingMajor: Number(opening) || 0,
      });
      if (result?.error) return setError(result.error);
      toast.success('Account added');
      setOpen(false);
      setName('');
      setOpening('');
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a bank or cash account</DialogTitle>
          <DialogDescription>
            Track another place your money sits.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="b-name">Account name</Label>
            <Input
              id="b-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Access Bank"
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-kind">Type</Label>
              <Select
                id="b-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as 'bank' | 'cash')}
              >
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-open">Balance today</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currencySymbol(currency)}
                </span>
                <Input
                  id="b-open"
                  type="number"
                  min="0"
                  step="0.01"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  className="pl-8 tabular-nums"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Add account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
