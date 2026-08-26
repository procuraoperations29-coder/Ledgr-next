import 'server-only';
import type {
  PaymentProvider,
  InitializeParams,
  InitializeResult,
  VerifyResult,
  WebhookEvent,
} from './types';

const BASE = 'https://api.flutterwave.com/v3';

/**
 * Flutterwave. Its API works in major units, so we convert kobo→naira on the
 * way out and naira→kobo on the way back. `secretHash` validates webhooks.
 */
export function createFlutterwaveProvider(
  secretKey: string,
  secretHash: string
): PaymentProvider {
  return {
    name: 'flutterwave',

    async initialize(params: InitializeParams): Promise<InitializeResult> {
      const res = await fetch(`${BASE}/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: params.reference,
          amount: params.amountKobo / 100,
          currency: params.currency,
          redirect_url: params.callbackUrl,
          customer: { email: params.email },
          meta: params.metadata ?? {},
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message ?? 'Flutterwave initialization failed');
      }
      return { authorizationUrl: json.data.link, reference: params.reference };
    },

    async verify(reference: string): Promise<VerifyResult> {
      const res = await fetch(
        `${BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      const json = await res.json();
      const status = json?.data?.status;
      return {
        status: status === 'successful' ? 'success' : status === 'failed' ? 'failed' : 'pending',
        amountKobo: Math.round((json?.data?.amount ?? 0) * 100),
        reference,
        raw: json,
      };
    },

    verifyWebhookSignature(_rawBody: string, signature: string | null): boolean {
      // Flutterwave sends the configured secret hash in the verif-hash header.
      return Boolean(signature) && signature === secretHash;
    },

    parseWebhook(body: unknown): WebhookEvent | null {
      const b = body as { data?: { tx_ref?: string; status?: string; amount?: number } };
      if (!b?.data?.tx_ref) return null;
      return {
        reference: b.data.tx_ref,
        status: b.data.status === 'successful' ? 'success' : 'failed',
        amountKobo: Math.round((b.data.amount ?? 0) * 100),
        raw: body,
      };
    },
  };
}
