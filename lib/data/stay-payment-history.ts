import type { SupabaseClient } from '@supabase/supabase-js'
import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { PaymentMethod } from '@/types'

export type StayPaymentHistoryRow = {
  id: string
  amount: number
  provider: string
  providerReference: string | null
  paymentMethod: string | null
  completedAt: string | null
  metadata: Record<string, unknown> | null
}

function paymentMethodFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const method = (metadata as { paymentMethod?: string }).paymentMethod
  if (method && method in PAYMENT_METHOD_LABELS) {
    return PAYMENT_METHOD_LABELS[method as PaymentMethod]
  }
  return null
}

export async function getStayPaymentHistory(
  admin: SupabaseClient,
  hotelId: string,
  filter: { reservationId?: string; invoiceId?: string },
): Promise<StayPaymentHistoryRow[]> {
  if (!filter.reservationId && !filter.invoiceId) return []

  let query = admin
    .from('payment_records')
    .select('id, amount, provider, provider_reference, completed_at, metadata, reservation_id, invoice_id')
    .eq('hotel_id', hotelId)
    .eq('status', 'success')
    .order('completed_at', { ascending: true })

  if (filter.reservationId && filter.invoiceId) {
    query = query.or(
      `reservation_id.eq.${filter.reservationId},invoice_id.eq.${filter.invoiceId}`,
    )
  } else if (filter.reservationId) {
    query = query.eq('reservation_id', filter.reservationId)
  } else if (filter.invoiceId) {
    query = query.eq('invoice_id', filter.invoiceId)
  }

  const { data } = await query
  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    provider: row.provider,
    providerReference: row.provider_reference,
    paymentMethod: paymentMethodFromMetadata(row.metadata),
    completedAt: row.completed_at,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }))
}

export function sumSuccessfulPayments(rows: StayPaymentHistoryRow[]): number {
  return Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
}
