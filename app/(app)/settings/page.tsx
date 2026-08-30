import Link from 'next/link';
import { CreditCard, ChevronRight, Users } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getOrgPlan, planAllowsBranding } from '@/lib/plan';
import { Card, CardContent } from '@/components/ui/card';
import { BusinessForm, PreferencesForm } from './settings-forms';
import { BrandingForm, BrandingUpsell } from './branding-form';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: org }, { data: profile }, plan] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, business_type, industry, phone, email, address, currency, fy_start_month, logo_url')
      .eq('id', session.org.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name, accountant_mode')
      .eq('user_id', session.userId)
      .maybeSingle(),
    getOrgPlan(session.org.id),
  ]);

  // brand_color is fetched separately so the page still works if the column
  // hasn't been added yet (migration 0014).
  const { data: brandRow } = await supabase
    .from('organizations')
    .select('brand_color')
    .eq('id', session.org.id)
    .maybeSingle();

  const canEdit = session.role === 'owner' || session.role === 'admin';
  const canBrand = planAllowsBranding(plan);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your business details and preferences.
        </p>
      </div>

      <div className="space-y-6">
        <BusinessForm
          canEdit={canEdit}
          initial={{
            name: org?.name ?? session.org.name,
            businessType: org?.business_type ?? 'Sole Proprietor',
            industry: org?.industry ?? 'Retail',
            phone: org?.phone ?? '',
            email: org?.email ?? '',
            address: org?.address ?? '',
            currency: org?.currency ?? session.org.currency,
            fyStartMonth: org?.fy_start_month ?? 1,
          }}
        />

        <PreferencesForm
          initialName={profile?.full_name ?? session.fullName ?? ''}
          initialAccountantMode={Boolean(profile?.accountant_mode)}
        />

        {/* Custom branding (Growth) — owner/admin only */}
        {canEdit &&
          (canBrand ? (
            <BrandingForm
              initialColor={(brandRow as any)?.brand_color ?? '#0b7d5a'}
              initialLogo={(org as any)?.logo_url ?? null}
            />
          ) : (
            <BrandingUpsell />
          ))}

        {/* Team management — owner/admin only */}
        {canEdit && (
          <Link href="/team">
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Users className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Team</p>
                  <p className="text-sm text-muted-foreground">
                    Add users and choose what each of them can do.
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Billing */}
        <Link href="/billing">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <CreditCard className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Billing &amp; Plan</p>
                <p className="text-sm text-muted-foreground">
                  Manage your subscription and payment.
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
