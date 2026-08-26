import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface Plan {
  id: string;
  code: string;
  name: string;
  price_kobo: number;
  interval: string;
  features: string[];
}

export interface Subscription {
  id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan: Plan | null;
  trialDaysLeft: number | null;
}

export async function getStandardPlan(): Promise<Plan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('plans')
    .select('id, code, name, price_kobo, interval, features')
    .eq('code', 'standard')
    .maybeSingle();
  return (data as Plan) ?? null;
}

export async function getSubscription(orgId: string): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('id, status, trial_ends_at, current_period_end, plans(id, code, name, price_kobo, interval, features)')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!data) return null;

  const plan = (data as any).plans as Plan | null;
  let trialDaysLeft: number | null = null;
  if ((data as any).trial_ends_at) {
    const ms = new Date((data as any).trial_ends_at).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(ms / 86400000));
  }

  return {
    id: (data as any).id,
    status: (data as any).status,
    trial_ends_at: (data as any).trial_ends_at,
    current_period_end: (data as any).current_period_end,
    plan,
    trialDaysLeft,
  };
}
