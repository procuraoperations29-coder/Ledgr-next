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

/** Normalise the `features` value to a string[] no matter how it's stored
 *  (jsonb array, a JSON string, null, or anything unexpected). */
function normFeatures(f: unknown): string[] {
  if (Array.isArray(f)) return f.filter((x): x is string => typeof x === 'string');
  if (typeof f === 'string') {
    try {
      const parsed = JSON.parse(f);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Never throws — returns null on any error so the billing page can't crash. */
export async function getStandardPlan(): Promise<Plan | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('plans')
      .select('id, code, name, price_kobo, interval, features')
      .eq('code', 'standard')
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { ...(data as Plan), features: normFeatures((data as any).features) };
  } catch {
    return null;
  }
}

/** Never throws — returns null on any error. */
export async function getSubscription(orgId: string): Promise<Subscription | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        'id, status, trial_ends_at, current_period_end, plans(id, code, name, price_kobo, interval, features)'
      )
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const rawPlan = (data as any).plans;
    const planObj = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;
    const plan: Plan | null = planObj
      ? { ...(planObj as Plan), features: normFeatures(planObj.features) }
      : null;

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
  } catch {
    return null;
  }
}
