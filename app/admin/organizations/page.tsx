import Link from 'next/link';
import { Building2, Search } from 'lucide-react';
import { listOrganizations } from '@/lib/admin/queries';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Admin · Businesses' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  trial: 'warning',
  active: 'success',
  past_due: 'warning',
  suspended: 'destructive',
  cancelled: 'secondary',
};

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = 'all', q = '' } = await searchParams;
  const orgs = await listOrganizations({ status, search: q });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
        <p className="text-sm text-muted-foreground">
          Every business on the platform.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/admin/organizations?status=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                status === f.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="flex items-center gap-2" action="/admin/organizations">
          <input type="hidden" name="status" value={status} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search businesses…"
              className="w-56 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      {orgs.length === 0 ? (
        <EmptyState icon={Building2} title="No businesses found" />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Subscription</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Users</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="hidden text-right md:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/admin/organizations/${o.id}`}
                      className="font-medium hover:underline"
                    >
                      {o.name}
                    </Link>
                    {o.email && (
                      <div className="text-xs text-muted-foreground">{o.email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status] ?? 'default'}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">
                    {o.subscription_status ?? '—'}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {o.member_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{o.txn_count}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                    {formatDate(o.created_at, 'short')}
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
