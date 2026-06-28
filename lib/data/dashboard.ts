import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/get-profile'
import { getOccupancySpans, type OccupancySpan } from '@/lib/data/occupancy'
import {
  getOccupancyTimelineBars,
  type OccupancyTimelineBar,
} from '@/lib/data/occupancy-timeline'
import { calculateStayTotal } from '@/lib/pricing/stay-totals'
import { reconcileHotelBillingState } from '@/lib/billing/reconcile-hotel-billing'
import { computeHotelOutstandingBalance } from '@/lib/billing/outstanding-balance'
import { reservationBalanceDue } from '@/lib/billing/reservation-payment'
import { folioSubtotalForStay, loadFolioSubtotalMap } from '@/lib/folio/batch-totals'
import type {
  Availability,
  DbInvoice,
  DbReservation,
  DbRoom,
  DbRoomStatus,
  KPIMetrics,
  Reservation,
  ReservationPaymentStatus,
  Room,
  RoomStatus,
} from '@/types'
import {
  filterMetricsEligible,
  filterOpenBookings,
  isOccupancyBlockingStatus,
} from '@/lib/reservations/lifecycle'

export interface RoomOption {
  id: string
  number: string
  nightlyRate: number
  monthlyRate: number
}

export interface DashboardData {
  hotelId: string | null
  rooms: Room[]
  dbRooms: DbRoom[]
  reservations: Reservation[]
  invoices: DbInvoice[]
  metrics: KPIMetrics
  availability: Availability[]
  roomOptions: RoomOption[]
  occupancySpans: OccupancySpan[]
  timelineRooms: { id: string; number: string }[]
  timelineBars: OccupancyTimelineBar[]
}

const ROOM_STATUS_MAP: Record<DbRoomStatus, RoomStatus> = {
  available: 'vacant',
  occupied: 'occupied',
  maintenance: 'maintenance',
  needs_inspection: 'dirty',
  cleaning: 'dirty',
}

function categoryToRoomType(name: string | undefined): Room['type'] {
  const normalized = (name ?? '').toLowerCase()
  if (normalized.includes('suite')) return 'suite'
  if (normalized.includes('deluxe') || normalized.includes('double')) return 'double'
  return 'single'
}

const CHANNEL_SOURCE_MAP: Record<string, Reservation['source']> = {
  airbnb: 'airbnb',
  booking_com: 'booking',
  direct: 'website',
  walk_in: 'walk_in',
  other: 'other',
}

function mapRoom(room: DbRoom): Room {
  const categoryName = room.room_categories?.name
  const price =
    room.nightly_rate != null
      ? Number(room.nightly_rate)
      : Number(room.room_categories?.default_nightly_rate ?? 0)

  return {
    id: room.id,
    number: room.number,
    type: categoryToRoomType(categoryName),
    status: ROOM_STATUS_MAP[(room.status ?? 'available') as DbRoomStatus] ?? 'vacant',
    propertyId: room.hotel_id,
    floor: room.floor ?? 1,
    price,
  }
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(1, diff)
}

interface ReservationRow extends DbReservation {
  rooms?: { number: string } | null
  guests?: { email: string | null; phone: string | null; do_not_disturb?: boolean | null } | null
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
    status === 'checked_in'
      ? folioSubtotalForStay(folioMap, row.guest_id, row.id)
      : 0
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

function computeMetrics(
  dbRooms: DbRoom[],
  reservations: Reservation[],
  invoices: DbInvoice[],
  occupancySpans: OccupancySpan[] = [],
): KPIMetrics {
  const totalRooms = dbRooms.length
  const today = new Date().toISOString().split('T')[0]
  const occupiedRoomIds = new Set<string>()
  for (const span of occupancySpans) {
    if (span.checkIn <= today && span.checkOut > today) occupiedRoomIds.add(span.roomId)
  }
  const occupied =
    occupancySpans.length > 0
      ? Math.min(occupiedRoomIds.size, totalRooms)
      : dbRooms.filter((r) => r.status === 'occupied').length
  const occupancyRate = totalRooms > 0 ? occupied / totalRooms : 0

  const activeReservations = filterOpenBookings(reservations)
  const revenueEligible = filterMetricsEligible(reservations)
  const nightlyRates = revenueEligible
    .map((r) => (r.numberOfNights > 0 ? r.totalPrice / r.numberOfNights : 0))
    .filter((n) => n > 0)
  const averageNightlyRate =
    nightlyRates.length > 0
      ? Math.round(nightlyRates.reduce((sum, n) => sum + n, 0) / nightlyRates.length)
      : 0

  const invoiceRevenue = invoices
    .filter((inv) => inv.payment_status === 'paid')
    .reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0)
  const reservationRevenue = revenueEligible.reduce((sum, r) => sum + r.totalPrice, 0)
  const totalRevenue = invoiceRevenue > 0 ? invoiceRevenue : reservationRevenue

