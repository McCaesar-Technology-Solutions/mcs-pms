export interface CheckoutBalanceInput {
  invoiceTotal: number
  priorDeposit: number
  markAsPaid: boolean
}

/**
 * Normal checkout must settle any remaining balance (pay-at-check-in model).
 * Unpaid departure is walkout only — not a pay-later checkout.
 */
export function validateCheckoutBalance(
  input: CheckoutBalanceInput,
): { ok: true } | { ok: false; error: string; code: string } {
  const total = Math.max(0, Number(input.invoiceTotal) || 0)
  const paid = Math.max(0, Number(input.priorDeposit) || 0)
  const balanceDue = Math.round((total - paid) * 100) / 100

  if (balanceDue > 0.009 && !input.markAsPaid) {
    return {
      ok: false,
      error:
        'Outstanding balance must be collected at checkout, or record a walkout if the guest left without paying.',
      code: 'BALANCE_DUE',
    }
  }

  return { ok: true }
}
