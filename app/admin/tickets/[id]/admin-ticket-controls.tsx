'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { adminReplyTicketAction, setTicketStatusAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function AdminTicketControls({
  ticketId,
  orgId,
  status,
}: {
  ticketId: string;
  orgId: string;
  status: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();

  function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const r = await adminReplyTicketAction({ ticketId, orgId, message: body });
      if (r.error) toast.error(r.error);
      else {
        toast.success('Reply sent');
        setBody('');
        router.refresh();
      }
    });
  }

  function setStatus(next: 'in_progress' | 'resolved' | 'closed' | 'open') {
    startTransition(async () => {
      const r = await setTicketStatusAction({ ticketId, status: next });
      if (r.error) toast.error(r.error);
      else {
        toast.success(`Marked ${next.replace('_', ' ')}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={reply} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply to the business…"
          rows={3}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {status !== 'resolved' && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus('resolved')}>
                Mark resolved
              </Button>
            )}
            {status !== 'closed' && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus('closed')}>
                Close
              </Button>
            )}
            {(status === 'resolved' || status === 'closed') && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus('open')}>
                Reopen
              </Button>
            )}
          </div>
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send reply
          </Button>
        </div>
      </form>
    </div>
  );
}
