import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getTickets } from '@/lib/support';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/format';
import { NewTicketDialog } from './new-ticket-dialog';

export const metadata = { title: 'Support' };

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  open: 'default', in_progress: 'warning', resolved: 'success', closed: 'secondary',
};

export default async function SupportPage() {
  const membership = await getActiveMembership();
  const tickets = membership ? await getTickets(membership.organizationId) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground">Get help from the Ledgr team.</p>
        </div>
        <NewTicketDialog />
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets yet"
          description="Have a question or issue? Open a ticket and we'll help you out."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0 hover:bg-secondary/50"
            >
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {t.category} · {formatDate(t.created_at, 'short')}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[t.status] ?? 'default'} className="capitalize">
                {t.status.replace('_', ' ')}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
