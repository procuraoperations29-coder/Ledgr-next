import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { serverEnv } from '@/config/env';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Recent notifications for the current user's org (RLS-scoped). */
export async function getNotifications(
  orgId: string,
  limit = 30
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as NotificationRow[]) ?? [];
}

export async function getUnreadCount(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('read_at', null);
  return count ?? 0;
}

/**
 * Push a notification. Uses the service-role client because notifications have
 * no client INSERT policy (they are system-generated). No-op if service role is
 * not configured.
 */
export async function createNotification(input: {
  organizationId: string;
  userId?: string | null;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return;
  const svc = createServiceRoleClient();
  await svc.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
}
