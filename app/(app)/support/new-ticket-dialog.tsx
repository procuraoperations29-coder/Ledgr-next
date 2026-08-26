'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { createTicketAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CATEGORIES = [
  { value: 'question', label: 'Question' },
  { value: 'bug', label: 'Bug' },
  { value: 'account', label: 'Account issue' },
  { value: 'billing', label: 'Billing issue' },
  { value: 'other', label: 'Other' },
] as const;

export function NewTicketDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('question');
  const [message, setMessage] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createTicketAction({ subject, category, message });
      if (r.error) return setError(r.error);
      toast.success('Ticket submitted');
      setOpen(false);
      if (r.id) router.push(`/support/${r.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> New ticket</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact support</DialogTitle>
          <DialogDescription>We usually reply within a day.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label htmlFor="t-subj">Subject</Label>
            <Input id="t-subj" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-cat">Category</Label>
            <Select id="t-cat" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-msg">How can we help?</Label>
            <Textarea id="t-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
