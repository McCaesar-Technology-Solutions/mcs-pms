import type { PaymentMethod } from '@/types'

/** Map Paystack channel / card brand to our invoice payment_method enum. */
export function paystackChannelToPaymentMethod(
  channel: string | null | undefined,
  cardBrand?: string | null,
): PaymentMethod {
  const ch = (channel ?? '').toLowerCase()
  const brand = (cardBrand ?? '').toLowerCase()

  if (ch === 'mobile_money' || ch === 'mobilemoney') {
    if (brand.includes('telecel') || brand.includes('vodafone')) return 'telecel_cash'
    if (brand.includes('airtel') || brand.includes('tigo')) return 'airteltigo'
    return 'mtn_momo'
  }

  if (ch === 'card') {
    if (brand.includes('master')) return 'mastercard'
    return 'visa'
  }

  if (ch === 'bank' || ch === 'bank_transfer' || ch === 'transfer') {
    return 'bank_transfer'
  }

  return 'mtn_momo'
}
