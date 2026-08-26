import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/config/env';

/**
 * Service-role client — BYPASSES Row-Level Security.
 *
 * Use ONLY in trusted server code where tenant scoping is enforced manually
 * and the action is audited: platform-admin operations, billing webhooks,
 * cross-tenant background jobs. Never import this into anything that runs in,
 * or is reachable from, the browser.
 */
export function createServiceRoleClient() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. Refusing to create a service-role client.'
    );
  }
  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
