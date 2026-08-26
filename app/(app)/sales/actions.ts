'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';
import { createNotification } from '@/lib/notify';
import { formatMoney } from '@/lib/format';

const LineSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPriceMajor: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
  productId: z.string().uuid().optional(),
});

const InvoiceSchema = z.object({
  customerId: z.string().uuid('Choose a customer.'),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  revenueAccountId: z.string().uuid('Choose an income type.'),
  discountMajor: z.number().min(0).default(0),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(LineSchema).min(1, 'Add at least one line.'),
});

export interface ActionResult {
  error?: string;
  ok?: boolean;
  id?: string;
}

export async function createInvoiceAction(
  input: z.input<typeof InvoiceSchema>
): Promise<ActionResult> {
  const parsed = InvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the invoice.' };
  }
  const data = parsed.data;
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { data: invoiceId, error } = await supabase.rpc('create_invoice', {
    p_org: membership.organizationId,
    p_customer: data.customerId,
    p_issue_date: data.issueDate,
    p_due_date: data.dueDate || null,
    p_revenue_account: data.revenueAccountId,
    p_lines: data.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price: Math.round(l.unitPriceMajor * 100),
      tax_rate: l.taxRate,
      product_id: l.productId ?? null,
    })),
    p_discount: Math.round((data.discountMajor ?? 0) * 100),
    p_notes: data.notes ?? null,
    p_status: 'sent',
  });

  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath('/sales');
  revalidatePath('/dashboard');
  return { ok: true, id: invoiceId as string };
}

const PaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountMajor: z.number().positive('Enter an amount.'),
  bankAccountId: z.string().uuid('Choose where the money came in.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().trim().optional(),
});

export async function recordInvoicePaymentAction(
  input: z.input<typeof PaymentSchema>
): Promise<ActionResult> {
  const parsed = PaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the payment.' };
  }
  const data = parsed.data;
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_invoice_payment', {
    p_invoice: data.invoiceId,
    p_amount: Math.round(data.amountMajor * 100),
    p_bank_account: data.bankAccountId,
    p_date: data.date,
    p_method: data.method ?? null,
  });

  if (error) return { error: friendlyDbError(error.message) };

  await createNotification({
    organizationId: membership.organizationId,
    type: 'payment_received',
    title: 'Payment received',
    body: `${formatMoney(Math.round(data.amountMajor * 100), membership.organization.currency)} was recorded against an invoice.`,
    link: `/sales/${data.invoiceId}`,
  });

  revalidatePath('/sales');
  revalidatePath(`/sales/${data.invoiceId}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('exceeds the outstanding'))
    return 'That payment is more than the outstanding balance.';
  if (m.includes('does not balance'))
    return 'That invoice did not balance. Please review the lines.';
  if (m.includes('no accounts receivable'))
    return 'No receivable account was found. Please check your chart of accounts.';
  if (m.includes('not authorised') || m.includes('not authorized'))
    return 'You do not have permission to do that.';
  return 'Something went wrong. Please try again.';
}
