import 'server-only';
import { createPaystackProvider } from './paystack';
import { createFlutterwaveProvider } from './flutterwave';
import type { PaymentProvider } from './types';

export * from './types';

/** True once the configured provider has the keys it needs to charge. */
export function billingConfigured(): boolean {
  const provider = process.env.BILLING_PROVIDER ?? 'paystack';
  if (provider === 'paystack') return Boolean(process.env.PAYSTACK_SECRET_KEY);
  if (provider === 'flutterwave')
    return Boolean(
      process.env.FLUTTERWAVE_SECRET_KEY && process.env.FLUTTERWAVE_SECRET_HASH
    );
  return false;
}

/** Resolve the configured payment provider. Throws if not configured. */
export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.BILLING_PROVIDER ?? 'paystack';

  if (provider === 'paystack') {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured.');
    return createPaystackProvider(key);
  }

  if (provider === 'flutterwave') {
    const key = process.env.FLUTTERWAVE_SECRET_KEY;
    const hash = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!key || !hash)
      throw new Error('Flutterwave keys are not configured.');
    return createFlutterwaveProvider(key, hash);
  }

  throw new Error(`Unknown BILLING_PROVIDER: ${provider}`);
}
