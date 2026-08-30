import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { listAllTickets } from '@/lib/support';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Admin · Support' };

const FILTERS = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  open: 'default', in_progress: 'warning', resolved: 'success', closed: 'secondary',
};

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  const tickets = await listAllTickets(status);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="text-sm text-muted-foreground">Tickets from every business.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/tickets?status=${f}`}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              status === f ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'
            )}
          >
            {f.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden sm:table-cell">Business</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden text-right md:table-cell">Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/admin/tickets/${t.id}`} className="font-medium hover:underline">
                      {t.subject}
                    </Link>
                    {t.priority === 'priority' && (
                      <Badge variant="warning" className="ml-2 align-middle">
                        Priority
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {t.org_name ?? '—'}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{t.category}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[t.status] ?? 'default'} className="capitalize">
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                    {formatDate(t.created_at, 'short')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
