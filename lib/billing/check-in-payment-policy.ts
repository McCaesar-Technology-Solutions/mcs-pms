import type { CheckInPaymentMode, ReservationChannel } from '@/types'

export type CheckInPaymentPolicy = {
  mode: CheckInPaymentMode
  value: number
}

export type RequiredPaymentInput = {
  invoiceTotal: number
  nights: number
  nightlyRate: number
  mode: CheckInPaymentMode
  value: number
}

export type AssertCheckInPaymentInput = RequiredPaymentInput & {
  amountPaid: number
  complimentary?: boolean
  channelPrepaid?: boolean
  managerOverride?: boolean
}

const CHANNEL_PREPAID: ReservationChannel[] = ['airbnb', 'booking_com']

export function countStayNights(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T12:00:00`)
  const end = new Date(`${checkOut}T12:00:00`)
  const ms = end.getTime() - start.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 1
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)))
}

export function requiredPaymentAtCheckIn(input: RequiredPaymentInput): number {
  const total = Math.max(0, input.invoiceTotal)
  if (total <= 0 || input.mode === 'none') return 0

  if (input.mode === 'percent') {
    const pct = Math.min(100, Math.max(0, input.value))
    return Math.min(total, Math.round(total * (pct / 100) * 100) / 100)
  }

  if (input.mode === 'fixed') {
    return Math.min(total, Math.max(0, input.value))
  }

  if (input.mode === 'first_night') {
    const nights = Math.max(1, input.nights)
    const nightly =
      input.nightlyRate > 0
        ? input.nightlyRate
        : total / nights
    return Math.min(total, Math.round(nightly * 100) / 100)
  }

  return 0
}

export function isChannelPrepaidStay(input: {
  channel: ReservationChannel | string | null | undefined
  paymentStatus: string | null | undefined
  amountPaid: number
  requiredMinimum: number
}): boolean {
  if (input.paymentStatus === 'paid') return true
  const channel = (input.channel ?? '') as ReservationChannel
  if (!CHANNEL_PREPAID.includes(channel)) return false
  return input.amountPaid + 0.009 >= input.requiredMinimum
}

export function checkInPaymentMet(input: AssertCheckInPaymentInput): boolean {
  if (input.complimentary || input.invoiceTotal <= 0) return true
  if (input.channelPrepaid) return true
  if (input.managerOverride) return true

  const required = requiredPaymentAtCheckIn(input)
  return input.amountPaid + 0.009 >= required
}

export function assertCheckInPaymentMet(
  input: AssertCheckInPaymentInput,
):
  | { ok: true; required: number }
  | { ok: false; error: string; required: number; shortfall: number } {
  const required = requiredPaymentAtCheckIn(input)

  if (checkInPaymentMet(input)) {
    return { ok: true, required }
  }

  const shortfall = Math.max(0, Math.round((required - input.amountPaid) * 100) / 100)
  return {
    ok: false,
    error: `Check-in requires at least ₵${required.toFixed(2)} collected (₵${shortfall.toFixed(2)} still due).`,
    required,
    shortfall,
  }
}

export function formatCheckInPaymentPolicyLabel(policy: CheckInPaymentPolicy): string {
  switch (policy.mode) {
    case 'none':
      return 'No minimum — payment optional at check-in'
    case 'percent':
      return `${policy.value}% of stay total`
    case 'fixed':
      return `₵${policy.value.toFixed(2)} minimum`
    case 'first_night':
      return 'First night rate'
    default:
      return 'Configured minimum'
  }
}

export const DEFAULT_CHECK_IN_PAYMENT_POLICY: CheckInPaymentPolicy = {
  mode: 'percent',
  value: 50,
}

export function normalizeCheckInPaymentPolicy(
  row: { check_in_payment_mode?: string | null; check_in_payment_value?: number | null } | null,
): CheckInPaymentPolicy {
  const mode = (row?.check_in_payment_mode ?? DEFAULT_CHECK_IN_PAYMENT_POLICY.mode) as CheckInPaymentMode
  const validModes: CheckInPaymentMode[] = ['none', 'percent', 'fixed', 'first_night']
  return {
    mode: validModes.includes(mode) ? mode : DEFAULT_CHECK_IN_PAYMENT_POLICY.mode,
    value: Number(row?.check_in_payment_value ?? DEFAULT_CHECK_IN_PAYMENT_POLICY.value),
  }
}
