import { createHmac, timingSafeEqual } from 'node:crypto'
import { getPaystackSecretKey } from '@/lib/payments/enabled'
import type {
  PaymentInitializeInput,
  PaymentInitializeResult,
  PaymentProvider,
  PaymentRefundInput,
  PaymentRefundResult,
  PaymentWebhookEvent,
} from '@/lib/payments/provider'

const PAYSTACK_API = 'https://api.paystack.co'

function requireSecret(): string {
  const key = getPaystackSecretKey()
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured')
  }
  return key
}

export function ghsToPesewas(amountGhs: number): number {
  return Math.round(amountGhs * 100)
}

export function pesewasToGhs(amountPesewas: number): number {
  return Math.round(amountPesewas) / 100
}

export function createPaystackProvider(): PaymentProvider {
  return {
    async initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
      const secret = requireSecret()
      const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: input.email,
          amount: input.amountKobo,
          reference: input.reference,
          currency: input.currency ?? 'GHS',
          metadata: input.metadata,
          ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
        }),
      })

      const payload = (await res.json()) as {
        status?: boolean
        message?: string
        data?: { authorization_url?: string; reference?: string; access_code?: string }
      }

      if (!res.ok || !payload.status || !payload.data?.authorization_url || !payload.data.reference) {
        throw new Error(payload.message ?? 'Paystack initialize failed')
      }

      return {
        authorizationUrl: payload.data.authorization_url,
        reference: payload.data.reference,
        accessCode: payload.data.access_code,
      }
    },

    async refund(input: PaymentRefundInput): Promise<PaymentRefundResult> {
      const secret = requireSecret()
      const res = await fetch(`${PAYSTACK_API}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: input.transaction,
          ...(input.amountKobo != null ? { amount: input.amountKobo } : {}),
          ...(input.reason ? { customer_note: input.reason, merchant_note: input.reason } : {}),
        }),
      })

      const payload = (await res.json()) as {
        status?: boolean
        message?: string
        data?: {
          id?: number | string
          transaction?: { reference?: string } | number | string
          amount?: number
          status?: string
        }
      }

      if (!res.ok || !payload.status) {
        throw new Error(payload.message ?? 'Paystack refund failed')
      }

      const tx = payload.data?.transaction
      const txRef =
        typeof tx === 'object' && tx && 'reference' in tx
          ? (tx.reference ?? input.transaction)
          : tx != null
            ? String(tx)
            : input.transaction

      return {
        refundId: payload.data?.id != null ? String(payload.data.id) : null,
        transaction: txRef,
        amountKobo: typeof payload.data?.amount === 'number' ? payload.data.amount : null,
        status: payload.data?.status ?? null,
      }
    },

    verifySignature(rawBody: string, signatureHeader: string): boolean {
      const secret = getPaystackSecretKey()
      if (!secret || !signatureHeader) return false

      const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
      try {
        const a = Buffer.from(expected, 'utf8')
        const b = Buffer.from(signatureHeader, 'utf8')
        if (a.length !== b.length) return false
        return timingSafeEqual(a, b)
      } catch {
        return false
      }
    },

    parseWebhookEvent(rawBody: string): PaymentWebhookEvent {
      let parsed: {
        event?: string
        data?: {
          reference?: string
          id?: number | string
          channel?: string
          amount?: number
          currency?: string
        }
      }
      try {
        parsed = JSON.parse(rawBody) as typeof parsed
      } catch {
        return {
          type: 'ignored',
          reference: '',
          providerTransactionId: null,
          channel: null,
          amountPesewas: null,
          currency: null,
          raw: null,
        }
      }

      const reference = parsed.data?.reference?.trim() ?? ''
      const providerTransactionId =
        parsed.data?.id != null ? String(parsed.data.id) : null
      const channel = parsed.data?.channel?.trim() || null
      const amountPesewas =
        typeof parsed.data?.amount === 'number' ? parsed.data.amount : null
      const currency = parsed.data?.currency?.trim() || null

      if (parsed.event === 'charge.success' && reference) {
        return {
          type: 'charge.success',
          reference,
          providerTransactionId,
          channel,
          amountPesewas,
          currency,
          raw: parsed,
        }
      }

      if (parsed.event === 'charge.failed' && reference) {
        return {
          type: 'charge.failed',
          reference,
          providerTransactionId,
          channel,
          amountPesewas,
          currency,
          raw: parsed,
        }
      }

      return {
        type: 'ignored',
        reference,
        providerTransactionId,
        channel,
        amountPesewas,
        currency,
        raw: parsed,
      }
    },
  }
}
