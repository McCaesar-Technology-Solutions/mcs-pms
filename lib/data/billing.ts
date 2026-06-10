import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import type { DbInvoice } from '@/types'

export interface InvoiceWithRoom extends DbInvoice {
  roomNumber: string | null
}

interface InvoiceQueryRow extends DbInvoice {
  reservations?: { rooms?: { number: string } | null } | null
}

export async function getInvoicesData(): Promise<InvoiceWithRoom[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('invoices')
    .select('*, reservations(rooms(number))')
    .eq('hotel_id', profile.hotel_id)
    .order('issued_at', { ascending: false })

  const rows = (data ?? []) as unknown as InvoiceQueryRow[]

  return rows.map((row) => ({
    ...row,
    roomNumber: row.reservations?.rooms?.number ?? null,
  }))
}
