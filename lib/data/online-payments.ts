import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { clampLimit } from '@/lib/data/pagination'
import { isPaymentsEnabled } from '@/lib/payments/enabled'

export interface OnlinePaymentRow {
  id: string
  amount: number
  currency: string
  status: string
  channel: string | null
  provider: string
  providerReference: string
  providerTransactionId: string | null
  guestName: string | null
  invoiceLabel: string | null
  invoiceId: string | null
  guestPortalInitiated: boolean
  createdAt: string
  updatedAt: string
  canMarkAbandoned: boolean
}

const ABANDON_AFTER_MS = 30 * 60 * 1000

export async function getOnlinePaymentsData(limit?: number): Promise<OnlinePaymentRow[]> {
  if (!isPaymentsEnabled()) return []

  const profile = await getVerifiedProfile()
  if (
    !profile?.hotel_id ||
    !['owner', 'manager', 'receptionist'].includes(profile.role)
  ) {
    return []
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select(
      'id, amount, currency, status, channel, provider, provider_reference, provider_transaction_id, guest_portal_initiated, created_at, updated_at, invoice_id, guests(name), invoices(invoice_number, guest_name)',
    )
    .eq('hotel_id', profile.hotel_id)
    .order('created_at', { ascending: false })
    .limit(clampLimit(limit))

  const now = Date.now()

  return (data ?? []).map((row) => {
    const guest = row.guests as { name?: string | null } | null
    const inv = row.invoices as {
      invoice_number?: string | null
      guest_name?: string | null
    } | null
    const createdAt = row.created_at
    const ageMs = now - new Date(createdAt).getTime()

    return {
      id: row.id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      channel: row.channel,
      provider: row.provider,
      providerReference: row.provider_reference,
      providerTransactionId: row.provider_transaction_id,
      guestName: guest?.name ?? inv?.guest_name ?? null,
      invoiceLabel: inv
        ? formatInvoiceNumber({
            invoice_number: inv.invoice_number ?? null,
            id: row.invoice_id ?? '',
          })
        : null,
      invoiceId: row.invoice_id,
      guestPortalInitiated: row.guest_portal_initiated,
      createdAt,
      updatedAt: row.updated_at,
      canMarkAbandoned: row.status === 'pending' && ageMs >= ABANDON_AFTER_MS,
    }
  })
}
