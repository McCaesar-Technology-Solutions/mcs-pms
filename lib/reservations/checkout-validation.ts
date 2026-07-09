export interface CheckoutBalanceInput {
  invoiceTotal: number
  priorDeposit: number
  markAsPaid: boolean
}

/**
 * Checkout may proceed when staff mark payment as received — the checkout action
 * records the remainder and settles the invoice. Pay-later is allowed when unchecked.
 */
export function validateCheckoutBalance(
  _input: CheckoutBalanceInput,
): { ok: true } | { ok: false; error: string; code: string } {
  return { ok: true }
}
