'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership, getUser } from '@/lib/auth/session';

export interface ActionResult {
  error?: string;
  ok?: boolean;
  id?: string;
}

const CreateSchema = z.object({
  subject: z.string().trim().min(1, 'Enter a subject.'),
  category: z.enum(['question', 'bug', 'account', 'billing', 'other']),
  message: z.string().trim().min(1, 'Describe your issue.'),
});

export async function createTicketAction(
  input: z.input<typeof CreateSchema>
): Promise<ActionResult> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entry.' };
  }
  const [user, membership] = await Promise.all([getUser(), getActiveMembership()]);
  if (!user || !membership) return { error: 'Your session has expired.' };

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      organization_id: membership.organizationId,
      created_by: user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
    })
    .select('id')
    .single();
  if (error || !ticket) return { error: 'We could not create your ticket. Please try again.' };

  await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    organization_id: membership.organizationId,
    author_id: user.id,
    is_staff: false,
    body: parsed.data.message,
  });

  revalidatePath('/support');
  return { ok: true, id: ticket.id };
}

const ReplySchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1, 'Enter a message.'),
});

export async function replyTicketAction(
  input: z.input<typeof ReplySchema>
): Promise<ActionResult> {
  const parsed = ReplySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Enter a message.' };

  const [user, membership] = await Promise.all([getUser(), getActiveMembership()]);
  if (!user || !membership) return { error: 'Your session has expired.' };

  const supabase = await createClient();
  const { error } = await supabase.from('ticket_messages').insert({
    ticket_id: parsed.data.ticketId,
    organization_id: membership.organizationId,
    author_id: user.id,
    is_staff: false,
    body: parsed.data.message,
  });
  if (error) return { error: 'We could not send your reply.' };

  revalidatePath(`/support/${parsed.data.ticketId}`);
  return { ok: true };
}
