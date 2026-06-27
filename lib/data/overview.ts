import type { Availability, DbInvoice, Reservation } from '@/types'
import { filterMetricsEligible, isOpenBookingStatus } from '@/lib/reservations/lifecycle'

export interface ChannelPerf {
  channel: Reservation['source']
  bookings: number
  revenue: number
}

export interface GraSummary {
  period: string
  totalRevenue: number
  totalTax: number
  taxRate: number
  invoicesIssued: number
  invoicesPaid: number
  status: 'pending' | 'submitted' | 'approved'
}

export interface TodayOperations {
  guestsInHouse: number
  arrivalsToday: number
  departuresToday: number
}

export interface RevenueTrend {
  thisMonth: number
  lastMonth: number
  changePercent: number | null
}

function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7)
}

export function computeRevenueTrend(invoices: DbInvoice[]): RevenueTrend {
  const now = new Date()
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`

  let thisMonth = 0
  let lastMonth = 0

  for (const inv of invoices) {
    if (inv.payment_status !== 'paid') continue
    const date = inv.paid_at ?? inv.issued_at
    if (!date) continue
    const amount = inv.total_amount ?? 0
    const key = monthKeyFromIso(date)
    if (key === thisKey) thisMonth += amount
    else if (key === lastKey) lastMonth += amount
  }

  const changePercent =
    lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null

  return { thisMonth, lastMonth, changePercent }
}

export function computeOccupancySparkline(availability: Availability[]): number[] {
  return availability.map((day) => {
    const total = day.occupied + day.reserved + day.maintenance + day.available
    if (total <= 0) return 0
    return Math.round(((day.occupied + day.reserved) / total) * 100)
  })
}

export function computeRevenueSparkline(invoices: DbInvoice[], days = 14): number[] {
  const totals = Array.from({ length: days }, () => 0)
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    const key = d.toISOString().split('T')[0]
    for (const inv of invoices) {
      if (inv.payment_status !== 'paid') continue
      const date = (inv.paid_at ?? inv.issued_at)?.split('T')[0]
      if (date === key) totals[i] += inv.total_amount ?? 0
    }
  }

  return totals
}

export function getUpcomingBookings(reservations: Reservation[], limit = 5): Reservation[] {
  return reservations
    .filter((r) => isOpenBookingStatus(r.status))
    .sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime())
    .slice(0, limit)
}

export function computeTodayOperations(
  reservations: Reservation[],
  today = new Date().toISOString().split('T')[0],
): TodayOperations {
  const active = (status: string) => status === 'confirmed' || status === 'checked_in'

  return {
    guestsInHouse: reservations.filter((r) => r.status === 'checked_in').length,
    arrivalsToday: reservations.filter((r) => r.checkInDate === today && active(r.status)).length,
    departuresToday: reservations.filter(
      (r) => r.checkOutDate === today && (r.status === 'checked_in' || r.status === 'confirmed'),
    ).length,
  }
}

export function computeChannelPerformance(reservations: Reservation[]): ChannelPerf[] {
  const active = filterMetricsEligible(reservations)
  const map = new Map<Reservation['source'], { bookings: number; revenue: number }>()

  for (const r of active) {
    const entry = map.get(r.source) ?? { bookings: 0, revenue: 0 }
    entry.bookings += 1
    entry.revenue += r.totalPrice
    map.set(r.source, entry)
  }

  return [...map.entries()]
    .map(([channel, v]) => ({ channel, bookings: v.bookings, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function computeGraSummary(invoices: DbInvoice[]): GraSummary {
  const period = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  const subtotalSum = invoices.reduce((sum, inv) => sum + (inv.subtotal ?? 0), 0)
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0)
  const totalTax = invoices.reduce(
    (sum, inv) =>
      sum +
      (inv.vat_amount ?? 0) +
      (inv.nhil_amount ?? 0) +
      (inv.getfund_amount ?? 0) +
      (inv.covid_levy_amount ?? 0) +
      (inv.elevy_amount ?? 0),
    0,
  )

  return {
    period,
    totalRevenue,
    totalTax,
    taxRate: subtotalSum > 0 ? totalTax / subtotalSum : 0,
    invoicesIssued: invoices.length,
    invoicesPaid: invoices.filter((inv) => inv.payment_status === 'paid').length,
    status: 'pending',
  }
}
