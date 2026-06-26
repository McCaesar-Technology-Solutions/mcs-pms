import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileHotelBillingState } from '@/lib/billing/reconcile-hotel-billing'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { clampLimit } from '@/lib/data/pagination'
import { invoiceBalanceDue } from '@/lib/billing/invoice-payments'

export interface PaymentRecordRow {
  id: string
  invoiceId: string | null
  invoiceLabel: string | null
  guestName: string | null
  provider: string
  providerReference: string | null
  amount: number
  status: string
  completedAt: string | null
  createdAt: string | null
}

export interface PaymentReconciliationSummary {
  totalCollected: number
  manualCollected: number
  pendingInvoiceBalance: number
  recordCount: number
}

export async function getPaymentRecordsData(limit?: number): Promise<PaymentRecordRow[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'owner') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('payment_records')
    .select(
      'id, invoice_id, provider, provider_reference, amount, status, completed_at, created_at, invoices(invoice_number, guest_name)',
    )
    .eq('hotel_id', profile.hotel_id)
    .order('created_at', { ascending: false })
    .limit(clampLimit(limit))

  return (data ?? []).map((row) => {
    const inv = row.invoices as { invoice_number?: string | null; guest_name?: string } | null
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceLabel: inv
        ? formatInvoiceNumber({
            invoice_number: inv.invoice_number ?? null,
            id: row.invoice_id ?? '',
          })
        : null,
      guestName: inv?.guest_name ?? null,
      provider: row.provider,
      providerReference: row.provider_reference,
      amount: Number(row.amount),
      status: row.status,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }
  })
}

export async function getPaymentReconciliationSummary(): Promise<PaymentReconciliationSummary | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'owner') return null

  const supabase = await createClient()
  await reconcileHotelBillingState(createAdminClient(), profile.hotel_id)

  const [{ data: payments }, { data: invoices }] = await Promise.all([
    supabase
      .from('payment_records')
      .select('amount, status, provider')
      .eq('hotel_id', profile.hotel_id)
      .eq('status', 'success'),
    supabase
      .from('invoices')
      .select('total_amount, amount_paid, payment_status')
      .eq('hotel_id', profile.hotel_id)
      .in('payment_status', ['pending', 'partial', 'overdue']),
  ])

  const rows = payments ?? []
  const totalCollected = rows.reduce((sum, r) => sum + Number(r.amount), 0)
  const manualCollected = rows
    .filter((r) => r.provider === 'manual')
    .reduce((sum, r) => sum + Number(r.amount), 0)

  const pendingInvoiceBalance = (invoices ?? []).reduce(
    (sum, inv) =>
      sum + invoiceBalanceDue(Number(inv.total_amount ?? 0), Number(inv.amount_paid ?? 0)),
    0,
  )

  return {
    totalCollected: Math.round(totalCollected * 100) / 100,
    manualCollected: Math.round(manualCollected * 100) / 100,
    pendingInvoiceBalance: Math.round(pendingInvoiceBalance * 100) / 100,
    recordCount: rows.length,
  }
}
