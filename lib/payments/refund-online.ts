import type { SupabaseClient } from '@supabase/supabase-js'
import { getPaymentProvider } from '@/lib/payments/get-provider'
import { ghsToPesewas } from '@/lib/payments/paystack'
import { isPaymentsEnabled } from '@/lib/payments/enabled'
import type { Database, Json } from '@/lib/supabase/types'

type AdminClient = SupabaseClient<Database>

export type OnlineRefundResult =
  | { ok: true; refundedOnlineGhs: number; references: string[] }
  | { ok: false; error: string }

/**
 * Refund Paystack charges linked to an invoice (newest first) up to `amountGhs`.
 * Marks fully refunded charges as `refunded`. Partial charge refunds stay `success`
 * with refund metadata. Invoice/ledger updates remain the caller's job.
 */
export async function refundOnlineInvoicePayments(
  admin: AdminClient,
  input: {
    hotelId: string
    invoiceId: string
    amountGhs: number
    reason?: string
  },
): Promise<OnlineRefundResult> {
  if (!isPaymentsEnabled()) {
    return { ok: true, refundedOnlineGhs: 0, references: [] }
  }

  const { data: rows } = await admin
    .from('payments')
    .select('id, amount, provider_reference, status, raw_webhook_payload')
    .eq('hotel_id', input.hotelId)
    .eq('invoice_id', input.invoiceId)
    .eq('provider', 'paystack')
    .eq('status', 'success')
    .order('created_at', { ascending: false })

  const available = rows ?? []
  if (available.length === 0) {
    return { ok: true, refundedOnlineGhs: 0, references: [] }
  }

  let remaining = Math.round(input.amountGhs * 100) / 100
  let refundedOnlineGhs = 0
  const references: string[] = []
  const provider = getPaymentProvider('paystack')
  const now = new Date().toISOString()

  for (const row of available) {
    if (remaining <= 0.009) break

    const prior = row.raw_webhook_payload as { refunded_total_ghs?: number } | null
    const alreadyRefunded = Number(prior?.refunded_total_ghs ?? 0)
    const rowAmount = Number(row.amount)
    const refundable = Math.round((rowAmount - alreadyRefunded) * 100) / 100
    if (refundable <= 0.009) continue

    const slice = Math.min(refundable, remaining)
    try {
      await provider.refund({
        transaction: row.provider_reference,
        amountKobo: ghsToPesewas(slice),
        reason: input.reason,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Online refund failed'
      return { ok: false, error: message }
    }

    const newRefundedTotal = Math.round((alreadyRefunded + slice) * 100) / 100
    const fullyRefunded = newRefundedTotal + 0.009 >= rowAmount

    await admin
      .from('payments')
      .update({
        status: fullyRefunded ? 'refunded' : 'success',
        updated_at: now,
        raw_webhook_payload: {
          ...(typeof row.raw_webhook_payload === 'object' && row.raw_webhook_payload
            ? row.raw_webhook_payload
            : {}),
          refunded_total_ghs: newRefundedTotal,
          last_refund: {
            at: now,
            amount: slice,
            reason: input.reason ?? null,
          },
        } as Json,
      })
      .eq('id', row.id)
      .eq('hotel_id', input.hotelId)

    remaining = Math.round((remaining - slice) * 100) / 100
    refundedOnlineGhs = Math.round((refundedOnlineGhs + slice) * 100) / 100
    references.push(row.provider_reference)
  }

  return { ok: true, refundedOnlineGhs, references }
}
