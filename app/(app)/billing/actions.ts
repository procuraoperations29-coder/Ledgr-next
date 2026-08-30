'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getActiveMembership, getUser } from '@/lib/auth/session';
import { getPaymentProvider, billingConfigured } from '@/lib/billing';
import { publicEnv } from '@/config/env';

export interface CheckoutResult {
  error?: string;
  authorizationUrl?: string;
}

const CheckoutSchema = z.object({ planId: z.string().uuid() });

/**
 * Start a subscription checkout: record a pending payment, then hand back the
 * provider's hosted authorization URL for the client to redirect to.
 */
export async function startCheckoutAction(
  input: z.input<typeof CheckoutSchema>
): Promise<CheckoutResult> {
  if (!billingConfigured()) {
    return {
      error:
        'Online payments are not set up yet. Add your Paystack or Flutterwave keys to enable checkout.',
    };
  }

  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid plan.' };

  const [user, membership] = await Promise.all([getUser(), getActiveMembership()]);
  if (!user || !membership) return { error: 'Your session has expired.' };
  if (!['owner', 'admin'].includes(membership.role)) {
    return { error: 'Only an owner or admin can manage billing.' };
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('id, price_kobo')
    .eq('id', parsed.data.planId)
    .maybeSingle();
  if (!plan) return { error: 'Plan not found.' };

  const provider = getPaymentProvider();
  const reference = `ledgr_${membership.organizationId.slice(0, 8)}_${Date.now()}`;

  // Record the pending payment (service role — no client insert policy).
  const svc = createServiceRoleClient();
  await svc.from('billing_payments').insert({
    organization_id: membership.organizationId,
    provider: provider.name,
    provider_ref: reference,
    amount_kobo: plan.price_kobo,
    plan_id: plan.id,
    status: 'pending',
  });

  try {
    const init = await provider.initialize({
      email: user.email ?? 'billing@ledgr.app',
      amountKobo: plan.price_kobo,
      currency: membership.organization.currency,
      reference,
      callbackUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/billing/callback`,
      metadata: { organization_id: membership.organizationId, plan_id: plan.id },
    });
    return { authorizationUrl: init.authorizationUrl };
  } catch {
    return { error: 'We could not start the payment. Please try again.' };
  }
}
