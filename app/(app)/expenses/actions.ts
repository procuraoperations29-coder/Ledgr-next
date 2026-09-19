'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';

const ExpenseSchema = z.object({
  categoryAccountId: z.string().uuid('Choose a category.'),
  amountMajor: z.number().positive('Enter an amount.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentAccountId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  vendor: z.string().trim().max(200).optional(),
  description: z.string().trim().max(500).optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).default('none'),
  onCredit: z.boolean().default(false),
});

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export interface BulkExpenseRow {
  rowNumber: number;
  categoryAccountId: string;
  amountMajor: number;
  date: string;
  paymentAccountId?: string;
  supplierId?: string;
  vendor?: string;
  description?: string;
  onCredit: boolean;
}

export interface BulkImportResultRow {
  rowNumber: number;
  ok: boolean;
  error?: string;
}

export interface BulkImportResult {
  successCount: number;
  failureCount: number;
  rows: BulkImportResultRow[];
}

/**
 * Import many expenses at once. Each row goes through the same
 * `record_expense` RPC as the single-entry form, one at a time — a bad row
 * is skipped and reported rather than failing the whole file.
 */
export async function bulkImportExpensesAction(
  input: BulkExpenseRow[]
): Promise<BulkImportResult> {
  const membership = await getActiveMembership();
  if (!membership) {
    return {
      successCount: 0,
      failureCount: input.length,
      rows: input.map((r) => ({
        rowNumber: r.rowNumber,
        ok: false,
        error: 'Your session has expired. Please log in again.',
      })),
    };
  }

  const supabase = await createClient();
  const results: BulkImportResultRow[] = [];
  let successCount = 0;

  const rows = input.slice(0, 500);

  for (const row of rows) {
    const parsed = ExpenseSchema.safeParse(row);
    if (!parsed.success) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Please check this row.',
      });
      continue;
    }
    const data = parsed.data;
    if (!data.onCredit && !data.paymentAccountId) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: 'Choose the account this was paid from, or mark it as on credit.',
      });
      continue;
    }

    const { error } = await supabase.rpc('record_expense', {
      p_org: membership.organizationId,
      p_category_account: data.categoryAccountId,
      p_amount: Math.round(data.amountMajor * 100),
      p_date: data.date,
      p_payment_account: data.onCredit ? null : data.paymentAccountId,
      p_supplier: data.supplierId ?? null,
      p_vendor: data.vendor ?? null,
      p_description: data.description ?? null,
      p_recurrence: 'none',
      p_on_credit: data.onCredit,
    });

    if (error) {
      const m = error.message.toLowerCase();
      let friendly = 'Could not save this row. Please try again.';
      if (m.includes('no accounts payable'))
        friendly = 'No payable account was found. Please check your chart of accounts.';
      if (m.includes('not authorised') || m.includes('not authorized'))
        friendly = 'You do not have permission to do that.';
      results.push({ rowNumber: row.rowNumber, ok: false, error: friendly });
      continue;
    }

    successCount++;
    results.push({ rowNumber: row.rowNumber, ok: true });
  }

  if (successCount > 0) {
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  }

  return {
    successCount,
    failureCount: results.length - successCount,
    rows: results,
  };
}

export async function recordExpenseAction(
  input: z.input<typeof ExpenseSchema>
): Promise<ActionResult> {
  const parsed = ExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the expense.' };
  }
  const data = parsed.data;

  if (!data.onCredit && !data.paymentAccountId) {
    return { error: 'Choose the account this was paid from.' };
  }

  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_expense', {
    p_org: membership.organizationId,
    p_category_account: data.categoryAccountId,
    p_amount: Math.round(data.amountMajor * 100),
    p_date: data.date,
    p_payment_account: data.onCredit ? null : data.paymentAccountId,
    p_supplier: data.supplierId ?? null,
    p_vendor: data.vendor ?? null,
    p_description: data.description ?? null,
    p_recurrence: data.recurrence,
    p_on_credit: data.onCredit,
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('no accounts payable'))
      return { error: 'No payable account was found. Please check your chart of accounts.' };
    if (m.includes('not authorised') || m.includes('not authorized'))
      return { error: 'You do not have permission to do that.' };
    return { error: 'Something went wrong while saving this expense. Please try again.' };
  }

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  return { ok: true };
}
