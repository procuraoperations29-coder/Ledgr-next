import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Mark a payment successful and activate the org's subscription for one period.
 * Idempotent: safe to call from both the webhook and the redirect callback.
 */
export async function activateFromPayment(
  reference: string,
  provider: string
): Promise<void> {
  const svc = createServiceRoleClient();

  const { data: payment } = await svc
    .from('billing_payments')
    .select('id, organization_id, status, plan_id')
    .eq('provider', provider)
    .eq('provider_ref', reference)
    .maybeSingle();

  if (!payment) return;
  if (payment.status === 'success') return; // already processed

  await svc
    .from('billing_payments')
    .update({ status: 'success', paid_at: new Date().toISOString() })
    .eq('id', payment.id);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subUpdate: Record<string, unknown> = {
    status: 'active',
    provider,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
  };
  // Switch the plan to whatever was paid for.
  if ((payment as any).plan_id) subUpdate.plan_id = (payment as any).plan_id;

  await svc
    .from('subscriptions')
    .update(subUpdate)
    .eq('organization_id', payment.organization_id);
}
