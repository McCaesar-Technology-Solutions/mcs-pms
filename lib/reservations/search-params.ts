const STATUS_VALUES = [
  'checked_in',
  'confirmed',
  'checked_out',
  'cancelled',
  'no_show',
] as const

export function parseReservationSearchParams(params: {
  checkIn?: string
  checkOut?: string
  status?: string
  payment?: string
}) {
  const iso = (value?: string) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined

  const status = params.status
  const initialStatus =
    status && (STATUS_VALUES as readonly string[]).includes(status)
      ? (status as (typeof STATUS_VALUES)[number])
      : undefined

  return {
    initialCheckInDate: iso(params.checkIn),
    initialCheckOutDate: iso(params.checkOut),
    initialStatus,
    initialPaymentSecured: params.payment === 'secured',
  }
}
