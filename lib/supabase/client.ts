import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/config/env';

/** Supabase client for Client Components. Subject to the same RLS policies. */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
