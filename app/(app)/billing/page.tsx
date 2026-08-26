import { Check, Sparkles } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getSubscription, getStandardPlan } from '@/lib/subscription';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney, formatDate } from '@/lib/format';
import { SubscribeButton } from './subscribe-button';

export const metadata = { title: 'Billing & Plan' };

const STATUS_LABEL: Record<string, string> = {
  trial: 'Free trial',
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  suspended: 'Suspended',
};
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  trial: 'warning', active: 'success', past_due: 'warning', cancelled: 'secondary', suspended: 'destructive',
};

export default async function BillingPage() {
  const membership = await getActiveMembership();
  const [sub, plan] = await Promise.all([
    membership ? getSubscription(membership.organizationId) : Promise.resolve(null),
    getStandardPlan(),
  ]);
  const currency = membership?.organization.currency ?? 'NGN';
  const features = plan?.features ?? [];
  const isActive = sub?.status === 'active';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing &amp; Plan</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Ledgr subscription.
        </p>
      </div>

      {/* Current status */}
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current status</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-semibold">
                  {sub ? STATUS_LABEL[sub.status] ?? sub.status : 'No subscription'}
                </span>
                {sub && (
                  <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'}>
                    {sub.plan?.name ?? 'Standard'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {sub?.status === 'trial' && sub.trialDaysLeft !== null && (
            <p className="mt-3 text-sm text-muted-foreground">
              {sub.trialDaysLeft > 0
                ? `${sub.trialDaysLeft} day${sub.trialDaysLeft === 1 ? '' : 's'} left in your free trial.`
                : 'Your free trial has ended. Subscribe to keep using Ledgr.'}
            </p>
          )}
          {isActive && sub?.current_period_end && (
            <p className="mt-3 text-sm text-muted-foreground">
              Renews on {formatDate(sub.current_period_end, 'short')}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan card */}
      {plan && (
        <Card className="border-primary/30">
          <CardContent className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Everything a growing business needs.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-semibold tabular-nums">
                  {formatMoney(plan.price_kobo, currency, { decimals: false })}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </div>

            <ul className="mb-6 grid gap-2 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {isActive ? (
              <p className="rounded-md bg-success/10 px-4 py-3 text-center text-sm font-medium text-success">
                You&apos;re subscribed to {plan.name}.
              </p>
            ) : (
              <SubscribeButton
                planId={plan.id}
                label={`Subscribe — ${formatMoney(plan.price_kobo, currency, { decimals: false })}/mo`}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
