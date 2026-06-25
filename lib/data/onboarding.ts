import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubscriptionForOwner } from '@/lib/saas/organization'
import type { OnboardingStep } from '@/types'
import type { SubscriptionSnapshot } from '@/lib/saas/plans'

export interface OnboardingPageData {
  step: OnboardingStep
  ownerName: string
  subscription: SubscriptionSnapshot | null
  hotelId: string | null
}

export async function getOnboardingPageData(): Promise<OnboardingPageData | null> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner' || profile.onboarding_completed_at) return null

  const subscription = await getSubscriptionForOwner(profile.id)

  return {
    step: (profile.onboarding_step ?? 'welcome') as OnboardingStep,
    ownerName: profile.name,
    subscription,
    hotelId: profile.hotel_id,
  }
}

export async function getActiveHotelCompliance(hotelId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('gta_license_number, gta_license_expiry, vat_registration_number, vat_mode')
    .eq('id', hotelId)
    .maybeSingle()

  return data
}
