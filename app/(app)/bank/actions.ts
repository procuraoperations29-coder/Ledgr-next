'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';

const BankSchema = z.object({
  name: z.string().trim().min(1, 'Enter an account name.'),
  kind: z.enum(['bank', 'cash']),
  openingMajor: z.number().min(0).default(0),
});

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export async function createBankAccountAction(
  input: z.input<typeof BankSchema>
): Promise<ActionResult> {
  const parsed = BankSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entry.' };
  }
  const data = parsed.data;
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const org = membership.organizationId;

  // Next free code in the asset band (1000–1999).
  const { data: existing } = await supabase
    .from('accounts')
    .select('code')
    .eq('organization_id', org)
    .gte('code', '1000')
    .lte('code', '1999');
  const maxCode = (existing ?? []).reduce((max, r) => {
    const n = Number(r.code);
    return Number.isFinite(n) && n > max ? n : max;
  }, 999);
  const code = String(maxCode + 1);

  const { data: created, error } = await supabase
    .from('accounts')
    .insert({
      organization_id: org,
      code,
      name: data.name,
      plain_name: data.name,
      type: 'asset',
      subtype: data.kind,
      normal_balance: 'debit',
      is_bank_or_cash: true,
      is_system: false,
    })
    .select('id')
    .single();

  if (error || !created) {
    return { error: 'We could not add this account. Please try again.' };
  }

  // Opening balance → Dr new account, Cr Owner's Capital.
  const opening = Math.round((data.openingMajor ?? 0) * 100);
  if (opening > 0) {
    const { data: capital } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', org)
      .eq('subtype', 'capital')
      .order('code')
      .limit(1)
      .single();
    if (capital) {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.rpc('post_journal_entry', {
        p_org: org,
        p_date: today,
        p_description: `Opening balance — ${data.name}`,
        p_reference: null,
        p_source_type: 'opening',
        p_source_id: null,
        p_lines: [
          { account_id: created.id, debit: opening, credit: 0 },
          { account_id: capital.id, debit: 0, credit: opening },
        ],
      });
    }
  }

  revalidatePath('/bank');
  revalidatePath('/accounts');
  return { ok: true };
}
