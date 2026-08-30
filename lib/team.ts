import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export interface TeamMember {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  status: string;
  canViewReports: boolean;
}

/** All members of an org with their email + name (service role — emails live in auth). */
export async function getTeam(orgId: string): Promise<TeamMember[]> {
  const svc = createServiceRoleClient();

  const { data: members } = await svc
    .from('organization_members')
    .select('user_id, role, status, can_view_reports, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (!members || members.length === 0) return [];

  const ids = members.map((m) => m.user_id);
  const { data: profiles } = await svc
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', ids);
  const nameBy = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  const emailBy = new Map<string, string>();
  const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  (users?.users ?? []).forEach((u) => emailBy.set(u.id, u.email ?? ''));

  return members.map((m) => ({
    userId: m.user_id,
    email: emailBy.get(m.user_id) ?? null,
    fullName: nameBy.get(m.user_id) ?? null,
    role: m.role,
    status: m.status,
    canViewReports: Boolean(m.can_view_reports),
  }));
}
