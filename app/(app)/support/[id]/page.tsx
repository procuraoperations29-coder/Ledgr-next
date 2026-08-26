import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTicket } from '@/lib/support';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReplyForm } from './reply-form';

export const metadata = { title: 'Support ticket' };

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  open: 'default', in_progress: 'warning', resolved: 'success', closed: 'secondary',
};

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const closed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/support" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Support
      </Link>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{ticket.subject}</h1>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? 'default'} className="capitalize">
          {ticket.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={cn('flex', m.is_staff ? 'justify-start' : 'justify-end')}>
            <Card className={cn('max-w-[85%]', m.is_staff ? 'bg-accent' : 'bg-primary/5')}>
              <CardContent className="p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {m.is_staff ? 'Ledgr Support' : 'You'} · {formatDate(m.created_at, 'short')}
                </p>
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-6">
        {closed ? (
          <p className="rounded-md bg-secondary px-4 py-3 text-center text-sm text-muted-foreground">
            This ticket is {ticket.status}. Open a new ticket if you need more help.
          </p>
        ) : (
          <ReplyForm ticketId={ticket.id} />
        )}
      </div>
    </div>
  );
}