  const totalBookings = activeReservations.length
  const totalGuests = new Set(activeReservations.map((r) => r.guestId).filter(Boolean)).size

  const outstanding = computeHotelOutstandingBalance(reservations, invoices)

  return {
    totalRevenue,
    occupancyRate,
    averageNightlyRate,
    totalBookings,
    totalGuests,
    reviParMetric: totalRooms > 0 ? Math.round(totalRevenue / totalRooms) : 0,
    outstandingBalance: outstanding.total,
    outstandingCount: outstanding.reservationCount + outstanding.invoiceOnlyCount,
  }
}

function computeAvailability(dbRooms: DbRoom[], reservations: Reservation[]): Availability[] {
  const totalRooms = dbRooms.length
  const maintenance = dbRooms.filter(
    (r) => r.status === 'maintenance' || r.status === 'cleaning' || r.status === 'needs_inspection',
  ).length

  const out: Availability[] = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  for (let i = 0; i < 14; i++) {
    const day = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
    const dayStr = day.toISOString().split('T')[0]

    const spanning = reservations.filter(
      (r) =>
        isOccupancyBlockingStatus(r.status) &&
        r.checkInDate <= dayStr &&
        r.checkOutDate > dayStr,
    )
    const occupied = Math.min(
      totalRooms - maintenance,
      spanning.filter((r) => r.status === 'checked_in').length,
    )
    const reserved = Math.min(
      Math.max(0, totalRooms - maintenance - occupied),
      spanning.filter((r) => r.status === 'confirmed').length,
    )
    const available = Math.max(0, totalRooms - occupied - reserved - maintenance)

    out.push({ date: dayStr, available, occupied, reserved, maintenance })
  }

  return out
}

const EMPTY_METRICS: KPIMetrics = {
  totalRevenue: 0,
  occupancyRate: 0,
  averageNightlyRate: 0,
  totalBookings: 0,
  totalGuests: 0,
  reviParMetric: 0,
  outstandingBalance: 0,
  outstandingCount: 0,
}

export async function getDashboardData(): Promise<DashboardData> {
  const empty: DashboardData = {
    hotelId: null,
    rooms: [],
    dbRooms: [],
    reservations: [],
    invoices: [],
    metrics: EMPTY_METRICS,
    availability: [],
    roomOptions: [],
    occupancySpans: [],
    timelineRooms: [],
    timelineBars: [],
  }

  const profile = await getProfile()
  if (!profile?.hotel_id) return empty

  const supabase = await createClient()
  const admin = createAdminClient()
  const hotelId = profile.hotel_id

  await reconcileHotelBillingState(admin, hotelId)

  const [roomsRes, reservationsRes, invoicesRes, occupancySpans, timeline] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, room_categories(name, default_nightly_rate, default_monthly_rate)')
      .eq('hotel_id', hotelId)
      .order('number'),
    supabase
      .from('reservations')
      .select('*, rooms(number), guests(email, phone, do_not_disturb)')
      .eq('hotel_id', hotelId)
      .order('check_in', { ascending: false }),
    supabase.from('invoices').select('*').eq('hotel_id', hotelId),
    getOccupancySpans(supabase, hotelId),
    getOccupancyTimelineBars(supabase, hotelId),
  ])

  const dbRooms = (roomsRes.data ?? []) as DbRoom[]
  const reservationRows = (reservationsRes.data ?? []) as unknown as ReservationRow[]
  const inHouseGuestIds = reservationRows
    .filter((r) => r.status === 'checked_in' && r.guest_id)
    .map((r) => r.guest_id as string)
  const folioMap = await loadFolioSubtotalMap(admin, hotelId, inHouseGuestIds)
  const reservations = reservationRows.map((row) => mapReservation(row, folioMap))
  const invoices = (invoicesRes.data ?? []) as DbInvoice[]

  return {
    hotelId,
    rooms: dbRooms.map(mapRoom),
    dbRooms,
    reservations,
    invoices,
    metrics: computeMetrics(dbRooms, reservations, invoices, occupancySpans),
    availability: computeAvailability(dbRooms, reservations),
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
}
