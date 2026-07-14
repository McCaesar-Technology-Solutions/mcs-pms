/** Feature flag — ship dark until PAYMENTS_ENABLED=true per deployment. */
export function isPaymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED?.trim().toLowerCase() === 'true'
}

export function getPaystackSecretKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY?.trim() || null
}
