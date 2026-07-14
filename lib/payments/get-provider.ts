import { createPaystackProvider } from '@/lib/payments/paystack'
import type { PaymentProvider, PaymentProviderId } from '@/lib/payments/provider'

export function getPaymentProvider(id: PaymentProviderId = 'paystack'): PaymentProvider {
  switch (id) {
    case 'paystack':
      return createPaystackProvider()
    default: {
      const _exhaustive: never = id
      throw new Error(`Unsupported payment provider: ${_exhaustive}`)
    }
  }
}
