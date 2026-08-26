'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';

export async function markAllReadAction(): Promise<{ ok?: boolean; error?: string }> {
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Session expired.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('organization_id', membership.organizationId)
    .is('read_at', null);

  if (error) return { error: 'Could not update notifications.' };
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
  return { ok: true };
}
