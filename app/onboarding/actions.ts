'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/config/env';
import { getUser, ACTIVE_ORG_COOKIE } from '@/lib/auth/session';

const AccountInput = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(['cash', 'bank']),
  openingMajor: z.number().min(0).default(0),
});

const CreateBusinessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required.'),
  businessType: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  currency: z.string().trim().default('NGN'),
  fyStartMonth: z.number().int().min(1).max(12).default(1),
  accounts: z.array(AccountInput).default([]),
});

export type CreateBusinessInput = z.input<typeof CreateBusinessSchema>;

export interface CreateBusinessResult {
  error?: string;
  orgId?: string;
}

export async function createBusinessAction(
  input: CreateBusinessInput
): Promise<CreateBusinessResult> {
  if (!supabaseConfigured()) {
    return {
      error:
        'The database is not connected yet. Add your Supabase keys to .env.local to create a business.',
    };
  }

  const user = await getUser();
  if (!user) return { error: 'Your session has expired. Please log in again.' };

  const parsed = CreateBusinessSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your details.' };
  }
  const data = parsed.data;
  const supabase = await createClient();

  // 1. Create the organisation + owner membership (atomic RPC).
  const { data: orgId, error: orgErr } = await supabase.rpc(
    'create_organization',
    {
      p_name: data.name,
      p_business_type: data.businessType ?? null,
      p_industry: data.industry ?? null,
      p_currency: data.currency,
      p_country: 'NG',
      p_fy_start_month: data.fyStartMonth,
    }
  );
  if (orgErr || !orgId) {
    return { error: 'We could not create your business. Please try again.' };
  }

  // 2. Seed the default chart of accounts.
  const { error: seedErr } = await supabase.rpc('seed_default_accounts', {
    p_org: orgId,
  });
  if (seedErr) return { error: 'We could not set up your accounts. Please try again.' };

  // 2b. Start the 14-day trial subscription (non-fatal if it fails).
  await supabase.rpc('ensure_subscription', { p_org: orgId });

  // 3. Save the remaining business details.
  await supabase
    .from('organizations')
    .update({
      phone: data.phone ?? null,
      address: data.address ?? null,
    })
    .eq('id', orgId);

  // 4. Resolve seeded Cash (1000), Bank (1010) and Owner's Capital (3000).
  const { data: seeded } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('organization_id', orgId)
    .in('code', ['1000', '1010', '3000']);

  const byCode = new Map((seeded ?? []).map((a) => [a.code, a.id as string]));
  const capitalId = byCode.get('3000');

  // 5. Map each requested account to a real account id (reuse defaults, create extras).
  const openingLines: { account_id: string; debit: number; credit: number }[] = [];
  let usedCash = false;
  let usedBank = false;
  let nextCashCode = 1001;
  let nextBankCode = 1011;

  for (const acc of data.accounts) {
    const openingKobo = Math.round((acc.openingMajor ?? 0) * 100);
    let accountId: string | undefined;

    if (acc.kind === 'cash' && !usedCash) {
      usedCash = true;
      accountId = byCode.get('1000');
      if (accountId) {
        await supabase
          .from('accounts')
          .update({ name: acc.name, plain_name: acc.name })
          .eq('id', accountId);
      }
    } else if (acc.kind === 'bank' && !usedBank) {
      usedBank = true;
      accountId = byCode.get('1010');
      if (accountId) {
        await supabase
          .from('accounts')
          .update({ name: acc.name, plain_name: acc.name })
          .eq('id', accountId);
      }
    } else {
      const code = acc.kind === 'cash' ? String(nextCashCode++) : String(nextBankCode++);
      const { data: created } = await supabase
        .from('accounts')
        .insert({
          organization_id: orgId,
          code,
          name: acc.name,
          plain_name: acc.name,
          type: 'asset',
          subtype: acc.kind,
          normal_balance: 'debit',
          is_bank_or_cash: true,
          is_system: false,
        })
        .select('id')
        .single();
      accountId = created?.id;
    }

    if (accountId && openingKobo > 0) {
      openingLines.push({ account_id: accountId, debit: openingKobo, credit: 0 });
    }
  }

  // 6. Post the opening balances as one balanced journal (Cr Owner's Capital).
  const totalOpening = openingLines.reduce((s, l) => s + l.debit, 0);
  if (totalOpening > 0 && capitalId) {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
      ...openingLines,
      { account_id: capitalId, debit: 0, credit: totalOpening },
    ];
    const { error: postErr } = await supabase.rpc('post_journal_entry', {
      p_org: orgId,
      p_date: today,
      p_description: 'Opening balances',
      p_reference: null,
      p_source_type: 'opening',
      p_source_id: null,
      p_lines: lines,
    });
    if (postErr) {
      return {
        error:
          'Your business was created, but we could not record the opening balances. You can add them later.',
        orgId: orgId as string,
      };
    }
  }

  // 7. Mark onboarding complete and select this org.
  await supabase
    .from('organizations')
    .update({ onboarding_completed: true })
    .eq('id', orgId);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId as string, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return { orgId: orgId as string };
}
