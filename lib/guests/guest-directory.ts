import type { ReservationChannel } from '@/types'
import type { GuestIdDocumentType } from '@/lib/guests/id-document'
import {
  isInHouseReservationStatus,
  isOccupyingReservationStatus,
  isVoidedReservationStatus,
} from '@/lib/reservations/lifecycle'

/** Loyalty / CRM — independent of whether the guest is currently in the building. */
export type GuestLoyalty = 'vip' | 'returning' | 'new'

/** Occupancy — derived from reservation status, never leftover stay dates. */
export type GuestOccupancy =
  | 'in_house'
  | 'checking_out'
  | 'overstay'
  | 'dispute_hold'
  | 'departed'
  | 'upcoming'
  | 'none'

export type GuestDirectoryFilter = 'in_house' | 'departed' | 'vip' | 'returning' | 'new'

/** @deprecated Use GuestLoyalty + GuestOccupancy. Kept for old `?status=active` URLs. */
export type GuestStatus = GuestDirectoryFilter

export const DIRECTORY_FILTERS: GuestDirectoryFilter[] = [
  'in_house',
  'departed',
  'vip',
  'returning',
  'new',
]

export const OCCUPANCY_LABEL: Record<GuestOccupancy, string> = {
  in_house: 'In house',
  checking_out: 'Checking out',
  overstay: 'Overstay',
  dispute_hold: 'Dispute hold',
  departed: 'Checked out',
  upcoming: 'Upcoming',
  none: 'No stay',
}

export const LOYALTY_LABEL: Record<GuestLoyalty, string> = {
  vip: 'VIP',
  returning: 'Returning',
  new: 'First stay',
}

export const DIRECTORY_FILTER_LABEL: Record<GuestDirectoryFilter, string> = {
  in_house: 'In house',
  departed: 'Past guests',
  vip: 'VIP',
  returning: 'Returning',
  new: 'First stay',
}

export const VIP_SPEND_THRESHOLD = 5000
export const VIP_STAYS_THRESHOLD = 4

const COMPLETED_STAY_STATUSES = [
  'checked_in',
  'checkout_in_progress',
  'overstay',
  'dispute_hold',
  'checked_out',
  'post_stay',
  'archived',
  'walkout',
] as const

const UPCOMING_STATUSES = ['inquiry', 'provisional', 'confirmed', 'pre_arrival'] as const

const DEPARTED_STATUSES = ['checked_out', 'post_stay', 'archived', 'walkout'] as const

const OCCUPANCY_RANK: Record<GuestOccupancy, number> = {
  overstay: 0,
  dispute_hold: 1,
  checking_out: 2,
  in_house: 3,
  upcoming: 4,
  departed: 5,
  none: 6,
}

export interface GuestRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  /** ghana_card | passport | drivers_license — guest record only, not invoice Tax ID. */
  idDocumentType: GuestIdDocumentType | null
  idDocumentNumber: string | null
  idDocumentCountry: string | null
  /** Ghana Card number when type is ghana_card; otherwise null. */
  ghanaCardNumber: string | null
  roomNumber: string | null
  roomId: string | null
  checkIn: string | null
  checkOut: string | null
  totalStays: number
  totalSpent: number
  lastStay: string | null
  occupancy: GuestOccupancy
  loyalty: GuestLoyalty
  source: ReservationChannel | null
  token: string | null
  tokenExpiresAt: string | null
  portalPin: string | null
  reservationId: string | null
  /** Bill-to name on the stay invoice when it differs from the guest. */
  invoiceBillToName: string | null
  isInHouse: boolean
  canCheckOut: boolean
  doNotDisturb: boolean
}

export interface GuestStayInput {
  id?: string
  status: string | null
  check_in: string | null
  check_out: string | null
  created_at?: string | null
  channel?: ReservationChannel | null
  total_amount?: number | null
}

export interface GuestDirectoryDerived {
  occupancy: GuestOccupancy
  loyalty: GuestLoyalty
  isInHouse: boolean
  canCheckOut: boolean
  totalStays: number
  totalSpent: number
  checkIn: string | null
  checkOut: string | null
  lastStay: string | null
  reservationId: string | null
  source: ReservationChannel | null
}

export function parseGuestDirectoryFilter(
  value: string | undefined | null,
): GuestDirectoryFilter | null {
  if (!value) return null
  if (value === 'active') return 'in_house'
  return DIRECTORY_FILTERS.includes(value as GuestDirectoryFilter)
    ? (value as GuestDirectoryFilter)
    : null
}

export function guestMatchesDirectoryFilter(
  guest: Pick<GuestRow, 'occupancy' | 'loyalty' | 'isInHouse'>,
  filter: GuestDirectoryFilter | null,
): boolean {
  if (!filter) return true
  if (filter === 'in_house') return guest.isInHouse
  if (filter === 'departed') return guest.occupancy === 'departed'
  return guest.loyalty === filter
}

export function deriveGuestLoyalty(stays: number, spent: number): GuestLoyalty {
  if (spent >= VIP_SPEND_THRESHOLD || stays >= VIP_STAYS_THRESHOLD) return 'vip'
  if (stays >= 2) return 'returning'
  return 'new'
}

