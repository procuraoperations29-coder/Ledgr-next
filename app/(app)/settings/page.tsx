import Link from 'next/link';
import { CreditCard, ChevronRight } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { BusinessForm, PreferencesForm } from './settings-forms';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, business_type, industry, phone, email, address, currency, fy_start_month')
      .eq('id', session.org.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name, accountant_mode')
      .eq('user_id', session.userId)
      .maybeSingle(),
  ]);

  const canEdit = session.role === 'owner' || session.role === 'admin';

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

        {/* Quick link to billing */}
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
