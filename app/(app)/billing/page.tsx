import { AlertTriangle, Check, Sparkles } from 'lucide-react';
import { getActiveMembership } from '@/lib/auth/session';
import { getSubscription, getPlans } from '@/lib/subscription';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatMoney, formatDate } from '@/lib/format';
import { SubscribeButton } from './subscribe-button';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Billing & Plan' };

const STATUS_LABEL: Record<string, string> = {
  trial: 'Free trial', active: 'Active', past_due: 'Past due',
  cancelled: 'Cancelled', suspended: 'Suspended',
};
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  trial: 'warning', active: 'success', past_due: 'warning', cancelled: 'secondary', suspended: 'destructive',
};

export default async function BillingPage() {
  const membership = await getActiveMembership();
  const currency = membership?.organization.currency ?? 'NGN';
  const [sub, plans] = await Promise.all([
    membership ? getSubscription(membership.organizationId) : Promise.resolve(null),
    getPlans(),
  ]);

  const isActive = sub?.status === 'active';
  const currentCode = isActive ? sub?.plan?.code ?? null : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing &amp; Plan</h1>
        <p className="text-sm text-muted-foreground">Choose the plan that fits your business.</p>
      </div>

      {(membership?.organization.status === 'suspended' ||
        membership?.organization.status === 'past_due') && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle />
          <AlertDescription>
            {membership.organization.status === 'past_due'
              ? "Your last payment didn't go through, so the rest of Ledgr is locked until it's sorted out."
              : 'Your service is suspended — likely because a trial or subscription payment lapsed. The rest of Ledgr is locked until you subscribe.'}{' '}
            Choose a plan below to restore access right away.
          </AlertDescription>
        </Alert>
      )}
      {membership?.organization.status === 'cancelled' && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle />
          <AlertDescription>
            Your subscription was cancelled. Pick a plan below to reactivate your
            account.
          </AlertDescription>
        </Alert>
      )}

      {/* Current status */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm text-muted-foreground">Current status</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold">
                {sub ? STATUS_LABEL[sub.status] ?? sub.status : 'No subscription'}
              </span>
              {sub?.plan && (
                <Badge variant={STATUS_VARIANT[sub.status] ?? 'default'}>{sub.plan.name}</Badge>
              )}
            </div>
          </div>
          {sub?.status === 'trial' && sub.trialDaysLeft !== null && (
            <p className="text-sm text-muted-foreground">
              {sub.trialDaysLeft > 0
                ? `${sub.trialDaysLeft} day${sub.trialDaysLeft === 1 ? '' : 's'} left in your free trial`
                : 'Your free trial has ended — subscribe to keep using Ledgr'}
            </p>
          )}
          {isActive && sub?.current_period_end && (
            <p className="text-sm text-muted-foreground">
              Renews {formatDate(sub.current_period_end, 'short')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentCode;
          const isGrowth = plan.code === 'growth';
          return (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col',
                isCurrent ? 'border-primary ring-1 ring-primary/30' : isGrowth ? 'border-primary/30' : ''
              )}
            >
              <CardContent className="flex flex-1 flex-col p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isGrowth && <Sparkles className="size-4 text-primary" />}
                    <h2 className="text-lg font-semibold">{plan.name}</h2>
                  </div>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-semibold tabular-nums">
                    {formatMoney(plan.price_kobo, currency, { decimals: false })}
                  </span>
                  <span className="mb-1 text-sm text-muted-foreground">/mo</span>
                </div>

                <ul className="my-5 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <p className="rounded-md bg-success/10 px-4 py-2.5 text-center text-sm font-medium text-success">
                    Your current plan
                  </p>
                ) : (
                  <SubscribeButton
                    planId={plan.id}
                    label={
                      isActive
                        ? `Switch to ${plan.name}`
                        : `Subscribe — ${formatMoney(plan.price_kobo, currency, { decimals: false })}/mo`
                    }
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Secure payments by Paystack · cancel anytime · prices in {currency}.
      </p>
    </div>
  );
}
