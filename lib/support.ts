import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export interface TicketRow {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  organization_id: string;
  org_name?: string | null;
}

export interface TicketMessage {
  id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
}

export interface TicketDetail extends TicketRow {
  messages: TicketMessage[];
}

/** Tickets for the current user's org (RLS-scoped). */
export async function getTickets(orgId: string): Promise<TicketRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, priority, created_at, organization_id')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return (data as TicketRow[]) ?? [];
}

export async function getTicket(id: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, created_at, organization_id, messages:ticket_messages(id, body, is_staff, created_at)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const messages = ((data as any).messages ?? []).sort(
    (a: TicketMessage, b: TicketMessage) => a.created_at.localeCompare(b.created_at)
  );
  return { ...(data as any), messages };
}

// ── Admin (service-role, cross-tenant) ──
export async function listAllTickets(status?: string): Promise<TicketRow[]> {
  const svc = createServiceRoleClient();
  let q = svc
    .from('support_tickets')
    .select('id, subject, category, status, priority, created_at, organization_id, organizations(name)')
    // Priority tickets first ('priority' > 'normal'), then newest.
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data } = await q;
  return ((data as any[]) ?? []).map((t) => ({
    id: t.id, subject: t.subject, category: t.category, status: t.status,
    priority: t.priority ?? 'normal',
    created_at: t.created_at, organization_id: t.organization_id,
    org_name: t.organizations?.name ?? null,
  }));
}

export async function getTicketForAdmin(id: string): Promise<TicketDetail | null> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from('support_tickets')
    .select('id, subject, category, status, created_at, organization_id, organizations(name), messages:ticket_messages(id, body, is_staff, created_at)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const messages = ((data as any).messages ?? []).sort(
    (a: TicketMessage, b: TicketMessage) => a.created_at.localeCompare(b.created_at)
  );
  return { ...(data as any), org_name: (data as any).organizations?.name ?? null, messages };
}
