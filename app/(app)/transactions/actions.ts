'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';

const RecordSchema = z.object({
  type: z.enum([
    'money_received', 'money_spent', 'transfer', 'sale', 'purchase',
    'customer_payment', 'supplier_payment', 'loan_received', 'loan_repayment',
    'owner_investment', 'owner_withdrawal', 'other',
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.'),
  amountMajor: z.number().positive('Amount must be greater than zero.'),
  accountId: z.string().uuid('Choose an account.'),
  categoryAccountId: z.string().uuid('Choose a category.'),
  description: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(120).optional(),
});

export type RecordTransactionInput = z.input<typeof RecordSchema>;

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export async function recordTransactionAction(
  input: RecordTransactionInput
): Promise<ActionResult> {
  const parsed = RecordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entry.' };
  }
  const data = parsed.data;

  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_transaction', {
    p_org: membership.organizationId,
    p_type: data.type,
    p_date: data.date,
    p_amount: Math.round(data.amountMajor * 100),
    p_account_id: data.accountId,
    p_category_account_id: data.categoryAccountId,
    p_counterparty_type: null,
    p_counterparty_id: null,
    p_description: data.description ?? null,
    p_reference: data.reference ?? null,
    p_attachment_id: null,
  });

  if (error) {
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function reverseTransactionAction(
  txnId: string,
  reason?: string
): Promise<ActionResult> {
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('reverse_transaction', {
    p_txn: txnId,
    p_reason: reason ?? 'Reversed by user',
  });
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { ok: true };
}

export interface BulkImportRow extends RecordTransactionInput {
  /** 1-based row number in the source file, for error reporting. */
  rowNumber: number;
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
 * Import many transactions at once (bulk upload). Each row is validated and
 * posted the same way a single record would be — there is no partial/batched
 * RPC, so a bad row is skipped and reported rather than failing the whole
 * import.
 */
export async function bulkImportTransactionsAction(
  input: BulkImportRow[]
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

  // Cap a single import to keep this within one request's time budget.
  const rows = input.slice(0, 500);

  for (const row of rows) {
    const parsed = RecordSchema.safeParse(row);
    if (!parsed.success) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Please check this row.',
      });
      continue;
    }
    const data = parsed.data;

    const { error } = await supabase.rpc('record_transaction', {
      p_org: membership.organizationId,
      p_type: data.type,
      p_date: data.date,
      p_amount: Math.round(data.amountMajor * 100),
      p_account_id: data.accountId,
      p_category_account_id: data.categoryAccountId,
      p_counterparty_type: null,
      p_counterparty_id: null,
      p_description: data.description ?? null,
      p_reference: data.reference ?? null,
      p_attachment_id: null,
    });

    if (error) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: friendlyDbError(error.message),
      });
      continue;
    }

    successCount++;
    results.push({ rowNumber: row.rowNumber, ok: true });
  }

  if (successCount > 0) {
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
  }

  return {
    successCount,
    failureCount: results.length - successCount,
    rows: results,
  };
}

/** Turn raw DB/RPC errors into friendly messages (§46). */
function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('does not balance'))
    return 'That entry did not balance. Please try again.';
  if (m.includes('closed accounting period'))
    return 'That date is in a closed period and cannot be changed.';
  if (m.includes('not authorised') || m.includes('not authorized'))
    return 'You do not have permission to do that.';
  if (m.includes('different')) return 'The two accounts must be different.';
  if (m.includes('greater than zero')) return 'Amount must be greater than zero.';
  return 'Something went wrong while saving this transaction. Please try again.';
}
