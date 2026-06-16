import { createAdminClient } from '@/lib/supabase/admin'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Strip noise so "Room 12", "12", and "12a" match room numbers consistently. */
export function normalizeRoomNumber(input: string): string {
  return input
    .trim()
    .replace(/^room\s*/i, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

export function slugifyHotelName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base.length >= 3 ? base : 'property'
}

export function isValidGuestPortalSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= 3 && slug.length <= 48
}

export function buildPropertyJoinPath(slug: string): string {
  return `/guest/join/${encodeURIComponent(slug)}`
}

export async function buildPropertyJoinUrl(slug: string): Promise<string> {
  let appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    const { headers } = await import('next/headers')
    const h = await headers()
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    appUrl = host ? `${proto}://${host}` : 'http://localhost:3000'
  }
  return `${appUrl.replace(/\/$/, '')}${buildPropertyJoinPath(slug)}`
}

/** Assign a stable portal slug when missing (lobby QR should not change casually). */
export async function ensureGuestPortalSlug(hotelId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('id, name, guest_portal_slug')
    .eq('id', hotelId)
    .maybeSingle()

  if (!hotel) return null
  if (hotel.guest_portal_slug) return hotel.guest_portal_slug

  const base = slugifyHotelName(hotel.name)
  const suffix = hotel.id.replace(/-/g, '').slice(0, 6).toLowerCase()
  let candidate = `${base}-${suffix}`
  let attempt = 0

  while (attempt < 5) {
    const { data: clash } = await admin
      .from('hotels')
      .select('id')
      .eq('guest_portal_slug', candidate)
      .neq('id', hotelId)
      .maybeSingle()

    if (!clash) break
    attempt += 1
    candidate = `${base}-${suffix}${attempt}`
  }

  const { error } = await admin
    .from('hotels')
    .update({ guest_portal_slug: candidate })
    .eq('id', hotelId)

  if (error) return null
  return candidate
}
