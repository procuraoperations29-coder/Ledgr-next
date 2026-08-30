'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getActiveMembership, getUser } from '@/lib/auth/session';
import { getOrgPlan, planAllowsBranding } from '@/lib/plan';

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

const BusinessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required.'),
  businessType: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  currency: z.string().trim().min(1),
  fyStartMonth: z.number().int().min(1).max(12),
});

export async function updateBusinessAction(
  input: z.input<typeof BusinessSchema>
): Promise<ActionResult> {
  const parsed = BusinessSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entries.' };
  }
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };
  if (!['owner', 'admin'].includes(membership.role)) {
    return { error: 'Only an owner or admin can change business settings.' };
  }

  const d = parsed.data;
  const supabase = await createClient();
  // RLS (org_update) also enforces owner/admin server-side.
  const { error } = await supabase
    .from('organizations')
    .update({
      name: d.name,
      business_type: d.businessType || null,
      industry: d.industry || null,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      currency: d.currency,
      fy_start_month: d.fyStartMonth,
    })
    .eq('id', membership.organizationId);

  if (error) return { error: 'We could not save your business settings. Please try again.' };
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true };
}

const ProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.'),
  accountantMode: z.boolean(),
});

export async function updateProfileAction(
  input: z.input<typeof ProfileSchema>
): Promise<ActionResult> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your entries.' };
  }
  const user = await getUser();
  if (!user) return { error: 'Your session has expired. Please log in again.' };

  const supabase = await createClient();
  // Ensure a profile row exists, then update (upsert covers first-time rows).
  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      full_name: parsed.data.fullName,
      accountant_mode: parsed.data.accountantMode,
    },
    { onConflict: 'user_id' }
  );

  if (error) return { error: 'We could not save your preferences. Please try again.' };
  revalidatePath('/settings');
  return { ok: true };
}

/** Custom branding — brand colour + logo. Growth-plan only. */
export async function updateBrandingAction(
  formData: FormData
): Promise<ActionResult> {
  const membership = await getActiveMembership();
  if (!membership) return { error: 'Your session has expired. Please log in again.' };
  if (!['owner', 'admin'].includes(membership.role)) {
    return { error: 'Only an owner or admin can change branding.' };
  }

  const plan = await getOrgPlan(membership.organizationId);
  if (!planAllowsBranding(plan)) {
    return {
      error:
        'Custom branding is a Growth feature. Upgrade to add your own logo and colours.',
    };
  }

  const orgId = membership.organizationId;
  const brandColor = String(formData.get('brandColor') ?? '').trim();
  const removeLogo = formData.get('removeLogo') === 'on';
  const file = formData.get('logo') as File | null;

  const update: Record<string, string | null> = {};

  if (brandColor) {
    if (!/^#?[0-9a-fA-F]{6}$/.test(brandColor)) {
      return { error: 'Enter a valid hex colour, e.g. #0b7d5a.' };
    }
    update.brand_color = brandColor.startsWith('#') ? brandColor : '#' + brandColor;
  } else {
    update.brand_color = null;
  }

  const svc = createServiceRoleClient();

  if (removeLogo) {
    update.logo_url = null;
  } else if (file && file.size > 0) {
    if (!file.type.startsWith('image/')) return { error: 'Please upload an image file.' };
    if (file.size > 2 * 1024 * 1024) return { error: 'Logo must be under 2MB.' };
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${orgId}/logo-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await svc.storage
      .from('branding')
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (upErr) return { error: 'We could not upload the logo. Please try again.' };
    update.logo_url = svc.storage.from('branding').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await svc.from('organizations').update(update).eq('id', orgId);
  if (error) return { error: 'We could not save your branding. Please try again.' };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true };
}
