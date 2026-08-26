'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { createProductAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function AddProductDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [cost, setCost] = useState('');
  const [sell, setSell] = useState('');
  const [track, setTrack] = useState(false);
  const [qty, setQty] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter a product name.');
    startTransition(async () => {
      const result = await createProductAction({
        name: name.trim(),
        sku: sku || undefined,
        costMajor: Number(cost) || 0,
        sellMajor: Number(sell) || 0,
        trackInventory: track,
        openingQty: Number(qty) || 0,
      });
      if (result?.error) return setError(result.error);
      toast.success('Product added');
      setOpen(false);
      setName('');
      setSku('');
      setCost('');
      setSell('');
      setQty('');
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add product
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a product</DialogTitle>
          <DialogDescription>Something you buy or sell.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-2">
              <Label htmlFor="pr-name">Name</Label>
              <Input
                id="pr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-sku">SKU (optional)</Label>
              <Input id="pr-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pr-cost">Cost price</Label>
              <Input
                id="pr-cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="tabular-nums"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-sell">Selling price</Label>
              <Input
                id="pr-sell"
                type="number"
                min="0"
                step="0.01"
                value={sell}
                onChange={(e) => setSell(e.target.value)}
                className="tabular-nums"
                placeholder="0.00"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={track}
              onChange={(e) => setTrack(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Track stock quantity for this product
          </label>
          {track && (
            <div className="space-y-2">
              <Label htmlFor="pr-qty">Opening quantity</Label>
              <Input
                id="pr-qty"
                type="number"
                min="0"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="tabular-nums"
                placeholder="0"
              />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Add product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
