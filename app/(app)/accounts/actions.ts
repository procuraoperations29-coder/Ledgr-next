'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';
import type { AccountType } from '@/lib/accounting/types';

const BANDS: Record<AccountType, [number, number]> = {
  asset: [1000, 1999],
  liability: [2000, 2999],
  equity: [3000, 3999],
  revenue: [4000, 4999],
  cost_of_sales: [5000, 5999],
  expense: [6000, 9999],
};

const DEBIT_TYPES: AccountType[] = ['asset', 'expense', 'cost_of_sales'];

const CreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter an account name.'),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'cost_of_sales', 'expense']),
  subtype: z.string().trim().optional(),
});

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export async function createAccountAction(
  input: z.input<typeof CreateSchema>
): Promise<ActionResult> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entry.' };
  }
  const data = parsed.data;

  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const [lo, hi] = BANDS[data.type];

  // Next free code within the type's band.
  const { data: existing } = await supabase
    .from('accounts')
    .select('code')
    .eq('organization_id', membership.organizationId)
    .gte('code', String(lo))
    .lte('code', String(hi));

  const maxCode = (existing ?? []).reduce((max, r) => {
    const n = Number(r.code);
    return Number.isFinite(n) && n > max ? n : max;
  }, lo - 1);
  const nextCode = String(Math.max(maxCode + 1, lo));

  const isBankOrCash =
    data.type === 'asset' && ['cash', 'bank'].includes(data.subtype ?? '');

  const { error } = await supabase.from('accounts').insert({
    organization_id: membership.organizationId,
    code: nextCode,
    name: data.name,
    plain_name: data.name,
    type: data.type,
    subtype: data.subtype || null,
    normal_balance: DEBIT_TYPES.includes(data.type) ? 'debit' : 'credit',
    is_bank_or_cash: isBankOrCash,
    is_system: false,
  });

  if (error) {
    return { error: 'We could not add that account. Please try again.' };
  }

  revalidatePath('/accounts');
  return { ok: true };
}

export async function archiveAccountAction(
  accountId: string,
  archive: boolean
): Promise<ActionResult> {
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('accounts')
    .update({ is_active: !archive })
    .eq('id', accountId)
    .eq('organization_id', membership.organizationId)
    .eq('is_system', false); // system accounts cannot be archived

  if (error) return { error: 'We could not update that account.' };
  revalidatePath('/accounts');
  return { ok: true };
}
