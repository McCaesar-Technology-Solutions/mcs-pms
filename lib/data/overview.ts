import type { DbInvoice, Reservation } from '@/types'
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

export function getUpcomingBookings(reservations: Reservation[], limit = 5): Reservation[] {
  return reservations
    .filter((r) => isOpenBookingStatus(r.status))
    .sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime())
    .slice(0, limit)
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
