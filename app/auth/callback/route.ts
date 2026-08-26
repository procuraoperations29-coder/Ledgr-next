import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/config/env';

/**
 * Restrict `next` to a same-origin path to prevent open-redirect abuse.
 * Must start with a single "/" and not "//" or "/\" (which browsers treat as
 * protocol-relative → off-site). Anything else falls back to a safe default.
 */
function safeNext(next: string | null): string {
  if (next && /^\/(?![/\\])/.test(next)) return next;
  return '/onboarding';
}

/**
 * Exchanges the auth `code` from an email link (confirmation / password reset)
 * for a session, then forwards the user on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code && supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
