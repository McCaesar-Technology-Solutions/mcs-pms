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
import { normalizeDiscountType } from '@/lib/billing/discount'
import {
  bookingRefSearchPrefix,
  isSecuredPaymentStatus,
  type ReservationListFilters,
} from '@/lib/reservations/search-params'
import {
  compareDeskReservationList,
  occupyingStatusesInFilter,
  reservationStatusFilterValues,
  shouldPinOccupyingStays,
} from '@/lib/reservations/list-query'
import { isOccupyingReservationStatus, OCCUPYING_STATUSES } from '@/lib/reservations/lifecycle'
import type {
  DbReservation,
  DbRoom,
  Reservation,
  ReservationPaymentStatus,
} from '@/types'
import { guestIdDocumentFromRow } from '@/lib/guests/id-document'

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
  guests?: {
    email: string | null
    phone: string | null
    do_not_disturb?: boolean | null
    ghana_card_number?: string | null
    id_document_type?: string | null
    id_document_number?: string | null
    id_document_country?: string | null
  } | null
}

const CHANNEL_SOURCE_MAP: Record<string, Reservation['source']> = {
  airbnb: 'airbnb',
  booking_com: 'booking',
  direct: 'website',
  walk_in: 'walk_in',
  other: 'other',
}

const RESERVATION_SELECT =
  '*, rooms(number), guests(email, phone, do_not_disturb, ghana_card_number, id_document_type, id_document_number, id_document_country)' as const

/** Max rows scanned when filters need in-memory matching (search / secured). */
const COMPOUND_SCAN_LIMIT = 500

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(1, diff)
}

