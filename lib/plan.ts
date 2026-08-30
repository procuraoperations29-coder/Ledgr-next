import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { serverEnv } from '@/config/env';

export interface OrgPlan {
  code: string;
  name: string;
  maxUsers: number;
}

const DEFAULT_PLAN: OrgPlan = { code: 'standard', name: 'Standard', maxUsers: 3 };

/** The org's current plan (falls back to Standard limits). */
export async function getOrgPlan(orgId: string): Promise<OrgPlan> {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return DEFAULT_PLAN;
  try {
    const svc = createServiceRoleClient();
    const { data } = await svc
      .from('subscriptions')
      .select('plans(code, name, max_users)')
      .eq('organization_id', orgId)
      .maybeSingle();
    const raw = (data as any)?.plans;
    const plan = Array.isArray(raw) ? raw[0] : raw;
    if (!plan) return DEFAULT_PLAN;
    return {
      code: plan.code ?? 'standard',
      name: plan.name ?? 'Standard',
      maxUsers: plan.max_users ?? 3,
    };
  } catch {
    return DEFAULT_PLAN;
  }
}

export function planAllowsBranding(plan: OrgPlan): boolean {
  return plan.code === 'growth';
}

/** Growth-only capabilities. */
export function isGrowth(plan: OrgPlan): boolean {
  return plan.code === 'growth';
}

/** Growth tickets get priority handling in the support queue. */
export function planHasPrioritySupport(plan: OrgPlan): boolean {
  return plan.code === 'growth';
}

/** The 12-month forecast report is a Growth feature. */
export function planHasForecast(plan: OrgPlan): boolean {
  return plan.code === 'growth';
}
