'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveMembership } from '@/lib/auth/session';

const ProductSchema = z.object({
  name: z.string().trim().min(1, 'Enter a product name.'),
  sku: z.string().trim().optional(),
  costMajor: z.number().min(0).default(0),
  sellMajor: z.number().min(0).default(0),
  trackInventory: z.boolean().default(false),
  openingQty: z.number().min(0).default(0),
});

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export async function createProductAction(
  input: z.input<typeof ProductSchema>
): Promise<ActionResult> {
  const parsed = ProductSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entry.' };
  }
  const data = parsed.data;
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  const { error } = await supabase.from('products').insert({
    organization_id: membership.organizationId,
    name: data.name,
    sku: data.sku || null,
    cost_price: Math.round(data.costMajor * 100),
    sell_price: Math.round(data.sellMajor * 100),
    track_inventory: data.trackInventory,
    qty_on_hand: data.trackInventory ? data.openingQty : 0,
  });

  if (error) {
    if (error.message.toLowerCase().includes('duplicate'))
      return { error: 'A product with that SKU already exists.' };
    return { error: 'We could not save this product. Please try again.' };
  }
  revalidatePath('/inventory');
  return { ok: true };
}

export async function importProductsAction(
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
  const toKobo = (s: string) => {
    const n = Number(String(s).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  const payload = rows
    .map((r) => {
      const qty = Number(lc(r, ['quantity', 'qty', 'opening quantity', 'stock']).replace(/[^0-9.-]/g, ''));
      const track = Number.isFinite(qty) && qty > 0;
      return {
        organization_id: membership.organizationId,
        name: lc(r, ['name', 'product']).trim(),
        sku: lc(r, ['sku', 'code']).trim() || null,
        cost_price: toKobo(lc(r, ['cost', 'cost price', 'cost_price'])),
        sell_price: toKobo(lc(r, ['price', 'selling price', 'sell price', 'sell_price'])),
        track_inventory: track,
        qty_on_hand: track ? qty : 0,
      };
    })
    .filter((p) => p.name !== '');

  const skipped = rows.length - payload.length;
  if (payload.length === 0) return { error: 'No rows had a name column.' };

  const supabase = await createClient();
  const { error } = await supabase.from('products').insert(payload);
  if (error) return { error: 'We could not import these products. Check for duplicate SKUs and try again.' };

  revalidatePath('/inventory');
  return { ok: true, imported: payload.length, skipped };
}