function mapReservation(
  row: ReservationRow,
  folioMap: Map<string, number>,
  invoiceSnapshot: {
    id: string
    billToName: string | null
    totalAmount: number
    amountPaid: number
  } | null = null,
): Reservation {
  const nights = nightsBetween(row.check_in, row.check_out)
  const rateType = (row.rate_type ?? 'nightly') as Reservation['rateType']
  const nightlyRate = Number(row.nightly_rate ?? 0)
  const weeklyRate = Number(row.weekly_rate ?? 0)
  const monthlyRate = Number(row.monthly_rate ?? 0)
  const total =
    row.total_amount ??
    calculateStayTotal(rateType, row.check_in, row.check_out, nightlyRate, monthlyRate, weeklyRate)
  const status = (row.status ?? 'confirmed') as Reservation['status']
  const depositAmount = Number(row.deposit_amount ?? 0)
  const discountType = normalizeDiscountType(row.discount_type)
  const discountValue = Number(row.discount_value ?? 0)
  const discountAmount = Number(row.discount_amount ?? 0)
  const folioSubtotal = isOccupyingReservationStatus(status)
    ? folioSubtotalForStay(folioMap, row.guest_id, row.id)
    : 0

  let paidAmount: number
  let estimatedTotal: number
  let balanceDue: number

  if (invoiceSnapshot) {
    estimatedTotal = Number(invoiceSnapshot.totalAmount)
    paidAmount = Number(invoiceSnapshot.amountPaid)
    balanceDue = reservationBalanceDue(estimatedTotal, paidAmount)
  } else {
    paidAmount = Number(row.amount_paid ?? 0)
    estimatedTotal = Math.max(0, total - discountAmount) + folioSubtotal
    balanceDue = reservationBalanceDue(estimatedTotal, paidAmount)
  }

  const paymentStatus = (row.payment_status ?? 'unpaid') as ReservationPaymentStatus
  const channel = (row.channel ?? 'direct') as Reservation['channel']
  const idDocument = guestIdDocumentFromRow(row.guests ?? {})

  return {
    id: row.id,
    bookingRef: `MOJO-${row.id.slice(0, 8).toUpperCase()}`,
    guestId: row.guest_id ?? '',
    guestName: row.guest_name,
    guestEmail: row.guests?.email ?? '',
    guestPhone: row.guests?.phone ?? '',
    guestIdDocumentType: idDocument.type,
    guestIdDocumentNumber: idDocument.number,
    guestIdDocumentCountry: idDocument.country,
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
    invoiceId: invoiceSnapshot?.id ?? null,
    invoiceBillToName: invoiceSnapshot?.billToName ?? null,
    discountType,
    discountValue,
    discountAmount,
    discountReason: row.discount_reason ?? null,
    paymentMethod: row.payment_method ?? null,
    currency: 'GHS',
    source: CHANNEL_SOURCE_MAP[channel] ?? 'other',
    channel,
    rateType,
    nightlyRate,
    weeklyRate,
    monthlyRate,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.created_at ?? new Date().toISOString(),
    guestDoNotDisturb: Boolean(row.guests?.do_not_disturb),
    roomHeldUntil: row.room_held_until ?? null,
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
  if ((row.guests?.id_document_number ?? '').toLowerCase().includes(q)) return true
  if ((row.guests?.ghana_card_number ?? '').toLowerCase().includes(q)) return true
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
        .select(
          '*, room_categories(name, default_nightly_rate, default_weekly_rate, default_monthly_rate)',
        )
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
        weeklyRate:
          r.weekly_rate != null
            ? Number(r.weekly_rate)
            : Number(r.room_categories?.default_weekly_rate ?? 0),
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

type StatusQueryMode = 'filter' | 'occupying' | 'others'

function applyColumnFilters<T>(
  query: T,
  filters: ReservationListFilters,
  hotelId: string,
  statusMode: StatusQueryMode = 'filter',
): T {
  const q = query as unknown as {
    eq: (column: string, value: unknown) => typeof q
    in: (column: string, values: readonly string[]) => typeof q
    not: (column: string, operator: string, value: string) => typeof q
  }
  let next = q.eq('hotel_id', hotelId)
  if (statusMode === 'occupying') {
    next = next.in('status', [...OCCUPYING_STATUSES])
  } else if (statusMode === 'others') {
    next = next.not('status', 'in', occupyingStatusesInFilter())
  } else {
    const statuses = reservationStatusFilterValues(filters.status)
    if (statuses?.length === 1) next = next.eq('status', statuses[0])
    else if (statuses && statuses.length > 1) next = next.in('status', statuses)
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    next = next.eq('payment_status', filters.paymentStatus)
  }
  if (filters.checkInDate) next = next.eq('check_in', filters.checkInDate)
  if (filters.checkOutDate) next = next.eq('check_out', filters.checkOutDate)
  return next as T
}

function orderForStatusFilter(filters: ReservationListFilters) {
  const statuses = reservationStatusFilterValues(filters.status)
  const occupyingOnly =
    statuses != null &&
    statuses.every((status) =>
      (OCCUPYING_STATUSES as readonly string[]).includes(status),
    )
  return occupyingOnly
    ? { column: 'check_out' as const, ascending: true }
    : { column: 'check_in' as const, ascending: false }
}

async function fetchOccupyingPinnedPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: ReservationListFilters,
  hotelId: string,
): Promise<{ pageRows: ReservationRow[]; totalCount: number; error?: string }> {
  const pageSize = filters.pageSize
  const page = filters.page
  const offset = pageToOffset(page, pageSize)

  const occupyingCountQuery = applyColumnFilters(
    supabase.from('reservations').select('id', { count: 'exact', head: true }),
    filters,
    hotelId,
    'occupying',
  )
  const othersCountQuery = applyColumnFilters(
    supabase.from('reservations').select('id', { count: 'exact', head: true }),
    filters,
    hotelId,
    'others',
  )
  const [
    { count: occupyingCount, error: occCountError },
    { count: othersCount, error: othersCountError },
  ] = await Promise.all([occupyingCountQuery, othersCountQuery])
  if (occCountError || othersCountError) {
    return {
      pageRows: [],
      totalCount: 0,
      error: occCountError?.message ?? othersCountError?.message,
    }
  }

  const occupyingTotal = occupyingCount ?? 0
  const totalCount = occupyingTotal + (othersCount ?? 0)
  let pageRows: ReservationRow[] = []

  if (occupyingTotal > 0 && offset < occupyingTotal) {
    let occQuery = applyColumnFilters(
      supabase.from('reservations').select(RESERVATION_SELECT),
      filters,
      hotelId,
      'occupying',
    )
    occQuery = occQuery.order('check_out', { ascending: true }).range(offset, offset + pageSize - 1)
    const { data, error } = await occQuery
    if (error) return { pageRows: [], totalCount: 0, error: error.message }
    pageRows = (data ?? []) as unknown as ReservationRow[]
    const remaining = pageSize - pageRows.length
    if (remaining > 0) {
      let othersQuery = applyColumnFilters(
        supabase.from('reservations').select(RESERVATION_SELECT),
        filters,
        hotelId,
        'others',
      )
      othersQuery = othersQuery.order('check_in', { ascending: false }).range(0, remaining - 1)
      const { data: others, error: othersError } = await othersQuery
      if (othersError) return { pageRows: [], totalCount: 0, error: othersError.message }
      pageRows = [...pageRows, ...((others ?? []) as unknown as ReservationRow[])]
    }
  } else {
    const othersOffset = Math.max(0, offset - occupyingTotal)
    let othersQuery = applyColumnFilters(
      supabase.from('reservations').select(RESERVATION_SELECT),
      filters,
      hotelId,
      'others',
    )
    othersQuery = othersQuery
      .order('check_in', { ascending: false })
      .range(othersOffset, othersOffset + pageSize - 1)
    const { data, error } = await othersQuery
    if (error) return { pageRows: [], totalCount: 0, error: error.message }
    pageRows = (data ?? []) as unknown as ReservationRow[]
  }

  return { pageRows, totalCount }
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
      let query = applyColumnFilters(
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
          isSecuredPaymentStatus(row.payment_status, Number(row.amount_paid ?? 0)),
        )
      }
      if (shouldPinOccupyingStays(filters)) {
        rows = [...rows].sort((a, b) =>
          compareDeskReservationList(
            { status: a.status ?? '', checkIn: a.check_in, checkOut: a.check_out },
            { status: b.status ?? '', checkIn: b.check_in, checkOut: b.check_out },
          ),
        )
      }

      const totalCount = rows.length
      const offset = pageToOffset(page, pageSize)
      const pageRows = rows.slice(offset, offset + pageSize)
      return finalizePage(pageRows, totalCount, page, pageSize, hotelId, admin, options)
    }

    if (shouldPinOccupyingStays(filters)) {
      const pinned = await fetchOccupyingPinnedPage(supabase, filters, hotelId)
      if (pinned.error) {
        console.error('[reservations-page] occupying pin failed:', pinned.error)
        return empty
      }
      return finalizePage(
        pinned.pageRows,
        pinned.totalCount,
        page,
        pageSize,
        hotelId,
        admin,
        options,
      )
    }

    const countQuery = applyColumnFilters(
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
    const order = orderForStatusFilter(filters)
    let pageQuery = applyColumnFilters(
      supabase.from('reservations').select(RESERVATION_SELECT),
      filters,
      hotelId,
    )
    pageQuery = pageQuery
      .order(order.column, { ascending: order.ascending })
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
    .filter((r) => isOccupyingReservationStatus(r.status) && r.guest_id)
    .map((r) => r.guest_id as string)
  const folioMap = admin
    ? await loadFolioSubtotalMap(admin, hotelId, inHouseGuestIds)
    : new Map<string, number>()

  const invoiceByReservation = new Map<
    string,
    { id: string; billToName: string | null; totalAmount: number; amountPaid: number }
  >()
  if (admin && pageRows.length > 0) {
    const { data: invoiceRows } = await admin
      .from('invoices')
      .select('id, reservation_id, bill_to_name, total_amount, amount_paid')
      .eq('hotel_id', hotelId)
      .in(
        'reservation_id',
        pageRows.map((r) => r.id),
      )
    const invoicesByReservation = new Map<
      string,
      Array<{
        id: string
        bill_to_name: string | null
        total_amount: number
        amount_paid: number
      }>
    >()
    for (const inv of invoiceRows ?? []) {
      if (!inv.reservation_id) continue
      const list = invoicesByReservation.get(inv.reservation_id) ?? []
      list.push({
        id: inv.id,
        bill_to_name: inv.bill_to_name,
        total_amount: Number(inv.total_amount ?? 0),
        amount_paid: Number(inv.amount_paid ?? 0),
      })
      invoicesByReservation.set(inv.reservation_id, list)
    }
    for (const [reservationId, rows] of invoicesByReservation) {
      const open =
        rows.find((row) => row.total_amount - row.amount_paid > 0.009) ?? rows[rows.length - 1]!
      invoiceByReservation.set(reservationId, {
        id: open.id,
        billToName: open.bill_to_name?.trim() || null,
        totalAmount: rows.reduce((sum, row) => sum + row.total_amount, 0),
        amountPaid: rows.reduce((sum, row) => sum + row.amount_paid, 0),
      })
    }
  }

  return {
    reservations: pageRows.map((row) => {
      const inv = invoiceByReservation.get(row.id)
      return mapReservation(row, folioMap, inv ?? null)
    }),
    totalCount,
    page,
    pageSize,
    totalPages: totalPagesForCount(totalCount, pageSize),
  }
}
