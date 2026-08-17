import { parsePageParam } from '@/lib/data/pagination'
import type { ReservationPaymentStatus } from '@/types'

const STATUS_VALUES = [
  'all',
  'checked_in',
  'confirmed',
  'pre_arrival',
  'provisional',
  'checkout_in_progress',
  'overstay',
  'checked_out',
  'post_stay',
  'cancelled',
  'no_show',
  'released',
] as const

const PAYMENT_STATUS_VALUES = [
  'all',
  'unpaid',
  'deposit_paid',
  'partial',
  'paid',
  'overdue',
] as const

export type ReservationStatusFilter = (typeof STATUS_VALUES)[number]
export type ReservationPaymentFilter = (typeof PAYMENT_STATUS_VALUES)[number]

export const RESERVATION_STATUS_FILTERS = STATUS_VALUES
export const RESERVATION_PAYMENT_FILTERS = PAYMENT_STATUS_VALUES

export interface ReservationListFilters {
  q?: string
  status?: ReservationStatusFilter
  paymentStatus?: ReservationPaymentFilter
  checkInDate?: string
  checkOutDate?: string
  paymentSecured?: boolean
  page: number
  pageSize: number
}

function isoDate(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

export function parseReservationSearchParams(params: {
  q?: string
  checkIn?: string
  checkOut?: string
  status?: string
  payment?: string
  pay?: string
  page?: string
}): {
  initialSearch?: string
  initialCheckInDate?: string
  initialCheckOutDate?: string
  initialStatus?: Exclude<ReservationStatusFilter, 'all'>
  initialPaymentStatus?: Exclude<ReservationPaymentFilter, 'all'>
  initialPaymentSecured: boolean
  page: number
  filters: ReservationListFilters
} {
  const status = params.status === 'in_house' ? 'checked_in' : params.status
  const initialStatus =
    status && status !== 'all' && (STATUS_VALUES as readonly string[]).includes(status)
      ? (status as Exclude<ReservationStatusFilter, 'all'>)
      : undefined

  const pay = params.pay
  const initialPaymentStatus =
    pay && pay !== 'all' && (PAYMENT_STATUS_VALUES as readonly string[]).includes(pay)
      ? (pay as Exclude<ReservationPaymentFilter, 'all'>)
      : undefined

  const page = parsePageParam(params.page)
  const pageSize = 10
  const q = params.q?.trim() || undefined
  const checkInDate = isoDate(params.checkIn)
  const checkOutDate = isoDate(params.checkOut)
  const paymentSecured = params.payment === 'secured'

  return {
    initialSearch: q,
    initialCheckInDate: checkInDate,
    initialCheckOutDate: checkOutDate,
    initialStatus,
    initialPaymentStatus,
    initialPaymentSecured: paymentSecured,
    page,
    filters: {
      q,
      status: initialStatus ?? 'all',
      paymentStatus: initialPaymentStatus ?? 'all',
      checkInDate,
      checkOutDate,
      paymentSecured,
      page,
      pageSize,
    },
  }
}

/** Extract UUID prefix from display refs like MOJO-A1B2C3D4. */
export function bookingRefSearchPrefix(query: string): string | null {
  const trimmed = query.trim()
  const match = trimmed.match(/^MOJO-([0-9a-fA-F]{4,8})$/i)
  if (match?.[1]) return match[1].toLowerCase()
  if (/^[0-9a-fA-F]{4,8}$/i.test(trimmed) && trimmed.length >= 4) {
    return trimmed.toLowerCase()
  }
  return null
}

export function isSecuredPaymentStatus(
  paymentStatus: ReservationPaymentStatus | string | null | undefined,
  amountCollected: number,
): boolean {
  if (
    paymentStatus === 'paid' ||
    paymentStatus === 'deposit_paid' ||
    paymentStatus === 'complimentary'
  ) {
    return true
  }
  if (paymentStatus === 'partial') return amountCollected > 0.009
  return false
}
