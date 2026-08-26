import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getNotifications } from '@/lib/notify';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MarkAllRead } from './mark-all-read';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const membership = await getActiveMembership();
  const notifications = membership
    ? await getNotifications(membership.organizationId)
    : [];
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Updates about your business.
          </p>
        </div>
        {hasUnread && <MarkAllRead />}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="Notifications about your reports, payments and subscription will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {notifications.map((n) => {
            const inner = (
              <div
                className={cn(
                  'flex items-start gap-3 border-b border-border px-4 py-3 last:border-0',
                  !n.read_at && 'bg-accent/40'
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    n.read_at ? 'bg-transparent' : 'bg-primary'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && (
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(n.created_at, 'short')}
                  </p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-secondary/50">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
