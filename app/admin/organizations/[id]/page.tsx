import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getOrganizationDetail, getOrgAuditLog } from '@/lib/admin/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { AdminControls } from './admin-controls';

export const metadata = { title: 'Admin · Business' };

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  trial: 'warning', active: 'success', past_due: 'warning', suspended: 'destructive', cancelled: 'secondary',
};

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, audit] = await Promise.all([
    getOrganizationDetail(id),
    getOrgAuditLog(id, 40),
  ]);
  if (!org) notFound();

  return (
    <div>
      <Link
        href="/admin/organizations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Businesses
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
            <Badge variant={STATUS_VARIANT[org.status] ?? 'default'}>{org.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.business_type} · {org.industry} · Joined {formatDate(org.created_at, 'short')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Details */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Business</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Email" value={org.email ?? '—'} />
              <Row label="Phone" value={org.phone ?? '—'} />
              <Row label="Currency" value={org.currency} />
              <Row label="Transactions" value={String(org.txnCount)} />
              <Row label="Invoices" value={String(org.invoiceCount)} />
            </dl>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Subscription</h2>
            {org.subscription ? (
              <dl className="space-y-2 text-sm">
                <Row label="Plan" value={org.subscription.plan_name ?? '—'} />
                <Row label="Status" value={org.subscription.status} />
                <Row
                  label="Trial ends"
                  value={org.subscription.trial_ends_at ? formatDate(org.subscription.trial_ends_at, 'short') : '—'}
                />
                <Row
                  label="Renews"
                  value={org.subscription.current_period_end ? formatDate(org.subscription.current_period_end, 'short') : '—'}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription record.</p>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Users ({org.members.length})</h2>
            <ul className="space-y-2 text-sm">
              {org.members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between">
                  <span>{m.full_name ?? m.user_id.slice(0, 8)}</span>
                  <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card className="mt-4">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Actions</h2>
          <AdminControls orgId={org.id} status={org.status} />
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card className="mt-4">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Recent activity (audit log)</h2>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-medium">{a.action}</span>{' '}
                    <span className="text-muted-foreground">· {a.entity}</span>
                    {a.summary && <span className="text-muted-foreground"> — {a.summary}</span>}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(a.created_at, 'short')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}
