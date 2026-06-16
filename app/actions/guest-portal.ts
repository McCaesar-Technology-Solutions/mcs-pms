'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findActiveGuestForRoom } from '@/lib/data/guest-room-access'
import {
  buildPropertyJoinUrl,
  ensureGuestPortalSlug,
  isValidGuestPortalSlug,
} from '@/lib/guest-portal'
import { setGuestSession } from '@/lib/guest-session'
import { guestRoomEntrySchema } from '@/lib/validations'
import { tokenExpiryISO } from '@/lib/stays/helpers'

export type GuestPortalActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

export async function getPropertyJoinPage(slug: string): Promise<{
  hotelName: string
} | null> {
  if (!isValidGuestPortalSlug(slug)) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('name')
    .eq('guest_portal_slug', slug)
    .maybeSingle()

  if (!data) return null
  return { hotelName: data.name }
}

export async function enterGuestPortalByRoom(input: unknown): Promise<GuestPortalActionResult> {
  const parsed = guestRoomEntrySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid entry.' }
  }

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('id')
    .eq('guest_portal_slug', parsed.data.slug)
    .maybeSingle()

  if (!hotel) {
    return { success: false, error: 'This property link is not valid.' }
  }

  const match = await findActiveGuestForRoom(hotel.id, parsed.data.roomNumber)
  if (!match) {
    return {
      success: false,
      error:
        'No active stay found for that room. Double-check your room number or ask the front desk for help.',
    }
  }

  const expiresAt = match.guest.token_expires_at
    ? new Date(match.guest.token_expires_at)
    : match.guest.check_out
      ? new Date(tokenExpiryISO(match.guest.check_out))
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await setGuestSession(match.guest.id, expiresAt)
  redirect('/guest')
}

export async function getStaffPropertyPortalInfo(): Promise<
  GuestPortalActionResult<{ slug: string; joinUrl: string; hotelName: string }>
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('hotel_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const slug = await ensureGuestPortalSlug(profile.hotel_id)
  if (!slug) return { success: false, error: 'Could not load property portal link.' }

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('name')
    .eq('id', profile.hotel_id)
    .maybeSingle()

  const joinUrl = await buildPropertyJoinUrl(slug)

  return {
    success: true,
    data: {
      slug,
      joinUrl,
      hotelName: hotel?.name ?? 'Property',
    },
  }
}
