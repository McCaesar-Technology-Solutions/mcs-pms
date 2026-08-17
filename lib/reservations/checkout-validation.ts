export interface CheckoutBalanceInput {
  invoiceTotal: number
  amountPaid: number
}

/**
 * Normal checkout must settle any remaining balance (pay-at-check-in model).
 * Unpaid departure is walkout only — not a pay-later checkout.
 */
export function validateCheckoutBalance(
  input: CheckoutBalanceInput,
): { ok: true } | { ok: false; error: string; code: string } {
  const total = Math.max(0, Number(input.invoiceTotal) || 0)
  const paid = Math.max(0, Number(input.amountPaid) || 0)
  const balanceDue = Math.round((total - paid) * 100) / 100

  if (balanceDue > 0.009) {
    return {
      ok: false,
      error:
        'Outstanding balance must be collected at checkout, or record a walkout if the guest left without paying.',
      code: 'BALANCE_DUE',
    }
  }

  return { ok: true }
}

export function validateCheckoutPaymentAmount(input: {
  balanceDue: number
  paymentAmount: number
}): { ok: true } | { ok: false; error: string } {
  const balanceDue = Math.max(0, Number(input.balanceDue) || 0)
  const paymentAmount = Math.max(0, Number(input.paymentAmount) || 0)

  if (balanceDue <= 0.009) return { ok: true }
  if (paymentAmount + 0.009 < balanceDue) {
    return {
      ok: false,
      error: `Collect the full remaining balance (₵${balanceDue.toFixed(2)}) at checkout, or record a walkout.`,
    }
  }
  if (paymentAmount > balanceDue + 0.009) {
    return {
      ok: false,
      error: `Payment cannot exceed the remaining balance (₵${balanceDue.toFixed(2)}).`,
    }
  }

  return { ok: true }
}
