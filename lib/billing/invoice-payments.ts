import type { PaymentStatus } from '@/types'

export function deriveInvoicePaymentStatus(
  totalAmount: number,
  amountPaid: number,
  currentStatus?: PaymentStatus | null,
): PaymentStatus {
  if (currentStatus === 'refunded') return 'refunded'
  const total = Math.max(0, totalAmount)
  const paid = Math.max(0, amountPaid)
  if (paid <= 0) {
    if (currentStatus === 'overdue') return 'overdue'
    return 'pending'
  }
  if (paid + 0.009 >= total) return 'paid'
  return 'partial'
}

export function invoiceBalanceDue(totalAmount: number, amountPaid: number): number {
  return Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100)
}
