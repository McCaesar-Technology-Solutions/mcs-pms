import { createAdminClient } from '@/lib/supabase/admin'

export async function allocateInvoiceNumber(hotelId: string): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('allocate_invoice_number', {
    p_hotel_id: hotelId,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to allocate invoice number.')
  }

  return data as string
}

export function formatInvoiceNumber(inv: {
  invoice_number?: string | null
  id: string
}): string {
  if (inv.invoice_number) return inv.invoice_number
  return `INV-${inv.id.slice(0, 6).toUpperCase()}`
}
