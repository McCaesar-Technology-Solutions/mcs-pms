import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import { revealStoredPortalPin } from '@/lib/guest/portal-pin-crypto'
import { OCCUPYING_STATUSES } from '@/lib/reservations/lifecycle'
import {
  buildGuestDirectoryFields,
  guestMatchesDirectoryFilter,
  sortGuestDirectory,
  type GuestDirectoryFilter,
  type GuestRow,
} from '@/lib/guests/guest-directory'
import {
  clampLimit,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  pageToOffset,
  totalPagesForCount,
} from '@/lib/data/pagination'
import type { DbReservation } from '@/types'

export type { GuestRow, GuestDirectoryFilter, GuestLoyalty, GuestOccupancy } from '@/lib/guests/guest-directory'
export { sortGuestDirectory, parseGuestDirectoryFilter } from '@/lib/guests/guest-directory'
/** @deprecated Use GuestDirectoryFilter */
export type { GuestDirectoryFilter as GuestStatus } from '@/lib/guests/guest-directory'

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
  ghana_card_number?: string | null
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

const GUEST_LIST_COLUMNS =
  'id, name, email, phone, ghana_card_number, room_id, check_in, check_out, created_at, token, token_expires_at, portal_pin, do_not_disturb, rooms(number)'

async function mapGuestRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hotelId: string,
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

  const rows = await Promise.all(
    guests.map(async (guest) => {
      const derived = buildGuestDirectoryFields({
        reservations: byGuest.get(guest.id) ?? [],
        guestRoomId: guest.room_id,
        guestCheckIn: guest.check_in,
        guestCheckOut: guest.check_out,
      })

      return {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        ghanaCardNumber: guest.ghana_card_number ?? null,
        roomNumber: guest.rooms?.number ?? null,
        roomId: guest.room_id,
        checkIn: derived.checkIn,
        checkOut: derived.checkOut,
        totalStays: derived.totalStays,
        totalSpent: derived.totalSpent,
        lastStay: derived.lastStay,
        occupancy: derived.occupancy,
        loyalty: derived.loyalty,
        source: derived.source,
        token: guest.token,
        tokenExpiresAt: guest.token_expires_at,
        portalPin: await revealStoredPortalPin(guest.portal_pin),
    reservationId: derived.reservationId,
    invoiceBillToName: null as string | null,
    isInHouse: derived.isInHouse,
        canCheckOut: derived.canCheckOut,
        doNotDisturb: Boolean(guest.do_not_disturb),
      }
    }),
  )

  return attachInvoiceBillTo(supabase, hotelId, sortGuestDirectory(rows))
}

async function attachInvoiceBillTo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hotelId: string,
  rows: GuestRow[],
): Promise<GuestRow[]> {
  const reservationIds = [
    ...new Set(rows.map((r) => r.reservationId).filter((id): id is string => Boolean(id))),
  ]
  if (!reservationIds.length) return rows

  const { data } = await supabase
    .from('invoices')
    .select('reservation_id, bill_to_name')
    .eq('hotel_id', hotelId)
    .in('reservation_id', reservationIds)

  const byReservation = new Map<string, string | null>()
  for (const inv of data ?? []) {
    if (inv.reservation_id) {
      byReservation.set(inv.reservation_id, inv.bill_to_name?.trim() || null)
    }
  }

  return rows.map((row) => ({
    ...row,
    invoiceBillToName: row.reservationId
      ? (byReservation.get(row.reservationId) ?? null)
      : null,
  }))
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

async function loadOccupyingGuestIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hotelId: string,
): Promise<string[]> {
  const [{ data: stays }, { data: occupying }] = await Promise.all([
    supabase
      .from('reservations')
      .select('guest_id')
      .eq('hotel_id', hotelId)
      .in('status', [...OCCUPYING_STATUSES])
      .not('guest_id', 'is', null),
    supabase.from('guests').select('id').eq('hotel_id', hotelId).not('room_id', 'is', null),
  ])

  const ids = new Set<string>()
  for (const row of stays ?? []) {
    if (row.guest_id) ids.add(row.guest_id)
  }
  for (const row of occupying ?? []) ids.add(row.id)
  return [...ids]
}

function excludeGuestIdsFilter(ids: string[]): string | null {
  if (!ids.length) return null
  return `(${ids.join(',')})`
}

