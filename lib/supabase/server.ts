import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/config/env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads/writes the auth cookie so RLS runs as the signed-in user.
 *
 * Every tenant query made through this client is automatically constrained
 * by Row-Level Security to the caller's organisation memberships.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore — middleware refreshes the session.
          }
        },
      },
    }
  );
}
