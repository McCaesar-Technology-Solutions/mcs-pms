import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/get-profile'
import { getOccupancySpans, type OccupancySpan } from '@/lib/data/occupancy'
import {
  getOccupancyTimelineBars,
  type OccupancyTimelineBar,
} from '@/lib/data/occupancy-timeline'
import type { RoomOption } from '@/lib/data/dashboard'
import { pageToOffset, totalPagesForCount } from '@/lib/data/pagination'
import { calculateStayTotal } from '@/lib/pricing/stay-totals'
import { folioSubtotalForStay, loadFolioSubtotalMap } from '@/lib/folio/batch-totals'
import { reservationBalanceDue } from '@/lib/billing/reservation-payment'
import {
  bookingRefSearchPrefix,
  isSecuredPaymentStatus,
  type ReservationListFilters,
} from '@/lib/reservations/search-params'
import type {
  DbReservation,
  DbRoom,
  Reservation,
  ReservationPaymentStatus,
} from '@/types'

export interface ReservationsPageResult {
  reservations: Reservation[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ReservationWorkspaceData {
  roomOptions: RoomOption[]
  occupancySpans: OccupancySpan[]
  timelineRooms: { id: string; number: string; floor?: number | null }[]
  timelineBars: OccupancyTimelineBar[]
}

interface ReservationRow extends DbReservation {
  rooms?: { number: string } | null
  guests?: { email: string | null; phone: string | null; do_not_disturb?: boolean | null } | null
}

const CHANNEL_SOURCE_MAP: Record<string, Reservation['source']> = {
  airbnb: 'airbnb',
  booking_com: 'booking',
  direct: 'website',
  walk_in: 'walk_in',
  other: 'other',
}

const RESERVATION_SELECT =
  '*, rooms(number), guests(email, phone, do_not_disturb)' as const

/** Max rows scanned when filters need in-memory matching (search / secured). */
const COMPOUND_SCAN_LIMIT = 500

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(1, diff)
}

function mapReservation(row: ReservationRow, folioMap: Map<string, number>): Reservation {
  const nights = nightsBetween(row.check_in, row.check_out)
  const rateType = (row.rate_type ?? 'nightly') as Reservation['rateType']
  const nightlyRate = Number(row.nightly_rate ?? 0)
  const monthlyRate = Number(row.monthly_rate ?? 0)
  const total =
    row.total_amount ??
    calculateStayTotal(rateType, row.check_in, row.check_out, nightlyRate, monthlyRate)
  const status = (row.status ?? 'confirmed') as Reservation['status']
  const paidAmount = Number(row.amount_paid ?? 0)
  const paymentStatus = (row.payment_status ?? 'unpaid') as ReservationPaymentStatus
  const depositAmount = Number(row.deposit_amount ?? 0)
  const folioSubtotal =
    status === 'checked_in' ? folioSubtotalForStay(folioMap, row.guest_id, row.id) : 0
  const estimatedTotal = total + folioSubtotal
  const balanceDue = reservationBalanceDue(estimatedTotal, paidAmount)
  const channel = (row.channel ?? 'direct') as Reservation['channel']

  return {
    id: row.id,
    bookingRef: `MOJO-${row.id.slice(0, 8).toUpperCase()}`,
    guestId: row.guest_id ?? '',
    guestName: row.guest_name,
    guestEmail: row.guests?.email ?? '',
    guestPhone: row.guests?.phone ?? '',
    roomId: row.room_id ?? '',
    roomNumber: row.rooms?.number ?? '—',
    propertyId: row.hotel_id,
    checkInDate: row.check_in,
    checkOutDate: row.check_out,
    status,
    numberOfNights: nights,
    totalPrice: total,
    paidAmount,
    folioSubtotal,
    estimatedTotal,
    balanceDue,
    paymentStatus,
    depositAmount,
    paymentMethod: row.payment_method ?? null,
    currency: 'GHS',
    source: CHANNEL_SOURCE_MAP[channel] ?? 'other',
    channel,
    rateType,
    nightlyRate,
    monthlyRate,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.created_at ?? new Date().toISOString(),
    guestDoNotDisturb: Boolean(row.guests?.do_not_disturb),
  }
}

function matchesSearch(row: ReservationRow, search: string): boolean {
  const q = search.toLowerCase()
  const refPrefix = bookingRefSearchPrefix(search)
  if (refPrefix && row.id.replace(/-/g, '').toLowerCase().startsWith(refPrefix.replace(/-/g, ''))) {
    return true
  }
  if (row.id.toLowerCase().startsWith(q) || row.id.toLowerCase().includes(q)) return true
  if (row.guest_name.toLowerCase().includes(q)) return true
  if ((row.rooms?.number ?? '').toLowerCase().includes(q)) return true
  const bookingRef = `mojo-${row.id.slice(0, 8)}`
  return bookingRef.includes(q.replace(/\s+/g, ''))
}

export async function getReservationWorkspaceData(): Promise<ReservationWorkspaceData> {
  const empty: ReservationWorkspaceData = {
    roomOptions: [],
    occupancySpans: [],
    timelineRooms: [],
    timelineBars: [],
  }

  const profile = await getProfile()
  if (!profile?.hotel_id) return empty

  try {
    const supabase = await createClient()
    const hotelId = profile.hotel_id

    const [roomsRes, occupancySpans, timeline] = await Promise.all([
      supabase
        .from('rooms')
        .select('*, room_categories(name, default_nightly_rate, default_monthly_rate)')
        .eq('hotel_id', hotelId)
        .order('number'),
      getOccupancySpans(supabase, hotelId),
      getOccupancyTimelineBars(supabase, hotelId),
    ])

    const dbRooms = (roomsRes.data ?? []) as DbRoom[]
    return {
      roomOptions: dbRooms.map((r) => ({
        id: r.id,
        number: r.number,
        nightlyRate:
          r.nightly_rate != null
            ? Number(r.nightly_rate)
            : Number(r.room_categories?.default_nightly_rate ?? 0),
        monthlyRate:
          r.monthly_rate != null
            ? Number(r.monthly_rate)
            : Number(r.room_categories?.default_monthly_rate ?? 0),
      })),
      occupancySpans,
      timelineRooms: timeline.rooms,
      timelineBars: timeline.bars,
    }
  } catch (err) {
    console.error('[reservations-page] getReservationWorkspaceData failed:', err)
    return empty
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyColumnFilters(query: any, filters: ReservationListFilters, hotelId: string) {
  let next = query.eq('hotel_id', hotelId)
  if (filters.status && filters.status !== 'all') {
    next = next.eq('status', filters.status)
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    next = next.eq('payment_status', filters.paymentStatus)
  }
  if (filters.checkInDate) next = next.eq('check_in', filters.checkInDate)
  if (filters.checkOutDate) next = next.eq('check_out', filters.checkOutDate)
  return next
}

export async function getReservationsPage(
  filters: ReservationListFilters,
  options?: { includeReservationId?: string | null },
): Promise<ReservationsPageResult> {
  const pageSize = filters.pageSize
  const page = filters.page
  const empty: ReservationsPageResult = {
    reservations: [],
    totalCount: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  }

  const profile = await getProfile()
  if (!profile?.hotel_id) return empty

  try {
    const supabase = await createClient()
    const admin = tryCreateAdminClient()
    const hotelId = profile.hotel_id
    const search = filters.q?.trim() ?? ''
    const needsCompoundScan = Boolean(search) || filters.paymentSecured

    if (needsCompoundScan) {
      let query = await applyColumnFilters(
        supabase.from('reservations').select(RESERVATION_SELECT),
        filters,
        hotelId,
      )
      query = query.order('check_in', { ascending: false }).limit(COMPOUND_SCAN_LIMIT)

      const { data, error } = await query
      if (error) {
        console.error('[reservations-page] compound scan failed:', error.message)
        return empty
      }

      let rows = (data ?? []) as unknown as ReservationRow[]
      if (search) rows = rows.filter((row) => matchesSearch(row, search))
      if (filters.paymentSecured) {
        rows = rows.filter((row) =>
          isSecuredPaymentStatus(row.payment_status, Number(row.deposit_amount ?? 0)),
        )
      }

      const totalCount = rows.length
      const offset = pageToOffset(page, pageSize)
      const pageRows = rows.slice(offset, offset + pageSize)
      return finalizePage(pageRows, totalCount, page, pageSize, hotelId, admin, options)
    }

    const countQuery = await applyColumnFilters(
      supabase.from('reservations').select('id', { count: 'exact', head: true }),
      filters,
      hotelId,
    )
    const { count, error: countError } = await countQuery
    if (countError) {
      console.error('[reservations-page] count failed:', countError.message)
      return empty
    }

    const offset = pageToOffset(page, pageSize)
    let pageQuery = await applyColumnFilters(
      supabase.from('reservations').select(RESERVATION_SELECT),
      filters,
      hotelId,
    )
    pageQuery = pageQuery
      .order('check_in', { ascending: false })
      .range(offset, offset + pageSize - 1)

    const { data, error } = await pageQuery
    if (error) {
      console.error('[reservations-page] page query failed:', error.message)
      return empty
    }

    const pageRows = (data ?? []) as unknown as ReservationRow[]
    return finalizePage(
      pageRows,
      count ?? pageRows.length,
      page,
      pageSize,
      hotelId,
      admin,
      options,
    )
  } catch (err) {
    console.error('[reservations-page] getReservationsPage failed:', err)
    return empty
  }
}

async function finalizePage(
  pageRows: ReservationRow[],
  totalCount: number,
  page: number,
  pageSize: number,
  hotelId: string,
  admin: ReturnType<typeof tryCreateAdminClient>,
  options?: { includeReservationId?: string | null },
): Promise<ReservationsPageResult> {
  const includeId = options?.includeReservationId
  if (includeId && !pageRows.some((r) => r.id === includeId)) {
    const supabase = await createClient()
    const { data: extra } = await supabase
      .from('reservations')
      .select(RESERVATION_SELECT)
      .eq('hotel_id', hotelId)
      .eq('id', includeId)
      .maybeSingle()
    if (extra) pageRows = [extra as unknown as ReservationRow, ...pageRows]
  }

  const inHouseGuestIds = pageRows
    .filter((r) => r.status === 'checked_in' && r.guest_id)
    .map((r) => r.guest_id as string)
  const folioMap = admin
    ? await loadFolioSubtotalMap(admin, hotelId, inHouseGuestIds)
    : new Map<string, number>()

  return {
    reservations: pageRows.map((row) => mapReservation(row, folioMap)),
    totalCount,
    page,
    pageSize,
    totalPages: totalPagesForCount(totalCount, pageSize),
  }
}