async function paginateMappedGuests(
  rows: GuestRow[],
  page: number,
  pageSize: number,
  filter: GuestDirectoryFilter | null,
): Promise<GuestsPageResult> {
  const filtered = filter
    ? rows.filter((guest) => guestMatchesDirectoryFilter(guest, filter))
    : rows
  const sorted = sortGuestDirectory(filtered)
  const totalCount = sorted.length
  const offset = pageToOffset(page, pageSize)
  return {
    guests: sorted.slice(offset, offset + pageSize),
    totalCount,
    page,
    pageSize,
    totalPages: totalPagesForCount(totalCount, pageSize),
  }
}

export async function getGuestsPage(options?: {
  page?: number
  pageSize?: number
  search?: string
  status?: GuestDirectoryFilter | null
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

  if (status || search) {
    let guestQuery = supabase
      .from('guests')
      .select(GUEST_LIST_COLUMNS)
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_LIMIT)

    if (search) {
      const pattern = `%${search.replace(/[%_,]/g, '')}%`
      guestQuery = guestQuery.or(
        `name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
      )
    }

    const { data: allGuests } = await guestQuery
    const guestRows = (allGuests ?? []) as unknown as GuestQueryRow[]
    const reservations = await loadReservationsForGuests(
      supabase,
      hotelId,
      guestRows.map((g) => g.id),
    )
    const rows = await mapGuestRows(supabase, hotelId, guestRows, reservations)
    return paginateMappedGuests(rows, page, pageSize, status)
  }

  const occupyingIds = await loadOccupyingGuestIds(supabase, hotelId)
  const occupyingFilter = excludeGuestIdsFilter(occupyingIds)

  let otherCountQuery = supabase
    .from('guests')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
  if (occupyingFilter) {
    otherCountQuery = otherCountQuery.not('id', 'in', occupyingFilter)
  }
  const { count: otherCount } = await otherCountQuery

  const occupyingCount = occupyingIds.length
  const totalCount = occupyingCount + (otherCount ?? 0)
  const offset = pageToOffset(page, pageSize)

  let pageGuests: GuestQueryRow[] = []

  if (occupyingCount > 0 && offset < occupyingCount) {
    const { data: occupyingGuests } = await supabase
      .from('guests')
      .select(GUEST_LIST_COLUMNS)
      .eq('hotel_id', hotelId)
      .in('id', occupyingIds)

    const occupyingMapped = await mapGuestRows(
      supabase,
      hotelId,
      (occupyingGuests ?? []) as unknown as GuestQueryRow[],
      await loadReservationsForGuests(supabase, hotelId, occupyingIds),
    )
    const occupyingSlice = occupyingMapped.slice(offset, offset + pageSize)
    const remaining = pageSize - occupyingSlice.length

    if (remaining > 0) {
      let othersQuery = supabase
        .from('guests')
        .select(GUEST_LIST_COLUMNS)
        .eq('hotel_id', hotelId)
        .order('check_out', { ascending: false, nullsFirst: false })
        .range(0, remaining - 1)
      if (occupyingFilter) {
        othersQuery = othersQuery.not('id', 'in', occupyingFilter)
      }
      const { data: others } = await othersQuery
      const otherRows = (others ?? []) as unknown as GuestQueryRow[]
      const otherMapped = await mapGuestRows(
        supabase,
        hotelId,
        otherRows,
        await loadReservationsForGuests(
          supabase,
          hotelId,
          otherRows.map((g) => g.id),
        ),
      )
      return {
        guests: [...occupyingSlice, ...otherMapped],
        totalCount,
        page,
        pageSize,
        totalPages: totalPagesForCount(totalCount, pageSize),
      }
    }

    return {
      guests: occupyingSlice,
      totalCount,
      page,
      pageSize,
      totalPages: totalPagesForCount(totalCount, pageSize),
    }
  }

  const otherOffset = Math.max(0, offset - occupyingCount)
  let othersQuery = supabase
    .from('guests')
    .select(GUEST_LIST_COLUMNS)
    .eq('hotel_id', hotelId)
    .order('check_out', { ascending: false, nullsFirst: false })
    .range(otherOffset, otherOffset + pageSize - 1)
  if (occupyingFilter) {
    othersQuery = othersQuery.not('id', 'in', occupyingFilter)
  }
  const { data: guestData } = await othersQuery
  pageGuests = (guestData ?? []) as unknown as GuestQueryRow[]

  return {
    guests: await mapGuestRows(
      supabase,
      hotelId,
      pageGuests,
      await loadReservationsForGuests(
        supabase,
        hotelId,
        pageGuests.map((g) => g.id),
      ),
    ),
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
