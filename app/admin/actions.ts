'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUser } from '@/lib/auth/session';
import { isPlatformAdmin } from '@/lib/admin/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

async function auth() {
  const user = await getUser();
  if (!user) return { error: 'Not signed in.' as string };
  if (!(await isPlatformAdmin())) return { error: 'Not authorised.' as string };
  return { user };
}

async function logAdmin(
  adminId: string,
  action: string,
  orgId: string,
  summary: string
) {
  const svc = createServiceRoleClient();
  await svc.from('audit_logs').insert({
    organization_id: orgId,
    user_id: adminId,
    action,
    entity: 'organizations',
    entity_id: orgId,
    summary,
  });
}

const StatusSchema = z.object({
  orgId: z.string().uuid(),
  status: z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled']),
});

export async function setOrgStatusAction(
  input: z.input<typeof StatusSchema>
): Promise<ActionResult> {
  const a = await auth();
  if (a.error) return { error: a.error };
  const parsed = StatusSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from('organizations')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.orgId);
  if (error) return { error: 'Could not update the business.' };

  await logAdmin(a.user!.id, `admin.status.${parsed.data.status}`, parsed.data.orgId, `Business status set to ${parsed.data.status}`);
  revalidatePath(`/admin/organizations/${parsed.data.orgId}`);
  revalidatePath('/admin/organizations');
  return { ok: true };
}

const SubSchema = z.object({
  orgId: z.string().uuid(),
  status: z.enum(['trial', 'active', 'past_due', 'cancelled', 'suspended']),
});

export async function setSubscriptionStatusAction(
  input: z.input<typeof SubSchema>
): Promise<ActionResult> {
  const a = await auth();
  if (a.error) return { error: a.error };
  const parsed = SubSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from('subscriptions')
    .update({ status: parsed.data.status })
    .eq('organization_id', parsed.data.orgId);
  if (error) return { error: 'Could not update the subscription.' };

  await logAdmin(a.user!.id, `admin.subscription.${parsed.data.status}`, parsed.data.orgId, `Subscription set to ${parsed.data.status}`);
  revalidatePath(`/admin/organizations/${parsed.data.orgId}`);
  return { ok: true };
}

const TrialSchema = z.object({
  orgId: z.string().uuid(),
  days: z.number().int().min(1).max(365),
});

export async function extendTrialAction(
  input: z.input<typeof TrialSchema>
): Promise<ActionResult> {
  const a = await auth();
  if (a.error) return { error: a.error };
  const parsed = TrialSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const svc = createServiceRoleClient();
  const { data: sub } = await svc
    .from('subscriptions')
    .select('trial_ends_at')
    .eq('organization_id', parsed.data.orgId)
    .maybeSingle();

  const base = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
  const from = base.getTime() > Date.now() ? base : new Date();
  const next = new Date(from.getTime() + parsed.data.days * 86400000);

  const { error } = await svc
    .from('subscriptions')
    .update({ trial_ends_at: next.toISOString(), status: 'trial' })
    .eq('organization_id', parsed.data.orgId);
  if (error) return { error: 'Could not extend the trial.' };

  await logAdmin(a.user!.id, 'admin.trial.extend', parsed.data.orgId, `Trial extended by ${parsed.data.days} days`);
  revalidatePath(`/admin/organizations/${parsed.data.orgId}`);
  return { ok: true };
}

// ── Support (admin) ──
const AdminReplySchema = z.object({
  ticketId: z.string().uuid(),
  orgId: z.string().uuid(),
  message: z.string().trim().min(1),
});

export async function adminReplyTicketAction(
  input: z.input<typeof AdminReplySchema>
): Promise<ActionResult> {
  const a = await auth();
  if (a.error) return { error: a.error };
  const parsed = AdminReplySchema.safeParse(input);
  if (!parsed.success) return { error: 'Enter a message.' };

  const svc = createServiceRoleClient();
  const { error } = await svc.from('ticket_messages').insert({
    ticket_id: parsed.data.ticketId,
    organization_id: parsed.data.orgId,
    author_id: a.user!.id,
    is_staff: true,
    body: parsed.data.message,
  });
  if (error) return { error: 'Could not send the reply.' };

  await svc
    .from('support_tickets')
    .update({ status: 'in_progress' })
    .eq('id', parsed.data.ticketId)
    .eq('status', 'open');

  revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  return { ok: true };
}

const TicketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});

export async function setTicketStatusAction(
  input: z.input<typeof TicketStatusSchema>
): Promise<ActionResult> {
  const a = await auth();
  if (a.error) return { error: a.error };
  const parsed = TicketStatusSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid status.' };

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from('support_tickets')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.ticketId);
  if (error) return { error: 'Could not update the ticket.' };

  revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  revalidatePath('/admin/tickets');
  return { ok: true };
}
