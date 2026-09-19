import { type NextRequest } from 'next/server';
import { getPaymentProvider, billingConfigured } from '@/lib/billing';
import { activateFromPayment, suspendFromFailedPayment } from '@/lib/billing/activate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Provider webhook (Paystack / Flutterwave). Signature-verified. */
export async function POST(request: NextRequest) {
  if (!billingConfigured()) return new Response('billing not configured', { status: 503 });

  const raw = await request.text();
  const provider = getPaymentProvider();
  const signature =
    request.headers.get('x-paystack-signature') ??
    request.headers.get('verif-hash');

  if (!provider.verifyWebhookSignature(raw, signature)) {
    return new Response('invalid signature', { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad body', { status: 400 });
  }

  const event = provider.parseWebhook(body);
  if (event?.status === 'success') {
    await activateFromPayment(event.reference, provider.name);
  } else if (event?.status === 'failed') {
    await suspendFromFailedPayment(event.reference, provider.name);
  }

  return new Response('ok', { status: 200 });
}
