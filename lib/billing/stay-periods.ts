import { stayNights } from '@/lib/stays/helpers'
import { roundMoney } from '@/lib/pricing/stay-totals'

export type StayBillingPeriod = {
  start: string
  end: string
  nights: number
  index: number
  count: number
}

export type StayInvoicePeriodRow = {
  billing_period_start: string | null
  billing_period_end: string | null
}

export type LifoShortenAction = {
  start: string
  end: string
  nights: number
  action: 'keep' | 'shrink' | 'drop'
}

/** Invoice periods may be empty (dropped extension). Stay bookings still use stayNights (min 1). */
export function stayInvoiceNights(start: string, end: string): number {
  if (start >= end) return 0
  return stayNights(start, end)
}

export function indexStayPeriods(
  slices: Array<{ start: string; end: string }>,
): StayBillingPeriod[] {
  const count = slices.length
  return slices.map((slice, i) => ({
    start: slice.start,
    end: slice.end,
    nights: stayInvoiceNights(slice.start, slice.end),
    index: i + 1,
    count,
  }))
}

/**
 * Stay invoices are the original stay plus one unique invoice per extension.
 * Periods come from existing invoice rows. A stay with no invoices is a single
 * period covering check-in → check-out (any rate type, any length).
 */
export function stayInvoicePeriodsFromRows(
  rows: StayInvoicePeriodRow[],
  checkIn: string,
  checkOut: string,
): StayBillingPeriod[] {
  if (rows.length === 0) {
    return indexStayPeriods([{ start: checkIn, end: checkOut }])
  }

  return indexStayPeriods(
    rows.map((row) => {
      const start = row.billing_period_start ?? checkIn
      const end = row.billing_period_end ?? (row.billing_period_start ? start : checkOut)
      return { start, end }
    }),
  )
}

export function lastActivePeriodEnd(periods: StayBillingPeriod[]): string | null {
  for (let i = periods.length - 1; i >= 0; i--) {
    const period = periods[i]
    if (period && period.nights > 0) return period.end
  }
  return null
}

/**
 * Cover nights after the last billed period. Reactivate a dropped invoice that
 * already owns `gap.start` instead of inserting a second row (unique index).
 */
export function applyExtensionCoverage(
  periods: StayBillingPeriod[],
  checkOut: string,
): StayBillingPeriod[] {
  const slices = periods.map((period) => ({ start: period.start, end: period.end }))
  let lastEnd = lastActivePeriodEnd(indexStayPeriods(slices))
  let gap = missingExtensionSlice(lastEnd, checkOut)

  if (!gap && !lastEnd && slices[0] && slices[0].start < checkOut) {
    gap = { start: slices[0].start, end: checkOut }
  }
  if (!gap) return indexStayPeriods(slices)

  const reuseIdx = slices.findIndex(
    (slice) => slice.start === gap!.start && stayInvoiceNights(slice.start, slice.end) === 0,
  )
  if (reuseIdx >= 0) {
    slices[reuseIdx] = { start: gap.start, end: gap.end }
  } else {
    slices.push(gap)
  }
  return indexStayPeriods(slices)
}

export function coverStayInvoicePeriods(
  rows: StayInvoicePeriodRow[],
  checkIn: string,
  checkOut: string,
): StayBillingPeriod[] {
  return applyExtensionCoverage(stayInvoicePeriodsFromRows(rows, checkIn, checkOut), checkOut)
}

/** Uncovered nights after the last billed period — issue a new extension invoice, do not grow the last one. */
export function missingExtensionSlice(
  lastActiveEnd: string | null,
  checkOut: string,
): { start: string; end: string } | null {
  if (!lastActiveEnd || lastActiveEnd >= checkOut) return null
  return { start: lastActiveEnd, end: checkOut }
}

/**
 * Shorten unused nights from the latest extension first.
 * Periods entirely after the new check-out are dropped (zero nights).
 * The overlapping latest period is shrunk. Earlier invoices stay as issued.
 */
export function lifoShortenStayInvoices(
  periods: Array<{ start: string; end: string }>,
  newCheckOut: string,
): LifoShortenAction[] {
  const result: LifoShortenAction[] = periods.map((period) => ({
    start: period.start,
    end: period.end,
    nights: stayInvoiceNights(period.start, period.end),
    action: 'keep',
  }))

  for (let i = result.length - 1; i >= 0; i--) {
    const period = result[i]!
    if (period.start >= newCheckOut) {
      result[i] = { start: period.start, end: period.start, nights: 0, action: 'drop' }
      continue
    }
    if (period.end > newCheckOut) {
      result[i] = {
        start: period.start,
        end: newCheckOut,
        nights: stayInvoiceNights(period.start, newCheckOut),
        action: 'shrink',
      }
    }
    break
  }

  return result
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

export function remainingFixedDiscount(stayFixed: number, alreadyAllocated: number): number {
  return Math.max(0, roundMoney(stayFixed) - roundMoney(alreadyAllocated))
}

export function billingPeriodLabel(period: StayBillingPeriod): string {
  if (period.count <= 1 || period.index === 1) return 'Stay'
  const extensionCount = period.count - 1
  const extensionIndex = period.index - 1
  return `Extension ${extensionIndex} of ${extensionCount}`
}
