import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileHotelBillingState } from '@/lib/billing/reconcile-hotel-billing'
import { stayNights } from '@/lib/stays/helpers'
import type { DbInvoice } from '@/types'

export interface InvoiceWithRoom extends DbInvoice {
  roomNumber: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  guestPhone: string | null
}

interface InvoiceQueryRow extends DbInvoice {
  reservations?: {
    check_in: string
    check_out: string
    rooms?: { number: string } | null
  } | null
}

import { clampLimit } from '@/lib/data/pagination'

export async function getInvoicesData(limit?: number): Promise<InvoiceWithRoom[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []

  const supabase = await createClient()
  await reconcileHotelBillingState(createAdminClient(), profile.hotel_id)

  const { data } = await supabase
    .from('invoices')
    .select('*, reservations(check_in, check_out, rooms(number))')
    .eq('hotel_id', profile.hotel_id)
    .order('issued_at', { ascending: false })
    .limit(clampLimit(limit))

  const rows = (data ?? []) as unknown as InvoiceQueryRow[]
  const guestIds = [...new Set(rows.map((r) => r.guest_id).filter(Boolean))] as string[]
  const phoneByGuestId = new Map<string, string | null>()

  if (guestIds.length > 0) {
    const { data: guests } = await supabase.from('guests').select('id, phone').in('id', guestIds)
    for (const g of guests ?? []) {
      phoneByGuestId.set(g.id, g.phone?.trim() || null)
    }
  }

  return rows.map((row) => {
    const checkIn = row.reservations?.check_in ?? null
    const checkOut = row.reservations?.check_out ?? null
    return {
      ...row,
      roomNumber: row.reservations?.rooms?.number ?? null,
      checkIn,
      checkOut,
      nights: checkIn && checkOut ? stayNights(checkIn, checkOut) : null,
      guestPhone: row.guest_id ? (phoneByGuestId.get(row.guest_id) ?? null) : null,
    }
  })
}
