import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/get-profile'
import { getOccupancySpans, type OccupancySpan } from '@/lib/data/occupancy'
import type {
  Availability,
  DbInvoice,
  DbReservation,
  DbRoom,
  DbRoomStatus,
  KPIMetrics,
  Reservation,
  Room,
  RoomStatus,
} from '@/types'

export interface RoomOption {
  id: string
  number: string
  nightlyRate: number
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
  guests?: { email: string | null; phone: string | null } | null
}

function mapReservation(row: ReservationRow): Reservation {
  const nights = nightsBetween(row.check_in, row.check_out)
  const total = row.total_amount ?? (row.nightly_rate ?? 0) * nights
  const status = (row.status ?? 'confirmed') as Reservation['status']
  const paidAmount = status === 'checked_in' || status === 'checked_out' ? total : 0

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
    currency: 'GHS',
    source: CHANNEL_SOURCE_MAP[row.channel ?? 'direct'] ?? 'other',
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.created_at ?? new Date().toISOString(),
  }
}

function computeMetrics(
  dbRooms: DbRoom[],
  reservations: Reservation[],
  invoices: DbInvoice[],
): KPIMetrics {
  const totalRooms = dbRooms.length
  const occupied = dbRooms.filter((r) => r.status === 'occupied').length
  const occupancyRate = totalRooms > 0 ? occupied / totalRooms : 0

  const activeReservations = reservations.filter((r) => r.status !== 'cancelled')
  const nightlyRates = activeReservations
    .map((r) => (r.numberOfNights > 0 ? r.totalPrice / r.numberOfNights : 0))
    .filter((n) => n > 0)
  const averageNightlyRate =
    nightlyRates.length > 0
      ? Math.round(nightlyRates.reduce((sum, n) => sum + n, 0) / nightlyRates.length)
      : 0

  const invoiceRevenue = invoices
    .filter((inv) => inv.payment_status === 'paid')
    .reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0)
  const reservationRevenue = activeReservations.reduce((sum, r) => sum + r.totalPrice, 0)
  const totalRevenue = invoiceRevenue > 0 ? invoiceRevenue : reservationRevenue

  const totalBookings = activeReservations.length
  const totalGuests = new Set(activeReservations.map((r) => r.guestId).filter(Boolean)).size

  return {
    totalRevenue,
    occupancyRate,
    averageNightlyRate,
    totalBookings,
    totalGuests,
    reviParMetric: totalRooms > 0 ? Math.round(totalRevenue / totalRooms) : 0,
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
      (r) => r.status !== 'cancelled' && r.checkInDate <= dayStr && r.checkOutDate > dayStr,
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

export async function getDashboardData(): Promise<DashboardData> {
  const empty: DashboardData = {
    hotelId: null,
    rooms: [],
    dbRooms: [],
    reservations: [],
    invoices: [],
    metrics: {
      totalRevenue: 0,
      occupancyRate: 0,
      averageNightlyRate: 0,
      totalBookings: 0,
      totalGuests: 0,
      reviParMetric: 0,
    },
    availability: [],
    roomOptions: [],
    occupancySpans: [],
  }

  const profile = await getProfile()
  if (!profile?.hotel_id) return empty

  const supabase = await createClient()
  const hotelId = profile.hotel_id

  const [roomsRes, reservationsRes, invoicesRes, occupancySpans] = await Promise.all([
    supabase
      .from('rooms')
      .select('*, room_categories(name, default_nightly_rate)')
      .eq('hotel_id', hotelId)
      .order('number'),
    supabase
      .from('reservations')
      .select('*, rooms(number), guests(email, phone)')
      .eq('hotel_id', hotelId)
      .order('check_in', { ascending: false }),
    supabase.from('invoices').select('*').eq('hotel_id', hotelId),
    getOccupancySpans(supabase, hotelId),
  ])

  const dbRooms = (roomsRes.data ?? []) as DbRoom[]
  const reservations = ((reservationsRes.data ?? []) as unknown as ReservationRow[]).map(
    mapReservation,
  )
  const invoices = (invoicesRes.data ?? []) as DbInvoice[]

  return {
    hotelId,
    rooms: dbRooms.map(mapRoom),
    dbRooms,
    reservations,
    invoices,
    metrics: computeMetrics(dbRooms, reservations, invoices),
    availability: computeAvailability(dbRooms, reservations),
    roomOptions: dbRooms.map((r) => ({
      id: r.id,
      number: r.number,
      nightlyRate:
        r.nightly_rate != null
          ? Number(r.nightly_rate)
          : Number(r.room_categories?.default_nightly_rate ?? 0),
    })),
    occupancySpans,
  }
}
