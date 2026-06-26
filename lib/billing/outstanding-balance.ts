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
 * Hotel-wide collectible balance: open reservation balances plus manual invoices
 * not already represented on a checked-out reservation row.
 */
export function computeHotelOutstandingBalance(
  reservations: Reservation[],
  invoices: DbInvoice[],
): OutstandingBalanceSummary {
  const checkedOutWithBalance = new Set<string>()
  let total = 0
  let reservationCount = 0

  for (const r of reservations) {
    if (r.status === 'cancelled' || r.status === 'no_show') continue
    if (r.balanceDue <= 0.009) continue

    total += r.balanceDue
    reservationCount++

    if (r.status === 'checked_out') {
      checkedOutWithBalance.add(r.id)
    }
  }

  let invoiceOnlyCount = 0

  for (const inv of invoices) {
    if (inv.payment_status === 'paid' || inv.payment_status === 'refunded') continue

    const due = invoiceBalanceDue(Number(inv.total_amount ?? 0), Number(inv.amount_paid ?? 0))
    if (due <= 0.009) continue

    if (inv.reservation_id && checkedOutWithBalance.has(inv.reservation_id)) {
      continue
    }

    if (!inv.reservation_id) {
      invoiceOnlyCount++
    }

    total += due
  }

  return {
    total: round2(total),
    reservationCount,
    invoiceOnlyCount,
  }
}
