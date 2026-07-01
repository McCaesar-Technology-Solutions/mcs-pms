import {
  getTodayDepartures,
  type TodayOperations,
} from '@/lib/data/overview'
import { isOpsDateToday } from '@/lib/dates/ops-date'
import { OPEN_BOOKING_STATUSES } from '@/lib/reservations/lifecycle'
import type { DbRoom, DbRoomStatus, Reservation, ReservationPaymentStatus } from '@/types'

const ARRIVING_FOR_OPS = ['provisional', 'confirmed', 'pre_arrival', 'checked_in'] as const
const IN_HOUSE_NOW = ['checked_in', 'overstay', 'checkout_in_progress'] as const

export interface ExtendedTodayOperations extends TodayOperations {
  dirtyRooms: number
  guestRequests: number
  unreadMessages: number
  /** Prepaid / guaranteed arrivals on the ops date */
  prepaidArrivals: number
  vacantRooms: number
  maintenanceRooms: number
}

export interface RoomBoardSignal {
  roomId: string
  arrivalToday: boolean
  departureToday: boolean
  arrivalReservationId?: string
  departureReservationId?: string
  housekeeping: 'cleaning' | 'needs_inspection' | null
  maintenance: boolean
  prepaidArrival: boolean
}

export interface FloorSummary {
  floor: number
  label: string
  total: number
  occupied: number
  vacant: number
  dirty: number
  maintenance: number
  arrivals: number
  departures: number
}

const SECURED_PAYMENT: ReservationPaymentStatus[] = [
  'paid',
  'deposit_paid',
  'complimentary',
  'partial',
]

function isSecuredPayment(status: ReservationPaymentStatus, depositAmount: number): boolean {
  if (SECURED_PAYMENT.includes(status)) {
    if (status === 'partial') return depositAmount > 0
    return true
  }
  return false
}

export function countGuestsInHouseNow(reservations: Reservation[]): number {
  return reservations.filter((r) =>
    (IN_HOUSE_NOW as readonly string[]).includes(r.status),
  ).length
}

/** Guests in house on a business date (night-audit style for past/future dates). */
export function countInHouseOnDate(reservations: Reservation[], date: string): number {
  return reservations.filter(
    (r) =>
      (OPEN_BOOKING_STATUSES as readonly string[]).includes(r.status) &&
      r.checkInDate <= date &&
      r.checkOutDate > date,
  ).length
}

export function countGuestsForOpsDate(reservations: Reservation[], date: string): number {
  return isOpsDateToday(date)
    ? countGuestsInHouseNow(reservations)
    : countInHouseOnDate(reservations, date)
}

export function getArrivalsForDate(reservations: Reservation[], date: string): Reservation[] {
  return reservations
    .filter(
      (r) =>
        r.checkInDate === date &&
        (ARRIVING_FOR_OPS as readonly string[]).includes(r.status),
    )
    .sort((a, b) => a.guestName.localeCompare(b.guestName))
}

export function getDeparturesForDate(reservations: Reservation[], date: string): Reservation[] {
  return getTodayDepartures(reservations, date)
}

export function countDirtyRooms(rooms: DbRoom[]): number {
  return rooms.filter((r) => {
    const s = (r.status ?? 'available') as DbRoomStatus
    return s === 'cleaning' || s === 'needs_inspection'
  }).length
}

export function countPrepaidArrivals(reservations: Reservation[], date: string): number {
  return getArrivalsForDate(reservations, date).filter((r) =>
    isSecuredPayment(r.paymentStatus, r.depositAmount),
  ).length
}

export function computeExtendedTodayOperations(
  rooms: DbRoom[],
  reservations: Reservation[],
  guestRequestsPending: number,
  unreadMessages: number,
  date: string,
): ExtendedTodayOperations {
  const base: TodayOperations = {
    guestsInHouse: countGuestsForOpsDate(reservations, date),
    arrivalsToday: getArrivalsForDate(reservations, date).length,
    departuresToday: getDeparturesForDate(reservations, date).length,
  }

  let vacantRooms = 0
  let maintenanceRooms = 0
  for (const room of rooms) {
    const status = (room.status ?? 'available') as DbRoomStatus
    if (status === 'available') vacantRooms += 1
    if (status === 'maintenance') maintenanceRooms += 1
  }

  return {
    ...base,
    dirtyRooms: countDirtyRooms(rooms),
    guestRequests: guestRequestsPending,
    unreadMessages,
    prepaidArrivals: countPrepaidArrivals(reservations, date),
    vacantRooms,
    maintenanceRooms,
  }
}

