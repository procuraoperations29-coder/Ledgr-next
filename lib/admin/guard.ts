import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getUser } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { serverEnv } from '@/config/env';

/**
 * Require a signed-in platform (Ledgr operator) admin. The check runs through
 * the service-role client so it cannot be spoofed by RLS visibility. Non-admins
 * are sent back to the business app.
 */
export async function requirePlatformAdmin(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/login');

  // If service role isn't configured we cannot verify — deny.
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) redirect('/dashboard');

  const svc = createServiceRoleClient();
  const { data } = await svc
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) redirect('/dashboard');
  return user;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) return false;
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(data);
}
