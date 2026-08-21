import { invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import type { DbInvoice, Reservation } from '@/types'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface OutstandingBalanceSummary {
  total: number
  reservationCount: number
  invoiceOnlyCount: number
}

/**
 * Hotel-wide collectible balance.
 *
 * Unpaid invoices are the source of truth (matches Billing remaining due).
 * Reservation estimated balances are included only when no open invoice exists
 * for that stay, so in-house folio extras on top of an issued invoice are not
 * double-counted.
 */
export function computeHotelOutstandingBalance(
  reservations: Reservation[],
  invoices: DbInvoice[],
): OutstandingBalanceSummary {
  let total = 0
  let reservationCount = 0
  let invoiceOnlyCount = 0
  const invoicedReservationIds = new Set<string>()

  for (const inv of invoices) {
    if (inv.payment_status === 'paid' || inv.payment_status === 'refunded') continue

    const due = invoiceBalanceDue(Number(inv.total_amount ?? 0), Number(inv.amount_paid ?? 0))
    if (due <= 0.009) continue

    total += due

    if (inv.reservation_id) {
      if (!invoicedReservationIds.has(inv.reservation_id)) {
        invoicedReservationIds.add(inv.reservation_id)
        reservationCount++
      }
    } else {
      invoiceOnlyCount++
    }
  }

  for (const r of reservations) {
    if (r.status === 'cancelled' || r.status === 'no_show') continue
    if (invoicedReservationIds.has(r.id)) continue
    if (r.balanceDue <= 0.009) continue

    total += r.balanceDue
    reservationCount++
  }

  return {
    total: round2(total),
    reservationCount,
    invoiceOnlyCount,
  }
}
