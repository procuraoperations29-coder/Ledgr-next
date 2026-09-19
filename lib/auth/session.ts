import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/config/env';
import type { AppSession, Membership, MemberRole } from './types';

export const ACTIVE_ORG_COOKIE = 'ledgr_active_org';

/** Current authenticated user, or null (also null until Supabase is wired). */
export async function getUser(): Promise<User | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** All active memberships for the user, newest first. RLS-scoped. */
export async function getMemberships(): Promise<Membership[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_members')
    .select(
      'organization_id, role, can_view_reports, organizations!inner(id, name, currency, status, onboarding_completed)'
    )
    .eq('status', 'active');

  if (error || !data) return [];

  return data.map((row) => {
    // Supabase types the embedded relation loosely; normalise it.
    const org = row.organizations as unknown as {
      id: string;
      name: string;
      currency: string;
      status: string;
      onboarding_completed: boolean;
    };
    return {
      organizationId: row.organization_id as string,
      role: row.role as MemberRole,
      canViewReports: Boolean(row.can_view_reports),
      organization: {
        id: org.id,
        name: org.name,
        currency: org.currency,
        status: org.status,
        onboardingCompleted: org.onboarding_completed,
      },
    } satisfies Membership;
  });
}

/** Pick the active membership: the cookie-selected org, else the first. */
export async function getActiveMembership(): Promise<Membership | null> {
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const selected = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const membership =
    memberships.find((m) => m.organizationId === selected) ?? memberships[0];

  // Best-effort: there's no billing cron, so this is what actually catches
  // a lapsed trial or missed renewal and flips the org to 'suspended' — the
  // middleware also calls this, but pages can be reached without going
  // through the gate (e.g. the billing page itself), so keep this in sync too.
  try {
    const supabase = await createClient();
    const { data: synced } = await supabase.rpc('sync_org_billing_status', {
      p_org: membership.organizationId,
    });
    if (typeof synced === 'string') {
      membership.organization.status = synced;
    }
  } catch {
    // Non-fatal — worst case the status is a request stale.
  }

  return membership;
}

/**
 * Require a signed-in user with a fully-onboarded organisation. Redirects:
 *  - no user            → /login
 *  - no org / not done  → /onboarding
 * Returns a compact session for the app shell.
 */
export async function requireSession(): Promise<AppSession> {
  const user = await getUser();
  if (!user) redirect('/login');

  const membership = await getActiveMembership();
  if (!membership) redirect('/onboarding');
  if (!membership.organization.onboardingCompleted) redirect('/onboarding');

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    org: membership.organization,
    role: membership.role,
    canViewReports: membership.canViewReports,
  };
}

/** Require a signed-in user only (for the onboarding wizard). */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
