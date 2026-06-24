import { createAdminClient } from '@/lib/supabase/admin'

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Build Resend "from" header: `Property Name <email@domain.com>`. */
export function formatEmailFrom(displayName: string, email: string): string {
  const safeName = displayName.replace(/[<>]/g, '').trim() || 'MOJO Apartments'
  return `${safeName} <${email.trim().toLowerCase()}>`
}

/** Server default when a property has no custom sender. */
export function resolveEmailFromEnv(): string {
  const from = process.env.RESEND_FROM?.trim()
  if (from) return from
  return 'MOJO Apartments <onboarding@resend.dev>'
}

/** @deprecated Prefer resolveEmailFromForHotel when hotelId is known. */
export function resolveEmailFrom(): string {
  return resolveEmailFromEnv()
}

/** Property sender if set, otherwise RESEND_FROM env, then Resend sandbox. */
export async function resolveEmailFromForHotel(hotelId: string | undefined): Promise<string> {
  if (!hotelId) return resolveEmailFromEnv()

  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('name, notification_from_email')
    .eq('id', hotelId)
    .maybeSingle()

  const custom = data?.notification_from_email?.trim()
  if (custom && isValidEmail(custom)) {
    return formatEmailFrom(data?.name ?? 'MOJO Apartments', custom)
  }

  return resolveEmailFromEnv()
}
