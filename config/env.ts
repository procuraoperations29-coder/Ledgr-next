/**
 * Centralised environment access.
 *
 * `publicEnv` values are safe for the browser (NEXT_PUBLIC_*).
 * `serverEnv` values must only ever be read in server contexts.
 * `supabaseConfigured()` lets middleware/clients no-op cleanly before keys
 * are wired in, so the app boots during early development.
 */

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  NEXT_PUBLIC_STANDARD_PLAN_PRICE_KOBO: Number(
    process.env.NEXT_PUBLIC_STANDARD_PLAN_PRICE_KOBO ?? 300000
  ),
};

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  BILLING_PROVIDER: process.env.BILLING_PROVIDER ?? 'paystack',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
};

/** True once the Supabase public keys are present. */
export function supabaseConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL &&
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
