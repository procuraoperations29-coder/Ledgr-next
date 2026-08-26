'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { publicEnv, supabaseConfigured } from '@/config/env';

export interface AuthResult {
  error?: string;
}

const NOT_CONFIGURED =
  'Sign-in is not available yet — the database has not been connected. Add your Supabase keys to .env.local.';

const SignUpSchema = z.object({
  fullName: z.string().trim().min(1, 'Please enter your name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const parsed = SignUpSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) return { error: friendlyAuthError(error.message) };

  // If email confirmation is required there is no session yet.
  if (!data.session) redirect('/verify');
  redirect('/onboarding');
}

const SignInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function signInAction(formData: FormData): Promise<AuthResult> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: friendlyAuthError(error.message) };
  redirect('/dashboard');
}

export async function signOutAction(): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect('/login');
}

const ResetSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

export async function requestPasswordResetAction(
  formData: FormData
): Promise<AuthResult & { sent?: boolean }> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const parsed = ResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid email.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/settings` }
  );
  if (error) return { error: friendlyAuthError(error.message) };
  return { sent: true };
}

/** Never leak raw provider errors to users (§46). */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('already registered') || m.includes('already exists'))
    return 'An account with that email already exists. Try logging in.';
  if (m.includes('email not confirmed'))
    return 'Please confirm your email first — check your inbox.';
  if (m.includes('rate limit'))
    return 'Too many attempts. Please wait a moment and try again.';
  return 'Something went wrong. Please try again.';
}
