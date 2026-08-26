import { NextResponse, type NextRequest } from 'next/server';
import { getPaymentProvider, billingConfigured } from '@/lib/billing';
import { activateFromPayment } from '@/lib/billing/activate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Return URL after the hosted checkout. Verifies, then sends the user back. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const reference =
    searchParams.get('reference') ??
    searchParams.get('trxref') ??
    searchParams.get('tx_ref');

  if (reference && billingConfigured()) {
    try {
      const provider = getPaymentProvider();
      const result = await provider.verify(reference);
      if (result.status === 'success') {
        await activateFromPayment(reference, provider.name);
        return NextResponse.redirect(`${origin}/billing?status=success`);
      }
    } catch {
      // fall through to the generic redirect
    }
  }

  return NextResponse.redirect(`${origin}/billing`);
}
