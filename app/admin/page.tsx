import Link from 'next/link';
import {
  Building2,
  CircleDollarSign,
  TrendingUp,
  Users,
  ArrowLeftRight,
  Clock,
  Ban,
  CreditCard,
} from 'lucide-react';
import { getPlatformMetrics } from '@/lib/admin/queries';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney, formatMoneyCompact } from '@/lib/format';

export const metadata = { title: 'Admin · Overview' };

export default async function AdminOverviewPage() {
  const m = await getPlatformMetrics();

  const cards = [
    { label: 'Monthly Recurring Revenue', value: formatMoney(m.mrrKobo, 'NGN'), icon: CircleDollarSign, tone: 'primary' as const },
    { label: 'Annual Recurring Revenue', value: formatMoneyCompact(m.arrKobo, 'NGN'), icon: TrendingUp, tone: 'success' as const },
    { label: 'Total Businesses', value: String(m.totalBusinesses), icon: Building2 },
    { label: 'Active Businesses', value: String(m.activeBusinesses), icon: Building2, tone: 'success' as const },
    { label: 'On Trial', value: String(m.trialBusinesses), icon: Clock },
    { label: 'Suspended', value: String(m.suspendedBusinesses), icon: Ban, tone: 'destructive' as const },
    { label: 'New This Month', value: String(m.newThisMonth), icon: TrendingUp },
    { label: 'Active Users', value: String(m.activeUsers), icon: Users },
    { label: 'Transactions Processed', value: m.transactions.toLocaleString(), icon: ArrowLeftRight },
    { label: 'Failed Payments', value: String(m.failedPayments), icon: CreditCard, tone: m.failedPayments > 0 ? ('destructive' as const) : undefined },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            How the Ledgr platform is doing.
          </p>
        </div>
        <Link
          href="/admin/organizations"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all businesses →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div
                className={
                  'mb-3 grid h-9 w-9 place-items-center rounded-lg ' +
                  (c.tone === 'primary'
                    ? 'bg-primary/10 text-primary'
                    : c.tone === 'success'
                      ? 'bg-success/12 text-success'
                      : c.tone === 'destructive'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-secondary text-secondary-foreground')
                }
              >
                <c.icon className="size-5" />
              </div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
