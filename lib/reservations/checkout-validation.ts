import { reservationBalanceDue } from '@/lib/billing/reservation-payment'

export interface CheckoutBalanceInput {
  invoiceTotal: number
  priorDeposit: number
  markAsPaid: boolean
}

export function validateCheckoutBalance(
  input: CheckoutBalanceInput,
): { ok: true } | { ok: false; error: string; code: string } {
  const invoiceTotal = Math.max(0, input.invoiceTotal)
  const priorDeposit = Math.max(0, input.priorDeposit)
  const outstanding = reservationBalanceDue(invoiceTotal, priorDeposit)

  if (input.markAsPaid && outstanding > 0.009) {
    return {
      ok: false,
      error: `Outstanding balance is ₵${outstanding.toFixed(2)}. Uncheck "Payment received now" to check out with balance due, or collect the full amount first.`,
      code: 'OUTSTANDING_BALANCE',
    }
  }

  return { ok: true }
}
