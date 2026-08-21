import { stayNights } from '@/lib/stays/helpers'
import { roundMoney, type RateType } from '@/lib/pricing/stay-totals'

/** Rental month used by monthly rate math (`monthlyRate / 30`). */
export const BILLING_MONTH_NIGHTS = 30

export type StayBillingPeriod = {
  start: string
  end: string
  nights: number
  index: number
  count: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function addIsoDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Monthly rate stays longer than one rental month get one invoice period per 30 nights.
 * Nightly/weekly stays stay a single invoice (the stay itself).
 */
export function stayBillingPeriods(
  checkIn: string,
  checkOut: string,
  rateType: RateType | string | null,
): StayBillingPeriod[] {
  const totalNights = stayNights(checkIn, checkOut)
  if (rateType !== 'monthly' || totalNights <= BILLING_MONTH_NIGHTS) {
    return [{ start: checkIn, end: checkOut, nights: totalNights, index: 1, count: 1 }]
  }

  const slices: Array<{ start: string; end: string; nights: number }> = []
  let cursor = checkIn
  while (cursor < checkOut) {
    const proposedEnd = addIsoDays(cursor, BILLING_MONTH_NIGHTS)
    const end = proposedEnd < checkOut ? proposedEnd : checkOut
    slices.push({ start: cursor, end, nights: stayNights(cursor, end) })
    cursor = end
  }

  const count = slices.length
  return slices.map((slice, i) => ({
    ...slice,
    index: i + 1,
    count,
  }))
}

/** Oldest-first: fill each period total before the next. */
export function waterfallAllocate(periodTotals: number[], credit: number): number[] {
  let left = Math.max(0, roundMoney(credit))
  return periodTotals.map((total) => {
    const cap = Math.max(0, roundMoney(total))
    const take = Math.min(left, cap)
    left = roundMoney(left - take)
    return take
  })
}

export function splitAmountByWeights(total: number, weights: number[]): number[] {
  const safeTotal = roundMoney(total)
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (sum <= 0 || weights.length === 0) {
    return weights.map(() => 0)
  }
  const parts = weights.map((w) => roundMoney(safeTotal * (Math.max(0, w) / sum)))
  const drift = roundMoney(safeTotal - parts.reduce((s, n) => s + n, 0))
  if (Math.abs(drift) >= 0.01 && parts.length > 0) {
    parts[parts.length - 1] = roundMoney(parts[parts.length - 1]! + drift)
  }
  return parts
}

export function billingPeriodLabel(period: StayBillingPeriod): string {
  if (period.count <= 1) return 'Stay'
  return `Month ${period.index} of ${period.count}`
}
