'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getActiveMembership, getUser } from '@/lib/auth/session';
import { getOrgPlan } from '@/lib/plan';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export interface TeamResult {
  error?: string;
  ok?: boolean;
  tempPassword?: string;
}

const ROLES = ['admin', 'accountant', 'staff', 'viewer'] as const;

const InviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  fullName: z.string().trim().min(1, 'Enter a name.'),
  role: z.enum(ROLES),
  canViewReports: z.boolean().default(false),
});

function genPassword(): string {
  return 'Ledgr-' + crypto.randomBytes(4).toString('hex') + '!7';
}

async function requireManager() {
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired.' as string };
  if (!['owner', 'admin'].includes(membership.role)) {
    return { error: 'Only an owner or admin can manage the team.' as string };
  }
  return { membership };
}

export async function createSubUserAction(
  input: z.input<typeof InviteSchema>
): Promise<TeamResult> {
  const g = await requireManager();
  if (g.error) return { error: g.error };
  const orgId = g.membership!.organizationId;

  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your entry.' };
  const d = parsed.data;

  const svc = createServiceRoleClient();

  // Seat limit from the plan.
  const [plan, { count }] = await Promise.all([
    getOrgPlan(orgId),
    svc.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
  ]);
  if ((count ?? 0) >= plan.maxUsers) {
    return {
      error:
        plan.code === 'growth'
          ? `You've reached your plan's limit of ${plan.maxUsers} users.`
          : `Your Standard plan allows ${plan.maxUsers} users. Upgrade to Growth for up to 10.`,
    };
  }

  // Find or create the auth user.
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = (list?.users ?? []).find(
    (u) => (u.email ?? '').toLowerCase() === d.email.toLowerCase()
  );
  let tempPassword: string | undefined;

  if (user) {
    const { data: existing } = await svc
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return { error: 'That person is already on your team.' };
  } else {
    tempPassword = genPassword();
    const { data: created, error } = await svc.auth.admin.createUser({
      email: d.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: d.fullName },
    });
    if (error || !created?.user) {
      return { error: 'We could not create that user. Please try again.' };
    }
    user = created.user;
  }

  const { error: memErr } = await svc.from('organization_members').insert({
    organization_id: orgId,
    user_id: user.id,
    role: d.role,
    status: 'active',
    can_view_reports: d.role === 'staff' ? d.canViewReports : true,
  });
  if (memErr) return { error: 'We could not add that user to your team.' };

  revalidatePath('/team');
  return { ok: true, tempPassword };
}

const RoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLES),
  canViewReports: z.boolean().default(false),
});

export async function updateMemberRoleAction(
  input: z.input<typeof RoleSchema>
): Promise<TeamResult> {
  const g = await requireManager();
  if (g.error) return { error: g.error };
  const orgId = g.membership!.organizationId;

  const parsed = RoleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const svc = createServiceRoleClient();
  // Never change the owner's row here.
  const { error } = await svc
    .from('organization_members')
    .update({
      role: parsed.data.role,
      can_view_reports: parsed.data.role === 'staff' ? parsed.data.canViewReports : true,
    })
    .eq('organization_id', orgId)
    .eq('user_id', parsed.data.userId)
    .neq('role', 'owner');
  if (error) return { error: 'We could not update that member.' };

  revalidatePath('/team');
  return { ok: true };
}

export async function removeMemberAction(userId: string): Promise<TeamResult> {
  const g = await requireManager();
  if (g.error) return { error: g.error };
  const orgId = g.membership!.organizationId;

  const user = await getUser();
  if (user && user.id === userId) return { error: "You can't remove yourself." };

  const svc = createServiceRoleClient();
  // Cannot remove the owner.
  const { error } = await svc
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .neq('role', 'owner');
  if (error) return { error: 'We could not remove that member.' };

  revalidatePath('/team');
  return { ok: true };
}
