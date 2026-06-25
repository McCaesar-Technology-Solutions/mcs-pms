import { getProfile } from '@/lib/auth/get-profile'
import type { OnboardingStep } from '@/lib/onboarding/state'

export interface OnboardingPageData {
  step: OnboardingStep
  ownerName: string
}

export async function getOnboardingPageData(): Promise<OnboardingPageData | null> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner') return null
  if (profile.onboarding_completed_at || profile.hotel_id) return null

  return {
    step: (profile.onboarding_step ?? 'welcome') as OnboardingStep,
    ownerName: profile.name,
  }
}
