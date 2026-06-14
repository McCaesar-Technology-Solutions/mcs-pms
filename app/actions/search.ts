'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import type { UserRole } from '@/types'

export type SearchResultKind = 'guest' | 'reservation' | 'room' | 'invoice'

export interface GlobalSearchResult {
  id: string
  kind: SearchResultKind
  title: string
  subtitle: string
  href: string
}

function basePath(role: UserRole): string {
  if (role === 'owner') return '/owner'
  if (role === 'receptionist') return '/receptionist'
  return '/manager'
}

function bookingRef(id: string): string {
  return `BK-${id.slice(0, 6).toUpperCase()}`
}

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) return null
  return profile as { id: string; role: UserRole; hotel_id: string }
}

export async function globalSearch(query: string): Promise<
  | { success: true; data: GlobalSearchResult[] }
  | { success: false; error: string }
> {
  const profile = await requireStaff()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const q = query.trim()
  if (q.length < 2) return { success: true, data: [] }

  const admin = createAdminClient()
  const hotelId = profile.hotel_id
  const prefix = basePath(profile.role)
  const pattern = `%${q}%`
  const refDigits = q.replace(/^bk-?/i, '').toLowerCase()

  const [guestsRes, reservationsByName, reservationsByRef, roomsRes, invoicesRes] =
    await Promise.all([
      admin
        .from('guests')
        .select('id, name, phone, email')
        .eq('hotel_id', hotelId)
        .or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
        .order('name')
        .limit(5),
      admin
        .from('reservations')
        .select('id, guest_name, status, check_in, check_out, rooms(number)')
        .eq('hotel_id', hotelId)
        .or(`guest_name.ilike.${pattern},id.ilike.${pattern}`)
        .order('check_in', { ascending: false })
        .limit(5),
      refDigits.length >= 2
        ? admin
            .from('reservations')
            .select('id, guest_name, status, check_in, check_out, rooms(number)')
            .eq('hotel_id', hotelId)
            .ilike('id', `${refDigits}%`)
            .order('check_in', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from('rooms')
        .select('id, number, floor, status')
        .eq('hotel_id', hotelId)
        .ilike('number', pattern)
        .order('number')
        .limit(5),
      profile.role === 'owner'
        ? admin
            .from('invoices')
            .select('id, guest_name, invoice_number, total_amount')
            .eq('hotel_id', hotelId)
            .or(`guest_name.ilike.${pattern},invoice_number.ilike.${pattern}`)
            .order('issued_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (guestsRes.error) return { success: false, error: guestsRes.error.message }
  if (reservationsByName.error) return { success: false, error: reservationsByName.error.message }
  if (reservationsByRef.error) return { success: false, error: reservationsByRef.error.message }
  if (roomsRes.error) return { success: false, error: roomsRes.error.message }
  if (invoicesRes.error) return { success: false, error: invoicesRes.error.message }

  const results: GlobalSearchResult[] = []
  const seenReservationIds = new Set<string>()

  for (const g of guestsRes.data ?? []) {
    results.push({
      id: g.id,
      kind: 'guest',
      title: g.name,
      subtitle: g.phone ?? g.email ?? 'Guest',
      href: `${prefix}/guests?q=${encodeURIComponent(g.name)}`,
    })
  }

  for (const r of [...(reservationsByName.data ?? []), ...(reservationsByRef.data ?? [])]) {
    if (seenReservationIds.has(r.id)) continue
    seenReservationIds.add(r.id)
    const room = r.rooms as { number?: string } | null
    const ref = bookingRef(r.id)
    results.push({
      id: r.id,
      kind: 'reservation',
      title: r.guest_name,
      subtitle: `${ref}${room?.number ? ` · Room ${room.number}` : ''} · ${r.status?.replace(/_/g, ' ')}`,
      href: `${prefix}/reservations?open=${r.id}`,
    })
  }

  for (const room of roomsRes.data ?? []) {
    results.push({
      id: room.id,
      kind: 'room',
      title: `Room ${room.number}`,
      subtitle: `Floor ${room.floor ?? '—'} · ${room.status}`,
      href: `${prefix}/rooms?q=${encodeURIComponent(room.number)}`,
    })
  }

  for (const inv of invoicesRes.data ?? []) {
    results.push({
      id: inv.id,
      kind: 'invoice',
      title: formatInvoiceNumber(inv),
      subtitle: `${inv.guest_name} · GHS ${(inv.total_amount ?? 0).toLocaleString()}`,
      href: `${prefix}/billing?q=${encodeURIComponent(formatInvoiceNumber(inv))}`,
    })
  }

  return { success: true, data: results.slice(0, 12) }
}
