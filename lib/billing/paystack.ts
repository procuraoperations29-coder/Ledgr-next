import 'server-only';
import crypto from 'node:crypto';
import type {
  PaymentProvider,
  InitializeParams,
  InitializeResult,
  VerifyResult,
  WebhookEvent,
} from './types';

const BASE = 'https://api.paystack.co';

/** Paystack (Nigeria). Amounts in kobo. */
export function createPaystackProvider(secretKey: string): PaymentProvider {
  return {
    name: 'paystack',

    async initialize(params: InitializeParams): Promise<InitializeResult> {
      const res = await fetch(`${BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          amount: params.amountKobo,
          currency: params.currency,
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata ?? {},
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.status) {
        throw new Error(json.message ?? 'Paystack initialization failed');
      }
      return {
        authorizationUrl: json.data.authorization_url,
        reference: json.data.reference,
      };
    },

    async verify(reference: string): Promise<VerifyResult> {
      const res = await fetch(`${BASE}/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const json = await res.json();
      const status = json?.data?.status;
      return {
        status: status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending',
        amountKobo: json?.data?.amount ?? 0,
        reference,
        raw: json,
      };
    },

    verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
      if (!signature) return false;
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody)
        .digest('hex');
      // constant-time compare
      const a = Buffer.from(hash);
      const b = Buffer.from(signature);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },

    parseWebhook(body: unknown): WebhookEvent | null {
      const b = body as { event?: string; data?: { reference?: string; status?: string; amount?: number } };
      if (!b?.data?.reference) return null;
      const status = b.event === 'charge.success' || b.data.status === 'success'
        ? 'success'
        : 'failed';
      return {
        reference: b.data.reference,
        status,
        amountKobo: b.data.amount ?? 0,
        raw: body,
      };
    },
  };
}
