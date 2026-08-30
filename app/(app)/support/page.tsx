import Link from 'next/link';
import { LifeBuoy, Zap, ArrowRight } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getTickets } from '@/lib/support';
import { getOrgPlan, planHasPrioritySupport } from '@/lib/plan';
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
  const [tickets, plan] = await Promise.all([
    membership ? getTickets(membership.organizationId) : Promise.resolve([]),
    membership ? getOrgPlan(membership.organizationId) : Promise.resolve(null),
  ]);
  const isPriority = plan ? planHasPrioritySupport(plan) : false;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground">Get help from the Ledgr team.</p>
        </div>
        <NewTicketDialog />
      </div>

      {isPriority ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <Zap className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium">Priority support is on</p>
            <p className="text-muted-foreground">
              As a Growth business, your tickets jump to the front of our queue for the fastest response.
            </p>
          </div>
        </div>
      ) : (
        <Link
          href="/billing"
          className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <div className="flex items-start gap-3">
            <Zap className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Want faster answers?</p>
              <p className="text-muted-foreground">
                Upgrade to Growth for priority support — your tickets go to the front of the queue.
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

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