export function buildRoomBoardSignals(
  rooms: DbRoom[],
  reservations: Reservation[],
  date: string,
): Map<string, RoomBoardSignal> {
  const map = new Map<string, RoomBoardSignal>()

  for (const room of rooms) {
    const status = (room.status ?? 'available') as DbRoomStatus
    map.set(room.id, {
      roomId: room.id,
      arrivalToday: false,
      departureToday: false,
      housekeeping:
        status === 'cleaning'
          ? 'cleaning'
          : status === 'needs_inspection'
            ? 'needs_inspection'
            : null,
      maintenance: status === 'maintenance',
      prepaidArrival: false,
    })
  }

  for (const r of getArrivalsForDate(reservations, date)) {
    if (!r.roomId) continue
    const existing = map.get(r.roomId)
    if (!existing) continue
    existing.arrivalToday = true
    existing.arrivalReservationId = r.id
    existing.prepaidArrival = isSecuredPayment(r.paymentStatus, r.depositAmount)
  }

  for (const r of getDeparturesForDate(reservations, date)) {
    if (!r.roomId) continue
    const existing = map.get(r.roomId)
    if (!existing) continue
    existing.departureToday = true
    existing.departureReservationId = r.id
  }

  return map
}

const ORDINALS = [
  'Ground',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
]

export function floorLabel(floor: number): string {
  if (floor <= 0) return 'Ground floor'
  if (floor < ORDINALS.length) return `${ORDINALS[floor]} floor`
  return `Floor ${floor}`
}

export function groupRoomsByFloor(rooms: DbRoom[]): { floor: number; rooms: DbRoom[] }[] {
  const byFloor = new Map<number, DbRoom[]>()
  for (const room of rooms) {
    const floor = room.floor ?? 0
    const list = byFloor.get(floor) ?? []
    list.push(room)
    byFloor.set(floor, list)
  }

  return [...byFloor.entries()]
    .sort(([a], [b]) => b - a)
    .map(([floor, floorRooms]) => ({
      floor,
      rooms: floorRooms.sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      ),
    }))
}

export function computeFloorSummary(
  floor: number,
  floorRooms: DbRoom[],
  signals: Map<string, RoomBoardSignal>,
): FloorSummary {
  let occupied = 0
  let vacant = 0
  let dirty = 0
  let maintenance = 0
  let arrivals = 0
  let departures = 0

  for (const room of floorRooms) {
    const status = (room.status ?? 'available') as DbRoomStatus
    if (status === 'occupied') occupied += 1
    if (status === 'available') vacant += 1
    if (status === 'cleaning' || status === 'needs_inspection') dirty += 1
    if (status === 'maintenance') maintenance += 1

    const signal = signals.get(room.id)
    if (signal?.arrivalToday) arrivals += 1
    if (signal?.departureToday) departures += 1
  }

  return {
    floor,
    label: floorLabel(floor),
    total: floorRooms.length,
    occupied,
    vacant,
    dirty,
    maintenance,
    arrivals,
    departures,
  }
}

export type StaffRoutePrefix = '/owner' | '/manager' | '/receptionist'

export function frontDeskOpsLinks(prefix: StaffRoutePrefix, date: string) {
  const q = encodeURIComponent(date)
  return {
    inHouse: `${prefix}/reservations?status=checked_in`,
    arrivals: `${prefix}/reservations?checkIn=${q}`,
    departures: `${prefix}/reservations?checkOut=${q}`,
    dirty: `${prefix}/rooms?view=floor&filter=dirty&opsDate=${q}`,
    guestRequests:
      prefix === '/owner'
        ? `${prefix}/settings#guest-requests`
        : `${prefix}/dashboard#guest-requests`,
    messages:
      prefix === '/owner'
        ? `${prefix}/messages`
        : `${prefix}/messages`,
    prepaid: `${prefix}/reservations?checkIn=${q}&payment=secured`,
    rooms: `${prefix}/rooms?view=floor&opsDate=${q}`,
  }
}
