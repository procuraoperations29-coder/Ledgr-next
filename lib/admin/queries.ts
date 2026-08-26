import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/** Platform-wide metrics for the operator dashboard (§56). */
export interface PlatformMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  trialBusinesses: number;
  suspendedBusinesses: number;
  cancelledBusinesses: number;
  newThisMonth: number;
  mrrKobo: number;
  arrKobo: number;
  activeUsers: number;
  transactions: number;
  failedPayments: number;
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const svc = createServiceRoleClient();

  const count = async (
    table: string,
    build?: (q: any) => any
  ): Promise<number> => {
    let q = svc.from(table).select('*', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count: c } = await q;
    return c ?? 0;
  };

  const monthStart = (() => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  })();

  // Subscriptions by status → business counts + MRR.
  const { data: subs } = await svc
    .from('subscriptions')
    .select('status, plans(price_kobo, interval)');

  let active = 0, trial = 0, suspended = 0, cancelled = 0, mrr = 0;
  for (const s of subs ?? []) {
    const plan = (s as any).plans as { price_kobo: number; interval: string } | null;
    switch ((s as any).status) {
      case 'active':
        active++;
        if (plan) mrr += plan.interval === 'yearly' ? Math.round(plan.price_kobo / 12) : plan.price_kobo;
        break;
      case 'trial': trial++; break;
      case 'suspended': suspended++; break;
      case 'cancelled': cancelled++; break;
      case 'past_due': active++; break;
    }
  }

  const [totalBusinesses, newThisMonth, activeUsers, transactions, failedPayments] =
    await Promise.all([
      count('organizations'),
      count('organizations', (q) => q.gte('created_at', monthStart)),
      count('organization_members', (q) => q.eq('status', 'active')),
      count('transactions'),
      count('billing_payments', (q) => q.eq('status', 'failed')),
    ]);

  return {
    totalBusinesses,
    activeBusinesses: active,
    trialBusinesses: trial,
    suspendedBusinesses: suspended,
    cancelledBusinesses: cancelled,
    newThisMonth,
    mrrKobo: mrr,
    arrKobo: mrr * 12,
    activeUsers,
    transactions,
    failedPayments,
  };
}

export interface OrgRow {
  id: string;
  name: string;
  email: string | null;
  status: string;
  created_at: string;
  subscription_status: string | null;
  member_count: number;
  txn_count: number;
}

/** Businesses list with optional status filter + search (§27). */
export async function listOrganizations(opts: {
  status?: string;
  search?: string;
} = {}): Promise<OrgRow[]> {
  const svc = createServiceRoleClient();
  let q = svc
    .from('organizations')
    .select('id, name, email, status, created_at, subscriptions(status)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
  if (opts.search) q = q.ilike('name', `%${opts.search}%`);

  const { data } = await q;
  const orgs = (data ?? []) as any[];

  // Counts per org (small N; fine for MVP).
  const rows: OrgRow[] = [];
  for (const o of orgs) {
    const [{ count: members }, { count: txns }] = await Promise.all([
      svc.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', o.id),
      svc.from('transactions').select('*', { count: 'exact', head: true }).eq('organization_id', o.id),
    ]);
    rows.push({
      id: o.id,
      name: o.name,
      email: o.email,
      status: o.status,
      created_at: o.created_at,
      subscription_status: o.subscriptions?.status ?? null,
      member_count: members ?? 0,
      txn_count: txns ?? 0,
    });
  }
  return rows;
}

export interface OrgDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  business_type: string | null;
  status: string;
  created_at: string;
  currency: string;
  subscription: {
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    plan_name: string | null;
  } | null;
  members: { user_id: string; role: string; status: string; full_name: string | null }[];
  txnCount: number;
  invoiceCount: number;
}

export async function getOrganizationDetail(id: string): Promise<OrgDetail | null> {
  const svc = createServiceRoleClient();
  const { data: org } = await svc
    .from('organizations')
    .select('id, name, email, phone, industry, business_type, status, created_at, currency, subscriptions(status, trial_ends_at, current_period_end, plans(name))')
    .eq('id', id)
    .maybeSingle();
  if (!org) return null;

  const { data: memberRows } = await svc
    .from('organization_members')
    .select('user_id, role, status')
    .eq('organization_id', id);

  // profiles has no FK to organization_members (both reference auth.users),
  // so fetch names separately and merge.
  const memberIds = (memberRows ?? []).map((m: any) => m.user_id);
  const { data: profileRows } = memberIds.length
    ? await svc.from('profiles').select('user_id, full_name').in('user_id', memberIds)
    : { data: [] as any[] };
  const nameById = new Map((profileRows ?? []).map((p: any) => [p.user_id, p.full_name]));
  const members = (memberRows ?? []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    status: m.status,
    profiles: { full_name: nameById.get(m.user_id) ?? null },
  }));

  const [{ count: txnCount }, { count: invoiceCount }] = await Promise.all([
    svc.from('transactions').select('*', { count: 'exact', head: true }).eq('organization_id', id),
    svc.from('invoices').select('*', { count: 'exact', head: true }).eq('organization_id', id),
  ]);

  const subRaw = (org as any).subscriptions;
  const sub = Array.isArray(subRaw) ? subRaw[0] : subRaw;
  const subPlan = sub ? (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans) : null;
  return {
    id: (org as any).id,
    name: (org as any).name,
    email: (org as any).email,
    phone: (org as any).phone,
    industry: (org as any).industry,
    business_type: (org as any).business_type,
    status: (org as any).status,
    created_at: (org as any).created_at,
    currency: (org as any).currency,
    subscription: sub
      ? {
          status: sub.status,
          trial_ends_at: sub.trial_ends_at,
          current_period_end: sub.current_period_end,
          plan_name: subPlan?.name ?? null,
        }
      : null,
    members: (members ?? []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      full_name: m.profiles?.full_name ?? null,
    })),
    txnCount: txnCount ?? 0,
    invoiceCount: invoiceCount ?? 0,
  };
}

export interface AuditRow {
  id: string;
  action: string;
  entity: string;
  summary: string | null;
  created_at: string;
  organization_id: string | null;
}

export async function getOrgAuditLog(orgId: string, limit = 50): Promise<AuditRow[]> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from('audit_logs')
    .select('id, action, entity, summary, created_at, organization_id')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditRow[];
}
