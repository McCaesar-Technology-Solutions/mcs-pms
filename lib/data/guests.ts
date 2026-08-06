import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import { revealStoredPortalPin } from '@/lib/guest/portal-pin-crypto'
import { isVoidedReservationStatus } from '@/lib/reservations/lifecycle'
import {
  sortGuestDirectory,
  type GuestRow,
  type GuestStatus,
} from '@/lib/guests/guest-directory'
import {
  clampLimit,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  pageToOffset,
  totalPagesForCount,
} from '@/lib/data/pagination'
import type { DbReservation } from '@/types'

export type { GuestRow, GuestStatus } from '@/lib/guests/guest-directory'
export { sortGuestDirectory } from '@/lib/guests/guest-directory'

export interface GuestsPageResult {
  guests: GuestRow[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

interface GuestQueryRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  room_id: string | null
  check_in: string | null
  check_out: string | null
  created_at: string | null
  token: string | null
  token_expires_at: string | null
  portal_pin?: string | null
  do_not_disturb?: boolean | null
  rooms?: { number: string } | null
}

const VIP_SPEND_THRESHOLD = 5000
const VIP_STAYS_THRESHOLD = 4

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function deriveStatus(
  stays: number,
  spent: number,
  isCurrentlyStaying: boolean,
): GuestStatus {
  if (isCurrentlyStaying) return 'active'
  if (spent >= VIP_SPEND_THRESHOLD || stays >= VIP_STAYS_THRESHOLD) return 'vip'
  if (stays >= 2) return 'returning'
  return 'new'
}

async function mapGuestRows(
  guests: GuestQueryRow[],
  reservations: DbReservation[],
): Promise<GuestRow[]> {
  const byGuest = new Map<string, DbReservation[]>()
  for (const res of reservations) {
    if (!res.guest_id) continue
    const list = byGuest.get(res.guest_id) ?? []
    list.push(res)
    byGuest.set(res.guest_id, list)
  }

  const today = todayStr()

  const rows = await Promise.all(
    guests.map(async (guest) => {
      const resList = (byGuest.get(guest.id) ?? []).filter(
        (r) => !isVoidedReservationStatus(r.status),
      )

      const stays = resList.length > 0 ? resList.length : guest.check_in ? 1 : 0
      const totalSpent = resList.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)

      const checkOuts = [...resList.map((r) => r.check_out), guest.check_out].filter(
        (d): d is string => Boolean(d),
      )
      const lastStay = checkOuts.length > 0 ? (checkOuts.sort().at(-1) ?? null) : null

      const isCurrentlyStaying =
        resList.some((r) => r.status === 'checked_in') ||
        Boolean(
          guest.check_in &&
            guest.check_out &&
            guest.check_in <= today &&
            guest.check_out >= today,
        )

      const activeReservation = resList.find((r) => r.status === 'checked_in') ?? null

      const latestRes = resList
        .slice()
        .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
        .at(-1)

      return {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        roomNumber: guest.rooms?.number ?? null,
        roomId: guest.room_id,
        checkIn: guest.check_in,
        checkOut: guest.check_out,
        totalStays: stays,
        totalSpent,
        lastStay,
        status: deriveStatus(stays, totalSpent, isCurrentlyStaying),
        source: activeReservation?.channel ?? latestRes?.channel ?? null,
        token: guest.token,
        tokenExpiresAt: guest.token_expires_at,
        portalPin: await revealStoredPortalPin(guest.portal_pin),
        reservationId: activeReservation?.id ?? null,
        isInHouse: isCurrentlyStaying,
        doNotDisturb: Boolean(guest.do_not_disturb),
      }
    }),
  )

  return sortGuestDirectory(rows)
}

async function loadReservationsForGuests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hotelId: string,
  guestIds: string[],
): Promise<DbReservation[]> {
  if (!guestIds.length) return []

  const { data } = await supabase
    .from('reservations')
    .select('*')
    .eq('hotel_id', hotelId)
    .in('guest_id', guestIds)
    .order('created_at', { ascending: false })

  return (data ?? []) as DbReservation[]
}

export async function getGuestsPage(options?: {
  page?: number
  pageSize?: number
  search?: string
  status?: GuestStatus | null
}): Promise<GuestsPageResult> {
  const pageSize = Math.min(options?.pageSize ?? 10, DEFAULT_LIST_LIMIT)
  const page = options?.page ?? 1
  const search = options?.search?.trim() ?? ''
  const status = options?.status ?? null

  const empty: GuestsPageResult = {
    guests: [],
    totalCount: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  }

  const profile = await getProfile()
  if (!profile?.hotel_id) return empty

  const supabase = await createClient()
  const hotelId = profile.hotel_id

  if (status) {
    const { data: allGuests } = await supabase
      .from('guests')
      .select(
        'id, name, email, phone, room_id, check_in, check_out, created_at, token, token_expires_at, portal_pin, do_not_disturb, rooms(number)',
      )
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_LIMIT)

    const guestRows = (allGuests ?? []) as unknown as GuestQueryRow[]
    const guestIds = guestRows.map((g) => g.id)
    const reservations = await loadReservationsForGuests(supabase, hotelId, guestIds)
    let rows = await mapGuestRows(guestRows, reservations)

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (guest) =>
          guest.name.toLowerCase().includes(q) ||
          (guest.email ?? '').toLowerCase().includes(q) ||
          (guest.phone ?? '').includes(search),
      )
    }

    rows = rows.filter((guest) => guest.status === status)
    const totalCount = rows.length
    const offset = pageToOffset(page, pageSize)
    const guests = rows.slice(offset, offset + pageSize)

    return {
      guests,
      totalCount,
      page,
      pageSize,
      totalPages: totalPagesForCount(totalCount, pageSize),
    }
  }

  let guestQuery = supabase
    .from('guests')
    .select(
      'id, name, email, phone, room_id, check_in, check_out, created_at, token, token_expires_at, portal_pin, do_not_disturb, rooms(number)',
      { count: 'exact' },
    )
    .eq('hotel_id', hotelId)

  if (search) {
    const pattern = `%${search.replace(/[%_,]/g, '')}%`
    guestQuery = guestQuery.or(
      `name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
    )
  }

  const offset = pageToOffset(page, pageSize)
  const { data: guestData, count } = await guestQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  const guestRows = (guestData ?? []) as unknown as GuestQueryRow[]
  const guestIds = guestRows.map((g) => g.id)
  const reservations = await loadReservationsForGuests(supabase, hotelId, guestIds)
  const totalCount = count ?? guestRows.length

  return {
    guests: await mapGuestRows(guestRows, reservations),
    totalCount,
    page,
    pageSize,
    totalPages: totalPagesForCount(totalCount, pageSize),
  }
}

/** @deprecated Prefer getGuestsPage for list views. */
export async function getGuestsData(limit?: number): Promise<GuestRow[]> {
  const result = await getGuestsPage({ page: 1, pageSize: clampLimit(limit) })
  return result.guests
}