export function deriveGuestOccupancy(
  reservations: GuestStayInput[],
  guestRoomId: string | null,
  guestCheckIn: string | null,
  guestCheckOut: string | null,
): GuestOccupancy {
  if (reservations.some((r) => r.status === 'overstay')) return 'overstay'
  if (reservations.some((r) => r.status === 'dispute_hold')) return 'dispute_hold'
  if (reservations.some((r) => r.status === 'checkout_in_progress')) return 'checking_out'
  if (reservations.some((r) => r.status === 'checked_in')) {
    return 'in_house'
  }
  if (guestRoomId) return 'in_house'
  if (reservations.some((r) => isUpcomingStatus(r.status))) return 'upcoming'
  if (reservations.some((r) => isDepartedStatus(r.status))) return 'departed'
  if (guestCheckIn || guestCheckOut) return 'departed'
  return 'none'
}

export function isCompletedStayStatus(status: string | null | undefined): boolean {
  return (COMPLETED_STAY_STATUSES as readonly string[]).includes(status ?? '')
}

export function guestRoomLabel(guest: Pick<GuestRow, 'roomNumber' | 'occupancy'>): string {
  if (guest.roomNumber) return `Room ${guest.roomNumber}`
  if (guest.occupancy === 'departed') return 'Checked out'
  if (guest.occupancy === 'upcoming') return 'Upcoming stay'
  if (guest.occupancy === 'none') return 'No stay yet'
  return 'No room assigned'
}

export function buildGuestDirectoryFields(input: {
  reservations: GuestStayInput[]
  guestRoomId: string | null
  guestCheckIn: string | null
  guestCheckOut: string | null
}): GuestDirectoryDerived {
  const reservations = input.reservations.filter((r) => !isVoidedReservationStatus(r.status))
  const completed = reservations.filter((r) => isCompletedStayStatus(r.status))
  const totalStays = completed.length
  const totalSpent = completed.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)
  const occupancy = deriveGuestOccupancy(
    reservations,
    input.guestRoomId,
    input.guestCheckIn,
    input.guestCheckOut,
  )
  const isInHouse =
    occupancy === 'in_house' ||
    occupancy === 'checking_out' ||
    occupancy === 'overstay' ||
    occupancy === 'dispute_hold'
  const occupying = reservations.filter((r) => isOccupyingReservationStatus(r.status))
  const canCheckOut = occupying.some((r) => isInHouseReservationStatus(r.status))
  const active = pickActiveStay(occupying)
  const latestCompleted = pickLatestByCheckOut(completed)
  const latestAny = pickLatestByCreated(reservations)

  const checkIn = active?.check_in ?? latestCompleted?.check_in ?? input.guestCheckIn
  const checkOut = active?.check_out ?? latestCompleted?.check_out ?? input.guestCheckOut
  const lastStay = isInHouse
    ? (active?.check_out ?? checkOut)
    : (latestCompleted?.check_out ?? input.guestCheckOut)

  return {
    occupancy,
    loyalty: deriveGuestLoyalty(totalStays, totalSpent),
    isInHouse,
    canCheckOut,
    totalStays,
    totalSpent,
    checkIn,
    checkOut,
    lastStay,
    reservationId: active?.id ?? null,
    source: active?.channel ?? latestCompleted?.channel ?? latestAny?.channel ?? null,
  }
}

/** In-house first (overstay, then checking out); past guests by most recent stay. */
export function sortGuestDirectory(guests: GuestRow[]): GuestRow[] {
  return [...guests].sort((a, b) => {
    const rankDelta = OCCUPANCY_RANK[a.occupancy] - OCCUPANCY_RANK[b.occupancy]
    if (rankDelta !== 0) return rankDelta

    if (a.isInHouse) {
      const aOut = a.checkOut ?? '9999-12-31'
      const bOut = b.checkOut ?? '9999-12-31'
      if (aOut !== bOut) return aOut.localeCompare(bOut)
    } else {
      const aLast = a.lastStay ?? ''
      const bLast = b.lastStay ?? ''
      if (aLast !== bLast) return bLast.localeCompare(aLast)
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function isUpcomingStatus(status: string | null | undefined): boolean {
  return (UPCOMING_STATUSES as readonly string[]).includes(status ?? '')
}

function isDepartedStatus(status: string | null | undefined): boolean {
  return (DEPARTED_STATUSES as readonly string[]).includes(status ?? '')
}

function pickActiveStay(rows: GuestStayInput[]): GuestStayInput | null {
  const overstay = rows.find((r) => r.status === 'overstay')
  if (overstay) return overstay
  const checkingOut = rows.find((r) => r.status === 'checkout_in_progress')
  if (checkingOut) return checkingOut
  return rows[0] ?? null
}

function pickLatestByCheckOut(rows: GuestStayInput[]): GuestStayInput | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => (a.check_out ?? '').localeCompare(b.check_out ?? '')).at(-1) ?? null
}

function pickLatestByCreated(rows: GuestStayInput[]): GuestStayInput | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')).at(-1) ?? null
}
