export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

/** From address — must be a verified domain in Resend (or onboarding@resend.dev for testing). */
export function resolveEmailFrom(): string {
  const from = process.env.RESEND_FROM?.trim()
  if (from) return from
  return 'MOJO Apartments <onboarding@resend.dev>'
}
