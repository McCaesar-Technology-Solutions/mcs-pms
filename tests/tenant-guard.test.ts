import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Profile } from '@/types'

const HOTEL_A = '11111111-1111-4111-8111-111111111111'
const HOTEL_B = '22222222-2222-4222-8222-222222222222'
const USER_ID = '33333333-3333-4333-8333-333333333333'

vi.mock('@/lib/auth/get-profile', () => ({
  getVerifiedProfile: vi.fn(),
}))

vi.mock('@/lib/data/properties', () => ({
  ownerOwnsHotel: vi.fn(),
}))

import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { hasHotelTenantAccess, resolveHotelTenantAccess } from '@/lib/data/tenant-guard'

function managerProfile(hotelId = HOTEL_A): Profile {
  return {
    id: USER_ID,
    hotel_id: hotelId,
    role: 'manager',
    name: 'Manager',
    email: 'manager@example.com',
    phone: '+233200000000',
    is_active: true,
    mfa_enabled: true,
    mfa_method: 'sms',
    mfa_sms_enabled: true,
    mfa_totp_secret: null,
    mfa_totp_pending_secret: null,
    onboarding_completed_at: new Date().toISOString(),
    onboarding_step: 'done',
    created_at: new Date().toISOString(),
  } as Profile
}

describe('tenant guard', () => {
  beforeEach(() => {
    vi.mocked(getVerifiedProfile).mockReset()
    vi.mocked(ownerOwnsHotel).mockReset()
  })

  it('allows staff assigned to the hotel', async () => {
    vi.mocked(getVerifiedProfile).mockResolvedValue(managerProfile(HOTEL_A))
    expect(await hasHotelTenantAccess(HOTEL_A)).toBe(true)
    expect(await hasHotelTenantAccess(HOTEL_B)).toBe(false)
  })

  it('blocks staff when role filter does not match', async () => {
    vi.mocked(getVerifiedProfile).mockResolvedValue(managerProfile(HOTEL_A))
    expect(await hasHotelTenantAccess(HOTEL_A, { roles: ['owner'] })).toBe(false)
  })

  it('allows owners who own the hotel in their portfolio', async () => {
    vi.mocked(getVerifiedProfile).mockResolvedValue({
      ...managerProfile(HOTEL_B),
      role: 'owner',
      hotel_id: HOTEL_A,
    })
    vi.mocked(ownerOwnsHotel).mockResolvedValue(true)
    const profile = await resolveHotelTenantAccess(HOTEL_B, { roles: ['owner'] })
    expect(profile).not.toBeNull()
    expect(ownerOwnsHotel).toHaveBeenCalledWith(USER_ID, HOTEL_B)
  })

  it('returns null when not signed in', async () => {
    vi.mocked(getVerifiedProfile).mockResolvedValue(null)
    expect(await resolveHotelTenantAccess(HOTEL_A)).toBeNull()
  })
})
