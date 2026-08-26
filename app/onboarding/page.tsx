import { redirect } from 'next/navigation';
import { getUser, getMemberships } from '@/lib/auth/session';
import { supabaseConfigured } from '@/config/env';
import { OnboardingWizard } from './wizard';

export const metadata = { title: 'Set up your business' };

export default async function OnboardingPage() {
  // Before DB is wired we still let the wizard render (it explains the state).
  if (supabaseConfigured()) {
    const user = await getUser();
    if (!user) redirect('/login');

    const memberships = await getMemberships();
    const onboarded = memberships.find((m) => m.organization.onboardingCompleted);
    if (onboarded) redirect('/dashboard');
  }

  return <OnboardingWizard />;
}
