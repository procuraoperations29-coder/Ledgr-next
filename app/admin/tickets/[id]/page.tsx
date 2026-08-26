import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTicketForAdmin } from '@/lib/support';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AdminTicketControls } from './admin-ticket-controls';

export const metadata = { title: 'Admin · Ticket' };

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  open: 'default', in_progress: 'warning', resolved: 'success', closed: 'secondary',
};

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getTicketForAdmin(id);
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/tickets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Support
      </Link>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{ticket.subject}</h1>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? 'default'} className="capitalize">
          {ticket.status.replace('_', ' ')}
        </Badge>
      </div>
      <p className="mb-6 text-sm capitalize text-muted-foreground">
        {ticket.org_name} · {ticket.category}
      </p>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={cn('flex', m.is_staff ? 'justify-end' : 'justify-start')}>
            <Card className={cn('max-w-[85%]', m.is_staff ? 'bg-primary/5' : 'bg-accent')}>
              <CardContent className="p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {m.is_staff ? 'Ledgr Support' : ticket.org_name} · {formatDate(m.created_at, 'short')}
                </p>
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <AdminTicketControls ticketId={ticket.id} orgId={ticket.organization_id} status={ticket.status} />
      </div>
    </div>
  );
}
