'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';

const PartySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export interface ActionResult {
  error?: string;
  ok?: boolean;
  id?: string;
}

export async function createCustomerAction(
  input: z.input<typeof PartySchema>
): Promise<ActionResult> {
  const parsed = PartySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entry.' };
  }
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({
      organization_id: membership.organizationId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
    })
    .select('id')
    .single();

  if (error) return { error: 'We could not save this customer. Please try again.' };
  revalidatePath('/customers');
  return { ok: true, id: data?.id };
}

export async function importCustomersAction(
  rows: Record<string, string>[]
): Promise<{ ok?: boolean; error?: string; imported?: number; skipped?: number }> {
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const lc = (r: Record<string, string>, keys: string[]) => {
    for (const k of Object.keys(r)) {
      if (keys.includes(k.toLowerCase().trim())) return r[k];
    }
    return '';
  };

  const payload = rows
    .map((r) => ({
      organization_id: membership.organizationId,
      name: lc(r, ['name', 'customer', 'business']).trim(),
      email: lc(r, ['email']).trim() || null,
      phone: lc(r, ['phone', 'telephone', 'mobile']).trim() || null,
      address: lc(r, ['address']).trim() || null,
    }))
    .filter((p) => p.name !== '');

  const skipped = rows.length - payload.length;
  if (payload.length === 0) return { error: 'No rows had a name column.' };

  const supabase = await createClient();
  const { error } = await supabase.from('customers').insert(payload);
  if (error) return { error: 'We could not import these customers. Check the file and try again.' };

  revalidatePath('/customers');
  return { ok: true, imported: payload.length, skipped };
}

export async function archiveCustomerAction(
  id: string,
  archive: boolean
): Promise<ActionResult> {
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ is_active: !archive })
    .eq('id', id)
    .eq('organization_id', membership.organizationId);
  if (error) return { error: 'We could not update this customer.' };
  revalidatePath('/customers');
  return { ok: true };
}
