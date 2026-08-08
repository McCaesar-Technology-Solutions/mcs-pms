import type { PayCycle } from '@/lib/payroll/types'

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function computeNetPay(input: {
  basePay: number
  commission: number
  allowances?: number
  deductions?: number
}): number {
  const gross =
    roundMoney(input.basePay) +
    roundMoney(input.commission) +
    roundMoney(input.allowances ?? 0)
  return roundMoney(Math.max(0, gross - roundMoney(input.deductions ?? 0)))
}

/** Format YYYY-MM-DD in local calendar terms from a Date. */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12, 0, 0)
}

export function formatPeriodLabel(start: string, end: string): string {
  const s = parseISODate(start)
  const e = parseISODate(end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', opts)}`
}

/** Default period covering "today" for the given cycle. */
export function defaultPeriodBounds(
  cycle: PayCycle,
  reference = new Date(),
): { periodStart: string; periodEnd: string } {
  const ref = new Date(reference)
  ref.setHours(12, 0, 0, 0)

  if (cycle === 'monthly') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 12)
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12)
    return { periodStart: toISODate(start), periodEnd: toISODate(end) }
  }

  if (cycle === 'weekly') {
    const day = ref.getDay() // 0 Sun
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(ref)
    start.setDate(ref.getDate() + mondayOffset)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { periodStart: toISODate(start), periodEnd: toISODate(end) }
  }

  // biweekly — align to epoch fortnights from a fixed Monday anchor
  const anchor = new Date(2024, 0, 1, 12) // Monday
  const msPerDay = 86400000
  const days = Math.floor((ref.getTime() - anchor.getTime()) / msPerDay)
  const fortnight = Math.floor(days / 14)
  const start = new Date(anchor)
  start.setDate(anchor.getDate() + fortnight * 14)
  const end = new Date(start)
  end.setDate(start.getDate() + 13)
  return { periodStart: toISODate(start), periodEnd: toISODate(end) }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return roundMoney(((current - previous) / previous) * 100)
}

export function computeCommissionAmount(
  rateType: 'flat' | 'percent',
  rateValue: number,
  percentBaseAmount: number,
): number {
  if (rateType === 'flat') return roundMoney(rateValue)
  return roundMoney((rateValue / 100) * percentBaseAmount)
}

export function sumRunTotals(
  lines: Array<{
    basePay: number
    commission: number
    allowances: number
    deductions: number
    netPay: number
    status: string
  }>,
) {
  const included = lines.filter((l) => l.status !== 'excluded')
  return {
    totalBase: roundMoney(included.reduce((s, l) => s + l.basePay, 0)),
    totalCommission: roundMoney(included.reduce((s, l) => s + l.commission, 0)),
    totalAllowances: roundMoney(included.reduce((s, l) => s + l.allowances, 0)),
    totalDeductions: roundMoney(included.reduce((s, l) => s + l.deductions, 0)),
    totalNet: roundMoney(included.reduce((s, l) => s + l.netPay, 0)),
    employeeCount: included.length,
  }
}
