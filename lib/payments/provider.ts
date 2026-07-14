export type PaymentWebhookEventType = 'charge.success' | 'charge.failed' | 'ignored'

export interface PaymentWebhookEvent {
  type: PaymentWebhookEventType
  reference: string
  providerTransactionId: string | null
  channel: string | null
  amountPesewas: number | null
  currency: string | null
  raw: unknown
}

export interface PaymentInitializeInput {
  amountKobo: number
  email: string
  reference: string
  metadata: Record<string, unknown>
  callbackUrl?: string
  currency?: string
}

export interface PaymentInitializeResult {
  authorizationUrl: string
  reference: string
  accessCode?: string
}

export interface PaymentProvider {
  initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult>
  verifySignature(rawBody: string, signatureHeader: string): boolean
  parseWebhookEvent(rawBody: string): PaymentWebhookEvent
}

export type PaymentProviderId = 'paystack'
