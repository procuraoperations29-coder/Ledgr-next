/**
 * Provider-agnostic billing abstraction (§30).
 *
 * The rest of the app talks only to `PaymentProvider`; concrete providers
 * (Paystack, Flutterwave) live behind it. Never hard-code a provider — resolve
 * one via `getPaymentProvider()`.
 */

export interface InitializeParams {
  email: string;
  amountKobo: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyResult {
  status: 'success' | 'failed' | 'pending';
  amountKobo: number;
  reference: string;
  raw: unknown;
}

export interface WebhookEvent {
  reference: string;
  status: 'success' | 'failed' | 'pending';
  amountKobo: number;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  /** Start a checkout; returns a hosted authorization URL to redirect to. */
  initialize(params: InitializeParams): Promise<InitializeResult>;
  /** Confirm a transaction server-side by reference. */
  verify(reference: string): Promise<VerifyResult>;
  /** Validate an inbound webhook signature against the raw body. */
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  /** Parse a validated webhook body into a normalised event. */
  parseWebhook(body: unknown): WebhookEvent | null;
}
