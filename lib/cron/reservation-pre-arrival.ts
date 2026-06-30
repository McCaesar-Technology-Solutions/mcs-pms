import { addDaysISO } from '@/lib/reservations/check-out-time'

/** Check-in dates that should move confirmed → pre_arrival (T−2 comms + arrival-day catch-up). */
export function preArrivalPromotionCheckInDates(today: string): string[] {
  return [today, addDaysISO(today, 2)]
}
