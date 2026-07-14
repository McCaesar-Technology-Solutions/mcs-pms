import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { ownerOwnsHotel } from '@/lib/data/properties'
import type { Profile, UserRole } from '@/types'

export interface HotelTenantAccessOptions {
  roles?: UserRole[]
}

/**
 * Verify the signed-in staff member may access data for `hotelId`.
 * Uses MFA-verified profile and owner portfolio checks.
 */
export async function resolveHotelTenantAccess(
  hotelId: string,
  options: HotelTenantAccessOptions = {},
): Promise<Profile | null> {
  if (!hotelId) return null

  const profile = await getVerifiedProfile()
  if (!profile) return null

  if (options.roles?.length && !options.roles.includes(profile.role)) {
    return null
  }

  if (profile.role === 'owner') {
    const owns = await ownerOwnsHotel(profile.id, hotelId)
    return owns ? profile : null
  }

  if (profile.hotel_id !== hotelId) return null
  return profile
}

/** Returns true when the caller may read/write tenant data for the hotel. */
export async function hasHotelTenantAccess(
  hotelId: string,
  options: HotelTenantAccessOptions = {},
): Promise<boolean> {
  return (await resolveHotelTenantAccess(hotelId, options)) !== null
}
